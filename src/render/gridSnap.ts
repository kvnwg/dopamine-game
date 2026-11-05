/**
 * The battle's one-grid guarantee: a camera post-pass that turns every P x P block of the frame into
 * one flat color, the color at the block's center texel. Whatever reaches the frame off the grid (the
 * swinging weapon's rotation, a tumbling knock-out, sub-pixel tween positions, alpha edges) comes out
 * as whole art pixels on the same grid as the art.
 *
 * Phaser's built-in Pixelate FX can't do this: it blends the center with the block's four corners,
 * which smears colors across neighbouring blocks. This samples exactly one texel per block.
 *
 * Blocks are counted from the top-left corner of the frame (where the art's grid starts) although the
 * WebGL framebuffer's origin is its bottom-left corner, so they line up even when the height is not
 * a multiple of P. WebGL only: the canvas renderer draws without it (everything is also placed on the
 * grid natively, see BattleScene).
 */
import Phaser from 'phaser';
import { P } from './pixel';

const FRAG = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif

uniform sampler2D uMainSampler;
uniform vec2 uSize;
uniform float uCell;

varying vec2 outTexCoord;

void main ()
{
    // This fragment in texels, y counted down from the top edge.
    vec2 px = vec2(outTexCoord.x, 1.0 - outTexCoord.y) * uSize;
    // The middle of its cell's center texel (cells start at the top-left corner).
    vec2 center = (floor(px / uCell) + 0.5) * uCell;
    center = floor(center) + 0.5;
    gl_FragColor = texture2D(uMainSampler, vec2(center.x / uSize.x, 1.0 - center.y / uSize.y));
}
`;

export const GRID_SNAP = 'GridSnap';

export class GridSnapPipeline extends Phaser.Renderer.WebGL.Pipelines.PostFXPipeline {
  constructor(game: Phaser.Game) {
    super({ game, name: GRID_SNAP, fragShader: FRAG });
  }

  onDraw(target: Phaser.Renderer.WebGL.RenderTarget): void {
    this.set2f('uSize', target.width, target.height);
    this.set1f('uCell', P);
    this.bindAndDraw(target);
  }
}

/** Puts the grid snap on a scene's main camera (WebGL only). Returns whether it's on. */
export function snapCameraToGrid(scene: Phaser.Scene): boolean {
  const renderer = scene.sys.game.renderer;
  if (!(renderer instanceof Phaser.Renderer.WebGL.WebGLRenderer)) return false;
  // Dev builds can leave it off (`?nosnap`) to check that the scene is drawn on the grid by itself.
  if (import.meta.env.DEV && typeof location !== 'undefined' && new URLSearchParams(location.search).has('nosnap')) return false;
  // (Registering is a no-op once the class is known.)
  renderer.pipelines.addPostPipeline(GRID_SNAP, GridSnapPipeline);
  const cam = scene.cameras.main;
  if (!cam.postPipelines.some((p) => p.name === GRID_SNAP)) cam.setPostPipeline(GRID_SNAP);
  return true;
}
