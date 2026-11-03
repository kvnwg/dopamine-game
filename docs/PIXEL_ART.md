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

Every pixel in the battle is the same size: `P = 9` screen pixels per art pixel
(`src/render/pixel/index.ts`), so the 1080 x 963 view is 120 x 107 art pixels
(`src/render/pixel/sceneryTypes.ts`: `VIEW`). Nothing in battle is scaled or squashed: sprites move
and change frames, and only the weapon's swing rotates freely. Art drawn for a finer grid is either
redrawn (the street, rats, pigeons, raccoon bosses) or shown at half resolution with `downsample2`
(the older still effects, the icon-pack props).

**The scene frame.** Every scenery set is drawn for an 82-row scene (`SCENE_H`) with the fighters'
feet on row 67 (`SCENE_FEET_ROW`). The battle shows that frame `SCENE_Y` = 25 rows down the view, so
the fighters stand on view row 92 (`FEET_ROW`, the ground line at y 837). Layer spots
(`ScenerySet.layers`), light spots and the rows in each scenery module are scene rows; add `SCENE_Y`
for view rows (`layerRow` in `src/render/worldLook.ts`). The 25 rows above the scene are more sky
for sets with a sky; the dungeon draws its far layer up into them (a vault and hanging chains).
A world's `look.atmo` (horizon, sun or moon, clouds) is also given in scene rows; `viewAtmo` shifts
it when the world is composed. Particle bands in `src/render/ambience.ts` are view rows.

Size guide at this scale: the raccoon hero is about 15 x 17, rats, pigeons, hens, ducks and rabbits
10 to 15, pack knights, orcs, pigs and rams 16 to 30, humans about 30, bosses 20 to 34.

## One grid

Every pixel in the battle canvas sits on one 9 x 9 screen-pixel grid that starts at the canvas's
top-left corner: each 9 x 9 block is one flat color. That is guaranteed by how the battle is built,
in two layers:

1. **A camera post-pass** (`src/render/gridSnap.ts`, WebGL). It samples only the center texel of
   each block, so anything that reaches the frame off the grid (the swinging weapon, a sub-pixel
   position, a stray alpha edge) lands on it as whole art pixels. Blocks are counted from the top
   even though the WebGL framebuffer's origin is its bottom-left corner. (Phaser's Pixelate FX blends
   neighboring blocks' corners, so it can't do this.) The canvas renderer runs without it.
2. **Everything is drawn on the grid in the first place**, so the snap never has to mangle anything:
   - **Text** is the bitmap font in `src/render/pixel/font.ts`: a 3 x 5 face (numbers, the boss's
     name and HP, the world's title, notices) and a 5 x 7 face (banners, stamps, big numbers), with a
     1 art pixel outline in the ink and fill colors per row (a lighter top row, stepped gradients).
     Long lines wrap, evenly. No vector fonts and no `this.add.text` in the battle.
   - **Pops** move and flash in whole art pixels: numbers flash white and float up a pixel at a
     time, stamps slam down and shake a pixel, banners slide in snapped positions. Fades step.
   - **Particles** (`src/render/pixelBits.ts`) are 1 x 1 and 2 x 2 art-pixel bits that step through
     sizes, colors and opacities; confetti tumbles by turning between 2 x 1 and 1 x 2.
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

Check it: load the dev build with `?nosnap` to turn the post-pass off and count the 9 x 9 blocks of a
battle screenshot that are not one flat color. With the pass, the count is 0; without it, only the
swinging weapon's blocks show up.

## One pixel size in the UI

The UI uses the battle's pixel size too: every picture is drawn at exactly `UI_PX` = 9 stage px per
art pixel (`src/render/icons.ts`), never resized by layout, rotated or scaled by a fraction.

- Draw pictures with `<PixelArt art={...} />` (`src/ui/components/PixelArt.tsx`); `icons.ts` makes the
  art (one image pixel per art pixel) and knows its size. Item icons are 16 x 16 (144 px on screen);
  big moments (the rare-roll reveal, the Watch tab) show `itemArtHd`, a Scale2x version (32 x 32 at
  the same 9 px), never a 2x blow-up.
- UI icons come in drawn sizes, not scaled ones: `sm` about 5 x 5 (next to text), `md` about 7 x 7
  (HUD, map hexes), `nav` 10 x 10 (nav bar, headers) and `lg` 16 x 16 (`src/render/pixel/ui.ts`).
  `LUCK_TOKENS` are the reels' clover tokens (16 x 16, x2 to x10).
- CSS borders, notched corners and drop shadows are whole multiples of `--px` (9px). Pops on pictures
  are flashes or whole-pixel moves; only text may scale.
- Text stays Pixelify Sans at readable sizes (a font at the art's pixel size would be enormous).

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
