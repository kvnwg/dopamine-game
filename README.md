# Dumpster Legend

Idle RPG roguelite for iOS and Android: a raccoon auto-battles its way through the city's alleys while its dumpster rolls for junk gear on its own, RNG-game style. Every item has a power number and a "1 in X" rarity, and the raccoon visibly wears whatever it equips.

**Status:** Milestones 0 (setup) and 1 (core idle loop) from [`DUMPSTER_LEGEND_SPEC.md`](DUMPSTER_LEGEND_SPEC.md) are built, then reworked into a Roblox-style rolling game: slot reels that roll on their own, luck from several sources (luck tokens on the reels among them), a bag of power-rated items (196 kinds, from traffic cones to lobster claws, each drawn to fit him) you equip by dragging them onto the raccoon, a honeycomb upgrade map, rebirths that unlock more items, enchantments, and 20 worlds of rising difficulty, all open from the start. Everything is pixel art at one pixel size, 6 screen pixels per art pixel, in battle and in the menus alike: the hero is Kevin's raccoon sprite sheet (with gear drawn to fit him), and World 8's dungeon and the farm animals come from asset packs Kevin supplied (credits in [`CREDITS.md`](CREDITS.md)). Every world has its own lit sky and weather (sunsets, night streets with glowing windows and lamps, rain, snow, fireflies). Milestone 2's Heists are built too, as their own tab, opening with the first rebirth. The rework is recorded in [`DECISIONS.md`](DECISIONS.md), newest first.

### How it plays

- **Phone and PC:** one game at one link. On a phone (portrait) the battle sits over the menus. On a wider screen (a PC, a tablet or a phone held sideways) it switches to a landscape layout: the battle on the left, the menus and tabs on the right. With a mouse, the game says "click" instead of "tap", the scroll wheel zooms the upgrade map and scrolls lists, and resting the pointer on a piece of gear shows what it is and what wearing it would change. Keys: 1 to 6 for the tabs, E for Equip best, Esc to close, Enter or Space to press PLAY.
- **Title and first minute:** the logo is hand-lettered: glossy green DUMPSTER letters tossed in a heap, its U a trash can with the raccoon peeking out in a little gold crown, a fish skeleton on the R, gold LEGEND on an arch, all on a die-cut sticker. While the game loads, a loading screen shows it (the raccoon blinking, flies buzzing) over the raccoon walking along his street, with a bar and a joke line ("Bribing the pigeons..."). Then the logo glides into place on the title screen, where it comes alive: letters hopping in a wave, the raccoon glancing about and ducking into his can. PLAY is a chunky red button with a bite out of its corner, its letters waving. Phones stack the logo over PLAY; a PC sets them side by side. A new game starts with almost everything locked and opens on the Worlds tab: first the player picks World 1 and the raccoon starts fighting there (during the tutorial he can't fall in World 1). Then, back on the Roll tab, the dumpster sits padlocked under steel plates (it won't open before a world is picked), and a tap knocks the lock and the metal off and sets it rolling. Then a short tutorial: the dumpster rolls three everyday finds, then the Traffic Cone of Destiny with the full reveal; the Bag opens and a pointing hand leads to Equip best (the reels wait until it's on); about 45 seconds after the padlock comes beginner's luck (a scripted, clearly labeled roll that chains two luck tokens into a Limited Edition hat), put on with Equip best too. That ends it with a celebration and 50 gems (the luck badge and the Codex just appear). After that the rest opens one thing at a time as it becomes useful (Upgrades, the dumpster's own upgrades once you can pay for one, Rebirth, Heists, and with the second rebirth the Perks page), each pointed out with a NEW bubble; locked tabs wear a lock that falls off when they open. The first few levels come quickly. Settings has Start a new game.
- **Roll tab:** the dumpster's reels roll on their own, one item per reel per spin: 2.6 seconds per spin at first, faster with the Spin Speed upgrade. Items scroll down past a gold win line as black silhouettes showing their "1 in X" odds, and the result flashes into color when its reel stops. Now and then a reel lands on a clover **luck token** (×2, ×3, ×5 or ×10) instead: it multiplies that reel's luck and the reel spins again, and tokens can chain (×2 then ×5 is ×10 luck) until it lands an item. Whatever tab you're on, a token chimes, pops out of its reel and slams into its reel's row of tokens near the top of the battle, where the reel's luck so far shows; a chain of x25 guarantees an Epic or better, x50 a Legendary, x250 a Mythic. With several reels, when every reel lands the same token it counts squared on all of them (x5 on every reel is x25 each): the rows turn gold and "MATCH! LUCK SQUARED" pops up. Off the Roll tab, a mini roller under the settings gear keeps showing the reels (one small window each, two to a row), silently: silhouettes flicking past, tokens, and each find landing in its rarity's color. Leaving the Roll tab, the machine shrinks into that corner; tap the mini roller to go back. Trash Bags won in fights become turbo spins (a spin building up to a rare find runs at normal speed and keeps its bag), and every 10th spin is a Lucky Spin. The reels fill the card's width (one reel is a wide drum with big art), bulbs chase around them while they spin, and every landing thuds, with sparks, rays, a stamp or confetti as the rarity climbs. A rare result crawls in while the glow flickers up through the tiers (blue, purple, gold...), never past the real one. The tab shows your luck (tap it for the exact odds) and the last roll with its power change against what you wear. A find that is rare for your current luck (Epic or rarer at low luck, and a "1 in X" of at least 2,500 times your luck; the Luck popup shows the bar) gets a full-screen reveal: a black screen, the item shining, its "1 in X" counting up while the light climbs the tiers.
- **Heist tab:** opens with your first rebirth (until then the tab is locked and says what's coming; tickets still pile up). Spend a ticket (3 a day, up to 6) to rob the Pizza Place, the Mall Food Court or the Five-Star Hotel: 19 stops of fights, elites, choices, treasure, shops, shrines, traps and a prize wheel, then a boss. You level up during the run and pick perks (some merge into evolutions), pick up curses, and get one second chance. Wins pay Trash Bags, gold and gems, and sometimes a heist-only ring. Runs are matched to your raccoon's strength. Shops only show up once you can afford a perk and mostly sell +max HP perks instead of heals, traps have names (a Robot Vacuum with a Grudge, Chef Tony's Rolling Pin), a fight a choice promises brings the enemies it names, and Pigeon Pal's pigeons fly out to peck beside the raccoon.
- **Equipping:** nothing equips itself. Drag an item onto the raccoon (or the gear row) to put it on, or use Equip best; on a phone, just drag it (in a bag long enough to scroll, hold it for a moment first, so a swipe scrolls). Items that beat what you wear get a green ▲, worse ones a red ▼. The item leaps out of its tile, grows, flies over to the raccoon and slams onto him (bigger the rarer it is), the piece glimmers on him, and his power counts up big in the middle of the screen. Worn gear is drawn to fit him: hats around his ears, jackets on his body, weapons in his paw.
- **Bag tab:** your gear (two rows) and the bag, which keeps the best when it fills up. Tap an item to lock or scrap it, Equip best, or Scrap All (locked items are safe); a big haul gets its own moment.
- **Upgrades tab:** opens a full-screen honeycomb map that grows out of Luck I. Every tier is its own hex (Luck I, Luck II, ...): bought hexes are bright, the next ones show their price, and the ones past those are "?" until you get closer. Gold hexes are big specials, including the very expensive Extra Reel line: up to 4 more reels, each one more item per spin. Drag to explore, pinch or scroll to zoom, tap a hex for details, and hold Buy to keep buying up a line (on a PC its card sits in a panel down the right, so the map has the rest of the screen). Each tier costs 100 times the last.
- **Perks (from the second rebirth):** a switch at the top of the Upgrades screen leads to the Perks page. Every world whose boss falls for the first time in a run pays a Half-Eaten Bread Loaf, and loaves buy perks from four trees: The Alley Crew (a pigeon wingman, sewer-rat cousins, Dr. Squeaks, a seagull air strike, a raccoon mafia of beaten foes), Bad Decisions (an expired energy drink, a glass cannon, playing possum, hold my soda, YOLO), Rigged Reels (four-leaf litter, a pawn shop hustle, a bootleg reel, greased gears, a rigged jackpot) and The Bread Cult (sourdough starter, carb loading, bread bait, holy crust, a gluten golem). A root costs 1 loaf, deeper perks up to 4; most trade something away. A rebirth eats every loaf and perk, so each run grows its own combination.
- **Rebirth tab:** beat the required world and hold enough gold to start over from scratch in World 1 (items, level, gold, upgrades, loaves and perks are wiped) with permanently more luck, gold, ATK and HP, and cheaper upgrades. The dumpster starts with 43 items; each rebirth unlocks more (all 196 by Rebirth 5), and the tab shows what the next one adds.
- **Worlds tab:** all 20 worlds, each with its own look, enemies and boss, and every one open from the start. World 5, Funky Farmland, is a farm with angry hens, ducks, bunnies, pigs, a ram and a giant cow; World 8, Dungeon Dumps, is a fantasy dungeon. Each card shows how a world matches up against you right now (Easy, Tough, Deadly, or ONE-SHOT) and how much more it pays. After a world boss falls the game asks: Again, or Next world (it moves on by itself after 5 seconds).

## Run it

Requires Node 20+ (built with Node 22).

```bash
npm install
```

```bash
npm run dev
```

Open http://localhost:5173. In a wide window you get the PC layout (battle on the left, menus on the right); in a narrow one, or in your browser's device toolbar (for example, a 412 x 915 phone), the phone layout. The dev server also prints a Network URL you can open on a phone on the same Wi-Fi.

Your save lives in the browser's localStorage. Close the tab, come back later, and you get offline rewards: gold, XP and bags for the fighting, and the dumpster keeps rolling at a tenth of its speed, with anything Epic or rarer waiting in your bag. Sound and music start on your first tap (the music and most sounds are synthesized in code; some are recordings, in `src/assets/sounds`); Settings has a switch and a volume slider for each.

### Play it on claude.ai

There's a playable copy published as a private artifact: https://claude.ai/artifact/4hn2fn8aPTkS15gtidCg6s (it includes the cheat panel). To rebuild that single-file page from the current code:

```bash
npm run build:artifact
```

It writes `artifact/dumpster-legend.html` (one self-contained page: fonts and code inlined).

### Dev cheat panel

The **Dev tools** button in Settings (dev and playtest builds only) opens a cheat panel that can add coins, Gems, bags and XP, jump to any world (as if the ones before it were beaten) or straight to a world's boss wave, set the Dumpster Level, force the next roll's rarity (or, from the dev console, a luck token chain with the `forceTokens` cheat, on every reel with `everyReel: true`), start a Luck Potion, skip time by 30 min to 24 h (to test offline rewards and upgrade timers), and reset the save. It also shows your live stats, luck and roll count.

## Tests and balance

```bash
npm test
```

347 Vitest tests: damage and stat formulas; 10,000-roll distribution checks for every random system (rarity odds at luck 1, 3 and 25 within 1% of the exact chances across all 13 tiers, slots, item levels, substats, enchantment counts and tiers, crits, enemy counts, bag find); bad luck protection; the reels (first spin, spin and rest timing, luck tokens and their chains and when each lands on any tab, matching tokens on every reel counting squared, reels landing one by one, the Roll tab's stop timing never running ahead of core, and its build-ups never glowing past the real tier, Spin Speed, turbo spins, Lucky Spins, Extra Reels, keep-the-best bag, no auto-equip, drag-to-equip, scrapping, Scrap All, locks, "1 in X" odds); the upgrade map (layout with no overlaps, tier unlock order, exponential costs, specials, save cleanup), rebirth (what it wipes and keeps, its multipliers and upgrade discount, and the items each rebirth unlocks), enchantment effects (burn, chain, explode, thorns) and luck boosts; worlds (scaling, proportional pay, boss waves, travel, one-shots and falling back, item tiers); Dumpster upgrades and speedups; the Codex; offline math and the clock-backward guard; save/load with backups and migrations (v1 through v8); heists (opening with the first rebirth, tickets, stops, fights in the battle and the Alley coming back exactly as it was, perks and evolutions, choices, the second chance, rewards, and a first-run balance check); Alley perks (opening with the second rebirth, a loaf for each world's first fall in a run and none for farming it, eating perks in tree order, each of the 20 perks changing the fight, the reels or the loaves as its card says, a rebirth eating them all, old saves, and the trees, texts and icons in the data); offline rolls (count, cap, what goes to the bag); the tutorial's scripted rolls (the first find, beginner's luck: when it comes (about 45 s in), where it lands, the reels waiting on each find, ending the tutorial); the locked start (the padlocked dumpster, each feature opening when it becomes useful, introduced one at a time, old saves keeping everything); the big-roll and big-haul thresholds (odds at your luck, minutes of fighting); the after-boss choice; data validation; the pixel art registries (every item, enemy, icon and scenery layer); worn gear (every wearable item fitted to every pose, inside the frame, in its palette); the pixel font; the mouse wording (tap to click); the loading screen (current with the art, self-contained, no lampposts, Android's icon inside its circle); the logo and PLAY (every letter drawn, the raccoon in the can, both title layouts fitting clear of the raccoon, the pixel-font fallback, the loading screen's logo matching the title's at rest); the battle's scene frames; the redrawn street and farm (frames, seams, no sky under the feet, lights); the atmosphere (banded skies, halos, tiling clouds, window detection and lighting, vignette, every world's backdrop); and one headless balance run.

```bash
npm run sim -- --minutes 120 --seeds 4
```

The balance simulator plays the real game logic with a bot and prints a timeline, the minute each world was first beaten, rebirth times, each run's loaves and perks, and rarity counts. The bot eats its loaves on the cheapest perk it can afford; `--perks focus` makes it climb one tree to the top each run, `--perks none` plays without perks (with them, runs after the second rebirth are about 14% shorter, and the best world after 4 hours is 16 or 17 instead of 15 or 16). Current result: World 3 at 4 to 7 minutes, World 5 at 14 to 16, the first rebirth at about 15 minutes and one every 15 to 20 minutes after that, best world 15 after 2 hours, and 250 to 320 Legendaries among about 11,000 items rolled. Run it after every balance change.

```bash
npm run typecheck
```

## Phones

The native projects live in `android/` and `ios/` (Capacitor 8). After changing web code, rebuild and copy it into them:

```bash
npm run cap:sync
```

**Android** (needs Android Studio, or the Android SDK plus JDK 21):

```bash
npm run android:open
```

Then press Run in Android Studio with a device or emulator connected. Or build a debug APK from the command line:

```bash
npm run android:debug
```

The APK lands in `android/app/build/outputs/apk/debug/app-debug.apk`. Install it on a USB-connected phone with:

```bash
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
```

**iOS** (needs a Mac with Xcode):

```bash
npm run ios:open
```

The loading screen (`src/boot/boot.html`) and the apps' launch art (Android's `splash_icon.png`, iOS's Splash images) are drawn from the game's own art. After changing the logo, the raccoon or world 1's street, redraw them with:

```bash
npm run boot-art
```

Release builds hide the cheat panel. For a playtest build that keeps it:

```bash
VITE_CHEATS=true npm run cap:sync
```

## How it's put together

```
src/
  core/        pure, deterministic game logic (no rendering): state, rng, time, save, format, systems/*
  data/        JSON tuning and content (balance, items, affixes, enemies, neighborhoods, strings, assets) + zod schemas
  services/    ads, IAP, analytics, haptics, notifications, storage (mocks for now, real SDKs drop in later)
  render/      Phaser battle scene; render/pixel/ holds all the pixel art, drawn in code from one palette
  ui/          React screens (Roll reels, Bag, upgrade map, Rebirth, Worlds), drag-to-equip, popups and the big-roll reveal
  app/         Zustand store, game loop, pause/resume, autosave
  dev/         cheat panel
tests/         Vitest
tools/         balance simulator
```

- Game logic is pure: `applyAction(state, action, rng, now)` and `tick(state, { ticks }, rng, now)` return `{ state, events }`. Combat runs at 10 ticks per second; rendering only reads state and plays effects from events.
- Every tuning number is in `src/data/balance.json`, every UI string in `src/data/strings.en.json`, and all content is JSON validated with zod at boot.
- Randomness only comes from the seeded `Rng`, and its state is saved, so runs are reproducible.
- Art is pixel art in `src/render/pixel/` (rules in [`docs/PIXEL_ART.md`](docs/PIXEL_ART.md)): drawn in code from one palette, plus pack art and Kevin's raccoon sheet generated into `src/render/pixel/packs/` by `tools/packs/*.py`. Render a set to a PNG sheet with `npx tsx tools/pixelSheet.ts items out.png` (or `ui`, `enemies`, `scenery`, `hero`, `packs/fx`), every animation of a pack module with `npx tsx tools/animSheet.ts packs/fantasy out.png`, and every world's lit backdrop with `npx tsx tools/worldPreview.ts out.png`. Licenses: [`CREDITS.md`](CREDITS.md).

## Docs

- [`DUMPSTER_LEGEND_SPEC.md`](DUMPSTER_LEGEND_SPEC.md): the build spec.
- [`DECISIONS.md`](DECISIONS.md): every call made where the spec was silent, plus the balance results.
- [`CONTENT_TODO.md`](CONTENT_TODO.md): all placeholder names and jokes, for a human rewrite.
- [`docs/ART_DIRECTION.md`](docs/ART_DIRECTION.md): the look (copy of Kevin's art direction doc) and what the placeholder art already follows.
- [`docs/PIXEL_ART.md`](docs/PIXEL_ART.md): the pixel art format, palette and style rules.
- [`docs/DOPAMINE_PLAYBOOK.md`](docs/DOPAMINE_PLAYBOOK.md): the feel and juice playbook and what is already in.
