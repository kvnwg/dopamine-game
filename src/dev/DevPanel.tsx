/** Dev cheat panel (dev builds, or VITE_CHEATS=true). Never shipped in release builds. */
import { useState } from 'react';
import { RARITIES, type Rarity } from '../data';
import { computeStats, playerPower, type Cheat } from '../core';
import { dispatch, getGame, useGame } from '../app/store';
import { resetSave, saveNow, skipTime } from '../app/session';
import s from './dev.module.css';

const cheat = (c: Cheat) => dispatch({ type: 'cheat', cheat: c });

export function DevPanel() {
  const [open, setOpen] = useState(false);
  const [stage, setStage] = useState('10');
  const [dl, setDl] = useState('5');
  const forced = useGame((g) => g.dumpster.forcedRarity);
  const g = useGame((x) => x);
  if (!open) {
    return (
      <button className={s.fab} onClick={() => setOpen(true)}>
        DEV
      </button>
    );
  }
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
          <div className={s.label}>Stage / Dumpster</div>
          <div className={s.row}>
            <input className={s.input} value={stage} onChange={(e) => setStage(e.target.value)} inputMode="numeric" />
            <button className={s.b} onClick={() => cheat({ kind: 'setStage', stage: Number(stage) || 1 })}>Set stage</button>
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
            <button className={s.b} onClick={() => cheat({ kind: 'unlockAll' })}>Unlock all</button>
            <button className={s.b} onClick={() => void saveNow()}>Save now</button>
            <button
              className={s.b}
              onClick={() => {
                if (confirm('Reset save? This wipes all progress.')) void resetSave();
              }}
            >
              Reset save
            </button>
          </div>
        </div>
        <div className={s.info}>
          HP {Math.round(g.battle.playerHp)}/{Math.round(st.HP)} · ATK {st.ATK.toFixed(1)} · DEF {st.DEF.toFixed(1)} · SPD{' '}
          {st.ATK_SPD.toFixed(2)} · CRIT {st.CRIT.toFixed(1)}% · CDMG {st.CRIT_DMG.toFixed(0)}% · DODGE {st.DODGE.toFixed(1)}% · LS{' '}
          {st.LIFESTEAL.toFixed(1)}% · REGEN {st.REGEN.toFixed(1)} · BAG {st.BAG_FIND.toFixed(1)}%
          <br />
          power {playerPower(getGame())} · dives {g.dumpster.totalDives} · dry streak {g.dumpster.dryStreak} · play{' '}
          {(g.playTimeMs / 60000).toFixed(1)}m · mode {g.stage.mode} · best {g.stage.highestCleared}
        </div>
      </div>
    </>
  );
}
