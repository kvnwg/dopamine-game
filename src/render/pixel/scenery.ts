/**
 * The street, "Sunny Suburbs", as pixel art (style rules: docs/PIXEL_ART.md): the backdrop of every
 * world but the dungeon and the farm, each grading it with its own hue and lighting. It is drawn at
 * the battle's pixel size (P screen px per art pixel), the same size as the raccoon's pixels, in the
 * 123-row scene frame (sceneryTypes.ts: SCENE_FRAME, the fighters' feet on row 100), 1.5 times the
 * resolution the first street was drawn at, so the houses are as big on screen with finer detail.
 *
 * Four horizontally tiling parallax layers, each TILE_W art pixels wide; SUBURBS bundles them as a
 * ScenerySet, with the windows and lamps that light up at dusk and night (each world's sky, clouds and
 * lighting are painted by atmosphere.ts). Rows below are rows of the frame:
 *  - far (39 to 88, street/far.ts): a distant town (a church spire, a water tower), a farm, fields,
 *    hills and a tree line, pushed toward the sky and left uninked so it reads as distance.
 *  - mid (30 to 89, street/mid.ts): the street. A two-story colonial, a cottage and a brick ranch with
 *    wide side yards, a maple, a cherry and a spruce, yards with shrubs, a hedge, a picket fence, flower
 *    beds, mailboxes, a gnome and a bird bath, and the alley's dumpster, all on the lawn that starts at
 *    the house line (row 78). World props stand at MID_PROP_SPOTS.
 *  - ground (57 to 122, street/ground.ts): two street lamps behind the curb, then the lawn edge, the
 *    curb with a storm drain, the sidewalk the fighters stand on (their feet on row 100) and a verge.
 *  - fg (109 to 122): grass tufts, flowers and pebbles along the bottom, in front of the fighters.
 * Every layer wraps seamlessly (sprites go down through wrapX, contours are periodic). Light comes from
 * the top left. Other worlds grade these colors later, so they stay natural.
 */
import { blank, blit, checkRows, fill, mix, type PixelBuf, type Rows, type SheetEntry } from './buf';
import { SCENE_FRAME, type ScenerySet } from './sceneryTypes';
import { TILE_W } from './street/common';
import { FAR_SPOT, FAR_SPRITES, farLayer, farLights } from './street/far';
import { MID_PROP_SPOTS, MID_SPOT, MID_SPRITES, midLayer, midLights } from './street/mid';
import { FG_SPOT, GROUND_SPOT, GROUND_SPRITES, fgLayer, groundLayer, groundLights } from './street/ground';

export { TILE_W, windowsOf } from './street/common';
export { farLayer } from './street/far';
export { midLayer } from './street/mid';
export { fgLayer, groundLayer } from './street/ground';

// ------------------------------------------------------------------ the set

/** Where each layer's top edge sits in the street's frame (SCENE_FRAME rows), and its height. */
export const LAYERS = { far: FAR_SPOT, mid: MID_SPOT, ground: GROUND_SPOT, fg: FG_SPOT } as const;

export const SUBURBS: ScenerySet = {
  frame: SCENE_FRAME,
  tileW: TILE_W,
  layers: LAYERS,
  scroll0: { far: 66, mid: 66, ground: 48, fg: 87 },
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
  const bands: ReadonlyArray<readonly [number, number]> = [[0, 0], [15, 0.2], [27, 0.4], [38, 0.6], [47, 0.8], [54, 1]];
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
  const comp = skyBands(TILE_W, SCENE_FRAME.h);
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
