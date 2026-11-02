# Content TODO

Everything below is placeholder writing generated for Milestone 1, in the game's voice. It all needs a human pass before launch (spec section 17). Edit the JSON files directly; they are validated at boot.

## Curbside items (`src/data/items.json`)

60 base items (6 per slot) plus 3 unique Legendaries. `name` shows for Junk to Epic, `legendaryName` for Legendary and up.

| Slot | Name | Legendary name | Flavor |
|---|---|---|---|
| hat | Traffic Cone | Traffic Cone of Destiny | Orange is the new apex predator. |
| hat | Lawn Gnome Hat | Crown of the Gnome King | Stolen from a gnome who had it coming. |
| hat | Flower Pot | Terracotta Helm of the Petunia Lord | Still has dirt in it. Smells like spring. |
| hat | Yogurt Tub | The Strawberry Crown | Best before 2019. Best after, too. |
| hat | Paint Bucket | Bucket of Eggshell Doom | Color: Landlord Beige. |
| hat | Cracked Bike Helmet | Helm of Two Wheels | Safety first. Hygiene fourth. |
| mask | Tube Sock Mask | The Unwashed Veil | Two eyeholes. One regret. |
| mask | Gas Station Sunglasses | Shades of the Night Shift | UV protection not included. |
| mask | Pool Snorkel | Snorkel of the Deep End | For when the trash gets deep. |
| mask | Peewee Hockey Mask | Mask of Peewee Fury | Belonged to a goalie named Brayden. |
| mask | Egg Carton Mask | Visage of the Dozen | Twelve cups of pure intimidation. |
| mask | Coffee Filter Mask | Veil of the Morning Grind | Pre-moistened with yesterday's roast. |
| jacket | Garbage Bag Poncho | Hefty Mantle of Legend | Drawstring sold separately. |
| jacket | Lawn Chair Webbing Vest | Vest of Eternal Lounging | Folds up for easy storage. The raccoon does not. |
| jacket | Bubble Wrap Armor | Pop Plate of Invincibility | Do not pop. Seriously. Okay, one. |
| jacket | Ugly Holiday Sweater | The Festive Abomination | Knitted by someone's aunt. Cursed by another. |
| jacket | Blue Tarp Cape | Cape of the Covered Woodpile | Waterproof. Dignity-proof. |
| jacket | Tiny Dog Raincoat | Raincoat of Fluffy Vengeance | Monogrammed PRINCESS. Fits perfectly. |
| weapon | Garden Hose Whip | The Sprinkler Lash | Kinked in all the right places. |
| weapon | Broken Rake | Rake of a Thousand Leaves | Step on it. We dare you. |
| weapon | BBQ Spatula | The Grillmaster's Verdict | Flips burgers. Flips rats. |
| weapon | Pool Noodle | Noodle of Mass Destruction | Deals foam damage. |
| weapon | Wiffle Bat | Bat of the Backyard Champion | Mostly holes. Still hurts feelings. |
| weapon | Unlit Tiki Torch | Torch of the Patio Gods | No fuel. Pure attitude. |
| shield | Welcome Mat | The Unwelcome Bulwark | Says WELCOME. Means GO AWAY. |
| shield | Trash Can Lid | Lid of the Original Legend | The classic. Accept no substitutes. |
| shield | Chewed Frisbee | Disc of the Good Boy | Pre-chewed for your convenience. |
| shield | Minivan Hubcap | Hubcap of Hubris | Fell off a minivan going 4 mph. |
| shield | Cookie Tin | Tin of False Hope | Contains sewing supplies. Always. |
| shield | For Sale Sign | Sign of Below Asking | Motivated seller. Very motivated raccoon. |
| gloves | Rubber Dish Gloves | Gauntlets of the Sink | Lemon scented. Lemon powered. |
| gloves | Gardening Gloves | Green Thumbs of Fury | Something is living in the left one. |
| gloves | Oven Mitts | Mitts of the Burnt Casserole | Hot hands, literally. |
| gloves | Kid's Boxing Gloves | Fists of the Garage Champion | Signed by a nine-year-old. |
| gloves | Lost Mittens | Mittens of the Unmatched | Neither one matches. Both are legendary. |
| gloves | Baseball Mitt | Mitt of the Little League Hero | Never caught a ball. Caught feelings. |
| sneakers | Crocs | Crocs of Sport Mode | Heel strap engaged. It's over for you. |
| sneakers | Flip-Flops | Sandals of Infinite Flap | Flip. Flop. Gone. |
| sneakers | Roller Skates | Skates of the Cul-de-Sac | Three wheels. Faith in the fourth. |
| sneakers | Bunny Slippers | Slippers of the Midnight Fridge Raid | The ears flop when you run. |
| sneakers | Rain Boots | Galoshes of the Gutter Storm | Puddles fear these. |
| sneakers | Light-Up Sneakers | Kicks of the Strobing Night | Battery at 3%. Forever. |
| backpack | Dented Lunchbox | Lunchbox of the Eternal Recess | Thermos not included. The thermos was the best part. |
| backpack | Fanny Pack | Pouch of the Suburban Dad | Holds snacks, keys, and secrets. |
| backpack | Picnic Cooler | Cooler of Lukewarm Treasures | The ice melted in 2021. |
| backpack | Diaper Bag | Satchel of Many Pockets | Seventeen pockets. All sticky. |
| backpack | Blue Recycling Bin | The Bin That Sorts Itself | Plastics only. Rules are rules. |
| backpack | Reusable Tote | Tote of Eco Supremacy | Saved the planet once. Now saves snacks. |
| bling | Bottle Cap Chain | Chain of the Cap Collector | Every cap a memory. Every memory a soda. |
| bling | Lost House Key | Key to Somebody's Kingdom | Someone is locked out right now. |
| bling | Dog Tag | Tag of the Goodest Boy | If found, return to BISCUIT. |
| bling | Wind Chime Necklace | Chimes of the Porch Spirits | Tinkles menacingly. |
| bling | Soda Tab Bracelet | Bracelet of a Thousand Tabs | Took 40 years of soda to make. |
| bling | Christmas Ornament | Bauble of Eternal December | Still up in July. Like the lights. |
| ring | Onion Ring | Ring of the Deep Fryer | Edible armor. Do not eat. |
| ring | Pull Tab Ring | Ring of the Pop Top | Pop it on. Pop them off. |
| ring | Candy Ring | Gem of Sugary Bloodlust | Half licked. Fully powered. |
| ring | Rubber Band | Band of Snapback | Snaps back. Like the raccoon. |
| ring | Twist Tie Ring | Band of the Bread Bag | Holding together a family's sandwiches. |
| ring | Hardware Washer | Washer of the Garage Wizard | Quarter inch. Infinite power. |

### Unique Legendaries

| Slot | Name | Flavor | Bonus |
|---|---|---|---|
| weapon | The Leaf Blower of Saturday Morning | Wakes the whole street. Defeats the whole street. | ATK_SPD +10% |
| jacket | Safety Vest of the HOA President | Has opinions about your lawn. | HP +10% |
| shield | The Mailbox of Many Catalogs | Full of coupons. Full of power. | BAG_FIND +5 |

## Enemies (`src/data/enemies.json`)

| Id | Name | Kind |
|---|---|---|
| alley_rat | Alley Rat | regular |
| porch_pigeon | Porch Pigeon | regular |
| punk_raccoon | Punk Raccoon | regular |
| big_earl | Big Earl the Rat King | miniboss |
| vinnie_two_lids | Vinnie "Two Lids" | miniboss |
| officer_dale | Officer Dale, Animal Control | boss |

## Mint in Box perks (`src/data/affixes.json`)

| Name | Text |
|---|---|
| Collector's Aura | Never opened. Never defeated. |
| Original Packaging | The twist ties alone are worth a fortune. |
| Limited Edition | Only 12 were ever thrown away. |
| Still Has Tags | Returnable. Not that you would. |
| Certificate of Authenticity | Signed by a very official raccoon. |

## Still to write (later milestones)

- Food Court (Strip Mall) and Office Tower (Downtown) item themes: 120 base items + 6 unique Legendaries (M3).
- 12 more enemies for the Strip Mall and Downtown, with their mini-bosses and bosses (M3).
- 40 Heist choice events, 24 perks, 6 evolutions, 3 curses (M2, M3).
- Crew, Rides, Tricks, Shiny Things names and flavor (M3).

## UI copy

All UI strings are in `src/data/strings.en.json`, including the Suburbs neon-sign gag ("FREE TRASH (please take it)"). They are first drafts too.
