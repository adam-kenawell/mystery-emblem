3.5 Custom LLM Agent System Instructions (Read Before Every Session)

The following system instructions must be read and strictly obeyed by the coding LLM agent on every prompt, file edit, and feature implementation:

1\. Role \& Core Mandate: You are the Lead Game Engineer building Mystery Emblem, a browser-based tactical RPG combining Fire Emblem Awakening gameplay systems with Pokémon Mystery Dungeon: Explorers of Sky visuals, dungeon tilesets, sprites, and character portraits.

2\. Rule 1 — 100% Data-Driven Manual Balance (Zero Automated Stat Formulas): Never use automated formulas to calculate stats or growth rates from PokéAPI base stats. Every Pokémon's Base Stats (HP, Atk, Def, SpA, SpD, Spe), Mov, Join Level, 6 Percentage Growth Rates, Promotion Bonuses, Learnset levels, and Personal Skill must be read from human-editable JSON/TypeScript data files so the developer can manually tune every unit.

3\. Rule 2 — Strict PC \& Mobile Parity (Unified Pointer Events Only): Every screen, canvas interaction, and menu modal must work cleanly on both Desktop (Mouse) and Mobile (Touchscreen) browsers. Never bind or require keyboard keys (WASD, arrow keys, Space, Enter, Esc). Use unified Pointer Events (pointerdown, pointermove, pointerup) for clicking/tapping and click-and-drag/touch-drag camera panning. Always render an on-screen PMD-styled Menu / Back button (and support long-press) on mobile to mirror PC right-click behavior.

4\. Rule 3 — Authentic PMD Visual Skin \& Asset Pipeline: All UI windows, menus, combat forecasts, and dialogue boxes must use the Pokémon Mystery Dungeon: Explorers of Sky aesthetic (deep navy translucent backgrounds, double-layered pixel borders, and bitmap RPG typography). Pull all 8-directional unit animations and multi-emotion character portraits directly from the existing site's PMD Git repository endpoints.

5\. Rule 4 — Single-Equipped Enemy Phase \& Clean Tactical Math: Enforce the 4-move battle loadout where Physical moves are Range 1, Special moves are Range 2, and only one offensive move is marked \[E] Equipped at a time during Enemy Phase (meaning a unit can only counter-attack on Enemy Phase if its single equipped move matches the attacker's range). Exclude all pure stat-changing moves (like Growl or Swords Dance); stat buffs and debuffs may only occur as random-chance secondary effects on damaging moves, or via X-Items, Personal Skills, and Held Items.

6\. Rule 5 — Strict Faction Separation \& 3-Stage Promotion Curve: Never allow enemy Pokémon lines to appear in the player's recruitable pool, with the sole exception of the single defecting Gastly in Paralogue 6. Enforce the continuous Level 1–40 curve (targeting \~Level 30 by Chapter 25) with Evolution Stones at Level 10+ and Evolution Gems at Level 20+ (plus the Paralogue exceptions for Level 15 branching Eevee and Hidden Potential +20% growth Slakoth).

7\. Rule 6 — Incremental Step-by-Step Execution \& Verification Gates: Implement the game one step at a time following the roadmap in Section 3.6. Do not skip ahead to the next step until every item in the current step's Verification Checklist has been tested and confirmed working on both Desktop and Mobile viewports.

8\. Rule 7 — Cross-Device Save Sync via Google Sign-In (Firebase Auth + Firestore) \& localStorage: Because the game is hosted as a static site on GitHub Pages, implement a hybrid SaveStateManager that writes immediately to localStorage (with a lastUpdated UTC timestamp) for instant offline-capable saving, and automatically syncs the save JSON to Cloud Firestore (saves/{uid}) whenever the player is signed in with their Google Account via Firebase Authentication. On startup or sign-in, compare lastUpdated timestamps between localStorage and Firestore so switching between desktop and mobile always loads the most recent campaign state.

9\. Rule 8 — Persistent Session Memory (`memory.md`): Always read `memory.md` at the start of every session to understand current project context and completed milestones, and keep `memory.md` updated at a high level as steps are completed.

@[memory.md](memory.md)




---

## 3.6 Step-by-Step Implementation Roadmap & Verification Gates

The LLM agent must implement *Mystery Emblem* in the following 10 sequential steps, running all verification checks at the end of each step before proceeding:

### Step 1: Core Data Schemas, Manual Balance Registries & Save State Manager

* **What to Implement:**
  * Create human-editable JSON/TypeScript registries for:
    * `pokemon_species.json`: Species ID, stage (1, 2, or 3), elemental types, manual base stats (`HP`, `Atk`, `Def`, `SpA`, `SpD`, `Spe`, `Mov`), manual growth rates (`0%–100%`), terrain traversal class (`Grounded`, `Flying`, `Levitate`), Personal Skill ID, bespoke level-up learnset table, compatible TM list, evolution target/level/item, manual promotion stat bonuses, and PMD sprite/portrait asset IDs.
    * `moves.json`: Move ID, name, elemental type, category (`Physical` = Range 1, `Special` = Range 2, `Support/Heal` = Range 1 or 1–2), `Mt`, `Hit`, `Crit`, `PP`, and optional random-chance secondary effect (status condition or temporary stat buff/debuff). Confirm zero pure stat-boosting/lowering moves exist.
    * `items.json`: Definitions for Passive Held Items (Leftovers, Shell Bell, Berries, Type Enhancers, Choice items, Eviolite, Rocky Helmet, Heavy-Duty Boots, etc.), Active Consumables (Potions, Full Heals, Evolution Stones, Evolution Gems), X-Items, Permanent Stat Vitamins, and single-use general TMs.
  * Build the persistent `SaveStateManager` (`localStorage` + **Google Account Sign-In via Firebase Authentication & Cloud Firestore** + JSON export/import) tracking owned Pokémon instances (including persistent custom nickname, level, exp, current stats, unlockedMoves, 4-move loadout, equippedMoveId, heldItemId, consumableItemId), Convoy inventory, Support Points matrix (pairKey -> points & level 1–5), Overworld node states, `newGamePlusUnlocked` flag, and a `lastUpdated` timestamp:
    * **Local & Cloud Hybrid Sync:** Every save action writes immediately to `localStorage` and, if the user is authenticated via Google Sign-In, writes the save state payload to `saves/{uid}` in Cloud Firestore (protected by Firestore security rules restricting read/write to `request.auth.uid == uid`).
    * **Cross-Device Timestamp Resolution:** When loading the game on a second device (e.g., switching from PC to mobile) or signing in with Google for the first time on a device, compare the `lastUpdated` timestamp in Firestore against `localStorage` and load the newer state (syncing local guest progress up to Firestore if the local save is newer).
* **Step 1 Verification Checklist:**
  * [x] Confirm all 8 Dragon Lords, starter Partners, Q1–Q9 quiz recruits, Paralogue recruits (Slakoth, Eevee, Nidoran♂/♀, Teddiursa, Hoppip, and Paralogue 6 Gastly), and enemy lines validate against the schema with zero unintended player/enemy overlap.
  * [x] Confirm saving, loading, and renaming a Pokémon's nickname persists cleanly across page reloads in `localStorage` and syncs accurately to Cloud Firestore when signed in with a Google Account across desktop and mobile sessions.

### Step 2: PMD Asset Loader, UI Window Framework & Portrait Dialogue Engine

* **What to Implement:**
  * Connect the existing site's PMD Git repository endpoints to load 8-directional map sprite animations (`Idle`, `Walk`, `Attack`, `Special`, `Hurt`) and multi-emotion character portraits (`Normal`, `Happy`, `Determined`, `Angry`, `Pain`, `Worried`, `Surprised`, `Sad`).
  * Build the reusable PMD UI Window component (translucent navy background, double-layered cyan/gold pixel borders, bitmap font) and the persistent mobile **Menu / Back** corner button.
  * Build the `DIALOGUE_OVERLAY` engine that displays character portraits on the left/right, shows the speaking Pokémon's custom nickname and species name, swaps facial expressions per line, and advances on click/tap.
* **Step 2 Verification Checklist:**
  * [x] Confirm PMD sprites and emotion portraits render sharply with `image-rendering: pixelated` and automatically update when a unit's evolution stage changes.
  * [x] Confirm dialogue boxes and UI windows scale without clipping on both `1920x1080` desktop and `390x844` / `844x390` mobile viewports using only click/tap inputs.

### Step 3: Starting Personality Quiz, Partner Select, Nickname Modal & New Game Plus Selector

* **What to Implement:**
  * Build `QUIZ_SCENE` with the 9 multiple-choice questions that simultaneously tally trait points for the 8 Stage-1 Dragon Lords and seed the Q1–Q9 chapter recruitment slots (Prologue Healer, Ch. 1 Bug/Flying duo, Ch. 2 Ghost/Psychic duo, Ch. 4 Electric solo, Ch. 5 Fighting/Rock/Ground trio, Ch. 7 Water/Grass duo, Ch. 8 Fire solo, Ch. 10 Steel/Fairy duo, Ch. 12 Ice/Armored duo).
  * Build the Partner Starter selection screen (allowing selection of any Stage-1 Starter Pokémon).
  * Build the reusable **Nickname Modal** that prompts the player to name each newly recruited Pokémon (and can be reopened anytime from the Units menu).
  * Build `NG_PLUS_SELECT_SCENE` (available when `newGamePlusUnlocked` is true), replacing the quiz with a manual selection screen for the Dragon Lord, Partner, Q1 Healer, and all Q2–Q9 chapter recruit slots.
* **Step 3 Verification Checklist:**
  * [ ] Confirm completing the quiz initializes the Prologue squad (Dragon Lord, Partner, and Q1 Healer Friend), prompts for nicknames on all three, and stores the exact Q2–Q9 recruit seeds in the save state.
  * [ ] Confirm toggling `newGamePlusUnlocked` enables the New Game Plus manual roster picker and correctly populates all chosen recruits.

### Step 4: Fire Emblem Awakening Overworld Map, Kecleon Shops & Skirmish Spawner

* **What to Implement:**
  * Build `OVERWORLD_SCENE` rendering the node-based continent map across the five kingdoms.
  * Implement click-and-drag (PC) and single-finger touch-drag (Mobile) camera panning, plus click/tap node traversal that moves the Lord sprite along connected paths.
  * Implement the occasional **Feral Skirmish Spawner** (low random chance to spawn on a cleared node after finishing a chapter; clears immediately after victory so players cannot infinitely grind).
  * Implement the random **Kecleon Shop Spawner** (spawning a Kecleon sprite on cleared nodes that opens 1 of the 4 shop types: TM Shop, Held Item Shop, Healing/Evolution Item Shop, or X-Item Shop).
  * Build the Overworld Right-Click / Mobile Menu modal (`Units / Roster` with anytime nickname editing, Vitamin use, and Evolution Stone/Gem promotion; `Items / Convoy`; `Supports` viewer; `Save / System`).
* **Step 4 Verification Checklist:**
  * [ ] Confirm panning the Overworld map, moving between nodes, and opening/closing the right-click/mobile menu work smoothly on both PC mouse and mobile touch.
  * [ ] Confirm buying and teaching a TM consumes the TM from inventory and adds the move to the Pokémon's permanent Unlocked Move Pool.
  * [ ] Confirm using a Vitamin permanently increases the target stat, and confirm renaming a Pokémon in the Units menu updates its name across all screens.

### Step 5: PMD Dungeon Grid Renderer, Terrain Traversal & Pathfinding Engine

* **What to Implement:**
  * Build the tactical battlefield grid renderer using *Pokémon Mystery Dungeon: Explorers of Sky* dungeon tilesets (`Dungeon Floor`, `Trees / Foliage`, `Dungeon Stairs`, `Water`, `Lava`, `Mountain`, `Void / Chasm`, and `Wonder Tile`).
  * Implement Dijkstra / A* pathfinding and range highlighting (Blue movement tiles, Red attack tiles, and the toggleable purple/red enemy **Danger Area** overlay) enforcing the 3 Terrain Traversal Classes:
    * `Grounded` (affected by terrain costs/bonuses; Water-types cross Water at 1 Mov, Fire-types cross Lava at 1 Mov, Rock/Ground/Fighting cross Mountains at 2 Mov, Heavy-Duty Boots ignore Tree/Mountain penalties).
    * `Flying` (1 Mov across Trees, Water, Lava, Mountains; 0 terrain bonuses; blocked by Void/Chasm and Walls).
    * `Levitate` (1 Mov across Void/Chasm, Lava, Water, Trees, Mountains, and low Barriers; 0 terrain bonuses except on Wonder Tiles and Stairs).
* **Step 5 Verification Checklist:**
  * [x] Confirm Grounded, Flying, and Levitate units highlight the exact legal movement tiles across every PMD terrain type (especially verifying that only Levitate units can cross Void/Chasm tiles).
  * [x] Confirm click-and-drag and touch-drag pan the battle camera without accidentally selecting or moving units.

### Step 6: Pre-Battle Sequence (`PREP_SCENE`) & Loadout Manager

* **What to Implement:**
  * Build `PREP_SCENE` loaded before Turn 1 of every battle with the 4 core *Fire Emblem* prep options:
    * **1. Select Units:** Toggle units in/out of the squad up to the chapter's deployment cap (`3` in Prologue, `5–8` in Act 1, `8–10` in Act 2, `10–12` in Acts 3–4), keeping the Dragon Lord locked in on story chapters.
    * **2. View Map & Swap Positions:** Pan the map to inspect enemies, terrain, and Stairs tiles; click/tap any two blue deployment tiles to swap the starting positions of deployed Pokémon.
    * **3. Check / Equip Loadout:** Select up to **4 active moves** from each Pokémon's Unlocked Move Pool, set its single **[E] Equipped Move** for Enemy Phase, equip **1 Held Item** and **1 Consumable**, or edit its nickname.
    * **4. Fight!:** Transition into Turn 1 of `BATTLE_SCENE`.
* **Step 6 Verification Checklist:**
  * [ ] Confirm deployment caps and mandatory Dragon Lord deployment are enforced.
  * [ ] Confirm swapping two units on blue deployment tiles and changing a unit's 4 active moves, `[E]` Equipped move, and Held/Consumable items carry over into Turn 1 of battle on both PC and mobile.

### Step 7: Turn Phase Sequencer, Combat Math, Single-Equipped Counter & Status Engine

* **What to Implement:**
  * Build the `Player Phase` and `Enemy Phase` state machine, including start-of-phase triggers: Wonder Tile healing (`20% HP` + clear debuffs), Leftovers healing (`10% HP`), Poison damage (`1/8 HP`), Burn damage (`1/16 HP`), Freeze thaw roll (`2–5 turns`), Sleep wake check (`1–2 turns`), and **Dungeon Stairs** enemy reinforcement spawns (blocked if a player unit is standing on the Stairs tile).
  * Build the in-battle floating command menu (`Attack`, `Heal / Status`, `Talk`, `Item / Equip`, `Wait`) and the **Combat Forecast Panel**.
  * Implement the exact combat resolution sequence:
    * Check Paralysis (`1/3` chance to skip attack) and Sleep (cannot act or counter).
    * Calculate Damage using Effective Atk/SpA (halved by Burn for Physical or Freeze for Special), Move Might, Terrain Defense, STAB (`1.25x`), Type Effectiveness (`0x`, `0.5x`, `0.75x`, `1.0x`, `1.25x`, `1.5x`), and Critical Hits (`2.0x`).
    * Enforce the **Single-Equipped Move Counter Rule**: On Enemy Phase, the defender only counter-attacks if its single `[E]` move matches the attacker's range (`1` for Physical, `2` for Special) and has `PP > 0`.
    * Resolve Follow-Up Attack (Doubling when `Speed difference >= 5`) and roll random-chance secondary move effects (status infliction or temporary stat buffs/debuffs).
* **Step 7 Verification Checklist:**
  * [ ] Confirm a unit with a Range 1 `[E]` move counter-attacks Range 1 foes on Enemy Phase but **cannot** counter Range 2 foes (and vice versa for a Range 2 `[E]` move).
  * [ ] Confirm all 5 status conditions (PAR, PSN, BRN, FRZ, SLP), Type multipliers (including `0x` immunities), STAB (`1.25x`), Crits (`2.0x`), and Dungeon Stairs blocking behave exactly as specified.
  * [ ] Confirm right-clicking (PC) or tapping Back (Mobile) cancels uncommitted unit movement and returns the unit to its starting tile.

### Step 8: Character Supports (Levels 1–5), Personal Skills & Held/X-Item Combat Hooks

* **What to Implement:**
  * Implement orthogonal adjacency detection (`1 tile N, S, E, W`) during combat:
    * Award `+1 Support Point` between the fighting unit and each orthogonally adjacent allied Pokémon (with a brief bond visual effect), unlocking Support Levels 1 through 5 at `5, 12, 22, 35, and 50` points.
    * Sum the Support stat bonuses (`Atk`, `SpA`, `Def`, `SpD`, `Hit`, `Avoid`, `Crit`) from **up to 3 adjacent supported allies** (taking the highest 3 if surrounded on all 4 sides) and display them in the Combat Forecast Panel.
  * Implement all Personal Skill hooks (including the Lord's 2-tile Dragon Aura, Slakoth's Hidden Potential `+20%` growths, Levitate traversal, Overgrow/Blaze/Torrent, Intimidate, Guts, Sturdy, Aegislash's Stance Change, and Kingambit's Supreme Overlord).
  * Implement all Held Item triggers (auto-consuming Oran/Sitrus/Lum Berries, Shell Bell lifesteal, Life Orb recoil, Choice locks, Eviolite check, Rocky Helmet recoil, Focus Sash survival, Quick Claw `25%` Vantage) and single-battle X-Item boosts (`+3` stat or `+20%` Crit for the remainder of the map).
* **Step 8 Verification Checklist:**
  * [ ] Confirm fighting adjacent to 1, 2, or 3 supported allies increments Support Points and applies the exact additive stat bonuses in combat.
  * [ ] Confirm Held Items, Personal Skills, and X-Items trigger properly in battle and that X-Item buffs reset to normal once the battle ends.

### Step 9: EXP Rubber-Banding, Level-Up Growth Modal & Evolution Promotion System

* **What to Implement:**
  * Implement the level-difference EXP formulas (Damage EXP + KO Bonus EXP + Heal/Support EXP) along the continuous Level 1–40 curve.
  * Build the *Fire Emblem*-style **Level-Up Modal** that rolls `1–100` against each of the unit's 6 manually configured growth rates (plus `+20%` for Slakoth) and animates `+1` stat increases.
  * Implement level-up move learning: when a unit reaches a level in its bespoke learnset table, unlock the move and prompt to equip it if all 4 active slots are full.
  * Implement the **Evolution Promotion System** (usable in Overworld/Prep menus or mid-battle via the Consumable slot):
    * **Evolution Stone (Level 10+):** Promotes Stage 1 to Stage 2.
    * **Evolution Gem (Level 20+):** Promotes Stage 2 to Stage 3.
    * **Eevee Branching Promotion (Level 15+ via Evolution Stone):** Opens the 8-way Eeveelution selection modal.
    * Apply manual promotion stat bonuses, update growth rates/Personal Skill/`Mov`/traversal class, and swap to the new stage's PMD sprites and portraits while preserving the unit's continuous level and custom nickname.
* **Step 9 Verification Checklist:**
  * [ ] Confirm leveling up triggers stat rolls using the unit's manual growth rates and unlocks level-up moves at the configured levels.
  * [ ] Confirm evolving at Level 10, Level 15 (Eevee), and Level 20 applies manual promotion bonuses, keeps the unit's current level number and nickname, and updates its sprites and portraits.

### Step 10: Campaign Scripting (Prologue + 25 Chapters + 6 Paralogues), Boss AI & End-to-End Polish

* **What to Implement:**
  * Build the CPU Enemy AI controller (scoring legal attacks by damage dealt vs. counter damage taken, prioritizing free hits against player units whose `[E]` move cannot counter at that range, and executing Boss/Commander behaviors).
  * Populate all map layouts (using *Explorers of Sky* dungeon tilesets), enemy placements, Stairs reinforcement schedules, and PMD portrait cutscene/recruitment scripts across the **Prologue, 25 Main Chapters, and 6 Paralogues**.
  * Implement mid-battle **Talk** recruitment events on the grid (including choosing between Nidoran♂ and Nidoran♀ in Paralogue 3, and recruiting the defecting enemy **Gastly** in Paralogue 6—the only enemy-line Pokémon that can join the player's team).
  * Implement victory and defeat flows (Lord fainting triggers immediate Game Over; clearing Chapter 25 against Final Boss Emperor Kingambit unlocks **New Game Plus**).
* **Step 10 Verification Checklist:**
  * [ ] Confirm the `Talk` command recruits mid-battle allies (including Paralogue 3 Nidoran and Paralogue 6 Gastly) and opens the Nickname Modal.
  * [ ] Confirm Lord defeat triggers Game Over on every map, and clearing Chapter 25 unlocks New Game Plus mode.
  * [ ] Run a complete end-to-end verification pass across both Desktop (mouse point-and-click + right-click menus) and Mobile (touch tap/drag + on-screen Menu/Back button) to confirm 100% playability.
