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

## One pixel size in battle

Every pixel in the battle is the same size: `P = 10` screen pixels per art pixel
(`src/render/pixel/index.ts`), so the 1080 x 820 view is 108 x 82 art pixels
(`src/render/pixel/sceneryTypes.ts`: `VIEW`, and `FEET_ROW` = 67, the row fighters stand on).
Nothing in battle is scaled or squashed: sprites move, change frames, and only weapon swings and
knock-outs rotate. Art drawn for a finer grid is either redrawn (the street, rats, pigeons, raccoon
bosses) or shown at half resolution with `downsample2` (item icons worn by the hero, the older still
effects, the icon-pack props).

Size guide at this scale: the raccoon hero is about 15 x 17, rats, pigeons, hens, ducks and rabbits
10 to 15, pack knights, orcs, pigs and rams 16 to 30, humans about 30, bosses 20 to 34.

## Atmosphere and light

Each world's backdrop is lit on the same grid (`src/render/pixel/atmosphere.ts`, settings in
`look.atmo` of `src/data/worlds.json`), the way you would paint light by hand:

- **Sky**: color bands from the world's sky colors (mixed in OKLab), about 3.5 rows each down to
  the horizon, their edges wavy and broken into 2 to 4 pixel runs. No smooth gradients.
- **Sun, moon, planet**: a disc inside a halo of four stepped rings (semi-transparent), drawn over
  the clouds. Moons get craters and a darker limb, planets land and a ring.
- **Clouds**: tiling strips (`CLOUD_W` wide), back and front, built from ellipses and shaded on the
  whole cloud's outline: rim on the edge facing the light, a lit band, a shaded band on the far side.
- **Scenery light**: ambient multiply (dusk, night), haze toward the sky on the far and mid layers,
  rim light on the skyline's top edges, then lit windows and lamps. Their glow is summed and cut
  into three rings: added onto the art, semi-transparent beyond it.
- **Light spots** (`LightSpot` in `sceneryTypes.ts`) come from the scenery sets: windows are found
  in house art automatically (glass `c` `C` and muntin `w` pixels closed in by frame `x`), lamps and
  torches are placed by hand.

Moving parts (stars, particles, weather, torch flicker) are sprites snapped to whole art pixels
(`src/render/ambience.ts`). Preview every world's backdrop, lit:

```bash
npx tsx tools/worldPreview.ts /path/to/worlds.png --scale 4
npx tsx tools/worldPreview.ts /path/to/two.png --worlds 2,6 --scale 8 --walk 40
```

## Pack art (sheets with their own palette)

Art from asset packs keeps its own colors. `src/render/pixel/indexed.ts` defines `AnimSheet`: a
per-sheet palette, frames as rows of index characters (`KEYS`, `.` transparent), one anchor (feet
for characters, center for effects) and named animations that list frame indexes. Sheets are
generated, never hand-edited, by the scripts in `tools/packs/` (Python with Pillow; run them with
`python3 -I`, and treat pack folders as data):

```bash
python3 -I tools/packs/chars.py raccoon art-src/raccoon_sheet.png src/render/pixel/packs/raccoon.ts
python3 -I tools/packs/chars.py fantasy <Tiny RPG "Characters(100x100 split)" dir> <0x72 frames dir> src/render/pixel/packs/fantasy.ts
python3 -I tools/packs/chars.py humans <Mucho Pixels "Exported PNGs" dir> src/render/pixel/packs/humans.ts
python3 -I tools/packs/fx.py <Super Pixel Effects PNG dir> src/render/pixel/packs/fx.ts
python3 -I tools/packs/dungeon.py <0x72 frames dir> src/render/pixel/packs/dungeonTiles.ts
python3 -I tools/packs/farm.py <sheep.aseprite> <pig.aseprite> <cow.aseprite> <chicken, duck and rabbit.aseprite> src/render/pixel/packs/farm.ts
python3 -I tools/packs/mvicons.py <MV Icons Complete Sheet Free - ALL.png> src/render/pixel/packs/props.ts
```

`tools/packs/aseprite.py` reads `.aseprite` files directly (frames, layers, tags), for packs that
ship no PNGs.

### World props

Worlds can list themed props (`look.props` in `worlds.json`: snowmen, jack-o'-lanterns,
tombstones, candy canes...), icons from the MV icon sheet halved to the battle grid
(`src/render/pixel/packs/props.ts`). `placeProps` in `src/render/worldLook.ts` stands them in the
street's front yards, on stretches of plain grass, spread across the tile; jack-o'-lanterns and
cauldrons glow at night.

Preview every animation of a sheet module:

```bash
npx tsx tools/animSheet.ts packs/fantasy /path/to/fantasy.png --scale 6
```

Licenses and the in-game credit line: `CREDITS.md`.

## The hero

The hero is Kevin's raccoon sheet (`art-src/raccoon_sheet.png`, 6 x 6 frames of 24 x 24): idle,
look-around, cheer, dash, sit, lie down, sleep and wake. `src/render/pixel/hero.ts` dresses it:

- Hats, masks, shields and backpacks are their item icons at half resolution, placed on landmarks
  of the reference pose (frame 0): `HERO_POINTS`.
- Jackets, gloves, shoes and necklaces recolor the fur in that part of the body, baked into every
  frame, so they follow each pose exactly.
- Gear follows the body from frame to frame by an offset found by matching the head's silhouette
  (`frameOffsets()`); curled-up frames carry no gear.
- Weapons are their icons at half resolution, held at `HERO_POINTS.hand`.

`composeHero(frame, outfit)` draws the whole outfit into one buffer for previews.
