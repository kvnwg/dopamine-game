/**
 * The admin portal (Kevin: "give me an admin portal where I can give myself money and gems and
 * stuff"): gold, gems, loaves, Trash Bags, heist tickets, levels, rebirths, worlds, the dumpster's
 * level, luck potions, the next roll's rarity or luck tokens, everything unlocked, and previews of
 * the big moments. Settings shows it to the artifact's owner (and anyone who taps the version line
 * five times); everything goes through the core's cheat actions, so the save stays valid.
 */
import { useState, type ReactNode } from 'react';
import { RARITIES, type Rarity } from '../../data';
import { currentLuck, formatNumber, itemOddsOneIn, luckOddsOneIn, reelCount, type Cheat, type Item } from '../../core';
import { clock, dispatch, getGame, useGame } from '../../app/store';
import { saveNow } from '../../app/session';
import { haptics } from '../../services';
import { audio } from '../../services/audio';
import { t } from '../i18n';
import { useUi, type RollView } from '../uiStore';
import { Modal } from './Modal';
import s from './popups.module.css';

const cheat = (c: Cheat) => {
  dispatch({ type: 'cheat', cheat: c });
  audio.tap();
  haptics.impact('light');
};

/** "2.5M", "1e12", "300 000", "1.5T" → a number (NaN if it isn't one). */
export function parseAmount(text: string): number {
  const m = /^\s*([0-9]*\.?[0-9]+(?:e[+-]?\d+)?)\s*([kmbtq]?)\s*$/i.exec(text.replace(/[,_\s](?=\d)/g, ''));
  if (!m) return Number.NaN;
  const mult: Record<string, number> = { '': 1, k: 1e3, m: 1e6, b: 1e9, t: 1e12, q: 1e15 };
  return Number(m[1]) * mult[m[2].toLowerCase()];
}

/** The best thing the raccoon owns (worn or in the bag), for the previews. */
function bestItem(): Item | null {
  const g = getGame();
  const all = [...g.inventory, ...Object.values(g.equipped).filter((x): x is Item => !!x)];
  return all.sort((a, b) => itemOddsOneIn(b) - itemOddsOneIn(a))[0] ?? null;
}

/** Plays a big reveal of `item` (nothing changes in the game). */
function preview(drama: RollView['drama']) {
  const item = bestItem();
  if (!item) return;
  const g = getGame();
  useUi.getState().openPopup(null);
  useUi.setState({
    celebrate: {
      id: -Date.now(), item, odds: itemOddsOneIn(item), lucky: false, golden: false, placed: 'bag', newRecord: false, at: performance.now(),
      luckOdds: luckOddsOneIn(item, currentLuck(g, clock.now())), drama, mult: 1,
    },
  });
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className={s.adminRow}>
      <span className={s.adminLabel}>{label}</span>
      <div className={s.adminBtns}>{children}</div>
    </div>
  );
}

function B({ onClick, children, tone = 'blue' }: { onClick: () => void; children: ReactNode; tone?: 'blue' | 'gold' | 'red' | 'gray' | 'green' }) {
  return (
    <button className={`btn small ${tone}`} onClick={onClick}>
      {children}
    </button>
  );
}

export function AdminPopup({ onClose }: { onClose: () => void }) {
  const coins = useGame((g) => g.currencies.coins);
  const gems = useGame((g) => g.currencies.gems);
  const bread = useGame((g) => g.perks.bread);
  const level = useGame((g) => g.player.level);
  const rebirths = useGame((g) => g.rebirths);
  const forced = useGame((g) => g.dumpster.forcedRarity);
  const reels = useGame(reelCount);
  const [amount, setAmount] = useState('1M');
  const [world, setWorld] = useState('5');
  const [dumpster, setDumpster] = useState('10');
  const [floor, setFloor] = useState('10');
  const stars = useGame((g) => g.legend.stars);
  const n = parseAmount(amount);
  const ok = Number.isFinite(n) && n > 0;

  return (
    <Modal title="Admin portal" tone="red" onClose={onClose} wide>
      <p className={s.note} style={{ marginTop: 0 }}>
        Gold {formatNumber(coins)} · Gems {formatNumber(gems)} · Loaves {bread} · Lv {level} · Rebirths {rebirths} · Stars {stars}
      </p>
      <Row label="Gold">
        <B tone="gold" onClick={() => cheat({ kind: 'addCurrency', coins: 1e6 })}>+1M</B>
        <B tone="gold" onClick={() => cheat({ kind: 'addCurrency', coins: 1e9 })}>+1B</B>
        <B tone="gold" onClick={() => cheat({ kind: 'addCurrency', coins: 1e12 })}>+1T</B>
        <B tone="gold" onClick={() => cheat({ kind: 'addCurrency', coins: Math.max(1000, getGame().currencies.coins) * 9 })}>×10</B>
        <B tone="gold" onClick={() => cheat({ kind: 'addCurrency', coins: Math.max(1000, getGame().currencies.coins) * 999 })}>×1000</B>
      </Row>
      <Row label="Gems">
        <B onClick={() => cheat({ kind: 'addCurrency', gems: 100 })}>+100</B>
        <B onClick={() => cheat({ kind: 'addCurrency', gems: 1000 })}>+1K</B>
        <B onClick={() => cheat({ kind: 'addCurrency', gems: 10_000 })}>+10K</B>
      </Row>
      <Row label="Any amount">
        <input className={s.adminInput} value={amount} onChange={(e) => setAmount(e.target.value)} aria-label="Amount" />
        <B tone="gold" onClick={() => ok && cheat({ kind: 'addCurrency', coins: n })}>Gold</B>
        <B onClick={() => ok && cheat({ kind: 'addCurrency', gems: Math.round(n) })}>Gems</B>
        <B tone="gray" onClick={() => ok && cheat({ kind: 'addCurrency', bread: Math.round(n) })}>Loaves</B>
      </Row>
      <Row label="Loaves · Trash Bags · Tickets">
        <B tone="gray" onClick={() => cheat({ kind: 'addCurrency', bread: 10 })}>+10 loaves</B>
        <B tone="gray" onClick={() => cheat({ kind: 'addCurrency', bags: 100 })}>+100 bags</B>
        <B tone="gray" onClick={() => cheat({ kind: 'heistTickets', tickets: 99 })}>99 tickets</B>
      </Row>
      <Row label="Level · Rebirths">
        <B tone="green" onClick={() => cheat({ kind: 'addLevels', levels: 1 })}>+1 Lv</B>
        <B tone="green" onClick={() => cheat({ kind: 'addLevels', levels: 10 })}>+10 Lv</B>
        <B tone="green" onClick={() => cheat({ kind: 'addRebirths', n: 1 })}>+1 rebirth</B>
      </Row>
      <Row label="World · Dumpster">
        <input className={s.adminInput} value={world} onChange={(e) => setWorld(e.target.value)} inputMode="numeric" aria-label="World" />
        <B onClick={() => cheat({ kind: 'setStage', stage: Number(world) || 1 })}>Go to world</B>
        <input className={s.adminInput} value={dumpster} onChange={(e) => setDumpster(e.target.value)} inputMode="numeric" aria-label="Dumpster level" />
        <B onClick={() => cheat({ kind: 'setDumpsterLevel', level: Number(dumpster) || 1 })}>Dumpster Lv</B>
      </Row>
      <Row label="Endless Dump · Legend">
        <input className={s.adminInput} value={floor} onChange={(e) => setFloor(e.target.value)} inputMode="numeric" aria-label="Floor" />
        <B onClick={() => cheat({ kind: 'setFloor', floor: Number(floor) || 1 })}>Go to floor</B>
        <B tone="gold" onClick={() => cheat({ kind: 'addStars', n: 10 })}>+10 stars</B>
        <B tone="gold" onClick={() => cheat({ kind: 'addStars', n: 100 })}>+100 stars</B>
        <B tone="green" onClick={() => cheat({ kind: 'addRebirths', n: 5 })}>+5 rebirths</B>
      </Row>
      <Row label="Luck">
        <B tone="green" onClick={() => cheat({ kind: 'luckBoost', seconds: 60 })}>Potion 1 min</B>
        <B tone="green" onClick={() => cheat({ kind: 'luckBoost', seconds: 600 })}>Potion 10 min</B>
        <B tone="green" onClick={() => cheat({ kind: 'forceTokens', mults: [5, 10] })}>Next: ×50 chain</B>
        {reels >= 2 && (
          <B tone="green" onClick={() => cheat({ kind: 'forceTokens', mults: null, perReel: [[2], [5]] })}>
            Next: combo ×2 × ×5
          </B>
        )}
        {reels >= 3 && (
          <B tone="green" onClick={() => cheat({ kind: 'forceTokens', mults: null, perReel: [[2], [3], [5]] })}>
            Next: combo ×2 × ×3 × ×5
          </B>
        )}
        <B tone="green" onClick={() => cheat({ kind: 'forceTokens', mults: [5, 10, 5], everyReel: true })}>
          Next: ×{formatNumber(250 ** reels)} every reel
        </B>
      </Row>
      <Row label={`Next roll's rarity${forced ? ` (${t(`rarity.${forced}`)})` : ''}`}>
        {RARITIES.filter((r) => r !== 'junk').map((r) => (
          <B key={r} tone="gray" onClick={() => cheat({ kind: 'forceRarity', rarity: r as Rarity })}>
            {t(`rarity.${r}`)}
          </B>
        ))}
        <B tone="red" onClick={() => cheat({ kind: 'forceRarity', rarity: null })}>Clear</B>
      </Row>
      <Row label="Previews (nothing changes)">
        <B tone="gold" onClick={() => preview('hyper')}>HYPER RARE</B>
        <B onClick={() => preview('insane')}>Insane reveal</B>
        <B
          onClick={() => {
            useUi.getState().openPopup(null);
            useUi.setState({ haul: { id: Date.now(), coins: Math.max(1e6, getGame().currencies.coins), usual: null, count: 42, size: 'mega' } });
          }}
        >
          Mega haul
        </B>
      </Row>
      <Row label="Game">
        <B tone="green" onClick={() => cheat({ kind: 'unlockAll' })}>Unlock everything</B>
        <B tone="gray" onClick={() => void saveNow(true)}>Save now</B>
      </Row>
    </Modal>
  );
}
