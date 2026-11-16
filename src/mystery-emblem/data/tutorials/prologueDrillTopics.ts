/**
 * Mystery Emblem - Prologue Reactive Coaching Topics (`prologueDrillTopics.ts`)
 *
 * Non-blocking one-liners voiced by Quaquaval during the free-play Hometown Pitch bout:
 * 1. `prologue_heal_drill`: Triggered when an ally first takes damage.
 * 2. `prologue_ranged_counter_drill`: Triggered when the player first opens a Combat Forecast.
 * 3. `prologue_item_cure_drill`: Triggered when {partner} (or an ally) is afflicted with a status.
 */

import type { TutorialTopicDefinition } from './tutorialTypes';

export const PROLOGUE_HEAL_DRILL_TOPIC_ID = 'prologue_heal_drill';
export const PROLOGUE_RANGED_DRILL_TOPIC_ID = 'prologue_ranged_counter_drill';
export const PROLOGUE_ITEM_CURE_DRILL_TOPIC_ID = 'prologue_item_cure_drill';

export const PROLOGUE_DRILL_TUTORIAL_TOPICS: ReadonlyArray<TutorialTopicDefinition> = [
  {
    id: PROLOGUE_HEAL_DRILL_TOPIC_ID,
    title: 'Healing Wounded Allies',
    category: 'combat_tactics',
    summary: 'Select Flabebe to mend wounded teammates from afar and earn EXP.',
    chips: [
      { kind: 'species', speciesId: 'flabebe', label: 'Heal Pulse (R2)' },
      { kind: 'badge', label: 'Heal Grants EXP', tone: 'gold' },
    ],
    bullets: [
      'Select {healer} and tap a wounded teammate within range to preview and cast a healing move.',
      'Support and healing moves earn EXP every time they are used.',
      'Held Oran Berries trigger automatically when HP drops low, while Potions are used manually from Item.',
    ],
    beats: [
      {
        id: 'heal_drill_quip',
        emotion: 'Normal',
        dialogue:
          'Looks like someone took a hit! {healer} can mend wounded teammates from up to two spaces away with Heal Pulse.',
      },
    ],
  },
  {
    id: PROLOGUE_RANGED_DRILL_TOPIC_ID,
    title: 'Combat Forecast, Ranges & [E] Counters',
    category: 'combat_tactics',
    summary: 'Physical vs Special ranges, dual [E] counter slots, and forecast preview rules.',
    chips: [
      { kind: 'badge', label: 'Physical = R1', tone: 'gold' },
      { kind: 'badge', label: 'Special = R2', tone: 'cyan' },
      { kind: 'badge', label: '1 Phys + 1 Spec [E]', tone: 'green' },
    ],
    bullets: [
      'Physical moves strike at Range 1 (adjacent). Special moves strike at Range 2 (two tiles away).',
      'Units carry up to 4 active moves and equip up to one Physical [E] and one Special [E] move to counterattack on Enemy Phase.',
      'Attacking from a range the defender does not have equipped prevents any counterattack.',
      'Elemental weaknesses deal bonus damage, and +5 Speed over the foe grants a x2 follow-up strike.',
    ],
    beats: [
      {
        id: 'ranged_drill_quip',
        emotion: 'Determined',
        dialogue:
          'Check the forecast first! Physical moves hit Range 1, Special moves hit Range 2, and [E] marks counters.',
      },
    ],
  },
  {
    id: PROLOGUE_ITEM_CURE_DRILL_TOPIC_ID,
    title: 'Status Conditions & Remedies',
    category: 'prep_pokemon',
    summary: 'How Paralysis and other status conditions work, and how to cure them with Item.',
    chips: [
      { kind: 'item', itemId: 'paralyze_heal', label: 'Paralyze Heal' },
      { kind: 'badge', label: 'PAR: 1 Mov · -25% Spe', tone: 'gold' },
    ],
    bullets: [
      'Paralysis (PAR) reduces Movement to 1, cuts Speed by 25%, and can cause strikes to fizzle.',
      'Burn (BRN) halves Physical Attack and deals chip damage; Poison (PSN) saps HP; Sleep (SLP) and Freeze (FRZ) skip actions.',
      'Select an afflicted unit, move or tap its own tile to open the command menu, and tap Item to use a status cure.',
    ],
    beats: [
      {
        id: 'item_cure_drill_quip',
        emotion: 'Worried',
        dialogue:
          'Static left {partner} Paralyzed! Select {partner} and choose Item anytime to use that Paralyze Heal.',
      },
    ],
  },
];
