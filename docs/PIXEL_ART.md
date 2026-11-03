# Pixel art style guide

All game art is pixel art, drawn in code as rows of palette characters and scaled up with
nearest-neighbor. Real art files can still replace any of it through `src/data/assets.json`.

## Format

A sprite is an array of equal-length strings. Each character is a palette key from
`src/render/pixel/palette.ts`; `.` is transparent.

```ts
export const REF_CONE: Rows = [
  '................',
  '.......kk.......',
  '......kyok......',
  // ...
];
```

`src/render/pixel/buf.ts` has the pure helpers (`fromRows`, `blit`, `outline`, `silhouette`,
`flipX`, `rot90`, `fill`, `mix`, `rampOf`, `hash01`). They work on `PixelBuf` (RGBA, 1 art
pixel = 1 buffer pixel) with no DOM, so the same code runs in Node and in the browser.

Every art module exports `sheet(): SheetEntry[]`, and this renders it to a PNG for review:

```bash
npx tsx tools/pixelSheet.ts items /path/to/items.png
```

Small sprites are drawn twice: on the dark UI navy and on the cream card color.

## Palette

| Key | Color | Use |
|---|---|---|
| `k` | #1a1326 | ink: every outline |
| `x` | #2c2236 | deep shadow, inner lines |
| `1` to `5` | #3e3a4e to #cfcedb | grays, dark to light |
| `w` / `W` | #ffffff / #f4efe1 | white / cream |
| `b` `n` `N` `t` `T` | dark brown to light tan | wood, fur, cardboard |
| `S` `s` | skin shadow, skin | people |
| `r` `R` `e` `P` `q` | dark red, red, coral, pink, hot pink | |
| `o` `O` `y` `Y` | dark orange, orange, gold, light yellow | |
| `g` `G` `l` `L` | dark green, green, light green, lime | |
| `u` `U` `c` `C` | navy, blue, sky blue, light blue | |
| `a` `A` | teal, light aqua | sea glass, gems |
| `v` `V` `m` `M` | dark purple, purple, light purple, lilac | |

Ready-made ramps (dark, mid, light) are in `RAMPS` in `palette.ts`.

## Rules

1. **Outline everything in `k`**, 1 pixel wide, on the outside of every shape. Inner details use a
   darker shade of the local color (or `x`), not `k`, unless they are true holes or gaps.
2. **Light comes from the top left.** Highlights on top-left edges, shadow on the bottom-right
   side. Use 3 tones per material: dark, mid, light from one ramp. Add a 1 to 2 pixel specular
   highlight (`w` or the lightest tone) on shiny things (metal, plastic, glass) only.
3. **No noise**: no single stray pixels, no checkerboard dithering, no pillow shading (shading that
   follows the outline all the way round), no banding (parallel lines of the same length).
4. **Readable at a glance**: a clear silhouette first, then color. Each object must be
   recognizable at 32 px on screen. Exaggerate the one feature that names it (the cone's stripes,
   the gnome's pointy red hat, the snorkel's tube).
5. **Fill the canvas**: 16x16 icons use most of the box (about 12 to 14 pixels in their long
   direction), centered, with at least 1 transparent pixel of margin for the outline.
6. **Cute and chunky**: this is a goofy raccoon game. Big heads, stubby limbs, round shapes.

## Reference sprites

`src/render/pixel/reference.ts` holds the coin and the traffic cone. Match their level of polish:
clean outline, three-tone shading, one highlight, no stray pixels.
