import { codexKey, formatNumber, formatStatValue, itemFlavor, itemName, recycleRewards, type Item } from '../../core';
import { dispatch, useGame } from '../../app/store';
import { rarityColor } from '../../render/art';
import { DATA } from '../../data';
import { haptics } from '../../services';
import { ItemIcon } from '../components/ItemIcon';
import { CoinIcon } from '../components/Icons';
import { t } from '../i18n';
import { useUi } from '../uiStore';
import { statLines } from './statRows';
import s from './popups.module.css';

function statLabel(stat: string, mode: string) {
  return mode === 'pct' && !['CRIT', 'CRIT_DMG', 'DODGE', 'LIFESTEAL', 'BAG_FIND', 'COIN_FIND', 'BOSS_DMG'].includes(stat)
    ? t('stat.pct', { stat: t(`stat.${stat}`) })
    : t(`stat.${stat}`);
}

export function CompareCard({ item }: { item: Item }) {
  const current = useGame((g) => g.equipped[item.slot]);
  const newKeys = useUi((u) => u.newCodexKeys);
  const rec = recycleRewards(item);
  const curLines = new Map(statLines(current).map((l) => [l.key, l.value]));
  const diff = item.power - (current?.power ?? 0);
  const color = rarityColor(item.rarity);
  const perk = item.mintPerkId ? DATA.mintPerksById.get(item.mintPerkId) : null;
  const isNew = newKeys.includes(codexKey(item.baseId, item.rarity));

  return (
    <div className={s.overlay}>
      <div className={`${s.card} cardboard`} style={{ boxShadow: `0 16px 0 var(--outline), 0 0 80px ${color}88` }}>
        <span className="tape tl" />
        <span className="tape br" />
        {isNew && <span className={s.newStamp}>{t('compare.new')}</span>}
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <span className={s.ribbon} style={{ background: color }}>{t(`rarity.${item.rarity}`)}</span>
        </div>
        <div className={s.itemHead}>
          <ItemIcon item={item} size={190} />
          <div className={s.itemHeadText}>
            <span className={s.itemName} style={{ color }}>{itemName(item)}</span>
            <span className={s.meta}>{t('compare.meta', { slot: t(`slot.${item.slot}`), level: item.level })}</span>
            <span className={s.flavor}>“{itemFlavor(item)}”</span>
          </div>
        </div>
        <div className={s.stats}>
          {statLines(item).map((l) => {
            const before = curLines.get(l.key) ?? 0;
            const d = l.value - before;
            return (
              <div key={l.key} className={s.statRow}>
                <span className={l.main ? s.statMain : s.statSub}>{statLabel(l.stat, l.mode)}</span>
                <span>
                  {formatStatValue(l.stat, l.mode, l.value)}{' '}
                  {current && Math.abs(d) > 0.005 && (
                    <span className={d > 0 ? s.up : s.down}>{d > 0 ? '▲' : '▼'}</span>
                  )}
                </span>
              </div>
            );
          })}
          {perk && (
            <div className={s.mintPerk}>
              ✨ {perk.name}: {perk.text}
            </div>
          )}
        </div>
        <div className={s.powerRow}>
          <span>⚡ {formatNumber(item.power)}</span>
          {current ? (
            <span className={diff >= 0 ? s.up : s.down}>
              {diff >= 0 ? '▲ +' : '▼ '}
              {formatNumber(Math.abs(diff)) === '0' ? '0' : (diff < 0 ? '-' : '') + formatNumber(Math.abs(diff))}
            </span>
          ) : (
            <span className={s.up}>{t('compare.emptySlot')}</span>
          )}
        </div>
        {current && (
          <div className={s.vs}>
            <ItemIcon item={current} size={90} showLevel={false} />
            <span>
              {t('compare.equipped')}{' '}
              <b style={{ color: rarityColor(current.rarity) }}>{itemName(current)}</b> · ⚡ {formatNumber(current.power)}
            </span>
          </div>
        )}
        <div className={s.actions}>
          <button
            className="btn alt"
            onClick={() => {
              haptics.impact('light');
              dispatch({ type: 'recyclePending' });
            }}
          >
            ♻️ {t('compare.recycle')}
            <span style={{ fontSize: 28, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              +{formatNumber(rec.xp)} XP <CoinIcon />+{formatNumber(rec.coins)}
            </span>
          </button>
          <button
            className={`btn ${diff >= 0 || !current ? '' : 'alt'}`}
            onClick={() => {
              haptics.impact('medium');
              dispatch({ type: 'equipPending' });
            }}
          >
            {t('compare.equip')}
          </button>
        </div>
      </div>
    </div>
  );
}
