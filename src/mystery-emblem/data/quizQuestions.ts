/**
 * 8-Question Lore-Bible Dragon Aura Personality Quiz (`quizQuestions.ts`)
 *
 * Simultaneously scores the 5 Stage-1 Dragon Lords (`axew`, `bagon`, `gible`, `dratini`, `goomy`)
 * across all 576 combinations (`134 / 102 / 133 / 100 / 107`) and seeds all 8 campaign slots:
 * - Q1 -> `slot1Flying`   (Ch. 1: Starly / Pikipek / Pidgey)
 * - Q2 -> `slot2Psychic`  (Ch. 2: Abra / Ralts / Solosis)
 * - Q3 -> `slot3Electric` (Ch. 4: Elekid / Pawmi)
 * - Q4 -> `slot4Rock`     (Ch. 7: Geodude / Roggenrola)
 * - Q5 -> `slot5Fire`     (Ch. 10: Combusken / Monferno)
 * - Q6 -> `slot6Grass`    (Ch. 13: Gloom / Weepinbell)
 * - Q7 -> `slot7Fairy`    (Ch. 14: Clefairy / Jigglypuff)
 * - Q8 -> `slot8Ice`      (Ch. 16: Vanillish / Piloswine)
 */

import type { DragonLordSpeciesId } from './campaignConfig';
import type { QuizSeedSlotKey } from '../types/schemas';

export type QuizSeedKey = QuizSeedSlotKey;
export type QuizOptionKey = 'A' | 'B' | 'C';
export type QuizQuestionId = 'q1' | 'q2' | 'q3' | 'q4' | 'q5' | 'q6' | 'q7' | 'q8';

export interface QuizAnswerOption {
  id: QuizOptionKey;
  text: string;
  primaryLord: DragonLordSpeciesId;
  secondaryLord: DragonLordSpeciesId;
  recruitSpeciesIds: ReadonlyArray<string>;
  recruitLabel: string;
}

export interface QuizQuestionDefinition {
  id: QuizQuestionId;
  number: number;
  seedKey: QuizSeedSlotKey;
  chapterSlotTitle: string;
  prompt: string;
  options: ReadonlyArray<QuizAnswerOption>;
}

export const PERSONALITY_QUIZ_QUESTIONS: ReadonlyArray<QuizQuestionDefinition> = [
  {
    id: 'q1',
    number: 1,
    seedKey: 'slot1Flying',
    chapterSlotTitle: 'Capital Road Wing Scout',
    prompt:
      'You spot something shiny stuck high in a tree! What do you do?',
    options: [
      {
        id: 'A',
        text: 'Climb right up! I can reach it!',
        primaryLord: 'bagon',
        secondaryLord: 'axew',
        recruitSpeciesIds: ['starly'],
        recruitLabel: 'Starly',
      },
      {
        id: 'B',
        text: 'Shake the trunk until it falls!',
        primaryLord: 'gible',
        secondaryLord: 'bagon',
        recruitSpeciesIds: ['pikipek'],
        recruitLabel: 'Pikipek',
      },
      {
        id: 'C',
        text: 'Find a long stick or a safer way up.',
        primaryLord: 'dratini',
        secondaryLord: 'goomy',
        recruitSpeciesIds: ['pidgey'],
        recruitLabel: 'Pidgey',
      },
    ],
  },
  {
    id: 'q2',
    number: 2,
    seedKey: 'slot2Psychic',
    chapterSlotTitle: 'Cleft Mountain Mystic',
    prompt:
      'A friend bakes you cookies, but used salt instead of sugar! What do you say?',
    options: [
      {
        id: 'A',
        text: '"Ack! Cough! That\'s pure salt!"',
        primaryLord: 'gible',
        secondaryLord: 'axew',
        recruitSpeciesIds: ['abra'],
        recruitLabel: 'Abra',
      },
      {
        id: 'B',
        text: 'Swallow it with a smile to spare their feelings.',
        primaryLord: 'goomy',
        secondaryLord: 'dratini',
        recruitSpeciesIds: ['ralts'],
        recruitLabel: 'Ralts',
      },
      {
        id: 'C',
        text: 'Gulp some water and change the subject.',
        primaryLord: 'dratini',
        secondaryLord: 'goomy',
        recruitSpeciesIds: ['solosis'],
        recruitLabel: 'Solosis',
      },
    ],
  },
  {
    id: 'q3',
    number: 3,
    seedKey: 'slot3Electric',
    chapterSlotTitle: 'Berry Orchards Vanguard',
    prompt: "A stubborn jar lid won't budge! What do you do?",
    options: [
      {
        id: 'A',
        text: "Keep twisting! I refuse to lose to a jar!",
        primaryLord: 'axew',
        secondaryLord: 'gible',
        recruitSpeciesIds: ['elekid'],
        recruitLabel: 'Elekid',
      },
      {
        id: 'B',
        text: 'Tap it on the counter or ask a friend.',
        primaryLord: 'bagon',
        secondaryLord: 'dratini',
        recruitSpeciesIds: ['pawmi'],
        recruitLabel: 'Pawmi',
      },
    ],
  },
  {
    id: 'q4',
    number: 4,
    seedKey: 'slot4Rock',
    chapterSlotTitle: 'Desert Oasis Bulwark',
    prompt: 'A summer downpour catches you without an umbrella! What do you do?',
    options: [
      {
        id: 'A',
        text: 'Sprint home through the puddles!',
        primaryLord: 'gible',
        secondaryLord: 'dratini',
        recruitSpeciesIds: ['geodude'],
        recruitLabel: 'Geodude',
      },
      {
        id: 'B',
        text: 'Duck under an awning and enjoy the rain.',
        primaryLord: 'bagon',
        secondaryLord: 'goomy',
        recruitSpeciesIds: ['roggenrola'],
        recruitLabel: 'Roggenrola',
      },
    ],
  },
  {
    id: 'q5',
    number: 5,
    seedKey: 'slot5Fire',
    chapterSlotTitle: 'Volcanic Pass Striker',
    prompt: "Before a big festival competition, everyone's nervous. What do you do?",
    options: [
      {
        id: 'A',
        text: 'Warm up extra hard to set an example!',
        primaryLord: 'bagon',
        secondaryLord: 'axew',
        recruitSpeciesIds: ['combusken'],
        recruitLabel: 'Combusken',
      },
      {
        id: 'B',
        text: 'Crack a joke to get everyone grinning!',
        primaryLord: 'gible',
        secondaryLord: 'dratini',
        recruitSpeciesIds: ['monferno'],
        recruitLabel: 'Monferno',
      },
    ],
  },
  {
    id: 'q6',
    number: 6,
    seedKey: 'slot6Grass',
    chapterSlotTitle: 'Ruined Citadel Botanist',
    prompt: 'An overgrown forest trail forks with no signpost. Which way?',
    options: [
      {
        id: 'A',
        text: 'Read the sunlight and moss, then pick the smart route.',
        primaryLord: 'axew',
        secondaryLord: 'dratini',
        recruitSpeciesIds: ['gloom'],
        recruitLabel: 'Gloom',
      },
      {
        id: 'B',
        text: 'Follow the path full of strange wildflowers!',
        primaryLord: 'goomy',
        secondaryLord: 'gible',
        recruitSpeciesIds: ['weepinbell'],
        recruitLabel: 'Weepinbell',
      },
    ],
  },
  {
    id: 'q7',
    number: 7,
    seedKey: 'slot7Fairy',
    chapterSlotTitle: 'Sunken Foundry Chorister',
    prompt: 'Everyone gathers by a crackling campfire. Where are you?',
    options: [
      {
        id: 'A',
        text: 'Passing out cider so nobody feels left out.',
        primaryLord: 'goomy',
        secondaryLord: 'dratini',
        recruitSpeciesIds: ['clefairy'],
        recruitLabel: 'Clefairy',
      },
      {
        id: 'B',
        text: "Telling the night's most dramatic story!",
        primaryLord: 'axew',
        secondaryLord: 'gible',
        recruitSpeciesIds: ['jigglypuff'],
        recruitLabel: 'Jigglypuff',
      },
    ],
  },
  {
    id: 'q8',
    number: 8,
    seedKey: 'slot8Ice',
    chapterSlotTitle: 'Ice Kingdom Specialist',
    prompt:
      'On a freezing winter morning, you have 30 more minutes in bed. What do you do?',
    options: [
      {
        id: 'A',
        text: 'Burrow back under the blankets!',
        primaryLord: 'goomy',
        secondaryLord: 'dratini',
        recruitSpeciesIds: ['vanillish'],
        recruitLabel: 'Vanillish',
      },
      {
        id: 'B',
        text: "Hop up anyway! Don't waste the morning!",
        primaryLord: 'axew',
        secondaryLord: 'bagon',
        recruitSpeciesIds: ['piloswine'],
        recruitLabel: 'Piloswine',
      },
    ],
  },
];
