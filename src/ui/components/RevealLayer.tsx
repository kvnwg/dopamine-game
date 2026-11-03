/**
 * Full-screen moment for Legendary and better: a short build-up (the dumpster shakes and glows in
 * the rarity's color), then the reveal with rays, confetti, the item, its "1 in X" odds and enchants.
 * Also hosts the rebirth celebration.
 */
import { useMemo, type CSSProperties } from 'react';
import { DATA } from '../../data';
import { itemName, rebirthGoldMult, rebirthLuckMult } from '../../core';
import { useGame } from '../../app/store';
import { rarityColor } from '../../render/art';
import { skipReveal } from '../rollController';
import { t } from '../i18n';
import { useUi } from '../uiStore';
import { enchantLabel, fmtOdds } from './AlleyPanel';
import { Chunky, type Grad } from './Chunky';
import { enchantColor, ItemIcon } from './ItemIcon';
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
        rot: (i * 47) % 360,
        w: 14 + ((i * 7) % 12),
      })),
    [n],
  );
  return (
    <div className={s.confetti}>
      {bits.map((b, i) => (
        <span
          key={i}
          style={{
            left: `${b.left}%`,
            width: b.w,
            height: b.w * 0.6,
            background: b.color,
            animationDelay: `${b.delay}ms`,
            animationDuration: `${b.dur}ms`,
            ['--rot' as string]: `${b.rot}deg`,
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

function Celebrate() {
  const view = useUi((u) => u.celebrate);
  const reduceFlashing = useGame((g) => g.settings.reduceFlashing);
  const reduceMotion = useGame((g) => g.settings.reduceMotion);
  if (!view) return null;
  const it = view.item;
  const color = rarityColor(it.rarity);
  const title = it.rarity === 'mint' ? t('reveal.mintStamp') : `${t(`rarity.${it.rarity}`).toUpperCase()}!`;
  return (
    <div className={s.reveal} onClick={() => skipReveal()} style={{ ['--c' as string]: color } as CSSProperties}>
      <div className={s.backdrop} />
      {!reduceMotion && <div className={s.rays} />}
      {!reduceMotion && <Confetti n={it.rarity === 'legendary' ? 40 : 70} />}
      <div className={s.center}>
        <div className={s.title}>
          <Chunky text={title} size={it.rarity === 'mint' ? 96 : 116} grad={GRAD[it.rarity] ?? 'gold'} />
        </div>
        <div className={s.itemWrap}>
          <ItemIcon item={it} size={300} showOdds={false} />
        </div>
        <span className={s.name}>{itemName(it)}</span>
        <span className={s.odds} data-rarity={it.rarity}>
          <i>1 in</i>
          <b>{fmtOdds(view.odds)}</b>
        </span>
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
      </div>
      {!reduceFlashing && <div className={s.flash} />}
      <span className={s.tap}>{view.placed === 'bag' ? t('reveal.dragHint') : t('reveal.tap')}</span>
    </div>
  );
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
      <RebirthFx />
    </>
  );
}
