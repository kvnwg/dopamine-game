import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import styles from './App.module.css';
import { BattlePanel } from './components/BattlePanel';
import { StatStrip } from './components/StatStrip';
import { AlleyPanel } from './components/AlleyPanel';
import { InventoryPanel } from './components/InventoryPanel';
import { UpgradeMap } from './components/UpgradeMap';
import { RebirthPanel } from './components/RebirthPanel';
import { WorldsPanel } from './components/WorldsPanel';
import { BottomNav } from './components/BottomNav';
import { PopupLayer } from './popups/PopupLayer';
import { RevealLayer } from './components/RevealLayer';
import { DragLayer } from './components/DragLayer';
import { Toasts } from './components/Toasts';
import { AdOverlay } from './components/AdOverlay';
import { DevPanel } from '../dev/DevPanel';
import { installRollController } from './rollController';
import { installSound } from './soundController';
import { useUi } from './uiStore';

const W = 1080;
const H = 1920;
const SHOW_DEV = import.meta.env.DEV || import.meta.env.VITE_CHEATS === 'true';

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

  return (
    <div className={styles.viewport}>
      <div className={styles.frame} ref={frameRef}>
        <div className={styles.stage} data-stage style={{ transform: `translate(-50%, -50%) scale(${scale})` }}>
          <div className={styles.battle}><BattlePanel /></div>
          <div className={styles.strip}><StatStrip /></div>
          <div className={styles.lower}>
            {(lowerTab === 'alley' || lowerTab === 'upgrades') && <AlleyPanel />}
            {lowerTab === 'bag' && <InventoryPanel />}
            {lowerTab === 'rebirth' && <RebirthPanel />}
            {lowerTab === 'worlds' && <WorldsPanel />}
          </div>
          <div className={styles.nav}><BottomNav /></div>
          {tab === 'upgrades' && <UpgradeMap />}
          <DragLayer />
          <RevealLayer />
          <PopupLayer />
          <Toasts />
          <AdOverlay />
          {SHOW_DEV && <DevPanel />}
        </div>
      </div>
    </div>
  );
}
