/** Asset manifest access. Missing art falls back to code-drawn placeholders automatically. */
import { DATA, type Rarity } from '../data';

export function assetFile(id: string): string | null {
  return DATA.assets.files[id] ?? null;
}

export function rarityColor(r: Rarity): string {
  return DATA.assets.placeholders.rarities[r].color;
}

export function rarityColorNum(r: Rarity): number {
  return hexToNum(rarityColor(r));
}

export function hexToNum(hex: string): number {
  return parseInt(hex.replace('#', ''), 16);
}

export function enemyPlaceholder(id: string) {
  return DATA.assets.placeholders.enemies[id] ?? { shape: 'rat' as const, color: '#888888', accent: '#bbbbbb', size: 100, label: id.toUpperCase() };
}
