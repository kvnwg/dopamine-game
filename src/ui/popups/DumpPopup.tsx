/**
 * The Endless Dump: where the raccoon would go in (his floor, its twist), what the next gate brings,
 * Stench (curses for more rewards), the Weekly Dive, and the records.
 */
import { BAL, DATA } from '../../data';
import {
  entryFloor, floorName, floorOf, formatDuration, inDump, msUntilReset, runFloor, stenchRewardMult, stenchStarMult, twistAt, weeklyRule,
} from '../../core';
import { dispatch, useGameWhen } from '../../app/store';
import { haptics } from '../../services';
import { GateWarning, TwistChip } from '../components/Endless';
import { t } from '../i18n';
import { useUi } from '../uiStore';
import { Modal } from './Modal';
import s from '../components/endless.module.css';

function Stench() {
  const g = useGameWhen((x) => [x.dump.stench, x.dump.records]);
  const lvl = g.dump.stench;
  const max = BAL.stench.max;
  const set = (n: number) => {
    haptics.impact('light');
    dispatch({ type: 'setStench', level: n });
    useUi.getState().toast(n > 0 ? t('stench.changed', { n }) : t('stench.off'), n > lvl ? 'warn' : 'info');
  };
  return (
    <div className={s.section}>
      <div className={`${s.row} ${s.spread}`}>
        <span className={s.label}>{t('stench.title')}</span>
        <div className={s.stepper}>
          <button className={s.stepBtn} disabled={lvl <= 0} onClick={() => set(lvl - 1)} aria-label="-">-</button>
          <span className={s.stepValue}>{lvl > 0 ? t('stench.level', { n: lvl }) : t('stench.off')}</span>
          <button className={s.stepBtn} disabled={lvl >= max} onClick={() => set(lvl + 1)} aria-label="+">+</button>
        </div>
      </div>
      <span className={s.line}>{t('stench.sub')}</span>
      {lvl > 0 && (
        <span className={s.answer}>
          {t('stench.reward', { gold: stenchRewardMult(lvl).toFixed(1), stars: stenchStarMult(lvl).toFixed(2) })}
        </span>
      )}
      <ul className={s.curses}>
        {BAL.stench.curses.map((c, i) => (
          <li key={c.id} className={i < lvl ? s.curseOn : s.curseOff}>
            {i + 1}. {t(`stench.${c.id}`)}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Weekly() {
  const g = useGameWhen((x) => [x.dump.weekly, x.dump.mode, x.battle.stage]);
  const w = g.dump.weekly;
  const rule = weeklyRule(w.week);
  const here = inDump(g) && g.dump.mode === 'weekly';
  const go = () => {
    haptics.impact('heavy');
    dispatch({ type: 'enterDump', mode: 'weekly' });
    useUi.getState().setTab('alley');
    useUi.getState().openPopup(null);
  };
  return (
    <div className={`${s.section} ${s.sectionDark}`}>
      <span className={s.label}>{t('weekly.title')}</span>
      <span className={s.lineBig}>{t(`weekly.rule.${rule.id}`)}</span>
      <span className={s.line}>{t('weekly.sub')}</span>
      <div className={`${s.row} ${s.spread}`}>
        <span className={s.line}>{w.best > 0 ? t('weekly.best', { n: w.best }) : t('weekly.bestNone')}</span>
        <span className={s.line}>{t('weekly.ends', { time: formatDuration(Math.round(msUntilReset(Date.now(), true) / 1000)) })}</span>
      </div>
      <div className={s.rewards}>
        {BAL.weekly.rewards.map((r) => (
          <span key={r.floor} className={`${s.reward} ${w.paid.includes(r.floor) ? s.rewardDone : ''}`}>
            {r.stars > 0 ? t('weekly.rewardStars', { floor: r.floor, gems: r.gems, stars: r.stars }) : t('weekly.reward', { floor: r.floor, gems: r.gems })}
          </span>
        ))}
      </div>
      {here ? (
        <button className="btn gray" disabled>
          {t('dump.hereWeekly')}
        </button>
      ) : (
        <button className="btn blue" onClick={go}>
          {t('dump.enterWeekly', { n: w.floor })}
        </button>
      )}
    </div>
  );
}

function Records() {
  const g = useGameWhen((x) => [x.dump.records, x.dump.bestEver]);
  const r = g.dump.records;
  return (
    <div className={s.section}>
      <span className={s.label}>{t('dump.records')}</span>
      <div className={s.records}>
        <span>{t('dump.recDeepest')}</span>
        <b>{g.dump.bestEver > 0 ? t('dump.label', { n: g.dump.bestEver }) : t('dump.none')}</b>
        <span>{t('dump.recGate')}</span>
        <b>{r.fastestGateMs !== null ? formatDuration(Math.round(r.fastestGateMs / 1000)) : t('dump.none')}</b>
        {r.stench.map((f, lvl) =>
          lvl > 0 && f > 0 ? (
            <span key={lvl} style={{ display: 'contents' }}>
              <span>{t('dump.recStench', { n: lvl })}</span>
              <b>{t('dump.label', { n: f })}</b>
            </span>
          ) : null,
        )}
      </div>
    </div>
  );
}

export function DumpPopup({ onClose }: { onClose: () => void }) {
  const g = useGameWhen((x) => [x.battle.stage, x.dump, x.stage.highestCleared, x.legend.count]);
  const here = inDump(g) && g.dump.mode === 'endless';
  const floor = here ? floorOf(g.battle.stage) : entryFloor(g);
  const twist = twistAt(g, floor, false);
  const go = () => {
    haptics.impact('heavy');
    dispatch({ type: 'enterDump', mode: 'endless' });
    useUi.getState().toast(t('dump.labelFull', { n: floor, name: floorName(floor) }), 'info');
    useUi.getState().setTab('alley');
    onClose();
  };
  return (
    <Modal title={t('dump.name')} tone="purple" onClose={onClose}>
      <div className={`${s.section} ${s.sectionDark}`}>
        <span className={s.label}>{t('dump.labelFull', { n: floor, name: floorName(floor) })}</span>
        <div className={s.chips}>
          <TwistChip twist={twist} />
        </div>
        {twist && <span className={s.line}>{t(`twist.${twist}.text`)}</span>}
        {twist && hasString(`twist.${twist}.answer`) && <span className={s.answer}>{t('dump.beats', { answer: t(`twist.${twist}.answer`) })}</span>}
        <span className={s.line}>
          {t('dump.thisRun', { n: runFloor(g) })} · {g.dump.bestEver > 0 ? t('dump.deepest', { n: g.dump.bestEver }) : t('dump.deepestNone')}
        </span>
        {here ? (
          <button className="btn gray" disabled>
            {t('dump.here')}
          </button>
        ) : (
          <button className="btn breathe" onClick={go}>
            {t('dump.enter', { n: floor })}
          </button>
        )}
      </div>
      <GateWarning fromFloor={floor} />
      <Stench />
      <Weekly />
      <Records />
      <p className={s.line} style={{ color: '#8b7d72' }}>
        {t('dump.gritInfo')}
      </p>
    </Modal>
  );
}

/** Whether a string exists (an answer line only shows for twists that have one). */
function hasString(key: string): boolean {
  return DATA.strings[key] !== undefined;
}
