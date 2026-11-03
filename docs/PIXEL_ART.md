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

Every pixel in the battle is the same size: `P = 6` screen pixels per art pixel
(`src/render/pixel/index.ts`), so the 1080 x 960 view is 180 x 160 art pixels
(`src/render/pixel/sceneryTypes.ts`: `VIEW`). Nothing in battle is scaled or squashed: sprites move
and change frames, and only the weapon's swing rotates freely. Characters (the raccoon, enemies, worn
gear, the effects packs) keep the art they had at 9 px, so they show at two thirds of their old size;
the scenery is drawn at 1.5 times the old resolution, so the world keeps its size on screen with
more detail. The older still effects (coin, bag, impact, puff) are shown whole (at 9 px they were
halved with `downsample2`); the icon-pack props still are.

**Scene frames.** Each scenery set is drawn for its own scene frame, `ScenerySet.frame`: `h` rows
with the fighters' feet on row `feetRow`. The battle puts every set's feet row on one view row,
`FEET_ROW` = 137 (the ground line at y 828), so a set's frame top is at view row
`frameTop(set)` = 137 - `feetRow`.

- `SCENE_FRAME` (`{ h: 123, feetRow: 100 }`) is the frame for sets drawn for the 6 px grid (the
  street, the farm, the dungeon). Its top is view row 37 and its last row is the view's last; a set
  without a sky draws its far layer up above it (`LayerSpot.y` may be negative), as the dungeon does
  with its vault.
- `LEGACY_FRAME` (`{ h: 82, feetRow: 67 }`) is the frame the first sets were drawn for at 9 px, and
  the default for a set that declares none. Its top is view row 70: the view shows more sky over it,
  and `src/render/worldLook.ts` fills the 8 rows under it (a ground layer that reaches the frame's
  bottom repeats its bottom rows down to the view's edge; such a foreground moves down to the edge).

Layer spots (`ScenerySet.layers`), light spots, prop spots and the rows in each scenery module are
rows of the set's own frame; `layerRow(set, layer)` in `src/render/worldLook.ts` gives view rows. The
old names `SCENE_H`, `SCENE_FEET_ROW` and `SCENE_Y` (70) describe the legacy frame.

A world's `look.atmo` (horizon, sun or moon, clouds) in `src/data/worlds.json` is written in legacy
frame rows (and the sun's x in columns of the old 120-wide view). `viewAtmo(atmo, set)` maps it into the
set's frame: a row `r` becomes view row `frameTop(set) + r * frameScale(set)`, where `frameScale` is
`h / 82` (1.5 for `SCENE_FRAME`); the sun's or moon's x and size scale by the same factor. The sky's
details follow `frameScale` too (`src/render/pixel/atmosphere.ts`): clouds are built 1.5 times
bigger in 270-pixel strips, stars keep their density on screen, glows spread as far. Particle bands
in `src/render/ambience.ts` are legacy frame rows mapped the same way, their speeds scaled, and on a
finer set rain, snow, leaves, petals and glows use bigger sprites.

Size guide at this scale: the raccoon hero is about 15 x 17, rats, pigeons, hens, ducks and rabbits
10 to 15, pack knights, orcs, pigs and rams 16 to 30, humans about 30, bosses 20 to 34. Dungeon tiles
are 16 x 16 (96 screen px).

## One grid

Every pixel in the battle canvas sits on one 6 x 6 screen-pixel grid that starts at the canvas's
top-left corner: each 6 x 6 block is one flat color (1080 x 960 is 180 x 160 of them). That is
guaranteed by how the battle is built, in two layers:

1. **A camera post-pass** (`src/render/gridSnap.ts`, WebGL). It samples only the center texel of
   each block, so anything that reaches the frame off the grid (the swinging weapon, a sub-pixel
   position, a stray alpha edge) lands on it as whole art pixels. Blocks are counted from the top
   even though the WebGL framebuffer's origin is its bottom-left corner. (Phaser's Pixelate FX blends
   neighboring blocks' corners, so it can't do this.) The canvas renderer runs without it.
2. **Everything is drawn on the grid in the first place**, so the snap never has to mangle anything:
   - **Text** is the bitmap font in `src/render/pixel/font.ts`: a 5 x 7 face (damage and heal
     numbers, the boss's name and HP, notices, the world title's kicker), a bold 7 x 9 face with
     two-pixel stems (banners, stamps, crit and level-up numbers, the world's name) and a 3 x 5 face
     for fine print (too small to read at a glance at 6 px). Text has a 1 art pixel outline in the ink
     and fill colors per row (a lighter top row, stepped gradients). Long lines wrap, evenly; a
     kicker line can be set in a smaller face over the rest (`TextStyle.lead`: "WORLD 1" over
     "SUNNY SUBURBS"). No vector fonts and no `this.add.text` in the battle.
   - **Pops** move and flash in whole art pixels: numbers flash white and float up a pixel at a
     time, stamps slam down and shake a pixel, banners slide in snapped positions. Fades step.
   - **Particles** (`src/render/pixelBits.ts`) are 1 x 1 and 2 x 2 art-pixel bits that step through
     sizes, colors and opacities; confetti tumbles by turning between 2 x 1 and 1 x 2. Their speeds
     are in art pixels, so bursts keep their size next to the fighters.
   - **HP bars** are 5 rows tall (the boss's 7), with a 7 x 7 heart at the hero's and an 11 x 11
     skull at the boss's.
   - **Shadows** are flat pixel ellipses two rows tall; the Legendary **aura** is three flat rings of
     the rarity's color that breathe a pixel at a time, with glints rising from it.
   - **Lines** (chain lightning) are 1-pixel lines on the grid (`linePixels` in `buf.ts`) with an
     ink edge.
   - **Layers** scroll in whole art pixels, parallax included, drawn as copies of their tile side by
     side (Phaser's TileSprite resamples textures whose size isn't a power of two). Sprites' origins
     are corners of art pixels; the hero's rig sits half a pixel over to match his sheet's
     mid-column origin.
   - **The screen shake** moves the camera by whole art pixels; the sky, layers and vignette reach
     `VIEW_MARGIN` pixels past the edges so it never shows one.
   - The camera's origin is its top-left corner: with the default (its middle) the odd height puts
     everything half a pixel off.
   - Even a quarter-turn tumble is exact; only free rotation (the weapon) relies on the post-pass.

Check it: load the dev build with `?nosnap` to turn the post-pass off and count the 6 x 6 blocks of a
battle screenshot that are not one flat color. With the pass, the count is 0; without it, only the
swinging weapon's blocks show up.

## One pixel size in the UI

The UI uses the battle's pixel size too: every picture is drawn at exactly `UI_PX` = 6 stage px per
image pixel (`src/render/icons.ts`), never resized by layout, rotated or scaled by a fraction.

- Draw pictures with `<PixelArt art={...} />` (`src/ui/components/PixelArt.tsx`); `icons.ts` makes the
  art (one image pixel per art pixel) and knows its size. Finer pixels make pictures better, not
  smaller: big spots show more art pixels, never a blow-up.
- Item icons and luck tokens are 16 x 16. `itemArt(id, scale)` gives them at three resolutions, all
  at 6 px per image pixel:
  - 1, as drawn (96 px): grids and strips (bag, equipped gear, the Roll tab's reels, Codex, unlock
    strips, the drag ghost; `ItemIcon` tiles are 108 px, the bag is eight across);
  - 2, Scale2x (32 x 32, 192 px, `itemArtHd`): showcase spots (the last roll, the item popup, the
    Watch tab's reels while up to four fit across);
  - 3, Scale3x (48 x 48, 288 px, `itemArtX3`, `scale3x` in `buf.ts`): the full-screen rare-roll
    reveal.
  `PixelArt` marks a Scale2x or Scale3x picture `data-px="2"` or `"3"`.
- UI icons come in drawn sizes, not scaled ones (`src/render/pixel/ui.ts`): `xs` about 5 x 5 (tiny
  badges on item tiles), `sm` about 7 x 7 (next to text, the default), `md` about 10 x 10 (HUD,
  headers, map hexes), `nav` the 16 x 16 originals (nav bar, big spots) and `lg` their Scale2x
  versions (32 x 32, the haul's coin). An icon missing at a size falls back to the nearest drawn one.
  Scale2x suits round art (coins, gems, clovers); on straight edges it is just a 2x blow-up, so
  square icons go no bigger than `nav`.
- CSS borders, notched corners, drop shadows and button bands are whole multiples of `--px` (6px).
  Layout sizes around text (plates, chips, buttons) keep their stage size in more art pixels. Pops on
  pictures are flashes or whole-pixel moves; only text may scale.
- Text stays Pixelify Sans at readable sizes (a font at the art's pixel size would be enormous).
- Check it: every visible `<img>` shows each image pixel as 6 x 6 screen px at DPR 1 (12 or 18 per
  block only where a Scale2x or Scale3x picture came out as plain blocks), and nothing above it
  rotates, skews or scales except the stage's own fit.

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

## The street

The street (`src/render/pixel/scenery.ts`, its layers in `src/render/pixel/street/`) is the backdrop
of every world but the dungeon and the farm; each world grades it with its own hue and light, so its
colors stay natural and its windows and lamps are light spots. It is drawn for the 6 px grid in
`SCENE_FRAME` (123 rows, the fighters' feet on row 100): 1.5 times the resolution of the first street,
in the same composition, so the houses are as big on screen with finer detail. Every layer is
`TILE_W` = 342 wide and wraps: sprites go down with `wrapX`, and noise cells and texture runs repeat
with the tile. Rows below are frame rows.

- **far** (39 to 88, `street/far.ts`): a far range, a misty ridge, back hills of fields and hedgerows
  with the town (gabled roofs, a church spire, a water tower on its legs), near hills with plowed rows,
  wheat, an orchard and a farm, then the tree line on the meadow (row 72). Nothing is inked; each depth
  band is hazed toward the horizon sky.
- **mid** (30 to 89, `street/mid.ts`): the houses stand on the house line (row 78), their front yards
  run to row 85. Houses are sketched on a grid of palette keys: shingles in two-row courses with
  staggered keyways, clapboard in three-row boards with staggered butt joints, board and batten, brick
  in three-row courses; windows (heads, sills, shutters, curtains, shades), doors, transoms, gutters
  and downspouts are stamped or drawn in. Crowns are round clumps shaded in leaf clusters (five tones).
  Nothing in a yard may cover window glass: lit glass glows over whatever covers it.
- **ground** (57 to 122, `street/ground.ts`): two lamps on the lawn edge (86 and 87), the curb (88 to
  92) with a drain and a painted stretch, the sidewalk (93 to 107, joints slanting a pixel every five
  rows), its lit front edge and face (108, 109), then the verge (110 to 122). Rows 97 to 104 around the
  feet stay plain slab and joints, so fighters and their shadows read.
- **fg** (109 to 122): tufts, flowers and pebbles, outlined in a near-black green.

World props stand at `MID_PROP_SPOTS` (feet on row 83, four spots in the side yards and on the
driveway, a prop apart). `tests/street.test.ts` checks the frame, the seams, the plain rows around the
feet, uncovered window glass and the prop spots. Preview the layers and the composite:

```bash
npx tsx tools/pixelSheet.ts scenery /path/to/street.png --scale 4
```

## The farm

The farm (`src/render/pixel/farm.ts`, `FARM`) is World 5's backdrop, "Funky Farmland", a harvest farm
in golden late-afternoon light. It keeps its own colors (not graded) and inks in a warm dark brown
(`#2c1b1e`, like the animals). Like the street it is drawn for `SCENE_FRAME`, at 1.5 times the first
farm's resolution in the same composition; every layer is `TILE_W` = 390 wide and wraps. Rows below
are frame rows.

- **far** (32 to 80): a range, a misty ridge, then hills of patchwork fields between hedgerows
  (furrows and sown rows in three tones, mown stripes, round bales, stooks, an orchard), a tower
  windmill, the far farmstead (its windows light up), a pond and autumn trees. Nothing is inked. The
  windmill's sails are red-brown sailcloth: pale sails vanish into the golden sky.
- **mid** (2 to 89): the yard's far edge is row 75, where World 5's horizon (legacy row 50) lands;
  buildings stand on row 81. The barn is sketched on a grid of keys: board and batten (lit battens,
  weathered boards, grain), the gambrel's slate edge over white trim, a louvered cupola and a rooster
  vane, the open loft with its hay and doors swung back, X-braced doors, the lamp, fieldstones. Then the
  banded, domed silo, the pumpkin patch (ribs follow each pumpkin's curve into the stem), the scarecrow
  and his crow, a wheelbarrow of pumpkins, the coop with a hen at its door, the maple and round bales
  by the fence, the windpump and its trough.
- **ground** (78 to 122): the far verge with wildflowers, the dirt road (93 to 108), the near verge
  and the wheat field's edge. Rows 100 to 105 under the feet are plain dirt in two tones.
- **fg** (109 to 122): tufts, flowers and wheat stalks.

`tests/farm.test.ts` checks the frame, the solid rows from the road down, the calm rows, the yard on
the horizon and the light spots. Preview the layers, then World 5 lit:

```bash
npx tsx tools/pixelSheet.ts farm /path/to/farm.png --scale 4
npx tsx tools/worldPreview.ts /path/to/w5.png --worlds 5 --scale 6
```

## Pack art (sheets with their own palette)

Art from asset packs keeps its own colors. `src/render/pixel/indexed.ts` defines `AnimSheet`: a
per-sheet palette, frames as rows of index characters (`KEYS`, `.` transparent), one anchor (feet
for characters, center for effects) and named animations that list frame indexes. Sheets are
generated, never hand-edited, by the scripts in `tools/packs/` (Python with Pillow; run them with
`python3 -I`, and treat pack folders as data):

```bash
python3 -I tools/packs/chars.py raccoon art-src/raccoon_sheet.png src/render/pixel/packs/raccoon.ts
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
npx tsx tools/animSheet.ts packs/farm /path/to/farm.png --scale 6
```

Licenses and the in-game credit line: `CREDITS.md`.

## The hero

The hero is Kevin's raccoon sheet (`art-src/raccoon_sheet.png`, 6 x 6 frames of 24 x 24): idle,
look-around, cheer, dash, sit, lie down, sleep and wake. `src/render/pixel/hero.ts` dresses it in
worn gear drawn for his shape (next section). `composeHero(frame, outfit)` draws the whole outfit
into one buffer for previews.

## Worn gear

Every wearable item has worn art drawn for the raccoon himself, at his pixel size (1 art pixel = 1
battle pixel, never a shrunk icon), in `src/render/pixel/worn/`. Each item is rows of its own palette
keys (`.` clear, `#` the characters' outline `#32282b`), two or three tones lit from the top left as
the sheet is drawn (facing left), in the item's icon colors so it reads as the same thing.

`worn/body.ts` measures his body by hand in every frame: which part each pixel is (head, neck,
torso, front arm and paw, back arm and paw, tail, hips, feet, effects such as the dash's swing
trail) and where his landmarks are (head and eyes relative to frame 0, squashed faces, each paw and
which way its arm points, the feet, the neck). `worn/dress.ts` fits each slot to a frame:

- **Hats** (`hats.ts`) are drawn on frame 0's head and move with it. His ears poke out through them
  (`ears`), or a hat is pulled down over them (the paint bucket). A hat reaches up to row 1 at most:
  his head rises a row in the idle loop.
- **Masks and glasses** (`masks.ts`) are drawn on frame 0's face, anchored on his left eye, and move
  with his eyes; a `squash` variant fits squashed faces (eyes and nose on one row). They're clipped
  to his head; `free` parts (a snorkel's tube) may leave it.
- **Jackets, sweaters, vests and coats** (`jackets.ts`) are painted pixel by pixel over his torso
  and arms (`cut`: jacket, vest or coat), so they wrap every pose. Each pixel's shade comes from the
  shape and his fur's creases; collars, cuffs, hems and details are placed by torso coordinates from
  the neck. Painting `''` leaves his fur (an open jacket shows his light belly). `back` pieces hang
  behind him (the tarp cape). Curled up asleep, a garment covers his back.
- **Gloves** (`gloves.ts`) sit on each paw, drawn for an arm hanging down, reaching out and raised;
  the back paw wears the glove mirrored or its own (`back`: odd mittens, a catcher's mitt).
- **Shoes** (`sneakers.ts`) sit on each foot. Nothing worn goes below the ground row.
- **Bling** (`bling.ts`) hangs at the neck, clipped to his neck and chest; bracelets go on the front
  wrist.
- **Shields** (`shields.ts`) are strapped to his back arm, low at his side so his tail curls up above
  them; `raised` keeps them off his face when the arm is up. Umbrellas are held up like parasols and
  pass behind his head.
- **Packs** (`backpacks.ts`) sit on his back, peeking out over his back shoulder above the curl of
  his tail (hidden wherever his dressed body covers them), straps over his chest.
- **Weapons** (`weapons.ts`) are redrawn at his size on the 45 degree diagonal the scene expects,
  held at `grip` in his front paw; the paw is tracked frame by frame (`handOffsets()`).

In battle (`src/render/textures.ts`) clothes, gloves, shoes and bling are painted into the body
frames (`heroTex`); hats, masks, shields and packs are their own sprites, repainted for each frame
as the scene places them (`gearTex`, `heroFrameOffset`), and the weapon follows the front paw. Keep
the raccoon readable: ears out where a hat allows, eyes visible under everything but masks, the tail
curl free between pack and shield. Every piece must stay inside the 24 x 24 frame in every pose;
`tests/worn.test.ts` checks that, the palettes, and that every item shows wherever its body part
does. To add an item, draw it in its slot's file under the item's id.

Preview every item worn, then sample outfits:

```bash
npx tsx tools/pixelSheet.ts hero /path/to/hero.png --scale 12
```
