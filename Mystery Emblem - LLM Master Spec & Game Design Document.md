# **Mystery Emblem — LLM Master Spec & Game Design Document**

**Author:** Adam Kenawell  
**Platform:** Web Browser (hosted on existing Pokémon Mystery Dungeon sprite/animation API site)  
**Core Concept:** A tactical RPG fan game that mixes the grid-based combat, growth rates, overworld map, and battle prep of Fire Emblem (specifically Fire Emblem Awakening) with the characters, lore, moves, types, and items of Pokémon (using Pokémon Mystery Dungeon sprites and animations).

# **PART 1: STORY & GAME FLOW (5-ACT HOOPA & SPACE-TIME RIFT CANON)**

## **1.1 The Dragon Aura Personality Quiz, Fixed Hometown Family & New Game Plus**

When a player starts a new save file (`Start`), the game opens with an 8-question **Dragon Aura Personality Quiz** in the style of *Pokemon Mystery Dungeon: Explorers of Sky*:

* **Dragon-Lord-Only Quiz:**
  * Each answer adds personality points toward one of the **5 playable Stage-1 Dragon Lords**:
    * **Axew** (`Axew -> Fraxure -> Haxorus`) - *Red Flower Flabebe & Florges*
    * **Bagon** (`Bagon -> Shelgon -> Salamence`) - *Orange Flower Flabebe & Florges*
    * **Gible** (`Gible -> Gabite -> Garchomp`) - *Yellow Flower Flabebe & Florges*
    * **Dratini** (`Dratini -> Dragonair -> Dragonite`) - *Blue Flower Flabebe & Florges*
    * **Goomy** (`Goomy -> Sliggoo -> Goodra`) - *White Flower Flabebe & Florges*
  * Variable quiz-seeded chapter recruits are retired in favor of a tight, hand-authored story cast across all 5 Acts.
  * **New Game Plus (`NG+`) Mode:** Replaces the 8-question quiz with a direct **Dragon Lord Picker** while preserving all campaign levels, story cutscenes, and tactical rules.
* **Fixed Hometown Starting Trio & Mentor:**
  * **Dragon Lord (`Lv. 1`):** Force-deployed main protagonist; if `{lord}` faints, the map triggers Game Over. Grants `Dragon Aura` (`+10% Hit / +10% Avoid` within 2 tiles).
  * **Quaxly (`Lv. 1`, `Quaxly -> Quaxwell -> Quaquaval`):** Biological child of **Quaquaval** and loyal foster sibling to `{lord}`.
  * **Flabebe (`Lv. 1`, `Flabebe -> Floette -> Florges`):** Daughter of **Florges** and childhood best friend with a ranged healing move; her flower color (and her mother Florges's flower color) matches `{lord}` 1-to-1.
  * **Quaquaval (`mentor_quaquaval`, `Lv. 12` Water/Fighting Jagen):** Retired Royal Guard of **King Serperior**, father to `Quaxly`, and foster father to `{lord}`. Voices live combat coaching in Acts 1-2, authors **"Quaquaval's Field Notes"** (the replayable tactical tutorial compendium), joins your playable squad in Chapter 2, and is killed at the end of Act 2 when the Steel Kingdom betrays your expedition.
* **Persistent Nicknaming & Renaming Anytime:**
  * Every newly recruited Pokemon prompts a custom **Nickname** modal (preserved across evolutions and editable anytime from Overworld `Units` or `Battle Prep`).

## **1.2 Opening Sequence & Overworld Unveil (`Fire Emblem Awakening` Style)**

* **Linear Hometown Opening Before Overworld Unveil:**
  1. `Quiz` / `NG+` -> `cs_00_ancient_dragon_war` (Ancient Dragon Kingdom ruled in peace; **Hoopa** opens a Space-Time Rift summoning **Paradox Pokemon**; **Haxorus**, **Dragonite**, and **Goodra** sacrifice their remaining energy to seal the Rift as Hoopa slips into a portal, sealing away three Dragon Eggs: `Dreepy`, `Deino`, and `{lord}`).
  2. `cs_01_berry_walk_and_dinner` (`{lord}`, `Quaxly`, and `Flabebe` return from berry-picking to dinner with `Quaquaval` and `Florges`; `Quaquaval` insists on after-dinner sparring).
  3. `Prologue: Hometown Pitch` (`skipPrepPhase: true`): Two-phase training bout where Phase 1 vs. `Quaquaval` teaches movement, healing, Range-2 `Dragon Breath`, the 4-move cap, and dual Physical + Special `[E]` counter slots, and Phase 2 vs. hometown peers `Starly`, `Caterpie`, and `Pawmi` demonstrates super-effective damage (`Nuzzle`), Status Conditions (`PAR`), and item curing (`Paralyze Heal`) before defeating all three opponents.
  4. `cs_02_bedtime_and_watering_hole` -> `Chapter 1: Watering Hole` (`skipPrepPhase: true`): Bedtime talk wondering why `Quaquaval` trains them so hard, followed the next morning by fending off outlaw thugs at the watering hole.
  5. `cs_03_pidgeotto_summons` -> **Overworld Map Unveil**: Royal courier **Pidgeotto** interrupts dinner with word that **King Serperior** summons `Quaquaval` to the capital; as the family packs to cross the treacherous mountain, the node-based **Overworld Map** unveils for the first time.
* **Overworld Skirmishes & Act 2 Kecleon Shops:**
  * Occasional one-off Skirmishes may spawn on cleared Overworld nodes after chapter victories (clearing immediately once fought to prevent infinite grinding).
  * Traveling **Kecleon Shops** (TM, Held Item, Healing/Evolution, and X-Item shops) unlock in **Act 2** after rescuing **Master Merchant Kecleon**.

## **1.3 Battle Prep Screen (Introduced in Chapter 2)**

Starting in **Chapter 2 (`Foothill Trail`)** when `Quaquaval` joins your playable team, `Battle Prep` opens before Turn 1:
1. **Manage Units & Swap Starting Tiles:** Toggle deployed units up to the chapter's deployment cap (`{lord}` mandatory) and tap two blue deployment tiles on `View Map` to swap positions.
2. **Manage Moves & Dual `[E]` Slots:** Equip up to **4 moves** and mark up to **1 Physical (`Range 1`)** and **1 Special (`Range 2`)** `[E]` move for Enemy Phase counters.
3. **Manage Items:** Equip **1 Passive Held Item** and **1 Active Consumable** (such as `Potion`, `Paralyze Heal`, `Full Heal`, `Evolution Stone`, or `Evolution Gem`).

## **1.4 Five-Act Campaign Chronicle & Kingdom Politics**

See `Mystery Emblem - Lore, Kingdoms & Character Bible.md` for full character bios and realm lore:
* **Act 1 (`Expedition to Meet with King Serperior` - 100% Playable Deliverable):**
  * `Prologue` (**Hometown Pitch**): Core Trio (`{lord}`, `Quaxly`, `Flabebe`) sparring vs. `Quaquaval` & Town Trio (`Starly`, `Caterpie`, `Pawmi`).
  * `Chapter 1` (**Watering Hole**): Core Trio fends off outlaw thugs; `Pidgeotto` delivers Serperior's summons; Overworld unveils.
  * `Chapter 2` (**Foothill Trail**): `Quaquaval` reveals his secret past in Serperior's Royal Guard; introduces Battle Prep; rescue and recruit **Smoliv**.
  * `Chapter 3` (**Mountain Caves**): Night campfire & dawn meeting with **Machop** (guiding in place of busy `Machamp`); `"Get {lord} to the Exit"` cave pursuit. Unlocks `Paralogue 1` and `Chapter 4`.
  * `Paralogue 1` (**Lush Prairie**): Optional side quest recruiting `Lv. 1` Aptitude (`Hidden Potential` `+20%` growths) **Slakoth**.
  * `Chapter 4` (**Capital Outskirts**): Ambushed outside the capital by feral **Ancient Paradox Pokemon** (`Great Tusk`, `Flutter Mane`, `Slither Wing`, `Scream Tail`, `Brute Bonnet`); mid-battle, **Starly**, **Caterpie**, and **Pawmi** crash in (having trailed you from home) and join your squad.
  * `cs_06_capital_audience` (**Audience with King Serperior**): Solo **King Serperior** explains the Rift attacks and realm politics (Fire & Ice untouched; Forest Tribe believes they can fight alone; Sand & Steel agree with Verdant to uncover the truth), entrusts you with finding an ancient Pokemon sleeping in the Ice Kingdom, and grants two allies: **Honedge** (Steel Kingdom) and **Sandile** (Sand Kingdom), concluding Act 1 with 12 playable units and Ending Credits.
* **Act 2 (`Uncovering the Truth of the Past`):** Unlock Kecleon Shops; awaken ancient NPC sage **Baxcalibur** in the Ice Kingdom to learn of **Hoopa** and the three Dragon Eggs; Steel Kingdom backstabs your party, killing **Quaquaval** while disgusted **Honedge** stays permanently loyal.
* **Act 3 (`The Journey to Meet the Other Dragons`):** Cross the Fire (`Ember-Lord Torkoal`) and Forest (`Chieftain Zoroark`) realms; convince **Drakloak** (`Dreepy` Egg survivor) to lead an allied Forest force against the Rift.
* **Act 4 (`Marching Against the Steel Kingdom`):** Defeat **Emperor Kingambit**, chase fleeing **Hydreigon** (`Deino` Egg survivor), and discover **Hoopa** is alive and behind it all.
* **Act 5 (`Sealing the Rift`):** **Dragapult** joins your playable team to descend into the Rift against **Ancient + Future Paradox Pokemon**; defeat and recruit **Hydreigon** in the penultimate battle; defeat **Hoopa Confined** -> **Hoopa Unbound** in the two-phase final boss battle.

## **1.5 Strict Faction Separation & Convertible Exceptions**

* Playable units follow a manual Lv. 1-40 progression curve (`Evolution Stone` at Lv. 10+, `Evolution Gem` at Lv. 20+, `Eevee` branching Stone at Lv. 15+, `Slakoth` `Hidden Potential` `+20%` growths).
* Enemy lines (`Outlaws`, `Steel Kingdom` legions, `Ancient & Future Paradox Pokemon`, and `Hoopa`) never overlap with playable lines, except for explicitly flagged `convertible` story defectors (`deino_line` for Act 5 Hydreigon, `gastly_line` for Paralogue 6 Gastly, and `seedot_line` for Forest Tribe Seedot) plus `friendlyBout` / `sparring` hometown training bouts in the Prologue.

## **1.6 Cutscenes, Dialogue & PMD Character Portraits**

All story cutscenes, chapter introductions, boss battle pre-combat banters, and mid-battle recruitment conversations use authentic **Pokemon Mystery Dungeon character portraits** and 8-directional SpriteCollab map sprites.

# **PART 2: CORE GAME & BATTLE MECHANICS**

## **2.1 Manually Customized Base Stats, Growth Rates & Leveling Curve**

Rather than using an automated mathematical formula to convert PokéAPI base stats into Fire Emblem numbers, **every Pokémon's Base Stats, Join Level, Movement (Mov), and Percentage Growth Rates (`HP`, `Atk`, `Def`, `SpA`, `SpD`, `Spe`) are manually customized and tuned** through playtesting.

* **Manual Stat & Growth Configuration:**  
  * Each playable and enemy Pokémon stage is defined in a central, human-editable data table/JSON file with explicit values for its starting/base stats (`HP`, `Atk`, `Def`, `SpA`, `SpD`, `Spe`, `Mov`), its join level, and its six percentage growth rates (`0%–100%`).  
  * This allows complete creative control over unit archetypes (e.g., making a specific Pokémon a high-HP/low-Defense sponge, a glass-cannon speedster, or a balanced all-rounder without being locked to mainline Pokémon stat quirks).  
* **Continuous Leveling & Hard Cap (Level 40):**  
  * Units use a continuous level counter from **Level 1 up to a hard cap of Level 40** (evolving does not reset a unit's displayed level to 1).  
* **Expected Campaign Level Pacing:**  
  * **Act 1 (Prologue – Chapter 6):** Levels 1 to 10  
  * **Act 2 (Chapters 7 – 13):** Levels 10 to 17 (Stage 2 evolutions unlock at Level 10 via **Evolution Stones**)  
  * **Act 3 (Chapters 14 – 20):** Levels 17 to 24 (Stage 3 evolutions unlock at Level 20 via **Evolution Gems**)  
  * **Act 4 (Chapters 21 – 25):** Levels 24 to \~30 (Most core units finish the final chapter around **Level 30**, leaving Levels 31–40 as headroom so units almost never hit the hard cap during normal play)  
* **EXP Gain & Level-Up Rolls:**  
  * Every **100 EXP** triggers a level-up and rolls `1–100` against each stat's manually assigned growth rate to determine whether that stat increases by `+1`.  
  * **Damage EXP (Per Combat Round):** `clamp(15 + (Enemy_Lv - Unit_Lv) * 3, 1, 30)`  
  * **Defeat Bonus EXP (Added on KO):** `clamp(35 + (Enemy_Lv - Unit_Lv) * 6, 5, 70)` (50 total EXP for an equal-level KO, scaling down if over-leveled or scaling up to help under-leveled recruits catch up).  
  * **Support / Heal Move EXP:** `clamp(20 - max(0, Unit_Lv - Chapter_Lv) * 3, 5, 20)`

## **2.2 Static Movement (Mov) & PMD: Explorers of Sky Dungeon Terrain**

Each Pokémon stage has a manually assigned **Movement (`Mov`)** stat (typically between **4 and 7 tiles**) that **does not** increase on random level-ups (it only changes if the Pokémon evolves into a stage with a different assigned `Mov`, or via a specific Personal Skill/Held Item).

* **Typical Movement Tiers:**  
  * **4 Mov:** Heavy / Armored tanks and slow bruisers (e.g., Aron, Beldum, Geodude, Rolycoly, Slakoth)  
  * **5 Mov:** Standard balanced infantry and casters (e.g., most Stage-1 and Stage-2 starters, Machop, Poliwag, Duskull)  
  * **6 Mov:** Swift flankers, flyers, and promoted sweepers (e.g., Pidgey, Starly, Gastly, Abra, Obstagoon)  
  * **7 Mov:** Hyper-speed glass cannons and fully promoted speedsters (e.g., Dragapult, Jolteon, Crobat)

**Terrain Traversal Classes:**

10. **Grounded:** Standard movement costs and terrain Defense/Avoid bonuses. (Water-types cross Water tiles at 1 Mov; Fire-types cross Lava tiles at 1 Mov without taking burn damage; Rock/Ground/Fighting-types cross Mountains at 2 Mov instead of 3).  
11. **Flying (Flying-Types):** Works like flyers in Fire Emblem. Pays 1 Mov across Trees, Water, Lava, and Mountains, gets 0 terrain Defense/Avoid bonuses, and cannot cross **Void / Chasm** tiles or thick **Dungeon Walls**.  
12. **Levitate (Units with the Levitate Personal Skill):** True omni-traversal. Bypasses almost all tiles at 1 Mov cost—including **Void / Chasm** tiles, **Lava**, **Water**, and low **Barriers** that block other units. Gets 0 terrain bonuses except on Wonder Tiles and Stairs.

| PMD: EoS Tile Type | Grounded Mov | Flying Mov | Levitate Mov | Tile Effect & Bonuses (Grounded Only unless noted) |
| :---- | :---- | :---- | :---- | :---- |
| **Dungeon Floor** | 1 | 1 | 1 | \+0 Def/SpD, 0% Avoid |
| **Trees / Foliage** | 2 | 1 | 1 | \+1 Def/SpD, \+15% Avoid |
| **Dungeon Stairs** | 1 | 1 | 1 | \+1 Def/SpD, \+10% Avoid (All units); Spawns enemy reinforcements unless blocked by a player unit |
| **Water / Stream** | Impassable (1 if Water) | 1 | 1 | \+0 Def/SpD, \+10% Avoid (Water-types only) |
| **Lava / Magma** | Impassable (1 if Fire) | 1 | 1 | \+0 Def/SpD, \+10% Avoid (Fire-types only) |
| **Mountain / Crag** | 3 (2 if Rock/Ground/Fight) | 1 | 1 | \+2 Def/SpD, \+20% Avoid |
| **Void / Chasm** | Impassable | Impassable | 1 | \+0 Def/SpD, 0% Avoid; Only Levitate units can cross |
| **Wonder Tile** | 1 | 1 | 1 | \+2 Def/SpD, \+20% Avoid, Heals 20% HP & clears debuffs each turn (All units) |

## **2.3 Combat Mechanics, Move Stats, Status Effects & Dual-Equipped Enemy Phase**

Moves function like **weapons and tomes in Fire Emblem**, with manually balanced tactical stats and a **dual-equipped (Physical + Special) move rule** for Enemy Phase counter-attacks.

* **Move Attributes (Fire Emblem Weapon Stats):**  
  Every move in the game's move database is defined by the following stats:  
  * **Type:** One of the 18 Pokémon elemental types (determines STAB and Type Chart effectiveness).  
  * **Category & Range:**  
    * **Physical Moves (Range 1):** Attack adjacent orthogonal tiles (`1` tile away). Targets `Attack` vs. `Defense` (e.g., *Tackle*, *Scratch*, *Mach Punch*, *Bite*, *Rock Slide*, *Earthquake*).  
    * **Special Moves (Range 2):** Attack tiles at a distance of `2` (`2` tiles away; cannot hit adjacent foes at `1` range unless specified by a rare move effect). Targets `Sp. Atk` vs. `Sp. Def` (e.g., *Water Gun*, *Ember*, *Thunder Shock*, *Confusion*, *Shadow Ball*).  
    * **Healing & Status-Inflicting Support Moves (Range 1 or 1–2):** Direct ally healing moves (e.g., *Heal Pulse*, *Soft-Boiled*, *Wish*) or status-condition moves (e.g., *Thunder Wave*, *Will-O-Wisp*, *Toxic*, *Hypnosis*) used on Player Phase. Cannot be used to counter-attack on Enemy Phase.  
  * **No Dedicated Stat-Boosting or Stat-Lowering Moves:**  
    * Pure stat-changing moves like *Growl*, *Tail Whip*, *Leer*, *Swords Dance*, *Calm Mind*, or *Dragon Dance* **do not exist in the game** to prevent turtling and stat-stacking from breaking the tactical math.  
    * Instead, **stat boosts and stat drops only occur as random-chance secondary effects attached to damaging moves** (for example, *Shadow Ball* or *Psychic* having a `20%` chance to lower the target's `Sp. Def` by `-2` for 2 turns, *Crunch* having a `20%` chance to lower `Defense` by `-2`, or *Metal Claw* / *Flame Charge* having a `20%` chance to boost the user's `Attack` or `Speed` by `+2`).  
  * **Might (Mt):** The flat base power of the move (similar to Weapon Might in *Fire Emblem*, typically scaling from `3–5 Mt` for early moves like *Tackle*/*Water Gun* up to `10–14 Mt` for endgame moves like *Flamethrower*/*Close Combat*).  
  * **Hit (%):** The base accuracy percentage of the move (e.g., `90%`, `100%`, `75%`).  
  * **Crit (%):** Critical hit chance bonus granted by the move (typically `0%–5%`, or `15%–25%` for high-crit moves like *Slash*, *Night Slash*, or *Shadow Claw*).  
  * **PP (Uses per Battle):** How many times the move can be used during a map (acting as weapon durability that refreshes between chapters).  
  * **Secondary Effect (Optional):** Random percentage chance (`10%–30%`) to inflict a Status Condition or apply a temporary stat buff/debuff on hit.  
* **4-Move Battle Loadout & Dual-Equipped Move Rule (Enemy Phase):**  
  * **Pre-Battle Loadout (Up to 4 Moves):** During the Pre-Battle (Battle Prep) screen, the player can equip up to **4 moves** onto each Pokémon from that unit's unlocked learnset.  
  * **Player Phase Selection:** On Player Phase, when a unit initiates combat, the player can freely pick **any of the unit's 4 equipped moves** that is in range of the target.  
  * **Dual Equipped Moves During Enemy Phase:** Like carrying a sword and a bow in *Fire Emblem*, **a Pokémon can have ONE Physical (Range 1) and ONE Special (Range 2) move equipped at a time during Enemy Phase**:  
    * Whichever Physical / Special move the Pokémon used most recently on Player Phase (or whichever move the player manually sets via the **"Equip"** submenu) fills that category's slot and is marked with an **\[E\] (Equipped)** badge. Tapping an equipped \[E\] again leaves that slot deliberately empty.  
    * During **Enemy Phase**, the defending Pokémon **counter-attacks with its Physical \[E\] against Range 1 attacks and its Special \[E\] against Range 2 attacks**; with no \[E\] for that range it cannot counter.  
* **Damage, STAB, Type Chart & Critical Hit Multipliers:**  
  * **STAB (Same-Type Attack Bonus):** Grants a **1.25x multiplier** to damage when the move's elemental type matches one of the user's types (`M_STAB = 1.25`, otherwise `1.0`).  
  * **Type Effectiveness Multipliers (`M_Type`):**  
    * **Extremely Effective (Double Weakness):** `1.5x`  
    * **Super Effective (Single Weakness):** `1.25x`  
    * **Neutral:** `1.0x`  
    * **Not Very Effective (Single Resistance):** `0.75x`  
    * **Mostly Ineffective (Double Resistance):** `0.5x`  
    * **Immune:** `0x` (Deals `0` damage)  
  * **Critical Hits (`M_Crit`):** Multiply damage by **2.0x** (`M_Crit = 2.0`, otherwise `1.0`).  
    * **Crit Rate (%):** `clamp(Move Crit + floor(User Speed / 2) + Item/Skill Bonus, 0, 100)`  
  * **Combat Damage Formulas:**  
    * **Effective Attack:** `floor(User Atk * 0.5)` if the user is **Burned** (for Physical moves), or `floor(User SpA * 0.5)` if the user is **Frozen** (for Special moves); otherwise full `User Atk` or `User SpA`.  
    * **Raw Base Damage:** `max(1, (Effective Atk or SpA + Move Mt) - (Target Def or SpD + Terrain Bonus))`  
    * **Final Damage:** `0` if `M_Type == 0`; otherwise `max(1, floor(Raw Base Damage * M_STAB * M_Type * M_Crit))`  
  * **Doubling (Follow-Up Attack):** Triggers if `(User Speed - Target Speed) >= 5`.  
  * **Hit Rate (%):** `clamp(Move Hit + (User Speed - Target Speed) * 2 - Terrain Avoid, 15, 100)`  
* **The 5 Status Conditions:**  
  A unit can only be afflicted with **one non-volatile status condition at a time** (cleared after battle, on a Wonder Tile, or via a Full Heal / Lum Berry):

| Status Condition | Tactical Effect on the Grid | Duration / Cure Rule |
| :---- | :---- | :---- |
| **Paralysis (PAR)** | Each time the unit attempts an attack (on Player Phase or Enemy Phase), there is a **1/3 chance (33.3%)** that it is fully paralyzed and loses that attack. | Persists until cured or battle ends (Electric-types are immune). |
| **Poison (PSN)** | The unit loses **1/8 of its Max HP** at the start of each of its phases (cannot reduce HP below 1 outside combat, or KOs at 0 HP). | Persists until cured or battle ends (Poison and Steel-types are immune). |
| **Burn (BRN)** | The unit loses **1/16 of its Max HP** at the start of each of its phases, and its **Physical damage is halved (0.5x)**. | Persists until cured or battle ends (Fire-types are immune). |
| **Freeze (FRZ)** | Cuts the unit's **Movement (Mov) in half** (`floor(Mov / 2)`) and **halves its Special damage (0.5x)**. | Automatically thaws after **2 to 5 turns** (or immediately if hit by a Fire-type move; Ice-types are immune). |
| **Sleep (SLP)** | The unit **cannot act at all** (cannot move, attack, counter-attack, or use items) during its turn. | Lasts **1 to 2 turns**, then the unit wakes up automatically at the start of its phase. |

## **2.4 Evolution & Promotion System (Fire Emblem Class Change Model)**

To mirror the class promotion system of *Fire Emblem*, standard playable Pokémon belong to **3-stage evolution lines** and evolve using two universal promotion items along the continuous Level 1–40 curve (with two special Paralogue exceptions):

* **Stage 1 to Stage 2 (Level 10+):** Once a base-stage Pokémon reaches **Level 10** (or higher), it can use an **Evolution Stone** to evolve into its middle stage. Its level remains at its current number and it continues leveling toward Level 20\.  
* **Stage 2 to Stage 3 (Level 20+):** Once a middle-stage Pokémon reaches **Level 20** (or higher), it can use an **Evolution Gem** to evolve into its final stage, continuing toward \~Level 30 (hard cap Level 40).  
* **How Evolution Items Are Used:** Players can use an Evolution Stone or Evolution Gem during Battle Prep / on the Overworld, or equip it in a Pokémon's active Consumable slot and trigger the evolution mid-battle as that unit's turn action (just like a Master Seal in *Fire Emblem*).  
* **What Happens on Evolution (Manually Configured Promotion Bonuses):**  
  * **Immediate Stat Promotion Bonus:** The Pokémon immediately gains the **manually configured promotion stat bonuses** defined for its new evolution stage (`+HP`, `+Atk`, `+Def`, `+SpA`, `+SpD`, `+Spe`).  
  * **Growth Rate & Personal Skill Upgrade:** The Pokémon's percentage growth rates and Personal Skill update to the manually configured values of the new evolution stage.  
  * **Movement & Traversal Update:** The unit's Movement (`Mov`) updates to the new stage's configured `Mov`, and its Terrain Traversal Class updates if it gains the Flying type or Levitate Personal Skill.  
  * **Sprite & Portrait Upgrade:** The unit's map sprite, animations, and dialogue emotion portraits swap to the new stage's PMD assets.  
* **Special Paralogue Unit Rules (Eevee & Slakoth):**  
  * **Eevee (Single Branching Evolution at Level 15+):** Recruited in Paralogue 2, Eevee is the sole 2-stage exception in the roster. Eevee evolves **only once at Level 15+** when given an **Evolution Stone**, opening a branching selection modal allowing the player to choose **any of the 8 Eeveelutions** (**Vaporeon**, **Jolteon**, **Flareon**, **Espeon**, **Umbreon**, **Leafeon**, **Glaceon**, or **Sylveon**) with custom promotion bonuses and growth rates tuned for a single-promotion unit.  
  * **Slakoth ("Aptitude" Growth Unit):** Recruited in Paralogue 1 at Level 1, Slakoth functions like Donnel in *Fire Emblem Awakening*. It starts with very low manually tuned base stats, but its Personal Skill **Hidden Potential** permanently adds a flat **\+20% to all six of its stat growth rates** across all three of its evolution stages (Slakoth \-\> Vigoroth at Lv. 10 \-\> Slaking at Lv. 20).

## **2.5 Move Learning Progression & Single-Use General TMs**

Pokémon build their move pools through a combination of **unique, irregular level-up learnsets** and **consumable, general-purpose TMs**:

* **Bespoke Level-Up Learnsets (Non-Uniform Pacing):**  
  * Pokémon **do not** learn a new move every single level or on a rigid universal schedule.  
  * Instead, each Pokémon has a manually curated level-up learnset table where it learns specific moves at varied, character-defining levels (for example, one Pokémon might learn moves at Levels `1, 4, 9, 13, 18, 23, 28`, while another learns moves at Levels `1, 3, 7, 10, 16, 20, 26`).  
  * This makes every character's leveling journey and power spikes feel distinct—some units unlock their signature high-Might or status-inflicting move early, while others unlock a game-changing move right after promoting.  
* **Unlocked Move Pool vs. 4-Move Active Loadout:**  
  * Whenever a Pokémon learns a new move (via level-up or TM), that move is permanently added to that unit's **Unlocked Move Pool**.  
  * If a Pokémon learns a 5th+ move mid-battle, the player can either swap it into one of the unit's 4 active slots immediately or send it to the unit's Unlocked Move Pool.  
  * During the **Pre-Battle (Battle Prep) Screen**, the player can freely swap any **4 moves** in and out of the unit's active loadout from its full Unlocked Move Pool at no cost.  
* **Technical Machines (TMs) — Single-Use & General Purpose:**  
  * **Consumable One-Time Use:** TMs are single-use items found in dungeon chests, dropped by commanders, or purchased in Overworld shops. **Once a TM is used to teach a move to a Pokémon, the TM is consumed and disappears from your inventory** (working like classic Pokémon TMs and *Fire Emblem* skill scrolls).  
  * **General-Purpose Move Pool:** While level-up learnsets focus on a Pokémon's unique signature moves, TMs provide **broader, general-purpose offensive and utility moves** (e.g., *Protect*, *Swift*, *Return*, *Dig*, *Aerial Ace*, *Brick Break*, *Flamethrower*, *Ice Beam*, *Thunderbolt*, *Shadow Ball*, *Reflect*, *Light Screen*, *Toxic*, *Rest*).  
  * **Compatibility:** Each TM specifies which Pokémon (by Type or explicit compatibility list) can learn it, letting players spend scarce TMs to patch a favorite unit's range or elemental coverage (such as giving a pure 1-range physical brawler a 2-range Special TM so it can fight at range when needed).

## **2.6 Personal Skills (Translated from Pokémon Abilities)**

Every Pokémon has a **Personal Skill** derived from its ability in the mainline Pokémon series (functioning like Personal Skills in *Fire Emblem Fates*, *Three Houses*, or *Engage*).

* **Manually Designed & Balanced:**  
  * Rather than importing raw mainline Pokémon mechanics, **every Personal Skill's exact tactical effect on the grid is manually decided and balanced by the developer**.  
  * Each Pokémon has 1 innate Personal Skill (which can either stay the same across its 3 stages or upgrade when it evolves at Levels 10 and 20, depending on manual configuration).  
* **Representative Examples (Subject to Manual Balancing):**  
  * **Hidden Potential (Slakoth Line):** Permanently increases all six stat growth rates by `+20%`.  
  * **Levitate (Gastly / Duskull / Vibrava / Hydreigon, etc.):** Grants the **Levitate** terrain traversal class, allowing the unit to cross Void, Lava, Water, and Barrier tiles at `1 Mov` cost.  
  * **Overgrow / Blaze / Torrent (Starter Lines):** Grants `+3 Damage` with Grass / Fire / Water moves when the unit's current HP is at or below `50%`.  
  * **Intimidate (Shinx / Starly / Krookodile Lines):** At the start of Player Phase (or when moving adjacent), inflicts `-2 Attack` for 1 turn on enemies within `2 tiles`.  
  * **Guts (Machop / Timburr / Obstagoon Lines):** Grants `+3 Attack` when afflicted with a status condition (Burn, Poison, Paralysis) and ignores Burn's Attack reduction.  
  * **Sturdy (Geodude / Roggenrola / Aron Lines):** Once per battle, if the unit is at `100% HP` and would be KO'd by an attack, it survives with `1 HP`.  
  * **Stance Change (Aegislash Line):** Grants `+4 Def / +4 Sp. Def` when defending on Enemy Phase (Shield Forme) and `+4 Atk / +4 Sp. Atk` when initiating combat on Player Phase (Blade Forme).

## **2.7 Items System: X-Items, Permanent Stat Boosters & Held Items Catalog**

Every Pokémon has **2 Item Slots** during battle: **1 Consumable / Utility Slot** (activated as a turn action on Player Phase) and **1 Held Item Slot** (providing passive in-battle effects).

### **2.7.1 X-Items (Single-Battle Stat Boosters)**

Purchased from **Kecleon X-Item Shops** or found in dungeon chests, **X-Items** are single-use consumables placed in a unit's Consumable Slot. Using an X-Item consumes the unit's action for that turn and grants a **one-time stat boost that lasts for the entire remainder of the current battle**, reverting to normal once the chapter ends (cannot stack the same X-Item twice on the same unit in one battle):

* **X Attack:** Grants `+3 Attack` for the rest of the battle.  
* **X Defense:** Grants `+3 Defense` for the rest of the battle.  
* **X Sp. Atk:** Grants `+3 Sp. Atk` for the rest of the battle.  
* **X Sp. Def:** Grants `+3 Sp. Def` for the rest of the battle.  
* **X Speed:** Grants `+3 Speed` (and `+6% Avoid`) for the rest of the battle.  
* **Dire Hit:** Grants `+20% Critical Hit Rate` for the rest of the battle.

### **2.7.2 Permanent Stat-Boosting Items (Vitamins — Very Rare)**

Working just like stat-boosting items in *Fire Emblem* (Energy Drop, Spirit Dust, Speedwing, Dracoshield, Angelic Robe), **Vitamins** are **very rare, single-use items** obtained only from major boss drops, hidden dungeon chests, or Paralogue rewards. Using one permanently increases a Pokémon's base stat:

* **HP Up:** Permanently increases a Pokémon's **Max HP by \+3**.  
* **Protein:** Permanently increases a Pokémon's **Attack by \+2**.  
* **Iron:** Permanently increases a Pokémon's **Defense by \+2**.  
* **Calcium:** Permanently increases a Pokémon's **Sp. Atk by \+2**.  
* **Zinc:** Permanently increases a Pokémon's **Sp. Def by \+2**.  
* **Carbos:** Permanently increases a Pokémon's **Speed by \+2**.  
* **PP Max / PP Up:** Permanently increases the per-battle **PP (uses) of a chosen move by \+3**.

### **2.7.3 Held Items Catalog (Passive Slot)**

Each Pokémon can equip **1 Held Item** in its passive slot. Reusable gear persists across battles, while consumable **Berries** trigger automatically when their threshold is met during battle:

| Held Item | Category | Special Tactical Effect in Battle |
| :---- | :---- | :---- |
| **Leftovers** | Reusable Gear | Restores **10% Max HP** (`min 2 HP`) at the start of every Player Phase. |
| **Shell Bell** | Reusable Gear | Whenever the holder deals damage in combat, restores HP equal to **25% of the damage dealt**. |
| **Oran Berry** | Consumable Berry | Automatically consumed when HP drops to **50% or below**, immediately restoring **10 HP**. |
| **Sitrus Berry** | Consumable Berry | Automatically consumed when HP drops to **50% or below**, immediately restoring **40% Max HP**. |
| **Lum Berry** | Consumable Berry | Automatically consumed the moment the holder is afflicted with any **Status Condition** (PAR, PSN, BRN, FRZ, SLP), curing it immediately. |
| **Type Enhancers** (*Charcoal, Mystic Water, Miracle Seed, Magnet, Never-Melt Ice, Black Belt, Sharp Beak, Poison Barb, Soft Sand, Hard Stone, Twisted Spoon, Silver Powder, Spell Tag, Dragon Fang, Black Glasses, Metal Coat, Silk Scarf, Pixie Plate*) | Reusable Gear | Increases the damage of moves matching that item's elemental type by **\+2 flat damage** (or `1.15x`). |
| **Muscle Band** | Reusable Gear | Increases the damage of all **Physical (1-range) moves** by **\+2**. |
| **Wise Glasses** | Reusable Gear | Increases the damage of all **Special (2-range) moves** by **\+2**. |
| **Expert Belt** | Reusable Gear | Increases the damage of **Super Effective** and **Extremely Effective** moves by an extra **\+3 damage**. |
| **Life Orb** | Reusable Gear | Increases all damage dealt by **\+4**, but the holder loses **10% Max HP** after each combat in which it attacks. |
| **Choice Band** | Reusable Gear | Increases **Attack by \+4**, but locks the holder into using only the first move it selects for the rest of the map (unless unequipped). |
| **Choice Specs** | Reusable Gear | Increases **Sp. Atk by \+4**, but locks the holder into using only the first move it selects for the rest of the map. |
| **Choice Scarf** | Reusable Gear | Increases **Speed by \+4** and **Movement (Mov) by \+1**, but locks the holder into using only the first move it selects for the rest of the map. |
| **Assault Vest** | Reusable Gear | Increases **Sp. Def by \+4**, but prevents the holder from using non-damaging Support/Healing moves. |
| **Eviolite** | Reusable Gear | Grants **\+3 Defense and \+3 Sp. Def** as long as the holder is not in its final (Stage 3 / Eeveelution) evolution stage. |
| **Rocky Helmet** | Reusable Gear | If an enemy strikes the holder with a **1-range Physical move**, the attacker takes **20% of its Max HP** as recoil damage after combat. |
| **Focus Sash** | Single-Battle Gear | If the holder is at **100% HP** and would be KO'd by an attack, it survives with **1 HP** (triggers once per battle). |
| **Heavy-Duty Boots** | Reusable Gear | Grounded holder ignores movement penalties on **Trees/Foliage** and **Mountain** tiles (pays 1 Mov). |
| **Scope Lens** | Reusable Gear | Increases the holder's **Critical Hit Rate by \+15%**. |
| **Wide Lens** | Reusable Gear | Increases the holder's **Hit Rate (Accuracy) by \+15%**. |
| **Quick Claw** | Reusable Gear | On Enemy Phase, gives a **25% chance** for the holder to strike **before** the initiating enemy attacks (Vantage effect). |

## **2.8 Character Support System (Levels 1–5 & Up to 3 Adjacent Allies)**

Inspired by the Support system in *Fire Emblem Awakening*—but streamlined so it focuses purely on tactical grid positioning without requiring hundreds of separate support cutscene scripts—Pokémon build **Support Levels (1 through 5\)** by fighting side-by-side.

* **How Support Grows in Battle:**  
  * Whenever a player Pokémon engages in combat (initiating an attack on Player Phase, defending/counter-attacking on Enemy Phase, or using a healing/support move) while **orthogonally adjacent (1 tile away)** to one or more allied Pokémon, a small bond/heart visual effect triggers over the adjacent allies and each pair gains **\+1 Support Point**.  
  * Support points and unlocked Support Levels are tracked persistently per Pokémon pair across the entire campaign and can be inspected in the **Supports** menu on the Overworld or Battle Prep screen.  
* **Support Level Thresholds (Levels 1 to 5):**  
  * **Support Level 1:** 5 cumulative adjacent combat interactions  
  * **Support Level 2:** 12 cumulative adjacent combat interactions  
  * **Support Level 3:** 22 cumulative adjacent combat interactions  
  * **Support Level 4:** 35 cumulative adjacent combat interactions  
  * **Support Level 5 (Max):** 50 cumulative adjacent combat interactions  
* **Adjacency Combat Stat Bonuses (Works with Up to 3 Adjacent Pokémon):**  
  * Whenever a Pokémon enters combat, the engine checks all orthogonally adjacent tiles (1 tile N, S, E, W) for allied Pokémon that share a Support Level (`1–5`) with the fighting unit.  
  * A Pokémon can receive support bonuses from **up to 3 adjacent allied Pokémon simultaneously**, and the stat bonuses from all qualifying adjacent allies (up to 3\) **stack additively** during combat:

| Support Level | Atk & Sp. Atk Bonus | Def & Sp. Def Bonus | Hit Rate Bonus | Avoid Bonus | Crit Bonus |
| :---- | :---- | :---- | :---- | :---- | :---- |
| **Level 1** | \+1 Atk / \+1 SpA | \+0 Def / \+0 SpD | \+3% Hit | \+3% Avoid | \+2% Crit |
| **Level 2** | \+1 Atk / \+1 SpA | \+1 Def / \+1 SpD | \+5% Hit | \+5% Avoid | \+4% Crit |
| **Level 3** | \+2 Atk / \+2 SpA | \+1 Def / \+1 SpD | \+8% Hit | \+8% Avoid | \+6% Crit |
| **Level 4** | \+2 Atk / \+2 SpA | \+2 Def / \+2 SpD | \+10% Hit | \+10% Avoid | \+8% Crit |
| **Level 5** | \+3 Atk / \+3 SpA | \+3 Def / \+3 SpD | \+15% Hit | \+15% Avoid | \+10% Crit |

  * *3-Ally Cap Rule:* If a unit happens to be surrounded on all 4 orthogonal sides by supported allies, only the **3 highest-level support partners** apply their bonuses.

# **PART 3: LLM AGENT INSTRUCTIONS, UI AESTHETIC, CONTROLS & ARCHITECTURE**

## **3.1 Cross-Platform Requirement (PC & Mobile Parity)**

* **Strict PC \+ Mobile Mandate for the LLM Agent:** Every feature, screen, menu modal, and canvas interaction built for *Mystery Emblem* **must be 100% playable and responsive on both PC (Desktop Mouse) and Mobile (Touchscreen)** browsers.  
* **Agent Verification Checklist on Every Feature Addition:**  
  * **Unified Pointer Events:** Use unified Pointer Events (`pointerdown`, `pointermove`, `pointerup`) or paired Mouse \+ Touch handlers so panning, clicking nodes, selecting tiles, and navigating menus work identically with a mouse cursor or a finger tap.  
  * **Responsive Layout & Touch Targets:** All menus, unit cards, and action buttons must scale cleanly across desktop (`16:9`) and mobile (`portrait` or `landscape`) viewports, with touch-friendly button hitboxes (`minimum 44x44px`) and scrollable lists that support touch-drag.  
  * **Right-Click Parity on Mobile:** Because right-click opens menus and cancels actions on PC, the UI **must always provide a visible PMD-styled "Menu / Back" button in the screen corner (plus long-press support)** so mobile players have effortless one-tap access to every right-click function.

## **3.2 Pokémon Mystery Dungeon Visual & Menu Aesthetic**

* **UI Window Styling:** All menus, dialogue frames, unit stat sheets, shop interfaces, and combat forecast panels must match the classic *Pokémon Mystery Dungeon: Explorers of Sky* aesthetic:  
  * **Window Backgrounds:** Deep translucent navy/charcoal backgrounds (`rgba(16, 24, 40, 0.92)`).  
  * **Borders & Frames:** Classic PMD double-layered pixel-art window borders (outer cyan/blue trim with inner gold/white corner accents).  
  * **Typography:** Crisp pixel/bitmap RPG font (e.g., *Press Start 2P*, *VT323*, or *PMD Wonder Mail* font) with drop shadows for high legibility on both PC monitors and phone screens.  
  * **Portraits & Sprites:** Pull all character emotion portraits and directional 8-way map sprites directly from the existing site's PMD Git repository endpoints.

## **3.3 Strictly Point-and-Click / Touch Controls (Zero Keyboard Controls)**

* **No Keyboard Controls:** The agent must **not** bind or require any keyboard keys (`WASD`, arrow keys, `Space`, `Enter`, `Esc`). Every interaction in the game is 100% point-and-click (PC) and tap/drag (Mobile):  
  * **Map Panning (Overworld & Battle Grid):** Click-and-drag (PC) or single-finger touch-drag (Mobile) pans the camera smoothly across the Overworld map or the tactical battlefield grid.  
  * **Overworld Node Movement:** Clicking/tapping any unlocked node on the Overworld map moves the player's Lord sprite along the path to that node. Clicking/tapping the active node opens the prompt to start the Chapter, fight the Skirmish, or enter the Kecleon Shop.  
  * **Right-Click (PC) / Menu Button or Long-Press (Mobile):**  
    * When viewing the **Overworld Map** or an **empty state on the Battle Grid**, right-clicking (or tapping the on-screen **Menu** button) opens the main system menu.  
    * When inside any **submenu, unit movement preview, or target selector**, right-clicking (or tapping the **Back / Cancel** button) steps back one menu level or cancels the unit's uncommitted movement.

## **3.4 Fire Emblem Awakening-Style Menu Systems & Guidelines**

The agent must structure the game's menu flows after *Fire Emblem Awakening*, styled with the *Pokémon Mystery Dungeon* visual skin:

13. **Overworld Right-Click Menu:**  
    * **Units / Roster:** Inspect all recruited Pokémon, view their stats/growths/Personal Skills, **rename any Pokémon's nickname at any time**, or use permanent stat boosters (Vitamins) and Evolution Stones/Gems.  
    * **Items / Convoy:** Manage the global inventory of Held Items, Consumables, X-Items, and single-use TMs, and swap items onto or off of any Pokémon.  
    * **Supports:** View a relationship matrix showing the current Support Level (`1–5`) and progress bar between any pair of Pokémon in your roster.  
    * **Save / System:** Save current campaign progress, sign in or out with a **Google Account** ("Sign in with Google" via Firebase Authentication, also accessible from the Title Screen) to automatically sync save data across desktop and mobile devices via Cloud Firestore, export/import a manual JSON backup file, or return to the Title / New Game Plus screen.  
14. **Pre-Battle (Battle Prep) Menu:**  
    * **Select Units:** Grid of all owned Pokémon; click/tap to toggle deployment up to the chapter's deployment cap (with the Dragon Lord locked in as mandatory).  
    * **View Map & Swap Positions:** Pan around the dungeon map to inspect enemies, terrain, and Stairs tiles; click/tap two blue deployment tiles to swap the starting positions of deployed Pokémon.  
    * **Check / Equip Loadout:** Select any Pokémon to equip up to **4 Moves** from its Unlocked Move Pool, designate its **Physical and Special \[E\] Equipped Moves** for Enemy Phase, equip **1 Held Item** and **1 Consumable**, teach a **TM**, or **edit its Nickname**.  
    * **Fight\! (Start Battle):** Begins Turn 1 of Player Phase.  
15. **In-Battle Tactical Menus:**  
    * **Unit Selection & Action Menu:** Clicking/tapping an unmoved player Pokémon highlights its valid movement tiles (Blue) and attack range (Red). Clicking a destination tile moves the unit there and opens the floating *Fire Emblem* command menu beside the unit:  
      * **Attack:** Opens the 4-move selector (filtering to moves whose range can hit an enemy from that tile), then displays the **Combat Forecast Panel** (showing HP, Damage, Hit %, Crit %, Doubling `x2`, active Support bonuses from up to 3 adjacent allies, and whether the enemy can counter-attack). Clicking **Confirm** executes combat.  
      * **Heal / Status:** Appears if the unit has a Range 1–2 healing or status move and a valid target is in range.  
      * **Talk:** Appears in gold when adjacent to a recruitable character (such as Nidoran in Paralogue 3 or the defecting Gastly in Paralogue 6).  
      * **Item / Equip:** Change which of the unit's 4 moves is marked **\[E\] Equipped** for Enemy Phase, or use the unit's active Consumable (Potion, X-Item, Evolution Stone/Gem).  
      * **Wait:** Ends the unit's action for the turn and renders its sprite in a rested/dimmed state.  
    * **Battlefield Right-Click Menu (When No Unit Is Selected):**  
      * **Danger Area (Toggle):** Highlights the combined attack range of all enemies on the map in red/purple (matching *Fire Emblem Awakening*), or click individual enemies to toggle their personal threat range.  
      * **Unit List:** Tabular overview of all deployed units, their current HP, status conditions, equipped move, and adjacent support partners.  
      * **Objective / Chapter Info:** Displays the victory condition (Rout Enemy, Defeat Boss, or Defend for X Turns), turn count, and Lord defeat condition.  
      * **End Turn:** Immediately ends Player Phase and starts Enemy Phase.

## **3.5 Custom LLM Agent System Instructions (Read Before Every Session)**

The following system instructions must be read and strictly obeyed by the coding LLM agent on every prompt, file edit, and feature implementation:

* **1\. Role & Core Mandate:** You are the Lead Game Engineer building *Mystery Emblem*, a browser-based tactical RPG combining *Fire Emblem Awakening* gameplay systems with *Pokémon Mystery Dungeon: Explorers of Sky* visuals, dungeon tilesets, sprites, and character portraits.  
* **2\. Rule 1 — 100% Data-Driven Manual Balance (Zero Automated Stat Formulas):** Never use automated formulas to calculate stats or growth rates from PokéAPI base stats. Every Pokémon's Base Stats (`HP`, `Atk`, `Def`, `SpA`, `SpD`, `Spe`), `Mov`, Join Level, 6 Percentage Growth Rates, Promotion Bonuses, Learnset levels, and Personal Skill must be read from human-editable JSON/TypeScript data files so the developer can manually tune every unit.  
* **3\. Rule 2 — Strict PC & Mobile Parity (Unified Pointer Events Only):** Every screen, canvas interaction, and menu modal must work cleanly on both Desktop (Mouse) and Mobile (Touchscreen) browsers. Never bind or require keyboard keys (`WASD`, arrow keys, `Space`, `Enter`, `Esc`). Use unified Pointer Events (`pointerdown`, `pointermove`, `pointerup`) for clicking/tapping and click-and-drag/touch-drag camera panning. Always render an on-screen PMD-styled **Menu / Back** button (and support long-press) on mobile to mirror PC right-click behavior.  
* **4\. Rule 3 — Authentic PMD Visual Skin & Asset Pipeline:** All UI windows, menus, combat forecasts, and dialogue boxes must use the *Pokémon Mystery Dungeon: Explorers of Sky* aesthetic (deep navy translucent backgrounds, double-layered pixel borders, and bitmap RPG typography). Pull all 8-directional unit animations and multi-emotion character portraits directly from the existing site's PMD Git repository endpoints.  
* **5\. Rule 4 — Dual-Equipped (Physical + Special) Enemy Phase & Clean Tactical Math:** Enforce the 4-move battle loadout where Physical moves are Range 1, Special moves are Range 2, and **each unit may mark one Physical AND one Special move `[E] Equipped` for Enemy Phase** (a unit counter-attacks only if it has an `[E]` move for the attacker's range; either slot may be left empty). Exclude all pure stat-changing moves (like *Growl* or *Swords Dance*); stat buffs and debuffs may only occur as random-chance secondary effects on damaging moves, or via X-Items, Personal Skills, and Held Items.  
* **6\. Rule 5 — Strict Faction Separation & 3-Stage Promotion Curve:** Never allow enemy Pokémon lines to appear in the player's recruitable pool, with the **sole exception of the single defecting Gastly in Paralogue 6**. Enforce the continuous Level 1–40 curve (targeting \~Level 30 by Chapter 25\) with **Evolution Stones** at Level 10+ and **Evolution Gems** at Level 20+ (plus the Paralogue exceptions for Level 15 branching Eevee and Hidden Potential \+20% growth Slakoth).  
* **7\. Rule 6 — Incremental Step-by-Step Execution & Verification Gates:** Implement the game one step at a time following the roadmap in Section 3.6. Do **not** skip ahead to the next step until every item in the current step's **Verification Checklist** has been tested and confirmed working on both Desktop and Mobile viewports.  
* **8\. Rule 7 — Cross-Device Save Sync via Google Sign-In (Firebase Auth \+ Firestore) & localStorage:** Because the game is hosted as a static site on GitHub Pages, implement a hybrid `SaveStateManager` that writes immediately to `localStorage` (with a `lastUpdated` UTC timestamp) for instant offline-capable saving, and automatically syncs the save JSON to **Cloud Firestore** (`saves/{uid}`) whenever the player is signed in with their **Google Account** via **Firebase Authentication**. On startup or sign-in, compare `lastUpdated` timestamps between `localStorage` and Firestore so switching between desktop and mobile always loads the most recent campaign state.

---

## **3.6 Step-by-Step Implementation Roadmap & Verification Gates**

The LLM agent must implement *Mystery Emblem* in the following 10 sequential steps, running all verification checks at the end of each step before proceeding:

### **Step 1: Core Data Schemas, Manual Balance Registries & Save State Manager**

* **What to Implement:**  
  * Create human-editable JSON/TypeScript registries for:  
    * `pokemon_species.json`: Species ID, stage (1, 2, or 3), elemental types, manual base stats (`HP`, `Atk`, `Def`, `SpA`, `SpD`, `Spe`, `Mov`), manual growth rates (`0%–100%`), terrain traversal class (`Grounded`, `Flying`, `Levitate`), Personal Skill ID, bespoke level-up learnset table, compatible TM list, evolution target/level/item, manual promotion stat bonuses, and PMD sprite/portrait asset IDs.  
    * `moves.json`: Move ID, name, elemental type, category (`Physical` \= Range 1, `Special` \= Range 2, `Support/Heal` \= Range 1 or 1–2), `Mt`, `Hit`, `Crit`, `PP`, and optional random-chance secondary effect (status condition or temporary stat buff/debuff). Confirm zero pure stat-boosting/lowering moves exist.  
    * `items.json`: Definitions for Passive Held Items (Leftovers, Shell Bell, Berries, Type Enhancers, Choice items, Eviolite, Rocky Helmet, Heavy-Duty Boots, etc.), Active Consumables (Potions, Full Heals, Evolution Stones, Evolution Gems), X-Items, Permanent Stat Vitamins, and single-use general TMs.  
  * Build the persistent `SaveStateManager` (`localStorage` \+ **Google Account Sign-In via Firebase Authentication & Cloud Firestore** \+ JSON export/import) tracking owned Pokémon instances (including persistent custom nickname, level, exp, current stats, unlockedMoves, 4-move loadout, equippedMoveId, heldItemId, consumableItemId), Convoy inventory, Support Points matrix (pairKey \-\> points & level 1–5), Overworld node states, `newGamePlusUnlocked` flag, and a `lastUpdated` timestamp:  
    * **Local & Cloud Hybrid Sync:** Every save action writes immediately to `localStorage` and, if the user is authenticated via Google Sign-In, writes the save state payload to `saves/{uid}` in Cloud Firestore (protected by Firestore security rules restricting read/write to `request.auth.uid == uid`).  
    * **Cross-Device Timestamp Resolution:** When loading the game on a second device (e.g., switching from PC to mobile) or signing in with Google for the first time on a device, compare the `lastUpdated` timestamp in Firestore against `localStorage` and load the newer state (syncing local guest progress up to Firestore if the local save is newer).  
* **Step 1 Verification Checklist:**  
  * \[ \] Confirm all 8 Dragon Lords, starter Partners, Q1–Q9 quiz recruits, Paralogue recruits (Slakoth, Eevee, Nidoran♂/♀, Teddiursa, Hoppip, and Paralogue 6 Gastly), and enemy lines validate against the schema with zero unintended player/enemy overlap.  
  * \[ \] Confirm saving, loading, and renaming a Pokémon's nickname persists cleanly across page reloads in `localStorage` and syncs accurately to Cloud Firestore when signed in with a Google Account across desktop and mobile sessions.

### **Step 2: PMD Asset Loader, UI Window Framework & Portrait Dialogue Engine**

* **What to Implement:**  
  * Connect the existing site's PMD Git repository endpoints to load 8-directional map sprite animations (`Idle`, `Walk`, `Attack`, `Special`, `Hurt`) and multi-emotion character portraits (`Normal`, `Happy`, `Determined`, `Angry`, `Pain`, `Worried`, `Surprised`, `Sad`).  
  * Build the reusable PMD UI Window component (translucent navy background, double-layered cyan/gold pixel borders, bitmap font) and the persistent mobile **Menu / Back** corner button.  
  * Build the `DIALOGUE_OVERLAY` engine that displays character portraits on the left/right, shows the speaking Pokémon's custom nickname and species name, swaps facial expressions per line, and advances on click/tap.  
* **Step 2 Verification Checklist:**  
  * \[ \] Confirm PMD sprites and emotion portraits render sharply with `image-rendering: pixelated` and automatically update when a unit's evolution stage changes.  
  * \[ \] Confirm dialogue boxes and UI windows scale without clipping on both `1920x1080` desktop and `390x844` / `844x390` mobile viewports using only click/tap inputs.

### **Step 3: Starting Personality Quiz, Partner Select, Nickname Modal & New Game Plus Selector**

* **What to Implement:**  
  * Build `QUIZ_SCENE` with the 9 multiple-choice questions that simultaneously tally trait points for the 8 Stage-1 Dragon Lords and seed the Q1–Q9 chapter recruitment slots (Prologue Healer, Ch. 1 Bug/Flying duo, Ch. 2 Ghost/Psychic duo, Ch. 4 Electric solo, Ch. 5 Fighting/Rock/Ground trio, Ch. 7 Water/Grass duo, Ch. 8 Fire solo, Ch. 10 Steel/Fairy duo, Ch. 12 Ice/Armored duo).  
  * Build the Partner Starter selection screen (allowing selection of any Stage-1 Starter Pokémon).  
  * Build the reusable **Nickname Modal** that prompts the player to name each newly recruited Pokémon (and can be reopened anytime from the Units menu).  
  * Build `NG_PLUS_SELECT_SCENE` (available when `newGamePlusUnlocked` is true), replacing the quiz with a manual selection screen for the Dragon Lord, Partner, Q1 Healer, and all Q2–Q9 chapter recruit slots.  
* **Step 3 Verification Checklist:**  
  * \[ \] Confirm completing the quiz initializes the Prologue squad (Dragon Lord, Partner, and Q1 Healer Friend), prompts for nicknames on all three, and stores the exact Q2–Q9 recruit seeds in the save state.  
  * \[ \] Confirm toggling `newGamePlusUnlocked` enables the New Game Plus manual roster picker and correctly populates all chosen recruits.

### **Step 4: Fire Emblem Awakening Overworld Map, Kecleon Shops & Skirmish Spawner**

* **What to Implement:**  
  * Build `OVERWORLD_SCENE` rendering the node-based continent map across the five kingdoms.  
  * Implement click-and-drag (PC) and single-finger touch-drag (Mobile) camera panning, plus click/tap node traversal that moves the Lord sprite along connected paths.  
  * Implement the occasional **Feral Skirmish Spawner** (low random chance to spawn on a cleared node after finishing a chapter; clears immediately after victory so players cannot infinitely grind).  
  * Implement the random **Kecleon Shop Spawner** (spawning a Kecleon sprite on cleared nodes that opens 1 of the 4 shop types: TM Shop, Held Item Shop, Healing/Evolution Item Shop, or X-Item Shop).  
  * Build the Overworld Right-Click / Mobile Menu modal (`Units / Roster` with anytime nickname editing, Vitamin use, and Evolution Stone/Gem promotion; `Items / Convoy`; `Supports` viewer; `Save / System`).  
* **Step 4 Verification Checklist:**  
  * \[ \] Confirm panning the Overworld map, moving between nodes, and opening/closing the right-click/mobile menu work smoothly on both PC mouse and mobile touch.  
  * \[ \] Confirm buying and teaching a TM consumes the TM from inventory and adds the move to the Pokémon's permanent Unlocked Move Pool.  
  * \[ \] Confirm using a Vitamin permanently increases the target stat, and confirm renaming a Pokémon in the Units menu updates its name across all screens.

### **Step 5: PMD Dungeon Grid Renderer, Terrain Traversal & Pathfinding Engine**

* **What to Implement:**  
  * Build the tactical battlefield grid renderer using *Pokémon Mystery Dungeon: Explorers of Sky* dungeon tilesets (`Dungeon Floor`, `Trees / Foliage`, `Dungeon Stairs`, `Water`, `Lava`, `Mountain`, `Void / Chasm`, and `Wonder Tile`).  
  * Implement Dijkstra / A\* pathfinding and range highlighting (Blue movement tiles, Red attack tiles, and the toggleable purple/red enemy **Danger Area** overlay) enforcing the 3 Terrain Traversal Classes:  
    * `Grounded` (affected by terrain costs/bonuses; Water-types cross Water at 1 Mov, Fire-types cross Lava at 1 Mov, Rock/Ground/Fighting cross Mountains at 2 Mov, Heavy-Duty Boots ignore Tree/Mountain penalties).  
    * `Flying` (1 Mov across Trees, Water, Lava, Mountains; 0 terrain bonuses; blocked by Void/Chasm and Walls).  
    * `Levitate` (1 Mov across Void/Chasm, Lava, Water, Trees, Mountains, and low Barriers; 0 terrain bonuses except on Wonder Tiles and Stairs).  
* **Step 5 Verification Checklist:**  
  * \[ \] Confirm Grounded, Flying, and Levitate units highlight the exact legal movement tiles across every PMD terrain type (especially verifying that only Levitate units can cross Void/Chasm tiles).  
  * \[ \] Confirm click-and-drag and touch-drag pan the battle camera without accidentally selecting or moving units.

### **Step 6: Pre-Battle Sequence (`PREP_SCENE`) & Loadout Manager**

* **What to Implement:**  
  * Build `PREP_SCENE` loaded before Turn 1 of every battle with the 4 core *Fire Emblem* prep options:  
    * **1\. Select Units:** Toggle units in/out of the squad up to the chapter's deployment cap (`3` in Prologue, `5–8` in Act 1, `8–10` in Act 2, `10–12` in Acts 3–4), keeping the Dragon Lord locked in on story chapters.  
    * **2\. View Map & Swap Positions:** Pan the map to inspect enemies, terrain, and Stairs tiles; click/tap any two blue deployment tiles to swap the starting positions of deployed Pokémon.  
    * **3\. Check / Equip Loadout:** Select up to **4 active moves** from each Pokémon's Unlocked Move Pool, set its **Physical and Special \[E\] Equipped Moves** for Enemy Phase, equip **1 Held Item** and **1 Consumable**, or edit its nickname.  
    * **4\. Fight\!:** Transition into Turn 1 of `BATTLE_SCENE`.  
* **Step 6 Verification Checklist:**  
  * \[ \] Confirm deployment caps and mandatory Dragon Lord deployment are enforced.  
  * \[ \] Confirm swapping two units on blue deployment tiles and changing a unit's 4 active moves, `[E]` Equipped move, and Held/Consumable items carry over into Turn 1 of battle on both PC and mobile.

### **Step 7: Turn Phase Sequencer, Combat Math, Dual-Equipped Counter & Status Engine**

* **What to Implement:**  
  * Build the `Player Phase` and `Enemy Phase` state machine, including start-of-phase triggers: Wonder Tile healing (`20% HP` \+ clear debuffs), Leftovers healing (`10% HP`), Poison damage (`1/8 HP`), Burn damage (`1/16 HP`), Freeze thaw roll (`2–5 turns`), Sleep wake check (`1–2 turns`), and **Dungeon Stairs** enemy reinforcement spawns (blocked if a player unit is standing on the Stairs tile).  
  * Build the in-battle floating command menu (`Attack`, `Heal / Status`, `Talk`, `Item / Equip`, `Wait`) and the **Combat Forecast Panel**.  
  * Implement the exact combat resolution sequence:  
    * Check Paralysis (`1/3` chance to skip attack) and Sleep (cannot act or counter).  
    * Calculate Damage using Effective Atk/SpA (halved by Burn for Physical or Freeze for Special), Move Might, Terrain Defense, STAB (`1.25x`), Type Effectiveness (`0x`, `0.5x`, `0.75x`, `1.0x`, `1.25x`, `1.5x`), and Critical Hits (`2.0x`).  
    * Enforce the **Dual-Equipped Move Counter Rule**: On Enemy Phase, the defender only counter-attacks if it has an `[E]` move for the attacker's range (Physical `[E]` at `1`, Special `[E]` at `2`) with `PP > 0`.  
    * Resolve Follow-Up Attack (Doubling when `Speed difference >= 5`) and roll random-chance secondary move effects (status infliction or temporary stat buffs/debuffs).  
* **Step 7 Verification Checklist:**  
  * \[ \] Confirm a unit with only a Physical `[E]` counters Range 1 foes but **cannot** counter Range 2 foes (and vice versa), while a unit with both `[E]` slots counters at both ranges.  
  * \[ \] Confirm all 5 status conditions (PAR, PSN, BRN, FRZ, SLP), Type multipliers (including `0x` immunities), STAB (`1.25x`), Crits (`2.0x`), and Dungeon Stairs blocking behave exactly as specified.  
  * \[ \] Confirm right-clicking (PC) or tapping Back (Mobile) cancels uncommitted unit movement and returns the unit to its starting tile.

### **Step 8: Character Supports (Levels 1–5), Personal Skills & Held/X-Item Combat Hooks**

* **What to Implement:**  
  * Implement orthogonal adjacency detection (`1 tile N, S, E, W`) during combat:  
    * Award `+1 Support Point` between the fighting unit and each orthogonally adjacent allied Pokémon (with a brief bond visual effect), unlocking Support Levels 1 through 5 at `5, 12, 22, 35, and 50` points.  
    * Sum the Support stat bonuses (`Atk`, `SpA`, `Def`, `SpD`, `Hit`, `Avoid`, `Crit`) from **up to 3 adjacent supported allies** (taking the highest 3 if surrounded on all 4 sides) and display them in the Combat Forecast Panel.  
  * Implement all Personal Skill hooks (including the Lord's 2-tile Dragon Aura, Slakoth's Hidden Potential `+20%` growths, Levitate traversal, Overgrow/Blaze/Torrent, Intimidate, Guts, Sturdy, Aegislash's Stance Change, and Kingambit's Supreme Overlord).  
  * Implement all Held Item triggers (auto-consuming Oran/Sitrus/Lum Berries, Shell Bell lifesteal, Life Orb recoil, Choice locks, Eviolite check, Rocky Helmet recoil, Focus Sash survival, Quick Claw `25%` Vantage) and single-battle X-Item boosts (`+3` stat or `+20%` Crit for the remainder of the map).  
* **Step 8 Verification Checklist:**  
  * \[ \] Confirm fighting adjacent to 1, 2, or 3 supported allies increments Support Points and applies the exact additive stat bonuses in combat.  
  * \[ \] Confirm Held Items, Personal Skills, and X-Items trigger properly in battle and that X-Item buffs reset to normal once the battle ends.

### **Step 9: EXP Rubber-Banding, Level-Up Growth Modal & Evolution Promotion System**

* **What to Implement:**  
  * Implement the level-difference EXP formulas (Damage EXP \+ KO Bonus EXP \+ Heal/Support EXP) along the continuous Level 1–40 curve.  
  * Build the *Fire Emblem*\-style **Level-Up Modal** that rolls `1–100` against each of the unit's 6 manually configured growth rates (plus `+20%` for Slakoth) and animates `+1` stat increases.  
  * Implement level-up move learning: when a unit reaches a level in its bespoke learnset table, unlock the move and prompt to equip it if all 4 active slots are full.  
  * Implement the **Evolution Promotion System** (usable in Overworld/Prep menus or mid-battle via the Consumable slot):  
    * **Evolution Stone (Level 10+):** Promotes Stage 1 to Stage 2\.  
    * **Evolution Gem (Level 20+):** Promotes Stage 2 to Stage 3\.  
    * **Eevee Branching Promotion (Level 15+ via Evolution Stone):** Opens the 8-way Eeveelution selection modal.  
    * Apply manual promotion stat bonuses, update growth rates/Personal Skill/`Mov`/traversal class, and swap to the new stage's PMD sprites and portraits while preserving the unit's continuous level and custom nickname.  
* **Step 9 Verification Checklist:**  
  * \[ \] Confirm leveling up triggers stat rolls using the unit's manual growth rates and unlocks level-up moves at the configured levels.  
  * \[ \] Confirm evolving at Level 10, Level 15 (Eevee), and Level 20 applies manual promotion bonuses, keeps the unit's current level number and nickname, and updates its sprites and portraits.

### **Step 10: Campaign Scripting (Prologue \+ 25 Chapters \+ 6 Paralogues), Boss AI & End-to-End Polish**

* **What to Implement:**  
  * Build the CPU Enemy AI controller (scoring legal attacks by damage dealt vs. counter damage taken, prioritizing free hits against player units with no `[E]` move for that range, and executing Boss/Commander behaviors).  
  * Populate all map layouts (using *Explorers of Sky* dungeon tilesets), enemy placements, Stairs reinforcement schedules, and PMD portrait cutscene/recruitment scripts across the **Prologue, 25 Main Chapters, and 6 Paralogues**.  
  * Implement mid-battle **Talk** recruitment events on the grid (including choosing between Nidoran♂ and Nidoran♀ in Paralogue 3, and recruiting the defecting enemy **Gastly** in Paralogue 6—the only enemy-line Pokémon that can join the player's team).  
  * Implement victory and defeat flows (Lord fainting triggers immediate Game Over; clearing Chapter 25 against Final Boss Emperor Kingambit unlocks **New Game Plus**).  
* **Step 10 Verification Checklist:**  
  * \[ \] Confirm the `Talk` command recruits mid-battle allies (including Paralogue 3 Nidoran and Paralogue 6 Gastly) and opens the Nickname Modal.  
  * \[ \] Confirm Lord defeat triggers Game Over on every map, and clearing Chapter 25 unlocks New Game Plus mode.  
  * \[ \] Run a complete end-to-end verification pass across both Desktop (mouse point-and-click \+ right-click menus) and Mobile (touch tap/drag \+ on-screen Menu/Back button) to confirm 100% playability.