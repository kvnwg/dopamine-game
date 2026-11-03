/**
 * The spinning wheel. Core decides each roll when a spin starts (state.roll.current); the wheel
 * eases out onto that result over the spin's duration, ticking as slots pass the pointer, then
 * rests on it. The other slots are filled from the real odds at the spin's luck, so the wheel
 * never shows rare items as likelier than they are.
 */
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { RARITIES, SLOTS, type Rarity, type Slot } from '../../data';
import { rarityAtLeast, rarityChances, type Item } from '../../core';
import { gameStore, useGame } from '../../app/store';
import { itemIconUrl } from '../../render/icons';
import { rarityColor } from '../../render/art';
import { audio } from '../../services/audio';
import { t } from '../i18n';
import { useUi } from '../uiStore';
import s from './wheel.module.css';

const N = 12;
const SEG = 360 / N;
const R = 140;

interface Seg {
  rarity: Rarity;
  slot: Slot;
}

function hash(n: number): number {
  let h = Math.imul(n + 0x9e37, 0x9e3779b1);
  h ^= h >>> 15;
  h = Math.imul(h, 0x2c1b3c6d);
  h ^= h >>> 12;
  h = Math.imul(h, 0x297a2d39);
  h ^= h >>> 15;
  return ((h >>> 0) % 100000) / 100000;
}

function buildFace(item: Item, luck: number): { segs: Seg[]; k: number } {
  const chances = rarityChances(Math.max(1, luck));
  const rarest = [...RARITIES].reverse();
  const k = Math.floor(hash(item.uid * 7 + 1) * N);
  const segs: Seg[] = [];
  for (let i = 0; i < N; i++) {
    if (i === k) {
      segs.push({ rarity: item.rarity, slot: item.slot });
      continue;
    }
    const u = hash(item.uid * 131 + i * 17 + 3);
    let acc = 0;
    let r: Rarity = 'junk';
    for (const rr of rarest) {
      acc += chances[rr];
      if (u < acc) {
        r = rr;
        break;
      }
    }
    segs.push({ rarity: r, slot: SLOTS[Math.floor(hash(item.uid * 53 + i * 29 + 5) * SLOTS.length)] });
  }
  return { segs, k };
}

const DEFAULT_FACE: { segs: Seg[]; k: number } = {
  segs: Array.from({ length: N }, (_, i) => ({ rarity: (['junk', 'decent', 'junk', 'shiny', 'junk', 'decent'] as Rarity[])[i % 6], slot: SLOTS[i % SLOTS.length] })),
  k: 0,
};

function wedge(i: number): string {
  const a0 = ((i - 0.5) * SEG * Math.PI) / 180;
  const a1 = ((i + 0.5) * SEG * Math.PI) / 180;
  const p = (a: number) => `${(R * Math.sin(a)).toFixed(2)} ${(-R * Math.cos(a)).toFixed(2)}`;
  return `M0 0 L${p(a0)} A${R} ${R} 0 0 1 ${p(a1)} Z`;
}

const easeOutCubic = (k: number) => 1 - Math.pow(1 - k, 3);
const easeOutQuint = (k: number) => 1 - Math.pow(1 - k, 5);

export function Wheel() {
  const rotRef = useRef<SVGGElement>(null);
  const ptrRef = useRef<SVGGElement>(null);
  const [face, setFace] = useState<{ uid: number; segs: Seg[]; k: number }>({ uid: -1, ...DEFAULT_FACE });
  const [landed, setLanded] = useState(-1);
  const anim = useRef({ uid: -1, start: 0, end: 0, t0: 0, spinMs: 1, angle: 0, lastIdx: 0, done: true, quint: false });
  const charging = useUi((u) => u.charging);
  const reduceMotion = useGame((g) => g.settings.reduceMotion);
  const flags = useGame((g) => {
    const c = g.roll.current;
    return c ? `${c.golden ? 'g' : ''}${c.lucky ? 'l' : ''}${c.turbo ? 't' : ''}` : '';
  });

  useEffect(() => {
    let raf = 0;
    const loop = (now: number) => {
      const g = gameStore.getState().game;
      const spin = g.roll.current;
      const a = anim.current;
      if (spin && spin.item.uid !== a.uid) {
        const f = buildFace(spin.item, spin.luck);
        setFace({ uid: spin.item.uid, ...f });
        const start = ((a.angle % 360) + 360) % 360;
        const jitter = (hash(spin.item.uid * 11 + 7) - 0.5) * SEG * 0.6;
        const target = -f.k * SEG + jitter;
        const turns = Math.max(2, Math.round(spin.spinSeconds * 1.7));
        const delta = (((target - start) % 360) + 360) % 360;
        a.uid = spin.item.uid;
        a.start = start;
        a.end = start + turns * 360 + delta;
        a.t0 = now - g.roll.timer * 1000;
        a.spinMs = Math.max(1, spin.spinSeconds * 1000);
        a.done = false;
        a.quint = rarityAtLeast(spin.item.rarity, 'legendary');
      }
      if (a.uid >= 0 && !a.done) {
        const p = Math.min(1, (now - a.t0) / a.spinMs);
        const e = a.quint ? easeOutQuint(p) : easeOutCubic(p);
        const angle = a.start + (a.end - a.start) * e;
        a.angle = angle;
        rotRef.current?.setAttribute('transform', `rotate(${angle.toFixed(2)})`);
        const idx = Math.floor(((((-angle + SEG / 2) % 360) + 360) % 360) / SEG);
        if (idx !== a.lastIdx) {
          a.lastIdx = idx;
          const speed = a.quint ? Math.pow(1 - p, 4) : Math.pow(1 - p, 2);
          audio.wheelTick(speed);
          const ptr = ptrRef.current;
          if (ptr && !reduceMotion) {
            ptr.classList.remove(s.flick);
            void ptr.getBoundingClientRect();
            ptr.classList.add(s.flick);
          }
        }
        if (p >= 1) {
          a.done = true;
          audio.wheelStop();
          setLanded(a.uid);
        }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [reduceMotion]);

  const glow = charging && charging.item.uid === face.uid ? rarityColor(charging.item.rarity) : null;
  const golden = flags.includes('g');
  return (
    <div
      className={[s.wheel, glow ? s.charging : '', golden ? s.golden : ''].join(' ')}
      style={glow ? ({ ['--glow' as string]: glow } as CSSProperties) : undefined}
    >
      <svg viewBox="-170 -170 340 340" className={s.svg}>
        <defs>
          <radialGradient id="wheelShade">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.45" />
            <stop offset="55%" stopColor="#ffffff" stopOpacity="0.08" />
            <stop offset="100%" stopColor="#000000" stopOpacity="0.18" />
          </radialGradient>
          <linearGradient id="wheelRim" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={golden ? '#fff3a0' : '#f4f6fb'} />
            <stop offset="100%" stopColor={golden ? '#d48a12' : '#8f97b8'} />
          </linearGradient>
        </defs>
        <circle r={R + 18} fill="#2e2523" />
        <g ref={rotRef}>
          {face.segs.map((seg, i) => (
            <path
              key={i}
              d={wedge(i)}
              fill={rarityColor(seg.rarity)}
              stroke="#2e2523"
              strokeWidth={4}
              className={i === face.k && landed === face.uid ? s.won : undefined}
            />
          ))}
          <circle r={R} fill="url(#wheelShade)" pointerEvents="none" />
          {face.segs.map((seg, i) => (
            <g key={`i${i}`} transform={`rotate(${i * SEG})`}>
              <image href={itemIconUrl(seg.slot, seg.rarity)} x={-25} y={-R * 0.7 - 25} width={50} height={50} />
            </g>
          ))}
        </g>
        <circle r={R + 9} fill="none" stroke="url(#wheelRim)" strokeWidth={12} />
        {Array.from({ length: 24 }, (_, i) => {
          const a = (i * 15 * Math.PI) / 180;
          return <circle key={i} cx={(R + 9) * Math.sin(a)} cy={-(R + 9) * Math.cos(a)} r={4} className={i % 2 ? s.bulbA : s.bulbB} />;
        })}
        <circle r={34} fill="#fff7e6" stroke="#2e2523" strokeWidth={6} />
        <text y={10} textAnchor="middle" className={s.hubText}>
          {t('wheel.hub')}
        </text>
        <g ref={ptrRef} className={s.pointer}>
          <path d="M-20 -176 L20 -176 L0 -136 Z" fill="#ef5350" stroke="#2e2523" strokeWidth={6} strokeLinejoin="round" />
          <circle cy={-170} r={7} fill="#fff" stroke="#2e2523" strokeWidth={4} />
        </g>
      </svg>
      {flags && (
        <div className={s.badges}>
          {golden && <span className={`${s.badge} ${s.badgeGold}`}>{t('wheel.golden')}</span>}
          {flags.includes('l') && <span className={`${s.badge} ${s.badgeLucky}`}>{t('wheel.lucky')}</span>}
          {flags.includes('t') && <span className={`${s.badge} ${s.badgeTurbo}`}>{t('wheel.turbo')}</span>}
        </div>
      )}
    </div>
  );
}
