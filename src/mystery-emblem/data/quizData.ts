/**
 * Mystery Emblem — Demo Personality Quiz & Dragon Lord Aura Scorer (`quizData.ts`)
 *
 * Implements the 4-question Demo Personality Quiz aligned with the Lore Bible:
 * - 5 Starting Stage-1 Dragon Lords (`axew`, `bagon`, `gible`, `dratini`, `goomy`),
 *   each bound 1-to-1 to Flabébé's flower color (`red`, `orange`, `yellow`, `blue`, `white`)
 *   and aura reveal background gradient.
 * - `Q1` (3 options): Seeds `slot1Flying` (`starly` / `pikipek` / `pidgey`) for Chapter 2 (`Verdant Bluff`).
 * - `Q2` (3 options): Seeds `slot2Psychic` (`abra` / `ralts` / `solosis`) for Chapter 3 (`Cleft Mountain`).
 * - `Q3` (2 options): Seeds `slot3Electric` (`elekid` / `pawmi`) for Chapter 5 (`Berry Orchards`).
 * - `Q4` (2 options): Seeds `slot8Ice` (`vanillish` / `piloswine`) for Chapter 16 (`Ice Kingdom Shore`).
 * - Balanced across all `3 × 3 × 2 × 2 = 36` answer combinations (`6 / 9 / 9 / 7 / 5`)
 *   with deterministic earliest-point tie-breaking.
 */

import type {
  FlabebeFlowerColor,
  QuizRecruitSeeds,
  SeriesFamiliarityLevel,
  TutorialDetailLevel,
  TutorialFamiliarityPreferences,
} from '../types/schemas';
import { getSpeciesById, getStage1SpeciesByCategory } from './index';

export type DragonLordSpeciesId = 'axew' | 'bagon' | 'gible' | 'dratini' | 'goomy';

export interface AuraWavePalette {
  /** Saturated outer top/bottom color (`[R, G, B]`) */
  outerRgb: readonly [number, number, number];
  /** Luminous mid-wave arch crest color (`[R, G, B]`) */
  midRgb: readonly [number, number, number];
  /** Bright glowing center wave core color (`[R, G, B]`) */
  coreRgb: readonly [number, number, number];
}

export const MYSTICAL_QUIZ_WAVE_PALETTE: AuraWavePalette = {
  outerRgb: [86, 26, 172],
  midRgb: [168, 102, 240],
  coreRgb: [248, 242, 255],
};

export interface DragonLordTraitInfo {
  speciesId: DragonLordSpeciesId;
  name: string;
  /** `'a'` or `'an'` for `"With that said, you must be... ${indefiniteArticle} ${name}!"` */
  indefiniteArticle: 'a' | 'an';
  /** Used in `"You appear to be... the ${personalityTitle} type!"` */
  personalityTitle: string;
  traitLabel: string;
  personalityDescription: string;
  auraSummary: string;
  flabebeFlowerColor: FlabebeFlowerColor;
  flabebeFlowerLabel: string;
  revealBackdropCss: string;
  auraWavePalette: AuraWavePalette;
  accentBorderColor: string;
}

export const DEFAULT_QUIZ_BACKDROP_CSS =
  'radial-gradient(circle at 50% 50%, rgba(168, 102, 240, 0.95), rgba(86, 26, 172, 0.99))';

export const DRAGON_LORD_OPTIONS: ReadonlyArray<DragonLordTraitInfo> = [
  {
    speciesId: 'axew',
    name: 'Axew',
    indefiniteArticle: 'an',
    personalityTitle: 'Brave',
    traitLabel: 'Brave & Steadfast',
    personalityDescription:
      'Have you noticed how you always step forward first when someone is in trouble? Even when the odds look overwhelming, you refuse to let a single friend face danger alone. Your earnest courage lights a fire in everyone standing beside you!',
    auraSummary: 'Steadfast vanguard whose crimson aura resonates with Red-Flower Flabébé.',
    flabebeFlowerColor: 'red',
    flabebeFlowerLabel: 'Red Aura',
    revealBackdropCss:
      'radial-gradient(circle at 50% 26%, rgba(196, 38, 52, 0.94), rgba(44, 8, 16, 0.98))',
    auraWavePalette: {
      outerRgb: [236, 4, 16],
      midRgb: [248, 112, 124],
      coreRgb: [255, 244, 246],
    },
    accentBorderColor: '#ff6878',
  },
  {
    speciesId: 'bagon',
    name: 'Bagon',
    indefiniteArticle: 'a',
    personalityTitle: 'Hardy',
    traitLabel: 'Hardy & Determined',
    personalityDescription:
      'Has anyone ever told you how unstoppable you become once your mind is made up? Setbacks that would discourage anyone else only make your resolve burn brighter. Eyes fixed on the horizon, you turn every hard trial into the strength to soar!',
    auraSummary: 'Relentless trailblazer whose amber aura resonates with Orange-Flower Flabébé.',
    flabebeFlowerColor: 'orange',
    flabebeFlowerLabel: 'Orange Aura',
    revealBackdropCss:
      'radial-gradient(circle at 50% 26%, rgba(216, 102, 24, 0.94), rgba(48, 18, 6, 0.98))',
    auraWavePalette: {
      outerRgb: [234, 90, 8],
      midRgb: [252, 168, 84],
      coreRgb: [255, 248, 238],
    },
    accentBorderColor: '#ffa048',
  },
  {
    speciesId: 'gible',
    name: 'Gible',
    indefiniteArticle: 'a',
    personalityTitle: 'Bold',
    traitLabel: 'Bold & Spirited',
    personalityDescription:
      'Has anyone ever mentioned that fearless grin you wear right when things look toughest? You charge headfirst into the unknown with boundless spark and zero hesitation. When tension freezes the room, your bold spirit shatters the doubt in an instant!',
    auraSummary: 'Hard-hitting frontliner whose golden aura resonates with Yellow-Flower Flabébé.',
    flabebeFlowerColor: 'yellow',
    flabebeFlowerLabel: 'Yellow Aura',
    revealBackdropCss:
      'radial-gradient(circle at 50% 26%, rgba(198, 164, 24, 0.94), rgba(46, 34, 6, 0.98))',
    auraWavePalette: {
      outerRgb: [218, 164, 6],
      midRgb: [250, 218, 86],
      coreRgb: [255, 253, 236],
    },
    accentBorderColor: '#f8dc48',
  },
  {
    speciesId: 'dratini',
    name: 'Dratini',
    indefiniteArticle: 'a',
    personalityTitle: 'Calm',
    traitLabel: 'Calm & Perceptive',
    personalityDescription:
      'Has anyone ever told you how relaxed you look in the face of fear? Even when dark clouds gather and everyone else begins to panic, your composed heart never wavers. You listen closely, notice what others miss, and quietly steady every ally at your side!',
    auraSummary: 'Serene tactician whose azure aura resonates with Blue-Flower Flabébé.',
    flabebeFlowerColor: 'blue',
    flabebeFlowerLabel: 'Blue Aura',
    revealBackdropCss:
      'radial-gradient(circle at 50% 26%, rgba(36, 112, 214, 0.94), rgba(8, 20, 52, 0.98))',
    auraWavePalette: {
      outerRgb: [12, 102, 228],
      midRgb: [98, 180, 252],
      coreRgb: [242, 250, 255],
    },
    accentBorderColor: '#58c8ff',
  },
  {
    speciesId: 'goomy',
    name: 'Goomy',
    indefiniteArticle: 'a',
    personalityTitle: 'Gentle',
    traitLabel: 'Gentle & Resilient',
    personalityDescription:
      'Has anyone ever told you how comforting it feels just to have you nearby? You treasure the bonds between friends above all else and meet a harsh world with genuine warmth. Yet beneath that gentle kindness lies a quiet resilience nothing can break!',
    auraSummary: 'Warm-hearted guardian whose luminous aura resonates with White-Flower Flabébé.',
    flabebeFlowerColor: 'white',
    flabebeFlowerLabel: 'White Aura',
    revealBackdropCss:
      'radial-gradient(circle at 50% 26%, rgba(182, 196, 220, 0.92), rgba(28, 36, 54, 0.98))',
    auraWavePalette: {
      outerRgb: [142, 160, 194],
      midRgb: [208, 220, 240],
      coreRgb: [255, 255, 255],
    },
    accentBorderColor: '#f0f4ff',
  },
];

export type QuizSeedKey = 'slot1Flying' | 'slot2Psychic' | 'slot3Electric' | 'slot8Ice';
export type QuizOptionKey = 'A' | 'B' | 'C' | 'D' | 'E';

export interface QuizAnswerOption {
  id: QuizOptionKey;
  text: string;
  primaryLord: DragonLordSpeciesId;
  secondaryLord: DragonLordSpeciesId;
  recruitSpeciesIds: ReadonlyArray<string>;
  recruitLabel: string;
}

export interface QuizQuestionDefinition {
  id: 'q1' | 'q2' | 'q3' | 'q4';
  number: number;
  seedKey: QuizSeedKey | null;
  chapterSlotTitle: string;
  prompt: string;
  options: ReadonlyArray<QuizAnswerOption>;
}

export const PERSONALITY_QUIZ_QUESTIONS: ReadonlyArray<QuizQuestionDefinition> = [
  {
    id: 'q1',
    number: 1,
    seedKey: 'slot1Flying',
    chapterSlotTitle: 'Verdant Bluff Wing Scout',
    prompt:
      "You're out on a walk when you spot something shiny stuck high up in the branches of a tree! What do you do?",
    options: [
      {
        id: 'A',
        text: 'Start climbing right away! I can reach it!',
        primaryLord: 'bagon',
        secondaryLord: 'axew',
        recruitSpeciesIds: ['starly'],
        recruitLabel: 'Starly',
      },
      {
        id: 'B',
        text: 'Shake the trunk with all my might until it falls!',
        primaryLord: 'gible',
        secondaryLord: 'bagon',
        recruitSpeciesIds: ['pikipek'],
        recruitLabel: 'Pikipek',
      },
      {
        id: 'C',
        text: 'Look around for a long stick or a safer way up.',
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
      'Your friend proudly bakes a batch of cookies for you, but when you take a bite, they used salt instead of sugar! What do you say?',
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
        text: "Swallow it with a big smile so I don't hurt their feelings.",
        primaryLord: 'goomy',
        secondaryLord: 'dratini',
        recruitSpeciesIds: ['ralts'],
        recruitLabel: 'Ralts',
      },
      {
        id: 'C',
        text: 'Quietly reach for a huge glass of water and change the subject.',
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
    prompt: "You're trying to open a stubborn jar lid, and it just won't budge! What do you do?",
    options: [
      {
        id: 'A',
        text: "Keep twisting with everything I've got! I refuse to lose to a jar!",
        primaryLord: 'axew',
        secondaryLord: 'gible',
        recruitSpeciesIds: ['elekid'],
        recruitLabel: 'Elekid',
      },
      {
        id: 'B',
        text: 'Tap the rim on the counter or hand it to a friend to try.',
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
    seedKey: 'slot8Ice',
    chapterSlotTitle: 'Ice Kingdom Specialist',
    prompt:
      'You wake up on a freezing winter morning and realize you still have thirty minutes before you have to get up. What do you do?',
    options: [
      {
        id: 'A',
        text: 'Burrow right back under the blankets and stay cozy!',
        primaryLord: 'goomy',
        secondaryLord: 'bagon',
        recruitSpeciesIds: ['vanillish'],
        recruitLabel: 'Vanillish',
      },
      {
        id: 'B',
        text: 'Hop out of bed anyway! No sense wasting the morning!',
        primaryLord: 'axew',
        secondaryLord: 'gible',
        recruitSpeciesIds: ['piloswine'],
        recruitLabel: 'Piloswine',
      },
    ],
  },
];

export function getStarterPartnerOptions() {
  return getStage1SpeciesByCategory('starter_partner');
}

export interface FamiliarityQuizOption {
  id: 'A' | 'B' | 'C';
  text: string;
  familiarity: SeriesFamiliarityLevel;
  tutorialDetail: TutorialDetailLevel;
}

export interface FamiliarityQuizQuestionDefinition {
  id: 'pokemon_familiarity' | 'fire_emblem_familiarity';
  subject: 'pokemon' | 'fire_emblem';
  prompt: string;
  options: ReadonlyArray<FamiliarityQuizOption>;
}

export const FAMILIARITY_QUIZ_QUESTIONS: ReadonlyArray<FamiliarityQuizQuestionDefinition> = [
  {
    id: 'pokemon_familiarity',
    subject: 'pokemon',
    prompt: 'How familiar are you with Pokémon?',
    options: [
      {
        id: 'A',
        text: 'Very familiar',
        familiarity: 'very_familiar',
        tutorialDetail: 'none',
      },
      {
        id: 'B',
        text: 'Somewhat familiar',
        familiarity: 'somewhat_familiar',
        tutorialDetail: 'brief',
      },
      {
        id: 'C',
        text: 'I only know Pikachu 💀',
        familiarity: 'beginner',
        tutorialDetail: 'detailed',
      },
    ],
  },
  {
    id: 'fire_emblem_familiarity',
    subject: 'fire_emblem',
    prompt: 'How familiar are you with Fire Emblem?',
    options: [
      {
        id: 'A',
        text: 'Very familiar',
        familiarity: 'very_familiar',
        tutorialDetail: 'none',
      },
      {
        id: 'B',
        text: 'Somewhat familiar',
        familiarity: 'somewhat_familiar',
        tutorialDetail: 'brief',
      },
      {
        id: 'C',
        text: "That's the name of that blue-haired guy from Smash, right?",
        familiarity: 'beginner',
        tutorialDetail: 'detailed',
      },
    ],
  },
];

export function resolveTutorialDetailLevel(
  familiarity: SeriesFamiliarityLevel
): TutorialDetailLevel {
  switch (familiarity) {
    case 'very_familiar':
      return 'none';
    case 'somewhat_familiar':
      return 'brief';
    case 'beginner':
      return 'detailed';
  }
}

export function buildTutorialFamiliarityPreferences(
  pokemonFamiliarity: SeriesFamiliarityLevel = 'somewhat_familiar',
  fireEmblemFamiliarity: SeriesFamiliarityLevel = 'somewhat_familiar'
): TutorialFamiliarityPreferences {
  return {
    pokemonFamiliarity,
    fireEmblemFamiliarity,
    pokemonTutorialDetail: resolveTutorialDetailLevel(pokemonFamiliarity),
    fireEmblemTutorialDetail: resolveTutorialDetailLevel(fireEmblemFamiliarity),
  };
}

export function getDragonLordTraitInfo(speciesId: string): DragonLordTraitInfo {
  return (
    DRAGON_LORD_OPTIONS.find((d) => d.speciesId === speciesId) ??
    DRAGON_LORD_OPTIONS[0]!
  );
}

export interface QuizEvaluationResult {
  assignedLordSpeciesId: DragonLordSpeciesId;
  scoresByDragonId: Record<DragonLordSpeciesId, number>;
  firstPointOrderByDragonId: Record<DragonLordSpeciesId, number>;
  quizSeeds: QuizRecruitSeeds;
  q1HealerSpeciesId: string;
}

export function evaluatePersonalityQuiz(
  answersInput:
    | Partial<Record<QuizQuestionDefinition['id'], string>>
    | ReadonlyArray<string>
): QuizEvaluationResult {
  const scores: Record<DragonLordSpeciesId, number> = {
    axew: 0,
    bagon: 0,
    gible: 0,
    dratini: 0,
    goomy: 0,
  };

  const firstOrder: Record<DragonLordSpeciesId, number> = {
    axew: Number.POSITIVE_INFINITY,
    bagon: Number.POSITIVE_INFINITY,
    gible: Number.POSITIVE_INFINITY,
    dratini: Number.POSITIVE_INFINITY,
    goomy: Number.POSITIVE_INFINITY,
  };

  const seeds: QuizRecruitSeeds = {
    slot1Flying: ['pidgey'],
    slot2Psychic: ['ralts'],
    slot3Electric: ['elekid'],
    slot8Ice: ['vanillish'],
    q1Healer: ['flabebe'],
    q2BugFlying: ['pidgey', 'sewaddle'],
    q3GhostPsychic: ['ralts'],
    q4Electric: ['elekid'],
    q5FrontlineTrio: ['machop', 'geodude', 'trapinch'],
    q6WaterGrass: ['poliwag', 'bellsprout'],
    q7Fire: ['litwick'],
    q8SteelFairy: ['tinkatink', 'cleffa'],
    q9IceArmored: ['vanillish'],
  };

  let awardStep = 0;
  for (let idx = 0; idx < PERSONALITY_QUIZ_QUESTIONS.length; idx++) {
    const q = PERSONALITY_QUIZ_QUESTIONS[idx]!;
    const chosenId = Array.isArray(answersInput)
      ? answersInput[idx]
      : (answersInput as Partial<Record<QuizQuestionDefinition['id'], string>>)[q.id];
    const chosen = q.options.find((o) => o.id === chosenId) ?? q.options[0]!;

    awardStep += 1;
    scores[chosen.primaryLord] += 2;
    if (!Number.isFinite(firstOrder[chosen.primaryLord])) {
      firstOrder[chosen.primaryLord] = awardStep;
    }

    awardStep += 1;
    scores[chosen.secondaryLord] += 1;
    if (!Number.isFinite(firstOrder[chosen.secondaryLord])) {
      firstOrder[chosen.secondaryLord] = awardStep;
    }

    if (q.seedKey) {
      const validIds = chosen.recruitSpeciesIds.filter((id) => Boolean(getSpeciesById(id)));
      if (validIds.length > 0) {
        seeds[q.seedKey] = [...validIds];
      }
    }
  }

  // Mirror Demo slot picks into legacy seed arrays for compatibility
  seeds.q2BugFlying = [...(seeds.slot1Flying ?? ['pidgey']), 'sewaddle'];
  seeds.q3GhostPsychic = [...(seeds.slot2Psychic ?? ['ralts'])];
  seeds.q4Electric = [...(seeds.slot3Electric ?? ['elekid'])];
  seeds.q9IceArmored = [...(seeds.slot8Ice ?? ['vanillish'])];

  let bestLord: DragonLordSpeciesId = 'axew';
  let bestScore = -1;
  let bestFirstStep = Number.POSITIVE_INFINITY;

  for (const d of DRAGON_LORD_OPTIONS) {
    const sc = scores[d.speciesId];
    const first = firstOrder[d.speciesId];
    if (sc > bestScore || (sc === bestScore && first < bestFirstStep)) {
      bestLord = d.speciesId;
      bestScore = sc;
      bestFirstStep = first;
    }
  }

  return {
    assignedLordSpeciesId: bestLord,
    scoresByDragonId: scores,
    firstPointOrderByDragonId: firstOrder,
    quizSeeds: seeds,
    q1HealerSpeciesId: 'flabebe',
  };
}
