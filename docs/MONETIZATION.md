# Dumpster Legend: Monetization Plan

Nov 4, 2026

The game ships as two builds, and each makes money in its own way:

| Build | How it earns | Part |
|---|---|---|
| **Phone app** (iOS and Android, Capacitor) | **In-game purchases first** (RevenueCat), rewarded ads as support (AdMob) | [Part A](#part-a-the-phone-app) |
| **CrazyGames** (web) | **Ads only:** rewarded ads and a few midgame ads, placed to fit CrazyGames' rules | [Part B](#part-b-crazygames) |

Section 0 applies to both builds, and so do Part C (the lines not to cross) and the build order.

The ideas come from Capybara Go and Legend of Mushroom (hybrid idle RPGs with funds, passes and privilege cards), Sol's RNG (a roller that sells luck), Monopoly Go (events tuned to just past what free play reaches) and CrazyGames' own guides for idle and RPG games. Each one is fitted to systems this build already has.

---

## 0. Fix this first (both builds): Gems are free right now

The balance bot (no Heists, no ads, never spends a Gem) ends up with:

| Played | Gems held | Rebirths |
|---|---|---|
| 15 min | 320 | 0 |
| 1 h | 825 to 1,025 | 2 |
| 2 h | 1,500 to 2,070 | 3 to 4 |
| 4 h | 4,445 to 4,830 | 7 |

The spec's target is **about 50 Gems a day** for a non-paying player. Four hours of play gives about 90 days' worth, which is roughly $57 of the spec's Gem packs. The cause is `onWorldCleared` (`src/core/systems/combat.ts`): "first clear" means the first clear *this run*, and a rebirth sets `highestCleared` back to 0, so every run pays every world's Gems again (10 + 5 × world each). Rebirth runs also get longer (5 + 2 × rebirths worlds), so the payout grows every run.

The fix is to pay the world-clear Gems only the first time **ever** (track a lifetime best world). Per-run first clears keep the free Luck Potion.

**Done (Nov 5, DECISIONS J1):** the bot now holds about 1,950 Gems after 4 hours instead of 4,600. What's left is one-time: Codex bonuses (about 920 by then, at most about 2,550 ever) and first-ever world clears (about 935, at most 1,250). If that welcome pile is still too big, halving the Codex bonus (`codex.gemsPerBonus`, 10 to 5) is the next lever. On CrazyGames a large pile means early players pay Gems instead of watching ads.

This matters on both builds. On the app, nobody buys Gems they already have thousands of. On CrazyGames, every rewarded ad needs a way to get the same reward without watching (B4), and that way is Gems. If Gems are free, nobody watches the ads.

The second problem: Gems have almost nothing to spend on, only dumpster speedups, Heist rerolls (10) and revives (50). The sinks are in A6 and B6.

---

# Part A: The phone app

**The thesis:** don't sell Gems. Sell the three dials the player already watches all day (**luck, speed and reels**) and show each boost's value in the player's own "1 in X" odds. Most games show "+200% value!". This one can show "Mythic: 1 in 2,500 → 1 in 250 for the next 10 minutes." Few games can show a boost's value this plainly, and that's the edge.

## A1. Why luck, speed and reels

RNG games sell three things, and the upgrade map already has all three:

| Dial | What it does | In the build today | What gets sold |
|---|---|---|---|
| **Luck** | Rarer finds (chance = luck / X at the rare tiers) | Luck hexes, rebirths, Dumpster Level, potions (x2 for 60 s) | Golden Tokens, potions, Golden Lid, weather |
| **Speed** | More spins a minute | Spin Speed, turbo bags, Lucky Spins | Quick Dive, Rebirth Blessing, Club offline speed |
| **Reels** | More items per spin | Extra Reel (250M gold, then ×100 per reel) | Duct-Tape Reel rentals |

Two rules come out of the math:

- **Sell multipliers, not items.** A guaranteed Legendary is worth a lot at luck 2 and nothing at luck 80. A ×50 luck token is worth just as much at both, because it multiplies whatever luck the player has. A product built on a multiplier never goes stale, so it sells for the whole life of the account.
- **Every boost converts to minutes.** At the rare tiers, ×10 luck for 5 minutes finds about as many rare items as 50 normal minutes. Show that on the button: "≈ 50 min of rare finds."

## A2. The products only this game can sell

### Golden Tokens: luck tokens you own and fire yourself

The luck-token chain is the biggest moment in the game, and right now it only happens at random. Let players keep tokens and choose when to fire one: tap **Fire**, and the next spin gets the token's luck on every reel, with the full build-up. Players make the big moment happen themselves (the playbook's "agency multiplies it").

| Token | Luck | Floor (the existing `roll.multiplier.floors`) | Source |
|---|---|---|---|
| Bronze | ×5 | none | Ads, daily tasks |
| Silver | ×25 | Epic or better | Gems (~120), event tracks |
| Gold | ×50 | Legendary or better | Gems (~300), passes, Starter Stash |
| Platinum | ×250 | Mythic or better | Packs, Rebirth Pass Deluxe |
| **Sync** | Matches every reel's token | Squared: ×10 Sync on 3 reels is ×100 each | Top-shelf packs only |

- **The guarantee is the selling point, and the open top end keeps it exciting.** A Platinum guarantees a Mythic, but a Grail stays possible: at ×250, the Grail's 1 in 250M becomes 1 in 1M at base luck, and 1 in 20K at luck 50. The token card shows that line.
- **Sync builds on matched tokens:** the build already squares luck when every reel matches, so Sync just forces the match. It gets stronger with more reels, so it sells best to late, high-spending players.
- **Compliance:** a token bought with Gems or money is a paid random item. Show its odds before purchase (from `rarityChances`, as the Odds screen does now), and turn off the reels' near-miss filler on that spin (the silhouettes that lean rarer than the real odds). Both are already rules in the playbook's "Lines not to cross."

### Duct-Tape Reel: rent a reel

A new player watches one reel for the first hour, and the second Extra Reel costs 250M gold. Rent one: a second drum bolted onto the dumpster with duct tape, visibly spinning beside the first. It doubles the items per spin, and the player sees exactly what they paid for.

- 15 minutes from a rewarded ad (2 a day), 1 hour for ~200 Gems, and 4 hours a day with the Raccoon Club.
- A player who already has all 5 reels gets a **Gilded Reel** instead (×2 luck on one reel), so the rental is still worth it late in the game.
- (Name: "Bootleg Reel" is already an Alley perk in Rigged Reels, so this one is the Duct-Tape Reel.)

### Weather that pays (Sol's RNG biomes, raccoon-style; both builds)

Every world already has its own sky and weather. Add rare **city-wide states** on the wall clock, rolled from a seed per player per day, with odds shown in the Luck popup:

| State | Odds per 3-minute check | Lasts | Effect |
|---|---|---|---|
| Garbage Day | 1 in 8 | 5 min | Trash Bags ×2 (turbo spins everywhere) |
| Raccoon Moon | 1 in 40 (about every 2 h) | 8 min | Legendary-and-up luck ×3 |
| Dumpster Fire | 1 in 120 | 6 min | Luck token chance ×3 |
| **Glitch Alley** | 1 in 1,000 (about every 50 h) | 4 min | ×10 luck at Mythic and up, and **glitched variants** of items (scrambled palette, a GLITCH stamp) that only drop here |

- **Players wait for it:** in RNG games, players leave the game running for hours to catch a rare state. On phones that means more sessions a day. On CrazyGames it means longer sessions, which raise the game's ranking there.
- **Notifications without a backend (app):** the schedule comes from a seeded RNG, so the app knows a Raccoon Moon is coming and can schedule a local notification ("A Raccoon Moon rises in 10 minutes"). Opt-in, at most 1 a day, and only for Raccoon Moon or rarer.
- **What it sells:** a **Weather Machine** that summons Garbage Day (1 a day from an ad), Raccoon Moon or Dumpster Fire (Gems). **Glitch Alley can never be bought.** It stays a pure chase, and a glitched item means something because nobody could pay for it. A Biome Radar (alerts and the next state's time) comes with the Club.

### The Stash: a piggy bank fed by rare finds

A glass jar sits beside the dumpster. Every find rarer than 1 in 10,000 at base luck drops new Gems into it (more for rarer finds), and the raccoon keeps glancing at it. When it's full, Gems pile up around it. Break it for **$2.99** (a bigger Golden Stash later is **$6.99**).

- It sells at its fullest, when the player can see it's the best deal in the shop.
- Each rare find makes the jar fuller, so the slot-machine moment also adds value to the jar.
- Honest version: the jar holds new Gems, never ones taken from the player's balance.

### Funds: buy once, collect what you already earned (Capybara Go)

Capybara Go pairs a fund with every activity. Each fund has a free lane and a paid lane, and the paid rewards pile up visibly as you play. Buying unlocks every tier you already reached, so the player sees a pile of locked rewards with their name on it.

Dumpster Legend has the perfect spine for this: **rebirths never reset**, and early on they come every 15 to 20 minutes.

| Fund | Tiers | Price | Paid lane |
|---|---|---|---|
| **Rebirth Pass** | 1 per rebirth (50 tiers) | Premium $4.99, Deluxe $9.99 (+10 tiers, Platinum Token) | Gems, Gold Tokens, Duct-Tape hours, a seasonal outfit |
| World Fund | 1 per world first cleared ever (20) | $2.99 | Gems and tokens, a big drop at Worlds 10 and 20 |
| Heist Fund | 1 per Heist win (30) | $2.99 | Tickets, Gems, the heist-only ring |
| Codex Fund | 1 per 10 Codex entries | $1.99 | Gems, reveal styles |

Release them like Legend of Mushroom does: each fund appears when its system opens (the Heist Fund with the first rebirth, and so on), with a 24-hour launch bundle beside it. Don't put four funds in the shop on day one.

### Golden Lid: permanent luck (the genre's best seller)

In RNG games the top sellers are permanent passes: a lifetime multiplier on luck or speed. Here that's the **Golden Lid**, a lifetime purchase at **$9.99 to $14.99**:

- ×1.25 luck forever, through every rebirth (applied as its own multiplier in `luckBreakdown`);
- +10% spin speed;
- a gold-plated dumpster skin, so it shows.

Players count it as an investment, so it sells to people who never buy consumables.

### Raccoon Club (monthly) and Ad Skipper

**Raccoon Club, $4.99 for 30 days:** 300 Gems now and 100 a day (claimed in the game each day, so it brings players back daily), offline cap from 8 to 12 hours, **offline rolls at 1/5 speed instead of 1/10** (the strongest perk, because offline rolling is already in the game), +1 Heist ticket a day, 4 Duct-Tape hours a day, the Biome Radar and a club badge.

**Ad Skipper:** claims every rewarded-ad reward instantly, without watching. It sells to the players who watch the most ads, who are also the most engaged. Price it from your real ad revenue: at an assumed $10 to $30 eCPM (a common range for rewarded video in top markets; check your own AdMob numbers), a player watching 12 ads a day earns you $0.12 to $0.36 a day ($3.60 to $10.80 a month). That means **$4.99 a month or $14.99 lifetime**, offered only to players who've watched 8 or more ads a day for 3 days. Legend of Mushroom charges $9.99 to remove ads for good. That's fine when its ads earn little, but here rewarded ads carry most of the free economy. (This isn't a Remove Ads purchase, since the game has no forced ads. It skips the optional ones and still pays out.)

### Cosmetics: reveal styles and skins

In Sol's RNG, players pay for the cutscene that plays when a rare aura lands. Here the full-screen reveal is already the best moment in the game, so sell how it looks:

- **Reveal styles** for Legendary and up: Opera Raccoon (a choir over slow motion, from the playbook's "absurd overkill"), Pigeon Choir, Trash Tornado, Retro Arcade. $1.99 to $4.99.
- **Dumpster skins** (Golden, Neon Arcade, Pizza Oven), reel skins and token skins. $2.99 to $9.99.
- **Raccoon outfits** that go over the gear (the spec's `skin_{id}`).

They have no stats, so there's no loot-box risk and nothing to balance. They're the safest thing to sell to high spenders and they make share cards look better.

### Seasons and seasonal items

Every 4 to 6 weeks, a season adds 8 to 10 **seasonal items** (variants like the Spooky Traffic Cone, drawn in the same pixel style) that only drop during that season, plus a seasonal Codex page with its own set bonus. Seasonal items are what RNG games ship with each update to give a chase. Vault them at the season's end, and bring them back once in an anniversary rerun so missing one isn't permanent. (The name "Limited" is already a rarity tier, so these are "Seasonal.")

## A3. Rewarded ads on the app

On the app, ads support purchases, so they give **time** (minutes of progress) while purchases give **multipliers and permanent things**. That way an ad never makes a purchase pointless.

Rules:

- **Each ad is worth a few minutes to about 15 minutes of progress,** measured as a percentage of the player's current rates (CrazyGames' guide: "a percentage of the cost of their next upgrade, or an amount equal to a few minutes of play"), so ads are worth the same at World 2 and World 18.
- **Offer them at the biggest moments.** Players opt in most when the reward is attached to something they're excited about right then.
- **Cap them:** 15 a day in total (the spec's cap), with each placement capped too.
- **The Ad Chest (app only):** a daily meter for 3, 6 and 10 ads (Bronze Tokens, Gems, then a Weather Machine charge). It turns occasional watchers into regular ones. Check AdMob's current rewarded-ad policy before shipping it. It can't go on CrazyGames, which bans watching several ads for one reward (B4). No daily task may require an ad (spec rule).

The app uses the same placements as CrazyGames (B2), plus the Ad Chest, the Ad Skipper (A2) and an offer card in the shop. The shop's first cell is a **free crate** for an ad. It brings everyone into the shop once a day, where the paid offers are.

## A4. The offer engine

Offers come from one pure function, `nextOffer(state, now, signals)`, kept in core, data-driven from a new `offers.json` and tested like the rest of the game.

### The price ladder

The first purchase is the one that matters most: someone who has paid once is many times more likely to pay again. Legend of Mushroom starts at $0.99, climbs toward $9.99 and keeps bundles under $50. Same here:

```ts
const LADDER = [0.99, 2.99, 4.99, 9.99, 19.99, 49.99];

function offerPrice(p: { maxPaid: number; daysSincePurchase: number }): number {
  if (p.maxPaid === 0) return LADDER[0];                       // never paid: $0.99, very high value
  let i = LADDER.findIndex((x) => x > p.maxPaid);              // one step above the most they've paid
  if (i < 0) i = LADDER.length - 1;
  if (p.daysSincePurchase > 7) i = Math.max(0, i - 1);         // gone quiet: step back down
  return LADDER[i];
}
```

### What triggers an offer

At most one popup per session start, plus the moment-based ones below. Each has its own cooldown, and nothing appears in the first 3 minutes (spec rule).

| Trigger | Offer | Cooldown |
|---|---|---|
| The first rebirth (about 15 min in, a natural high point) | **Starter Stash $0.99:** Gold Token, 300 Gems, 1 hour of Duct-Tape Reel, the Paper Crown cosmetic. A real 48-hour timer, never reset | Once ever |
| 3 losses to the same boss | **Boss Breaker** (below) | 24 h |
| The Stash is full | Break the Stash | When full |
| A system opens (Heists, Perks...) | Its 24-hour launch bundle and its fund | Once per system |
| The bag is full of Epic-or-better items | Bag Space pack | 3 days |
| Back after 3+ days away | Welcome-back pack (and the offline pile) | 7 days |
| 8+ ads a day for 3 days | Ad Skipper | 14 days |

### Boss Breaker: built from the player's own gear

When a player is stuck on a boss, work out the slot where better gear would add the most power (their weakest slot against the current world's item tier). Then offer a **slot-targeted Gold Token**: a Legendary-or-better roll for that slot. Only the floor is guaranteed, so the card shows the floor's power and nothing more: "Your weakest slot: Mask. Power with at least a Legendary mask: 1.2M → 1.9M or more. This boss: 1.6M." The value is easy to read, true, and specific to that player.

### Segments, measured against the balance sim

`npm run sim` already shows where an average bot is at each minute, so it can measure how a player is doing:

- **Behind the bot's curve:** value offers, the Rebirth Pass, Boss Breaker.
- **Ahead of it:** Golden Lid, the Club, cosmetics, Sync Tokens.
- **Heavy ad watchers:** Ad Skipper, the Club.
- **Payers:** the next step of the ladder, and never the $0.99 starter again.

**Segments only change which offers appear and at what price, never the odds or the difficulty.** The Odds screen is built from the same function the game rolls with. If odds changed per player, that screen would be lying. Apple's guideline 3.1.1 requires the odds shown for random items to be the real ones, and the FTC made Epic pay $245M over purchase flows that misled players. Fair odds protect revenue.

### Event tracks, tuned with the sim (Monopoly Go)

A weekly event (Junk Rush: points per find, more for rarer ones) has a milestone track. Tune it with the sim: add an `--event` mode, find the median points a free player earns over the event, and put the grand prize at about **1.3 times** that. A free player who plays every day and watches their ads can reach it. A player who falls short is a little short, and a $2.99 event pass (double points) or a token closes the gap. Monopoly Go's events work this way, and having the sim means the gap can be set from data instead of guesswork.

Event types to rotate: Junk Rush (find points), Token Frenzy weekend (token chance ×2), Boss Rush (bosses replayed for points), Garbage Day Tuesday (the spec's double dives).

### Value shown honestly

"×12 value" badges are worked out from the Gem shop's base rate, never made up. Timers are real and never reset. Spec rule: anything random that can be bought shows its odds.

## A5. When each thing appears

| When | What the player meets |
|---|---|
| 0 to 3 min | Nothing. The tutorial, the scripted finds, beginner's luck |
| ~5 min | The first rewarded-ad button (Potion Brew in the Boosts panel) |
| ~15 min, first rebirth | Rebirth Blessing ad, Starter Stash, Heists and the Heist Fund |
| Second rebirth | Perks and their launch bundle, the Rebirth Pass |
| First Raccoon Moon | The weather intro and the Weather Machine |
| First full Stash | Break the Stash |
| Day 2 | Raccoon Club, the Ad Chest at full size |
| Day 3+ | Golden Lid, cosmetics in the shop |
| Week 1 | The first weekly event; the first season starts at soft launch |

## A6. The Gem economy on the app

**Income for a free player: about 60 to 100 Gems a day** (daily tasks, Codex, Heists, the Ad Chest, first-ever world clears). The Club adds 100 a day.

**Packs (from the spec):** $0.99 = 80, $4.99 = 450, $9.99 = 950, $19.99 = 2,000, $49.99 = 5,300, $99.99 = 11,000. Double Gems on the first purchase of each.

**What Gems buy:** the same price list as B6, plus Silver Tokens (~120) and Gold Tokens (~300). Run the sim with these prices and check that a free player can afford roughly one Gold Token a week. That keeps the free game generous and makes paying a shortcut, not a wall.

---

# Part B: CrazyGames

## B1. What's different on the web

- **Ads are all the revenue.** CrazyGames offers in-game purchases (through Xsolla) only to selected, fully launched games, by invitation. The web build carries **no purchases at all**: no shop packs, funds, Club, Golden Lid, Stash or Ad Skipper. Gems come only from playing.
- **Rewarded ads earn the most** (CrazyGames: the highest eCPM of their formats). Their data for strategy games: top games average **21 ad impressions per play, 14 of them rewarded**. Adventure averages 9.8 (4.5 rewarded) and simulation 7.9 (3.3 rewarded). Dumpster Legend should be built to reach the strategy numbers, mostly with rewarded ads.
- **Midgame ads "should be used very sparingly, if at all"** in idle and RPG games, "only ... during major transitions" (CrazyGames' idle guide). CrazyGames also ranks games by playtime and retention, so a midgame ad that ends a session costs more than it earns.
- **Basic Launch has ads switched off.** Every ad button must hide then, and the game must still play fully (B4).
- **What's already built** (`src/services/crazygames.ts` on the CrazyGames branch): rewarded ads play through the SDK for the five existing placements, the game pauses and mutes during an ad, and an ad error gives no reward. Midgame ads aren't wired up yet.

## B2. Rewarded placements

The rules behind the columns (quoted in B4): no ad button on an active gameplay screen, a timer or a hidden button when an ad is used up, a Gem alternative beside every ad, no watching several ads for one reward, and at most about 5 a day for any one placement (CrazyGames' deep dive suggests "maximum 5 times per day").

Dumpster Legend's battle and reels never stop, so **"not on an active gameplay screen" means: ad buttons only in popups, result screens and panels the player opens**, never floating over the battle or the reels. Boost ads live in a new **Boosts panel** opened from the luck badge. The badge only opens the panel and doesn't request an ad itself.

| # | Placement | Where | When it's offered | Reward | Cap | Gem alternative | Status |
|---|---|---|---|---|---|---|---|
| 1 | **Offline ×2** | `OfflinePopup` | Back after 30+ min | Double the offline haul | Once per return | 10 per hour away, up to 80 | Built |
| 2 | **Quick Dive** | Boosts panel | Any time | 2 h of offline rolls right now | 3 a day, with the timer to the next | 50, then 100, then 200 | Built |
| 3 | **Potion Brew** | Boosts panel | Any time | ×3 luck for 5 min | 3 a day | 60 | Built |
| 4 | **Duct-Tape Reel** | Boosts panel | Any time | One more reel for 15 min (not offered with all 5 on; the Gilded Reel is for later) | 2 a day | 120 | Built |
| 5 | **Bonus Crate** | Boosts panel, top row | Every 4 hours | Trash Bags or gold (10 minutes' worth) or a 2-minute Luck Potion, odds shown (Bronze Tokens join once tokens exist) | 3 a day | 40 | Built |
| 6 | **Weather Machine** | Luck popup | Not during weather | Summons Garbage Day | 1 a day | 40 (Raccoon Moon and Dumpster Fire are Gems only, 150; Glitch Alley never) | New (needs the weather states) |
| 7 | **Encore Spin** | The full-screen reveal's end card, and the Boosts panel for 3 minutes | A spin with a ×25 or larger token chain | The next spin lands that spin's tokens again on every reel. They keep what they got | 2 a day | 80 | Built |
| 8 | **Polish** | The reveal's end card, and the item card in the Bag | A Mythic or better | +1 tier on its lowest enchantment, or a new Tier I one | 3 a day | 100 | Built |
| 9 | **Rebirth Blessing** | Rebirth screen, a card above Rebirth (taken before, so the ad is never on the Rebirth button) | Any time | Double spin speed for the first 10 min of the next run | 3 a day | 80 | Built |
| 10 | **Boss Rage** | The world's card (Worlds tab) and the Boosts panel | After 2 losses in a row at a world; never at the moment of a loss | +50% damage for the next try (it takes him back there) | 3 a day | 60 | Built |
| 11 | **Gold top-up** | A hex's card on the upgrade map | Short by 25% or less of a hex's price | The missing gold (capped at ~10 min of income) | 3 a day | 20 | Built |
| 12 | **Dumpster speedup** | `UpgradePopup` | A dumpster upgrade is running | −30 min | 3 a day | 1 Gem per 2 min (built) | Built |
| 13 | **Heist ticket** | `heistLobby` | Tickets below max | +1 ticket | 1 a day | 100 | Built |
| 14 | **Heist revive** | `heistEnd` | A run is lost | Revive at 50% HP | 1 per run | 50 (built) | Built |
| 15 | **Perk reroll** | `heistPick` | A perk offer | Reroll the offer | 1 per run (the free one) | 10 | Built |

Notes:

- **Encore Spin and Polish attach the ad to the most exciting moment in the game.** They sit on the reveal's end card, which is a result screen (the reels and the battle are behind the full-screen reveal), so they fit the "no ads during active gameplay" rule. The rarer the find, the more players want them.
- **Boss Rage is offered as a "try again stronger" option on the world's card, never as a popup when the raccoon falls.** CrazyGames bans offering an ad "each time the users lose a life," and this way it's a choice players go looking for.
- **The Bonus Crate and Quick Dive follow CrazyGames' own suggestions** ("Free Daily Chest" at the top of the shop, and "Skip 1 hour of waiting time"). The crate gives no Gems, so buying it with Gems isn't a loop.
- **Ad button text names the reward:** "▶ +2 h of rolls," not "Watch ad" (their deep dive: "Watch Ad for +50 Gems").
- **No Ad Chest on the web:** a meter that pays for 3, 6 or 10 ads is "watch more than one rewarded ad to receive a single reward," which CrazyGames bans.
- With every cap used, a player could watch up to about 35 rewarded ads a day. A typical 20-minute visit should reach about 8 to 14 (offline ×2, a Quick Dive or two, a crate, a Potion, a Blessing, an Encore or Polish, and Heist placements), close to the strategy-game numbers in B1.

## B3. Midgame ads

**Built (DECISIONS J15).** Only at two major transitions, and only when they don't stack with a rewarded offer:

| Where | When exactly | Why it's allowed |
|---|---|---|
| **A Heist win** | When the boss falls, before the results screen | The end of a 3-to-5-minute run is the clearest "level complete" in the game. No midgame after a **loss**: the loss offers a revive ad, and CrazyGames allows either a midgame or a "watch to keep playing," not both |
| **A world's first clear in a run, World 3 or later** | When the after-boss choice moves on (the player taps Next world, or it moves on by itself after 5 s), before the next world starts | A major transition, like finishing a quest. It's a gameplay step, not a menu button |

Our own limits, on top of the SDK's 1 every 3 minutes:

- At most **1 every 6 minutes.**
- None in the first **10 minutes** of a player's first visit, and none in the first **3 minutes** of later visits ("should not appear before the user has experienced a reasonable amount of gameplay").
- **Skip it** if the player finished a rewarded ad in the last 6 minutes. A player who chooses ads shouldn't also get forced ones.
- Never on navigation: tabs, Settings, menus, the Boosts panel or the title screen.
- No midgame at a rebirth. The rebirth screen has the Rebirth Blessing (a rewarded ad), and stacking both at one moment is too much.
- **No banners:** every screen in this game is gameplay, and CrazyGames bans banners there.

## B4. CrazyGames' rules, and what the current build breaks

The rules, quoted from <https://docs.crazygames.com/requirements/ads/>:

- "The request button should not appear on an active gameplay screen."
- "Do not offer a rewarded ad too often. Inform the user of this with a timer or hide the ad request button."
- "Provide an alternative to watching an ad. For example, a user can also buy the reward with coins that he can receive during the game."
- "Do not chain multiple ads, i.e. watch more than one rewarded ad to receive a single reward."
- "It is not allowed to offer an Out-of-lives rewarded video each time the users lose a life."
- "There should not be rewarded ad buttons without effect."
- The way to skip a rewarded offer "should be the same size, font, color, etc." as the watch button, and can't be hidden or delayed.
- "When our rewarded ad returns with an adError callback, do NOT reward the player." (Built.)
- "Do not show a midgame ad on a navigational button."

What the build broke, now fixed (Nov 5, DECISIONS J2 to J5):

1. **Ad buttons never hid when ads couldn't play.** Now every ad button hides when `ads.isReady(placement)` is false and the Gem option stays. The service checks for an ad blocker at startup and marks ads off after an `adsDisabled` or `adblock` error. (The SDK has no way to know about Basic Launch or kids mode before the first request, so those buttons go after it.)
2. **Offline ×2 and the Heist ticket had no Gem alternative.** Both have one now (B2, rows 1 and 13), and so does the free perk reroll.
3. **The skip buttons didn't match.** In the CrazyGames build, Collect matches Collect ×2 and Give up matches the revive ad.

## B5. What to measure on CrazyGames

CrazyGames' developer dashboard gives playtime, retention and ad numbers. Track these for each change:

- Rewarded impressions per play (target: 8 to 14) and opt-in for each placement (B2). A placement nobody uses should go.
- Midgame impressions per play, and whether retention drops after a midgame change.
- Average playtime per visit and day-1 retention. CrazyGames ranks games by these, so they come before ad count.
- Reward sizes: CrazyGames suggests trying smaller rewards ("try offering 50 coins instead of 100"). If players watch just as many ads for less, keep the smaller reward and the economy stays tight.

## B6. The Gem economy on the web

With no purchases, Gems are the "alternative to watching an ad" that CrazyGames requires, so their price sets how many players watch instead.

- **Income: about 60 to 100 Gems a day** from playing (daily tasks, Codex, Heists, first-ever world clears).
- **Price the alternatives at a fraction of a day's Gems for small rewards and one to two days' for the big ones** (Quick Dive up to 200, Raccoon Moon 150). That's affordable now and then, so the alternative is real, but most players will watch.

| Sink | Gems |
|---|---|
| Quick Dive | 50, 100, 200 |
| Potion Brew | 60 |
| Boss Rage | 60 |
| Duct-Tape Reel, 15 min | 120 |
| Bonus Crate | 40 |
| Weather Machine: Garbage Day / Raccoon Moon or Dumpster Fire | 40 / 150 |
| Gold top-up | 20 |
| Encore Spin / Rebirth Blessing | 80 |
| Polish | 100 |
| Extra Heist ticket | 100 |
| Heist revive / perk reroll (built) | 50 / 10 |
| Dumpster speedup (built) | 1 per 2 minutes |

---

# Part C: Both builds

## C1. Lines that protect the revenue

The playbook's "Lines not to cross" all apply. For monetization specifically:

- **Paid tokens show their odds before purchase,** with no near-miss filler on paid spins. The Encore Spin is a free spin, so the usual filler is fine there.
- **Never change odds or difficulty for payers or segments** (A4).
- **Kids:** a cartoon raccoon will draw children. On the app: an age gate, non-personalized ads for under-13s or unknown ages (Google UMP, iOS ATT), parental consent for purchases, and Google Play's Families policy if you target kids. On CrazyGames, their kids mode turns ads off (the SDK answers `adsDisabled`), and the game must play fully without them.
- **Regions (app):** Belgium treats paid random items as gambling. Switch paid tokens off there through remote config, and sell only the guaranteed and cosmetic items. Check each launch market's current rules before soft launch, since they keep changing.
- **Real timers, clear purchase buttons, purchase history and an optional spending limit.**

## C2. Build order

Each step is small, testable and measurable with the spec's analytics events (`offer_shown`, `offer_purchased`, `rv_shown`, `rv_completed`, `iap_purchase`).

**Both builds first:**

1. **The Gem fix** (section 0) and the Gem sinks. *Done.*
2. **The CrazyGames fixes** (B4): hide ad buttons when ads can't play, Gem alternatives, matching skip buttons. *Done.*
3. **The Boosts panel and the new rewarded placements** (B2), and the two midgame placements (B3) in the CrazyGames build. *Done (DECISIONS J6 to J17), except the Weather Machine, which comes with step 4.*
4. **Weather states and the Weather Machine.**

At this point the CrazyGames build is complete, and it can go out while the app's store comes together.

**Then the app:**

5. **The shop, the Starter Stash, the price ladder and the Stash jar** (RevenueCat sandbox). Measure first-purchase conversion by day 7.
6. **Golden Tokens,** with the odds card and the region switch.
7. **Rebirth Pass and World Fund.**
8. **Raccoon Club, Golden Lid, Ad Skipper and the Ad Chest.**
9. **Weekly events** tuned with the sim's `--event` mode.
10. **Reveal styles and skins** (the reveal styles could later come to CrazyGames through their in-game purchases if the game is invited).

**Starting targets to tune against for the app** (assumptions to test in soft launch, not industry data): 4 to 8 rewarded ads per daily player, 50% or more of players opting in on the Encore Spin, 2 to 4% of players paying by day 7, 30% or more of first-time payers buying again within 14 days.
