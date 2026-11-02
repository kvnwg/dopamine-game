import { makeCanvas, type Ctx } from './brush';

/** Raccoon texture box; the raccoon's feet sit at RACCOON_FEET. Gear overlays share it. */
export const RACCOON_TEX = { w: 380, h: 400 };
export const RACCOON_FEET = { x: 180, y: 384 };

export function paintRaccoonFrame(draw: (ctx: Ctx, fx: number, fy: number) => void): HTMLCanvasElement {
  const { c, ctx } = makeCanvas(RACCOON_TEX.w, RACCOON_TEX.h);
  draw(ctx, RACCOON_FEET.x, RACCOON_FEET.y);
  return c;
}
