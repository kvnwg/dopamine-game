# Dumpster Legend on CrazyGames

Everything needed to submit **Dumpster Legend** at <https://developer.crazygames.com/>: the build, the store art, the listing text, the form answers, and what to fix first.
The requirements below were checked against the official docs at <https://docs.crazygames.com/> on 2026-11-04. The developer portal's form isn't public, so its field names may differ slightly from the headings here. The text itself is ready to paste.

---

## 0. Fix before you submit

1. **Asset licenses: resolved.** Kevin confirmed the licenses for the packs `CREDITS.md` lists (farm animals, Modern Pixel Clothes, MV Icons, 0x72 DungeonTileset II) allow commercial web distribution (Nov 5).
2. **Brand name: resolved.** The item "Crocs" is now **Swamp Clogs** (Legendary: Swamp Clogs of Sport Mode). Its internal id stays `sneakers_crocs`, which players never see, so saves and art keep working. Other names that brush against brands, all low risk: Bubble Wrap Armor, Chewed Frisbee (both everyday words) and Mall Cop Doug's Segway in Heists.
3. **Desktop readability: resolved.** The game now has a wide PC layout (battle on the left, the dumpster and tabs on the right). It reads well even in CrazyGames' smallest desktop frame (800×450, checked), so you can submit for desktop and mobile.

---

## 1. Files

| What | File | Spec (CrazyGames requirement) |
|---|---|---|
| Game build | `crazygames/upload/dumpster-legend-crazygames.zip` (`npm run build:crazygames`) | `index.html` at the root, relative paths only: 26 files, 3.8 MB unzipped, 1.7 MB zipped. Limits: 250 MB total, 1,500 files, 20 MB initial download for the mobile homepage |
| Landscape cover | `crazygames/covers/cover-landscape-1920x1080.png` | 16:9, 1920×1080 |
| Portrait cover | `crazygames/covers/cover-portrait-800x1200.png` | 2:3, 800×1200 |
| Square cover | `crazygames/covers/cover-square-800x800.png` | 1:1, 800×800 |
| Landscape preview | `crazygames/video/preview-landscape-1920x1080.mp4` | 1080p 16:9, 17.1 s, 30 fps, silent, opens on the cover, 21.0 MB (limit 50 MB) |
| Portrait preview | `crazygames/video/preview-portrait-1080x1620.mp4` | 1080p 2:3, 17.7 s, 30 fps, silent, opens on the cover, 22.2 MB (limit 50 MB) |

**Covers** are in the style of the store's tiles: the whole raccoon, big in the frame, his BBQ Spatula raised toward the top corner, over a soft, blurred view of Lava Landfill's orange sunset (World 10), with sunlight, flecks of light and the game's sparkles on the blade. The warm orange stands out on CrazyGames' dark grid, among mostly blue tiles. He is his cheer pose and the spatula is its item art, both the game's own pixels at one big pixel size, never smoothed; only the background is soft (`tools/crazygames/cover.ts`). There is no text (CrazyGames allows the title and nothing else), and no borders or icons. The square cover is the tile players see in the game grid.

**Logo**, in the style of the reference tile: `crazygames/logo/logo-1024x1024.png`, `logo-800x800.png` and `logo-512x512.png`, the same design as a square, on the same orange, no text or outline.

**Previews** are a 17-second trailer of real gameplay, each in the layout players of that format see: the landscape one in the PC layout (the battle on the left, the dumpster's reels on the right), the portrait one in the phone layout. A dozen quick shots (0.5–1.9 s) with push-ins, punch-in zooms and shakes on the hits:
1. The cover, dissolving into a close-up brawl in Lava Landfill: CRIT!s, big numbers, coins flying, LEVEL UP!
2. A luck chain on all three reels at once. Each reel lands ×3, then ×5, then ×10, and every token flies up into its row over the battle. All three reels match every time, so the luck is squared: MATCH! LUCK SQUARED, ×9, then ×225 (LEGENDARY OR BETTER!), then ×22.5K (MYTHIC OR BETTER!).
3. The reel lands, the screen flashes, and the odds race up through every tier (1 in 57, 1,128, 14,695, 130K, 3.6M...) to HOLY GRAIL! 1 in 250M.
4. He puts it on: the finds slam onto him and his POWER counts up.
5. The boss, Gator Vinnie: his health bar drains under CRIT!s, then WORLD CLEARED!
6. New worlds in quick cuts: Glacier Gulch, then Mushroom Marsh with hits in the millions.

Every shot plays at real speed (no fast-forward), with no cursor, no black screens or bars and no "play now" text. Every frame is new motion (checked: 512 of 514 landscape frames and 530 of 532 portrait ones differ from the one before; the rest are the cover's first beat).

How it's made: `tools/crazygames/recordTrailer.mjs` plays from a fixed mid-game save, `tools/crazygames/trailerSave.json`, made by the game's balance bot with `trailerSave.ts`: about 90 minutes in, 3 rebirths. The save is a file because a balance change makes the bot's save different, and the edit is cut to who wins where with this one. It records each format in its own layout at twice the output's resolution, so the zooms never upscale. It takes over the page's clock (`virtualTime.js`), so every frame is exactly 1/30 s of game time however slowly the headless browser renders. The dev cheats only set scenes up: which world, a forced matched luck chain and Grail. While other scenes record, random luck tokens and surprise reveals are switched off so nothing pops over the fights. `tools/crazygames/editTrailer.mjs` then cuts the trailers from `tools/crazygames/trailerShots.json`. It lists each shot's scene and in point (relative to moments the recorder marks, like each step of the luck chain), its length, and per format its camera, punch-ins, shakes and flashes. To check an edit without rendering video, run `node tools/crazygames/editTrailer.mjs --storyboard land` (or `port`): it renders the first, middle and last frame of every shot.

---

## 2. Listing text (copy & paste)

**Title**
```
Dumpster Legend
```

**Short description**
```
A raccoon, a magic dumpster and 196 pieces of glorious junk. Roll for rare loot, gear up and fight through 20 worlds in this idle pixel RPG.
```

**Description**
```
Dumpster Legend is an idle RPG about a raccoon whose dumpster rolls for loot all by itself.

Watch the reels spin and land on traffic cones, lobster claws, pizza-box shields and 196 other kinds of junk, each with a power number and a "1 in X" rarity, from Junk all the way up to Grail. Land a luck token and the reel spins again with doubled, tripled or even ten-times luck. Chain them for a guaranteed Epic, Legendary or Mythic. Truly rare finds get a full-screen reveal.

Drag your best finds onto the raccoon and he wears them, then auto-battles his way through 20 worlds, from Sunny Suburbs to a farm full of angry hens and a fantasy dungeon. Every world has its own look, enemies and boss.

Features:
- Slot-style loot reels that roll on their own, with luck tokens that chain
- 196 items across 13 rarities, all pixel art, all drawn to fit the raccoon
- Auto-battles across 20 worlds with bosses
- A honeycomb upgrade map, Extra Reels and Dumpster upgrades
- Rebirths that unlock more items and permanent bonuses
- Heists: roguelite runs with perks, curses and a prize wheel
- Perk trees from the second rebirth: The Alley Crew, Bad Decisions, Rigged Reels and The Bread Cult
- Offline progress: your dumpster keeps rolling while you're away
- Progress saves automatically
```

**Controls**
```
Mouse / touch: tap to play, open tabs and buttons
Drag an item onto the raccoon (or the gear row) to equip it, or use Equip best
Upgrade map: drag to move, scroll or pinch to zoom, hold Buy to keep buying
Enter or Space: PLAY on the title screen
```

**Suggested category:** Clicker (idle). Alternative: RPG.
**Suggested tags:** Idle, RPG, Loot, Pixel, Incremental, Upgrade, Roguelite, Animal, Casual, 1 Player

---

## 3. Submission form settings

| Setting | Answer |
|---|---|
| Engine / type | HTML5 |
| Platforms | Desktop **and** Mobile |
| Orientation | Both: the wide layout on desktop, portrait on phones |
| Language | English |
| **Progress Save** | **"Yes, using the Data Module from the CrazyGames SDK"**. Required, or the Data module is turned off and saves fall back to local storage on one device |
| Multiplayer | No |
| In-game purchases | No (the game has none; the IAP service exists only as an unused mock for the phone apps) |
| Account integration | Not used (no login needed) |
| SDK | HTML5 SDK v3 |
| Age rating | PEGI 12 compliant: cartoon violence (a raccoon bonking rats and pigeons). The loot reels use no currency and no real money, so they aren't gambling |

---

## 4. How the integration works

The CrazyGames build is its own Vite mode, so the phone apps and other web builds are untouched:
- `npm run build:crazygames` builds with `--mode crazygames`.
- `.env.crazygames` sets `VITE_PLATFORM=crazygames`.
- The SDK `<script>` tag is added to `<head>` only in that build, by a small plugin in `vite.config.ts`.
- `npm run dev:crazygames` runs the same mode on localhost, where the SDK's "local" mode logs every call and shows a text overlay instead of ads.
- A few lines at the top of `<body>` (also from that plugin) start the SDK and call `loadingStart()` the moment the page opens, before the game's code downloads, so CrazyGames' "Loading started" counts every player who stays past the first instant. The game's code then waits for that same start (DECISIONS J19).
- The battle (Phaser) is a second download that starts once the title screen is up, so the title needs only half the code (DECISIONS J20).
- The sounds wait for the battle's code (except the three the title plays), and a production build skips re-checking the game data at load (DECISIONS J22, J23).

| File | What it does |
|---|---|
| `src/services/crazygames.ts` | Typed SDK wrapper with safe fallbacks; `CrazyGamesAdsService` (rewarded ads); `CrazyGamesStorage` (Data module, falling back to localStorage) |
| `src/app/crazygames.ts` | Lifecycle glue: loading, gameplay start/stop, happytime, mute, pausing during ads, toasts, key guard |
| `src/services/index.ts`, `storage.ts`, `platform.ts` | Pick the CrazyGames ads and storage when `isCrazyGames` |
| `src/services/audio.ts` | New `setSystemMute()`: a gain node after master, so CrazyGames' mute can't be undone by the reveal's silence drop |

## 5. Requirement checklist

**Full Implementation (needed for Full Launch and revenue)**
- [x] SDK v3 loaded in `<head>` and initialised before use; the save load waits for it, because init preloads the cloud save
- [x] `loadingStart()` while the save loads, `loadingStop()` once the title screen shows
- [x] `gameplayStart()` on PLAY; `gameplayStop()` while Settings is open or an ad plays. Never on tab switch or focus loss, which CrazyGames handles itself
- [x] `happytime()` used sparingly: full-screen rare-find reveals only, at most once every 3 minutes
- [x] `settings.muteAudio` honoured at boot and via `addSettingsChangeListener`, overriding the in-game switches
- [x] Progress saved through the Data module. All three save copies (main + 2 backups) total about 180 KB after 10 simulated hours, under the 1 MB limit
- [x] Gameplay is one click away (title screen → PLAY)

**Ads**
- [x] Rewarded, through the SDK: offline ×2, heist ticket, heist second chance, perk reroll, dumpster speed-up, the Boosts panel's four (Bonus Crate, Quick Dive, Potion Brew, Duct-Tape Reel), and five at a moment (Encore after a big luck chain, Boss Rage after two losses at a world, the Rebirth Blessing, Polish on a Mythic-or-better find, a Gold top-up). The boosts open a few minutes into the game
- [x] Midgame ads at two major transitions only: as a won Heist is claimed, and as the raccoon moves on from a world's first clear in a run (World 3 and up). Not after a lost Heist (it offers a revive ad instead), at most one every 6 minutes, none within 6 minutes of a rewarded ad, none in a player's first 10 minutes or a visit's first 3. Never on menus, Settings or the shop. No banners
- [x] No rewarded ad button on an active gameplay screen: the boost ads live in a panel the player opens, never over the reels or the battle
- [x] No ad buttons without effect: they hide when an ad blocker is detected at startup (`ad.hasAdblock()`) and after an `adsDisabled` or `adblock` error (Basic Launch, kids mode); the Gem price stays
- [x] A used-up rewarded ad shows a timer or hides (Boosts: "Back in 5:12:00", "Next crate in 3:59:59"; the dumpster speed-up and the bonus ticket hide)
- [x] The way out of an ad offer looks exactly like the watch button: Collect next to Collect ×2, Give up next to the revive ad
- [x] Game paused and muted when an ad *starts*; resumed and unmuted on finish or error
- [x] Rewards only on `adFinished`; on `adError` the player gets nothing and sees "No ad available right now" (no popups, no adblock nagging)
- [x] Rewarded ads are optional, and every one has a Gem price for the same reward (offline ×2, the bonus ticket, the revive, the reroll, the speed-up, every boost), with daily caps
- [ ] **Judgment call:** the heist "second chance" ad is offered when a heist run is lost. CrazyGames says not to offer rewarded ads on *every* death. Heists are long and limited by tickets (at most 6 a day), so this is probably fine. If QA objects, offer it only every other loss

**Technical / quality**
- [x] Relative paths only; the built game runs from a nested path (tested)
- [x] No fullscreen button, no external links or cross-promotion, no own ads, no login wall, no IAP
- [x] Arrow keys and Space can't scroll the CrazyGames page (form controls keep their keys); Escape and Ctrl+W are unused
- [x] `user-select: none` on the page; Web Audio resumed on a tap (iOS)
- [x] Fixed 10-tick-per-second simulation, so the game behaves the same at any refresh rate
- [x] Notifications are phone-only: no browser permission prompts
- [x] No dev cheat panel in the CrazyGames build
- [x] Asset licenses and the "Crocs" name: see section 0 (both done, Nov 5)

## 6. Step by step

1. Fix section 0.
2. Run `npm run build:crazygames`. It writes `dist-crazygames/` and `crazygames/upload/dumpster-legend-crazygames.zip`.
3. On <https://developer.crazygames.com/>, choose **Submit game** → **HTML5** and upload the zip. Play it in their preview:
   - PLAY, bust the lock, open Settings.
   - Use an ad button: the offline ×2 shows after 30+ minutes away, the speed-up is in the dumpster's upgrade popup.
4. Paste section 2, set section 3, and **set Progress Save to the Data Module**.
5. Upload the three covers and both previews from section 1.
6. Submit. The game starts in **Basic Launch**, where ads are off: ad buttons answer "No ad available right now". That stage lasts at least 7 days and 500 plays (or ends after 21 days). **Full Launch** then turns ads and revenue share on.

## 7. Re-making the assets

```bash
npm run dev:crazygames      # play the CrazyGames build locally (SDK "local" mode)
npm run crazygames:covers   # re-render the 3 covers and the logo from the game art   (needs Playwright)
npm run crazygames:trailer  # re-record the scenes and cut both previews  (Playwright + ffmpeg, ~30 min)
npm run crazygames:recut    # re-cut only, after editing trailerShots.json (~4 min)
npm run build:crazygames    # the upload zip
```
Playwright, if you don't have it: `npm i -D playwright && npx playwright install chromium`.
The covers are drawn by `tools/crazygames/cover.ts` (framing per format at the top of the file). The trailer's scenes are scripted in `tools/crazygames/recordTrailer.mjs` and its edit is `tools/crazygames/trailerShots.json`. Recording keeps the raw scenes in `crazygames/.trailer/` (git-ignored), so changing the edit only needs a re-cut.
