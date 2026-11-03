# Dumpster Legend

Idle RPG roguelite for iOS and Android: a raccoon auto-battles its way through the city's alleys while its dumpster rolls for junk gear on its own, RNG-game style. Every item has a power number and a "1 in X" rarity, and the raccoon visibly wears whatever it equips.

**Status:** Milestones 0 (setup) and 1 (core idle loop) from [`DUMPSTER_LEGEND_SPEC.md`](DUMPSTER_LEGEND_SPEC.md) are built, then reworked into a Roblox-style rolling game: slot reels that roll on their own, luck from several sources, a bag of power-rated items you equip by dragging them onto the raccoon, a honeycomb upgrade map, rebirths, enchantments, and 20 worlds of rising difficulty, all open from the start. Everything is pixel art on one pixel grid: the hero is Kevin's raccoon sprite sheet, and enemies, effects and World 8's dungeon come from asset packs Kevin supplied (credits in [`CREDITS.md`](CREDITS.md)). Every world has its own lit sky and weather (sunsets, night streets with glowing windows and lamps, rain, snow, fireflies). The rework is recorded in [`DECISIONS.md`](DECISIONS.md) (rows R1 to R16, W1 to W11, V1 to V9, H1 to H6, X1 to X7, P1 to P8, L1 to L8 and Q1 to Q12). Next up is Milestone 2 (Heists).

### How it plays

- **Roll tab:** the dumpster's reels roll on their own, one item per reel per spin: 2.6 seconds per spin at first, faster with the Spin Speed upgrade. Items scroll down past a gold win line as black silhouettes showing their "1 in X" odds, and the result flashes into color when its reel stops. Trash Bags won in fights become turbo spins, and every 10th spin is a Lucky Spin. The tab shows your luck (tap it for the exact odds), the best result of the last spin, recent rolls and your gear. Legendary and better build up while the reels roll and get a full-screen reveal when they land.
- **Equipping:** nothing equips itself. Drag an item onto the raccoon (or onto the gear row) to put it on; on a phone, hold it for a moment, then drag. Items that beat what you wear get a green ▲.
- **Bag tab:** the bag holds your rolls and keeps the best when it fills up. Sort it by Power or Rarity, tap an item to lock or scrap it, or Scrap All (locked items are safe).
- **Upgrades tab:** opens a full-screen honeycomb map that grows out of Luck I. Every tier is its own hex (Luck I, Luck II, ...): bought hexes are bright, the next ones show their price, and the ones past those are "?" until you get closer. Gold hexes are big specials, including the very expensive Extra Reel line: up to 4 more reels, each one more item per spin. Drag to explore, pinch or scroll to zoom, tap a hex for details, and hold Buy to keep buying up a line. The first tiers are cheap, then each one costs about 10 times the last.
- **Rebirth tab:** beat the required world and hold enough gold to start over from scratch in World 1 (items, level, gold and upgrades are wiped) with permanently more luck, gold, ATK and HP, and cheaper upgrades.
- **Worlds tab:** all 20 worlds, each with its own look, enemies and boss, and every one open from the start. World 5, Funky Farmland, is a farm with angry hens, ducks, bunnies, pigs, a ram and a giant cow; World 8, Dungeon Dumps, is a fantasy dungeon with knights, orcs, a pumpkin-head, a plague doctor and a big demon. Each card shows how a world matches up against you right now (Easy, Tough, Deadly, or ONE-SHOT) and how much more it pays. Harder worlds pay proportionally more gold, and gear rolled there is stronger. Wander too far up and you get one-shot and sent back; roll something lucky and you can jump several worlds ahead.

## Run it

Requires Node 20+ (built with Node 22).

```bash
npm install
```

```bash
npm run dev
```

Open http://localhost:5173. The game is portrait, so use a narrow window or your browser's device toolbar (for example, a 412 x 915 phone). The dev server also prints a Network URL you can open on a phone on the same Wi-Fi.

Your save lives in the browser's localStorage. Close the tab, come back later, and you get offline rewards. Sound and music (synthesized in code) start on your first tap; Settings has toggles for each.

### Play it on claude.ai

There's a playable copy published as a private artifact: https://claude.ai/artifact/4hn2fn8aPTkS15gtidCg6s (it includes the cheat panel). To rebuild that single-file page from the current code:

```bash
npm run build:artifact
```

It writes `artifact/dumpster-legend.html` (one self-contained page: fonts and code inlined).

### Dev cheat panel

The **Dev tools** button in Settings (dev and playtest builds only) opens a cheat panel that can add coins, Gems, bags and XP, jump to any world (as if the ones before it were beaten) or straight to a world's boss wave, set the Dumpster Level, force the next roll's rarity, start a Luck Potion, skip time by 30 min to 24 h (to test offline rewards and upgrade timers), and reset the save. It also shows your live stats, luck and roll count.

## Tests and balance

```bash
npm test
```

139 Vitest tests: damage and stat formulas; 10,000-roll distribution checks for every random system (rarity odds at luck 1, 3 and 25 within 1% of the exact chances across all 13 tiers, slots, item levels, substats, enchantment counts and tiers, crits, enemy counts, bag find); bad luck protection; the reels (first spin, spin and rest timing, Spin Speed, turbo spins, Lucky Spins, Extra Reels, keep-the-best bag, no auto-equip, drag-to-equip, scrapping, Scrap All, locks, "1 in X" odds); the upgrade map (layout with no overlaps, tier unlock order, exponential costs, specials, save cleanup), rebirth (what it wipes and keeps, its multipliers and upgrade discount), enchantment effects (burn, chain, explode, thorns) and luck boosts; worlds (scaling, proportional pay, boss waves, travel, one-shots and falling back, item tiers); Dumpster upgrades and speedups; the Codex; offline math and the clock-backward guard; save/load with backups and migrations (v1 through v7); the big-roll and big-haul thresholds (odds at your luck, minutes of fighting); the after-boss choice; data validation; the pixel art registries (every item, enemy, worn item, icon and scenery layer); the atmosphere (banded skies, halos, tiling clouds, window detection and lighting, vignette, every world's backdrop); and one headless balance run.

```bash
npm run sim -- --minutes 120 --seeds 4
```

The balance simulator plays the real game logic with a bot and prints a timeline, the minute each world was first beaten, rebirth times and rarity counts. Current result: World 3 at 4 to 7 minutes, World 5 at 14 to 16, the first rebirth at about 15 minutes and one every 15 to 20 minutes after that, best world 15 after 2 hours, and 250 to 320 Legendaries among about 11,000 items rolled. Run it after every balance change.

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
