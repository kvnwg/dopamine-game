/** Today: the day's tasks (claim each one's gems), the bonus chest for doing them all, and when they change. */
import { BAL } from '../../data';
import { dailyTask, formatDuration, formatNumber, msUntilReset } from '../../core';
import { dispatch, useGameWhen } from '../../app/store';
import { haptics } from '../../services';
import { audio } from '../../services/audio';
import { CheckIcon, GemIcon, PotionIcon } from '../components/Icons';
import { t } from '../i18n';
import { Modal } from './Modal';
import s from '../components/endless.module.css';

export function DailyPopup({ onClose }: { onClose: () => void }) {
  const g = useGameWhen((x) => [x.daily]);
  const tasks = g.daily.tasks;
  const all = tasks.length > 0 && tasks.every((x) => x.claimed);
  const chest = BAL.daily.chest;
  return (
    <Modal title={t('daily.title')} tone="gold" onClose={onClose} subtitle={t('daily.sub')}>
      {tasks.map((task) => {
        const def = dailyTask(task.id);
        if (!def) return null;
        const done = task.progress >= def.target;
        return (
          <div key={task.id} className={`${s.task} ${done ? s.taskDone : ''}`}>
            <div className={s.taskBody}>
              <span className={s.taskText}>{t(`daily.task.${task.id}`, { n: formatNumber(def.target) })}</span>
              <div className={s.taskTrack}>
                <div className={s.taskFill} style={{ width: `${Math.min(100, (task.progress / def.target) * 100)}%` }} />
              </div>
              <span className={s.taskCount}>
                {formatNumber(task.progress)} / {formatNumber(def.target)}
              </span>
            </div>
            {task.claimed ? (
              <span className={s.perkBuy} style={{ display: 'grid', placeItems: 'center', background: '#c9f2b8' }}>
                <CheckIcon size="sm" />
              </span>
            ) : (
              <button
                className={`${s.perkBuy} ${done ? 'breathe' : ''}`}
                disabled={!done}
                onClick={() => {
                  haptics.impact('medium');
                  audio.jingle(3);
                  dispatch({ type: 'claimDaily', id: task.id });
                }}
              >
                <GemIcon size="xs" /> {t('daily.gems', { n: def.gems })}
              </button>
            )}
          </div>
        );
      })}
      <div className={`${s.task} ${g.daily.chest ? s.taskDone : ''}`}>
        <div className={s.taskBody}>
          <span className={s.taskText}>{t('daily.chest')}</span>
          <span className={s.taskCount}>
            {g.daily.chest ? t('daily.chestDone') : t('daily.chestSub', { gems: chest.gems, s: chest.potionSeconds })}
          </span>
        </div>
        {!g.daily.chest && (
          <button
            className={`${s.perkBuy} ${all ? 'breathe' : ''}`}
            disabled={!all}
            onClick={() => {
              haptics.impact('heavy');
              audio.jingle(5);
              dispatch({ type: 'openDailyChest' });
            }}
          >
            <PotionIcon size="xs" /> {t('daily.chestOpen')}
          </button>
        )}
      </div>
      <p className={s.line} style={{ color: '#8b7d72' }}>
        {t('daily.resets', { time: formatDuration(Math.round(msUntilReset(Date.now()) / 1000)) })}
      </p>
    </Modal>
  );
}
