/**
 * World 1 battle scenery, "Sunny Suburbs", as pixel art (style rules: docs/PIXEL_ART.md). It is drawn
 * at the battle's pixel size (12 screen px per art pixel), the same size as the raccoon's pixels.
 *
 * Four horizontally tiling parallax layers, each TILE_W art pixels wide; SUBURBS bundles them as a
 * ScenerySet, with the windows and lamps that light up at dusk and night (each world's sky, clouds and
 * lighting are painted by atmosphere.ts). Rows below are rows of the 90 x 68 battle view (sceneryTypes.ts):
 *  - far (17 to 46): hazy rolling hills, a distant tree line, a few far roofs and a water tower.
 *    Colors are pushed toward the sky (aerial perspective) and nothing is inked, so it reads as distance.
 *  - mid (18 to 49): the street. Three houses, two trees, picket and plank fences, hedges, a mailbox,
 *    a fire hydrant, two metal cans and the green dumpster, all inked in `k`, standing on the lawn
 *    that starts at row 46.
 *  - ground (30 to 67): two street lamps behind the curb (rows 30 to 47 hold only them), then the lawn
 *    edge, curb, the sidewalk the fighters stand on (their feet on row 58, FEET_ROW, mid-slab) and a
 *    strip of verge.
 *  - fg (58 to 67): a few grass tufts and flowers along the bottom, in front of the fighters.
 * At this size the houses, trees and props are authored pixel by pixel as rows; hills, the far tree
 * line, fences and the sidewalk are drawn in code. Every layer wraps seamlessly: sprites go down through
 * wrapX and contours are periodic. Light comes from the top left. Other worlds grade these colors later,
 * so they stay natural.
 */
import { blank, blit, checkRows, fill, mix, type PixelBuf, type Rows, type SheetEntry } from './buf';
import type { ScenerySet } from './sceneryTypes';
import { TILE_W } from './street/common';
import { FAR_SPOT, FAR_SPRITES, farLayer, farLights } from './street/far';
import { MID_SPOT, MID_SPRITES, midLayer, midLights } from './street/mid';
import { FG_SPOT, GROUND_SPOT, GROUND_SPRITES, fgLayer, groundLayer, groundLights } from './street/ground';

export { TILE_W, windowsOf } from './street/common';
export { farLayer } from './street/far';
export { midLayer } from './street/mid';
export { fgLayer, groundLayer } from './street/ground';

// ------------------------------------------------------------------ the set

/** Where each layer's top edge sits in the 90 x 68 battle view, and its height. */
export const LAYERS = { far: FAR_SPOT, mid: MID_SPOT, ground: GROUND_SPOT, fg: FG_SPOT } as const;

export const SUBURBS: ScenerySet = {
  tileW: TILE_W,
  layers: LAYERS,
  scroll0: { far: 21, mid: 33, ground: 32, fg: 58 },
  sky: true,
  graded: true,
  far: farLayer,
  mid: midLayer,
  ground: groundLayer,
  fg: fgLayer,
  lights: () => ({ far: farLights(), mid: midLights(), ground: groundLights() }),
};

// ------------------------------------------------------------------ preview sheet

const SKY_TOP = '#2FB8F0';
const SKY_LOW = '#C8F0FF';

function skyBands(w: number, h: number): PixelBuf {
  const b = blank(w, h);
  const bands: ReadonlyArray<readonly [number, number]> = [[0, 0], [10, 0.2], [18, 0.4], [25, 0.6], [31, 0.8], [36, 1]];
  bands.forEach(([y0, t], i) => {
    const y1 = i + 1 < bands.length ? bands[i + 1][0] : h;
    fill(b, 0, y0, w, y1 - y0, mix(SKY_TOP, SKY_LOW, t));
  });
  return b;
}

export function sheet(): SheetEntry[] {
  const authored: Array<[string, Rows]> = [...FAR_SPRITES, ...MID_SPRITES, ...GROUND_SPRITES];
  for (const [name, r] of authored) checkRows(name, r);

  const far = farLayer();
  const mid = midLayer();
  const ground = groundLayer();
  const fg = fgLayer();
  const comp = skyBands(TILE_W, 68);
  blit(comp, far, 0, LAYERS.far.y);
  blit(comp, mid, 0, LAYERS.mid.y);
  blit(comp, ground, 0, LAYERS.ground.y);
  blit(comp, fg, 0, LAYERS.fg.y);
  return [
    { name: 'composite', buf: comp },
    { name: 'far', buf: far },
    { name: 'mid', buf: mid },
    { name: 'ground', buf: ground },
    { name: 'fg', buf: fg },
  ];
}
