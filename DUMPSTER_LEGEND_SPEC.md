# DUMPSTER LEGEND: Build Spec

Idle RPG roguelite for iOS and Android. Portrait, one thumb, free to play. Singleplayer at launch; social features come after soft launch.

## How to Use This Spec (for Kevin)

1. Create an empty project folder and put this file in it.
2. Open Claude Code in that folder and say: "Read DUMPSTER_LEGEND_SPEC.md. Build Milestone 0 and Milestone 1 only, then stop and tell me how to run it."
3. Playtest. Then ask for the next milestone.

## Instructions for Claude Code

- Build one milestone at a time (Section 20). Do not start the next milestone until the current one meets its "Done when" criteria.
- Keep all game logic pure, deterministic, and testable. No rendering code in `src/core/`.
- Every tuning number lives in `src/data/balance.json`. No magic numbers in code.
- Every player-facing string lives in `src/data/strings.en.json`.
- All content (items, enemies, perks, events, crew, and so on) is JSON data validated with zod at boot.
- Use placeholder art (colored shapes plus text labels) until real art exists. Load art through an asset manifest so it can be swapped without code changes.
- Never call `Math.random()` in game logic. Use the seeded `Rng` class.
- When this spec is silent or ambiguous, choose the simplest option and record it in `DECISIONS.md`.
- Write Vitest tests for every formula and every random system (distribution tests over 10,000 rolls).

---

## 1. Game Summary

You play a raccoon trying to become the legend of the city's alleys. The raccoon auto-battles waves of rats, pigeons, seagulls, rival raccoon gangs, and animal control officers. Enemies drop Trash Bags. Each Trash Bag is one Dumpster Dive: a free loot pull that produces a random piece of junk gear (traffic-cone helmet, pizza-box shield, fork spear) that the raccoon visibly wears. Better gear lets the raccoon push further into the city. Three times a day the player can run a Heist: a short one-tap roguelite run with event choices, 3-choice perks, and a boss.

### Design Pillars

1. **Trash is treasure.** Every dive is a slot-machine moment with anticipation, sound, and haptics.
2. **Always progressing.** Combat is automatic and continues offline.
3. **Heists add real decisions.** Quick roguelite runs with perks that combo and evolve.
4. **Funny and visible.** Absurd item names and flavor text; all gear shows on the raccoon.

### Core Loops

- **30-second loop:** The raccoon kills a wave, Trash Bags drop, the player dives, equips or recycles, numbers go up.
- **Session loop (5 to 10 minutes):** Collect offline rewards, dive the backlog, upgrade the dumpster, run a Heist, push a boss.
- **Daily loop:** 3 Heist Tickets, daily tasks, Junkyard and Trash Truck attempts, Hideout jobs, a free Crew Call.
- **Long-term loop:** Clear neighborhoods, raise the Dumpster Level, collect Crew and Tricks, complete the Codex, climb the Trash Pass.

---

## 2. Tech Stack

| Layer | Choice |
|---|---|
| Language and build | TypeScript, Vite |
| Battle view and effects | Phaser 3 |
| Menus and UI | React overlay on top of the Phaser canvas, CSS modules |
| State | Zustand store holding one `GameState` object |
| Data validation | zod |
| Tests | Vitest |
| Mobile packaging | Capacitor (iOS and Android) |
| Native plugins | @capacitor/preferences (saves), @capacitor/haptics, @capacitor/app (pause and resume), @capacitor/local-notifications |
| Rewarded ads | AdMob through a Capacitor plugin (for example @capacitor-community/admob), test ad units until launch |
| In-app purchases | RevenueCat Capacitor SDK, sandbox until launch |
| Analytics | Firebase Analytics or GameAnalytics, behind an `analytics.ts` wrapper |
| Remote config | Firebase Remote Config overriding values in balance.json (Milestone 6) |

The game must run in a desktop browser for development, with ads and purchases mocked behind interfaces (`AdsService`, `IapService`) so the real SDKs can be dropped in later without touching game logic.

---

## 3. Architecture

```
src/
  main.ts
  core/                 pure game logic, no rendering, fully tested
    state.ts            GameState type, store, actions
    rng.ts              seeded PRNG (mulberry32 or similar)
    time.ts             clock, day boundaries, offline time, clock-cheat guard
    save.ts             load, save, backups, migrations
    format.ts           big number formatting
    systems/
      combat.ts         fixed-tick battle simulation
      stages.ts         stage and wave generation, enemy scaling
      loot.ts           item generation and power score
      dumpster.ts       dives, rarity tables, upgrades, auto-dive filters
      progression.ts    XP, levels, class
      offline.ts        offline reward calculation
      heist.ts          run state machine, nodes, events, perks, evolutions
      crew.ts  rides.ts  tricks.ts  shiny.ts  hideout.ts  truck.ts  junkyard.ts
      codex.ts  tasks.ts  pass.ts  vip.ts  unlocks.ts  offers.ts  gacha.ts
  services/             interfaces plus mock and real implementations
    ads.ts  iap.ts  analytics.ts  haptics.ts  notifications.ts  storage.ts
  data/                 JSON content and tuning, validated at boot
  render/               Phaser scenes: BattleScene, DumpsterFx, HeistScene
  ui/                   React screens and components
  dev/                  cheat panel (dev builds only)
tests/
```

### Rules

- `core/` exposes pure functions shaped like `(state, input, rng, now) => { state, events }`. Rendering and UI only read state and dispatch actions.
- Combat runs on a fixed tick (10 ticks per second). Rendering interpolates and plays effects from emitted events (hit, crit, kill, drop).
- One `GameState` object is the single source of truth, and it is what gets saved.
- Dev cheat panel: add currencies, set stage, skip time by N hours, force the next rarity, unlock all systems, reset save.

---

## 4. Screen Layout

Portrait, logical resolution 1080 x 1920, scaled to fit, respecting safe areas.

| Area | Height | Contents |
|---|---|---|
| Top bar | 7% | Player level and XP bar, Coins, Gems, Settings |
| Battle panel | 40% | Phaser canvas: raccoon walking right, enemies entering from the right, stage label (for example "Suburbs 1-7"), Fight Boss button when available |
| Dumpster panel | 20% | Big dumpster button with Trash Bag count, Auto-Dive toggle, last item preview, Dumpster Level and upgrade timer |
| Gear grid | 23% | 10 equipped slots with rarity frames, power score, side buttons for unlocked systems |
| Bottom nav | 10% | Alley (home), Heists, City, Crew, Shop |

Popups: item compare card, level up, offline rewards, system unlock, offers, odds disclosure.

In Heists, the battle panel shows the fight and the lower half becomes a scrolling event log with a big Go button.

---

## 5. The Alley (Idle Combat)

### Player Stats

| Stat | Base (level 1) | Per level |
|---|---|---|
| HP | 100 | +12 |
| ATK | 10 | +1.5 |
| DEF | 0 | +0.5 |
| ATK_SPD (attacks per second) | 1.0 | 0 |
| CRIT (%) | 5 | 0 |
| CRIT_DMG (%) | 150 | 0 |
| DODGE (%) | 0 | 0 |
| LIFESTEAL (%) | 0 | 0 |
| REGEN (HP per second) | 1 | +0.1 |
| BAG_FIND (%) | 0 | 0 |
| COIN_FIND (%) | 0 | 0 |
| BOSS_DMG (%) | 0 | 0 |

Final stat = (base + level bonus + flat gear stats) x (1 + sum of % bonuses from gear, Crew, Rides, Tricks, Shiny Things, Codex, and Class).

Caps: CRIT 75%, DODGE 60%, ATK_SPD 5.0.

### Damage

```
damage = ATK x (100 / (100 + targetDEF)) x (isCrit ? CRIT_DMG / 100 : 1) x random(0.95, 1.05)
```

Dodge negates a hit completely. Lifesteal heals a percentage of damage dealt. BOSS_DMG multiplies damage against mini-bosses and bosses.

### Stages

- Each neighborhood has 20 stages. The global stage number runs 1 to 60 in the MVP.
- Each stage has 5 waves of 3 to 5 enemies.
- Stages 5, 10, and 15 of each neighborhood end with a mini-boss. Stage 20 ends with the neighborhood boss.
- Enemy HP = baseHP x 1.13^(globalStage - 1)
- Enemy ATK = baseATK x 1.10^(globalStage - 1)
- Enemy DEF = baseDEF x 1.08^(globalStage - 1)
- Mini-boss: x5 HP, x1.5 ATK. Boss: x10 HP, x2 ATK, plus one special move defined in enemies.json.

### Progression Rules

- The raccoon auto-advances while it can win.
- If it dies, it drops back to the last cleared stage and farms it on loop. Show a hint pointing at the dumpster: "Too tough! Dive for better gear."
- Mini-boss and boss stages require tapping Fight Boss, so farming continues until the player chooses to try.

### Drops

- Each kill: coins = 5 x 1.10^(globalStage - 1) x (1 + COIN_FIND), and XP = 3 x 1.09^(globalStage - 1).
- Each wave clear: 1 Trash Bag, plus a BAG_FIND % chance of a second one.
- Mini-boss: 5 Trash Bags. Boss: 15 Trash Bags plus a coin burst.

---

## 6. Dumpster Dives (Loot Engine)

### A Dive

1. Spend 1 Trash Bag.
2. Roll a slot (uniform across the 10 slots; weights in balance.json).
3. Roll a rarity from the current Dumpster Level table.
4. Item level = clamp(playerLevel + randInt(-2, +1), 1, levelCap).
5. Pick a base item for that slot from the active dumpster theme in items.json.
6. Roll substats.
7. Play the lid flip (Section 14), then show the compare card: Equip or Recycle.

### Slots and Main Stats

| Slot | Main stat | Shown on raccoon |
|---|---|---|
| Hat | HP | Yes |
| Mask | CRIT | Yes |
| Jacket | HP and DEF | Yes |
| Weapon | ATK | Yes |
| Shield | DEF | Yes |
| Gloves | ATK_SPD | Yes |
| Sneakers | DODGE | Yes |
| Backpack | BAG_FIND | Yes |
| Bling | CRIT_DMG | Small sparkle |
| Ring | LIFESTEAL | Small sparkle |

Main stat value = slotBase x (1 + 0.09 x (itemLevel - 1)) x rarityMultiplier

### Rarities

| Rarity | Color | Multiplier | Substats | Recycle XP | Recycle Coins |
|---|---|---|---|---|---|
| Junk | Gray #9E9E9E | 1.0 | 0 | 5 | 10 |
| Decent | Green #4CAF50 | 1.25 | 1 | 12 | 25 |
| Shiny | Blue #2196F3 | 1.6 | 1 | 30 | 60 |
| Epic | Purple #9C27B0 | 2.1 | 2 | 80 | 150 |
| Legendary | Gold #FFB300 | 2.8 | 3 | 250 | 450 |
| Mythic | Rainbow gradient | 3.8 | 4 | 800 | 1,400 |
| Mint in Box | Sparkling white-gold | 5.2 | 4 plus a unique perk | 2,500 | 4,000 |

Recycle rewards are multiplied by (1 + 0.05 x itemLevel). Recycling is the main source of XP, so every dive matters even when the item is junk.

### Substats

12 substats in affixes.json: ATK%, HP%, DEF%, ATK_SPD%, CRIT, CRIT_DMG, DODGE, LIFESTEAL, REGEN, BAG_FIND, COIN_FIND, BOSS_DMG. No duplicate substat on one item. Value ranges scale with item level.

### Power Score

A weighted sum of all stats on an item (weights in balance.json). Used for compare arrows and auto-equip.

### Dumpster Level (1 to 30)

Rarity weights by level. Interpolate linearly between rows.

| Level | Junk | Decent | Shiny | Epic | Legendary | Mythic | Mint |
|---|---|---|---|---|---|---|---|
| 1 | 72 | 24 | 3.6 | 0.4 | 0 | 0 | 0 |
| 5 | 55 | 32 | 10 | 2.6 | 0.4 | 0 | 0 |
| 10 | 38 | 35 | 18 | 7 | 1.8 | 0.2 | 0 |
| 15 | 25 | 33 | 24 | 13 | 4.3 | 0.65 | 0.05 |
| 20 | 15 | 28 | 28 | 19 | 8 | 1.8 | 0.2 |
| 25 | 8 | 22 | 30 | 24 | 12.5 | 3.2 | 0.3 |
| 30 | 4 | 16 | 30 | 28 | 17 | 4.5 | 0.5 |

- Upgrade cost: coins = 400 x 1.85^(level - 1)
- Upgrade time = 60 seconds x 1.65^(level - 1), capped at 24 hours. Only one upgrade runs at a time.
- Gem speedup: 1 Gem per 2 minutes remaining (minimum 1).
- Rewarded ad speedup: minus 30 minutes, 3 per day.
- Bad luck protection: from Dumpster Level 3, if 40 dives in a row produce nothing Epic or better, the next dive is at least Epic.
- Tutorial: the very first dive is a scripted Legendary Hat, "Traffic Cone of Destiny".

### Auto-Dive

- Unlocks at minute 8 of the first session (Section 15).
- Dives one bag every 0.6 seconds (faster with the Monthly Card or Sugar Rush).
- Auto-equips anything with a higher power score. Auto-recycles everything else except items matching the player's keep filters (minimum rarity to keep, specific substats).
- Pauses and plays the full lid flip for Legendary or better.

### Codex

The first time a base item is found at each rarity, it is added to the Trash Codex. Every 10 entries grants a permanent bonus (cycling through +1% ATK, +1% HP, +1% BAG_FIND).

---

## 7. Levels and Class

- XP to next level = 60 x level^1.7
- At level 30 the player picks a class (free the first time, Gems to respec):
  - **Bruiser:** +25% HP, +15% DEF, attacks cleave 2 enemies.
  - **Slinger:** +25% ATK_SPD, +10 CRIT, ranged attacks.
  - **Schemer:** Crew deal +50% damage, and the third Crew slot unlocks immediately.
- Class evolutions at level 60 come after launch.

---

## 8. Offline Progress

- While the app is active, track an average rewards-per-minute rate (Trash Bags, coins, XP) over the last 10 minutes at the current farming stage. If there is no data yet, estimate it from the stage's expected clear time.
- On pause, save `lastActiveAt` and the current rate.
- On resume: elapsed = clamp(now - lastActiveAt, 0, offlineCap). offlineCap = 8 hours (+4 hours with the Monthly Card).
- Reward = rate x elapsed minutes x 0.75 (offline efficiency, in balance.json).
- If the device clock went backward (now < lastActiveAt), grant nothing and reset `lastActiveAt`.
- Popup: "While you were out, your raccoon found..." with Collect and Collect x2 (rewarded ad, only if away 30+ minutes).
- Schedule a local notification for when the offline cap fills: "Your dumpster is overflowing!"

---

## 9. Heists (Roguelite Runs)

### Access

- 3 free Heist Tickets per day, reset at local midnight. Players can hold up to 6.
- +1 Ticket from a rewarded ad (once per day). The Trash Pass premium track adds +1 per day.

### Locations (MVP)

| Location | Unlock | Boss |
|---|---|---|
| The Pizza Place | First session, minute 10 | Chef Tony (throws pizzas, enrages at 50% HP) |
| Mall Food Court | Complete the Suburbs | Mall Cop Doug (rides a Segway, charges) |
| Five-Star Hotel | Complete the Strip Mall | The Concierge (summons bellhops) |

### Run Structure

- 3 acts of 6 nodes, then a boss: 19 nodes total, about 3 to 5 minutes.
- The player taps Go to resolve the next node. Each node adds a line to the scrolling log; fights play out in the battle panel at 2x speed, using the same combat code as the Alley.
- Act difficulty multipliers: 1.0, 1.4, 1.9. The boss uses the act 3 multiplier on top of its boss stats.
- Run stats start from the player's main stats x heistScaling (balance.json), so main progression matters.
- Run HP carries over between nodes. The run ends when Run HP reaches 0.

### Node Types (weights per act in balance.json)

| Node | Default weight | Effect |
|---|---|---|
| Fight | 40 | Auto-fight; elite fights can appear from act 2 |
| Choice | 25 | A text event with 2 or 3 options (heistEvents.json) |
| Treasure | 10 | Run coins, Trash Bags, or a material |
| Shop | 8 | Spend run coins on heals, perks, and rerolls. At least one Shop is guaranteed in act 2 |
| Shrine | 7 | Trade 20% max HP for an Epic perk |
| Trap | 5 | Lose HP or gain a curse |
| Jackpot Wheel | 5 | Spin for a random reward |

**Golden Dumpster:** a 1% chance per run to replace a Treasure node. It gives 10 dives at the player's Dumpster Level +5.

### Run Levels and Perks

- Fights give run XP. Run level thresholds: 3, 7, 12, 18, 25, 33, 42.
- Each run level-up offers 3 perks (rarity weights: Common 70, Rare 25, Epic 5). One free reroll per run via rewarded ad, then 10 Gems per reroll.
- Max 8 perks per run.
- Perks have tags: fire, speed, loot, crit, tank, crew, chaos.
- Evolutions: when the player holds both ingredients of a recipe, the next perk offer guarantees the evolution as a glowing option.

Starter perks (expand to 24 in the same voice):

| Perk | Tag | Effect |
|---|---|---|
| Garbage Day | loot | +50% Trash Bags from this run |
| Bin Diver | loot | +1 Treasure node per act |
| Hot Sauce | fire | 20% chance on hit to burn for 3 seconds |
| Dumpster Fire | fire | Burning enemies take +25% damage |
| Sugar High | speed | +25% attack speed |
| Zoomies | speed | +15% dodge |
| Lucky Penny | crit | +10 crit chance |
| Sharp Fork | crit | +40% crit damage |
| Thick Fur | tank | +25% max HP |
| Lid Shield | tank | Block the first hit of each fight |
| Snack Break | tank | Heal 15% after each fight |
| Pigeon Pal | crew | A pigeon pecks for 20% of ATK every 2 seconds |
| Feral | chaos | +1% attack speed per 1% missing HP |
| Pocket Sand | chaos | 15% chance on hit to stun for 1 second |

Evolutions (expand to 6 total if more are added later):

| Evolution | Recipe | Effect |
|---|---|---|
| Five-Alarm Raccoon | Hot Sauce + Dumpster Fire | Burns spread to all enemies and deal double damage |
| Turbo Trash Panda | Sugar High + Zoomies | Every dodge triggers a free attack |
| Jackpot Paws | Lucky Penny + Sharp Fork | +100% crit damage; crits drop run coins |
| Fortress of Junk | Thick Fur + Lid Shield | Block one hit every 5 seconds |
| Pigeon Air Force | Pigeon Pal + any other crew perk | Three pigeons instead of one |
| Unhinged | Feral + Pocket Sand | Below 30% HP, every hit stuns |

Curses (negative perks from Traps and risky choices): Paper Cuts (lose 1% HP per node), Sticky Paws (-15% attack speed), Smelly (+1 Fight node per act). Curses do not count toward the 8-perk limit and can be removed at Shops.

### Choice Events (write 40 total in this voice)

Each event has an id, text, allowed acts, weight, and 2 or 3 options. Each option has one or more outcomes: heal, damage, gain perk, gain curse, run coins, Trash Bags, start fight, start elite fight, skip next node, open shop, or nothing. Outcomes can have probabilities.

- "A cat challenges you to a staring contest." [Stare back: 60% gain Lucky Penny, 40% lose 10% HP] [Hiss: elite fight with double rewards] [Offer a fish: lose 20 run coins, heal 30%]
- "You find half a burrito." [Eat it: heal 50%] [Save it: auto-heal 40% once when below 20% HP] [Throw it at the guard: skip the next fight]
- "A raccoon in a trench coat wants to sell you something." [Open the shop]
- "The kitchen door is open." [Sneak in: Treasure] [Wait: nothing] [Barge in: elite fight]
- "A security camera blinks red." [Unplug it: lose 10% HP, no Traps this act] [Smile: gain a random Common perk] [Run: skip this node]
- "A pile of lottery tickets." [Scratch one: Jackpot Wheel] [Take them all: +30 run coins, 25% chance of the curse Paper Cuts]
- "Your cousin Rocco shows up." [Recruit him: gain a crew perk] [Borrow money: +50 run coins, -10% max HP] [Ignore him: nothing]
- "A rat offers a truce." [Accept: no fights for 2 nodes] [Refuse: fight with +50% run XP]

### Ending a Run

- **Win:** Trash Bags (Pizza Place 20, Food Court 40, Hotel 60), coins, system materials (Crew Tickets, Ride Parts, Trick Scrolls, Shiny Fragments), and a 2% chance at Heist-exclusive gear.
- **Loss:** Offer Second Chance once per run: revive at 50% HP via rewarded ad (one free per run), 50 Gems, or the $1.99 Second Chance purchase. If declined, the player keeps 50% of the rewards collected so far.
- The first Pizza Place run is tuned for about an 85% win rate. Later Heists target 50% to 65%.

---

## 10. The City (Neighborhoods)

| Neighborhood | Stages | Dumpster theme | Example items |
|---|---|---|---|
| Suburbs | 1 to 20 | Curbside | Lawn gnome hat, garden hose whip, welcome mat shield |
| Strip Mall | 21 to 40 | Food Court | Fork spear, pizza box shield, soda cup helmet |
| Downtown | 41 to 60 | Office Tower | Stapler gloves, necktie whip, briefcase shield |

Later neighborhoods (after the MVP): Stadium, Airport (lost luggage), City Hall.

- Each neighborhood has 3 regular enemy types, 2 mini-bosses, 1 boss, and its own 3-layer parallax background.
- Beating a neighborhood's stage 20 boss completes it: a permanent +10% to offline rewards and Trash Bag drops, and that neighborhood's dumpster theme unlocks.
- The player chooses which unlocked dumpster theme is active. Themes change item names, flavor text, art, and substat weights, and each theme has 3 unique Legendaries.

---

## 11. Meta Systems

### Unlock Schedule

A system unlocks when the player meets BOTH its progress requirement and its account-day requirement (day 1 = install day). Each unlock shows an intro popup, starts a 24-hour launch event with 3 tasks, and offers a themed bundle (Section 13).

| System | Progress requirement | Day |
|---|---|---|
| Dumpster Dives, Gear, Trash Pass, Daily Tasks | Stage 1 | 1 |
| Heists | First session, minute 10 | 1 |
| Crew | First Heist done | 1 |
| Rides and Junkyard | Stage 12 | 2 |
| Tricks | Stage 16 | 3 |
| Shiny Things | Stage 20 | 4 |
| Trash Truck | Stage 24 | 5 |
| Hideout | Stage 28 | 6 |
| Class | Player level 30 | 7 |
| Boss Rush (replay bosses for rewards) | Stage 40 | 10 |

### Crew (pets)

- 12 Crew at launch.
  - Common: Pigeon Gary, Sewer Rat, Squirrel.
  - Rare: Possum, Seagull, Crow, Skunk.
  - Epic: Cousin Rocco (raccoon), Goose, Alley Cat.
  - Legendary: Ibis (the "Bin Chicken"), Opossum Queen.
- Equip up to 3 (slot 2 at stage 10, slot 3 at stage 30). Each has an auto-cast active skill and a passive stat bonus.
- **Crew Call (gacha):** 1 Crew Ticket or 30 Gems per pull; a 10-pull costs 270 Gems.
- Rates: Common 70%, Rare 24%, Epic 5.4%, Legendary 0.6%.
- Pity: Epic or better guaranteed every 10 pulls. Legendary guaranteed at 80 pulls. The counter persists and is visible to the player.
- Duplicates become shards for star-ups (1 to 5 stars). Shards needed per star: 2, 5, 10, 20. Each star adds +20% to that Crew member's stats.
- Free sources (Heists, daily tasks, the pass, the daily rewarded ad) should give a non-paying player roughly 70% of the Legendary pity each month.

### Rides (mounts)

- Shopping Cart, Skateboard, Roomba, RC Truck, Ride-On Mower. Each gives stats plus one passive (for example, Roomba: +10% coins).
- Ride Parts come from the Junkyard: 2 keys per day (+1 via rewarded ad). The Junkyard is a 10-wave survival mini-battle using the main combat code; rewards scale with waves cleared.
- Ride level-ups cost Ride Parts plus coins.

### Tricks (skills)

- 10 Tricks: Trash Can Slam (area damage), Banana Peel (stun), Stink Bomb (damage over time), Pizza Throw (single target), Shopping Bag Shield (shield), Raccoon Roar (ATK buff), Bottle Rocket, Recycling Bin Trap, Lid Frisbee, Midnight Snack (heal).
- Equip 3 (slots unlock at stages 16, 25, and 35). They auto-cast on cooldown.
- Obtained from Trick Scrolls (Heist rewards) or Trick Call (gacha with the same rates and pity rules as Crew, separate counter). Duplicates level them up.

### Shiny Things (relics)

- 4 sets of 4: Bottle Caps, Lost Jewelry, Car Keys, Arcade Tokens. Each item gives a small stat; completing a set gives a set bonus.
- Shiny Fragments (Heists, Trash Truck, Hideout) are spent to Polish: get a random missing item from a chosen set, or level up an owned one.

### Hideout (idle base)

- 3 job slots (the 4th and 5th are bought with coins). Jobs: Scavenging (Trash Bags), Sorting (coins), Night Watch (Shiny Fragments), Recycling Center (XP).
- The player assigns Crew to jobs. Output scales with Crew rarity and stars. Job lengths: 1, 4, or 8 hours. Collect when done.
- Hideout level (bought with coins) raises output.

### Trash Truck (daily boss)

- 2 attempts per day (+1 via rewarded ad). A 30-second damage race against the garbage truck. Rewards by damage tier: Gems, Crew Tickets, Shiny Fragments.
- Solo in the MVP. Becomes a Gang co-op raid in Milestone 7.

### Daily Tasks

6 per day from a pool of 12 (dive 50 times, win a Heist, beat a boss, upgrade anything, collect offline rewards, attack the Trash Truck, and so on). Each gives Trash Pass XP and Gems. Completing all 6 opens a bonus chest. No daily task may require watching an ad.

### Trash Pass (season pass)

- 6-week seasons, 40 tiers. Pass XP comes from daily tasks, Heists, and dives (1 XP per 10 dives).
- Tracks: Free, Premium ($4.99), Deluxe ($9.99: Premium plus 10 instant tiers plus 30 Ad-Skip Tickets).

---

## 12. Economy

| Currency | Used for | Sources |
|---|---|---|
| Coins | Dumpster, Ride, Hideout, and star upgrades | Kills, recycling, offline, Heists, Hideout |
| Gems | Speedups, gacha, revives, rerolls, refills | Purchases, daily tasks, pass, Codex, Trash Truck, achievements |
| Trash Bags | Dumpster Dives | Waves, bosses, offline, Heists, Hideout, bundles |
| Heist Tickets | Heists | Daily refill, rewarded ad, pass |
| Crew Tickets and Trick Scrolls | Gacha pulls | Heists, daily tasks, pass, events |
| Ride Parts | Ride upgrades | Junkyard |
| Shiny Fragments | Shiny Things | Heists, Trash Truck, Hideout |
| Ad-Skip Tickets | Claim rewarded-ad rewards without watching | Deluxe pass, VIP |

- Target: a non-paying player earns about 50 Gems per day. The Monthly Card adds about 100 per day.
- Anything random that can be bought (Gem-bought dives, gacha pulls) must have its odds shown in the game.

---

## 13. Monetization

Principles: purchases first, rewarded ads as support. No interstitials and no banners. No offers or ads in the first 3 minutes. At most one popup offer per session start, plus contextual offers (system unlocks and Heist losses). Every offer has a cooldown.

### In-App Purchases (RevenueCat)

| Product ID | Type | Price | Contents | When it appears |
|---|---|---|---|---|
| starter_pack | One-time | $0.99 | Legendary "Paper Crown" hat, 200 Gems, 50 Trash Bags, 2x dive speed for 24 hours | Right after the first Heist win, available for 24 hours |
| unlock_bundle_{system} | Limited | $1.99 to $9.99 | Materials for the newly unlocked system | During that system's 24-hour launch event |
| second_chance | Consumable | $1.99 | Heist revive plus 50 Gems | On a Heist loss, after the free ad revive is used |
| gems_t1 to gems_t6 | Consumable | $0.99, $4.99, $9.99, $19.99, $49.99, $99.99 | 80, 450, 950, 2,000, 5,300, 11,000 Gems (first purchase of each tier doubled) | Shop |
| monthly_card | 30 days | $4.99 | 300 Gems now, 100 Gems per day (claimed daily), +4 hours offline cap, +50% auto-dive speed | Shop, from day 2 |
| trash_pass_premium | Season | $4.99 | Premium track | Pass screen |
| trash_pass_deluxe | Season | $9.99 | Premium track, 10 instant tiers, 30 Ad-Skip Tickets | Pass screen |
| skin_{id} | One-time | $4.99 to $14.99 | Cosmetic raccoon outfits (no stats) | Shop and events |

### VIP

VIP points = cents spent. 10 VIP levels with perks such as daily free Gems, +1 Trash Truck attempt, Ad-Skip Tickets, and a VIP badge. Do not lock basic quality-of-life features behind VIP.

### Rewarded Ad Placements

| Placement | Reward | Cap |
|---|---|---|
| offline_double | Double offline rewards | Once per return (away 30+ minutes) |
| heist_ticket | +1 Heist Ticket | 1 per day |
| free_crew_call | 1 free Crew Call | 1 per day |
| sugar_rush | 2x dive speed for 30 minutes | 3 per day |
| heist_revive | Second Chance revive | 1 per Heist run |
| perk_reroll | Free perk reroll | 1 per Heist run |
| junkyard_key | +1 Junkyard key | 1 per day |
| truck_attempt | +1 Trash Truck attempt | 1 per day |
| dumpster_speedup | Minus 30 minutes on a dumpster upgrade | 3 per day |

Global cap: 15 rewarded ads per day. There is no Remove Ads purchase; Ad-Skip Tickets cover that need.

### Compliance

- Odds disclosure screens for Crew Call, Trick Call, the Dumpster rarity tables, and the Jackpot Wheel.
- iOS App Tracking Transparency prompt and Google UMP consent before personalized ads.
- Follow regional loot box rules. Paid random items must be switchable off per region through remote config.

---

## 14. Feel and Juice

### The Lid Flip (manual dive)

| Time | What happens |
|---|---|
| 0.00s | Tap: the dumpster squashes 5%, clunk sound, light haptic |
| 0.00 to 0.45s | The lid rattles three times; a gray glow leaks out |
| 0.45 to 0.95s | The glow steps up through rarity colors to the rolled rarity. Near-miss tease: 10% of Epic rolls flash gold for 0.15s before settling on purple |
| 0.95s | The lid pops open, the item icon arcs into its gear slot, the rarity sound plays |
| Epic | Purple particle burst, medium haptic |
| Legendary and up | 0.3s slow motion, screen flash, coin shower, heavy haptic, unique sting, banner with the item name and its joke text |

Auto-dive uses a compressed 0.25s version, but Legendary and up still play the full sequence and pause auto-dive.

### Combat

- Damage numbers: white (normal), yellow and larger (crit), orange (burn), green (heal).
- Hit flash on enemies, a small screen shake on crits and boss hits, enemies knocked off-screen on death, coins pop and fly to the counter.

### Sound

- Dive sounds by item material: plastic crinkle, tin clank, glass clink, squelchy food.
- 7 rarity stings, hits, crits, level up, boss intro, UI taps, a page-flip sound for the Heist log.
- Music: lo-fi alley loop (main), upbeat Heist loop, boss loop.

### Haptics

Light for taps, medium for Epic items and crits, heavy for Legendary items and boss kills. Toggle in settings.

### Number Format

999, 1.2K, 3.4M, 5.6B, 7.8T, then aa, ab, ac. Use plain JavaScript numbers; switch to a big-number library only if values pass 1e15.

---

## 15. First Session Script

| Time | Beat |
|---|---|
| 0:00 | No menus. The raccoon is chased down an alley by a rat twice its size. A hand pointer shows the dumpster. |
| 0:05 | The first dive is the scripted Legendary Traffic Cone of Destiny with the full lid flip. The raccoon wears it and sends the rat flying. |
| 0:20 | The hand pointer explains Equip vs. Recycle on the second dive. The tutorial is done by 0:30. |
| 1:00 to 3:00 | Clear stages 1 and 2: about 20 dives, 5 or 6 items equipped, several level-ups. |
| 5:00 | Stage 5 mini-boss, Big Earl the Rat King. Tuned so most players lose the first try; the hint points to the dumpster. Dive, return, win. |
| 8:00 | Auto-Dive and auto-recycle unlock with a short explainer. |
| 10:00 | First Heist: The Pizza Place, tuned for about an 85% win rate. Reward: Pigeon Gary, the first Crew member. |
| 12:00 | The $0.99 Starter Pack offer appears right after the Heist win. |
| Exit | Explain offline progress. Ask for notification permission here, not at launch. |

---

## 16. Art and Assets

- Style: 2D cartoon, chunky outlines, a night-time alley palette with neon signs. Funny, not gross.
- The raccoon is a paper doll: layered sprites with anchor points for Hat, Mask, Jacket, Weapon (main hand), Shield (off hand), Gloves, Sneakers, and Backpack. Every base item has an inventory icon and an equipped overlay sprite. Legendary and up add an aura effect.
- Build with placeholder art first: colored shapes and text labels generated in code.
- `assets.json` maps asset IDs to files. Missing art falls back to the placeholder automatically.

MVP asset list: the raccoon base plus overlays for 8 visible slots, 18 enemies (9 regular, 6 mini-bosses, 3 bosses), 3 neighborhood backgrounds, 3 Heist backgrounds, 12 Crew, 5 Rides, 10 Trick icons, 16 Shiny Things, rarity frames, currency icons, and a UI kit.

---

## 17. MVP Content Checklist

- Items: 10 slots x 6 base items x 3 dumpster themes = 180 base items, plus 9 unique Legendaries. Every item has a funny name and one line of flavor text ("Pizza Box Aegis: Smells like victory. Also pepperoni."). Generate placeholders in this voice and flag them in `CONTENT_TODO.md` for a human rewrite.
- 12 substats, 18 enemies, 60 stages, 3 neighborhoods.
- Heists: 3 locations, 40 Choice events, 24 perks, 6 evolutions, 3 curses, 3 bosses.
- 12 Crew, 5 Rides, 10 Tricks, 16 Shiny Things.
- 12 daily tasks, 40 Trash Pass tiers.

### Example item data

```json
{
  "id": "hat_traffic_cone",
  "slot": "hat",
  "theme": "curbside",
  "name": "Traffic Cone",
  "legendaryName": "Traffic Cone of Destiny",
  "flavor": "Orange is the new apex predator.",
  "material": "plastic",
  "art": { "icon": "icons/hat_traffic_cone", "overlay": "overlays/hat_traffic_cone" }
}
```

### Example Heist event data

```json
{
  "id": "evt_cat_staring_contest",
  "text": "A cat challenges you to a staring contest.",
  "acts": [1, 2, 3],
  "weight": 10,
  "options": [
    {
      "label": "Stare back",
      "outcomes": [
        { "chance": 0.6, "type": "gainPerk", "perkId": "lucky_penny" },
        { "chance": 0.4, "type": "damagePct", "value": 10 }
      ]
    },
    { "label": "Hiss", "outcomes": [{ "type": "eliteFight", "rewardMult": 2 }] },
    {
      "label": "Offer a fish",
      "outcomes": [
        { "type": "runCoins", "value": -20 },
        { "type": "healPct", "value": 30 }
      ]
    }
  ]
}
```

---

## 18. Saving

- One JSON `GameState` with a `saveVersion` field. Native builds use @capacitor/preferences; the web dev build uses localStorage.
- Autosave every 30 seconds, on app pause, and right after any purchase or gacha pull.
- Keep the 2 previous saves as backups. Write a migration function for every saveVersion bump.
- On launch, restore purchases through RevenueCat (one-time items, Monthly Card, passes).
- Store `lastActiveAt` and a monotonic play-time counter for the clock-cheat guard.

---

## 19. Analytics

Events:
- tutorial_step {step}
- session_start, session_end {seconds}
- stage_reached {stage}, boss_attempt {stage}, boss_win {stage}
- dive {rarity, dumpsterLevel, auto}, dumpster_upgrade {level}
- heist_start {location}, heist_end {location, result, node, perks}
- second_chance_shown, second_chance_used {method}
- gacha_pull {type, count, rarities}
- system_unlocked {system}
- offer_shown {offerId}, offer_purchased {offerId}, iap_purchase {productId, price}
- rv_shown {placement}, rv_completed {placement}
- daily_tasks_done, offline_collect {minutes, doubled}

Dashboard: D1, D7, and D30 retention, sessions per day, session length, % of players reaching stages 20 and 40, Heists per day, payer conversion, ARPDAU, rewarded ads per daily active user.

---

## 20. Milestones

### M0: Setup
Vite, TypeScript, Phaser, React overlay, Zustand, zod, Vitest. Capacitor configured for Android and iOS. Folder structure from Section 3. Seeded Rng. Data loading with validation. Mock AdsService and IapService. Dev cheat panel.

**Done when:** `npm run dev` shows the screen layout with placeholder art, `npm test` passes, and an Android debug build launches.

### M1: Core Idle Loop
Alley combat for stages 1 to 20 (enemies, mini-bosses, boss), all player stats, drops, Trash Bags, Dumpster Dives with rarity tables, the compare card, equip and recycle, XP and levels, Dumpster upgrades with timers and Gem speedups, auto-dive with filters, bad luck protection, Codex, offline progress, saving, number formatting, and a basic lid flip.

**Done when:** a fresh player reaches stage 20 in about 45 to 60 minutes of active play with steady power growth; offline rewards match the formula; saves survive reloads; tests cover damage, a 10,000-roll rarity distribution within 1% of the table, offline math, and the clock-backward guard.

### M2: Heists
Tickets, the 19-node run state machine, all node types, 20 Choice events, 14 perks, 3 evolutions, 3 curses, the Pizza Place with Chef Tony, run rewards, and the loss flow with Second Chance (mock ad).

**Done when:** a Pizza Place run takes 3 to 5 minutes start to finish, perks and evolutions visibly change fights, and simulated first runs win about 85% of the time.

### M3: City and Meta Systems
All 3 neighborhoods (60 stages), dumpster themes, the other 2 Heist locations, Crew with gacha, pity, and stars, Rides and the Junkyard, Tricks, Shiny Things, Hideout, Trash Truck, Class, daily tasks, Boss Rush, the unlock schedule with progress and day gates, and launch events. Content filled to MVP counts (40 events, 24 perks, 6 evolutions).

**Done when:** every system unlocks on schedule (verified with the time-skip cheat) and pity rules are verified by tests.

### M4: Monetization
Shop, Gem packs, Starter Pack, unlock bundles, the Second Chance purchase, Monthly Card, Trash Pass (Free, Premium, Deluxe), VIP, all rewarded ad placements with caps, Ad-Skip Tickets, odds screens, and offer rules. RevenueCat sandbox and AdMob test ads on a real device.

**Done when:** every product and placement works in test mode on a real device, purchases persist and restore, and no offer or ad appears in the first 3 minutes.

### M5: First Session and Feel
The first session script from Section 15, the full lid flip, combat juice, sounds, music, haptics, notifications, and settings (sound, music, haptics, notifications).

**Done when:** the tutorial is finished by 0:30 and a new player hits every first-session beat on time.

### M6: Soft Launch Readiness
Analytics wired up, remote config overriding balance.json, crash reporting, consent flows, performance (60 fps on a mid-range Android phone, cold start under 5 seconds), complete localization file, store builds.

**Done when:** release builds for both stores pass internal testing.

### M7: After Soft Launch (needs a backend such as Firebase or PlayFab)
Accounts and cloud save; Gangs with co-op Trash Truck raids and weekly Turf Wars; Alley Brawl async PvP; seasonal leagues grouped by start date, with a "Fresh Trash" catch-up loot boost for late joiners; a live event calendar (Garbage Day Tuesdays with double dives, Pizza Party weekends, holiday events); and a web shop.

---

## 21. Balance Targets

- Stage 20 after about 45 to 60 minutes of active play; stage 40 by the end of day 2 with offline time; stage 60 by day 5 to 7.
- First non-scripted Legendary for a non-paying player on day 2 or 3. Dumpster Level 10 by day 3.
- Heist win rate: about 85% for the first run, 50% to 65% for later runs.
- Non-paying Gem income: about 50 per day.
- Build a headless balance simulator (a script that plays N simulated days with an idle bot) and run it after every balance change to check these targets.
