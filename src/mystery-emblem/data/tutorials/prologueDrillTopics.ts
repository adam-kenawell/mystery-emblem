/**
 * Mystery Emblem - Prologue Sparring Drill Topics (`prologueDrillTopics.ts`)
 *
 * Played during the Hometown Pitch training bout with Quaquaval:
 * 1. Turn 2: Heal {partner} with {healer} (`prologue_heal_drill`).
 * 2. Turn 2: Strike Quaquaval from Range 2 using {lord}'s Dragon Breath (`prologue_ranged_counter_drill`),
 *    where Quaquaval explains 4-move loadouts, level-up learning, and dual [E] slots.
 * 3. Turn 3: Cure {partner}'s Paralysis using Paralyze Heal (`prologue_item_cure_drill`).
 */

import type { TutorialTopicDefinition } from './tutorialTypes';

export const PROLOGUE_HEAL_DRILL_TOPIC_ID = 'prologue_heal_drill';
export const PROLOGUE_RANGED_DRILL_TOPIC_ID = 'prologue_ranged_counter_drill';
export const PROLOGUE_ITEM_CURE_DRILL_TOPIC_ID = 'prologue_item_cure_drill';

export const PROLOGUE_DRILL_TUTORIAL_TOPICS: ReadonlyArray<TutorialTopicDefinition> = [
  {
    id: PROLOGUE_HEAL_DRILL_TOPIC_ID,
    title: 'Healing a Wounded Teammate',
    category: 'combat_tactics',
    summary: 'Select Flabebe, target Quaxly from up to 2 tiles away, and confirm Heal.',
    beats: [
      {
        id: 'heal_drill_select_healer',
        emotion: 'Normal',
        dialogue:
          'You took that Aqua Jet on the chin, {partner}! Never push forward wounded when {healer} is nearby. Tap {healer}.',
        actionHint: 'Tap {healer}',
        awaitAction: 'battle_select_healer',
        spotlight: { kind: 'battle_tiles', tileFilter: 'healer_unit' },
      },
      {
        id: 'heal_drill_pick_partner',
        emotion: 'Determined',
        dialogue:
          '{healer} knows Heal Pulse and can mend allies from up to two spaces away. Tap {partner}.',
        actionHint: 'Tap {partner}',
        awaitAction: 'battle_open_heal_forecast',
        spotlight: { kind: 'battle_tiles', tileFilter: 'partner_unit' },
      },
      {
        id: 'heal_drill_confirm',
        emotion: 'Happy',
        dialogue:
          'This forecast shows how much health {healer} restores, and healing earns experience too. Tap Heal.',
        actionHint: 'Tap Heal',
        awaitAction: 'battle_confirm_heal',
        spotlight: {
          kind: 'dom',
          selector: '[data-testid="forecast-attack-btn"]',
          preferredDock: 'top',
        },
      },
    ],
  },
  {
    id: PROLOGUE_RANGED_DRILL_TOPIC_ID,
    title: 'Ranged Strikes, 4 Moves & Dual [E] Slots',
    category: 'combat_tactics',
    summary: 'Use Dragon Breath from 2 spaces away while learning the 4-move and [E] counter rules.',
    beats: [
      {
        id: 'ranged_drill_select_lord',
        emotion: 'Inspired',
        dialogue:
          'Now it is your turn, {lord}! Let us practice striking without getting hit back. Tap {lord}.',
        actionHint: 'Tap {lord}',
        awaitAction: 'battle_select_lord',
        spotlight: { kind: 'battle_tiles', tileFilter: 'lord_unit' },
      },
      {
        id: 'ranged_drill_step_back',
        emotion: 'Determined',
        dialogue:
          'You carry up to four moves, learn new ones on level-up, and equip one physical and one special counter. Step onto the glowing tile two spaces from me.',
        actionHint: 'Tap the glowing tile',
        awaitAction: 'battle_move_to_blue_tile',
        spotlight: { kind: 'battle_tiles', tileFilter: 'reachable_move' },
        chips: [
          { kind: 'badge', label: 'Physical = R1', tone: 'gold' },
          { kind: 'badge', label: 'Special = R2', tone: 'cyan' },
        ],
      },
      {
        id: 'ranged_drill_open_forecast',
        emotion: 'Normal',
        dialogue:
          'I only have a close-range physical move equipped right now, so I cannot answer from two spaces out. Tap me to aim Dragon Breath.',
        actionHint: 'Tap Quaquaval',
        awaitAction: 'battle_open_attack_forecast',
        spotlight: {
          kind: 'battle_tiles',
          tileFilter: 'attackable_enemy',
          fallbackDomSelector: '[data-testid="dungeon-cmd-attack"]',
        },
      },
      {
        id: 'ranged_drill_confirm',
        emotion: 'Happy',
        dialogue: 'Spot on! From two spaces away, Dragon Breath lands cleanly with zero counterattack. Tap Attack!',
        actionHint: 'Tap Attack!',
        awaitAction: 'battle_confirm_attack',
        spotlight: {
          kind: 'dom',
          selector: '[data-testid="forecast-attack-btn"]',
          preferredDock: 'top',
        },
        chips: [
          { kind: 'badge', label: 'No R2 [E] = No Counter', tone: 'green' },
          { kind: 'badge', label: '4-Move Cap', tone: 'gold' },
        ],
      },
    ],
  },
  {
    id: PROLOGUE_ITEM_CURE_DRILL_TOPIC_ID,
    title: 'Curing Status With Items',
    category: 'prep_pokemon',
    summary: 'Use Paralyze Heal from the command menu to shake off Paralysis.',
    beats: [
      {
        id: 'item_drill_select_partner',
        emotion: 'Worried',
        dialogue:
          'Paralysis cuts movement to a single step and slows speed! Use that Paralyze Heal I tossed you. Tap {partner}.',
        actionHint: 'Tap {partner}',
        awaitAction: 'battle_select_partner',
        spotlight: { kind: 'battle_tiles', tileFilter: 'partner_unit' },
      },
      {
        id: 'item_drill_open_menu',
        emotion: 'Normal',
        dialogue:
          'Tap {partner}’s square or an adjacent blue square to open the action menu.',
        actionHint: 'Tap {partner} or a blue tile',
        awaitAction: 'battle_move_to_blue_tile',
        spotlight: { kind: 'battle_tiles', tileFilter: 'reachable_move' },
      },
      {
        id: 'item_drill_use_item',
        emotion: 'Happy',
        dialogue:
          'Now tap Item to use your Paralyze Heal, then finish the bout by defeating Starly, Caterpie, and Pawmi!',
        actionHint: 'Tap Item',
        awaitAction: 'battle_confirm_item',
        spotlight: { kind: 'dom', selector: '[data-testid="dungeon-cmd-item"]' },
      },
    ],
  },
];
