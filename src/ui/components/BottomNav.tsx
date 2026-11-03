import { DATA } from '../../data';
import { affordableUpgrades, canRebirth, inventoryCapacity, isUpgrade, worldThreat } from '../../core';
import { useGame } from '../../app/store';
import { haptics } from '../../services';
import { t } from '../i18n';
import { useUi, type Tab } from '../uiStore';
import { ArrowUpIcon, BagIcon, GlobeIcon, RebirthIcon, ReelIcon, TvIcon } from './Icons';
import s from './nav.module.css';

interface TabDef {
  id: Tab;
  icon: typeof ReelIcon;
}

/** Nav icons are all 10 x 10 art pixels (90 px); the open tab rises instead of growing. */
const TABS: TabDef[] = [
  { id: 'alley', icon: ReelIcon },
  { id: 'watch', icon: TvIcon },
  { id: 'bag', icon: BagIcon },
  { id: 'upgrades', icon: ArrowUpIcon },
  { id: 'rebirth', icon: RebirthIcon },
  { id: 'worlds', icon: GlobeIcon },
];

export function BottomNav() {
  const tab = useUi((u) => u.tab);
  const affordable = useGame((g) => affordableUpgrades(g).length > 0);
  const rebirth = useGame(canRebirth);
  const bagBadge = useGame((g) => g.inventory.length >= inventoryCapacity(g) || g.inventory.some((it) => isUpgrade(g, it)));
  const easyNext = useGame((g) => {
    const next = g.stage.highestCleared + 1;
    return next <= DATA.worlds.length && g.battle.stage !== next && worldThreat(g, next).level === 'easy';
  });
  const badge: Partial<Record<TabDef['id'], boolean>> = { upgrades: affordable, rebirth, bag: bagBadge, worlds: easyNext };
  return (
    <nav className={s.nav}>
      {TABS.map((d) => {
        const active = d.id === tab;
        return (
          <button
            key={d.id}
            aria-label={t(`tab.${d.id}`)}
            className={[s.tab, active ? s.active : ''].join(' ')}
            onClick={() => {
              haptics.impact('light');
              useUi.getState().setTab(d.id);
            }}
          >
            <span className={`${s.icon} ${d.id === 'alley' ? s.spinIcon : ''}`}>
              <d.icon size="nav" />
            </span>
            <span className={s.label}>{t(`tab.${d.id}`)}</span>
            {badge[d.id] && <span className={s.badge}>!</span>}
          </button>
        );
      })}
    </nav>
  );
}
