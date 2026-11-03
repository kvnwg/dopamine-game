/**
 * The equip flight (the whole moment is described in src/render/equipSlam.ts). When the raccoon puts
 * on gear, the item leaps out of wherever it was on screen (src/ui/equipSource.ts), flashing white,
 * and grows (its Scale2x, then its Scale3x art: the same 6 px pixels, just more of them). It flies up
 * over him, hangs there a beat in its rarity's glow, then dives onto him, and BattleScene takes the hit
 * and makes the piece glimmer. After the last item of a batch lands, his power ticks up big in the
 * middle of the screen with a rising sound and a green ▲ +N (or down, in red, for a worse item).
 *
 * The flight keeps the clock: it plays the sounds and calls slamBridge as each item dives and hits.
 * Everything moves in whole art pixels. With reduced motion there is no flight; the gear simply lands.
 */
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { formatNumber, playerPower, rarityIndex, wornPower, type CoreEvent, type Item } from '../../core';
import { bus } from '../../app/eventBus';
import { getGame } from '../../app/store';
import { haptics } from '../../services';
import { audio } from '../../services/audio';
import { rarityColor } from '../../render/art';
import { SLAM, SLAM_FROM, slamBridge, slamPlan, slamPoint, type SlamPlan } from '../../render/equipSlam';
import { itemArt, sparkleArt, UI_PX, type ArtScale } from '../../render/icons';
import { equipSourceOf, type EquipSource } from '../equipSource';
import { t } from '../i18n';
import { raysUrl } from '../rays';
import { useUi } from '../uiStore';
import { ArrowDownIcon, ArrowUpIcon, PowerIcon } from './Icons';
import { PixelArt } from './PixelArt';
import s from './equipFlight.module.css';

type Phase = 'lift' | 'grow' | 'rise' | 'hang' | 'dive';

interface Flight {
  id: number;
  item: Item;
  tier: number;
  from: EquipSource;
  plan: SlamPlan;
  /**
   * performance.now() at its first painted frame (0 until then): the flight's clock starts when it
   * can first be seen, so the busy frame right after an equip never eats the leap out of the tile.
   */
  t0: number;
  /** The batch it was equipped in (Equip best puts on several at once), and whether it's the last. */
  batch: number;
  last: boolean;
}

interface PowerShow {
  id: number;
  from: number;
  to: number;
}

let ids = 1;

/** Where a flight starts when its item isn't on screen: just over the nav, in the middle. */
const FALLBACK: EquipSource = { x: 540, y: 1660, scale: 1 };

const snap = (v: number) => Math.round(v / UI_PX) * UI_PX;
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const easeOut = (k: number) => 1 - (1 - k) * (1 - k);
const easeInOut = (k: number) => (k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2);

/** Where it hangs before the dive: well over the slot it lands on, under the top bar. */
function hangPoint(f: Flight): { x: number; y: number } {
  const p = slamPoint(f.item.slot);
  return { x: p.x, y: Math.max(260, p.y - 330) };
}

/** Where the art's middle is `ms` after the equip, how fine its art is, and which part it's in. */
function where(f: Flight, ms: number): { x: number; y: number; scale: ArtScale; phase: Phase } {
  const { plan, from } = f;
  const big: ArtScale = 3;
  if (ms < plan.grow) {
    const k = clamp01((ms - plan.lift) / SLAM.lift);
    return { x: from.x, y: from.y - 2 * UI_PX * easeOut(k), scale: from.scale, phase: 'lift' };
  }
  if (ms < plan.rise) {
    const k = clamp01((ms - plan.grow) / SLAM.grow);
    const scale: ArtScale = k < 0.5 ? (Math.max(2, from.scale) as ArtScale) : big;
    return { x: from.x, y: from.y - (2 + 4 * k) * UI_PX, scale, phase: 'grow' };
  }
  const h = hangPoint(f);
  if (ms < plan.hang) {
    // Thrown up and over in an arc.
    const k = easeInOut(clamp01((ms - plan.rise) / SLAM.rise));
    const a = { x: from.x, y: from.y - 6 * UI_PX };
    const c = { x: (a.x + h.x) / 2, y: Math.min(a.y, h.y) - 220 };
    const u = 1 - k;
    return { x: u * u * a.x + 2 * u * k * c.x + k * k * h.x, y: u * u * a.y + 2 * u * k * c.y + k * k * h.y, scale: big, phase: 'rise' };
  }
  if (ms < plan.dive) {
    const bob = Math.floor((ms - plan.hang) / 110) % 2 ? -UI_PX : 0;
    return { x: h.x, y: h.y + bob, scale: big, phase: 'hang' };
  }
  // The dive: faster and faster onto him, its art stepping down as it closes in.
  const k = clamp01((ms - plan.dive) / SLAM.dive);
  const p = slamPoint(f.item.slot);
  const e = k * k;
  return { x: h.x + (p.x - h.x) * e, y: h.y + (p.y - h.y) * e, scale: k < 0.4 ? 3 : k < 0.75 ? 2 : 1, phase: 'dive' };
}

function FlightView({ f, onHit }: { f: Flight; onHit: (f: Flight) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const ghosts = useRef<(HTMLImageElement | null)[]>([]);
  const [look, setLook] = useState<{ scale: ArtScale; phase: Phase }>({ scale: f.from.scale, phase: 'lift' });
  const lookRef = useRef(look);
  const hit = useRef(onHit);
  hit.current = onHit;
  /** The moments already played: the leap, the dive, the hit. */
  const done = useRef({ lift: false, dive: false, hit: false });

  useEffect(() => {
    let raf = 0;
    const frame = () => {
      raf = requestAnimationFrame(frame);
      const el = ref.current;
      if (!el) return;
      if (!f.t0) f.t0 = performance.now();
      const ms = performance.now() - f.t0;
      const d = done.current;
      // Its sounds and the battle's part play on its own clock, so they always match what you see.
      if (!d.lift && ms >= f.plan.lift) {
        d.lift = true;
        audio.equipLift(f.tier);
        haptics.impact('light');
      }
      if (!d.dive && ms >= f.plan.dive) {
        d.dive = true;
        audio.equipDrop(f.tier);
        slamBridge.dive?.(f.item, f.tier, SLAM.dive);
      }
      if (ms >= f.plan.impact) {
        el.style.visibility = 'hidden';
        if (!d.hit) {
          d.hit = true;
          hit.current(f);
        }
        return;
      }
      if (ms < f.plan.lift) return;
      const w = where(f, ms);
      el.style.transform = `translate3d(${snap(w.x)}px, ${snap(w.y)}px, 0)`;
      el.style.visibility = 'visible';
      // Afterimages on the dive: where it was a moment ago.
      ghosts.current.forEach((g, i) => {
        if (!g) return;
        const back = where(f, ms - (i + 1) * 28);
        g.style.transform = `translate3d(${snap(back.x - w.x)}px, ${snap(back.y - w.y)}px, 0)`;
      });
      if (w.scale !== lookRef.current.scale || w.phase !== lookRef.current.phase) {
        lookRef.current = { scale: w.scale, phase: w.phase };
        setLook(lookRef.current);
      }
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [f]);

  const art = itemArt(f.item.baseId, look.scale);
  const size = art.w * UI_PX;
  const color = rarityColor(f.item.rarity);
  const flying = look.phase !== 'lift';
  const style = { ['--c' as string]: color, ['--size' as string]: `${size}px` } as CSSProperties;
  return (
    <div ref={ref} className={s.flight} style={style} data-phase={look.phase}>
      {flying && f.tier >= SLAM_FROM.sparkle && <div className={s.rays} style={{ backgroundImage: `url(${raysUrl([color, '#ffffff'])})` }} />}
      {flying && <div className={s.glow} />}
      {look.phase === 'dive' &&
        [0, 1].map((i) => (
          <img
            key={i}
            ref={(el) => {
              ghosts.current[i] = el;
            }}
            src={art.url}
            alt=""
            aria-hidden
            className={s.ghost}
            style={{ width: size, height: size, opacity: i === 0 ? 0.5 : 0.25 }}
          />
        ))}
      <PixelArt art={art} className={s.art} />
      {(look.phase === 'hang' || look.phase === 'rise') && f.tier >= SLAM_FROM.sparkle && (
        <>
          {[0, 1, 2, 3].map((i) => (
            <PixelArt key={i} art={sparkleArt()} className={s.spark} style={{ ['--i' as string]: i } as CSSProperties} />
          ))}
        </>
      )}
    </div>
  );
}

/**
 * Makes (and starts decoding) the big art, the rays and the sparkle before a flight's clock starts,
 * so the flight never stalls on them halfway.
 */
function warmUp(items: readonly Item[]): void {
  const urls = [sparkleArt().url];
  for (const it of items) {
    urls.push(itemArt(it.baseId, 2).url, itemArt(it.baseId, 3).url);
    if (rarityIndex(it.rarity) >= SLAM_FROM.sparkle) urls.push(raysUrl([rarityColor(it.rarity), '#ffffff']));
  }
  for (const url of urls) {
    const img = new Image();
    img.src = url;
    img.decode?.().catch(() => {});
  }
}

/** His power after an equip: counts from the old total to the new one, big, in the middle of the screen. */
function PowerPop({ show, onDone }: { show: PowerShow; onDone: () => void }) {
  const up = show.to > show.from;
  const [shown, setShown] = useState(show.from);
  const [landed, setLanded] = useState(false);
  useEffect(() => {
    let raf = 0;
    let last = show.from;
    const count = 820;
    let t0 = 0;
    const tick = () => {
      const k = Math.min(1, (performance.now() - t0) / count);
      const v = Math.round(show.from + (show.to - show.from) * (1 - Math.pow(1 - k, 3)));
      if (v !== last) {
        last = v;
        setShown(v);
        audio.powerTick(k, up);
      }
      if (k < 1) raf = requestAnimationFrame(tick);
      else {
        setLanded(true);
        audio.powerLanded(up);
        haptics.impact(up ? 'medium' : 'light');
      }
    };
    const start = setTimeout(() => {
      t0 = performance.now();
      raf = requestAnimationFrame(tick);
    }, 200);
    const end = setTimeout(onDone, 200 + count + 1250);
    return () => {
      clearTimeout(start);
      clearTimeout(end);
      cancelAnimationFrame(raf);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show.id]);
  const diff = show.to - show.from;
  return (
    <div className={s.powerWrap}>
      <div className={`${s.power} ${up ? s.powerUp : s.powerDown} ${landed ? s.powerLanded : ''}`}>
        <div className={s.powerLabel}>
          <PowerIcon size="md" />
          {t('equip.power')}
        </div>
        <div key={landed ? 'l' : 'c'} className={s.powerNum}>
          {formatNumber(shown)}
        </div>
        <div className={s.powerDiff} data-on={landed || undefined}>
          {up ? <ArrowUpIcon size="md" /> : <ArrowDownIcon size="md" />}
          {up ? '+' : '-'}
          {formatNumber(Math.abs(diff))}
        </div>
      </div>
    </div>
  );
}

/** The layer for equip flights and the power count (in App, over everything but the reveal). */
export function EquipFlight() {
  const [flights, setFlights] = useState<Flight[]>([]);
  const [power, setPower] = useState<PowerShow | null>(null);
  // The power count waits for a big reveal to finish (it would sit on the reveal's black screen).
  const revealing = useUi((u) => u.celebrate !== null);
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>());
  /** Each batch's power change, shown when its last item lands. */
  const batches = useRef(new Map<number, { delta: number; to: number }>());

  const later = (ms: number, fn: () => void) => {
    const id = setTimeout(() => {
      timers.current.delete(id);
      fn();
    }, ms);
    timers.current.add(id);
  };

  /** An item lands on him: the hit's sound and shake, BattleScene's impact, then (last of a batch) his power. */
  const landed = (f: Flight) => {
    audio.equipImpact(f.tier);
    slamBridge.impact?.(f.item, f.tier);
    haptics.impact(f.tier >= SLAM_FROM.pillar ? 'heavy' : f.tier >= SLAM_FROM.ring ? 'medium' : 'light');
    setFlights((fs) => fs.filter((x) => x.id !== f.id));
    const b = batches.current.get(f.batch);
    if (f.last && b) {
      batches.current.delete(f.batch);
      later(140, () => setPower({ id: ids++, from: b.to - b.delta, to: b.to }));
    }
  };
  const landedRef = useRef(landed);
  landedRef.current = landed;

  useEffect(() => {
    const off = bus.on((events: CoreEvent[]) => {
      const equips = events.filter((e): e is Extract<CoreEvent, { type: 'equip' }> => e.type === 'equip');
      if (!equips.length) return;
      const g = getGame();
      const calm = g.settings.reduceMotion;
      if (!calm) warmUp(equips.map((e) => e.item));
      const batch = ids++;
      const made: Flight[] = equips.map((e, i) => {
        const tier = rarityIndex(e.item.rarity);
        return {
          id: ids++, item: e.item, tier, from: equipSourceOf(e.item.uid) ?? FALLBACK, plan: slamPlan(i, tier, calm),
          t0: 0, batch, last: i === equips.length - 1,
        };
      });
      // His power: the worn power of what went on, less what came off.
      const delta = equips.reduce((n, e) => n + wornPower(g, e.item) - (e.replaced ? wornPower(g, e.replaced) : 0), 0);
      if (delta !== 0) batches.current.set(batch, { delta, to: playerPower(g) });
      if (calm) {
        // No flight: each item simply lands, a moment apart.
        for (const f of made) later(f.plan.impact, () => landedRef.current(f));
        return;
      }
      setFlights((fs) => [...fs, ...made]);
    });
    const pending = timers.current;
    return () => {
      off();
      pending.forEach(clearTimeout);
    };
  }, []);

  return (
    <div className={s.layer}>
      {flights.map((f) => (
        <FlightView key={f.id} f={f} onHit={(x) => landedRef.current(x)} />
      ))}
      {power && !revealing && <PowerPop key={power.id} show={power} onDone={() => setPower((p) => (p?.id === power.id ? null : p))} />}
    </div>
  );
}
