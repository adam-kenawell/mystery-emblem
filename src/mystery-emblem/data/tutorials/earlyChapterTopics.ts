/**
 * Mystery Emblem - Core Hands-On Drill Topics 1-6 (`earlyChapterTopics.ts`)
 *
 * Voiced by Quaquaval for live coaching and Quaquaval's Field Notes.
 * Zero em dashes; every interactive (`awaitAction`) beat ends with a clear instruction.
 */

import type { TutorialTopicDefinition } from './tutorialTypes';

export const EARLY_CHAPTER_TUTORIAL_TOPICS: ReadonlyArray<TutorialTopicDefinition> = [
  {
    id: 'ch1_turn1_controls_phases',
    title: 'Moving & Turn Phases',
    category: 'controls_fusion',
    summary: "Quaquaval's first lesson: stride into position and hold stance.",
    beats: [
      {
        id: 'ch1_step3_select_partner',
        emotion: 'Determined',
        dialogue:
          'Eyes up, kids! Good footwork wins every bout before the first swing. Tap {partner} to begin.',
        actionHint: 'Tap {partner}',
        awaitAction: 'battle_select_partner',
        spotlight: { kind: 'battle_tiles', tileFilter: 'partner_unit' },
        chips: [
          { kind: 'badge', label: 'Lord 0 HP = Defeat', tone: 'gold' },
          { kind: 'badge', label: 'Allies Recover Post-Battle', tone: 'green' },
        ],
      },
      {
        id: 'ch1_step4_move_blue',
        emotion: 'Normal',
        dialogue:
          'The blue squares show how far {partner} can stride. Tap the glowing square inside my reach.',
        actionHint: 'Tap the glowing blue tile',
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
        dialogue: 'Clean footwork, {partner}! Tap Wait to finish your move and brace for my strike.',
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
    summary: 'Physical vs Special range, dual [E] counter slots, and follow-up strikes.',
    beats: [
      {
        id: 'combat_step1_open_forecast',
        emotion: 'Determined',
        dialogue:
          'A foe is within striking distance! Tap the glowing opponent to inspect the battle forecast.',
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
        emotion: 'Normal',
        dialogue:
          'Each fighter carries up to four moves: physical strikes hit adjacent foes, special moves reach two spaces out, and you equip one of each to counter.',
        chips: [
          { kind: 'badge', label: 'Physical = R1', tone: 'gold' },
          { kind: 'badge', label: 'Special = R2', tone: 'cyan' },
          { kind: 'badge', label: '1 Phys + 1 Spec [E]', tone: 'green' },
        ],
      },
      {
        id: 'combat_step3_confirm_attack',
        emotion: 'Inspired',
        dialogue:
          'Hitting an elemental weakness deals heavy damage, and outspeeding a foe lets you strike twice. Pick your move, then tap Attack!',
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
    title: 'Healing Allies & Medicine Items',
    category: 'prep_pokemon',
    summary: 'Using medicine from Item, auto Berries, and healing allies from afar.',
    beats: [
      {
        id: 'heal_step1_item_slot_rule',
        emotion: 'Worried',
        dialogue:
          'Someone took a hit! Berries trigger on their own in a pinch, while Potions and status cures are used from Item.',
        chips: [
          { kind: 'item', itemId: 'oran_berry', label: 'Oran Berry (Auto)' },
          { kind: 'item', itemId: 'paralyze_heal', label: 'Status Cure (Item)' },
        ],
      },
      {
        id: 'heal_step2_heal_pulse',
        emotion: 'Normal',
        dialogue:
          '{healer} can mend allies from up to two spaces away and earns experience every time. Tap the glowing ally to tend the wound.',
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
    summary: 'Learning moves through level-ups and promoting with Stones at Lv. 10+.',
    beats: [
      {
        id: 'evo_beat1_exp',
        emotion: 'Happy',
        dialogue:
          'Well earned! Every battle and heal builds experience, raising stats and unlocking new moves as you level up.',
        chips: [{ kind: 'badge', label: '100 EXP = +1 Lv', tone: 'gold' }],
      },
      {
        id: 'evo_beat2_manual_stone',
        emotion: 'Determined',
        dialogue:
          'Once a teammate reaches level 10, an Evolution Stone unlocks their next form. Use one from Units, Battle Prep, or Evolve in combat.',
        chips: [
          { kind: 'item', itemId: 'evolution_stone', label: 'Lv. 10+ Stone' },
          { kind: 'item', itemId: 'evolution_gem', label: 'Lv. 20+ Gem' },
        ],
      },
    ],
  },
  {
    id: 'overworld_and_skirmishes',
    title: 'The World Map & Expedition Menu',
    category: 'world_progression',
    summary: "Quaquaval's road guide: traveling nodes, managing your squad, and Skirmishes.",
    beats: [
      {
        id: 'ow_step1_open_menu',
        emotion: 'Determined',
        dialogue:
          'The road to the capital stretches ahead! Tap any connected landmark to march there, or tap Menu in the corner first.',
        actionHint: 'Tap Menu',
        awaitAction: 'overworld_open_menu',
        spotlight: { kind: 'dom', selector: '#pmd-corner-menu-btn', preferredDock: 'bottom' },
        chips: [{ kind: 'badge', label: 'Tap Nodes to Travel', tone: 'cyan' }],
      },
      {
        id: 'ow_step2_tour_tabs',
        emotion: 'Normal',
        dialogue:
          'Use Units and Items to tune your four-move loadouts, swap gear, and read Quaquaval’s Field Notes under System.',
        chips: [
          { kind: 'badge', label: 'Units · Items · System', tone: 'gold' },
          { kind: 'badge', label: 'Bonus Feral Skirmishes', tone: 'danger' },
        ],
      },
    ],
  },
  {
    id: 'prep_units_and_moves',
    title: 'Battle Prep, Deployment & Starting Spots',
    category: 'prep_pokemon',
    summary: "Quaquaval's Royal Guard prep checklist: pick your squad, moves, and map spots.",
    beats: [
      {
        id: 'prep_step1_open_units',
        emotion: 'Determined',
        dialogue:
          'Now that I am marching beside you, we prepare properly before every clash. Tap Manage Units.',
        actionHint: 'Tap Manage Units',
        awaitAction: 'prep_open_manage_units',
        spotlight: { kind: 'dom', selector: '[data-testid="prep-btn-manage-units"]' },
      },
      {
        id: 'prep_step2_check_equipped',
        emotion: 'Normal',
        dialogue:
          'Choose who deploys, customize up to four moves, and check your equipped close and ranged counters. Tap Done when ready.',
        actionHint: 'Tap Done',
        awaitAction: 'prep_close_manage_units',
        spotlight: {
          kind: 'dom',
          selector: '[data-testid="prep-units-close-btn"]',
          preferredDock: 'bottom',
        },
        chips: [
          { kind: 'badge', label: '4 Active Moves', tone: 'green' },
          { kind: 'badge', label: '[E] Phys + Spec Counters', tone: 'gold' },
        ],
      },
      {
        id: 'prep_step3_open_view_map',
        emotion: 'Determined',
        dialogue:
          'A Royal Guard always scouts the ground before engaging. Tap View Map to inspect the battlefield.',
        actionHint: 'Tap View Map',
        awaitAction: 'prep_open_view_map',
        spotlight: { kind: 'dom', selector: '[data-testid="prep-btn-view-map"]' },
      },
      {
        id: 'prep_step4_swap_blue_tiles',
        emotion: 'Happy',
        dialogue:
          'Tap any two blue starting squares to swap where your teammates begin, or tap Prep when your formation looks sharp.',
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
