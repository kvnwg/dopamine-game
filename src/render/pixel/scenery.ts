/**
 * World 1 battle scenery, "Sunny Suburbs", as pixel art (style rules: docs/PIXEL_ART.md). It is drawn
 * at the battle's pixel size (P screen px per art pixel), the same size as the raccoon's pixels.
 *
 * Four horizontally tiling parallax layers, each TILE_W art pixels wide; SUBURBS bundles them as a
 * ScenerySet, with the windows and lamps that light up at dusk and night (each world's sky, clouds and
 * lighting are painted by atmosphere.ts). Rows below are rows of the 82-row scene frame (sceneryTypes.ts:
 * SCENE_H; the battle shows it SCENE_Y rows down, under more sky):
 *  - far (26 to 58, street/far.ts): a distant town, hills and a tree line, pushed toward the sky and
 *    left uninked so it reads as distance.
 *  - mid (20 to 59, street/mid.ts): the street. A two-story house, a cottage and a brick ranch with
 *    wide side yards, a maple, a cherry and a spruce, yard details, and the alley's dumpsters, all on
 *    the lawn that starts at the house line (row 52). World props stand at MID_PROP_SPOTS.
 *  - ground (39 to 81, street/ground.ts): two street lamps behind the curb, then the lawn edge, curb,
 *    the sidewalk the fighters stand on (their feet on row 67, SCENE_FEET_ROW) and a strip of verge.
 *  - fg (73 to 81): grass tufts and flowers along the bottom, in front of the fighters.
 * Every layer wraps seamlessly (sprites go down through wrapX, contours are periodic). Light comes from
 * the top left. Other worlds grade these colors later, so they stay natural.
 */
import { blank, blit, checkRows, fill, mix, type PixelBuf, type Rows, type SheetEntry } from './buf';
import { SCENE_H, type ScenerySet } from './sceneryTypes';
import { TILE_W } from './street/common';
import { FAR_SPOT, FAR_SPRITES, farLayer, farLights } from './street/far';
import { MID_PROP_SPOTS, MID_SPOT, MID_SPRITES, midLayer, midLights } from './street/mid';
import { FG_SPOT, GROUND_SPOT, GROUND_SPRITES, fgLayer, groundLayer, groundLights } from './street/ground';

export { TILE_W, windowsOf } from './street/common';
export { farLayer } from './street/far';
export { midLayer } from './street/mid';
export { fgLayer, groundLayer } from './street/ground';

// ------------------------------------------------------------------ the set

/** Where each layer's top edge sits in the scene frame (SCENE_H rows), and its height. */
export const LAYERS = { far: FAR_SPOT, mid: MID_SPOT, ground: GROUND_SPOT, fg: FG_SPOT } as const;

export const SUBURBS: ScenerySet = {
  tileW: TILE_W,
  layers: LAYERS,
  scroll0: { far: 44, mid: 44, ground: 32, fg: 58 },
  sky: true,
  graded: true,
  far: farLayer,
  mid: midLayer,
  ground: groundLayer,
  fg: fgLayer,
  lights: () => ({ far: farLights(), mid: midLights(), ground: groundLights() }),
  propSpots: MID_PROP_SPOTS,
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
  const comp = skyBands(TILE_W, SCENE_H);
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
