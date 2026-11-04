import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import styles from './App.module.css';
import { BattlePanel } from './components/BattlePanel';
import { AlleyPanel } from './components/AlleyPanel';
import { InventoryPanel } from './components/InventoryPanel';
import { UpgradeMap } from './components/UpgradeMap';
import { RebirthPanel } from './components/RebirthPanel';
import { WorldsPanel } from './components/WorldsPanel';
import { HeistPanel } from './components/HeistPanel';
import { UnlockedFx } from './components/Unlocks';
import { SafeLayer } from './components/SafeLayer';
import { BottomNav } from './components/BottomNav';
import { PopupLayer } from './popups/PopupLayer';
import { RevealLayer } from './components/RevealLayer';
import { DragLayer } from './components/DragLayer';
import { EquipFlight } from './components/EquipFlight';
import { TokenSlam } from './components/TokenSlam';
import { MiniRoller } from './components/MiniRoller';
import { TutorialLayer } from './components/TutorialLayer';
import { Toasts } from './components/Toasts';
import { AdOverlay } from './components/AdOverlay';
import { TitleScreen } from './components/TitleScreen';
import { DevPanel } from '../dev/DevPanel';
import { SHOW_DEV } from '../dev/flags';
import { installRollController } from './rollController';
import { installSound } from './soundController';
import { installTokenFx } from './tokenFx';
import { useUi } from './uiStore';

const W = 1080;
const H = 1920;

export function App() {
  const frameRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.4);
  const tab = useUi((u) => u.tab);
  // The upgrade map covers the whole screen; underneath, keep showing the tab it was opened from.
  const prevTab = useUi((u) => u.prevTab);
  const lowerTab = tab === 'upgrades' ? prevTab : tab;

  useLayoutEffect(() => {
    const el = frameRef.current;
    if (!el) return;
    const fit = () => setScale(Math.min(el.clientWidth / W, el.clientHeight / H));
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => installRollController(), []);
  useEffect(() => installSound(), []);
  useEffect(() => installTokenFx(), []);

  return (
    <div className={styles.viewport}>
      <div className={styles.frame} ref={frameRef}>
        <div className={styles.stage} data-stage style={{ transform: `translate(-50%, -50%) scale(${scale})` }}>
          <div className={styles.battle}><BattlePanel /></div>
          <div className={styles.lower}>
            {/* A new tab's panel slides up with a little bounce (keyed so it plays on every switch). */}
            <div key={lowerTab === 'upgrades' ? 'alley' : lowerTab} className={styles.panelIn}>
              {(lowerTab === 'alley' || lowerTab === 'upgrades') && <AlleyPanel />}
              {lowerTab === 'heist' && <HeistPanel />}
              {lowerTab === 'bag' && <InventoryPanel />}
              {lowerTab === 'rebirth' && <RebirthPanel />}
              {lowerTab === 'worlds' && <WorldsPanel />}
            </div>
          </div>
          <div className={styles.nav}><BottomNav /></div>
          {tab === 'upgrades' && <UpgradeMap />}
          <SafeLayer name="mini"><MiniRoller /></SafeLayer>
          <SafeLayer name="tokens"><TokenSlam /></SafeLayer>
          <SafeLayer name="drag"><DragLayer /></SafeLayer>
          <SafeLayer name="reveal"><RevealLayer /></SafeLayer>
          <SafeLayer name="unlocks"><UnlockedFx /></SafeLayer>
          <SafeLayer name="popups"><PopupLayer /></SafeLayer>
          <SafeLayer name="tutorial"><TutorialLayer /></SafeLayer>
          <SafeLayer name="equip"><EquipFlight /></SafeLayer>
          <SafeLayer name="toasts"><Toasts /></SafeLayer>
          <AdOverlay />
          {SHOW_DEV && <DevPanel />}
          <TitleScreen />
        </div>
      </div>
    </div>
  );
}
