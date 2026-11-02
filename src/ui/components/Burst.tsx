/** DOM particle burst for a dive reveal. Counts follow the art direction's effects table. */
import type { CSSProperties } from 'react';
import type { Rarity } from '../../data';
import { rarityColor } from '../../render/art';
import s from './panels.module.css';

const COUNTS: Record<Rarity, number> = { junk: 6, decent: 8, shiny: 12, epic: 30, legendary: 80, mythic: 120, mint: 120 };
const RAINBOW = ['#FF5252', '#FFB300', '#69F0AE', '#40C4FF', '#E040FB'];

function rand(i: number, salt: number): number {
  let h = Math.imul(i + 1, 0x9e3779b1) ^ Math.imul(salt + 7, 0x85ebca6b);
  h ^= h >>> 15;
  h = Math.imul(h, 0x2c1b3c6d);
  h ^= h >>> 12;
  return ((h >>> 0) % 10000) / 10000;
}

export function Burst({ rarity, compact, reduced }: { rarity: Rarity; compact: boolean; reduced: boolean }) {
  let n = COUNTS[rarity];
  if (compact) n = Math.max(3, Math.round(n / 4));
  if (reduced) n = Math.min(n, 8);
  const color = rarityColor(rarity);
  const parts = [];
  for (let i = 0; i < n; i++) {
    const ang = rand(i, 1) * Math.PI * 2;
    const dist = (rarity === 'junk' ? 60 : 120) + rand(i, 2) * (rarity === 'junk' ? 60 : compact ? 140 : 300);
    const dx = Math.cos(ang) * dist;
    const dy = Math.sin(ang) * dist * 0.8 - (rarity === 'junk' ? 30 : 60);
    const c = rarity === 'mythic' ? RAINBOW[i % RAINBOW.length] : rarity === 'legendary' && i % 3 === 0 ? '#FFF3B0' : color;
    const kind = rarity === 'junk' ? s.pDust : rarity === 'decent' || i % 4 === 3 ? s.pDot : s.pStar;
    const style = {
      background: rarity === 'junk' ? undefined : c,
      ['--dx' as string]: `${dx}px`,
      ['--dy' as string]: `${dy}px`,
      ['--rot' as string]: `${Math.round(rand(i, 3) * 540)}deg`,
      ['--dur' as string]: `${Math.round((rarity === 'junk' ? 300 : compact ? 300 : 450 + rand(i, 4) * 700))}ms`,
      transform: `scale(${0.7 + rand(i, 5) * 0.9})`,
    } as CSSProperties;
    parts.push(<span key={i} className={`${s.particle} ${kind}`} style={style} />);
  }
  return (
    <div className={s.burst}>
      {rarity === 'junk' &&
        [-40, 0, 40].map((x) => <span key={x} className={s.stink} style={{ ['--dx0' as string]: `${x}px` } as CSSProperties} />)}
      {rarity === 'epic' && !compact && <span className={s.swirl} />}
      {parts}
    </div>
  );
}
