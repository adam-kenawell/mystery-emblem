/**
 * Mystery Emblem — Prologue Sparring Drill Topics (`prologueDrillTopics.ts`)
 *
 * Played back-to-back at the start of Prologue Turn 2 (after Sir Empoleon's sparring strike):
 * 1. Heal the lord with the healer (select healer -> tap lord -> confirm heal).
 * 2. Strike back from Range 2 so Sir Empoleon's Physical-only [E] cannot counter.
 *
 * `mentorDialogue` is the live Prologue copy (Sir Empoleon); `dialogue` is Wimpod's
 * "Ask Wimpod" replay copy. Same copy rule as `earlyChapterTopics.ts`: plain words, no shorthand,
 * and every interactive beat ends with what to tap.
 */

import type { TutorialTopicDefinition } from './tutorialTypes';

export const PROLOGUE_HEAL_DRILL_TOPIC_ID = 'prologue_heal_drill';
export const PROLOGUE_RANGED_DRILL_TOPIC_ID = 'prologue_ranged_counter_drill';

export const PROLOGUE_DRILL_TUTORIAL_TOPICS: ReadonlyArray<TutorialTopicDefinition> = [
  {
    id: PROLOGUE_HEAL_DRILL_TOPIC_ID,
    title: 'Healing an Ally',
    category: 'combat_tactics',
    summary: 'Select your healer, pick the hurt ally, and confirm Heal.',
    beats: [
      {
        id: 'heal_drill_select_healer',
        emotion: 'Worried',
        dialogue: 'Ouch, {lord} got hit! {healer} can fix that. Tap {healer}.',
        mentorEmotion: 'Normal',
        mentorDialogue: 'A clean hit. Never keep fighting wounded, {lord}. Tap {healer}.',
        actionHint: 'Tap {healer}',
        awaitAction: 'battle_select_healer',
        spotlight: { kind: 'battle_tiles', tileFilter: 'healer_unit' },
      },
      {
        id: 'heal_drill_pick_lord',
        emotion: 'Determined',
        dialogue: '{healer} can heal from up to two spaces away. Tap {lord} and {healer} will walk over.',
        mentorEmotion: 'Determined',
        mentorDialogue: '{healer} can mend you from two spaces away. Tap {lord}, and {healer} will move closer.',
        actionHint: 'Tap {lord}',
        awaitAction: 'battle_open_heal_forecast',
        spotlight: { kind: 'battle_tiles', tileFilter: 'lord_unit' },
      },
      {
        id: 'heal_drill_confirm',
        emotion: 'Happy',
        dialogue: 'This shows how much it’ll heal. Healing makes {healer} stronger too! Tap Heal.',
        mentorEmotion: 'Happy',
        mentorDialogue: 'There, you can see how much it will mend. Healing sharpens a healer, too. Tap Heal.',
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
    title: 'Striking From Range 2',
    category: 'combat_tactics',
    summary: 'Physical [E] only counters at Range 1, so Special moves from 2 tiles are safe.',
    beats: [
      {
        id: 'ranged_drill_select_lord',
        emotion: 'Determined',
        dialogue: 'Payback time! Tap {lord}.',
        mentorEmotion: 'Inspired',
        mentorDialogue: 'Now strike back, but wisely. Tap {lord}.',
        actionHint: 'Tap {lord}',
        awaitAction: 'battle_select_lord',
        spotlight: { kind: 'battle_tiles', tileFilter: 'lord_unit' },
      },
      {
        id: 'ranged_drill_step_back',
        emotion: 'Surprised',
        dialogue:
          'That foe can only hit back up close. Attack from two spaces away and it can’t answer! Tap the glowing square.',
        mentorEmotion: 'Normal',
        mentorDialogue:
          'My beak only reaches up close. Strike from two spaces away and I cannot answer. Tap the glowing square.',
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
        emotion: 'Determined',
        dialogue: 'Now tap Attack, then the glowing enemy to see how it’ll go.',
        mentorEmotion: 'Determined',
        mentorDialogue: 'Tap Attack, then target me.',
        actionHint: 'Tap Attack',
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
        dialogue: 'See? It can’t hit back from there. Tap Attack!',
        mentorEmotion: 'Inspired',
        mentorDialogue: 'You see? From there, I cannot answer. Tap Attack!',
        actionHint: 'Tap Attack!',
        awaitAction: 'battle_confirm_attack',
        spotlight: {
          kind: 'dom',
          selector: '[data-testid="forecast-attack-btn"]',
          preferredDock: 'top',
        },
        chips: [
          { kind: 'badge', label: 'No [E] for R2 = No Counter', tone: 'green' },
          { kind: 'badge', label: '+5 Spe = x2', tone: 'gold' },
        ],
      },
    ],
  },
];
