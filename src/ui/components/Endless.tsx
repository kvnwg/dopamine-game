/**
 * The Endless Dump on screen: its card on the Worlds tab, the "Next up" goals, the floor box over the
 * battle, and the Dodge button that shows while a boss winds up a slam (Kevin: "make it a different
 * world that unlocks after 20th is beaten"; the goals and the button from the endless-fun plan).
 */
import type { CSSProperties } from 'react';
import type { TwistId } from '../../data';
import {
  currentTwist, endlessOpen, entryFloor, floorOf, gatePreview, goals, gritPct, inDump, isGate, lastWorld, lookWorld, nextGate, runFloor, wavesIn,
  type Goal,
} from '../../core';
import { dispatch, useGame, useGameWhen } from '../../app/store';
import { haptics } from '../../services';
import { audio } from '../../services/audio';
import { t } from '../i18n';
import { useUi } from '../uiStore';
import { useWorldThumb } from '../worldThumbs';
import { LockIcon, SkullIcon } from './Icons';
import { PixelArt } from './PixelArt';
import s from './endless.module.css';

/** A twist's chip color: hard ones by what they ask, good ones green. */
export const TWIST_COLOR: Record<TwistId, string> = {
  swarm: '#ff9100', regen: '#00c853', armored: '#78909c', spiky: '#d32f2f', slippery: '#29b6f6', giants: '#8d6e63',
  goldRush: '#ffb300', lucky: '#5bc236', pinata: '#e040fb',
};

export function TwistChip({ twist }: { twist: TwistId | null }) {
  if (!twist) return <span className={s.chip} style={{ ['--cc' as string]: '#6d5f78' } as CSSProperties}>{t('dump.twistNone')}</span>;
  return (
    <span className={s.chip} style={{ ['--cc' as string]: TWIST_COLOR[twist] } as CSSProperties}>
      {t(`twist.${twist}.name`)}
    </span>
  );
}

/** The world a Dump floor borrows its look from, as a preview. */
function DumpThumb({ floor }: { floor: number }) {
  const art = useWorldThumb(lookWorld(lastWorld() + Math.max(1, floor)), 'card');
  return art ? <PixelArt art={art} /> : null;
}

/** The Endless Dump's card at the top of the Worlds tab: locked until World 20 falls this run. */
export function DumpCard() {
  const g = useGameWhen((x) => [x.stage.highestCleared, x.battle.stage, x.dump, x.heist.run]);
  const open = endlessOpen(g);
  const here = inDump(g);
  const floor = here ? floorOf(g.battle.stage) : entryFloor(g);
  return (
    <button
      className={`${s.dumpCard} ${here ? s.dumpCardHere : ''}`}
      onClick={() => {
        haptics.impact('light');
        if (!open) {
          useUi.getState().toast(t('dump.lockedSoon'), 'info');
          return;
        }
        useUi.getState().openPopup('dump');
      }}
    >
      <div className={`${s.dumpThumb} ${open ? '' : s.dumpLocked}`}>
        <DumpThumb floor={floor} />
        <span className={s.dumpWash} />
        <span className={s.dumpTitle}>{t('dump.card')}</span>
        {!open && <LockIcon size="md" className={s.dumpLock} />}
        {here && <span className={s.dumpHere}>{t(g.dump.mode === 'weekly' ? 'weekly.title' : 'worlds.here')}</span>}
      </div>
      <div className={s.dumpInfo}>
        {open ? (
          <>
            <span>
              {t('dump.thisRun', { n: runFloor(g) })}
            </span>
            <span>
              {g.dump.bestEver > 0 ? t('dump.deepest', { n: g.dump.bestEver }) : t('dump.deepestNone')}
            </span>
            {g.dump.stench > 0 && <b>{t('stench.level', { n: g.dump.stench })}</b>}
          </>
        ) : (
          <span className={s.dumpSub}>{t('dump.locked')}</span>
        )}
        {open && <span className={s.dumpSub}>{t('dump.cardSub')}</span>}
      </div>
    </button>
  );
}

function goalText(goal: Goal): string {
  if (goal.key === 'goals.tier') return t(goal.key, { ...goal.params, name: t(`rarity.${goal.params.name}`) });
  return t(goal.key, goal.params);
}

/** "Next up": a goal minutes away, one about an hour away, one a day or more away. */
export function GoalsCard() {
  const g = useGameWhen((x) => [x.stage.highestCleared, x.rebirths, x.dump.bestEver, x.legend, x.currencies.coins > 0]);
  const list = goals(g);
  return (
    <div className={s.goals}>
      <span className={s.goalsTitle}>{t('goals.title')}</span>
      {list.map((goal) => {
        const pct = goal.need > 0 ? Math.max(0, Math.min(1, goal.have / goal.need)) : 1;
        return (
          <div key={goal.key} className={`${s.goal} ${pct >= 0.8 ? s.goalNear : ''}`}>
            <span className={s.goalText}>{goalText(goal)}</span>
            <span className={s.goalTrack}>
              <span className={s.goalFill} style={{ display: 'block', width: `${Math.round(pct * 100)}%` }} />
            </span>
          </div>
        );
      })}
    </div>
  );
}

/** Over the battle in the Dump: the floor, its twist, the waves, the next gate, and Grit. */
export function FloorBox() {
  const g = useGameWhen((x) => [x.battle.stage, x.battle.wave, x.dump.mode, x.dump.weekly.week, x.legend.count, Math.floor(x.dump.stuckMs / 60000)]);
  const floor = floorOf(g.battle.stage);
  const twist = currentTwist(g);
  const gate = nextGate(floor);
  const waves = wavesIn(g.battle.stage);
  const grit = gritPct(g);
  return (
    <div className={s.floorBox}>
      <span className={s.floorNum}>{t(g.dump.mode === 'weekly' ? 'dump.weeklyLabel' : 'dump.label', { n: floor })}</span>
      {twist && (
        <span className={s.floorTwist} style={{ ['--cc' as string]: TWIST_COLOR[twist] } as CSSProperties}>
          {t(`twist.${twist}.name`)}
        </span>
      )}
      <span className={s.waveMini}>
        {Array.from({ length: waves }, (_, i) => (
          <span key={i} className={i < g.battle.wave ? s.on : undefined} />
        ))}
      </span>
      {isGate(floor) ? (
        <span className={s.floorGate}>
          <SkullIcon size="xs" /> {t('dump.gateNow')}
        </span>
      ) : (
        <span className={s.floorGate}>{t('dump.gateIn', { n: gate - floor })}</span>
      )}
      {grit > 0 && <span className={s.floorGrit}>{t('dump.grit', { pct: grit })}</span>}
    </div>
  );
}

/** While a boss winds up its slam: tap DODGE! and it misses (and he answers with a big blow). */
export function DodgeButton() {
  const winding = useGame((g) => !g.heist.run && g.battle.phase === 'fighting' && g.battle.enemies.some((e) => e.tele > 0));
  const armed = useGame((g) => g.battle.dodge);
  if (!winding) return null;
  return (
    <button
      className={`${s.dodge} ${armed ? s.dodgeArmed : ''}`}
      onPointerDown={(e) => {
        e.preventDefault();
        if (armed) return;
        haptics.impact('medium');
        audio.tap();
        dispatch({ type: 'dodge' });
      }}
    >
      {t('battle.dodgeNow')}
    </button>
  );
}

/** What the next gate brings, in a line or two (the Dump popup and the after-boss card). */
export function GateWarning({ fromFloor, dark }: { fromFloor: number; dark?: boolean }) {
  const g = useGameWhen((x) => [x.dump.mode, x.dump.stench, x.dump.weekly.week, x.legend.count]);
  const p = gatePreview(g, fromFloor);
  return (
    <div className={`${s.section} ${dark ? s.sectionDark : ''}`}>
      <span className={s.label}>{t('dump.nextGate', { n: p.floor })}</span>
      <span className={s.lineBig}>{t('dump.gateBoss', { name: p.boss.name })}</span>
      <div className={s.chips}>
        <TwistChip twist={p.twist} />
        {p.moves.map((m) => (
          <span key={m} className={s.chip} style={{ ['--cc' as string]: '#c62828' } as CSSProperties}>
            {t(`move.${m}`)}
          </span>
        ))}
      </div>
      {p.twist && <span className={s.line}>{t(`twist.${p.twist}.text`)}</span>}
      {p.twist && t(`twist.${p.twist}.answer`) !== `twist.${p.twist}.answer` && (
        <span className={s.answer}>{t('dump.beats', { answer: t(`twist.${p.twist}.answer`) })}</span>
      )}
      {p.moves.map((m) => (
        <span key={m} className={s.line}>
          {t(`move.${m}`)}: {t(`move.${m}.text`)}
        </span>
      ))}
    </div>
  );
}
