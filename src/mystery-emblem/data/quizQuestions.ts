/**
 * 8-Question Dragon Aura Personality Quiz (`quizQuestions.ts`)
 *
 * Scores the 5 Stage-1 Dragon Lords (`axew`, `bagon`, `gible`, `dratini`, `goomy`)
 * across all 576 answer combinations (`134 / 102 / 133 / 100 / 107`).
 * Chapter recruits are fixed story/paralogue characters rather than quiz-seeded slots.
 */

import type { DragonLordSpeciesId } from './campaignConfig';

export type QuizOptionKey = 'A' | 'B' | 'C';
export type QuizQuestionId = 'q1' | 'q2' | 'q3' | 'q4' | 'q5' | 'q6' | 'q7' | 'q8';

export interface QuizAnswerOption {
  id: QuizOptionKey;
  text: string;
  primaryLord: DragonLordSpeciesId;
  secondaryLord: DragonLordSpeciesId;
}

export interface QuizQuestionDefinition {
  id: QuizQuestionId;
  number: number;
  prompt: string;
  options: ReadonlyArray<QuizAnswerOption>;
}

export const PERSONALITY_QUIZ_QUESTIONS: ReadonlyArray<QuizQuestionDefinition> = [
  {
    id: 'q1',
    number: 1,
    prompt: 'You spot something shiny stuck high in a tree! What do you do?',
    options: [
      {
        id: 'A',
        text: 'Climb right up! I can reach it!',
        primaryLord: 'bagon',
        secondaryLord: 'axew',
      },
      {
        id: 'B',
        text: 'Shake the trunk until it falls!',
        primaryLord: 'gible',
        secondaryLord: 'bagon',
      },
      {
        id: 'C',
        text: 'Find a long stick or a safer way up.',
        primaryLord: 'dratini',
        secondaryLord: 'goomy',
      },
    ],
  },
  {
    id: 'q2',
    number: 2,
    prompt: 'A friend bakes you cookies, but used salt instead of sugar! What do you say?',
    options: [
      {
        id: 'A',
        text: '"Ack! Cough! That\'s pure salt!"',
        primaryLord: 'gible',
        secondaryLord: 'axew',
      },
      {
        id: 'B',
        text: 'Swallow it with a smile to spare their feelings.',
        primaryLord: 'goomy',
        secondaryLord: 'dratini',
      },
      {
        id: 'C',
        text: 'Gulp some water and change the subject.',
        primaryLord: 'dratini',
        secondaryLord: 'goomy',
      },
    ],
  },
  {
    id: 'q3',
    number: 3,
    prompt: "A stubborn jar lid won't budge! What do you do?",
    options: [
      {
        id: 'A',
        text: 'Keep twisting! I refuse to lose to a jar!',
        primaryLord: 'axew',
        secondaryLord: 'gible',
      },
      {
        id: 'B',
        text: 'Tap it on the counter or ask a friend.',
        primaryLord: 'bagon',
        secondaryLord: 'dratini',
      },
    ],
  },
  {
    id: 'q4',
    number: 4,
    prompt: 'A summer downpour catches you without an umbrella! What do you do?',
    options: [
      {
        id: 'A',
        text: 'Sprint home through the puddles!',
        primaryLord: 'gible',
        secondaryLord: 'dratini',
      },
      {
        id: 'B',
        text: 'Duck under an awning and enjoy the rain.',
        primaryLord: 'bagon',
        secondaryLord: 'goomy',
      },
    ],
  },
  {
    id: 'q5',
    number: 5,
    prompt: "Before a big festival competition, everyone's nervous. What do you do?",
    options: [
      {
        id: 'A',
        text: 'Warm up extra hard to set an example!',
        primaryLord: 'bagon',
        secondaryLord: 'axew',
      },
      {
        id: 'B',
        text: 'Crack a joke to get everyone grinning!',
        primaryLord: 'gible',
        secondaryLord: 'dratini',
      },
    ],
  },
  {
    id: 'q6',
    number: 6,
    prompt: 'An overgrown forest trail forks with no signpost. Which way?',
    options: [
      {
        id: 'A',
        text: 'Read the sunlight and moss, then pick the smart route.',
        primaryLord: 'axew',
        secondaryLord: 'dratini',
      },
      {
        id: 'B',
        text: 'Follow the path full of strange wildflowers!',
        primaryLord: 'goomy',
        secondaryLord: 'gible',
      },
    ],
  },
  {
    id: 'q7',
    number: 7,
    prompt: 'Everyone gathers by a crackling campfire. Where are you?',
    options: [
      {
        id: 'A',
        text: 'Passing out cider so nobody feels left out.',
        primaryLord: 'goomy',
        secondaryLord: 'dratini',
      },
      {
        id: 'B',
        text: "Telling the night's most dramatic story!",
        primaryLord: 'axew',
        secondaryLord: 'gible',
      },
    ],
  },
  {
    id: 'q8',
    number: 8,
    prompt: 'On a freezing winter morning, you have 30 more minutes in bed. What do you do?',
    options: [
      {
        id: 'A',
        text: 'Burrow back under the blankets!',
        primaryLord: 'goomy',
        secondaryLord: 'dratini',
      },
      {
        id: 'B',
        text: "Hop up anyway! Don't waste the morning!",
        primaryLord: 'axew',
        secondaryLord: 'bagon',
      },
    ],
  },
];
