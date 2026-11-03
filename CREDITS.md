# Credits and art licenses

The game's art is a mix of art drawn for the game and art from asset packs the owner supplied.
Pack art is copied 1:1 into generated TypeScript modules under `src/render/pixel/packs/` by the
scripts in `tools/packs/`; the raw packs are not in this repository.

The in-game credits line is `settings.credits` in `src/data/strings.en.json` (shown in Settings).

| Art | Where it's used | Source and license |
| --- | --- | --- |
| Raccoon hero sprite sheet (24 x 24, 36 frames) | The hero; recolored with a mohawk for Punk Raccoon enemies | Supplied by Kevin (owner). Source: `art-src/raccoon_sheet.png`. |
| Mucho Pixels, *Character Animation Asset Pack* v1.0 (Male, Character 1, Clothes 3) | Officer Dale (boss), shirt recolored per world | GameDev Market Pro Licence (link in the pack's Readme.pdf: gamedevmarket.net/terms-conditions/#pro-licence). Credit optional. No redistribution of the raw pack. |
| *Tiny RPG Character Asset Pack* v2.0, Free Soldier & Orc | Tin Soldier and Orc Brute (Dungeon Dumps) | **No license file in the download.** Check the terms on the pack's download page before release. |
| 0x72, *16x16 DungeonTileset II* v1.7 | Pumpkin Dude, Plague Doc, Dumpgor the Demon; the Dungeon Dumps backdrop | **No license text in the download** (its README only has tiling notes). The tileset's itch.io page lists it as CC0; confirm there before release. |
| Will Tice / unTied Games, *Super Pixel Effects Gigapack* (Free) v3.2.0 | Battle effects (hit sparks, crit bursts and sprays, explosions, sparkles, lightning, the level-up firework) | Commercial use allowed with credit **"Pixel Art Assets - Will Tice / unTied Games"** (shown in Settings). No standalone redistribution. Not for AI training. |
| *Modern pixel clothes* (FREE) | 21 clothing items (icons recolored to the game palette) | **No license or author in the download.** Check the terms on the pack's download page before release. |
| Pixelify Sans | All UI and battle text | SIL Open Font License, via @fontsource/pixelify-sans. |

Everything else (items, UI icons, the suburban street, rats, pigeons and the two raccoon bosses)
was drawn for the game in `src/render/pixel/`.

Before a public release: confirm the packs marked **No license** above, and whether a public
source repository counts as redistribution under each pack's terms (keep this repository private
until then).
