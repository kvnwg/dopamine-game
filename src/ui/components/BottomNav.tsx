import { useEffect, useRef, useState } from 'react';
import { DATA } from '../../data';
import { affordablePerks, affordableUpgrades, canRebirth, inventoryCapacity, isUpgrade, worldThreat, type Feature } from '../../core';
import { useGame } from '../../app/store';
import { haptics } from '../../services';
import { audio } from '../../services/audio';
import { featureView, seeFeature, type FeatureView } from '../features';
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

/** The feature each tab belongs to (a new game opens them one by one; the Roll tab is always there). */
const TAB_FEATURE: Partial<Record<Tab, Feature>> = { heist: 'heist', bag: 'bag', upgrades: 'upgrades', rebirth: 'rebirth', worlds: 'worlds' };

export function BottomNav() {
  const tab = useUi((u) => u.tab);
  // How each tab shows (a heist run already going keeps its tab open).
  const viewKey = useGame((g) =>
    TABS.map((d) => {
      const f = TAB_FEATURE[d.id];
      return !f || (d.id === 'heist' && g.heist.run) ? 'open' : featureView(g, f);
    }).join(','),
  );
  const views = viewKey.split(',') as FeatureView[];
  // A tab that just opened drops its lock (and chimes); a locked one shakes its head when tapped.
  const prev = useRef<FeatureView[] | null>(null);
  const [dropping, setDropping] = useState<Record<string, number>>({});
  const [nope, setNope] = useState<string | null>(null);
  useEffect(() => {
    const before = prev.current;
    prev.current = views;
    if (!before) return;
    const opened = TABS.filter((_, i) => before[i] === 'locked' && views[i] !== 'locked').map((d) => d.id);
    if (opened.length === 0) return;
    audio.featureOpen();
    haptics.impact('medium');
    const at = Date.now();
    setDropping((cur) => ({ ...cur, ...Object.fromEntries(opened.map((id) => [id, at])) }));
    const id = setTimeout(() => setDropping((cur) => Object.fromEntries(Object.entries(cur).filter(([, v]) => v !== at))), 900);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewKey]);
  // An upgrade, or (once the Perks page is introduced) a perk, the raccoon can buy now.
  const affordable = useGame((g) => affordableUpgrades(g).length > 0 || (featureView(g, 'perks') === 'open' && affordablePerks(g).length > 0));
  // The Perks page is being introduced: it lives on the Upgrades screen, so that tab blinks too.
  const perksIntro = useGame((g) => featureView(g, 'perks') === 'intro');
  const rebirth = useGame(canRebirth);
  const bagBadge = useGame((g) => g.inventory.length >= inventoryCapacity(g) || g.inventory.some((it) => isUpgrade(g, it)));
  const easyNext = useGame((g) => {
    const next = g.stage.highestCleared + 1;
    return next <= DATA.worlds.length && g.battle.stage !== next && worldThreat(g, next).level === 'easy';
  });
  // A ticket to spend, or a heist waiting on the player (none before Heists open, with the first rebirth).
  const heist = useGame(heistNeedsYou);
  const badge: Partial<Record<TabDef['id'], boolean>> = { upgrades: affordable, rebirth, bag: bagBadge, worlds: easyNext, heist };
  return (
    <nav className={s.nav}>
      {TABS.map((d, i) => {
        const active = d.id === tab;
        const view = views[i];
        const locked = view === 'locked';
        const f = TAB_FEATURE[d.id];
        return (
          <button
            key={d.id}
            aria-label={t(`tab.${d.id}`)}
            aria-disabled={locked || undefined}
            className={[s.tab, active ? s.active : '', locked ? s.locked : '', nope === d.id ? s.nope : ''].join(' ')}
            data-new={view === 'intro' || (d.id === 'upgrades' && perksIntro) || undefined}
            onClick={() => {
              if (locked) {
                haptics.impact('light');
                setNope(d.id);
                setTimeout(() => setNope((cur) => (cur === d.id ? null : cur)), 400);
                useUi.getState().toast(t('nav.locked'), 'info');
                return;
              }
              haptics.impact('light');
              if (f) seeFeature(f);
              // The Perks page being introduced: the Upgrades screen opens straight onto it.
              if (d.id === 'upgrades' && perksIntro) {
                seeFeature('perks');
                useUi.setState({ upgradePage: 'perks' });
              }
              useUi.getState().setTab(d.id);
            }}
          >
            <span className={`${s.icon} ${d.id === 'alley' ? s.spinIcon : ''}`}>
              <d.icon size="nav" />
              {locked && <LockIcon size="sm" className={s.navLock} />}
              {dropping[d.id] && <LockIcon key={dropping[d.id]} size="sm" className={`${s.navLock} ${s.lockDrop}`} />}
            </span>
            <span className={s.label}>{t(`tab.${d.id}`)}</span>
            {view === 'open' && badge[d.id] && <span className={s.badge}>!</span>}
          </button>
        );
      })}
    </nav>
  );
}
