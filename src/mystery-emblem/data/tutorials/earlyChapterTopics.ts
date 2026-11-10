/**
 * Mystery Emblem — Core Hands-On Drill Topics 1–6 (`earlyChapterTopics.ts`)
 *
 * Covers Prologue Turn 1 movement/Danger Area, Combat Forecast & `[E]` rule,
 * 1-Item Slot & Heal Pulse, Level-Ups & Stones, Overworld Menu, and Chapter Prep.
 *
 * Copy rule: 1–2 short sentences per beat. Interactive (`awaitAction`) beats MUST end with
 * a clear instruction — the coach card renders no hint pill or buttons on those beats.
 */

import type { TutorialTopicDefinition } from './tutorialTypes';

export const EARLY_CHAPTER_TUTORIAL_TOPICS: ReadonlyArray<TutorialTopicDefinition> = [
  {
    id: 'ch1_turn1_controls_phases',
    title: 'Danger Area, Moving & Turn Phases',
    category: 'controls_fusion',
    summary: 'Check enemy reach, move your team, and keep your ★ Lord safe.',
    beats: [
      {
        id: 'ch1_step1_empty_tile',
        emotion: 'Teary-Eyed',
        dialogue: 'Eep, the lesson’s starting! Tap a glowing empty tile to open the Field Menu.',
        actionHint: 'Tap a glowing empty tile',
        awaitAction: 'battle_open_field_menu',
        spotlight: { kind: 'battle_tiles', tileFilter: 'empty_floor' },
        chips: [{ kind: 'badge', label: 'Empty Tile -> Field Menu', tone: 'gold' }],
      },
      {
        id: 'ch1_step2_danger_area',
        emotion: 'Shouting',
        dialogue: 'Now tap Danger Area to see where enemies can reach.',
        actionHint: 'Tap Danger Area',
        awaitAction: 'battle_toggle_danger_area',
        spotlight: { kind: 'dom', selector: '[data-testid="battle-field-danger"]' },
        chips: [{ kind: 'badge', label: 'Danger Area', tone: 'danger' }],
      },
      {
        id: 'ch1_step3_select_lord',
        emotion: 'Worried',
        dialogue:
          'Enemies can hit anything in red, and if {lord} faints, it’s game over! Tap {lord} (★) to select them.',
        actionHint: 'Tap {lord} (★)',
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
        dialogue: 'Blue tiles show where {lord} can move. Tap a blue tile to walk there.',
        actionHint: 'Tap a blue tile',
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
        dialogue: 'Way braver than me! Tap Wait to end {lord}’s turn.',
        actionHint: 'Tap Wait',
        awaitAction: 'battle_confirm_wait',
        spotlight: { kind: 'dom', selector: '[data-testid="dungeon-cmd-wait"]' },
      },
    ],
  },
  {
    id: 'ch1_first_combat_forecast',
    title: 'Combat Forecast, Ranges & [E] Counters',
    category: 'combat_tactics',
    summary: 'Physical vs Special range, the [E] counter rule, and hitting twice.',
    beats: [
      {
        id: 'combat_step1_open_forecast',
        emotion: 'Stunned',
        dialogue: 'Wah, an enemy’s in range! Tap the glowing enemy to see the Combat Forecast.',
        actionHint: 'Tap the glowing enemy',
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
          'Physical moves hit 1 tile away, Special moves hit 2. Foes only counter if their single [E] move matches your range!',
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
          'Type advantage hits harder, and being 5+ Speed faster hits twice. Pick a move, then tap Attack!',
        actionHint: 'Tap Attack!',
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
  {
    id: 'ch1_healing_and_items',
    title: 'Healing Allies & The 1-Item Slot',
    category: 'prep_pokemon',
    summary: 'Your one item slot, auto Berries vs Potions, and healing allies.',
    beats: [
      {
        id: 'heal_step1_item_slot_rule',
        emotion: 'Crying',
        dialogue:
          'Someone got hurt! Each Pokémon holds one item: Berries like {partner}’s Oran Berry work on their own, and Potions are used from Item.',
        chips: [
          { kind: 'item', itemId: 'oran_berry', label: 'Oran Berry (Auto)' },
          { kind: 'item', itemId: 'potion', label: 'Potion (Manual)' },
        ],
      },
      {
        id: 'heal_step2_heal_pulse',
        emotion: 'Worried',
        dialogue:
          '{healer}’s Heal Pulse heals allies up to 2 tiles away and earns EXP. Tap the glowing ally to try it.',
        actionHint: 'Tap the glowing ally',
        awaitAction: 'battle_inspect_heal_or_item',
        spotlight: { kind: 'battle_tiles', tileFilter: 'wounded_or_healer' },
        chips: [
          { kind: 'species', speciesId: 'flabebe', label: 'Heal Pulse (R1-2)' },
          { kind: 'badge', label: 'Heal Grants EXP', tone: 'gold' },
        ],
      },
    ],
  },
  {
    id: 'levelup_and_evolution',
    title: 'Level-Ups & Evolution Stone Promotions',
    category: 'world_progression',
    summary: 'Level-ups, stat growth, and evolving with Stones at Lv. 10+.',
    beats: [
      {
        id: 'evo_beat1_exp',
        emotion: 'Surprised',
        dialogue: 'Whoa, a level up! Every 100 EXP means a new level and better stats.',
        chips: [{ kind: 'badge', label: '100 EXP = +1 Lv', tone: 'gold' }],
      },
      {
        id: 'evo_beat2_manual_stone',
        emotion: 'Happy',
        dialogue:
          'Nobody evolves on their own. At Lv. 10+, use an Evolution Stone from Units, Chapter Prep, or Evolve! in battle.',
        chips: [
          { kind: 'item', itemId: 'evolution_stone', label: 'Lv. 10+ Stone' },
          { kind: 'item', itemId: 'evolution_gem', label: 'Lv. 20+ Gem' },
        ],
      },
    ],
  },
  {
    id: 'overworld_and_skirmishes',
    title: 'The World Map & Party Menu',
    category: 'world_progression',
    summary: 'Traveling the map, the party menu, and bonus Skirmishes.',
    beats: [
      {
        id: 'ow_step1_open_menu',
        emotion: 'Happy',
        dialogue: 'Phew, fresh air! Tap nodes to travel, but first tap Menu in the top-right corner.',
        actionHint: 'Tap Menu',
        awaitAction: 'overworld_open_menu',
        spotlight: { kind: 'dom', selector: '#pmd-corner-menu-btn', preferredDock: 'bottom' },
        chips: [{ kind: 'badge', label: 'Tap Nodes to Travel', tone: 'cyan' }],
      },
      {
        id: 'ow_step2_tour_tabs',
        emotion: 'Normal',
        dialogue:
          'Units and Items let you swap moves, equip gear, and evolve. Bonus Feral Skirmishes sometimes pop up on cleared spots!',
        chips: [
          { kind: 'badge', label: 'Units · Items · System', tone: 'gold' },
          { kind: 'badge', label: 'Bonus Feral Skirmishes', tone: 'danger' },
        ],
      },
    ],
  },
  {
    id: 'prep_units_and_moves',
    title: 'Chapter Prep, [E] Loadouts & Positioning',
    category: 'prep_pokemon',
    summary: 'Set moves and your [E] counter, then arrange starting spots.',
    beats: [
      {
        id: 'prep_step1_open_units',
        emotion: 'Happy',
        dialogue: 'Chapter Prep—planning before danger is my favorite! Tap Manage Units.',
        actionHint: 'Tap Manage Units',
        awaitAction: 'prep_open_manage_units',
        spotlight: { kind: 'dom', selector: '[data-testid="prep-btn-manage-units"]' },
      },
      {
        id: 'prep_step2_check_equipped',
        emotion: 'Determined',
        dialogue:
          'Each Pokémon brings 4 moves, and [E] marks the one they counter with. Take a look, then tap Done.',
        actionHint: 'Tap Done',
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
        dialogue: 'Never walk into an ambush blind! Tap View Map.',
        actionHint: 'Tap View Map',
        awaitAction: 'prep_open_view_map',
        spotlight: { kind: 'dom', selector: '[data-testid="prep-btn-view-map"]' },
      },
      {
        id: 'prep_step4_swap_blue_tiles',
        emotion: 'Happy',
        dialogue: 'Tap two blue tiles to swap starting spots, or tap Prep when you’re ready.',
        actionHint: 'Swap 2 blue tiles (or tap Prep)',
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
];
