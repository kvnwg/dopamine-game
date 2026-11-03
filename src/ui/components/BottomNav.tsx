import { DATA } from '../../data';
import { affordableUpgrades, canRebirth, heistsOpen, inventoryCapacity, isUpgrade, worldThreat } from '../../core';
import { useGame } from '../../app/store';
import { haptics } from '../../services';
import { t } from '../i18n';
import { useUi, type Tab } from '../uiStore';
import { ArrowUpIcon, BagIcon, GlobeIcon, LockIcon, RebirthIcon, ReelIcon } from './Icons';
import { HeistNavIcon, heistNeedsYou } from './heistShared';
import s from './nav.module.css';

interface TabDef {
  id: Tab;
  icon: typeof ReelIcon | typeof HeistNavIcon;
}

/** Nav icons are the 16 x 16 originals (96 px); the open tab rises instead of growing. */
const TABS: TabDef[] = [
  { id: 'alley', icon: ReelIcon },
  { id: 'heist', icon: HeistNavIcon },
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
  // A ticket to spend, or a heist waiting on the player (none before Heists open, with the first rebirth).
  const heist = useGame(heistNeedsYou);
  const heistLocked = useGame((g) => !heistsOpen(g) && !g.heist.run);
  const badge: Partial<Record<TabDef['id'], boolean>> = { upgrades: affordable, rebirth, bag: bagBadge, worlds: easyNext, heist };
  return (
    <nav className={s.nav}>
      {TABS.map((d) => {
        const active = d.id === tab;
        const locked = d.id === 'heist' && heistLocked;
        return (
          <button
            key={d.id}
            aria-label={t(`tab.${d.id}`)}
            className={[s.tab, active ? s.active : '', locked ? s.locked : ''].join(' ')}
            onClick={() => {
              haptics.impact('light');
              useUi.getState().setTab(d.id);
            }}
          >
            <span className={`${s.icon} ${d.id === 'alley' ? s.spinIcon : ''}`}>
              <d.icon size="nav" />
              {locked && <LockIcon size="sm" className={s.navLock} />}
            </span>
            <span className={s.label}>{t(`tab.${d.id}`)}</span>
            {badge[d.id] && <span className={s.badge}>!</span>}
          </button>
        );
      })}
    </nav>
  );
}
