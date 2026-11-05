/**
 * Shared pieces of the Heist tab: the run as the UI reads it from core (GameState.heist), lookups for
 * locations, perks, curses, choice events and shop stock (src/data/heist.json, heistEvents.json and
 * balance.json's `heist`), and the small pictures every part of the tab uses (node icons, perk chips).
 * Everything is pixel art at 6 stage px per art pixel (PixelArt).
 */
import type { CSSProperties } from 'react';
import { heistBossName, heistLevelXp, heistsOpen, locationUnlocked, type GameAction, type GameState, type HeistLogLine, type HeistRun, type HeistState } from '../../core';
import { dispatch } from '../../app/store';
import { uiIcon, type IconTier } from '../../render/icons';
import type { UiIcon } from '../../render/pixel/ui';
import { BAL, DATA, LOCATION_IDS, type HeistNodeKind, type LocationId, type PerkRarity, type PerkTag } from '../../data';
import { t } from '../i18n';
import { PixelArt } from './PixelArt';
import s from './heist.module.css';

export type { HeistLogLine, HeistPending, HeistRewards, HeistRun, HeistState } from '../../core';
export type { HeistNodeKind, PerkRarity, PerkTag } from '../../data';
export type HeistLocationId = LocationId;
export const LOCATIONS: readonly LocationId[] = LOCATION_IDS;

type HeistAction = Extract<GameAction, { type: `heist${string}` }>;

/** Sends a heist action to core. */
export function heistDispatch(action: HeistAction) {
  return dispatch(action);
}

export function heistOf(g: GameState): HeistState {
  return g.heist;
}

/** The run in progress, if any. */
export function runOf(g: GameState): HeistRun | null {
  return g.heist.run;
}

/** The nav badge: a ticket to spend, or a run waiting on the player. */
export function heistNeedsYou(g: GameState): boolean {
  const h = g.heist;
  if (h.run) return h.run.status !== 'fighting';
  return heistsOpen(g) && h.tickets > 0 && LOCATIONS.some((id) => locationOpen(g, id));
}

// ------------------------------------------------------------------ balance

const H = BAL.heist;
export const TICKETS_MAX = H.tickets.max;
export const TICKETS_PER_DAY = H.tickets.perDay;
export const REVIVE_GEMS = H.revive.gems;
export const SHRINE_HP_PCT = H.shrine.maxHpPct;
export const LOSS_KEEP_PCT = H.lossKeepPct;
export const NODES_PER_ACT = H.nodesPerAct;
export const ACTS = H.actMult.length;
/** Every act's stops, then the boss (19). */
export const TOTAL_NODES = ACTS * NODES_PER_ACT + 1;

// ------------------------------------------------------------------ lookups

export interface LocationInfo {
  id: LocationId;
  name: string;
  blurb: string;
  /** The boss's name. */
  boss: string;
  /** The world whose look it borrows (its preview picture). */
  world: number;
  /** The world to beat first (0: open from the start). */
  unlockWorld: number;
  /** Trash Bags for a win. */
  bags: number;
}

export function locationInfo(id: LocationId): LocationInfo {
  const loc = DATA.heistLocationsById.get(id) ?? DATA.heistLocations[0];
  return {
    id: loc.id,
    name: loc.name,
    blurb: loc.blurb,
    boss: heistBossName(loc.id),
    world: loc.world,
    unlockWorld: loc.unlockWorld,
    bags: H.locations[loc.id]?.bags ?? 0,
  };
}

/** Open once heists are (the first rebirth) and its world is beaten (in any rebirth). */
export function locationOpen(g: GameState, id: LocationId): boolean {
  return heistsOpen(g) && locationUnlocked(g, id);
}

export interface PerkInfo {
  id: string;
  name: string;
  tag: PerkTag;
  rarity: PerkRarity;
  text: string;
  evolution: boolean;
}

const titleCase = (id: string) => id.replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

export function perkInfo(id: string): PerkInfo {
  const p = DATA.heistPerksById.get(id);
  if (!p) return { id, name: titleCase(id), tag: 'chaos', rarity: 'common', text: '', evolution: false };
  return { id, name: p.name, tag: p.tag, rarity: p.rarity, text: p.text, evolution: p.rarity === 'evolution' };
}

export function curseInfo(id: string): { name: string; text: string } {
  const c = DATA.heistCursesById.get(id);
  return c ? { name: c.name, text: c.text } : { name: titleCase(id), text: '' };
}

/** A choice event's text and its options' labels. */
export function eventInfo(eventId: string, count: number): { text: string; options: string[] } {
  const ev = DATA.heistEventsById.get(eventId);
  return {
    text: ev?.text ?? titleCase(eventId.replace(/^evt_/, '')),
    options: Array.from({ length: count }, (_, i) => ev?.options[i]?.label ?? `${i + 1}`),
  };
}

/** A shop item's name, line and picture. */
export function stockInfo(item: { id: string; kind: string }): { name: string; text: string; icon: UiIcon; tag?: PerkTag } {
  switch (item.kind) {
    case 'perk': {
      const p = perkInfo(item.id);
      return { name: p.name, text: p.text, icon: TAG_ICON[p.tag], tag: p.tag };
    }
    case 'heal':
      return { name: t('heistUi.shop.heal'), text: t('heist.shop.heal', { pct: H.shop.healPct }), icon: 'heart' };
    case 'reroll':
      return { name: t('heistUi.shop.reroll'), text: t('heist.shop.reroll'), icon: 'dice' };
    case 'removeCurse':
      return { name: t('heistUi.shop.uncurse'), text: t('heist.shop.removeCurse'), icon: 'drop' };
    default:
      return { name: titleCase(item.id), text: '', icon: 'star' };
  }
}

/** A log line, from core's `heist.log.*` strings. */
export function logText(line: HeistLogLine): string {
  return t(line.key, line.params);
}

/** The Jackpot Wheel's segments: what each pays, as the reel shows it. */
export const WHEEL = H.wheel;
const WHEEL_ICON: Record<string, UiIcon> = { coins: 'coin', heal: 'heart', bags: 'bag', perk: 'star', gems: 'gem' };
export function wheelIcon(kind: string): UiIcon {
  return WHEEL_ICON[kind] ?? 'star';
}
export function wheelLabel(seg: { kind: string; value: number }): string {
  return t(`heist.wheel.${seg.kind}`, { value: seg.value });
}

// ------------------------------------------------------------------ look

export const TAG_COLOR: Record<PerkTag, string> = {
  fire: '#ff7043',
  speed: '#29b6f6',
  loot: '#ffc233',
  crit: '#ef5350',
  tank: '#7f8fb8',
  crew: '#5bc236',
  chaos: '#b45cf0',
};

export const TAG_ICON: Record<PerkTag, UiIcon> = {
  fire: 'flame',
  speed: 'bolt',
  loot: 'bag',
  crit: 'target',
  tank: 'shield',
  crew: 'pigeon',
  chaos: 'dice',
};

export const RARITY_COLOR: Record<PerkRarity | 'evolution', string> = {
  common: '#a7a5b8',
  rare: '#42a5f5',
  epic: '#9c6cf0',
  evolution: '#ffc233',
};

const NODE_ICON: Record<string, UiIcon> = {
  fight: 'sword',
  elite: 'sword',
  boss: 'skull',
  choice: 'choice',
  treasure: 'treasure',
  golden: 'treasure',
  shop: 'shop',
  shrine: 'shrine',
  trap: 'trap',
  wheel: 'wheel',
};

export function nodeIcon(kind: HeistNodeKind): UiIcon {
  return NODE_ICON[kind] ?? 'star';
}

/** A stop's picture (`sm` for the progress pips, `nav` for the cards). */
export function NodeIcon({ kind, size = 'sm', className, style }: { kind: HeistNodeKind; size?: IconTier; className?: string; style?: CSSProperties }) {
  return <PixelArt art={uiIcon(nodeIcon(kind), size)} className={className} style={style} />;
}

/** Any UI icon by name. */
export function Ico({ name, size = 'sm', className }: { name: UiIcon; size?: IconTier; className?: string }) {
  return <PixelArt art={uiIcon(name, size)} className={className} />;
}

/** The Heist tab's nav icon: the loot sack. */
export function HeistNavIcon({ size = 'nav' }: { size?: IconTier }) {
  return <PixelArt art={uiIcon('heist', size)} />;
}

/** A perk as a small chip: its tag's icon on its tag's color (tap for details). */
export function PerkChip({ id, onClick, active }: { id: string; onClick?: () => void; active?: boolean }) {
  const p = perkInfo(id);
  return (
    <button
      className={s.perkChip}
      data-evo={p.evolution || undefined}
      data-active={active || undefined}
      style={{ ['--tc' as string]: TAG_COLOR[p.tag] } as CSSProperties}
      onClick={onClick}
      aria-label={p.name}
    >
      <Ico name={TAG_ICON[p.tag]} size="sm" />
    </button>
  );
}

/** Milliseconds to the next local midnight (when the daily tickets come in). */
export function msToMidnight(now: number): number {
  const d = new Date(now);
  const next = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).getTime();
  return Math.max(0, next - now);
}

/** "4:05:09" or "5:09". */
export function clockText(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const sec = total % 60;
  const two = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${two(m)}:${two(sec)}` : `${m}:${two(sec)}`;
}

/** Run XP toward the next run level: [have, need] (need 0 at the top level). */
export function levelProgress(run: Pick<HeistRun, 'level' | 'xp'>): [number, number] {
  const from = heistLevelXp(run.level);
  const to = heistLevelXp(run.level + 1);
  if (!Number.isFinite(to)) return [0, 0];
  return [Math.max(0, Math.floor(run.xp - from)), to - from];
}

/** The stop the run is on, 0 to 18 (act by act; the boss is the last). */
export function stopIndex(run: Pick<HeistRun, 'act' | 'index'>): number {
  return (run.act - 1) * NODES_PER_ACT + run.index;
}
