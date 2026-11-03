import { useState } from 'react';
import { DATA } from '../../data';
import { formatNumber, itemTierFor, worldRewards, worldThreat } from '../../core';
import { dispatch, useGame } from '../../app/store';
import { worldThumbUrl } from '../../render/worldLook';
import { haptics } from '../../services';
import { ThreatChip } from '../components/WorldsPanel';
import { t } from '../i18n';
import { useUi } from '../uiStore';
import { Modal } from './Modal';
import s from './popups.module.css';

/** One world: preview, how it matches up against you (real numbers), what it pays, and Travel. */
export function WorldPopup({ world, onClose }: { world: number; onClose: () => void }) {
  const g = useGame((x) => x);
  const [armed, setArmed] = useState(false);
  const def = DATA.worlds[world - 1];
  if (!def) return null;
  const threat = worldThreat(g, world);
  const r = worldRewards(world);
  const here = g.battle.stage === world;
  const risky = threat.level === 'deadly' || threat.level === 'oneShot';
  const tier = itemTierFor({ battle: { ...g.battle, stage: world }, stage: g.stage });
  const go = () => {
    if (risky && !armed) {
      setArmed(true);
      haptics.impact('medium');
      setTimeout(() => setArmed(false), 3000);
      return;
    }
    haptics.impact('heavy');
    dispatch({ type: 'travel', world });
    useUi.getState().toast(t('toast.travel', { n: world, name: def.name }), 'info');
    useUi.getState().setTab('alley');
    onClose();
  };
  const tone = threat.level === 'easy' ? 'green' : threat.level === 'tough' ? 'gold' : 'red';
  return (
    <Modal title={t('battle.worldLabel', { n: world, name: def.name })} tone={tone} onClose={onClose}>
      <img className={s.worldThumb} src={worldThumbUrl(world)} alt="" draggable={false} />
      <div className={s.threatRow}>
        <ThreatChip level={threat.level} big />
        <span className={s.threatText}>{t(`worlds.margin${threat.level[0].toUpperCase()}${threat.level.slice(1)}`)}</span>
      </div>
      <div className={s.inset}>
        <div className={s.statRow}>
          <span className={s.statSub}>{t('worlds.enemyHit', { hit: formatNumber(threat.enemyHit), hp: formatNumber(threat.playerHp) })}</span>
        </div>
        <div className={s.statRow}>
          <span className={s.statSub}>{t('worlds.yourHit', { hit: formatNumber(threat.playerHit), hp: formatNumber(threat.enemyHp) })}</span>
        </div>
        <div className={s.statRow}>
          <span className={s.statSub}>
            {t('worlds.boss', { name: def.boss.name })} · {formatNumber(threat.bossHp)} HP
          </span>
        </div>
      </div>
      <p className={s.rewardLine}>
        {t('worlds.rewards', { gold: formatNumber(r.gold), xp: formatNumber(r.xp), items: formatNumber(r.items) })}
      </p>
      <p className={s.note}>{t('worlds.gearNote', { tier })}</p>
      <div className={s.actions}>
        {here ? (
          <button className="btn gray" disabled>
            {t('worlds.youAreHere')}
          </button>
        ) : (
          <button className={`btn ${risky ? 'red' : ''}`} onClick={go}>
            {risky ? (armed ? t('worlds.confirm') : t('worlds.goAnyway')) : t('worlds.go')}
          </button>
        )}
      </div>
    </Modal>
  );
}
