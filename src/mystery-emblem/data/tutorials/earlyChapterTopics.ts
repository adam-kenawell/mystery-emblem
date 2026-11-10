/**
 * Mystery Emblem — Core Hands-On Drill Topics 1–6 (`earlyChapterTopics.ts`)
 *
 * Covers Prologue Turn 1 movement, Combat Forecast & counter rule, the one-item slot & Heal Pulse,
 * Level-Ups & Stones, Overworld Menu, and Chapter Prep.
 *
 * Copy rule: 1–2 short sentences per beat in the speaker's natural voice. Explain rules in plain
 * words (no shorthand like R1/R2, `[E]`, BOSS, DROP, KO, STAB). Interactive (`awaitAction`) beats
 * MUST end with a clear instruction — the coach card renders no hint pill or buttons on those beats.
 */

import type { TutorialTopicDefinition } from './tutorialTypes';

export const EARLY_CHAPTER_TUTORIAL_TOPICS: ReadonlyArray<TutorialTopicDefinition> = [
  {
    id: 'ch1_turn1_controls_phases',
    title: 'Moving & Turn Phases',
    category: 'controls_fusion',
    summary: 'Move your team and keep your Lord safe.',
    beats: [
      {
        id: 'ch1_step3_select_lord',
        emotion: 'Worried',
        dialogue: 'Here we go! If {lord} goes down, it’s all over, so be careful. Tap {lord} to start.',
        mentorEmotion: 'Determined',
        mentorDialogue:
          'Let us begin. Remember, {lord}: if you fall in a real battle, our journey ends. Tap {lord}.',
        actionHint: 'Tap {lord}',
        awaitAction: 'battle_select_lord',
        spotlight: { kind: 'battle_tiles', tileFilter: 'lord_unit' },
        chips: [
          { kind: 'badge', label: 'Lord 0 HP = Defeat', tone: 'gold' },
          { kind: 'badge', label: 'Allies Recover Post-Battle', tone: 'green' },
        ],
      },
      {
        id: 'ch1_step4_move_blue',
        emotion: 'Surprised',
        dialogue: 'The blue squares show how far {lord} can walk. Tap one to move there.',
        mentorEmotion: 'Normal',
        mentorDialogue: 'The blue squares show how far you can go. Step onto the glowing one.',
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
        dialogue: 'Way braver than me. Tap Wait to finish {lord}’s move.',
        mentorDialogue: 'Good. Now tap Wait, and brace yourself.',
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
        dialogue: 'Eek, an enemy’s close enough to hit! Tap it to see how the fight would go.',
        mentorEmotion: 'Determined',
        mentorDialogue: 'An enemy is within reach. Tap it to see how the exchange would go.',
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
          'Physical moves hit up close, and special moves hit from two spaces away. A foe can only hit back with a move marked E that reaches you.',
        mentorDialogue:
          'Physical moves strike up close, special moves from two spaces away. A foe can only answer with a move marked E that reaches you.',
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
          'Hitting a weakness hurts more, and if you’re much faster, you hit twice. Pick a move, then tap Attack!',
        mentorEmotion: 'Inspired',
        mentorDialogue:
          'Strike their weakness, and if you’re much faster, you strike twice. Choose a move, then tap Attack.',
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
          'Ouch, someone’s hurt! Everyone can hold one item. Berries get eaten on their own, but Potions you use from Item.',
        mentorEmotion: 'Worried',
        mentorDialogue:
          'One of you is wounded. Each of you carries one item. Berries are eaten when needed; Potions you use from Item.',
        chips: [
          { kind: 'item', itemId: 'oran_berry', label: 'Oran Berry (Auto)' },
          { kind: 'item', itemId: 'potion', label: 'Potion (Manual)' },
        ],
      },
      {
        id: 'heal_step2_heal_pulse',
        emotion: 'Worried',
        dialogue:
          '{healer} can heal friends from up to two spaces away, and gets stronger doing it. Tap the glowing ally to try.',
        mentorEmotion: 'Normal',
        mentorDialogue:
          '{healer} can mend allies from two spaces away, and grows stronger doing it. Tap the glowing ally to try.',
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
        dialogue: 'Whoa, a level up! The more you fight and heal, the stronger everyone gets.',
        chips: [{ kind: 'badge', label: '100 EXP = +1 Lv', tone: 'gold' }],
      },
      {
        id: 'evo_beat2_manual_stone',
        emotion: 'Happy',
        dialogue:
          'Nobody evolves on their own, though. From level 10, an Evolution Stone does it. Use one from Units, Chapter Prep, or Evolve in battle.',
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
        dialogue: 'Fresh air at last! Tap a spot on the map to travel there. But first, tap Menu up in the corner.',
        actionHint: 'Tap Menu',
        awaitAction: 'overworld_open_menu',
        spotlight: { kind: 'dom', selector: '#pmd-corner-menu-btn', preferredDock: 'bottom' },
        chips: [{ kind: 'badge', label: 'Tap Nodes to Travel', tone: 'cyan' }],
      },
      {
        id: 'ow_step2_tour_tabs',
        emotion: 'Normal',
        dialogue:
          'Units and Items let you change moves, hand out gear, and evolve. And watch for Ferals showing up in places we’ve already cleared!',
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
    summary: 'Set moves and your [E] counters, then arrange starting spots.',
    beats: [
      {
        id: 'prep_step1_open_units',
        emotion: 'Happy',
        dialogue: 'Planning before the danger starts. My favorite part! Tap Manage Units.',
        actionHint: 'Tap Manage Units',
        awaitAction: 'prep_open_manage_units',
        spotlight: { kind: 'dom', selector: '[data-testid="prep-btn-manage-units"]' },
      },
      {
        id: 'prep_step2_check_equipped',
        emotion: 'Determined',
        dialogue:
          'Everyone knows four moves. The ones marked E are what they hit back with: one up close, one from range. Have a look, then tap Done.',
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
        emotion: 'Worried',
        dialogue: 'Never walk into a fight blind. Tap View Map.',
        actionHint: 'Tap View Map',
        awaitAction: 'prep_open_view_map',
        spotlight: { kind: 'dom', selector: '[data-testid="prep-btn-view-map"]' },
      },
      {
        id: 'prep_step4_swap_blue_tiles',
        emotion: 'Happy',
        dialogue: 'Tap two blue squares to swap who starts where, or tap Prep when you’re ready.',
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
