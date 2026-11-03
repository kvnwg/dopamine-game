/** Dev cheat panel (dev builds, or VITE_CHEATS=true), opened from Settings. Never shipped in release builds. */
import { useState } from 'react';
import { RARITIES, type Rarity } from '../data';
import { computeStats, currentLuck, playerPower, type Cheat } from '../core';
import { clock, dispatch, getGame, useGame } from '../app/store';
import { resetSave, saveNow, skipTime } from '../app/session';
import { useUi } from '../ui/uiStore';
import s from './dev.module.css';

const cheat = (c: Cheat) => dispatch({ type: 'cheat', cheat: c });

export function DevPanel() {
  const open = useUi((u) => u.devOpen);
  const setOpen = (devOpen: boolean) => useUi.setState({ devOpen });
  const [stage, setStage] = useState('3');
  const [dl, setDl] = useState('5');
  const [armReset, setArmReset] = useState(false);
  const forced = useGame((g) => g.dumpster.forcedRarity);
  const g = useGame((x) => x);
  if (!open) return null;
  const st = computeStats(g);
  return (
    <>
      <button className={s.fab} onClick={() => setOpen(false)}>
        ✕ DEV
      </button>
      <div className={s.panel}>
        <div className={s.group}>
          <div className={s.label}>Currencies</div>
          <div className={s.row}>
            <button className={s.b} onClick={() => cheat({ kind: 'addCurrency', coins: 10_000 })}>+10K coins</button>
            <button className={s.b} onClick={() => cheat({ kind: 'addCurrency', coins: 1_000_000 })}>+1M coins</button>
            <button className={s.b} onClick={() => cheat({ kind: 'addCurrency', gems: 500 })}>+500 gems</button>
            <button className={s.b} onClick={() => cheat({ kind: 'addCurrency', bags: 50 })}>+50 bags</button>
            <button className={s.b} onClick={() => cheat({ kind: 'addXp', amount: 5_000 })}>+5K XP</button>
          </div>
        </div>
        <div className={s.group}>
          <div className={s.label}>World / Dumpster</div>
          <div className={s.row}>
            <input className={s.input} value={stage} onChange={(e) => setStage(e.target.value)} inputMode="numeric" />
            <button className={s.b} onClick={() => cheat({ kind: 'setStage', stage: Number(stage) || 1 })}>Set world</button>
            <button className={s.b} onClick={() => cheat({ kind: 'skipToLastWave' })}>Last wave</button>
            <input className={s.input} value={dl} onChange={(e) => setDl(e.target.value)} inputMode="numeric" />
            <button className={s.b} onClick={() => cheat({ kind: 'setDumpsterLevel', level: Number(dl) || 1 })}>Set dumpster Lv</button>
          </div>
        </div>
        <div className={s.group}>
          <div className={s.label}>Force next rarity {forced ? `(${forced})` : ''}</div>
          <div className={s.row}>
            {RARITIES.map((r) => (
              <button key={r} className={s.b} onClick={() => cheat({ kind: 'forceRarity', rarity: r as Rarity })}>{r}</button>
            ))}
            <button className={s.b} onClick={() => cheat({ kind: 'forceRarity', rarity: null })}>clear</button>
          </div>
        </div>
        <div className={s.group}>
          <div className={s.label}>Time</div>
          <div className={s.row}>
            <button className={s.b} onClick={() => skipTime(0.5)}>Skip 30m</button>
            <button className={s.b} onClick={() => skipTime(1)}>Skip 1h</button>
            <button className={s.b} onClick={() => skipTime(8)}>Skip 8h</button>
            <button className={s.b} onClick={() => skipTime(24)}>Skip 24h</button>
          </div>
        </div>
        <div className={s.group}>
          <div className={s.label}>Systems / Save</div>
          <div className={s.row}>
            <button className={s.b} onClick={() => cheat({ kind: 'luckBoost', seconds: 60 })}>Luck potion 60s</button>
            <button className={s.b} onClick={() => void saveNow()}>Save now</button>
            <button
              className={s.b}
              onClick={() => {
                if (!armReset) {
                  setArmReset(true);
                  setTimeout(() => setArmReset(false), 3000);
                  return;
                }
                setArmReset(false);
                void resetSave();
              }}
            >
              {armReset ? 'Tap again to wipe ALL progress' : 'Reset save'}
            </button>
          </div>
        </div>
        <div className={s.info}>
          HP {Math.round(g.battle.playerHp)}/{Math.round(st.HP)} · ATK {st.ATK.toFixed(1)} · DEF {st.DEF.toFixed(1)} · SPD{' '}
          {st.ATK_SPD.toFixed(2)} · CRIT {st.CRIT.toFixed(1)}% · CDMG {st.CRIT_DMG.toFixed(0)}% · DODGE {st.DODGE.toFixed(1)}% · LS{' '}
          {st.LIFESTEAL.toFixed(1)}% · REGEN {st.REGEN.toFixed(1)} · BAG {st.BAG_FIND.toFixed(1)}%
          <br />
          power {playerPower(getGame())} · rolls {g.roll.count} · luck ×{currentLuck(g, clock.now()).toFixed(2)} · rebirths {g.rebirths} · dry streak {g.dumpster.dryStreak} · play{' '}
          {(g.playTimeMs / 60000).toFixed(1)}m · mode {g.stage.mode} · best {g.stage.highestCleared}
        </div>
      </div>
    </>
  );
}
