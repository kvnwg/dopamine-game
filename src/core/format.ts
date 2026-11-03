/** Number and duration formatting. Pure; no locale-dependent output. */

const NAMED_SUFFIXES = ['', 'K', 'M', 'B', 'T'];
const LETTERS = 'abcdefghijklmnopqrstuvwxyz';

/** Suffix for tier t (t=1 -> K, t=5 -> aa, t=6 -> ab, ...). */
export function suffixForTier(tier: number): string {
  if (tier < NAMED_SUFFIXES.length) return NAMED_SUFFIXES[tier];
  const i = tier - NAMED_SUFFIXES.length; // 0 -> aa
  return LETTERS[Math.floor(i / 26) % 26] + LETTERS[i % 26];
}

/**
 * 999, 1.2K, 3.4M, 5.6B, 7.8T, then aa, ab, ac...
 * Values are floored (never show more than the player has).
 */
/**
 * A fractional increase as a percentage without the sign: 0.15 -> "15%", 0.025 -> "2.5%", 12 -> "1.2K%".
 * Used wherever a bonus is shown, so players never see "+0.15".
 */
export function formatPct(fraction: number): string {
  const p = fraction * 100;
  if (Math.abs(p) >= 1000) return `${formatNumber(p)}%`;
  const r = Math.round(p * 10) / 10;
  return `${Number.isInteger(r) || Math.abs(r) >= 10 ? Math.round(r) : r.toFixed(1)}%`;
}

export function formatNumber(value: number): string {
  if (!Number.isFinite(value)) return value > 0 ? '∞' : '-∞';
  const sign = value < 0 ? '-' : '';
  const v = Math.abs(value);
  if (v < 1000) return sign + Math.floor(v).toString();
  let tier = Math.floor(Math.log10(v) / 3);
  let scaled = v / Math.pow(1000, tier);
  // Guard against floating error like 999.9999 -> show as next tier.
  if (scaled >= 1000) {
    tier += 1;
    scaled /= 1000;
  }
  let body: string;
  if (scaled < 100) {
    const floored = Math.floor(scaled * 10) / 10;
    body = floored % 1 === 0 ? floored.toFixed(0) : floored.toFixed(1);
  } else {
    body = Math.floor(scaled).toString();
  }
  return sign + body + suffixForTier(tier);
}

/** 3725 -> "1h 2m", 125 -> "2m 5s", 9 -> "9s". */
export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.ceil(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${sec}s`;
  return `${sec}s`;
}

/** Format a stat value for display (percent stats get a % sign). */
export function formatStatValue(stat: string, mode: 'flat' | 'pct', value: number): string {
  const percentStats = new Set(['CRIT', 'CRIT_DMG', 'DODGE', 'LIFESTEAL', 'BAG_FIND', 'COIN_FIND', 'BOSS_DMG']);
  if (mode === 'pct' || percentStats.has(stat)) return `+${trimNum(value)}%`;
  if (stat === 'ATK_SPD') return `+${value.toFixed(2)}/s`;
  if (stat === 'REGEN') return `+${trimNum(value)}/s`;
  return `+${formatNumber(value)}`;
}

function trimNum(v: number): string {
  if (Math.abs(v) >= 100) return Math.round(v).toString();
  return (Math.round(v * 10) / 10).toString();
}
