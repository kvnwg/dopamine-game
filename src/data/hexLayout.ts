/**
 * Hex-map layout for the upgrade tree. Every tier of every upgrade line is one hex on a flat-top
 * grid, in doubled coordinates: `col` is the column, `row` counts half-hex steps down (so a hex's
 * neighbors are 2 rows up or down in its column, or 1 row up or down in the next column).
 * Each line's `path` walks from the tier it hangs off (or from the center, for the root line).
 */
export const HEX_STEPS = {
  n: [0, -2],
  ne: [1, -1],
  se: [1, 1],
  s: [0, 2],
  sw: [-1, 1],
  nw: [-1, -1],
} as const;

export type HexStep = keyof typeof HEX_STEPS;

interface LineLike {
  id: string;
  max: number;
  path: string;
  special?: boolean;
  requires?: { id: string; level: number };
}

export interface HexNode {
  /** `${line id}:${tier}` */
  key: string;
  id: string;
  tier: number;
  col: number;
  row: number;
  /** The node this one hangs off (previous tier, or the parent line's tier); null for the center. */
  prev: string | null;
  special: boolean;
}

export const nodeKey = (id: string, tier: number) => `${id}:${tier}`;

/** Expands `ne*3 n` into `['ne', 'ne', 'ne', 'n']`. Unknown steps are returned as-is for the caller to reject. */
export function expandPath(path: string): string[] {
  const out: string[] = [];
  for (const tok of path.split(' ').filter(Boolean)) {
    const [dir, count] = tok.split('*');
    const n = count === undefined ? 1 : Number(count);
    for (let i = 0; i < n; i++) out.push(dir);
  }
  return out;
}

/** Lays out every tier of every line. Errors list anything that makes the map invalid. */
export function layoutUpgradeMap(lines: readonly LineLike[]): { nodes: HexNode[]; errors: string[] } {
  const nodes: HexNode[] = [];
  const errors: string[] = [];
  const byKey = new Map<string, HexNode>();
  const taken = new Map<string, string>();
  const pending = [...lines];
  const roots = lines.filter((l) => !l.requires);
  if (roots.length !== 1) errors.push(`the upgrade map needs exactly one root line, found ${roots.length}`);
  // Place lines whose parent is already placed until nothing changes.
  let progress = true;
  while (pending.length > 0 && progress) {
    progress = false;
    for (let i = 0; i < pending.length; i++) {
      const line = pending[i];
      const parentKey = line.requires ? nodeKey(line.requires.id, line.requires.level) : null;
      const parent = parentKey ? byKey.get(parentKey) : null;
      if (parentKey && !parent) continue;
      pending.splice(i--, 1);
      progress = true;
      const steps = expandPath(line.path);
      const want = parent ? line.max : line.max - 1;
      if (steps.length !== want) errors.push(`upgrade ${line.id}: path has ${steps.length} steps, needs ${want}`);
      let col = parent ? parent.col : 0;
      let row = parent ? parent.row : 0;
      let prev: string | null = parent ? parent.key : null;
      for (let tier = 1; tier <= line.max; tier++) {
        if (tier > 1 || parent) {
          const step = HEX_STEPS[steps[(parent ? tier - 1 : tier - 2)] as HexStep];
          if (!step) {
            errors.push(`upgrade ${line.id}: bad step "${steps[parent ? tier - 1 : tier - 2]}"`);
            break;
          }
          col += step[0];
          row += step[1];
        }
        const key = nodeKey(line.id, tier);
        const cell = `${col},${row}`;
        const other = taken.get(cell);
        if (other) errors.push(`upgrade ${key} overlaps ${other} on the map`);
        taken.set(cell, key);
        const node: HexNode = { key, id: line.id, tier, col, row, prev, special: !!line.special };
        nodes.push(node);
        byKey.set(key, node);
        prev = key;
      }
    }
  }
  for (const line of pending) {
    errors.push(`upgrade ${line.id} hangs off ${line.requires?.id} tier ${line.requires?.level}, which is not on the map`);
  }
  return { nodes, errors };
}
