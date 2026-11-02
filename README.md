# Dumpster Legend

Idle RPG roguelite for iOS and Android: a raccoon auto-battles its way through the city's alleys, and every Trash Bag it wins is a Dumpster Dive for junk gear it visibly wears.

**Status:** Milestones 0 (setup) and 1 (core idle loop) from [`DUMPSTER_LEGEND_SPEC.md`](DUMPSTER_LEGEND_SPEC.md) are built. Next up is Milestone 2 (Heists).

## Run it

Requires Node 20+ (built with Node 22).

```bash
npm install
```

```bash
npm run dev
```

Open http://localhost:5173. The game is portrait, so use a narrow window or your browser's device toolbar (for example, a 412 x 915 phone). The dev server also prints a Network URL you can open on a phone on the same Wi-Fi.

Your save lives in the browser's localStorage. Close the tab, come back later, and you get offline rewards.

### Play it on claude.ai

There's a playable copy published as a private artifact: https://claude.ai/artifact/4hn2fn8aPTkS15gtidCg6s (it includes the cheat panel). To rebuild that single-file page from the current code:

```bash
npm run build:artifact
```

It writes `artifact/dumpster-legend.html` (one self-contained page: fonts and code inlined).

### Dev cheat panel

The red **DEV** button (bottom left, dev builds only) can add coins, Gems, bags and XP, jump to any stage or straight to a stage's boss wave, set the Dumpster Level, force the next dive's rarity, skip time by 30 min to 24 h (to test offline rewards and upgrade timers), unlock Auto-Dive, and reset the save. It also shows your live stats.

## Tests and balance

```bash
npm test
```

76 Vitest tests: damage and stat formulas, 10,000-roll distribution checks for every random system (rarity within 1% of the table at Dumpster Levels 1, 5, 10, 20 and 30; slots; item levels; substats; crits; enemy counts; bag find), bad luck protection, auto-dive rules, upgrades and speedups, the Codex, offline math and the clock-backward guard, save/load with backups and migrations, data validation, and one headless balance run.

```bash
npm run sim -- --minutes 70 --seeds 6
```

The balance simulator plays the real game logic with a bot and prints a timeline plus the minute each stage was first cleared. Current result: stage 20 reached at a median of about 45 minutes (32 to 52 across seeds), and the stage 20 boss beaten at 55 to 68 minutes. Run it after every balance change.

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
  render/      Phaser battle scene and code-drawn placeholder art
  ui/          React screens, popups and the lid-flip reveal
  app/         Zustand store, game loop, pause/resume, autosave
  dev/         cheat panel
tests/         Vitest
tools/         balance simulator
```

- Game logic is pure: `applyAction(state, action, rng, now)` and `tick(state, { ticks }, rng, now)` return `{ state, events }`. Combat runs at 10 ticks per second; rendering only reads state and plays effects from events.
- Every tuning number is in `src/data/balance.json`, every UI string in `src/data/strings.en.json`, and all content is JSON validated with zod at boot.
- Randomness only comes from the seeded `Rng`, and its state is saved, so runs are reproducible.
- Art goes through `src/data/assets.json`. Until real files are listed there, everything is drawn in code to match the art direction.

## Docs

- [`DUMPSTER_LEGEND_SPEC.md`](DUMPSTER_LEGEND_SPEC.md): the build spec.
- [`DECISIONS.md`](DECISIONS.md): every call made where the spec was silent, plus the balance results.
- [`CONTENT_TODO.md`](CONTENT_TODO.md): all placeholder names and jokes, for a human rewrite.
- [`docs/ART_DIRECTION.md`](docs/ART_DIRECTION.md): the look (copy of Kevin's art direction doc) and what the placeholder art already follows.
- [`docs/DOPAMINE_PLAYBOOK.md`](docs/DOPAMINE_PLAYBOOK.md): the feel and juice playbook and what is already in.
