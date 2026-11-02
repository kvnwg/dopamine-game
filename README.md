# Dumpster Legend

Idle RPG roguelite for iOS and Android: a raccoon auto-battles its way through the city's alleys while its dumpster rolls for junk gear on its own, RNG-game style. Every item has a power number and a "1 in X" rarity, and the raccoon visibly wears whatever it equips.

**Status:** Milestones 0 (setup) and 1 (core idle loop) from [`DUMPSTER_LEGEND_SPEC.md`](DUMPSTER_LEGEND_SPEC.md) are built, then reworked (Nov 2) into an always-rolling loop: luck from several sources, Lucky Rolls every 10th roll, a bag that keeps your best items, a gold upgrade grid, rebirths that raise luck, and enchantments. The look is a bright, clean cel-shaded cartoon. The rework is recorded in [`DECISIONS.md`](DECISIONS.md) (rows R1 to R16). Next up is Milestone 2 (Heists).

### How it plays

- **Roll tab:** the dumpster rolls every 2 seconds without any taps, and Trash Bags won in fights become fast bonus rolls. It shows your luck (tap it for the exact odds), the Lucky Roll meter, the latest roll with its "1 in X" odds, recent rolls and your equipped gear. Legendary and better rolls get a full-screen reveal.
- **Bag tab:** better rolls are equipped automatically; the rest go in the bag, which keeps the highest-power items. Tap any item to equip, lock or scrap it.
- **Upgrades tab:** spend gold on Luck, Gold Gain, Roll Speed, Bag Space, Lucky Rolls, Enchanting, Strength, Toughness and Bag Finder. Hold a button to keep buying.
- **Rebirth tab:** once you clear the required stage and hold enough gold, start over from stage 1 with permanently higher luck and gold.

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

The red **DEV** tab (right edge of the battle, dev builds only) can add coins, Gems, bags and XP, jump to any stage or straight to a stage's boss wave, set the Dumpster Level, force the next roll's rarity, start a Luck Potion, skip time by 30 min to 24 h (to test offline rewards and upgrade timers), and reset the save. It also shows your live stats, luck and roll count.

## Tests and balance

```bash
npm test
```

82 Vitest tests: damage and stat formulas; 10,000-roll distribution checks for every random system (rarity odds at luck 1, 3 and 25 within 1% of the exact chances, slots, item levels, substats, enchantment counts and tiers, crits, enemy counts, bag find); bad luck protection; the roller (first roll, timed and bonus rolls, Lucky Rolls, keep-the-best bag, scrapping, locks, auto-equip); the upgrade grid, rebirths, enchantment effects (burn, chain, explode, thorns) and luck boosts; Dumpster upgrades and speedups; the Codex; offline math and the clock-backward guard; save/load with backups and migrations (including v1 to v2); data validation; and one headless balance run.

```bash
npm run sim -- --minutes 80 --seeds 4
```

The balance simulator plays the real game logic with a bot and prints a timeline, the minute each stage was first cleared, rebirth times and rarity counts. Current result: first rebirth at 30 to 37 minutes, stage 20 reached at 26 to 47 minutes, the stage 20 boss beaten at 46 to 62 minutes, and a Legendary every 2 to 3 minutes. Run it after every balance change.

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
  render/      Phaser battle scene; render/cel/ draws all placeholder art in code (cel-shaded)
  ui/          React screens (Roll, Bag, Upgrades, Rebirth), popups and the big-roll reveal
  app/         Zustand store, game loop, pause/resume, autosave
  dev/         cheat panel
tests/         Vitest
tools/         balance simulator
```

- Game logic is pure: `applyAction(state, action, rng, now)` and `tick(state, { ticks }, rng, now)` return `{ state, events }`. Combat runs at 10 ticks per second; rendering only reads state and plays effects from events.
- Every tuning number is in `src/data/balance.json`, every UI string in `src/data/strings.en.json`, and all content is JSON validated with zod at boot.
- Randomness only comes from the seeded `Rng`, and its state is saved, so runs are reproducible.
- Art goes through `src/data/assets.json`. Until real files are listed there, everything is drawn in code (`src/render/cel/`). Preview it all at http://localhost:5173/tools/cel-preview.html while `npm run dev` is running.

## Docs

- [`DUMPSTER_LEGEND_SPEC.md`](DUMPSTER_LEGEND_SPEC.md): the build spec.
- [`DECISIONS.md`](DECISIONS.md): every call made where the spec was silent, plus the balance results.
- [`CONTENT_TODO.md`](CONTENT_TODO.md): all placeholder names and jokes, for a human rewrite.
- [`docs/ART_DIRECTION.md`](docs/ART_DIRECTION.md): the look (copy of Kevin's art direction doc) and what the placeholder art already follows.
- [`docs/DOPAMINE_PLAYBOOK.md`](docs/DOPAMINE_PLAYBOOK.md): the feel and juice playbook and what is already in.
