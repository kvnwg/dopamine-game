/**
 * Full-screen moments: the big reveal for a roll that is rare at the raccoon's luck (black screen,
 * the item rising and shining in Scale3x, its "1 in X" counting up to the real odds; see RareReveal),
 * the Scrap All haul and the rebirth celebration. Pixel art moves by whole 6 px art pixels.
 */
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { DATA, RARITIES, type Rarity } from '../../data';
import { currentLuck, formatNumber, itemName, RARITY_ODDS, rarityAtLeast, rarityIndex, rebirthGoldMult, rebirthLuckMult } from '../../core';
import { useGame } from '../../app/store';
import { rarityColor } from '../../render/art';
import { sparkleArt, UI_PX } from '../../render/icons';
import { audio } from '../../services/audio';
import { revealLanded, skipReveal } from '../rollController';
import { DRAMA_LEVEL, revealPhases } from '../revealTiming';
import { stagePoint } from '../drag';
import { t } from '../i18n';
import { useUi, type RollView } from '../uiStore';
import { enchantLabel, fmtOdds } from './AlleyPanel';
import { Chunky, type Grad } from './Chunky';
import { enchantColor, ItemIcon } from './ItemIcon';
import { CoinIcon } from './Icons';
import { PixelArt } from './PixelArt';
import s from './overlays.module.css';

const GRAD: Partial<Record<string, Grad>> = {
  epic: 'purple', legendary: 'gold', mythic: 'rainbow', vintage: 'gold', limited: 'red', prototype: 'blue', mint: 'white', gemMint: 'green',
  museum: 'purple', grail: 'rainbow',
};
const CONFETTI = ['#ff5252', '#ffc233', '#5bc236', '#42a5f5', '#c48bff', '#ffffff'];

function Confetti({ n }: { n: number }) {
  const bits = useMemo(
    () =>
      Array.from({ length: n }, (_, i) => ({
        left: (i * 137.5) % 100,
        delay: (i * 53) % 900,
        dur: 1500 + ((i * 97) % 1100),
        color: CONFETTI[i % CONFETTI.length],
        // Pieces are 2 x 1 or 1 x 2 art pixels and flip between the two as they fall.
        tall: i % 2 === 0,
        flip: 180 + ((i * 41) % 260),
      })),
    [n],
  );
  return (
    <div className={s.confetti}>
      {bits.map((b, i) => (
        <span
          key={i}
          data-tall={b.tall || undefined}
          style={{
            left: `${Math.round((b.left / 100) * (1080 / UI_PX)) * UI_PX}px`,
            background: b.color,
            animationDelay: `${b.delay}ms, ${b.delay}ms`,
            animationDuration: `${b.dur}ms, ${b.flip}ms`,
          } as CSSProperties}
        />
      ))}
    </div>
  );
}

function enchantDesc(id: string, tier: number): string {
  const def = DATA.enchantsById.get(id);
  if (!def) return '';
  const e = def.effect;
  const raw = e.values[tier - 1];
  const pct = ['burn', 'chain', 'echo', 'explode', 'thorns'].includes(e.type);
  const v = pct ? Math.round(raw * 100) : raw;
  if (e.type === 'mod') return t(`enchant.mod.${e.stat}`, { v });
  return t(`enchant.${e.type}`, { v });
}
export { enchantDesc };

type Phase = 'black' | 'dark' | 'appear' | 'count' | 'landed';

/** Light motes drifting in from the dark toward where the item will appear. */
function Motes({ n, ms }: { n: number; ms: number }) {
  const motes = useMemo(
    () =>
      Array.from({ length: n }, (_, i) => {
        const a = i * 2.39996;
        const r = 380 + ((i * 97) % 260);
        return { x: Math.round((Math.cos(a) * r) / UI_PX) * UI_PX, y: Math.round((Math.sin(a) * r) / UI_PX) * UI_PX, d: ms * (0.55 + ((i * 37) % 40) / 100), delay: (i * 61) % Math.max(1, ms * 0.4) };
      }),
    [n, ms],
  );
  return (
    <div className={s.motes}>
      {motes.map((m, i) => (
        <span
          key={i}
          className={s.mote}
          style={{ ['--x' as string]: `${m.x}px`, ['--y' as string]: `${m.y}px`, animationDuration: `${m.d}ms`, animationDelay: `${m.delay}ms` } as CSSProperties}
        />
      ))}
    </div>
  );
}

/** The battle's four-point sparkle (7 x 7 art pixels) twinkling on and off around the item. */
function Sparkles({ n }: { n: number }) {
  const art = sparkleArt();
  return (
    <>
      {Array.from({ length: n }, (_, i) => {
        const a = (i / n) * Math.PI * 2 + 0.4;
        const r = 190 + ((i * 53) % 70);
        // Whole art pixels from the item's center (the sprite is 7 x 7, 42 px: its middle pixel starts 18 px in).
        const x = Math.round((Math.cos(a) * r) / UI_PX) * UI_PX - 3 * UI_PX;
        const y = Math.round((Math.sin(a) * r) / UI_PX) * UI_PX - 3 * UI_PX;
        return (
          <PixelArt
            key={i}
            art={art}
            className={s.sparkle}
            style={{ left: `calc(50% + ${x}px)`, top: `calc(50% + ${y}px)`, animationDelay: `${(i * 173) % 1100}ms` }}
          />
        );
      })}
    </>
  );
}

/**
 * The big reveal for a roll that is rare at the raccoon's luck: the screen goes black, a heartbeat in
 * the dark while light gathers, the item rises out of the dark as a silhouette and bursts into color,
 * shining, while its "1 in X" counts up from 1 (slowing near the end, its plate taking each tier's
 * colors as it climbs past their odds) and slams down on the real odds. Tap skips to the result;
 * tap again closes it.
 */
function RareReveal({ view }: { view: RollView }) {
  const calm = useGame((g) => g.settings.reduceMotion);
  const noFlash = useGame((g) => g.settings.reduceFlashing);
  const luck = useGame((g) => currentLuck(g, Date.now()));
  const drama = view.drama ?? 'big';
  const lvl = DRAMA_LEVEL[drama];
  const ph = useMemo(() => revealPhases(drama, calm), [drama, calm]);
  const it = view.item;
  const color = rarityColor(it.rarity);
  const [phase, setPhase] = useState<Phase>('black');
  const [tier, setTier] = useState<Rarity>('junk');
  const [num, setNum] = useState('1');
  const skip = useRef(false);
  const phaseRef = useRef<Phase>('black');
  // The counter climbs through every tier from Decent up to the item's own.
  const ladder = useMemo(() => RARITIES.filter((r) => r !== 'junk' && rarityAtLeast(it.rarity, r)), [it.rarity]);

  useEffect(() => {
    const t0 = performance.now();
    const tDark = ph.black;
    const tAppear = tDark + ph.dark;
    const tCount = tAppear + ph.appear;
    const tLand = tCount + ph.count;
    let offset = 0;
    let beats = 0;
    let cur: Phase = 'black';
    let shownTier: Rarity = 'junk';
    let lastText = '1';
    let raf = 0;
    audio.blackout();
    const step = () => {
      if (skip.current) {
        skip.current = false;
        offset = Math.max(offset, tLand - (performance.now() - t0));
      }
      const el = performance.now() - t0 + offset;
      const next: Phase = el < tDark ? 'black' : el < tAppear ? 'dark' : el < tCount ? 'appear' : el < tLand ? 'count' : 'landed';
      if (next === 'black' || next === 'dark') {
        while (beats < ph.beats && el >= tDark + (beats * ph.dark) / ph.beats) audio.heartbeat(beats++);
      }
      if (next !== cur) {
        if (next === 'appear') audio.emerge(ph.appear / 1000);
        if (next === 'landed') {
          audio.slam(lvl);
          revealLanded(view);
        }
        cur = next;
        phaseRef.current = next;
        setPhase(next);
      }
      if (next === 'count' || next === 'landed') {
        const k = next === 'landed' ? 1 : (el - tCount) / ph.count;
        const eased = 1 - Math.pow(1 - k, 3);
        const v = next === 'landed' ? view.odds : Math.max(1, Math.round(Math.exp(Math.log(view.odds) * eased)));
        const text = fmtOdds(v);
        if (text !== lastText) {
          lastText = text;
          setNum(text);
          if (next === 'count') audio.countTick(k);
        }
        let reached: Rarity = 'junk';
        for (const r of ladder) if (v >= RARITY_ODDS[r]) reached = r;
        if (reached !== shownTier) {
          shownTier = reached;
          setTier(reached);
          if (next === 'count') audio.tierPass(rarityIndex(reached));
        }
      }
      if (next !== 'landed') raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view.id]);

  const tap = () => {
    if (phaseRef.current === 'landed') skipReveal();
    else skip.current = true;
  };
  const title = it.rarity === 'mint' ? t('reveal.mintStamp') : `${t(`rarity.${it.rarity}`).toUpperCase()}!`;
  const lit = phase === 'count' || phase === 'landed';
  const risen = lit || phase === 'appear';
  const landed = phase === 'landed';
  const forYou = landed && luck >= 1.2 && view.luckOdds < view.odds;
  return (
    <div
      className={s.rare}
      data-phase={phase}
      data-drama={drama}
      data-calm={calm || undefined}
      onClick={tap}
      style={{ ['--c' as string]: color, ['--appear' as string]: `${ph.appear}ms` } as CSSProperties}
    >
      <div className={s.rareBlack} />
      {!lit && !calm && <Motes n={[14, 22, 32][lvl]} ms={ph.black + ph.dark + ph.appear} />}
      {phase === 'dark' && <div className={s.rareSpark} />}
      {lit && <div className={s.rareGlow} />}
      {lit && !calm && <div className={s.rays} />}
      {lit && !calm && lvl > 0 && <div className={`${s.rays} ${s.raysBack}`} />}
      {landed && !calm && <Confetti n={[50, 80, 120][lvl]} />}
      {landed && !calm && <div className={s.shock} />}
      <div className={s.center}>
        <div className={s.rareTitle}>
          {landed && (
            <div className={s.title}>
              <Chunky text={title} size={it.rarity === 'mint' ? 96 : 112} grad={GRAD[it.rarity] ?? 'gold'} />
            </div>
          )}
        </div>
        {risen && (
          <div className={`${s.rareItem} ${lit ? s.rareLit : ''}`}>
            <ItemIcon item={it} scale={3} showOdds={false} />
            {lit && <span className={s.glint} />}
            {lit && !calm && <Sparkles n={[6, 9, 12][lvl]} />}
          </div>
        )}
        {lit && (
          <span
            className={`${s.odds} ${s.rareOdds} ${landed ? s.oddsLanded : ''}`}
            data-rarity={tier}
            style={{ ['--c' as string]: rarityColor(tier) } as CSSProperties}
          >
            <i>1 in</i>
            <b key={tier}>{num}</b>
          </span>
        )}
        {landed && (
          <>
            <span className={s.name}>{itemName(it)}</span>
            {forYou && <span className={s.forYou}>{t('reveal.forYou', { odds: fmtOdds(view.luckOdds) })}</span>}
            <div className={s.tags}>
              {view.golden && <span className={`${s.tag} ${s.tagGold}`}>{t('reel.golden')}</span>}
              {view.lucky && <span className={`${s.tag} ${s.tagLucky}`}>{t('reveal.lucky')}</span>}
              {view.newRecord && <span className={`${s.tag} ${s.tagRecord}`}>{t('reveal.newRecord')}</span>}
            </div>
            {it.enchants.length > 0 && (
              <div className={s.enchants}>
                {it.enchants.map((en) => (
                  <div key={en.id} className={s.enchant}>
                    <span className={s.enchantName} style={{ background: enchantColor(en.id) }}>
                      {enchantLabel(en.id, en.tier)}
                    </span>
                    <span className={s.enchantDesc}>{enchantDesc(en.id, en.tier)}</span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
      {phase === 'appear' && !noFlash && <div className={s.flashLate} />}
      {lit && !noFlash && <div key={phase} className={s.flash} />}
      <span className={s.tap}>{landed ? (view.placed === 'bag' ? t('reveal.dragHint') : t('reveal.tap')) : t('reveal.skip')}</span>
    </div>
  );
}

function Celebrate() {
  const view = useUi((u) => u.celebrate);
  if (!view) return null;
  return <RareReveal key={view.id} view={view} />;
}

const HAUL_LEVEL = { big: 0, huge: 1, mega: 2 } as const;

/**
 * A big Scrap All haul: gold rays, the haul counting up from zero, what it is worth in fighting,
 * and a burst of coins that fly into the gold counter (which pulses as they land). Tap to close.
 */
function Haul({ haul }: { haul: NonNullable<ReturnType<typeof useUi.getState>['haul']> }) {
  const calm = useGame((g) => g.settings.reduceMotion);
  const lvl = HAUL_LEVEL[haul.size];
  const dur = [2600, 3200, 4000][lvl];
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const t0 = performance.now();
    const ms = dur * 0.5;
    let raf = 0;
    const step = () => {
      const k = Math.min(1, (performance.now() - t0) / ms);
      setShown(haul.coins * (1 - Math.pow(1 - k, 3)));
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    const close = setTimeout(() => useUi.setState({ haul: null }), dur);
    const pulses = [950, 1150, 1350, 1600].map((ms2) => setTimeout(() => useUi.setState((u) => ({ goldPulse: u.goldPulse + 1 })), ms2));
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(close);
      pulses.forEach(clearTimeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [haul.id]);
  // Where the coins fly: the gold counter, relative to the burst point (stage coordinates).
  const coins = useMemo(() => {
    const el = document.querySelector('[data-gold-target]');
    const r = el?.getBoundingClientRect();
    const target = r ? stagePoint(r.left + r.width * 0.2, r.top + r.height / 2) : { x: 880, y: 60 };
    // The burst point (stage px, matching .haulCoin in overlays.module.css).
    const cx = 540;
    const cy = 806;
    const n = [22, 36, 56][lvl];
    return Array.from({ length: n }, (_, i) => {
      const a = i * 2.39996;
      const r2 = 120 + ((i * 89) % 260);
      return {
        bx: Math.round(Math.cos(a) * r2), by: Math.round(Math.sin(a) * r2 * 0.8), tx: Math.round(target.x - cx), ty: Math.round(target.y - cy),
        delay: (i * 37) % 420, d: 1000 + ((i * 53) % 500),
      };
    });
  }, [lvl]);
  const mins = Math.round(haul.minutes);
  const worth = mins >= 120 ? t('haul.hours', { n: Math.round(haul.minutes / 6) / 10 }) : t('haul.minutes', { n: mins });
  return (
    <div className={s.haul} data-size={haul.size} onClick={() => useUi.setState({ haul: null })}>
      <div className={s.haulBack} />
      {!calm && <div className={s.haulRays} />}
      <div className={s.haulCenter}>
        <div className={s.title}>
          <Chunky text={t(`haul.${haul.size}`)} size={[100, 112, 128][lvl]} grad="gold" />
        </div>
        <span className={s.haulAmount}>
          <CoinIcon size="lg" />+{formatNumber(Math.round(shown))}
        </span>
        <span className={s.haulSub}>{worth}</span>
        <span className={s.haulCount}>{t('haul.items', { n: haul.count })}</span>
      </div>
      {!calm &&
        coins.map((c, i) => (
          <span
            key={i}
            className={s.haulCoin}
            style={{
              ['--bx' as string]: `${c.bx}px`, ['--by' as string]: `${c.by}px`, ['--tx' as string]: `${c.tx}px`, ['--ty' as string]: `${c.ty}px`,
              animationDelay: `${c.delay}ms`, animationDuration: `${c.d}ms`,
            } as CSSProperties}
          >
            <CoinIcon size="md" />
          </span>
        ))}
    </div>
  );
}

function HaulFx() {
  const haul = useUi((u) => u.haul);
  if (!haul) return null;
  return <Haul key={haul.id} haul={haul} />;
}

function RebirthFx() {
  const n = useUi((u) => u.rebirthFx);
  const reduceFlashing = useGame((g) => g.settings.reduceFlashing);
  if (n === null) return null;
  return (
    <div className={s.reveal} onClick={() => useUi.setState({ rebirthFx: null })} style={{ ['--c' as string]: '#c48bff' } as CSSProperties}>
      <div className={s.backdrop} />
      <div className={s.rays} />
      <Confetti n={60} />
      <div className={s.center}>
        <Chunky text={t('rebirth.done', { n })} size={124} grad="purple" className={s.title} />
        <span className={s.name}>
          {t('rebirth.doneSub', { luck: rebirthLuckMult(n).toFixed(2), gold: rebirthGoldMult(n).toFixed(1) })}
        </span>
      </div>
      {!reduceFlashing && <div className={s.flash} />}
    </div>
  );
}

export function RevealLayer() {
  return (
    <>
      <Celebrate />
      <HaulFx />
      <RebirthFx />
    </>
  );
}
