# Dumpster Legend: Art Direction

2026-11-02 · KEvin

> Saved from Kevin's Claude Doc "Dumpster Legend: Art Direction" (https://claude.ai/artifact/A3NX5C3aFmVYTky4aTid5r).
> The doc is the source of truth; this copy keeps it next to the code. See "Status in the build" at the end.


Dumpster Legend looks like a Saturday-morning cartoon set in a neon alley at 2 AM: grimy but cozy, chaotic but readable, and funny in every frame. The one-line brief for anyone making art is "make garbage look gorgeous."

## The vibe

- **Mood words.** Grimy-cute, cozy chaos, trash glam.
- **Shapes and comedy.** Saturday-morning cartoons: big heads, rubbery motion, faces that react to everything.
- **Atmosphere.** Lo-fi city nights: wet asphalt, neon reflections, steam vents, warm light from upstairs windows.
- **UI and texture.** Street sticker culture: cardboard, masking tape, spray paint, bottle caps.
- **Readability.** Top mobile hits like Brawl Stars and Clash Royale: chunky shapes and thick outlines that read on a small screen.
- **Sound of the look.** If the visuals had a soundtrack, it would be lo-fi hip-hop with a little jazz.
- **Gross is a seasoning, not the meal.** Stink lines and fun mess are fine. No realistic rot, no bugs on food, no bodily fluids.

## Visual pillars

Every asset, from a bottle cap to a boss, has to pass these five rules.

1. **Reads at thumb size.** Every character and item is identifiable as a solid black silhouette at 64 pixels.
2. **Trash glam.** Junk is drawn with care and shine, so a soda-can helmet looks like a crown.
3. **Night and neon.** Dark, cool backgrounds make warm loot and rarity glows the brightest things on screen.
4. **Everything has a joke.** Props, signs and item details hide small gags for players who look closely.
5. **Motion is the reward.** Things bounce, wobble and glint. Nothing on screen sits perfectly still.

## At a glance

```text
Main alley screen, portrait (from the doc's "At a glance" mockup):
+----------------------+
| Top bar              |  Cardboard strip held on with tape at the corners.
|                      |  Coins and gems in the chunky outlined display font.
+----------------------+
| Battle panel         |  Night alley in 4 parallax layers: moon, skyline, neon.
|  raccoon  OPEN 24/7  |  Raccoon walks in from the left, enemies from the right.
|    ->        <- rats |
+----------------------+
| Dumpster panel  DIVE |  The big green dumpster: the largest, brightest button.  <- the only accent
|                      |  Its lid rattles and glows in the rolled rarity color.
+----------------------+
| Gear grid  [][][][][]|  10 slots in rarity-shaped frames on cardboard.
|            [][][][][]|  Rare icons glint every 3 seconds.
+----------------------+
| Bottom nav (o)(o)(o) |  Five bottle-cap buttons: Alley, Heists, City, Crew, Shop.
|                      |  Badges for new stuff are crooked stickers.
+----------------------+
```

The dumpster is the only accent on the main screen. Everything else stays dark and quiet so loot and rarity glows pop.

## Color

The world is painted in cool, dark night tones so that loot, neon and rarity glows are always the brightest things on screen.

| Role | Color | Hex | Used for |
|---|---|---|---|
| Night sky | Deep indigo | #1B1E3C | Sky, far skyline |
| Shadow | Ink navy | #12142A | Darkest shadows, UI backdrops |
| Walls | Dusty plum | #4A3A5C | Brick, buildings |
| Ground | Wet slate | #2E3A4A | Asphalt, sidewalks |
| Dumpster | Dumpster green | #2F6B4F | The dumpster, bins |
| Raccoon fur | Warm gray | #8C8C99 | Body |
| Raccoon mask | Charcoal | #2A2A33 | Mask, tail rings |
| Raccoon belly | Cream | #E8E0D0 | Belly, muzzle |
| Window light | Amber | #FFB347 | Windows, lamps, warm rim light |
| Neon 1 | Hot pink | #FF3EA5 | Signs, highlights |
| Neon 2 | Electric cyan | #2EE6FF | Signs, cool rim light |
| Neon 3 | Acid lime | #B6FF3B | Go buttons, success states |
| Cardboard | Kraft brown | #C49A6C | UI panels |
| Tape | Masking cream | #F2E6C9 | UI tape, labels |
| Outline | Night purple | #1A1022 | Every outline (never pure black) |

Rarity colors and frames (the frame shape also signals rarity, so colorblind players can read it):

| Rarity | Hex | Frame |
|---|---|---|
| Junk | #9E9E9E | Plain square, a little dented |
| Decent | #4CAF50 | Square with 1 gem |
| Shiny | #2196F3 | Square with 2 gems |
| Epic | #9C27B0 | 3 gems and ornate corners |
| Legendary | #FFB300 | Gold frame topped with a bottle-cap crown |
| Mythic | Rainbow gradient | Winged frame |
| Mint in Box | #FFF4D6 with gold sparkle | Frame shaped like a toy package with a price tag |

- **Brightness ladder.** Backgrounds stay in the darkest 40% of brightness, characters sit in the middle, loot and effects are the brightest.
- **Saturation budget.** Only neon and rarity colors are fully saturated. Everything else is slightly muted.
- **Neighborhood tints.** Suburbs lean warm plum dusk, the Strip Mall leans teal and hot pink, Downtown leans steel blue with gold windows.

## The cast

The raccoon is a chunky, big-headed underdog with huge expressive eyes and a body built to wear junk. Everyone else is drawn around one exaggerated trait.

### The raccoon

- **Proportions.** 2.5 heads tall. The head is 40% of total height, hands are oversized for holding weapons, legs are short and stubby.
- **Shape language.** A round, soft body reads as lovable; pointed ears and a pointed tail tip add mischief.
- **Face.** The black mask frames big white eyes with small pupils. Eyebrows sit on the mask and do most of the acting. A buck-toothed grin.
- **Tail.** Huge and ringed, and an expression tool: it wags when happy, puffs up when scared, curls when proud.
- **Gear fit.** Items are drawn about 1.3x real scale so they read, and they break the silhouette on purpose (a traffic cone towers above the head).
- **Expression sheet.** Happy, smug, shocked, happy-crying, angry, scared, sleepy, sneaky, sulky, starstruck.

### Crew

- **Pigeon Gary.** Huge puffed chest, tiny head, a blank stare that never changes.
- **Possum.** Dramatic and theatrical; faints at the slightest surprise.
- **Goose.** Long neck, menacing posture, always mid-honk.
- **Ibis, the "Bin Chicken".** Long curved beak, regal and smug.
- **Opossum Queen.** A tiara made of bottle caps and a cape made from a takeout menu.

### Enemies

- **Rats.** Triangles and points, which read as threats. Beady red eyes.
- **Animal control officers.** Blocky rectangles, oversized uniforms, nets and clipboards.
- **Seagulls.** Sharp angles, loud open beaks, always stealing something.
- **Rival raccoon gangs.** The player's raccoon with gang colors, bandanas and attitude.

### Bosses

Bosses are 3x the raccoon's size and carry one oversized signature prop.

- **Big Earl the Rat King.** A crown cut from a tin-can lid and a cape made from a pizza box.
- **Chef Tony.** A giant rolling pin and clouds of flour with every swing.
- **Mall Cop Doug.** A Segway, mirrored sunglasses and a whistle.
- **The Concierge.** White gloves, a polished brass bell and perfect posture.

## Environments

Each neighborhood is one long side-scrolling alley at night, built from four layers that move at different speeds to create depth.

| Layer | Scroll speed | Contents |
|---|---|---|
| Far | 0.2x | Skyline silhouettes, the moon, a scatter of lit windows |
| Mid | 0.5x | Buildings, fire escapes, neon signs, water towers |
| Ground | 1x | Alley floor, dumpsters, puddles, the action |
| Foreground | 1.3x | Hanging wires, steam, drifting paper, semi-transparent |

| Neighborhood | Mood | Key colors | Signature props |
|---|---|---|---|
| Suburbs | Cozy dusk, porch lights | Plum and amber | Picket fences, recycling bins, lawn gnomes, sprinklers, an abandoned lemonade stand |
| Strip Mall | Buzzing late-night neon | Teal and hot pink | Pizza boxes, shopping carts, an arcade cabinet, a flickering "OPEN 24/7" sign |
| Downtown | Cold steel, big money | Steel blue and gold | Office towers, steam vents, taxis, billboards with joke ads |

### Heist locations

Heists move indoors with warmer light, so they feel like a different, riskier world.

- **The Pizza Place.** Red-and-white checkered floor, glowing pizza ovens, flour dust in the air.
- **Mall Food Court.** Harsh fluorescent light, plastic plants, a wet-floor sign that never goes away.
- **Five-Star Hotel.** Gold, velvet and marble, with a raccoon-sized trail of muddy footprints across it.

### Atmosphere

- **Wet ground.** Puddles reflect neon signs with flipped, faded, gently wobbling copies.
- **Living details.** Moths circle lamps, steam drifts from vents, neon signs flicker, and one letter on every sign is always broken.
- **Weather.** Occasional light rain with streaks in the foreground layer and ripples in puddles.
- **Joke signage.** Shop names, posters and billboards carry gags, like "FREE TRASH (please take it)" or a "Raccoon-Proof Bins" ad covered in paw prints.

## Items and icons

Items are instantly recognizable real-world junk, drawn chunky and clean, and the same item visibly levels up in shine as its rarity climbs.

| Rarity | How the item looks |
|---|---|
| Junk | Dented, dull, stained, patched with tape |
| Decent | Clean and intact |
| Shiny | Polished, with crisp highlights |
| Epic | Glowing purple trim or etched runes |
| Legendary | Gold accents, a soft aura, sparkles drifting off it |
| Mythic | An animated rainbow sheen that rolls across the surface |
| Mint in Box | Still sealed in toy packaging, complete with a price sticker |

- **Icon framing.** 256 x 256 canvas, the item fills about 80%, slight three-quarter angle, light from the top left.
- **Materials.** Plastic gets soft highlights, metal gets a sharp highlight streak, glass gets a rim light and transparency, cardboard stays matte with corrugated edges.
- **Food.** Glossy and appetizing, never rotten. A pizza slice should look like you would eat it.
- **Icon matches the wearable.** Every item has an inventory icon and an equipped overlay on the raccoon. Both must clearly be the same object.
- **Silly scale.** Weapons and hats can be comically oversized. A fork spear is taller than the raccoon.

## UI style

The UI is built from the same junk as the world: cardboard panels, masking tape, bottle-cap buttons and spray-painted labels.

- **Panels.** Kraft cardboard texture with slightly torn edges, held on by strips of tape at the corners.
- **Buttons.** Chunky and 3D with a heavy drop shadow underneath. Acid lime for "go" actions, gold for purchases, gray for secondary. They squash when pressed.
- **Touch targets.** At least 44 points tall, with the main dumpster button far bigger than anything else.
- **Display font.** A chunky rounded font such as Lilita One or Luckiest Guy (free on Google Fonts) for titles and numbers, with a thick outline and drop shadow.
- **Body font.** A clean rounded font such as Nunito for descriptions and settings.
- **Labels.** Section headers look spray-painted or hand-written on tape.
- **Notification badges.** Round stickers that look slapped on, slightly crooked.
- **Transitions.** Screens slide in like box flaps opening.

| Currency | Icon |
|---|---|
| Coins | Gold coins stamped with a raccoon face |
| Gems | Chunks of colorful sea glass |
| Trash Bags | A black bag with a gold twist tie |
| Heist Tickets | A crumpled ticket stub |
| Crew Tickets | A dog-eared trading card |
| Ride Parts | A bolt and a gear |
| Shiny Fragments | A sparkle shard |

## Animation style

Characters move with snappy cartoon timing: a quick wind-up, a faster action, and a bouncy settle.

- **Rigging.** Characters use 2D skeletal animation (Spine or a free alternative), so gear overlays follow the bones automatically. Special effects can be frame-by-frame.
- **Attack timing.** About 100 ms wind-up, 33 ms strike, 150 ms bouncy follow-through.
- **Squash and stretch.** Landings squash 20%, jumps stretch 15%, hits compress the target before it flies back.
- **Walk cycle.** Bouncy and slightly pigeon-toed, with the tail swinging opposite the hips.
- **Idle loops.** 2 to 4 seconds each, with at least 3 variants: sniffing the air, scratching an ear, admiring new gear, flicking the tail.
- **Rare idles.** Small surprises every few minutes, like the raccoon "washing" a snack in a puddle or juggling bottle caps.
- **Hit reactions.** Enemies flash white for one frame, squash, and get knocked back about 20 pixels.
- **Deaths.** Enemies spin off screen or pop into loot. Never a lingering body.
- **UI motion.** Things appear with a 10% overshoot and leave with a quick ease-in. Most UI moves take 150 to 300 ms.
- **Camera.** A gentle follow, a quick zoom punch on crits and boss hits, and a slow push-in during big reveals.

## Effects and particles

One rule runs every effect: the rarer or stronger the moment, the more particles, the brighter the glow and the longer it lasts.

| Effect | Particles | Look | Duration |
|---|---|---|---|
| Hit spark | 4 to 6 | White star shards | 0.15 s |
| Crit | 10 to 14, plus a ring | Yellow shards, an expanding ring, a "CRIT" stamp | 0.3 s |
| Burn | About 3 per second | Orange embers rising, a flickering tint on the enemy | While burning |
| Stun | 3 orbiting | Bottle caps spinning around the enemy's head | 1 s |
| Enemy pop | 12 to 20 | Trash confetti, a smoke puff, coins | 0.5 s |
| Coin pickup | 1 per coin | A spinning coin arcs to the counter and sparkles on arrival | 0.4 to 0.6 s |
| Trash Bag drop | 1 | The bag bounces twice and its gold tie glints | 0.5 s |
| Level-up | 30, plus a ring | A gold shockwave ring and rising light motes | 1 s |
| Junk dive | 6 | A gray dust puff and wavy green stink lines | 0.3 s |
| Shiny dive | 12 | Blue sparkle stars | 0.5 s |
| Epic dive | 30 | A purple burst with a swirl | 1 s |
| Legendary dive | 80, plus light rays | Gold coins, rotating god rays, trash confetti | 2.5 s |
| Mythic dive | 120, plus light rays | Rainbow prisms and a rainbow screen border | 3.5 s |
| Shine sweep | 1 sprite | A diagonal white gradient across rare icons | 0.6 s, every 3 s |
| Holo foil | Shader | A rainbow gradient that shifts as the phone tilts | Always on |
| Trash Frenzy | About 40 per second | Rainbow border, speed lines, sparkles | 15 s |
| Sugar Rush | Afterimages | 3 colored ghost copies trailing the raccoon | 30 min buff |
| Golden Dumpster | 20 | Rising gold motes and a pulsing aura | While on screen |
| Ambient | 5 to 10 | Moths, steam, drifting paper, raindrops | Always on |

- **Particle library.** Stars, dots, square confetti, coins, prisms, smoke puffs, embers, stink lines, and trash bits: banana peels, bottle caps, crumpled paper, pizza crusts.
- **Blend modes.** Light-based effects (sparks, glows, rays) use additive blending; physical bits (confetti, trash, coins) use normal blending.
- **Physics feel.** Confetti flutters, coins bounce and spin, smoke rises and fades. Nothing just vanishes.
- **Budget.** Pool and reuse particles, and cap the screen at 300 at once.

## Lighting and post-processing

Lighting does most of the mood work, but on phones it has to be faked with cheap sprite tricks instead of expensive real-time effects.

- **Baked glows.** Soft radial gradient sprites behind neon signs, lamps and rare items, using additive blending.
- **Rim light.** Characters get a cyan rim on the side facing neon and an amber rim on the side facing windows. It separates them from dark backgrounds.
- **Vignette.** Always slightly darkened screen edges, pulled tighter during big reveals.
- **Neighborhood grading.** One color overlay per neighborhood (plum, teal-pink or steel blue) ties every layer together.
- **Reflections.** Puddles show flipped, faded, wobbling copies of the neon above.
- **Flicker.** Neon signs flicker on random timers.
- **Screen flash.** A white overlay for 1 to 2 frames on Legendary-plus reveals, never longer.
- **Real bloom only on strong phones.** Use true bloom on high-end devices and baked glow sprites everywhere else.
- **Respect settings.** Reduce-motion and reduce-flashing options turn off shake, flashes and heavy effects.

## Production specs

These specs keep every asset consistent and the game smooth on mid-range phones.

| Asset | Source size | Notes |
|---|---|---|
| Screen | 1080 x 1920 logical | Portrait, respect safe areas |
| Raccoon and Crew | 512 px tall | Skeletal rig, exported at 1x and 2x |
| Enemies | 384 px tall | Bosses at 1,152 px tall (3x the raccoon) |
| Item icons | 256 x 256 | Shown at about 96 to 128 px |
| Gear overlays | Matched to the raccoon rig | One per visible slot per item |
| Background layers | 2,048 px wide segments | Must tile seamlessly left to right |
| Particle textures | 64 x 64 | White sprites, tinted in the engine |

- **Outlines.** Night purple #1A1022, about 4% of the asset's height. Never pure black.
- **Light direction.** Always from the top left.
- **Atlases.** Pack sprites into atlases no larger than 2,048 x 2,048. PNG for source files, WebP for builds where supported.
- **Naming.** category_name_variant, for example hat_traffic_cone_icon.png and hat_traffic_cone_overlay.png.
- **Performance.** 60 fps on a mid-range Android phone, no more than 300 particles on screen, and texture memory kept under 200 MB.

## AI art prompt kit

If assets are generated with AI tools, one fixed base prompt plus a strict review checklist keeps 200+ items looking like one game.

Base style (start every prompt with this):

```text
2D mobile game asset, cartoon style, chunky rounded shapes, thick dark purple outlines, flat colors with one soft highlight, light from the top left, playful and slightly grimy, night-time palette, high readability at small sizes, clean isolated background
```

Item icon:

```text
[BASE STYLE], item icon of a [ITEM], [RARITY LOOK], three-quarter view, centered, transparent background
```

Rarity looks to paste in: Junk "dented, dull, patched with tape"; Epic "glowing purple trim"; Legendary "gold accents, soft golden aura, sparkles"; Mint in Box "sealed inside retro toy packaging with a price sticker".

Character sheet:

```text
[BASE STYLE], character sheet of a chubby raccoon with a black eye mask and a big ringed tail, huge expressive eyes, 2.5 heads tall, big hands, short legs, front view and side view, neutral pose
```

Background layer:

```text
[BASE STYLE], side-scrolling background layer, [NEIGHBORHOOD] alley at night, neon signs, wet asphalt with reflections, no characters, seamless horizontal tiling
```

Avoid list (add to every prompt): photorealism, painterly textures, heavy gradients, text or letters, logos, watermarks, gore, extra limbs.

### Review checklist for every generated asset

- [ ] Passes the 64-pixel black silhouette test
- [ ] Outline color and thickness match the spec
- [ ] Light comes from the top left
- [ ] Colors sampled from the asset match the palette
- [ ] No accidental text, logos or brand shapes
- [ ] Does not resemble any existing character or product
- [ ] Raccoon proportions match the character sheet

---

## Status in the build

Milestone 1 uses code-drawn placeholder art that follows this doc, so real art can drop in through `src/data/assets.json` later:

- **Palette** lives in `assets.json` (`placeholders.palette`) and is injected into CSS variables at boot. Outlines use night purple `#1A1022`, never pure black.
- **Raccoon**: 2.5 heads tall, big eyes with small pupils, eyebrows on the mask, buck-toothed grin, pointed ears, huge ringed tail, oversized hands, cyan rim light on the neon side and amber on the window side. Gear overlays are drawn at about 1.3x and break the silhouette (the cone towers above the head).
- **Enemies**: rats are triangles with beady red eyes, pigeons have a puffed chest and a blank stare, rival raccoons wear gang bandanas. Big Earl has a tin-can-lid crown and pizza-box cape, Vinnie carries two trash-can lids, Officer Dale is blocky with a catch pole and clipboard.
- **Environment**: 4 parallax layers at 0.2x / 0.5x / 1x / 1.3x (moon and skyline, Suburbs houses with porch lights and picket fence, wet asphalt with neon puddles and props, foreground wires with hanging sneakers and steam), a plum neighborhood grade, a soft vignette, and a "FREE TRASH (please take it)" neon sign with one flickering broken letter.
- **Animation**: 100 ms wind-up / 33 ms strike / 150 ms bouncy settle, enemies flash white for one frame, squash and get knocked back about 20 px, deaths spin off screen, idle breathing on everything.
- **Effects**: hit sparks (5), crits (12 shards, ring, CRIT stamp), enemy pop (trash confetti, smoke, coins arcing to the counter), bag drops that bounce twice and fly to the dumpster, a level-up gold shockwave with rising motes, per-rarity dive bursts (Junk 6 with stink lines up to Mythic 120). Particles are pooled and capped under 300.
- **UI**: Lilita One (display, outlined) and Nunito (body), bundled locally. Cardboard and masking-tape panels (the main screen uses dark cardboard so the dumpster stays the only accent), acid-lime go buttons, gold purchase buttons, gray secondary buttons, bottle-cap nav with crooked SOON stickers, tape-strip toasts.
- **Rarity frames** signal rarity by shape: dented Junk with a tape patch, 1/2/3 gems for Decent/Shiny/Epic, ornate Epic corners, a bottle-cap crown for Legendary, wings for Mythic, a toy package with hang tab and price tag for Mint in Box. Epic and up get the 3-second glint.
- **Currency icons**: raccoon-stamped gold coin, sea-glass gem, black trash bag with a gold twist tie.
- **Settings**: Reduce Motion turns off shake, zoom punch and knockback; Reduce Flashing turns off hit flashes and the 1 to 2 frame Legendary screen flash.

Not yet (later milestones): skeletal rigs, expression sheet, idle variants and rare idles, puddle reflections that wobble, moths and rain, holo foil, real bloom, Heist interiors, cardboard torn edges.

## Style update (Nov 2): painterly storybook

Kevin's newer direction for the look, used as the base style from here on (and as the base prompt for any AI-generated assets):

```text
hand-drawn 2D game art, hand-inked outlines with varied line weight in dark plum (not black), gouache and watercolor brush textures, visible paper grain, painterly shading with soft and hard edges, cozy night lighting with warm lamp glow and pink and cyan neon, storybook illustration quality, slightly imperfect handmade lines
```

How the code-drawn placeholders follow it (`src/render/paint/`):

- **Ink**: dark plum `#3E1F42` lines whose width follows a pressure curve, with tapered ends, a slight wobble, a sketchy overshoot where a shape closes, and a faint second pass. UI outlines use the same plum.
- **Paint**: gouache/watercolor fills with a bleed halo, uneven pigment blooms, granulation, and a darker wet edge.
- **Shading**: a hard-edged shadow crescent away from the light plus a soft warm pool of lamp light from the top left; shadows lean plum.
- **Light**: cyan neon rim light on the raccoon, pink on its foes, amber rim from the windows; porch lamps, lit windows and puddle reflections glow.
- **Paper**: grain over the battle canvas and over the whole UI.
- **Everything painted**: raccoon, enemies and bosses, gear overlays and gear-grid icons (with rarity treatments), empty-slot silhouettes, sky and moon, skyline, houses, props, wet asphalt, foreground wires and steam, the dumpster.
