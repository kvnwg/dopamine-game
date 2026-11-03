import type { ReactNode } from 'react';
import { DATA } from '../../data';
import { affordableUpgrades, canRebirth, inventoryCapacity, isUpgrade, worldThreat } from '../../core';
import { useGame } from '../../app/store';
import { haptics } from '../../services';
import { t } from '../i18n';
import { useUi, type Tab } from '../uiStore';
import { ArrowUpIcon, BagIcon, GlobeIcon, RebirthIcon, WheelIcon } from './Icons';
import s from './nav.module.css';

interface TabDef {
  id: Tab;
  icon: (size: number) => ReactNode;
}

const TABS: TabDef[] = [
  { id: 'alley', icon: (n) => <WheelIcon size={n} /> },
  { id: 'bag', icon: (n) => <BagIcon size={n} /> },
  { id: 'upgrades', icon: (n) => <ArrowUpIcon size={n} /> },
  { id: 'rebirth', icon: (n) => <RebirthIcon size={n} /> },
  { id: 'worlds', icon: (n) => <GlobeIcon size={n} /> },
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
            <span className={`${s.icon} ${d.id === 'alley' ? s.spinIcon : ''}`}>{d.icon(active ? 96 : 76)}</span>
            <span className={s.label}>{t(`tab.${d.id}`)}</span>
            {badge[d.id] && <span className={s.badge}>!</span>}
          </button>
        );
      })}
    </nav>
  );
}
