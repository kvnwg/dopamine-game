/**
 * What the Perks page says about an Alley perk: its name, its one punchy line, and its exact numbers
 * (strings.en.json perk.*, perkLine.*, perkFx.*, with the numbers filled in from balance.json, so the
 * text can never drift from what the perk does).
 */
import { BAL, DATA, type AlleyPerkDef, type PerkTreeId } from '../data';
import { t } from './i18n';

/** A perk number as the page writes it: 40, 2.5, 0.5. */
function num(v: number): string {
  return Number.isInteger(v) ? String(v) : String(Math.round(v * 100) / 100);
}

export function perkName(id: string): string {
  return t(`perk.${id}`);
}

export function perkLine(id: string): string {
  return t(`perkLine.${id}`);
}

/** The values perkFx.<id> is filled with: every effect number, and the rarity a rigged spin lands. */
export function perkVars(def: AlleyPerkDef): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const [k, v] of Object.entries(def.effect)) vars[k] = num(v as number);
  if (def.rarity) vars.rarity = t(`rarity.${def.rarity}`);
  return vars;
}

/** The perk's exact numbers ("Pecks the front enemy for 40% of your ATK every 1s."). */
export function perkFxText(def: AlleyPerkDef): string {
  return t(`perkFx.${def.id}`, perkVars(def));
}

export function treeName(id: PerkTreeId): string {
  return t(`perkTree.${id}`);
}

export function treeLine(id: PerkTreeId): string {
  return t(`perkTreeLine.${id}`);
}

/** "1 loaf", "3 loaves". */
export function loavesText(n: number): string {
  return t(n === 1 ? 'perks.loaf' : 'perks.loaves', { n });
}

/** What a locked perk needs: "Needs Pigeon Wingman first." or "Needs Sewer Cousins or Dr. Squeaks first." */
export function perkNeeds(def: AlleyPerkDef): string {
  const names = def.requires.map((id) => perkName(DATA.alleyPerksById.get(id)?.id ?? id));
  if (names.length === 0) return '';
  if (names.length === 1) return t('perks.needs', { name: names[0] });
  return t('perks.needsEither', { a: names.slice(0, -1).join(', '), b: names[names.length - 1] });
}

/** The rebirth that opens perks. */
export function perksRebirth(): number {
  return BAL.perks.unlockRebirths;
}
