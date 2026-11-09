/**
 * Mystery Emblem — Wimpod Interactive Advisor & Tutorial Registry (`tutorialRegistry.ts`)
 *
 * Replaces static textbook tutorial cards with short, comedic, interactive coaching led by
 * Wimpod (`0767`)—the scaredy-cat 4th member of the starting party (`Lord`, `Piplup`, `Flabébé`,
 * `Wimpod`) who refuses to fight and instead studied every tactical rule out of pure survival instinct!
 *
 * Strictly data-driven (Rule 1) and covers only live gameplay mechanics.
 */

import type { PmdPortraitEmotion } from '../assets/pmdAssetLoader';
import type { DungeonMapDefinition, PokemonType } from '../types/schemas';

export type TutorialCompendiumCategory =
  | 'controls_fusion'
  | 'combat_tactics'
  | 'prep_pokemon'
  | 'world_progression';

export const TUTORIAL_CATEGORY_LABELS: Readonly<Record<TutorialCompendiumCategory, string>> = {
  controls_fusion: 'Survival Basics & Controls',
  combat_tactics: 'Combat, Ranges & Terrain',
  prep_pokemon: 'Battle Prep, Moves & Items',
  world_progression: 'World Map, Evolutions & Shops',
};

export const TUTORIAL_CATEGORY_ORDER: ReadonlyArray<TutorialCompendiumCategory> = [
  'controls_fusion',
  'combat_tactics',
  'prep_pokemon',
  'world_progression',
];

export type TutorialActionTriggerId =
  | 'battle_open_field_menu'
  | 'battle_toggle_danger_area'
  | 'battle_select_lord'
  | 'battle_move_to_blue_tile'
  | 'battle_confirm_wait'
  | 'battle_open_attack_forecast'
  | 'battle_confirm_attack'
  | 'battle_inspect_heal_or_item'
  | 'overworld_open_menu'
  | 'prep_open_manage_units'
  | 'prep_close_manage_units'
  | 'prep_open_view_map'
  | 'prep_swap_or_finish_view_map';

export type TutorialBattleTileFilter =
  | 'empty_floor'
  | 'lord_unit'
  | 'reachable_move'
  | 'attackable_enemy'
  | 'wounded_or_healer'
  | 'prep_swap_slots';

export type TutorialSpotlightTarget =
  | { kind: 'none' }
  | {
      kind: 'dom';
      selector: string;
      preferredDock?: 'top' | 'bottom';
    }
  | {
      kind: 'battle_tiles';
      tileFilter: TutorialBattleTileFilter;
      fallbackDomSelector?: string;
    };

export interface TutorialVisualChip {
  kind: 'badge' | 'type' | 'item' | 'species';
  label?: string;
  pokemonType?: PokemonType;
  itemId?: string;
  speciesId?: string;
  tone?: 'gold' | 'green' | 'cyan' | 'danger';
}

export interface WimpodTutorialBeat {
  id: string;
  emotion: PmdPortraitEmotion;
  /** Supports `{lord}`, `{partner}`, `{healer}`, `{advisor}` custom nickname interpolation */
  dialogue: string;
  /** Concise prompt displayed in Wimpod's action pill during hands-on steps */
  actionHint?: string;
  /** When set during live play, Wimpod's coach bar stays non-blocking and awaits this action */
  awaitAction?: TutorialActionTriggerId;
  spotlight?: TutorialSpotlightTarget;
  chips?: ReadonlyArray<TutorialVisualChip>;
}

export interface TutorialTopicDefinition {
  id: string;
  title: string;
  category: TutorialCompendiumCategory;
  summary: string;
  beats: ReadonlyArray<WimpodTutorialBeat>;
}

export const TUTORIAL_TOPICS: ReadonlyArray<TutorialTopicDefinition> = [
  // ============================================================================
  // 1. Chapter 1 (`Western Beach`) Turn 1 — Hands-On Movement, Danger Area & Wait
  // ============================================================================
  {
    id: 'ch1_turn1_controls_phases',
    title: 'Danger Area, Moving & Turn Phases',
    category: 'controls_fusion',
    summary: 'Checking enemy reach from empty floor tiles, moving your squad, and protecting your ★ Lord.',
    beats: [
      {
        id: 'ch1_step1_empty_tile',
        emotion: 'Teary-Eyed',
        dialogue:
          'EEP! Raiders ahead! Rule #1 of not getting squished: check how far their claws reach! Drag to pan the map anytime, and tap a glowing empty floor tile to open the Field Menu!',
        actionHint: 'Tap any highlighted empty floor tile',
        awaitAction: 'battle_open_field_menu',
        spotlight: { kind: 'battle_tiles', tileFilter: 'empty_floor' },
        chips: [{ kind: 'badge', label: 'Empty Tile -> Field Menu', tone: 'gold' }],
      },
      {
        id: 'ch1_step2_danger_area',
        emotion: 'Shouting',
        dialogue:
          'Now tap Danger Area! Being a lifelong coward means I memorized every predator’s exact attack reach—you can also hover any foe or right-click to check it anytime!',
        actionHint: 'Tap Danger Area in the Field Menu',
        awaitAction: 'battle_toggle_danger_area',
        spotlight: { kind: 'dom', selector: '[data-testid="battle-field-danger"]' },
        chips: [{ kind: 'badge', label: 'Danger Area', tone: 'danger' }],
      },
      {
        id: 'ch1_step3_select_lord',
        emotion: 'Worried',
        dialogue:
          'See that crimson zone? Enemies can strike there on Enemy Phase! Now tap {lord} (★)—if {lord} hits 0 HP it’s Game Over, while other fainted pals just retreat until next battle!',
        actionHint: 'Tap {lord} (★) on the beach',
        awaitAction: 'battle_select_lord',
        spotlight: { kind: 'battle_tiles', tileFilter: 'lord_unit' },
        chips: [
          { kind: 'badge', label: '★ Lord 0 HP = Defeat', tone: 'gold' },
          { kind: 'badge', label: 'Allies Recover Post-Battle', tone: 'green' },
        ],
      },
      {
        id: 'ch1_step4_move_blue',
        emotion: 'Surprised',
        dialogue:
          'Blue tiles show where {lord} can walk, Red shows attack reach, and the bottom-left cards show stats & terrain! Tap any Blue tile to step forward!',
        actionHint: 'Tap any Blue movement tile',
        awaitAction: 'battle_move_to_blue_tile',
        spotlight: { kind: 'battle_tiles', tileFilter: 'reachable_move' },
        chips: [
          { kind: 'badge', label: 'Blue: Move', tone: 'cyan' },
          { kind: 'badge', label: 'Red: Attack', tone: 'danger' },
        ],
      },
      {
        id: 'ch1_step5_wait',
        emotion: 'Happy',
        dialogue:
          'Looking Way Braver Than Me! Tap Wait to finish {lord}’s move—once all three of you act (or pick End Phase), Enemy Phase begins! I’ll cheer quietly from behind my boulder!',
        actionHint: 'Tap Wait in the command menu',
        awaitAction: 'battle_confirm_wait',
        spotlight: { kind: 'dom', selector: '[data-testid="dungeon-cmd-wait"]' },
      },
    ],
  },

  // ============================================================================
  // 2. First Combat Opportunity / Forecast — R1/R2, Single [E] Counter & Math
  // ============================================================================
  {
    id: 'ch1_first_combat_forecast',
    title: 'Combat Forecast, Ranges & [E] Counters',
    category: 'combat_tactics',
    summary: 'Physical (R1) vs Special (R2), the single [E] counter-attack rule, STAB, and +5 Spe doubling.',
    beats: [
      {
        id: 'combat_step1_open_forecast',
        emotion: 'Stunned',
        dialogue:
          'WAH! An enemy is inside your Red attack range! Don’t swing blind—tap that enemy (or Attack) to inspect the Combat Forecast first!',
        actionHint: 'Tap the highlighted enemy in Red range',
        awaitAction: 'battle_open_attack_forecast',
        spotlight: {
          kind: 'battle_tiles',
          tileFilter: 'attackable_enemy',
          fallbackDomSelector: '[data-testid="dungeon-cmd-attack"]',
        },
      },
      {
        id: 'combat_step2_equipped_rule',
        emotion: 'Determined',
        dialogue:
          'Survival Secret #1: Physical moves hit Range 1 (adjacent) and Special moves hit Range 2! Foes ONLY counter-attack if their single [E] move matches your range—so snipe melee brutes from 2 tiles away for a free hit!',
        chips: [
          { kind: 'badge', label: 'Physical = R1', tone: 'gold' },
          { kind: 'badge', label: 'Special = R2', tone: 'cyan' },
          { kind: 'badge', label: '[E] Counter Rule', tone: 'green' },
        ],
      },
      {
        id: 'combat_step3_confirm_attack',
        emotion: 'Teary-Eyed',
        dialogue:
          'Weaknesses & same-type STAB boost damage (1.25x), and +5 Speed strikes twice (x2)! Pick a move on the left bar, then tap Attack! ...Tell me when the scary noise is over!',
        actionHint: 'Tap Attack! to strike',
        awaitAction: 'battle_confirm_attack',
        spotlight: {
          kind: 'dom',
          selector: '[data-testid="forecast-attack-btn"]',
          preferredDock: 'top',
        },
        chips: [
          { kind: 'badge', label: '1.25x STAB / Weak', tone: 'green' },
          { kind: 'badge', label: '+5 Spe = x2', tone: 'gold' },
        ],
      },
    ],
  },

  // ============================================================================
  // 3. First Wounded Ally / First Heal or Item — 1-Item Slot & Support Moves
  // ============================================================================
  {
    id: 'ch1_healing_and_items',
    title: 'Healing Allies & The 1-Item Slot',
    category: 'prep_pokemon',
    summary: 'Auto-trigger Berries vs manual Potions in your 1 Item Slot, plus R1–2 Support healing.',
    beats: [
      {
        id: 'heal_step1_item_slot_rule',
        emotion: 'Crying',
        dialogue:
          'SOMEBODY TOOK A HIT! NOBODY PANIC—OKAY I’M PANICKING! Each Pokémon has 1 Item Slot: Held Berries (like {partner}’s Oran Berry) trigger automatically, while Potions are used manually via Item!',
        chips: [
          { kind: 'item', itemId: 'oran_berry', label: 'Oran Berry (Auto)' },
          { kind: 'item', itemId: 'potion', label: 'Potion (Manual)' },
        ],
      },
      {
        id: 'heal_step2_heal_pulse',
        emotion: 'Worried',
        dialogue:
          'Even better, {healer}’s Heal Pulse heals allies from 1–2 tiles away (Green tiles) AND awards EXP without spending items! Tap your highlighted teammate to check their Green heal range or Item!',
        actionHint: 'Tap the highlighted ally to inspect Heal / Item',
        awaitAction: 'battle_inspect_heal_or_item',
        spotlight: { kind: 'battle_tiles', tileFilter: 'wounded_or_healer' },
        chips: [
          { kind: 'species', speciesId: 'flabebe', label: 'Heal Pulse (R1-2)' },
          { kind: 'badge', label: 'Heal Grants EXP', tone: 'gold' },
        ],
      },
    ],
  },

  // ============================================================================
  // 4. First Level-Up / Lv. 10 Stone — Growths & Manual Evolution Promotions
  // ============================================================================
  {
    id: 'levelup_and_evolution',
    title: 'Level-Ups & Evolution Stone Promotions',
    category: 'world_progression',
    summary: '100 EXP level-ups, bespoke stat growths, and manual Lv. 10+ Evolution Stone promotion.',
    beats: [
      {
        id: 'evo_beat1_exp',
        emotion: 'Surprised',
        dialogue:
          'Whoa, stronger already?! Every 100 EXP rolls that Pokémon’s personal stat growths (and lower-level pals earn catch-up EXP faster—not that I’m volunteering!).',
        chips: [{ kind: 'badge', label: '100 EXP = +1 Lv', tone: 'gold' }],
      },
      {
        id: 'evo_beat2_manual_stone',
        emotion: 'Happy',
        dialogue:
          'Important twist: nobody evolves automatically! At Level 10+, use an Evolution Stone manually (in Units, Chapter Prep, or mid-battle Evolve! if held) for instant bonus stats while keeping your continuous Level 1–40!',
        chips: [
          { kind: 'item', itemId: 'evolution_stone', label: 'Lv. 10+ Stone' },
          { kind: 'item', itemId: 'evolution_gem', label: 'Lv. 20+ Gem' },
        ],
      },
    ],
  },

  // ============================================================================
  // 5. Post-Ch. 1 Overworld Arrival — World Map, Top-Right Menu & Skirmishes
  // ============================================================================
  {
    id: 'overworld_and_skirmishes',
    title: 'The World Map & Party Menu',
    category: 'world_progression',
    summary: 'Traveling kingdom roads, managing Units/Items/System, and optional Feral Skirmishes.',
    beats: [
      {
        id: 'ow_step1_open_menu',
        emotion: 'Happy',
        dialogue:
          'Fresh air! Sunshine! Zero claws swinging at my face! Tap unlocked nodes to travel the World Map—first, tap Menu in the top-right corner so we check our squad!',
        actionHint: 'Tap Menu in the top-right corner',
        awaitAction: 'overworld_open_menu',
        spotlight: {
          kind: 'dom',
          selector: '#pmd-corner-menu-btn',
          preferredDock: 'bottom',
        },
        chips: [{ kind: 'badge', label: 'Tap Nodes to Travel', tone: 'cyan' }],
      },
      {
        id: 'ow_step2_tour_tabs',
        emotion: 'Normal',
        dialogue:
          'In Units & Items, swap moves, rename pals, equip Convoy gear, or use Evolution Stones at Lv. 10+! Cleared chapters can’t be farmed infinitely, though occasional Feral Skirmishes pop up—and System has Ask Wimpod anytime!',
        chips: [
          { kind: 'badge', label: 'Units · Items · System', tone: 'gold' },
          { kind: 'badge', label: 'Bonus Feral Skirmishes', tone: 'danger' },
        ],
      },
    ],
  },

  // ============================================================================
  // 6. Chapter 2 (`Verdant Bluff`) Prep — Manage Units [E] & View Map Swap
  // ============================================================================
  {
    id: 'prep_units_and_moves',
    title: 'Chapter Prep, [E] Loadouts & Positioning',
    category: 'prep_pokemon',
    summary: 'Configuring 4-move loadouts, setting your [E] counter move, and swapping starting tiles.',
    beats: [
      {
        id: 'prep_step1_open_units',
        emotion: 'Happy',
        dialogue:
          'Ooh, Chapter Prep—planning BEFORE danger starts is my love language! First, tap Manage Units so we inspect our new recruits’ moves!',
        actionHint: 'Tap Manage Units',
        awaitAction: 'prep_open_manage_units',
        spotlight: { kind: 'dom', selector: '[data-testid="prep-btn-manage-units"]' },
      },
      {
        id: 'prep_step2_check_equipped',
        emotion: 'Determined',
        dialogue:
          'Each fighter brings up to 4 unlocked moves, and tapping [E] picks the ONE move they counter with on Enemy Phase (R1 Physical vs R2 Special)! Check your squad, then tap Done!',
        actionHint: 'Check moves / [E], then tap Done',
        awaitAction: 'prep_close_manage_units',
        spotlight: {
          kind: 'dom',
          selector: '[data-testid="prep-units-close-btn"]',
          preferredDock: 'bottom',
        },
        chips: [
          { kind: 'badge', label: '4 Active Moves', tone: 'green' },
          { kind: 'badge', label: '[E] Counter Move', tone: 'gold' },
        ],
      },
      {
        id: 'prep_step3_open_view_map',
        emotion: 'Worried',
        dialogue:
          'Never march into an ambush blind! Tap View Map next so we scout enemy positions and rearrange our starting formation!',
        actionHint: 'Tap View Map',
        awaitAction: 'prep_open_view_map',
        spotlight: { kind: 'dom', selector: '[data-testid="prep-btn-view-map"]' },
      },
      {
        id: 'prep_step4_swap_blue_tiles',
        emotion: 'Happy',
        dialogue:
          'Tap any two glowing Blue tiles to swap where teammates start (great for putting fliers or {partner} near rivers!), or tap Prep up top when you’re ready to hit Fight!',
        actionHint: 'Swap 2 Blue tiles (or tap Prep)',
        awaitAction: 'prep_swap_or_finish_view_map',
        spotlight: {
          kind: 'battle_tiles',
          tileFilter: 'prep_swap_slots',
          fallbackDomSelector: '[data-testid="prep-return-btn"]',
        },
        chips: [{ kind: 'badge', label: 'Tap 2 Blue Tiles = Swap', tone: 'cyan' }],
      },
    ],
  },

  // ============================================================================
  // 7. First Manage Items / Convoy — Shared Bag & Item Categories
  // ============================================================================
  {
    id: 'prep_items_and_convoy',
    title: 'Shared Convoy & Gear vs Consumables',
    category: 'prep_pokemon',
    summary: 'Swapping Held Gear, Berries, Potions, Stones, and X-Items via your shared Convoy.',
    beats: [
      {
        id: 'convoy_beat1',
        emotion: 'Happy',
        dialogue:
          'I guard the shared Convoy bag! Select any teammate and tap an item to equip their 1 slot (old items return safely to the bag). Held Gear boosts every fight, Berries auto-heal, and X-Items buff a stat for the whole dungeon!',
        chips: [
          { kind: 'item', itemId: 'muscle_band', label: 'Held Gear' },
          { kind: 'item', itemId: 'x_attack', label: 'X-Item (+3 Stat)' },
        ],
      },
    ],
  },

  // ============================================================================
  // 8. Chapter 2 (`Verdant Bluff`) Turn 1 — Stationary Boss & River Crossing
  // ============================================================================
  {
    id: 'ch2_boss_and_traversal',
    title: 'Boss Battles & Water / Flying Traversal',
    category: 'combat_tactics',
    summary: 'Winning Defeat Boss maps, 0-Mov stationary bosses, and crossing rivers.',
    beats: [
      {
        id: 'ch2_beat1_water_flying',
        emotion: 'Surprised',
        dialogue:
          'Heads up—most Grounded Pokémon can’t cross Water! Flying allies soar over rivers at 1 Mov (0 terrain cover), and Water-types like {partner} wade right across at 1 Mov WITH +10% Avoid!',
        chips: [
          { kind: 'type', pokemonType: 'Flying' },
          { kind: 'type', pokemonType: 'Water' },
          { kind: 'badge', label: '1 Mov Across Water', tone: 'cyan' },
        ],
      },
      {
        id: 'ch2_beat2_stationary_boss',
        emotion: 'Happy',
        dialogue:
          'This is a Defeat Boss battle: KO Captain Aron (marked BOSS) and we win instantly! He’s Stationary (0 Mov), so snag any side-path DROP items before finishing him off!',
        chips: [
          { kind: 'badge', label: 'Defeat Boss = Instant Win', tone: 'gold' },
          { kind: 'badge', label: '0 Mov Stationary', tone: 'danger' },
        ],
      },
    ],
  },

  // ============================================================================
  // 9. Chapter 3 (`Cleft Mountain`) Turn 1 — Sealing Dungeon Stairs
  // ============================================================================
  {
    id: 'ch3_stairs_reinforcements',
    title: 'Dungeon Stairs & Enemy Reinforcements',
    category: 'combat_tactics',
    summary: 'Standing directly on Stairs tiles to block incoming enemy reinforcement waves.',
    beats: [
      {
        id: 'ch3_beat1_stairs',
        emotion: 'Shouting',
        dialogue:
          'Enemy reinforcements climb up from Dungeon Stairs on later turns! Park any teammate directly ON a Stairs tile to completely block spawns ("STAIRS BLOCKED!") while getting +1 Def/SpD and +10% Avoid!',
        chips: [
          { kind: 'badge', label: 'Stand On Stairs = Block Spawns', tone: 'gold' },
          { kind: 'badge', label: '+1 Def/SpD · +10% Avo', tone: 'cyan' },
        ],
      },
    ],
  },

  // ============================================================================
  // 10. Chapter 4 (`River Shrine`) Turn 1 — Permanent Stat Vitamins & Drops
  // ============================================================================
  {
    id: 'ch4_vitamins',
    title: 'Permanent Stat Vitamins & Rare Drops',
    category: 'world_progression',
    summary: 'Defeating DROP-carrying foes and using Vitamins for permanent campaign stat boosts.',
    beats: [
      {
        id: 'ch4_beat1_vitamins',
        emotion: 'Surprised',
        dialogue:
          'Ooh, shiny loot! Defeating enemies marked with a DROP icon sends their treasure straight to our Convoy—and Vitamins (like Protein) permanently raise a Pokémon’s stat for the whole campaign when used on the World Map!',
        chips: [
          { kind: 'item', itemId: 'protein', label: 'Permanent +Stat' },
          { kind: 'badge', label: 'KO Enemy w/ DROP', tone: 'gold' },
        ],
      },
    ],
  },

  // ============================================================================
  // 11. Post-Ch. 4 Overworld / First Shop — Kecleon Stalls & Single-Use TMs
  // ============================================================================
  {
    id: 'kecleon_shops_and_tms',
    title: 'Kecleon Shops & Teaching TMs',
    category: 'world_progression',
    summary: 'Browsing 4 rotating World Map Kecleon stalls and teaching permanent TM moves.',
    beats: [
      {
        id: 'shop_beat1_stalls',
        emotion: 'Happy',
        dialogue:
          'Kecleon’s traveling merchants now visit cleared World Map nodes with 4 rotating stalls: TMs, Held Gear, Apothecary (Potions & Stones!), and X-Items! Walk onto a Kecleon node to shop!',
        chips: [
          { kind: 'species', speciesId: '0352', label: 'Kecleon Shop' },
          { kind: 'item', itemId: 'evolution_stone', label: 'Stones & Gear' },
        ],
      },
      {
        id: 'shop_beat2_tms',
        emotion: 'Normal',
        dialogue:
          'TMs are single-use scrolls used from Overworld Menu -> Items or Units—once taught, that move stays permanently unlocked in that Pokémon’s Move Pool forever!',
        chips: [{ kind: 'item', itemId: 'tm13_scald', label: 'Permanent Move Unlock' }],
      },
    ],
  },

  // ============================================================================
  // 12. Chapter 5 (`Berry Orchards`) — Deployment Cap & Mobile Bosses
  // ============================================================================
  {
    id: 'ch5_deployment_cap_and_mobile_boss',
    title: 'Deployment Caps & Mobile Bosses',
    category: 'combat_tactics',
    summary: 'Rotating your active strike team and baiting mobile enemy commanders.',
    beats: [
      {
        id: 'ch5_beat1_cap',
        emotion: 'Worried',
        dialogue:
          'Our squad outnumbers this dungeon’s Deployment Cap! Toggle ✓ Deployed vs Standby in Manage Units ({lord} ★ is always in), and move Held Gear off benched pals onto today’s fighters!',
        chips: [{ kind: 'badge', label: 'Rotate Standby Gear', tone: 'gold' }],
      },
      {
        id: 'ch5_beat2_mobile_boss',
        emotion: 'Teary-Eyed',
        dialogue:
          'And watch out—Commander Deino is NOT stationary! Mobile bosses have full Mov and will charge the instant anyone enters their Danger Area, so bait him carefully with a sturdy tank!',
        chips: [{ kind: 'species', speciesId: '0633', label: 'Mobile Boss Charges!' }],
      },
    ],
  },

  // ============================================================================
  // 13. Dynamic Terrain — Trees / Foliage & Mountain Crags
  // ============================================================================
  {
    id: 'terrain_cover_woods_crags',
    title: 'Defensive Cover: Trees & Mountains',
    category: 'combat_tactics',
    summary: 'Using Trees and Mountains for Defense, Special Defense, and Avoid bonuses.',
    beats: [
      {
        id: 'terrain_woods_beat1',
        emotion: 'Happy',
        dialogue:
          'Hiding in bushes actually works! Grounded units pay extra Mov in Trees (+1 Def/SpD, +15% Avo) and Mountains (+2 Def/SpD, +20% Avo) for huge cover—while Flying/Levitate glide over at 1 Mov with 0 cover (and Heavy-Duty Boots get both)!',
        chips: [
          { kind: 'badge', label: 'Trees: +1 Def/SpD · +15% Avo', tone: 'green' },
          { kind: 'badge', label: 'Mountain: +2 Def/SpD · +20% Avo', tone: 'gold' },
        ],
      },
    ],
  },

  // ============================================================================
  // 14. Dynamic Terrain — PMD Wonder Tiles
  // ============================================================================
  {
    id: 'terrain_wonder_tiles',
    title: 'PMD Wonder Tiles',
    category: 'combat_tactics',
    summary: 'Sanctuary tiles granting +2 Def/SpD, +20% Avoid, 20% HP regen, and debuff cleansing.',
    beats: [
      {
        id: 'terrain_wonder_beat1',
        emotion: 'Surprised',
        dialogue:
          'A glowing PMD Wonder Tile! Standing on it grants +2 Def/SpD and +20% Avoid (even to Fliers!), heals 20% HP each turn, and clears debuffs—just lure enemies OFF it so they don’t hog my dream hiding spot!',
        chips: [
          { kind: 'badge', label: '+2 Def/SpD · +20% Avo', tone: 'gold' },
          { kind: 'badge', label: '20% Heal + Cleanse', tone: 'green' },
        ],
      },
    ],
  },

  // ============================================================================
  // 15. Dynamic Terrain — Lava, Void Chasms & Low Barriers
  // ============================================================================
  {
    id: 'terrain_hazards_lava_void',
    title: 'Lava, Chasms & Levitate Shortcuts',
    category: 'combat_tactics',
    summary: 'Crossing Lava with Fire/Flying/Levitate, and Void Chasms or Barriers exclusively with Levitate.',
    beats: [
      {
        id: 'terrain_hazards_beat1',
        emotion: 'Dizzy',
        dialogue:
          'YIKES, don’t look down! Fire-types (+10% Avo), Flying, and Levitate cross Lava at 1 Mov—but deep Void Chasms and Low Barriers block even Fliers! ONLY Levitate Pokémon can float across them!',
        chips: [
          { kind: 'type', pokemonType: 'Fire' },
          { kind: 'badge', label: 'Levitate Only: Void & Barriers', tone: 'gold' },
        ],
      },
    ],
  },
];

export const TUTORIAL_TOPIC_MAP: ReadonlyMap<string, TutorialTopicDefinition> = new Map(
  TUTORIAL_TOPICS.map((topic) => [topic.id, topic])
);

export function getTutorialTopicById(topicId: string): TutorialTopicDefinition | undefined {
  return TUTORIAL_TOPIC_MAP.get(topicId);
}

/**
 * Dynamically detects special dungeon terrain tutorials that apply to `map` so custom maps and
 * chapters introduce Trees/Mountains, Wonder Tiles, and Lava/Void/Barriers the first time encountered.
 */
export function detectDynamicMapTerrainTutorialIds(map: DungeonMapDefinition): string[] {
  let hasCover = false;
  let hasWonder = false;
  let hasLavaOrVoid = false;

  for (const row of map.tiles) {
    if (!Array.isArray(row)) continue;
    for (const cell of row) {
      const rawCell = cell as { terrain?: string; terrainType?: string } | undefined;
      const t = rawCell?.terrain ?? rawCell?.terrainType;
      if (t === 'trees' || t === 'mountain') {
        hasCover = true;
      } else if (t === 'wonder_tile') {
        hasWonder = true;
      } else if (t === 'lava' || t === 'void' || t === 'barrier') {
        hasLavaOrVoid = true;
      }
    }
  }

  const topics: string[] = [];
  if (hasCover) topics.push('terrain_cover_woods_crags');
  if (hasWonder) topics.push('terrain_wonder_tiles');
  if (hasLavaOrVoid) topics.push('terrain_hazards_lava_void');
  return topics;
}
