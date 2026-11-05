/**
 * How worn gear is written down. Every worn item is drawn for the raccoon's own shape at his pixel size
 * (1 art pixel = 1 battle pixel), in the sheet's orientation (facing left, lit from the top left), with
 * a small palette of its own: rows of palette keys, '.' clear and '#' the characters' outline brown.
 */
import type { Part, Point } from './body';

/** Palette keys to colors (a key of PAL in palette.ts, or '#rrggbb'). '#' and '.' are reserved. */
export type Colors = Readonly<Record<string, string>>;

/** Rows of palette keys with the pixel that goes on a landmark. */
export interface Piece {
  readonly rows: readonly string[];
  /** The art pixel placed on the landmark. */
  readonly at: Point;
}

/** A hat, drawn on frame 0's head; it moves with the head. */
export interface HatArt {
  readonly pal: Colors;
  /** The art pixel `at` goes on frame 0's (x, y). */
  readonly art: Piece;
  readonly on: Point;
  /** Rows of his ear tips that poke through the hat (0: the hat covers them). */
  readonly ears: 0 | 1 | 2;
}

/** A mask or glasses, drawn on frame 0's face; it moves with the eyes and stays on his head. */
export interface MaskArt {
  readonly pal: Colors;
  readonly art: Piece;
  readonly on: Point;
  /** The same mask on a squashed face (eyes and nose on one row, the chin a row higher). */
  readonly squash?: Piece;
  /** Parts allowed past the head's outline (a snorkel's tube), placed like `art`. */
  readonly free?: Piece;
}

/** What a garment covers: a jacket covers the torso and arms, a vest only the torso, a coat also the hips. */
export type Cut = 'jacket' | 'vest' | 'coat';

/** Where a garment pixel is, for patterns and details: torso coordinates from the neck (u right, v down). */
export interface GarmentPixel {
  /** The pixel in the frame. */
  readonly x: number;
  readonly y: number;
  readonly u: number;
  readonly v: number;
  readonly part: Part;
  /** Light, mid or dark from the shape (lit from the top left). */
  readonly tone: 0 | 1 | 2;
  /** Last garment pixel above a paw (the cuff), or the lowest garment pixel in its column (the hem). */
  readonly cuff: boolean;
  readonly hem: boolean;
  /** Next to the neck (the collar). */
  readonly collar: boolean;
  /** He's curled up asleep (no head showing): the garment covers his back. */
  readonly curled: boolean;
}

export interface JacketArt {
  readonly pal: Colors;
  readonly cut: Cut;
  /** Palette key for each pixel of the garment (dark, mid, light tones; patterns; trims); '' leaves his fur (an open front, a moth hole). */
  readonly paint: (p: GarmentPixel) => string;
  /** Art hanging behind him (a cape), placed at the neck. */
  readonly back?: Piece;
}

/** Gloves: the front paw's glove for each way the arm can point (the back paw wears it mirrored). */
export interface GloveArt {
  readonly pal: Colors;
  readonly down: Piece;
  readonly out: Piece;
  readonly up: Piece;
  /** A different glove on the back paw (mismatched mittens, a catcher's mitt), same layout. */
  readonly back?: { readonly down: Piece; readonly out: Piece; readonly up: Piece };
}

/** Shoes: one piece per foot, placed on the foot's bottom pixel. */
export interface ShoeArt {
  readonly pal: Colors;
  readonly front: Piece;
  readonly back?: Piece;
}

/** Bling on the neck and chest, placed at the neck; drawn only over the parts listed. */
export interface BlingArt {
  readonly pal: Colors;
  readonly art?: Piece;
  readonly on?: readonly Part[];
  /** A bracelet: on the front paw's wrist instead, for each way the arm can point (like gloves). */
  readonly wrist?: { readonly down: Piece; readonly out: Piece; readonly up: Piece };
}

/** A shield strapped to the back arm, placed on the back paw for each way the arm can point. */
export interface ShieldArt {
  readonly pal: Colors;
  readonly art: Piece;
  /** Where the paw holds it when the arm is raised (defaults to `art.at`). */
  readonly raised?: Point;
  /** Body parts it passes behind (an umbrella held up over his shoulder goes behind his head). */
  readonly behind?: readonly Part[];
}

/** A pack: the bag behind his back and the straps over his front, both placed at the neck. */
export interface PackArt {
  readonly pal: Colors;
  readonly back: Piece;
  readonly straps: Piece;
  /** Body parts the straps may cross (default: neck, torso and arms). */
  readonly on?: readonly Part[];
}

/** A weapon as the battle shows it (not mirrored), leaning `tilt` degrees clockwise from straight up. */
export interface WeaponArt {
  readonly pal: Colors;
  readonly rows: readonly string[];
  /** The pixel the paw holds; the scene turns the weapon about it. */
  readonly grip: Point;
  readonly tilt: number;
}
