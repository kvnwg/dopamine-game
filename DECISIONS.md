# Decisions

Choices made where the spec was silent or ambiguous (spec instruction: pick the simplest option and record it here). Numbers referenced live in `src/data/balance.json` unless noted.

## Worlds (Nov 2, later): 20 worlds of rising difficulty

Kevin asked for about 20 worlds, all open from the start: the hard ones one-shot you, but they pay proportionally more, so a lucky roll lets you jump ahead. These rows replace the stage rows they mention.

| # | Decision | Why |
|---|---|---|
| W1 | The 20 Suburbs stages became 20 worlds (`worlds.json`). A world is 4 regular waves, then its boss; while farming, the world loops. | Kevin's request; one difficulty step per world. |
| W2 | Every world is open from the start. The Worlds tab (and the globe button on the battle) lists all 20 with a threat read-out: Easy, Tough, Deadly, or ONE-SHOT. The read-out comes from real combat math against your current stats, including the boss: ONE-SHOT means one regular hit is lethal; otherwise a margin compares (your HP x DPS) to theirs. Deadly and ONE-SHOT trips need a second tap. | "Access to all of them, but literally get one-shot on the difficult ones." |
| W3 | Per world, enemy HP grows x3.0, ATK x2.6 and DEF x2.6. The DEF constant in the damage formula grows x2.6 too, so DEF keeps the same meaning in every world. Gold grows x3.0 per world (in step with enemy HP, so pay is proportional to difficulty); XP grows x1.35. | "They also pay proportionately more." |
| W4 | Items carry a tier: the world they were rolled in, capped at one past the best world beaten (so a suicide trip to World 20 can't farm World 20 gear). An item's flat HP/ATK/DEF/REGEN are multiplied by 1.9^(tier - 1); percent stats are not. Every slot now has a flat stat too, so every item's power grows with its world. | Better worlds drop better gear, the RNG-game loop. |
| W5 | Items grow slower than enemies (x1.9 against roughly x2.8 per world), so each world asks for better rarities, levels or upgrades than the last. Walls are broken by luck: a rare roll can carry you several worlds ahead. | "If the player gets lucky and rolls a really good item, they can advance." Without the gap, progress ran away (simulator: World 20 in 21 minutes). |
| W6 | A failed push falls back to the world it started from; a death in a world already beaten steps down one world, and each further death steps down again. A pushing raccoon that clears a world moves on to the next; a farming one retries the next unbeaten world once it is stronger than when it last died there. A "World N" button offers the next unbeaten world at any time. | |
| W7 | A world's first clear pays 10 + 5 x world Gems and a Luck Potion. Bosses pay 15x a regular kill's gold, 4x its XP, 3 Trash Bags, and drop a Luck Potion 15% of the time. | Bosses come every loop now, so potions can't be guaranteed. |
| W8 | Rebirth needs World 5 beaten (+2 worlds per rebirth, up to 20) and 3,000 x 3^(world - 1) x 4^rebirths gold. Luck per rebirth is +0.15 (was +0.25). Rebirth resets world progress. | Keeps rebirths from snowballing (simulator: hundreds per hour before this). |
| W9 | Rarities are rarer: Legendary 1 in 1,000, Mythic 1 in 25,000, Mint in Box 1 in 1,000,000 (Decent 3, Shiny 12, Epic 80). Rarity stat multipliers are wider: Junk 1, Decent 1.4, Shiny 2, Epic 3, Legendary 4.8, Mythic 8, Mint 14. Item level adds 6% per level (was 9%). Scrap XP no longer grows with the world. | Luck should decide progress, and big reveals should stay rare. |
| W10 | Save version 3: old stages map to worlds at 5 stages per world, existing items become World 1 gear, and the neighborhood bonuses are gone. | |
| W11 | Each world has its own sky (stars and a moon at night), a hue, saturation and brightness grade on the shared scenery (outlines are left untouched), enemy colors and names, and its own boss (Officer Dale, Big Earl or Vinnie in that world's colors). Changing worlds swaps the scene behind a quick sky-colored cover. A one-shot gets a "ONE SHOT!" stamp. | 20 worlds that look the same would feel like one. |

## Redesign (Nov 2): always-rolling RNG loop

Kevin asked for a Roblox-style rolling game: the dumpster rolls on its own, items carry a power number, a limited bag keeps the best ones, extra luck sources, an upgrade grid, rebirths that raise luck, and enchantments. These rows replace the older ones marked *superseded* below.

| # | Decision | Why |
|---|---|---|
| R1 | No dive button. A free roll happens every 2.0 s (the Roll Speed upgrade brings it down to 0.4 s), and Trash Bags won in fights are spent automatically as bonus rolls, 3 per second. | "Constantly rolling without having to click." |
| R2 | *Odds updated by W9.* Rarities are "1 in X" chances: Decent 3, Shiny 10, Epic 50, Legendary 400, Mythic 5,000, Mint in Box 100,000. A roll tries the rarest tier first, then each lower tier, and each try succeeds with chance min(1, luck / X). The Luck popup lists the exact per-roll chances, computed by the same function the roller uses. | The RNG-game convention. The odds shown are always the real ones (playbook). |
| R3 | Luck = (1 + Luck upgrades + 0.05 per Dumpster Level above 1 + Lucky enchantments) x rebirth multiplier x Luck Potion. Bad-luck protection is unchanged: from Dumpster Level 3, after 40 rolls with nothing Epic or better, the next roll is guaranteed Epic or better. | Dumpster upgrades still help, plus several new luck sources. |
| R4 | Every 10th roll is a Lucky Roll at x2 luck, shown on a meter. The Lucky Rolls upgrade lowers 10 to as few as 4. | A visible "something good is coming" beat between rare pulls. |
| R5 | Items have a power number. A roll is equipped automatically when it beats the equipped item's power (Auto-equip can be switched off in the Bag); otherwise it goes in the bag. The bag holds 20 items (+2 per Bag Space level), sorted by power. When it is full, the weakest unlocked item, or the new roll if it is weaker still, is scrapped for gold and XP. Locked items are never scrapped automatically. | "Keeps the highest-rated items." |
| R6 | Scrapping pays half the old recycle coins (times gold multipliers) and a quarter of the XP. Enchanted items pay +50% per enchantment tier. | Constant rolling would otherwise flood the economy. |
| R7 | The upgrade grid costs gold: Luck, Gold Gain, Roll Speed, Bag Space, Lucky Rolls, Enchanting, Strength (ATK%), Toughness (HP%), Bag Finder. Cost = base x growth^level, with a level cap per upgrade. Holding the buy button keeps buying. Upgrades reset on rebirth. | |
| R8 | *Requirements updated by W8.* Rebirth needs stage 10 cleared (+5 stages per rebirth, capped at the last stage) and 5,000 gold in hand (x4 per rebirth). Each rebirth gives luck x(1 + 0.25 per rebirth) and gold x(1 + 0.2 per rebirth), and resets stage progress, gold and upgrades. Items, the bag, player level, Dumpster Level, the Codex and Gems are kept. It takes two taps to confirm. | Keeping the bag and level makes rebirths feel like a boost instead of a loss. |
| R9 | Enchantments: each roll has a 5% chance (+1.5% per Enchanting level) of 1 to 3 enchantments (80/17/3%), each of tier I, II or III (70/25/5%). Every tier adds 15/30/55% item power. Lucky and Golden add luck and gold; Swift, Vampiric, Giant and Magnetic add attack speed, lifesteal, HP and bag find; Flaming burns, Thundering zaps the next enemy, Echoing strikes twice, Explosive makes kills splash, Thorny reflects damage, and Prismatic raises the item's rarity by 1 or 2 tiers. All of it is in `enchants.json`. | "Add power level and rarity, but also do interesting things." |
| R10 | Luck Potions give x2 luck for 60 s. One drops from every mini-boss and boss kill, and there is a 0.5% chance per regular wave. A new potion adds its time to one that is still running. | One more luck source, tied to fights. |
| R11 | Enemies got x2.4 HP and x1.7 ATK. | With a constant stream of gear, fights were over too fast to read and stages fell too quickly (simulator). |
| R12 | Save version 2. The migration moves an undecided dive item into the bag, adds the enchantment and lock fields, and drops Auto-Dive. | |
| R13 | Legendary and better rolls get a short build-up (the dumpster shakes and glows in the rarity's color, then a silence drop) and a full-screen reveal. Big rolls that land during a reveal wait their turn, up to 3. Epic gets a sting and a burst; lower rarities get a pop from the dumpster. | Big moments stay big, even when rolls are constant. |
| R14 | The look is now a bright, clean cel-shaded cartoon, matching the clean mobile-RPG style Kevin referenced (Capybara Go!), with our own characters and props. It replaces the painterly placeholder set. | Kevin's request. |
| R15 | Battle choreography: the raccoon closes to melee range, winds up and swings. Hit effects (slash trail, impact star, numbers, knockback, hit-stop on crits) play at the swing's impact frame, about 0.1 s after core resolves the hit, and an enemy stays on screen until its killing blow lands. HP bars with numbers sit under every fighter; FIGHT!, BOSS! and VICTORY! banners sweep across. | "Not just the character bumping into the other one." |
| R16 | Screen layout: battle (with the top HUD over the sky), a stat strip (Power, HP, ATK, DEF, Luck), then five tabs: Roll, Bag, Upgrades, Rebirth, Worlds. (The Shop placeholder tab gave way to Worlds.) | |

## Combat and stages

| # | Decision | Why |
|---|---|---|
| C1 | Only the front enemy fights at a time (`combat.engagedEnemies = 1`); the rest queue behind it. | Readable on a small battle panel. Bruiser's 2-enemy cleave (M3) can raise this. |
| C2 | *Superseded by W1.* A mini-boss or boss stage is 4 regular waves, then the boss alone as wave 5. Tapping Fight Boss starts that stage from wave 1. | Spec: stages "end with" a mini-boss/boss. |
| C3 | The boss wave pays the boss bags (5 or 15) instead of the normal 1 bag + BAG_FIND roll. Boss coin burst = 20 kills' worth of coins. Mini-boss/boss XP is x5/x10 a regular kill. | Spec gives the bag counts but not how they combine. |
| C4 | The raccoon heals 20% of max HP between waves and starts every stage at full HP. | Without some healing, 5 waves in a row are a pure HP check. |
| C5 | *Superseded by W6.* The farming stage is the highest cleared *regular* stage, never a boss stage. | Farming a boss stage would pay boss bags every loop. |
| C6 | *Superseded by W6.* After a death on a regular stage, the raccoon farms and retries automatically once its power (gear power + 10 per level) beats its power at death. A "Try stage ▶" button allows a manual retry any time. | "Auto-advances while it can win" without hammering a wall it cannot pass. |
| C7 | *Superseded by W1.* After the stage 20 boss (end of M1 content), the raccoon farms stage 19. | No stage 21 until M3. |
| C8 | Enemies never crit. DODGE applies to enemy hits. Lifesteal uses damage actually dealt (overkill does not count). Minimum damage per hit is 1. | Simplest reading of section 5. |
| C9 | Boss specials are data-driven (`heavyHit` or `enrage`). Officer Dale's "Catch Pole" hits for 2.5x every 6 seconds. | Spec: one special move defined in enemies.json. |
| C10 | *Removed by W10.* Neighborhood clear "+10% Trash Bag drops" is +10 BAG_FIND (same expected value); "+10% offline rewards" multiplies the offline payout. | |
| C11 | *Superseded by W11 (every world has its own roster colors, names and boss).* Suburbs roster: Alley Rat, Porch Pigeon, Punk Raccoon; mini-bosses Big Earl (stages 5 and 15) and Vinnie "Two Lids" (stage 10); boss Officer Dale, Animal Control. | Spec: 3 regular, 2 mini-bosses, 1 boss, but 3 mini-boss stages, so one returns. |

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
| I9 | *Superseded by R5.* Equipping an item recycles the one it replaces. There is no inventory in M1. | Simplest loop; the spec never mentions a stash. |
| I10 | *Superseded by R5.* Items matching the keep filters pause Auto-Dive and open the compare card instead of going to a stash. The default keep filter is "Legendary+" (which already pauses), so there are no extra pauses until the player sets one. | No inventory in M1 (I9). |
| I11 | Max HP gained from a level-up or a new item is also added to current HP. | Equips should feel immediate. |
| I12 | The scripted first dive is the Legendary Traffic Cone of Destiny at item level 1 with 3 rolled substats. | |

## Dumpster

| # | Decision | Why |
|---|---|---|
| D1 | Upgrade cost and time use the current level: going from level L to L+1 costs 400 x 1.85^(L-1) coins and takes 60 s x 1.65^(L-1). | |
| D2 | The bad-luck counter counts every dive since the last Epic-or-better and only *triggers* from Dumpster Level 3. The guaranteed roll uses the table restricted to Epic and up. | |
| D3 | *Superseded by R1 (no manual dives).* The near-miss gold tease (10% of Epic rolls) is rolled in core with the seeded Rng and sent in the dive event. Free dives only, per the Dopamine Playbook. | Keeps it deterministic and testable. |
| D4 | Ad speedups reset at local midnight. | Same as other daily caps. |
| D5 | New players start with 3 Trash Bags, 50 Gems, 0 coins. | So the first tap can dive. |
| D6 | *Superseded by R1.* Auto-Dive unlocks at 8 minutes of cumulative play time (not wall time) and shows an explainer with "Turn it on". | |

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
| U4 | *Superseded by R5 and R13.* The compare card appears once the reveal lands. Popup priority: offline rewards, then the compare card, then the Auto-Dive unlock, then menus. Level-ups are non-blocking toasts. | |
| U5 | *Superseded by R14.* Art follows `docs/ART_DIRECTION.md`. The main screen uses *dark* cardboard so the dumpster stays the only accent ("everything else stays dark and quiet"); popups use full kraft. | The doc asks for both cardboard panels and a quiet screen. |
| U6 | *Superseded by R14 (green for go, gold for featured actions, red for danger and bosses, blue for secondary, gray when unavailable).* Buttons: lime for go, gold for spending coins or gems, gray for secondary. "Collect" is primary and "Collect x2" (ad) is secondary. | Art direction button system. |
| U7 | Bosses are drawn about 1.3 to 1.5x the raccoon's height (the battle panel is 820 px). Earlier: bosses are drawn about 2x the raccoon's height, not 3x, so they fit the 768 px battle panel. | |
| U8 | Mint in Box color is `#FFF4D6` and the Gem icon is sea glass, from the art doc. Item art IDs are `<item_id>_icon` and `<item_id>_overlay` (the doc's naming), mapped to files in `assets.json`. | The art doc is newer and more specific than the spec's example. |
| U9 | Fonts (Lilita One, Nunito) are bundled with `@fontsource` so they work offline in the native app. | |
| U10 | Sound and music are synthesized with the Web Audio API (no audio files) and start on the first tap, as browsers require: a lo-fi loop in C major, rarity-scaled rattle, riser and reveal stings, a silence drop before Legendary+, pitch-stacked coins, button pops. Real recorded audio replaces it in M5. Haptics use Capacitor's presets; custom patterns need a native plugin (playbook note). | Kevin asked for sound before M5. |
| U12 | *Superseded by R14.* Placeholder art follows the painterly storybook direction (`docs/ART_DIRECTION.md`, Nov 2 update): everything is painted in code on canvases with a brush toolkit, then registered as textures or data URLs. | Kevin's style update. |
| U11 | The dev cheat panel shows in dev builds, or in any build made with `VITE_CHEATS=true`. Extra helpers beyond the spec: "Last wave" (jump to a stage's boss wave) and "Set dumpster Lv". | |

## Balance

The simulator (`npm run sim`) plays the real core with a bot that lets the dumpster roll (equipped automatically, bag kept by power), lets the battle push through worlds on its own, buys the cheapest upgrade it can afford every second, upgrades the dumpster when it can, rebirths as soon as it is allowed, and every 10 seconds jumps to the hardest world that reads Easy. With the current numbers, across 4 seeds over 2 hours:

- World 2 beaten at 1.5 to 3 minutes, World 3 at 5 to 7, World 4 at 10 to 14, World 5 at 18 to 23, World 7 at 38 to 44, World 8 at 54 to 65, World 9 at 81 to 105, World 10 at 100 to 107 (three of four seeds). Each world takes longer than the last, as intended; World 20 is long-term play.
- Rebirths at about 20, 40, and 80 to 105 minutes.
- Per 2 hours: about 13,000 rolls, 83 to 121 Legendaries (roughly one a minute once luck builds up), 3 to 9 Mythics, no Mint in Box. 38 to 51 deaths, nearly all failed pushes into the next world.

Earlier results (the tap-to-dive version and the single-neighborhood roller) are in the git history.

## Tech

| # | Decision | Why |
|---|---|---|
| T1 | TypeScript 5.9 (not the new 7.x), Vite 8, Vitest 5, React 19, Phaser 3.90, Zustand 5, zod 4, Capacitor 8. | Current stable versions with known-good tooling. |
| T2 | Core actions use immer `produce`: `(state, input, rng, now) => { state, events }` stays pure and the result is frozen. | |
| T3 | The `GameState` TypeScript type is inferred from its zod schema, so save validation and types cannot drift apart. | |
