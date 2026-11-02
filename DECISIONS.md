# Decisions

Choices made where the spec was silent or ambiguous (spec instruction: pick the simplest option and record it here). Numbers referenced live in `src/data/balance.json` unless noted.

## Combat and stages

| # | Decision | Why |
|---|---|---|
| C1 | Only the front enemy fights at a time (`combat.engagedEnemies = 1`); the rest queue behind it. | Readable on a small battle panel. Bruiser's 2-enemy cleave (M3) can raise this. |
| C2 | A mini-boss or boss stage is 4 regular waves, then the boss alone as wave 5. Tapping Fight Boss starts that stage from wave 1. | Spec: stages "end with" a mini-boss/boss. |
| C3 | The boss wave pays the boss bags (5 or 15) instead of the normal 1 bag + BAG_FIND roll. Boss coin burst = 20 kills' worth of coins. Mini-boss/boss XP is x5/x10 a regular kill. | Spec gives the bag counts but not how they combine. |
| C4 | The raccoon heals 20% of max HP between waves and starts every stage at full HP. | Without some healing, 5 waves in a row are a pure HP check. |
| C5 | The farming stage is the highest cleared *regular* stage, never a boss stage. | Farming a boss stage would pay boss bags every loop. |
| C6 | After a death on a regular stage, the raccoon farms and retries automatically once its power (gear power + 10 per level) beats its power at death. A "Try stage ▶" button allows a manual retry any time. | "Auto-advances while it can win" without hammering a wall it cannot pass. |
| C7 | After the stage 20 boss (end of M1 content), the raccoon farms stage 19. | No stage 21 until M3. |
| C8 | Enemies never crit. DODGE applies to enemy hits. Lifesteal uses damage actually dealt (overkill does not count). Minimum damage per hit is 1. | Simplest reading of section 5. |
| C9 | Boss specials are data-driven (`heavyHit` or `enrage`). Officer Dale's "Catch Pole" hits for 2.5x every 6 seconds. | Spec: one special move defined in enemies.json. |
| C10 | Neighborhood clear "+10% Trash Bag drops" is +10 BAG_FIND (same expected value); "+10% offline rewards" multiplies the offline payout. | |
| C11 | Suburbs roster: Alley Rat, Porch Pigeon, Punk Raccoon; mini-bosses Big Earl (stages 5 and 15) and Vinnie "Two Lids" (stage 10); boss Officer Dale, Animal Control. | Spec: 3 regular, 2 mini-bosses, 1 boss, but 3 mini-boss stages, so one returns. |

## Stats and items

| # | Decision | Why |
|---|---|---|
| I1 | CRIT, CRIT_DMG, DODGE, LIFESTEAL, BAG_FIND, COIN_FIND and BOSS_DMG are percentage-point stats added flat. The ATK%, HP%, DEF% and ATK_SPD% substats are the "% bonuses" that multiply. Gloves' main stat is flat attacks per second. | Fits "Final stat = (base + level + flat gear) x (1 + sum of %)". |
| I2 | Slot base values, substat ranges and power-score weights were chosen with the balance simulator. | Spec leaves them to balance.json. |
| I3 | Substat value = affix range x (1 + 0.05 x (itemLevel - 1)); rarity sets the substat count, not the size. | "Value ranges scale with item level." |
| I4 | The Codex "+1% BAG_FIND" bonus is +1 BAG_FIND point. Each Codex bonus also grants 10 Gems. | Section 12 lists the Codex as a Gem source. |
| I5 | Unique Legendaries: when a Legendary-or-better roll lands on a slot that has a unique in the active theme, 15% chance to get the unique. Uniques carry one fixed bonus stat. | Spec only says each theme has 3. |
| I6 | Mint in Box "unique perk" = one of 5 perks in `affixes.json` (`mintPerks`), each a set of stat bonuses. | |
| I7 | Legendary and better items show the base item's `legendaryName`; lower rarities show `name`. | Matches the example item data. |
| I8 | Item level cap and player level cap are both 100. | Spec's `levelCap` is unspecified. |
| I9 | Equipping an item recycles the one it replaces. There is no inventory in M1. | Simplest loop; the spec never mentions a stash. |
| I10 | Items matching the keep filters pause Auto-Dive and open the compare card instead of going to a stash. The default keep filter is "Legendary+" (which already pauses), so there are no extra pauses until the player sets one. | No inventory in M1 (I9). |
| I11 | Max HP gained from a level-up or a new item is also added to current HP. | Equips should feel immediate. |
| I12 | The scripted first dive is the Legendary Traffic Cone of Destiny at item level 1 with 3 rolled substats. | |

## Dumpster

| # | Decision | Why |
|---|---|---|
| D1 | Upgrade cost and time use the current level: going from level L to L+1 costs 400 x 1.85^(L-1) coins and takes 60 s x 1.65^(L-1). | |
| D2 | The bad-luck counter counts every dive since the last Epic-or-better and only *triggers* from Dumpster Level 3. The guaranteed roll uses the table restricted to Epic and up. | |
| D3 | The near-miss gold tease (10% of Epic rolls) is rolled in core with the seeded Rng and sent in the dive event. Free dives only, per the Dopamine Playbook. | Keeps it deterministic and testable. |
| D4 | Ad speedups reset at local midnight. | Same as other daily caps. |
| D5 | New players start with 3 Trash Bags, 50 Gems, 0 coins. | So the first tap can dive. |
| D6 | Auto-Dive unlocks at 8 minutes of cumulative play time (not wall time) and shows an explainer with "Turn it on". | |

## Offline progress

| # | Decision | Why |
|---|---|---|
| O1 | The rate is tracked in per-minute buckets from regular kills and regular wave bags over the last 10 minutes of play. Boss bags and coin bursts are left out so one boss kill does not inflate a whole night. | |
| O2 | With less than 1 minute of data, the rate is estimated from the current stage: 5 waves x 4 enemies per 75 seconds. | "Estimate it from the stage's expected clear time." |
| O3 | The rate resets on every resume. Autosave snapshots `lastActiveAt` and the rate, so an app that is killed without a pause event still earns from its last save. | |
| O4 | The popup only appears if you were away at least 60 seconds and earned something. Uncollected rewards stack. Offline XP is paid too. | |
| O5 | Clock guard: if `now < lastActiveAt` on resume, grant nothing and reset `lastActiveAt` (as specified). While playing, `lastActiveAt` only moves forward. A server time check comes with M7. | The spec's reset still allows one capped 8 h exploit per clock rewind; the cap limits it. |
| O6 | A browser frame gap over 5 seconds with no visibility event is treated as offline time. | Phones freeze tabs without always firing events. |
| O7 | On load, the battle restarts at the start of the current stage. | Avoids restoring a half-finished fight. |

## Saving

| # | Decision | Why |
|---|---|---|
| S1 | One JSON save key plus 2 rotating backups. If the main save fails to parse or validate (zod), the newest valid backup loads. Migrations are keyed by `saveVersion` (`src/core/save.ts`). | |
| S2 | The seeded Rng state is part of the save, so a reloaded game continues the same random sequence. | Determinism. |

## UI, feel and art

| # | Decision | Why |
|---|---|---|
| U1 | The 1080 x 1920 logical stage is scaled with a CSS transform to fit the screen (letterboxed), inside safe-area padding. Phaser renders only the battle panel; React renders everything else. | Spec: React overlay on a Phaser canvas. |
| U2 | Player-facing UI text lives in `strings.en.json`. Content text (item names, flavor, enemy names) lives with the content JSON; M6 localization will key it by id. | |
| U3 | Rattle beats scale with rarity: 3 for Junk to Shiny, 4 Epic, 5 Legendary, 6 Mythic and Mint (Dopamine Playbook). The manual build-up stays 0.95 s for common pulls (spec) and stretches for rare ones. Tapping during a reveal skips it. | |
| U4 | The compare card appears once the reveal lands. Popup priority: offline rewards, then the compare card, then the Auto-Dive unlock, then menus. Level-ups are non-blocking toasts. | |
| U5 | Art follows `docs/ART_DIRECTION.md`. The main screen uses *dark* cardboard so the dumpster stays the only accent ("everything else stays dark and quiet"); popups use full kraft. | The doc asks for both cardboard panels and a quiet screen. |
| U6 | Buttons: lime for go, gold for spending coins or gems, gray for secondary. "Collect" is primary and "Collect x2" (ad) is secondary. | Art direction button system. |
| U7 | Bosses are drawn about 2x the raccoon's height, not 3x, so they fit the 768 px battle panel. | |
| U8 | Mint in Box color is `#FFF4D6` and the Gem icon is sea glass, from the art doc. Item art IDs are `<item_id>_icon` and `<item_id>_overlay` (the doc's naming), mapped to files in `assets.json`. | The art doc is newer and more specific than the spec's example. |
| U9 | Fonts (Lilita One, Nunito) are bundled with `@fontsource` so they work offline in the native app. | |
| U10 | Sound and music are not in M1 (settings toggles exist). Haptics use Capacitor's presets; custom patterns need a native plugin (playbook note). | M5 scope. |
| U11 | The dev cheat panel shows in dev builds, or in any build made with `VITE_CHEATS=true`. Extra helpers beyond the spec: "Last wave" (jump to a stage's boss wave) and "Set dumpster Lv". | |

## Balance

The simulator (`npm run sim`) plays the real core with a bot that dives every 1.6 s before Auto-Dive unlocks, equips upgrades, upgrades the dumpster when it can afford it, and fights bosses when ready (retrying when its power grows or after 90 s). With the current numbers, across 6 seeds:

- Stage 20 reached (stage 19 cleared) at 32 to 52 minutes, median about 45.
- Stage 20 boss beaten at 55 to 68 minutes.
- Walls at the mini-bosses while the bot keeps diving and upgrading: about 4 to 12 minutes at stage 10, and 12 to 26 minutes at stage 15 (the longest stretch without a new stage; the first thing to retune after playtesting).
- The stage 5 mini-boss is usually beaten on the first try (about 2.5 to 3 minutes in). The first-session script wants most players to lose the first try; that tuning belongs to M5 with the scripted opening.

## Tech

| # | Decision | Why |
|---|---|---|
| T1 | TypeScript 5.9 (not the new 7.x), Vite 8, Vitest 5, React 19, Phaser 3.90, Zustand 5, zod 4, Capacitor 8. | Current stable versions with known-good tooling. |
| T2 | Core actions use immer `produce`: `(state, input, rng, now) => { state, events }` stays pure and the result is frozen. | |
| T3 | The `GameState` TypeScript type is inferred from its zod schema, so save validation and types cannot drift apart. | |
