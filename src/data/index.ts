/**
 * Loads every JSON content/tuning file and validates it with zod at boot.
 * Throws a readable error if anything is malformed or cross-references are broken.
 */
import balanceJson from './balance.json';
import itemsJson from './items.json';
import affixesJson from './affixes.json';
import themesJson from './themes.json';
import enemiesJson from './enemies.json';
import neighborhoodsJson from './neighborhoods.json';
import stringsJson from './strings.en.json';
import assetsJson from './assets.json';
import {
  AffixesFileSchema, AssetsSchema, BalanceSchema, EnemiesSchema, ItemsSchema, NeighborhoodsSchema,
  RARITIES, SLOTS, STAT_IDS, StringsSchema, ThemesSchema,
  type Affix, type Assets, type Balance, type BaseItem, type EnemyDef, type MintPerk, type Neighborhood, type Theme,
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
  neighborhoods: Neighborhood[];
  strings: Record<string, string>;
  assets: Assets;
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
  neighborhoods: unknown; strings: unknown; assets: unknown;
}): GameData {
  const balance = parse('balance.json', BalanceSchema, raw.balance);
  const items = parse('items.json', ItemsSchema, raw.items);
  const affixFile = parse('affixes.json', AffixesFileSchema, raw.affixes);
  const themes = parse('themes.json', ThemesSchema, raw.themes);
  const enemies = parse('enemies.json', EnemiesSchema, raw.enemies);
  const neighborhoods = parse('neighborhoods.json', NeighborhoodsSchema, raw.neighborhoods);
  const strings = parse('strings.en.json', StringsSchema, raw.strings);
  const assets = parse('assets.json', AssetsSchema, raw.assets);

  // Records keyed by enums must be complete.
  for (const s of STAT_IDS) {
    if (balance.player.base[s] === undefined) fail(`balance.player.base missing ${s}`);
    if (balance.player.perLevel[s] === undefined) fail(`balance.player.perLevel missing ${s}`);
    if (balance.power.flat[s] === undefined) fail(`balance.power.flat missing ${s}`);
    if (balance.power.pct[s] === undefined) fail(`balance.power.pct missing ${s}`);
  }
  for (const r of RARITIES) {
    if (!balance.rarities[r]) fail(`balance.rarities missing ${r}`);
    for (const row of balance.dumpster.rarityTable) {
      if (row.weights[r] === undefined) fail(`rarityTable level ${row.level} missing ${r}`);
    }
    if (!assets.placeholders.rarities[r]) fail(`assets rarity placeholder missing ${r}`);
  }
  for (const key of ['outline', 'nightSky', 'shadow', 'dumpster', 'kraft', 'tape', 'neonLime', 'gold']) {
    if (!assets.placeholders.palette[key]) fail(`assets palette missing ${key}`);
  }
  const table = balance.dumpster.rarityTable;
  if (table[0].level !== 1) fail('rarityTable must start at level 1');
  for (let i = 1; i < table.length; i++) {
    if (table[i].level <= table[i - 1].level) fail('rarityTable levels must be strictly increasing');
  }
  if (table[table.length - 1].level !== balance.dumpster.maxLevel) fail('rarityTable must end at dumpster.maxLevel');

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
  let expectedFirst = 1;
  for (const n of neighborhoods) {
    if (n.firstStage !== expectedFirst) fail(`neighborhood ${n.id} must start at stage ${expectedFirst}`);
    if (n.lastStage - n.firstStage + 1 !== balance.stages.bossLocalStage) {
      fail(`neighborhood ${n.id} must have ${balance.stages.bossLocalStage} stages`);
    }
    expectedFirst = n.lastStage + 1;
    if (!themes.some((t) => t.id === n.theme)) fail(`neighborhood ${n.id} unknown theme ${n.theme}`);
    if (n.miniBosses.length !== balance.stages.miniBossLocalStages.length) {
      fail(`neighborhood ${n.id} needs one mini-boss per mini-boss stage`);
    }
    for (const id of [...n.enemies, ...n.miniBosses, n.boss]) {
      if (!enemiesById.has(id)) fail(`neighborhood ${n.id} references unknown enemy ${id}`);
      if (!assets.placeholders.enemies[id]) fail(`enemy ${id} has no placeholder art`);
    }
    for (const id of n.enemies) if (enemiesById.get(id)!.kind !== 'regular') fail(`${id} is not a regular enemy`);
    for (const id of n.miniBosses) if (enemiesById.get(id)!.kind !== 'miniboss') fail(`${id} is not a miniboss`);
    if (enemiesById.get(n.boss)!.kind !== 'boss') fail(`${n.boss} is not a boss`);
    const bg = assets.placeholders.backgrounds[n.background];
    if (!bg) fail(`missing background ${n.background}`);
    for (const key of [bg.sign, bg.signSub]) if (strings[key] === undefined) fail(`background ${n.background} string ${key} missing`);
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
    neighborhoods,
    strings,
    assets,
  };
}

/** The validated game data. Built once at module load (boot). */
export const DATA: GameData = buildGameData({
  balance: balanceJson,
  items: itemsJson,
  affixes: affixesJson,
  themes: themesJson,
  enemies: enemiesJson,
  neighborhoods: neighborhoodsJson,
  strings: stringsJson,
  assets: assetsJson,
});

export const BAL = DATA.balance;
