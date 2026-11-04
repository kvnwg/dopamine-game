# Dumpster Legend: Monetization Plan

Nov 4, 2026

How to make money from Dumpster Legend on phones (Capacitor builds with AdMob and RevenueCat) and on CrazyGames (ads only for now). It draws on what works in Capybara Go and Legend of Mushroom (hybrid idle RPGs with funds, passes and privilege cards), Sol's RNG (a roller that sells luck), and Monopoly Go (events tuned to just past what free play reaches). Each idea is fitted to systems this build already has.

**The thesis:** don't sell Gems. Sell the three dials the player already watches all day (**luck, speed and reels**) and show each boost's value in the player's own "1 in X" odds. Most games show "+200% value!". This one can show "Mythic: 1 in 2,500 → 1 in 250 for the next 10 minutes." Few games can show a boost's value this plainly, and that's the edge.

---

## 0. Fix this first: Gems are free right now

The balance bot (no Heists, no ads, never spends a Gem) ends up with:

| Played | Gems held | Rebirths |
|---|---|---|
| 15 min | 320 | 0 |
| 1 h | 825 to 1,025 | 2 |
| 2 h | 1,500 to 2,070 | 3 to 4 |
| 4 h | 4,445 to 4,830 | 7 |

The spec's target is **about 50 Gems a day** for a non-paying player. Four hours of play gives about 90 days' worth, which is roughly $57 of the spec's Gem packs. The cause is `onWorldCleared` (`src/core/systems/combat.ts`): "first clear" means the first clear *this run*, and a rebirth sets `highestCleared` back to 0, so every run pays every world's Gems again (10 + 5 × world each). Rebirth runs also get longer (5 + 2 × rebirths worlds), so the payout grows every run.

The fix is to pay the world-clear Gems only the first time **ever** (track a lifetime best world). Per-run first clears keep the free Luck Potion and pay gold and bags instead. After that, the free Gem income should be about **60 to 100 a day**: daily tasks, Codex bonuses, Heists, the daily Ad Chest and first-ever world clears. Until this is fixed, nothing in this document sells, because players will already be sitting on thousands of Gems.

The second problem is that Gems have almost nothing to spend on: dumpster speedups, Heist rerolls (10) and revives (50). Section 6 adds the sinks.

---

## 1. Why luck, speed and reels

RNG games sell three things, and the upgrade map already has all three:

| Dial | What it does | In the build today | What gets sold |
|---|---|---|---|
| **Luck** | Rarer finds (chance = luck / X at the rare tiers) | Luck hexes, rebirths, Dumpster Level, potions (x2 for 60 s) | Golden Tokens, potions, Golden Lid, weather |
| **Speed** | More spins a minute | Spin Speed, turbo bags, Lucky Spins | Quick Dive, Rebirth Blessing, Club offline speed |
| **Reels** | More items per spin | Extra Reel (250M gold, then ×100 per reel) | Duct-Tape Reel rentals |

Two rules come out of the math:

- **Sell multipliers, not items.** A guaranteed Legendary is worth a lot at luck 2 and nothing at luck 80. A ×50 luck token is worth just as much at both, because it multiplies whatever luck the player has. A product built on a multiplier never goes stale, so it sells for the whole life of the account.
- **Every boost converts to minutes.** At the rare tiers, ×10 luck for 5 minutes finds about as many rare items as 50 normal minutes. Show that on the button: "≈ 50 min of rare finds."

---

## 2. The products only this game can sell

### 2.1 Golden Tokens: luck tokens you own and fire yourself

The luck-token chain is the biggest moment in the game, and right now it only happens at random. Let players keep tokens and choose when to fire one: tap **Fire**, and the next spin gets the token's luck on every reel, with the full build-up. Players make the big moment happen themselves (the playbook's "agency multiplies it").

| Token | Luck | Floor (the existing `roll.multiplier.floors`) | Source |
|---|---|---|---|
| Bronze | ×5 | none | Ad Chest, daily tasks |
| Silver | ×25 | Epic or better | Gems (~120), event tracks |
| Gold | ×50 | Legendary or better | Gems (~300), passes, Starter Stash |
| Platinum | ×250 | Mythic or better | Packs, Rebirth Pass Deluxe |
| **Sync** | Matches every reel's token | Squared: ×10 Sync on 3 reels is ×100 each | Top-shelf packs only |

- **The guarantee is the selling point, and the open top end keeps it exciting.** A Platinum guarantees a Mythic, but a Grail stays possible: at ×250, the Grail's 1 in 250M becomes 1 in 1M at base luck, and 1 in 20K at luck 50. The token card shows that line.
- **Sync builds on matched tokens:** the build already squares luck when every reel matches, so Sync just forces the match. It gets stronger with more reels, so it sells best to late, high-spending players.
- **Compliance:** a token bought with Gems or money is a paid random item. Show its odds before purchase (from `rarityChances`, as the Odds screen does now), and turn off the reels' near-miss filler on that spin (the silhouettes that lean rarer than the real odds). Both are already rules in the playbook's "Lines not to cross."

### 2.2 Duct-Tape Reel: rent a reel

A new player watches one reel for the first hour, and the second Extra Reel costs 250M gold. Rent one: a second drum bolted onto the dumpster with duct tape, visibly spinning beside the first. It doubles the items per spin, and the player sees exactly what they paid for.

- 15 minutes from a rewarded ad (2 a day), 1 hour for ~200 Gems, and 4 hours a day with the Raccoon Club.
- A player who already has all 5 reels gets a **Gilded Reel** instead (×2 luck on one reel), so the rental is still worth it late in the game.
- (Name: "Bootleg Reel" is already an Alley perk in Rigged Reels, so this one is the Duct-Tape Reel.)

### 2.3 Weather that pays (Sol's RNG biomes, raccoon-style)

Every world already has its own sky and weather. Add rare **city-wide states** on the wall clock, rolled from a seed per player per day, with odds shown in the Luck popup:

| State | Odds per 3-minute check | Lasts | Effect |
|---|---|---|---|
| Garbage Day | 1 in 8 | 5 min | Trash Bags ×2 (turbo spins everywhere) |
| Raccoon Moon | 1 in 40 (about every 2 h) | 8 min | Legendary-and-up luck ×3 |
| Dumpster Fire | 1 in 120 | 6 min | Luck token chance ×3 |
| **Glitch Alley** | 1 in 1,000 (about every 50 h) | 4 min | ×10 luck at Mythic and up, and **glitched variants** of items (scrambled palette, a GLITCH stamp) that only drop here |

- **Players wait for it:** in RNG games, players leave the game running for hours to catch a rare state. On CrazyGames that means longer sessions (which raise the game's ranking) and more ad views. On phones it means more sessions a day.
- **Notifications without a backend:** the schedule comes from a seeded RNG, so the app knows a Raccoon Moon is coming and can schedule a local notification ("A Raccoon Moon rises in 10 minutes"). Opt-in, at most 1 a day, and only for Raccoon Moon or rarer.
- **What it sells:** a **Weather Machine** that summons Garbage Day (1 a day from an ad), Raccoon Moon or Dumpster Fire (Gems). **Glitch Alley can never be bought.** It stays a pure chase, and a glitched item means something because nobody could pay for it. A Biome Radar (alerts and the next state's time) comes with the Club.

### 2.4 The Stash: a piggy bank fed by rare finds

A glass jar sits beside the dumpster. Every find rarer than 1 in 10,000 at base luck drops new Gems into it (more for rarer finds), and the raccoon keeps glancing at it. When it's full, Gems pile up around it. Break it for **$2.99** (a bigger Golden Stash later is **$6.99**).

- It sells at its fullest, when the player can see it's the best deal in the shop.
- Each rare find makes the jar fuller, so the slot-machine moment also adds value to the jar.
- Honest version: the jar holds new Gems, never ones taken from the player's balance.

### 2.5 Funds: buy once, collect what you already earned (Capybara Go)

Capybara Go pairs a fund with every activity. Each fund has a free lane and a paid lane, and the paid rewards pile up visibly as you play. Buying unlocks every tier you already reached, so the player sees a pile of locked rewards with their name on it.

Dumpster Legend has the perfect spine for this: **rebirths never reset**, and early on they come every 15 to 20 minutes.

| Fund | Tiers | Price | Paid lane |
|---|---|---|---|
| **Rebirth Pass** | 1 per rebirth (50 tiers) | Premium $4.99, Deluxe $9.99 (+10 tiers, Platinum Token) | Gems, Gold Tokens, Duct-Tape hours, a seasonal outfit |
| World Fund | 1 per world first cleared ever (20) | $2.99 | Gems and tokens, a big drop at Worlds 10 and 20 |
| Heist Fund | 1 per Heist win (30) | $2.99 | Tickets, Gems, the heist-only ring |
| Codex Fund | 1 per 10 Codex entries | $1.99 | Gems, reveal styles |

Release them like Legend of Mushroom does: each fund appears when its system opens (the Heist Fund with the first rebirth, and so on), with a 24-hour launch bundle beside it. Don't put four funds in the shop on day one.

### 2.6 Golden Lid: permanent luck (the genre's best seller)

In RNG games the top sellers are permanent passes: a lifetime multiplier on luck or speed. Here that's the **Golden Lid**, a lifetime purchase at **$9.99 to $14.99**:

- ×1.25 luck forever, through every rebirth (applied as its own multiplier in `luckBreakdown`);
- +10% spin speed;
- a gold-plated dumpster skin, so it shows.

Players count it as an investment, so it sells to people who never buy consumables.

### 2.7 Raccoon Club (monthly) and Ad Skipper

**Raccoon Club, $4.99 for 30 days:** 300 Gems now and 100 a day (claimed in the game each day, so it brings players back daily), offline cap from 8 to 12 hours, **offline rolls at 1/5 speed instead of 1/10** (the strongest perk, because offline rolling is already in the game), +1 Heist ticket a day, 4 Duct-Tape hours a day, the Biome Radar and a club badge.

**Ad Skipper:** claims every rewarded-ad reward instantly, without watching. It sells to the players who watch the most ads, who are also the most engaged. Price it from your real ad revenue: at an assumed $10 to $30 eCPM (a common range for rewarded video in top markets; check your own AdMob numbers), a player watching 12 ads a day earns you $0.12 to $0.36 a day ($3.60 to $10.80 a month). That means **$4.99 a month or $14.99 lifetime**, offered only to players who've watched 8 or more ads a day for 3 days. Legend of Mushroom charges $9.99 to remove ads for good. That's fine when its ads earn little, but here rewarded ads carry most of the free economy. (This isn't a Remove Ads purchase, since the game has no forced ads. It skips the optional ones and still pays out.)

### 2.8 Cosmetics: reveal styles and skins

In Sol's RNG, players pay for the cutscene that plays when a rare aura lands. Here the full-screen reveal is already the best moment in the game, so sell how it looks:

- **Reveal styles** for Legendary and up: Opera Raccoon (a choir over slow motion, from the playbook's "absurd overkill"), Pigeon Choir, Trash Tornado, Retro Arcade. $1.99 to $4.99.
- **Dumpster skins** (Golden, Neon Arcade, Pizza Oven), reel skins and token skins. $2.99 to $9.99.
- **Raccoon outfits** that go over the gear (the spec's `skin_{id}`).

They have no stats, so there's no loot-box risk and nothing to balance. They're the safest thing to sell to high spenders and they make share cards look better.

### 2.9 Seasons and seasonal items

Every 4 to 6 weeks, a season adds 8 to 10 **seasonal items** (variants like the Spooky Traffic Cone, drawn in the same pixel style) that only drop during that season, plus a seasonal Codex page with its own set bonus. Seasonal items are what RNG games ship with each update to give a chase. Vault them at the season's end, and bring them back once in an anniversary rerun so missing one isn't permanent. (The name "Limited" is already a rarity tier, so these are "Seasonal.")

---

## 3. Rewarded ads: where they pay best

Rules:

- **Each ad is worth 10 to 20 minutes of progress,** measured as a percentage of the player's current rates (not a flat number), so ads are worth the same at World 2 and World 18.
- **Offer them at the biggest moments.** Players opt in most when the reward is attached to something they're excited about right then.
- **Cap them:** 15 a day in total (the spec's cap), with each placement capped too.
- **The Ad Chest:** a daily meter for 3, 6 and 10 ads (Bronze Tokens, Gems, then a Weather Machine charge). It turns occasional watchers into regular ones. No daily task may require an ad (spec rule).

| Placement | Moment | Reward | Cap |
|---|---|---|---|
| **Encore Spin** (new) | Right after a token chain of ×25 or more lands | One more spin of that reel at the same luck. They keep what they already got | 2 a day |
| **Polish** (new) | Right after a Mythic-or-better find | Reroll that item's enchantments, or +1 enchant tier. The rarer the find, the more players want it | 3 a day |
| **Rebirth Blessing** (new) | The rebirth screen | Double spin speed for the first 10 minutes of the new run | 1 per rebirth, 3 a day |
| **Boss Rage** (new) | After 2 losses to the same boss (the third sends the raccoon back) | +50% ATK for the next attempt | 3 a day |
| **Quick Dive** (new; Habby's "quick patrol") | Roll tab button | 2 hours of offline rolls right now | 3 a day by ad, then 50, 100, 200 Gems |
| **Potion Brew** (new) | Luck badge | ×3 luck for 5 minutes | 3 a day |
| **Duct-Tape Reel** (new) | Roll tab | A second reel for 15 minutes | 2 a day |
| **Free shop box** (new) | The shop's first cell | Gems, a Bronze Token or bags | 1 a day: it brings everyone into the shop, where the paid offers are |
| Offline ×2 | Offline popup (built) | Double the haul | Once per return of 30+ min |
| Heist ticket | Heist lobby (built) | +1 ticket | 1 a day |
| Heist revive | Heist loss (built) | Revive at 50% HP | 1 per run |
| Perk reroll | Heist perk pick (built) | Free reroll | 1 per run |
| Dumpster speedup | Upgrade popup (built) | −30 minutes | 3 a day |

The Encore Spin is a free spin, so the playbook allows the usual near-miss filler on it. A Gem-bought token spin is a paid spin, so the filler is off there.

### On CrazyGames

The web build has no in-game purchases (CrazyGames offers them through Xsolla, but by invitation, to selected fully launched games). Ads are all the revenue there, and CrazyGames' rules shape them:

- **Rewarded:** use the same placements. Don't put them on active-play screens, and show a cooldown timer or hide the button when a placement is used up. Offer a Gem price beside each one. Give no reward on an ad error (`crazygames.ts` already does that).
- **Midgame ads only at natural breaks:** after a Heist **win** (a loss offers a revive ad, and CrazyGames allows a midgame or a "watch to keep playing," not both), after a rebirth, after a World Cleared choice. Never on menus, Settings or the shop. The SDK allows 1 every 3 minutes; use at most **1 every 6 minutes** and none in the first 10 minutes, because CrazyGames ranks games by playtime and retention.
- **No banners:** every screen in this game is gameplay.
- Apply for in-game purchases once the game is fully launched with good retention. Everything in section 2 is ready to drop in.

---

## 4. The offer engine

Offers come from one pure function, `nextOffer(state, now, signals)`, kept in core, data-driven from a new `offers.json` and tested like the rest of the game.

### 4.1 The price ladder

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

### 4.2 What triggers an offer

At most one popup per session start, plus the moment-based ones below. Each has its own cooldown, and nothing appears in the first 3 minutes (spec rule).

| Trigger | Offer | Cooldown |
|---|---|---|
| The first rebirth (about 15 min in, a natural high point) | **Starter Stash $0.99:** Gold Token, 300 Gems, 1 hour of Duct-Tape Reel, the Paper Crown cosmetic. A real 48-hour timer, never reset | Once ever |
| 3 losses to the same boss | **Boss Breaker** (4.3) | 24 h |
| The Stash is full | Break the Stash | When full |
| A system opens (Heists, Perks...) | Its 24-hour launch bundle and its fund | Once per system |
| The bag is full of Epic-or-better items | Bag Space pack | 3 days |
| Back after 3+ days away | Welcome-back pack (and the offline pile) | 7 days |
| 8+ ads a day for 3 days | Ad Skipper | 14 days |

### 4.3 Boss Breaker: built from the player's own gear

When a player is stuck on a boss, work out the slot where better gear would add the most power (their weakest slot against the current world's item tier). Then offer a **slot-targeted Gold Token**: a Legendary-or-better roll for that slot. Only the floor is guaranteed, so the card shows the floor's power and nothing more: "Your weakest slot: Mask. Power with at least a Legendary mask: 1.2M → 1.9M or more. This boss: 1.6M." The value is easy to read, true, and specific to that player.

### 4.4 Segments, measured against the balance sim

`npm run sim` already shows where an average bot is at each minute, so it can measure how a player is doing:

- **Behind the bot's curve:** value offers, the Rebirth Pass, Boss Breaker.
- **Ahead of it:** Golden Lid, the Club, cosmetics, Sync Tokens.
- **Heavy ad watchers:** Ad Skipper, the Club.
- **Payers:** the next step of the ladder, and never the $0.99 starter again.

**Segments only change which offers appear and at what price, never the odds or the difficulty.** The Odds screen is built from the same function the game rolls with. If odds changed per player, that screen would be lying. Apple's guideline 3.1.1 requires the odds shown for random items to be the real ones, and the FTC made Epic pay $245M over purchase flows that misled players. Fair odds protect revenue.

### 4.5 Event tracks, tuned with the sim (Monopoly Go)

A weekly event (Junk Rush: points per find, more for rarer ones) has a milestone track. Tune it with the sim: add an `--event` mode, find the median points a free player earns over the event, and put the grand prize at about **1.3 times** that. A free player who plays every day and watches their ads can reach it. A player who falls short is a little short, and a $2.99 event pass (double points) or a token closes the gap. Monopoly Go's events work this way, and having the sim means the gap can be set from data instead of guesswork.

Event types to rotate: Junk Rush (find points), Token Frenzy weekend (token chance ×2), Boss Rush (bosses replayed for points), Garbage Day Tuesday (the spec's double dives).

### 4.6 Value shown honestly

"×12 value" badges are worked out from the Gem shop's base rate, never made up. Timers are real and never reset. Spec rule: anything random that can be bought shows its odds.

---

## 5. When each thing appears

| When | What the player meets |
|---|---|
| 0 to 3 min | Nothing. The tutorial, the scripted finds, beginner's luck |
| ~5 min | The first rewarded-ad button (Potion Brew on the luck badge) |
| ~15 min, first rebirth | Rebirth Blessing ad, Starter Stash, Heists and the Heist Fund |
| Second rebirth | Perks and their launch bundle, the Rebirth Pass |
| First Raccoon Moon | The weather intro and the Weather Machine |
| First full Stash | Break the Stash |
| Day 2 | Raccoon Club, the Ad Chest at full size |
| Day 3+ | Golden Lid, cosmetics in the shop |
| Week 1 | The first weekly event; the first season starts at soft launch |

---

## 6. The Gem economy after the fix

**Income for a free player: about 60 to 100 Gems a day** (daily tasks, Codex, Heists, the Ad Chest, first-ever world clears). The Club adds 100 a day.

**Packs (from the spec):** $0.99 = 80, $4.99 = 450, $9.99 = 950, $19.99 = 2,000, $49.99 = 5,300, $99.99 = 11,000. Double Gems on the first purchase of each.

**What Gems buy (the new sinks):**

| Item | Gems |
|---|---|
| Quick Dive after the 3 free ones | 50, 100, 200 |
| Silver Token / Gold Token | 120 / 300 |
| Duct-Tape Reel, 1 hour | 200 |
| Weather Machine (Raccoon Moon or Dumpster Fire) | 150 |
| Extra Heist ticket | 100 |
| Bag Space (+5 for the run) | 80 |
| Heist revive / perk reroll (built) | 50 / 10 |
| Dumpster speedup (built) | 1 per 2 minutes |

Run the sim with these prices and check that a free player can afford roughly one Gold Token a week. That keeps the free game generous and makes paying a shortcut, not a wall.

---

## 7. Lines that protect the revenue

The playbook's "Lines not to cross" all apply. For monetization specifically:

- **Paid tokens show their odds before purchase,** with no near-miss filler on paid spins.
- **Never change odds or difficulty for payers or segments** (4.4).
- **Kids:** a cartoon raccoon will draw children. Use an age gate, non-personalized ads for under-13s or unknown ages (Google UMP, iOS ATT), parental consent for purchases, and Google Play's Families policy if you target kids.
- **Regions:** Belgium treats paid random items as gambling. Switch paid tokens off there through remote config, and sell only the guaranteed and cosmetic items. Check each launch market's current rules before soft launch, since they keep changing.
- **Real timers, clear purchase buttons, purchase history and an optional spending limit.**

---

## 8. Build order

Each step is small, testable and measurable with the spec's analytics events (`offer_shown`, `offer_purchased`, `rv_shown`, `rv_completed`, `iap_purchase`).

1. **Gem fix and sinks:** first-ever world Gems, a shop screen with the free ad box. Measure Gems held per day.
2. **Rewarded placements:** Encore Spin, Polish, Rebirth Blessing, Boss Rage, Quick Dive, Potion Brew, the Ad Chest, and the CrazyGames rules. Measure opt-in per placement and ads per daily player.
3. **Starter Stash, the price ladder and the Stash jar:** measure first-purchase conversion by day 7.
4. **Golden Tokens,** with the odds card and the region switch.
5. **Rebirth Pass and World Fund.**
6. **Raccoon Club, Golden Lid and Ad Skipper.**
7. **Weather states and the Weather Machine:** measure sessions per day and session length.
8. **Weekly events** tuned with the sim's `--event` mode.
9. **Reveal styles and skins.**

**Starting targets to tune against** (assumptions to test in soft launch, not industry data): 4 to 8 rewarded ads per daily player, 50% or more of players opting in on the Encore Spin, 2 to 4% of players paying by day 7, 30% or more of first-time payers buying again within 14 days.
