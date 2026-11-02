import type { ReactNode } from 'react';
import { BAL } from '../../data';
import { canRebirth, inventoryCapacity, upgradeCostAt, upgradeLevel } from '../../core';
import { useGame } from '../../app/store';
import { haptics } from '../../services';
import { t } from '../i18n';
import { useUi, type Tab } from '../uiStore';
import { ArrowUpIcon, BagIcon, CartIcon, DumpsterIcon, RebirthIcon } from './Icons';
import s from './nav.module.css';

interface TabDef {
  id: Tab | 'shop';
  icon: (size: number) => ReactNode;
}

const TABS: TabDef[] = [
  { id: 'alley', icon: (n) => <DumpsterIcon size={n} /> },
  { id: 'bag', icon: (n) => <BagIcon size={n} /> },
  { id: 'upgrades', icon: (n) => <ArrowUpIcon size={n} /> },
  { id: 'rebirth', icon: (n) => <RebirthIcon size={n} /> },
  { id: 'shop', icon: (n) => <CartIcon size={n} /> },
];

export function BottomNav() {
  const tab = useUi((u) => u.tab);
  const affordable = useGame((g) =>
    BAL.upgrades.some((d) => upgradeLevel(g, d.id) < d.max && g.currencies.coins >= upgradeCostAt(d, upgradeLevel(g, d.id))),
  );
  const rebirth = useGame(canRebirth);
  const bagFull = useGame((g) => g.inventory.length >= inventoryCapacity(g));
  const badge: Partial<Record<TabDef['id'], boolean>> = { upgrades: affordable, rebirth, bag: bagFull };
  return (
    <nav className={s.nav}>
      {TABS.map((d) => {
        const active = d.id === tab;
        const locked = d.id === 'shop';
        return (
          <button
            key={d.id}
            aria-label={t(`tab.${d.id}`)}
            className={[s.tab, active ? s.active : '', locked ? s.locked : ''].join(' ')}
            onClick={() => {
              haptics.impact('light');
              if (locked) useUi.getState().toast(t('tab.locked', { name: t(`tab.${d.id}`) }), 'info');
              else useUi.getState().setTab(d.id as Tab);
            }}
          >
            <span className={s.icon}>{d.icon(active ? 96 : 76)}</span>
            <span className={s.label}>{t(`tab.${d.id}`)}</span>
            {badge[d.id] && <span className={s.badge}>!</span>}
            {locked && <span className={s.soon}>{t('tab.soon')}</span>}
          </button>
        );
      })}
    </nav>
  );
}
