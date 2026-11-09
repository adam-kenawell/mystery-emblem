/**
 * Mystery Emblem — Core Hands-On Drill Topics 1–6 (`earlyChapterTopics.ts`)
 *
 * Covers Prologue Turn 1 movement/Danger Area, Combat Forecast & `[E]` rule,
 * 1-Item Slot & Heal Pulse, Level-Ups & Stones, Overworld Menu, and Chapter Prep.
 */

import type { TutorialTopicDefinition } from './tutorialTypes';

export const EARLY_CHAPTER_TUTORIAL_TOPICS: ReadonlyArray<TutorialTopicDefinition> = [
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
        spotlight: { kind: 'dom', selector: '#pmd-corner-menu-btn', preferredDock: 'bottom' },
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
];
