# Credits and art licenses

The game's art is a mix of art drawn for the game and art from asset packs the owner supplied.
Pack art is copied 1:1 into generated TypeScript modules under `src/render/pixel/packs/` by the
scripts in `tools/packs/`; the raw packs are not in this repository.

The in-game credits line is `settings.credits` in `src/data/strings.en.json` (shown in Settings).

| Art | Where it's used | Source and license |
| --- | --- | --- |
| Raccoon hero sprite sheet (24 x 24, 36 frames) | The hero; recolored with a mohawk for Punk Raccoon enemies | Supplied by Kevin (owner). Source: `art-src/raccoon_sheet.png`. |
| 0x72, *16x16 DungeonTileset II* v1.7 | The Dungeon Dumps backdrop (walls, floor, columns, torches, cobwebs) | **No license text in the download** (its README only has tiling notes). The tileset's itch.io page lists it as CC0; confirm there before release. |
| Will Tice / unTied Games, *Super Pixel Effects Gigapack* (Free) v3.2.0 | Battle effects (hit sparks, crit bursts and sprays, explosions, sparkles, lightning, the level-up firework) | Commercial use allowed with credit **"Pixel Art Assets - Will Tice / unTied Games"** (shown in Settings). No standalone redistribution. Not for AI training. |
| *Modern pixel clothes* (FREE) | 21 clothing items (icons recolored to the game palette) | **No license or author in the download.** Check the terms on the pack's download page before release. |
| Farm animals (four Aseprite files: sheep, pig, cow, chicken / duck / rabbit) | Funky Farmland's enemies: Angry Hen, Quacker, Mad Bunny, Hog Hooligan, Ram Rager and the boss Mega Moo | **No license or author in the download** (just the .aseprite files). Find the source and its terms before release. Generated 1:1 by `tools/packs/farm.py`. |
| *MV Icons Complete Sheet* (Free) | Themed world props (snowmen, presents, candy, jack-o'-lanterns, tombstones, cauldrons, wheat...) | License is a linked Google Doc (EULA) that could not be read here; **confirm the terms before using any icon.** |
| Pixelify Sans | All UI and battle text | SIL Open Font License, via @fontsource/pixelify-sans. |
| Dumpster Digits (`src/assets/fonts/`, made by `tools/fonts/digits.py`) | A clearer 2 and 5 in front of Pixelify Sans | Drawn for the game on Pixelify Sans's grid; distributed under the SIL Open Font License 1.1 like Pixelify Sans. |

Everything else (items, UI icons, the suburban street, the farm backdrop, every enemy except the farm
animals: rats, pigeons, the knight, orc, pumpkin, plague doc, demon, the human bosses, Big Earl and
Vinnie, plus the skies and lighting) was drawn for the game in `src/render/pixel/`.

Before a public release: confirm the packs marked **No license** above, and whether a public
source repository counts as redistribution under each pack's terms (keep this repository private
until then).
