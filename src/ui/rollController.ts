/**
 * Turns core events into UI moments: every reel's result pops in; Epic and up get a burst. A roll
 * the core judged the raccoon's rarest in a while (luck.ts judgeFinds, feel.bigRoll) gets a build-up
 * while the reels roll (glow, rattle, riser, silence drop) and the full-screen reveal when it lands
 * (black screen, the item shining, its "1 in X" counting up). A smaller build-up (a couple of rattles
 * and a short riser) plays under the reels' glow when the spin's tease says so (reelDrama.ts). With
 * several reels, sounds play once per spin for the best result. Also toasts for level-ups, luck
 * boosts, upgrades and rebirths (with the items each rebirth unlocks), the Half-Eaten Bread Loaves a
 * world pays, and Rigged Jackpot's rigged spins.
 */
import { BAL, DATA } from '../data';
import { currentLuck, formatNumber, luckOddsOneIn, rarityIndex, type CoreEvent, type Item, type RollDrama } from '../core';
import { getGame } from '../app/store';
import { saveNow } from '../app/session';
import { bus } from '../app/eventBus';
import { haptics } from '../services';
import { audio, type Material } from '../services/audio';
import { t } from './i18n';
import { teasePlan, type Tease } from './reelDrama';
import { chainMult, itemStopMs } from './reelTiming';
import { useUi, type RollView } from './uiStore';

let rollId = 1;
/** Big rolls that land while another reveal is showing wait their turn (at most a few). */
const queue: RollView[] = [];

function revealBusy(): boolean {
  return useUi.getState().celebrate !== null;
}

function next(): void {
  const v = queue.shift();
  if (v) celebrate(v);
}

/**
 * How rare an item is at the raccoon's luck right now ("1 in X" for its tier or better), with the
 * reveal the core gave it (luck.ts judgeFinds: the rarest find in a while; the tutorial's scripted
 * rolls always get one).
 */
function rareness(item: Item, drama: RollDrama | null | undefined): Pick<RollView, 'luckOdds' | 'drama'> {
  return { luckOdds: luckOddsOneIn(item, currentLuck(getGame(), Date.now())), drama: drama ?? null };
}

const DRAMA_RANK: Record<RollDrama, number> = { big: 1, huge: 2, insane: 3, hyper: 4 };

/**
 * While the reels roll toward a big roll: rising rattle, a riser, then a silence drop just before its
 * reel stops on it (`ms` after the spin starts, after any luck tokens on that reel).
 */
function buildUp(view: RollView, ms: number) {
  const tier = rarityIndex(view.item.rarity);
  useUi.setState({ charging: view });
  const beats = BAL.feel.rattleBeatsByRarity[view.item.rarity];
  for (let b = 0; b < beats; b++) {
    const t = ms * 0.35 + (b * ms * 0.45) / beats;
    setTimeout(() => {
      // (A recorded shake plays once, from the first beat, peaking as the sound drops out.)
      audio.rattle(b, beats, true, (ms - 160 - t) / 1000);
      haptics.impact('light');
    }, t);
  }
  setTimeout(() => audio.riser(Math.max(0.3, (ms * 0.5) / 1000), tier, true), ms * 0.4);
  setTimeout(() => audio.silenceDrop(0.15), Math.max(0, ms - 160));
  // Nothing of the build-up rings on past the find landing (on any tab).
  setTimeout(() => audio.endRamp(), ms);
}

/**
 * The smaller build-up for a rare result that doesn't get the full reveal (reelDrama.ts levels 1 and
 * 2): rattles and a short riser while the reel crawls in and the glow climbs; a very rare one drops
 * the sound out for a beat before it lands.
 */
function buildUpSmall(plan: Tease) {
  const dur = plan.land - plan.from;
  const beats = plan.level >= 2 ? 3 : 2;
  for (let b = 0; b < beats; b++) {
    const t = plan.from + dur * (0.2 + (0.6 * b) / beats);
    setTimeout(() => {
      audio.rattle(b, beats + 2, false, (plan.land - t) / 1000);
      haptics.impact('light');
    }, t);
  }
  const top = plan.tiers[plan.tiers.length - 1];
  setTimeout(() => audio.riser(Math.max(0.3, (dur * 0.85) / 1000), Math.max(0, top - 3)), plan.from + dur * 0.1);
  if (plan.level >= 2) setTimeout(() => audio.silenceDrop(0.08), Math.max(0, plan.land - 100));
  setTimeout(() => audio.endRamp(), plan.land);
}

/**
 * A big roll stays on the "last roll" card while its reveal shows and for this long after it closes
 * (the reels keep rolling meanwhile), so the player comes back to it and can drag it on.
 */
const HOLD_AFTER_REVEAL_MS = 3500;
let revealClosedAt = -Infinity;

/**
 * The full-screen reveal for a big roll, as its reel lands (RareReveal plays it and its sounds). It
 * stays until the player taps it away (Kevin: "let the player decide when to tap and end it").
 */
function celebrate(view: RollView) {
  useUi.setState({ charging: null, celebrate: view });
  haptics.impact('heavy');
}

/** RareReveal calls this when the counter lands: the item's own material and rarity sting. */
export function revealLanded(view: RollView): void {
  audio.material(material(view.item.baseId));
  audio.reveal(view.item.rarity);
  [0, 140, 280, 420].forEach((ms) => setTimeout(() => haptics.impact(ms ? 'light' : 'heavy'), ms));
}

/** The player taps the landed reveal away: the next big roll waiting, if any, takes its turn. */
export function skipReveal(): void {
  useUi.setState({ celebrate: null });
  revealClosedAt = performance.now();
  next();
}

/** The card is holding a big roll (its reveal is up, queued or just closed) that a lesser roll mustn't replace. */
function holdingBigRoll(view: RollView): boolean {
  const cur = useUi.getState().lastRoll;
  if (!cur?.drama || view.drama) return false;
  return revealBusy() || queue.length > 0 || performance.now() - revealClosedAt < HOLD_AFTER_REVEAL_MS;
}

function material(baseId: string): Material {
  return (DATA.itemsById.get(baseId)?.material ?? 'plastic') as Material;
}

/** The best result of the spin landing right now, for the "last roll" card. */
let spinBest: RollView | null = null;
/** The best non-Legendary result in this batch of events: its sound plays once. */
let popped: { tier: number; item: RollView['item'] } | null = null;

function popSound(p: { tier: number; item: RollView['item'] }): void {
  audio.autoPop(p.item.rarity);
  if (p.tier >= rarityIndex('epic')) {
    audio.material(material(p.item.baseId), true);
    audio.reveal(p.item.rarity);
    haptics.impact(p.tier >= rarityIndex('legendary') ? 'heavy' : 'medium');
  } else if (p.tier >= rarityIndex('shiny')) {
    haptics.impact('light');
  }
}

export function installRollController(): () => void {
  return bus.on((events: CoreEvent[]) => {
    const ui = useUi.getState();
    popped = null;
    // Loaves a boss paid in this batch (the "again or next?" card lists them).
    let loavesNow: { world: number; loaves: number } | null = null;
    for (const e of events) {
      switch (e.type) {
        case 'spinStart': {
          // The find with the biggest reveal (the rarest card among equals), else the rarest card.
          const rank = (r: (typeof e.reels)[number]) => (r.drama ? DRAMA_RANK[r.drama] : 0);
          const best = e.reels.reduce((a, b) => (rank(b) > rank(a) || (rank(b) === rank(a) && b.odds > a.odds) ? b : a));
          // A scripted spin's first reel is the one the tutorial set up.
          const scripted = e.scripted && best === e.reels[0] ? e.scripted : undefined;
          const rare = rareness(best.item, best.drama);
          if (rare.drama) {
            const view: RollView = {
              id: -best.item.uid, item: best.item, odds: best.odds, lucky: e.lucky, golden: e.golden, placed: 'bag', newRecord: false,
              at: performance.now(), mult: chainMult(e, e.reels.indexOf(best), e.matched), scripted, ...rare,
            };
            buildUp(view, itemStopMs(e, e.reels.indexOf(best)));
          } else {
            const plan = teasePlan(e, currentLuck(getGame(), Date.now()));
            if (plan && plan.level >= 1) buildUpSmall(plan);
          }
          if (e.golden) audio.jingle(5);
          // Rigged Jackpot (an Alley perk): this spin's every reel lands its rarity or better.
          if (e.rigged) {
            ui.toast(t('toast.rigged', { rarity: t(`rarity.${e.rigged}`).toUpperCase() }), 'good');
            audio.jingle(5);
          }
          spinBest = null;
          break;
        }
        case 'roll': {
          const view: RollView = {
            id: rollId++, item: e.item, odds: e.odds, lucky: e.lucky, golden: e.golden, placed: e.placed, newRecord: e.newRecord,
            at: performance.now(), mult: e.mult, scripted: e.scripted, ...rareness(e.item, e.drama),
          };
          // The big "last roll" card shows the best result of the spin; every result goes in Recent.
          if (e.reel === 0 || !spinBest || e.odds > spinBest.odds) spinBest = view;
          const shown = spinBest;
          if (!holdingBigRoll(shown)) useUi.setState({ lastRoll: shown });
          const tier = rarityIndex(e.item.rarity);
          // A rare find is saved right away (autosave is every 30 s): a phone that crashes or a
          // tab that closes during the big reveal must never lose it.
          if (view.drama || tier >= rarityIndex('legendary')) saveSoon();
          if (view.drama) {
            if (!revealBusy()) celebrate(view);
            else if (queue.length < 3) queue.push(view);
            if (useUi.getState().charging?.item.uid === e.item.uid) useUi.setState({ charging: null });
          } else if (!popped || tier > popped.tier) {
            popped = { tier, item: e.item };
          }
          if (e.lucky && e.reel === 0) audio.jingle(3);
          break;
        }
        case 'codexEntry':
          useUi.setState((u) => ({ newCodexKeys: [...u.newCodexKeys.slice(-50), e.key] }));
          break;
        case 'equip':
          // (The item's flight and the power count say it all: no toast.)
          useUi.setState({ equipPulse: { slot: e.item.slot, id: e.item.uid } });
          break;
        case 'levelUp':
          // (The battle's LEVEL UP and the level badge say it: no toast.)
          if (e === lastOf(events, 'levelUp')) haptics.impact('medium');
          break;
        case 'codexBonus':
          // Before the Codex has been introduced its gems just arrive.
          if (getGame().features.seen.includes('codex')) ui.toast(t('toast.codexBonus', { gems: e.gems }), 'good');
          break;
        case 'dumpsterUpgraded':
          ui.toast(t('toast.dumpsterUpgraded', { level: e.level }), 'good');
          haptics.impact('medium');
          break;
        case 'luckBoost':
          ui.toast(t('toast.luckBoost', { mult: BAL.luck.potion.mult, seconds: e.seconds }), 'good');
          audio.jingle(5);
          haptics.impact('medium');
          break;
        case 'upgradeBought':
          haptics.impact('light');
          break;
        // Boosts (the Boosts panel): what each gave. (A crate's Luck Potion says itself: luckBoost.)
        case 'quickDive':
          ui.toast(t(e.kept > 0 ? 'toast.quickDive' : 'toast.quickDiveNone', { n: formatNumber(e.rolls), kept: e.kept }), 'good');
          if (e.kept > 0) audio.jingle(3);
          break;
        case 'boostUsed': {
          const B = BAL.boosts;
          const g = getGame();
          if (e.id === 'potionBrew') ui.toast(t('toast.potionBrew', { mult: B.potionBrew.mult, minutes: B.potionBrew.minutes }), 'good');
          if (e.id === 'ductTapeReel') ui.toast(t('toast.ductTapeReel', { minutes: B.ductTapeReel.minutes }), 'good');
          if (e.id === 'encore') ui.toast(t('toast.encore'), 'good');
          if (e.id === 'bossRage') ui.toast(t('toast.bossRage', { pct: Math.round((B.bossRage.atkMult - 1) * 100), n: g.boosts.rageWorld ?? g.battle.stage }), 'good');
          if (e.id === 'rebirthBlessing') ui.toast(t('toast.blessingReady'), 'good');
          if (e.id !== 'quickDive' && e.id !== 'bonusCrate' && e.id !== 'goldTopUp' && e.id !== 'polish') audio.jingle(3);
          break;
        }
        case 'blessingStarted':
          ui.toast(t('toast.blessingStarted', { mult: BAL.boosts.rebirthBlessing.speedMult, minutes: BAL.boosts.rebirthBlessing.minutes }), 'good');
          break;
        case 'itemPolished':
          ui.toast(t('toast.polished'), 'good');
          audio.jingle(3);
          break;
        case 'goldTopUp':
          ui.toast(t('toast.goldTopUp', { gold: formatNumber(e.gold) }), 'good');
          break;
        case 'crateOpened':
          if (e.kind === 'bags') ui.toast(t('toast.crateBags', { n: formatNumber(e.amount) }), 'good');
          if (e.kind === 'coins') ui.toast(t('toast.crateCoins', { n: formatNumber(e.amount) }), 'good');
          break;
        case 'boostEnded':
          ui.toast(t(e.id === 'potionBrew' ? 'toast.brewEnded' : e.id === 'ductTapeReel' ? 'toast.reelEnded' : 'toast.blessingEnded'), 'info');
          break;
        case 'rebirth':
          // The unlock card (UnlockedFx) follows the burst.
          useUi.setState({ rebirthFx: e.count, tab: 'alley', unlocked: e.unlocked.length ? { count: e.count, ids: e.unlocked } : null });
          setTimeout(() => {
            if (useUi.getState().rebirthFx === e.count) useUi.setState({ rebirthFx: null });
          }, 3200);
          audio.bossWin();
          haptics.impact('heavy');
          break;
        case 'bossWin':
          haptics.impact('heavy');
          break;
        case 'worldFirstClear':
          useUi.setState({ afterBoss: { world: e.world, firstTime: true, gems: e.gems } });
          haptics.impact('heavy');
          break;
        case 'bossChoice':
          if (!e.firstTime) {
            const loaves = loavesNow?.world === e.world ? loavesNow.loaves : 0;
            useUi.setState({ afterBoss: { world: e.world, firstTime: false, gems: 0, loaves } });
          }
          break;
        case 'breadEarned':
          // A world fell for the first time this run: Half-Eaten Bread Loaves for the Perks page.
          ui.toast(t(e.loaves === 1 ? 'toast.breadOne' : 'toast.breadMany', { n: e.loaves }), 'good');
          loavesNow = { world: e.world, loaves: e.loaves };
          useUi.setState((u) => (u.afterBoss?.world === e.world && u.afterBoss.firstTime ? { afterBoss: { ...u.afterBoss, loaves: e.loaves } } : {}));
          break;
        case 'clockWentBackward':
          ui.toast(t('toast.clockBackward'), 'warn');
          break;
        case 'scrap':
          if (!e.auto) ui.toast(t('toast.scrapped', { gold: formatNumber(e.coins) }), 'info');
          break;
        case 'scrapAll': {
          // A haul well above the run's usual ones (haul.ts judgeHaul) gets its own moment; an everyday one a toast.
          const size = e.size;
          if (size) {
            useUi.setState({ haul: { id: Date.now(), coins: e.coins, usual: e.usual, count: e.count, size } });
            audio.haul(size === 'big' ? 0 : size === 'huge' ? 1 : 2);
            haptics.impact('heavy');
          } else {
            ui.toast(t('toast.scrappedAll', { n: e.count, gold: formatNumber(e.coins) }), 'good');
          }
          break;
        }
      }
    }
    if (popped) popSound(popped);
  });
}

/** The last event of a type in a batch. */
function lastOf(events: readonly CoreEvent[], type: CoreEvent['type']): CoreEvent | undefined {
  for (let i = events.length - 1; i >= 0; i--) if (events[i].type === type) return events[i];
  return undefined;
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;

/** Saves once, right after this batch of events has been applied to the game state. */
function saveSoon(): void {
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    void saveNow();
  }, 0);
}
