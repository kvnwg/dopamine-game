/**
 * Loads every JSON content/tuning file and validates it with zod at boot.
 * Throws a readable error if anything is malformed or cross-references are broken.
 */
import balanceJson from './balance.json';
import itemsJson from './items.json';
import itemsHeadgearJson from './itemsHeadgear.json';
import itemsClothesJson from './itemsClothes.json';
import itemsArmsJson from './itemsArms.json';
import itemsCarryJson from './itemsCarry.json';
import affixesJson from './affixes.json';
import themesJson from './themes.json';
import enemiesJson from './enemies.json';
import worldsJson from './worlds.json';
import stringsJson from './strings.en.json';
import assetsJson from './assets.json';
import enchantsJson from './enchants.json';
import heistJson from './heist.json';
import heistEventsJson from './heistEvents.json';
import {
  AffixesFileSchema, AssetsSchema, BalanceSchema, EnchantsSchema, EnemiesSchema, HeistEventsSchema, HeistFileSchema, ItemsSchema,
  WorldsSchema, LOCATION_IDS, PERK_TREE_IDS, RARITIES, SLOTS, STAT_IDS, StringsSchema, ThemesSchema,
  type Affix, type AlleyPerkDef, type Assets, type Balance, type BaseItem, type CurseDef, type EnchantDef, type EnemyDef, type HeistEventDef,
  type HeistLocationDef, type HeistTrapDef, type LocationId, type MintPerk, type PerkDef, type WorldDef, type Theme,
} from './schemas';
import type { z } from 'zod';
import { layoutUpgradeMap, type HexNode } from './hexLayout';

export * from './schemas';
export { HEX_STEPS, expandPath, layoutUpgradeMap, nodeKey, type HexNode, type HexStep } from './hexLayout';

export interface GameData {
  balance: Balance;
  items: BaseItem[];
  itemsById: Map<string, BaseItem>;
  affixes: Affix[];
  affixesById: Map<string, Affix>;
  mintPerks: MintPerk[];
  mintPerksById: Map<string, MintPerk>;
  themes: Theme[];
  enemies: EnemyDef[];
  enemiesById: Map<string, EnemyDef>;
  /** World 1 is worlds[0]. */
  worlds: WorldDef[];
  strings: Record<string, string>;
  assets: Assets;
  enchants: EnchantDef[];
  enchantsById: Map<string, EnchantDef>;
  /** Every tier of every upgrade line, placed on the hex map. */
  upgradeMap: HexNode[];
  /** Heists: the three locations (in unlock order), perks (evolutions included), curses, traps and choice events. */
  heistLocations: HeistLocationDef[];
  heistLocationsById: Map<LocationId, HeistLocationDef>;
  heistPerks: PerkDef[];
  heistPerksById: Map<string, PerkDef>;
  heistCurses: CurseDef[];
  heistCursesById: Map<string, CurseDef>;
  heistTraps: HeistTrapDef[];
  heistEvents: HeistEventDef[];
  heistEventsById: Map<string, HeistEventDef>;
  /** Alley perks (the Upgrades screen's Perks page), in balance.json order. */
  alleyPerks: AlleyPerkDef[];
  alleyPerksById: Map<string, AlleyPerkDef>;
}

/**
 * Whether the data files are checked against their schemas as they load. A production build skips it:
 * the tests and every development start check the same bundled files, and the check hands back exactly
 * the data it was given (tests/data.test.ts), while it was the biggest part of a phone's start (about
 * 0.3 s of a mid-range one). Tests check data they make up, too.
 */
const CHECK_DATA = !import.meta.env.PROD || import.meta.env.MODE === 'test';

function parse<T extends z.ZodTypeAny>(name: string, schema: T, raw: unknown): z.infer<T> {
  if (!CHECK_DATA) return raw as z.infer<T>;
  const res = schema.safeParse(raw);
  if (!res.success) {
    const issues = res.error.issues.map((i) => `  ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Invalid data file ${name}:\n${issues}`);
  }
  return res.data;
}

function fail(msg: string): never {
  throw new Error(`Data cross-reference error: ${msg}`);
}

export function buildGameData(raw: {
  balance: unknown; items: unknown; affixes: unknown; themes: unknown; enemies: unknown;
  worlds: unknown; strings: unknown; assets: unknown; enchants: unknown;
  /** Default: the bundled heist.json and heistEvents.json. */
  heist?: unknown; heistEvents?: unknown;
}): GameData {
  const balance = parse('balance.json', BalanceSchema, raw.balance);
  const items = parse('items.json', ItemsSchema, raw.items);
  const affixFile = parse('affixes.json', AffixesFileSchema, raw.affixes);
  const themes = parse('themes.json', ThemesSchema, raw.themes);
  const enemies = parse('enemies.json', EnemiesSchema, raw.enemies);
  const worlds = parse('worlds.json', WorldsSchema, raw.worlds);
  const strings = parse('strings.en.json', StringsSchema, raw.strings);
  const assets = parse('assets.json', AssetsSchema, raw.assets);
  const enchants = parse('enchants.json', EnchantsSchema, raw.enchants);
  const enchantsById = new Map(enchants.map((e) => [e.id, e]));
  if (enchantsById.size !== enchants.length) fail('duplicate enchant id');
  const upgradeIds = new Set(balance.upgrades.map((u) => u.id));
  if (upgradeIds.size !== balance.upgrades.length) fail('duplicate upgrade id');
  const odds = balance.rarityOdds;
  const order = RARITIES.slice(1).map((r) => (odds as Record<string, number>)[r]);
  for (let i = 1; i < order.length; i++) if (order[i] <= order[i - 1]) fail('rarityOdds must get rarer with each tier');

  // Records keyed by enums must be complete.
  for (const s of STAT_IDS) {
    if (balance.player.base[s] === undefined) fail(`balance.player.base missing ${s}`);
    if (balance.player.perLevel[s] === undefined) fail(`balance.player.perLevel missing ${s}`);
    if (balance.power.flat[s] === undefined) fail(`balance.power.flat missing ${s}`);
    if (balance.power.pct[s] === undefined) fail(`balance.power.pct missing ${s}`);
  }
  for (const r of RARITIES) {
    if (!balance.rarities[r]) fail(`balance.rarities missing ${r}`);
    if (!assets.placeholders.rarities[r]) fail(`assets rarity placeholder missing ${r}`);
  }
  for (const key of ['outline', 'nightSky', 'shadow', 'dumpster', 'kraft', 'tape', 'neonLime', 'gold']) {
    if (!assets.placeholders.palette[key]) fail(`assets palette missing ${key}`);
  }

  const itemsById = new Map<string, BaseItem>();
  for (const it of items) {
    if (itemsById.has(it.id)) fail(`duplicate item id ${it.id}`);
    if (!themes.some((t) => t.id === it.theme)) fail(`item ${it.id} has unknown theme ${it.theme}`);
    itemsById.set(it.id, it);
  }
  for (const theme of themes) {
    for (const slot of SLOTS) {
      const n = items.filter((i) => i.theme === theme.id && i.slot === slot && !i.unique).length;
      if (n === 0) fail(`theme ${theme.id} has no base items for slot ${slot}`);
    }
  }
  const tut = itemsById.get(balance.dumpster.tutorialItem.baseId);
  if (!tut) fail(`tutorial item ${balance.dumpster.tutorialItem.baseId} not found`);

  const affixesById = new Map(affixFile.affixes.map((a) => [a.id, a]));
  if (affixesById.size !== affixFile.affixes.length) fail('duplicate affix id');
  for (const a of affixFile.affixes) if (a.min > a.max) fail(`affix ${a.id} min > max`);
  for (const theme of themes) {
    for (const id of Object.keys(theme.substatWeights)) {
      if (!affixesById.has(id)) fail(`theme ${theme.id} weights unknown affix ${id}`);
    }
  }

  const enemiesById = new Map(enemies.map((e) => [e.id, e]));
  if (enemiesById.size !== enemies.length) fail('duplicate enemy id');
  const upIds = new Set(balance.upgrades.map((u) => u.id));
  for (const u of balance.upgrades) {
    if (u.requires && !upIds.has(u.requires.id)) fail(`upgrade ${u.id} requires unknown upgrade ${u.requires.id}`);
    // Walk up the tree to catch cycles.
    let cur = u.requires?.id;
    for (let steps = 0; cur; steps++) {
      if (steps > balance.upgrades.length) fail(`upgrade tree has a cycle at ${u.id}`);
      cur = balance.upgrades.find((x) => x.id === cur)?.requires?.id;
    }
  }

  for (const u of balance.upgrades) {
    const parent = u.requires && balance.upgrades.find((x) => x.id === u.requires!.id);
    if (parent && u.requires!.level > parent.max) fail(`upgrade ${u.id} requires ${parent.id} tier ${u.requires!.level}, past its max`);
  }
  const upgradeMap = layoutUpgradeMap(balance.upgrades);
  if (upgradeMap.errors.length > 0) fail(upgradeMap.errors.join('; '));

  const worldIds = new Set<string>();
  for (const w of worlds) {
    if (worldIds.has(w.id)) fail(`duplicate world id ${w.id}`);
    worldIds.add(w.id);
    if (!themes.some((t) => t.id === w.theme)) fail(`world ${w.id} unknown theme ${w.theme}`);
    for (const foe of [...w.enemies, w.boss]) {
      if (!enemiesById.has(foe.id)) fail(`world ${w.id} references unknown enemy ${foe.id}`);
      if (!assets.placeholders.enemies[foe.id]) fail(`enemy ${foe.id} has no placeholder art`);
    }
    for (const foe of w.enemies) if (enemiesById.get(foe.id)!.kind !== 'regular') fail(`${foe.id} is not a regular enemy`);
  }

  const heist = buildHeistData(raw.heist ?? heistJson, raw.heistEvents ?? heistEventsJson, {
    balance, itemsById, enemiesById, worlds, assets, strings,
  });
  const alleyPerksById = checkAlleyPerks(balance);

  return {
    balance,
    items,
    itemsById,
    affixes: affixFile.affixes,
    affixesById,
    mintPerks: affixFile.mintPerks,
    mintPerksById: new Map(affixFile.mintPerks.map((p) => [p.id, p])),
    themes,
    enemies,
    enemiesById,
    worlds,
    strings,
    assets,
    enchants,
    enchantsById,
    upgradeMap: upgradeMap.nodes,
    ...heist,
    alleyPerks: balance.perks.list,
    alleyPerksById,
  };
}

/**
 * The Alley perk trees (balance.json `perks`): every tree listed once and rooted, ids unique, each
 * perk opened by perks of its own tree that cost less (deeper is pricier), every perk reachable from
 * its tree's root, and a rarity on (only) the perks that rig spins.
 */
function checkAlleyPerks(balance: Balance): Map<string, AlleyPerkDef> {
  const p = balance.perks;
  const byId = new Map<string, AlleyPerkDef>();
  for (const perk of p.list) {
    if (byId.has(perk.id)) fail(`duplicate perk id ${perk.id}`);
    byId.set(perk.id, perk);
  }
  const trees = p.trees.map((t) => t.id);
  for (const id of PERK_TREE_IDS) if (trees.filter((t) => t === id).length !== 1) fail(`perk tree ${id} must be listed once`);
  for (const perk of p.list) {
    for (const req of perk.requires) {
      const parent = byId.get(req);
      if (!parent) fail(`perk ${perk.id} requires unknown perk ${req}`);
      if (parent.tree !== perk.tree) fail(`perk ${perk.id} requires ${req} from another tree`);
      if (parent.cost >= perk.cost) fail(`perk ${perk.id} must cost more than ${req}, which opens it`);
    }
    if (!!perk.effect.jackpotEvery !== !!perk.rarity) fail(`perk ${perk.id}: a rarity goes with (only) jackpotEvery`);
  }
  for (const tree of PERK_TREE_IDS) {
    const list = p.list.filter((x) => x.tree === tree);
    if (!list.some((x) => x.requires.length === 0)) fail(`perk tree ${tree} has no root`);
    // Cheaper perks open dearer ones, so walking in cost order reaches everything reachable.
    const reached = new Set<string>();
    for (const perk of [...list].sort((a, b) => a.cost - b.cost)) {
      if (perk.requires.length === 0 || perk.requires.some((r) => reached.has(r))) reached.add(perk.id);
    }
    for (const perk of list) if (!reached.has(perk.id)) fail(`perk ${perk.id} can never be reached`);
  }
  return byId;
}

type HeistData = Pick<
  GameData,
  | 'heistLocations' | 'heistLocationsById' | 'heistPerks' | 'heistPerksById' | 'heistCurses' | 'heistCursesById' | 'heistTraps'
  | 'heistEvents' | 'heistEventsById'
>;

/** Validates heist.json and heistEvents.json, and every id they share with the rest of the data (traps' strings too). */
function buildHeistData(
  rawHeist: unknown,
  rawEvents: unknown,
  ctx: {
    balance: Balance; itemsById: Map<string, BaseItem>; enemiesById: Map<string, EnemyDef>; worlds: WorldDef[]; assets: Assets;
    strings: Record<string, string>;
  },
): HeistData {
  const file = parse('heist.json', HeistFileSchema, rawHeist);
  const events = parse('heistEvents.json', HeistEventsSchema, rawEvents);
  const { balance, itemsById, enemiesById, worlds, assets, strings } = ctx;

  const heistLocationsById = new Map<LocationId, HeistLocationDef>();
  for (const loc of file.locations) {
    if (heistLocationsById.has(loc.id)) fail(`duplicate heist location ${loc.id}`);
    heistLocationsById.set(loc.id, loc);
    if (loc.world > worlds.length) fail(`heist location ${loc.id} borrows unknown world ${loc.world}`);
    const roster: Array<[string, string]> = [
      ...loc.enemies.map((id) => [id, 'regular'] as [string, string]),
      ...loc.elites.map((id) => [id, 'miniboss'] as [string, string]),
      [loc.boss, 'boss'],
    ];
    for (const [id, kind] of roster) {
      const e = enemiesById.get(id);
      if (!e) fail(`heist location ${loc.id} references unknown enemy ${id}`);
      if (e.kind !== kind) fail(`heist enemy ${id} must be kind ${kind}`);
      if (!assets.placeholders.enemies[id]) fail(`enemy ${id} has no placeholder art`);
    }
    const ring = itemsById.get(loc.ring);
    if (!ring || ring.slot !== 'ring' || ring.heist !== loc.id) fail(`heist location ${loc.id} ring ${loc.ring} must be a ring with heist "${loc.id}"`);
  }
  for (const id of LOCATION_IDS) if (!heistLocationsById.has(id)) fail(`heist location ${id} missing`);
  for (const it of itemsById.values()) {
    if (it.heist && heistLocationsById.get(it.heist)?.ring !== it.id) fail(`item ${it.id} is a heist item no location drops`);
  }
  for (const e of enemiesById.values()) {
    for (const sp of [e.special, ...(e.specials ?? [])]) {
      if (sp?.type !== 'summon') continue;
      const add = enemiesById.get(sp.enemyId);
      if (!add || add.kind !== 'regular') fail(`enemy ${e.id} summons unknown regular enemy ${sp.enemyId}`);
      if (!assets.placeholders.enemies[sp.enemyId]) fail(`enemy ${sp.enemyId} has no placeholder art`);
    }
  }

  const heistPerksById = new Map<string, PerkDef>();
  for (const p of file.perks) {
    if (heistPerksById.has(p.id)) fail(`duplicate perk id ${p.id}`);
    heistPerksById.set(p.id, p);
    if ((p.rarity === 'evolution') !== !!p.recipe) fail(`perk ${p.id}: evolutions (and only they) have a recipe`);
    // A shop's health counter is the only place a shop-only perk is sold, and it sells +max HP perks.
    if (p.shopOnly && (p.recipe || !((p.effect.hpPct ?? 0) > 0))) fail(`perk ${p.id}: a shop-only perk must be a +max HP perk`);
  }
  for (const p of file.perks) {
    for (const id of p.recipe?.perks ?? []) {
      const ing = heistPerksById.get(id);
      if (!ing || ing.recipe) fail(`evolution ${p.id} needs unknown perk ${id}`);
    }
  }
  const heistCursesById = new Map<string, CurseDef>();
  for (const c of file.curses) {
    if (heistCursesById.has(c.id) || heistPerksById.has(c.id)) fail(`duplicate curse id ${c.id}`);
    heistCursesById.set(c.id, c);
  }

  const trapIds = new Set<string>();
  const heistTraps: HeistTrapDef[] = file.traps.map((trap) => {
    if (trapIds.has(trap.id)) fail(`duplicate heist trap ${trap.id}`);
    trapIds.add(trap.id);
    const name = strings[`heist.trap.${trap.id}.name`];
    const text = strings[`heist.trap.${trap.id}.text`];
    if (!name || !text) fail(`heist trap ${trap.id} needs strings heist.trap.${trap.id}.name and .text`);
    return { ...trap, name, text };
  });
  for (const id of LOCATION_IDS) if (!heistTraps.some((tr) => !tr.locations || tr.locations.includes(id))) fail(`no heist trap springs at ${id}`);

  /** What a regular enemy looks like (an event's `foe` is checked against it). */
  const shapeOf = (enemyId: string) => assets.placeholders.enemies[enemyId]?.shape;
  const heistEventsById = new Map<string, HeistEventDef>();
  for (const ev of events) {
    if (heistEventsById.has(ev.id)) fail(`duplicate heist event ${ev.id}`);
    heistEventsById.set(ev.id, ev);
    if (ev.foe) {
      const fights = ev.options.some((opt) => opt.outcomes.some((o) => o.type === 'fight' || o.type === 'eliteFight'));
      if (!fights) fail(`heist event ${ev.id} names a foe but starts no fight`);
      for (const id of ev.locations ?? LOCATION_IDS) {
        const loc = heistLocationsById.get(id)!;
        if (!loc.enemies.some((e) => shapeOf(e) === ev.foe)) fail(`heist event ${ev.id} promises a ${ev.foe} fight, but ${id} has no ${ev.foe}`);
      }
    }
    ev.options.forEach((opt, i) => {
      let chance = 0;
      for (const o of opt.outcomes) {
        chance += o.chance ?? 0;
        if (o.perkId && (!heistPerksById.has(o.perkId) || heistPerksById.get(o.perkId)!.recipe)) {
          fail(`heist event ${ev.id} option ${i} gives unknown perk ${o.perkId}`);
        }
        if (o.curseId && !heistCursesById.has(o.curseId)) fail(`heist event ${ev.id} option ${i} gives unknown curse ${o.curseId}`);
      }
      if (chance > 1 + 1e-9) fail(`heist event ${ev.id} option ${i}: chances add up to more than 1`);
    });
  }

  const h = balance.heist;
  for (let i = 1; i < h.levels.length; i++) if (h.levels[i] <= h.levels[i - 1]) fail('heist.levels must rise');
  if (h.ring.minRarity === 'junk') fail('heist.ring.minRarity must be above Junk');

  return {
    heistLocations: file.locations,
    heistLocationsById,
    heistPerks: file.perks,
    heistPerksById,
    heistCurses: file.curses,
    heistCursesById,
    heistTraps,
    heistEvents: events,
    heistEventsById,
  };
}

/** The validated game data. Built once at module load (boot). */
export const DATA: GameData = buildGameData({
  balance: balanceJson,
  // The base items, and more of them by slot group (one file each, so they can be edited apart).
  items: [...itemsJson, ...itemsHeadgearJson, ...itemsClothesJson, ...itemsArmsJson, ...itemsCarryJson],
  affixes: affixesJson,
  themes: themesJson,
  enemies: enemiesJson,
  worlds: worldsJson,
  strings: stringsJson,
  assets: assetsJson,
  enchants: enchantsJson,
});

export const BAL = DATA.balance;
