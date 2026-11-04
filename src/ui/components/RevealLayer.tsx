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
import { RAINBOW, raysUrl } from '../rays';
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

/** The reveal's light starts no higher than Shiny's blue, so it never gives the ceiling away. */
const GLOW_START = RARITIES.indexOf('shiny');

/**
 * The big reveal for a roll that is rare at the raccoon's luck: the screen goes black, a heartbeat in
 * the dark while light gathers, the item rises out of the dark as a silhouette and bursts into color,
 * shining, while its "1 in X" counts up from 1 (slowing near the end, its plate taking each tier's
 * colors as it climbs past their odds) and slams down on the real odds. The light (motes, glow disc,
 * rays, shock ring) starts at a low tier's color and flickers up tier by tier with the counter, so it
 * only reaches the item's own color as the odds land. A tutorial roll (the first find, beginner's
 * luck) gets its own banner over the title. Tap skips to the result; tap again closes it.
 */
function RareReveal({ view }: { view: RollView }) {
  const calm = useGame((g) => g.settings.reduceMotion);
  const noFlash = useGame((g) => g.settings.reduceFlashing);
  const luck = useGame((g) => currentLuck(g, Date.now()));
  const drama = view.drama ?? 'big';
  const lvl = DRAMA_LEVEL[drama];
  const ph = useMemo(() => revealPhases(drama, calm), [drama, calm]);
  const it = view.item;
  const itemTier = RARITIES.indexOf(it.rarity);
  const [phase, setPhase] = useState<Phase>('black');
  const [tier, setTier] = useState<Rarity>('junk');
  const [num, setNum] = useState('1');
  const skip = useRef(false);
  const phaseRef = useRef<Phase>('black');
  const rootRef = useRef<HTMLDivElement>(null);
  const raysRefs = useRef<(HTMLDivElement | null)[]>([]);
  // The light's tier (climbs with the counter); the rays follow once a step has settled.
  const glowRef = useRef(Math.min(itemTier, GLOW_START));
  const raysTierRef = useRef(glowRef.current);
  // The counter climbs through every tier from Decent up to the item's own.
  const ladder = useMemo(() => RARITIES.filter((r) => r !== 'junk' && rarityAtLeast(it.rarity, r)), [it.rarity]);
  // The biggest deals end on rainbow rays; until then the rays take the light's color.
  const raysFor = (k: number) => (drama === 'insane' && k >= itemTier ? raysUrl(RAINBOW, 24, 0.5) : raysUrl([rarityColor(RARITIES[k])]));

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
    // The light: its tier, the one before it and when it stepped up (it flickers between them a moment).
    let glow = glowRef.current;
    let glowPrev = glow;
    let glowAt = -1e9;
    let glowShown = -1;
    // Draw each tier's rays ahead of time in the dark, one per frame (rays.ts caches them).
    const pending = ladder.map((r) => RARITIES.indexOf(r)).filter((k) => k >= glow);
    audio.blackout();
    const step = () => {
      if (skip.current) {
        skip.current = false;
        offset = Math.max(offset, tLand - (performance.now() - t0));
      }
      const el = performance.now() - t0 + offset;
      const next: Phase = el < tDark ? 'black' : el < tAppear ? 'dark' : el < tCount ? 'appear' : el < tLand ? 'count' : 'landed';
      if ((next === 'black' || next === 'dark') && pending.length) raysFor(pending.shift()!);
      if (next === 'black' || next === 'dark') {
        while (beats < ph.beats && el >= tDark + (beats * ph.dark) / ph.beats) audio.heartbeat(beats++);
      }
      // The light climbs with the counter's tier (never past the item's own), and lands on the item's.
      const reachedTier = next === 'landed' ? itemTier : next === 'count' ? Math.max(RARITIES.indexOf(shownTier), glow) : glow;
      if (reachedTier > glow) {
        glowPrev = glow;
        glow = Math.min(itemTier, reachedTier);
        glowAt = el;
        glowRef.current = glow;
      }
      const flick = !noFlash && el - glowAt < 180 && Math.floor((el - glowAt) / 45) % 2 === 1;
      const lightTier = flick ? glowPrev : glow;
      if (lightTier !== glowShown) {
        glowShown = lightTier;
        rootRef.current?.style.setProperty('--c', rarityColor(RARITIES[lightTier]));
      }
      if (el - glowAt >= 180 && raysTierRef.current !== glow) {
        raysTierRef.current = glow;
        const url = `url(${raysFor(glow)})`;
        raysRefs.current.forEach((r) => {
          if (r) r.style.backgroundImage = url;
        });
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
      // After the landing it runs on until the light's last step has flickered and settled.
      if (next !== 'landed' || el - glowAt < 400 || raysTierRef.current !== glow) raf = requestAnimationFrame(step);
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
  // The light's color right now (the effect steps it up the tiers straight on the DOM).
  const raysNow = `url(${raysFor(raysTierRef.current)})`;
  const banner = view.scripted === 'beginner' ? t('reveal.beginner') : view.scripted === 'first' ? t('reveal.firstFind') : null;
  return (
    <div
      ref={rootRef}
      className={s.rare}
      data-phase={phase}
      data-drama={drama}
      data-calm={calm || undefined}
      onClick={tap}
      style={{ ['--c' as string]: rarityColor(RARITIES[Math.min(itemTier, GLOW_START)]), ['--appear' as string]: `${ph.appear}ms` } as CSSProperties}
    >
      <div className={s.rareBlack} />
      {!lit && !calm && <Motes n={[14, 22, 32][lvl]} ms={ph.black + ph.dark + ph.appear} />}
      {phase === 'dark' && <div className={s.rareSpark} />}
      {lit && <div className={s.rareGlow} />}
      {lit && !calm && (
        <div
          className={s.rays}
          ref={(el) => {
            raysRefs.current[0] = el;
          }}
          style={{ backgroundImage: raysNow }}
        />
      )}
      {lit && !calm && lvl > 0 && (
        <div
          className={`${s.rays} ${s.raysBack}`}
          ref={(el) => {
            raysRefs.current[1] = el;
          }}
          style={{ backgroundImage: raysNow }}
        />
      )}
      {landed && !calm && <Confetti n={[30, 44, 60][lvl]} />}
      {landed && !calm && <div className={s.shock} />}
      <div className={s.center}>
        <div className={s.rareTitle}>
          {landed && banner && (
            <div className={s.scriptedBanner}>
              <Chunky text={banner} size={72} grad="gold" />
            </div>
          )}
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
 * and a burst of coins that fly into the gold counter (which pulses as they land). It stays until the
 * player taps it away.
 */
function Haul({ haul }: { haul: NonNullable<ReturnType<typeof useUi.getState>['haul']> }) {
  const calm = useGame((g) => g.settings.reduceMotion);
  const lvl = HAUL_LEVEL[haul.size];
  const dur = [2600, 3200, 4000][lvl];
  const [shown, setShown] = useState(0);
  const [done, setDone] = useState(false);
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
    // (No timer closes it: the hint shows once the count and the coins are done.)
    const ready = setTimeout(() => setDone(true), dur);
    const pulses = [950, 1150, 1350, 1600].map((ms2) => setTimeout(() => useUi.setState((u) => ({ goldPulse: u.goldPulse + 1 })), ms2));
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(ready);
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
    // Few enough to stay smooth on phones.
    const n = [14, 20, 26][lvl];
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
      {!calm && <div className={s.haulRays} style={{ backgroundImage: `url(${raysUrl(['#ffd23f'], 18, 0.42)})` }} />}
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
      {done && <span className={`${s.tap} ${s.tapNow}`}>{t('reveal.tap')}</span>}
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
      <div className={s.rays} style={{ backgroundImage: `url(${raysUrl(['#c48bff'])})` }} />
      <Confetti n={40} />
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
