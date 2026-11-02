import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import styles from './App.module.css';
import { TopBar } from './components/TopBar';
import { BattlePanel } from './components/BattlePanel';
import { DumpsterPanel } from './components/DumpsterPanel';
import { GearGrid } from './components/GearGrid';
import { BottomNav } from './components/BottomNav';
import { PopupLayer } from './popups/PopupLayer';
import { RevealLayer } from './components/RevealLayer';
import { Toasts } from './components/Toasts';
import { AdOverlay } from './components/AdOverlay';
import { DevPanel } from '../dev/DevPanel';
import { installFlipController } from './flipController';
import { installSound } from './soundController';

const W = 1080;
const H = 1920;
const SHOW_DEV = import.meta.env.DEV || import.meta.env.VITE_CHEATS === 'true';

export function App() {
  const frameRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.4);

  useLayoutEffect(() => {
    const el = frameRef.current;
    if (!el) return;
    const fit = () => setScale(Math.min(el.clientWidth / W, el.clientHeight / H));
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => installFlipController(), []);
  useEffect(() => installSound(), []);

  return (
    <div className={styles.viewport}>
      <div className={styles.frame} ref={frameRef}>
        <div className={styles.stage} style={{ transform: `translate(-50%, -50%) scale(${scale})` }}>
          <div className={styles.top}><TopBar /></div>
          <div className={styles.battle}><BattlePanel /></div>
          <div className={styles.dumpster}><DumpsterPanel /></div>
          <div className={styles.gear}><GearGrid /></div>
          <div className={styles.nav}><BottomNav /></div>
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
