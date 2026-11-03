/**
 * The farmland world's battle backdrop (placeholder until the full farm set is drawn): green hills,
 * a red barn and a dirt road. Same layout rules as the street: VIEW art pixels, feet on FEET_ROW.
 */
import { blank, fill, type PixelBuf, type SheetEntry } from './buf';
import { FEET_ROW, VIEW, type ScenerySet } from './sceneryTypes';

const TILE_W = 228;
const ROAD_Y = FEET_ROW - 5;

function far(): PixelBuf {
  const b = blank(TILE_W, 40);
  for (let x = 0; x < TILE_W; x++) {
    const top = 14 + Math.round(3 * Math.sin((x / TILE_W) * Math.PI * 4));
    fill(b, x, top, 1, 40 - top, '#7fae5a');
  }
  return b;
}

function mid(): PixelBuf {
  const b = blank(TILE_W, 40);
  fill(b, 0, 30, TILE_W, 10, '#6c9a48');
  fill(b, 40, 12, 26, 18, '#b8402e');
  fill(b, 52, 20, 6, 10, '#5a2a1e');
  return b;
}

function ground(): PixelBuf {
  const b = blank(TILE_W, VIEW.h - (ROAD_Y - 3));
  fill(b, 0, 0, TILE_W, 3, '#6c9a48');
  fill(b, 0, 3, TILE_W, 11, '#b58a5a');
  fill(b, 0, 14, TILE_W, b.h - 14, '#6c9a48');
  return b;
}

function fg(): PixelBuf {
  return blank(TILE_W, 6);
}

export const FARM: ScenerySet = {
  tileW: TILE_W,
  layers: {
    far: { y: 20, h: 40 },
    mid: { y: 22, h: 40 },
    ground: { y: ROAD_Y - 3, h: VIEW.h - (ROAD_Y - 3) },
    fg: { y: VIEW.h - 6, h: 6 },
  },
  scroll0: { far: 0, mid: 20, ground: 0, fg: 0 },
  sky: true,
  graded: false,
  far,
  mid,
  ground,
  fg,
  lights: () => ({}),
};

export function sheet(): SheetEntry[] {
  return [
    { name: 'far', buf: far() },
    { name: 'mid', buf: mid() },
    { name: 'ground', buf: ground() },
    { name: 'fg', buf: fg() },
  ];
}
