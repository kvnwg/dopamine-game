/**
 * The end of a heist, over the whole tab: a win (gold rays, confetti, the loot dealt in one by one,
 * Claim), busted with a second chance on offer (a rewarded ad once, or gems; giving up keeps half), and
 * busted for good (what was kept, Claim).
 */
import { useMemo, type CSSProperties, type ReactNode } from 'react';
import { DATA } from '../../data';
import { formatNumber, heistPayout } from '../../core';
import { useGame } from '../../app/store';
import { ads, haptics } from '../../services';
import { itemArt, type Art } from '../../render/icons';
import { pixelUrl } from '../../render/pixel';
import { blank, type PixelBuf } from '../../render/pixel/buf';
import { t } from '../i18n';
import { RAINBOW } from '../rays';
import { Chunky } from './Chunky';
import { BagIcon, CoinIcon, GemIcon, PotionIcon, TvIcon } from './Icons';
import { PixelArt } from './PixelArt';
import { LOSS_KEEP_PCT, REVIVE_GEMS, heistDispatch, heistOf, locationInfo, type HeistRewards, type HeistRun } from './heistShared';
import s from './heist.module.css';

/**
 * A burst of light rays as pixel art (180 x 134 art px: the whole tab at 6 px per pixel), in flat bands
 * that fade outward, turned by `frame` thirds of a ray. Three frames shown in turn make it revolve a
 * step at a time; nothing is rotated or scaled on screen.
 */
const RAY_W = 180;
const RAY_H = 134;
const RAY_SPOKES = 16;
const rayArts = new Map<string, Art>();
function raysArt(frame: number, color: string): Art {
  const key = `${color}:${frame}`;
  let a = rayArts.get(key);
  if (!a) {
    const make = (): PixelBuf => {
      const b = blank(RAY_W, RAY_H);
      const [r, g, bl] = [1, 3, 5].map((i) => parseInt(color.slice(i, i + 2), 16));
      const cx = RAY_W / 2;
      const cy = 45;
      const step = (Math.PI * 2) / RAY_SPOKES;
      for (let y = 0; y < RAY_H; y++) {
        for (let x = 0; x < RAY_W; x++) {
          const dx = x + 0.5 - cx;
          const dy = y + 0.5 - cy;
          const d = Math.hypot(dx, dy);
          if (d < 9) continue;
          const ang = Math.atan2(dy, dx) + (frame * step) / 3 + Math.PI * 2;
          if ((ang % step) / step > 0.42) continue;
          // Three flat bands, fading out toward the edge.
          const alpha = d < 40 ? 0.42 : d < 72 ? 0.28 : d < 110 ? 0.15 : 0;
          if (!alpha) continue;
          const i = (y * RAY_W + x) * 4;
          b.px[i] = r;
          b.px[i + 1] = g;
          b.px[i + 2] = bl;
          b.px[i + 3] = Math.round(alpha * 255);
        }
      }
      return b;
    };
    a = { url: pixelUrl(`heistRays:${key}`, make, 1), w: RAY_W, h: RAY_H };
    rayArts.set(key, a);
  }
  return a;
}

function Rays({ color }: { color: string }) {
  return (
    <div className={s.endRays} aria-hidden>
      {[0, 1, 2].map((f) => (
        <PixelArt key={f} art={raysArt(f, color)} className={s.rayFrame} style={{ animationDelay: `${f * 0.3}s` }} />
      ))}
    </div>
  );
}

/** Confetti: 2 x 1 art-pixel bits that fall and tumble (turning between 2 x 1 and 1 x 2). */
function Confetti({ n }: { n: number }) {
  const bits = useMemo(
    () =>
      Array.from({ length: n }, (_, i) => ({
        left: ((i * 137) % 172) * 6 + 24,
        delay: (i * 211) % 1600,
        dur: 1700 + ((i * 97) % 1300),
        color: RAINBOW[i % RAINBOW.length],
        tall: i % 3 === 0,
      })),
    [n],
  );
  return (
    <div className={s.confetti} aria-hidden>
      {bits.map((b, i) => (
        <span
          key={i}
          data-tall={b.tall || undefined}
          style={{ left: b.left, background: b.color, animationDelay: `${b.delay}ms, ${b.delay}ms`, animationDuration: `${b.dur}ms, 240ms` } as CSSProperties}
        />
      ))}
    </div>
  );
}

function Reward({ icon, amount, label, i }: { icon: ReactNode; amount: string; label: string; i: number }) {
  return (
    <div className={s.reward} style={{ animationDelay: `${300 + i * 160}ms` }}>
      {icon}
      <span className={s.rewardText}>
        <b>{amount}</b>
        <i>{label}</i>
      </span>
    </div>
  );
}

/** The loot: Trash Bags, coins, gems, a Luck Potion, and a ring if one dropped. */
function Rewards({ r }: { r: HeistRewards }) {
  const rows: Array<{ icon: ReactNode; amount: string; label: string }> = [];
  if (r.bags > 0) rows.push({ icon: <BagIcon size="md" />, amount: `+${formatNumber(r.bags)}`, label: t('heistUi.reward.bags') });
  if (r.coins > 0) rows.push({ icon: <CoinIcon size="md" />, amount: `+${formatNumber(r.coins)}`, label: t('heistUi.reward.coins') });
  if (r.gems > 0) rows.push({ icon: <GemIcon size="md" />, amount: `+${formatNumber(r.gems)}`, label: t('heistUi.reward.gems') });
  if (r.potion) rows.push({ icon: <PotionIcon size="md" />, amount: '×1', label: t('heistUi.reward.potion') });
  const ring = r.ring ? DATA.itemsById.get(r.ring) ?? null : null;
  return (
    <div className={s.rewards}>
      {rows.map((row, i) => (
        <Reward key={i} i={i} {...row} />
      ))}
      {rows.length === 0 && !ring && <span className={s.endNote}>{t('heistUi.reward.none')}</span>}
      {ring && (
        <div className={s.ringReward} style={{ animationDelay: `${300 + rows.length * 160 + 200}ms` }}>
          <span className={s.ringArt}>
            <PixelArt art={itemArt(ring.id)} />
          </span>
          <span className={s.rewardText}>
            <b>{ring.legendaryName}</b>
            <i>{t('heistUi.reward.ringHint')}</i>
          </span>
        </div>
      )}
    </div>
  );
}

function Won({ run }: { run: HeistRun }) {
  const calm = useGame((g) => g.settings.reduceMotion);
  const wins = useGame((g) => heistOf(g).wins[run.location] ?? 0);
  return (
    <div className={s.end} data-won="">
      <div className={s.endBack} />
      {!calm && <Rays color="#ffd23f" />}
      {!calm && <Confetti n={44} />}
      <div className={s.endCenter}>
        <Chunky text={t('heistUi.won')} size={92} grad="gold" className={s.endTitle} />
        {/* (Core counts the win when the boss falls.) */}
        <span className={s.endSub}>{t('heistUi.wonSub', { place: locationInfo(run.location).name, n: Math.max(1, wins) })}</span>
        <Rewards r={heistPayout(run)} />
        <button
          className={`btn gold breathe ${s.claimBtn}`}
          onClick={() => {
            haptics.impact('heavy');
            heistDispatch({ type: 'heistClaim' });
          }}
        >
          {t('heistUi.claim')}
        </button>
      </div>
    </div>
  );
}

function SecondChance({ run }: { run: HeistRun }) {
  const gems = useGame((g) => g.currencies.gems);
  const r = heistPayout(run);
  const revive = async (via: 'ad' | 'gems') => {
    if (via === 'ad') {
      const res = await ads.showRewarded('heist_revive');
      if (!res.rewarded) return;
    } else if (gems < REVIVE_GEMS) return;
    haptics.impact('heavy');
    heistDispatch({ type: 'heistRevive', via });
  };
  return (
    <div className={s.end} data-busted="">
      <div className={s.endBack} />
      <div className={s.endCenter}>
        <Chunky text={t('heistUi.busted')} size={100} grad="red" className={s.endTitle} />
        <span className={s.endSub}>{t('heistUi.secondChance')}</span>
        <div className={s.reviveBtns}>
          <button className={`btn blue breathe ${s.reviveBtn}`} onClick={() => revive('ad')}>
            <TvIcon size="md" />
            {t('heistUi.reviveAd')}
          </button>
          <button className={`btn gold ${s.reviveBtn}`} disabled={gems < REVIVE_GEMS} onClick={() => revive('gems')}>
            {t('heistUi.reviveGems')}
            <span className={s.price}>
              <GemIcon size="sm" />
              {REVIVE_GEMS}
            </span>
          </button>
        </div>
        <div className={s.keepNote}>
          {t('heistUi.keepPct', { pct: LOSS_KEEP_PCT })}
          <span className={s.keepLoot}>
            <BagIcon size="sm" />
            {formatNumber(Math.floor((r.bags * LOSS_KEEP_PCT) / 100))}
            <CoinIcon size="sm" />
            {formatNumber(Math.floor((r.coins * LOSS_KEEP_PCT) / 100))}
          </span>
        </div>
        <button
          className={`btn gray small ${s.giveUp}`}
          onClick={() => {
            haptics.impact('light');
            heistDispatch({ type: 'heistDecline' });
          }}
        >
          {t('heistUi.giveUp')}
        </button>
      </div>
    </div>
  );
}

function Lost({ run }: { run: HeistRun }) {
  return (
    <div className={s.end} data-busted="">
      <div className={s.endBack} />
      <div className={s.endCenter}>
        <Chunky text={t('heistUi.busted')} size={100} grad="red" className={s.endTitle} />
        <span className={s.endSub}>{t('heistUi.lostSub')}</span>
        <Rewards r={heistPayout(run)} />
        <button
          className={`btn ${s.claimBtn}`}
          onClick={() => {
            haptics.impact('medium');
            heistDispatch({ type: 'heistClaim' });
          }}
        >
          {t('heistUi.claim')}
        </button>
      </div>
    </div>
  );
}

/** A finished run: won, busted with a second chance on offer, or busted for good. */
export function HeistEnd({ run }: { run: HeistRun }) {
  if (run.status === 'won') return <Won run={run} />;
  if (run.status === 'secondChance') return <SecondChance run={run} />;
  return <Lost run={run} />;
}
