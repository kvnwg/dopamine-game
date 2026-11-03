/**
 * Loads every JSON content/tuning file and validates it with zod at boot.
 * Throws a readable error if anything is malformed or cross-references are broken.
 */
import balanceJson from './balance.json';
import itemsJson from './items.json';
import affixesJson from './affixes.json';
import themesJson from './themes.json';
import enemiesJson from './enemies.json';
import worldsJson from './worlds.json';
import stringsJson from './strings.en.json';
import assetsJson from './assets.json';
import enchantsJson from './enchants.json';
import {
  AffixesFileSchema, AssetsSchema, BalanceSchema, EnchantsSchema, EnemiesSchema, ItemsSchema, WorldsSchema,
  RARITIES, SLOTS, STAT_IDS, StringsSchema, ThemesSchema,
  type Affix, type Assets, type Balance, type BaseItem, type EnchantDef, type EnemyDef, type MintPerk, type WorldDef,
  type Theme,
} from './schemas';
import type { z } from 'zod';

export * from './schemas';

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
}

function parse<T extends z.ZodTypeAny>(name: string, schema: T, raw: unknown): z.infer<T> {
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
  const order = [odds.decent, odds.shiny, odds.epic, odds.legendary, odds.mythic, odds.mint];
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
  };
}

/** The validated game data. Built once at module load (boot). */
export const DATA: GameData = buildGameData({
  balance: balanceJson,
  items: itemsJson,
  affixes: affixesJson,
  themes: themesJson,
  enemies: enemiesJson,
  worlds: worldsJson,
  strings: stringsJson,
  assets: assetsJson,
  enchants: enchantsJson,
});

export const BAL = DATA.balance;
