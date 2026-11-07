/**
 * Mystery Emblem — Personality Quiz, Dragon Lord Trait Scorer & NG+ Seed Registry (`quizData.ts`)
 *
 * Implements GDD Section 1.1:
 * - 8 Stage-1 Dragon Lords (`dratini`, `bagon`, `gible`, `deino`, `goomy`, `jangmo_o`, `dreepy`, `frigibax`)
 * - 9 Personality Questions (`Q1` = 6 choices seeding Prologue Healer; `Q2`–`Q9` = 3 choices each,
 *   where each of the 8 Dragon Lords appears 3× as primary `+2` and 3× as secondary `+1`)
 * - Deterministic earliest-point tie-breaker when 2+ Dragon Lords tie for top score
 */

import type { QuizRecruitSeeds } from '../types/schemas';
import { getSpeciesById, getStage1SpeciesByCategory } from './index';

export type DragonLordSpeciesId =
  | 'dratini'
  | 'bagon'
  | 'gible'
  | 'deino'
  | 'goomy'
  | 'jangmo_o'
  | 'dreepy'
  | 'frigibax';

export interface DragonLordTraitInfo {
  speciesId: DragonLordSpeciesId;
  name: string;
  traitLabel: string;
  auraSummary: string;
}

export const DRAGON_LORD_OPTIONS: ReadonlyArray<DragonLordTraitInfo> = [
  {
    speciesId: 'dratini',
    name: 'Dratini',
    traitLabel: 'Mystic & Gentle',
    auraSummary: 'Serene leader whose Dragon Aura steadies allies.',
  },
  {
    speciesId: 'bagon',
    name: 'Bagon',
    traitLabel: 'Bold & Determined',
    auraSummary: 'Fearless vanguard who rallies every ally forward.',
  },
  {
    speciesId: 'gible',
    name: 'Gible',
    traitLabel: 'Fierce & Impulsive',
    auraSummary: 'Hard-hitting frontliner who shatters enemy lines.',
  },
  {
    speciesId: 'deino',
    name: 'Deino',
    traitLabel: 'Tenacious & Relentless',
    auraSummary: 'Unbreakable resolve that presses until victory.',
  },
  {
    speciesId: 'goomy',
    name: 'Goomy',
    traitLabel: 'Kind & Resilient',
    auraSummary: 'Warm-hearted guardian built to endure tough trials.',
  },
  {
    speciesId: 'jangmo_o',
    name: 'Jangmo-o',
    traitLabel: 'Honorable & Disciplined',
    auraSummary: 'Disciplined commander who holds tight formations.',
  },
  {
    speciesId: 'dreepy',
    name: 'Dreepy',
    traitLabel: 'Clever & Swift',
    auraSummary: 'Swift strategist who outsmarts traps at speed.',
  },
  {
    speciesId: 'frigibax',
    name: 'Frigibax',
    traitLabel: 'Stoic & Composed',
    auraSummary: 'Cool-headed tactician who reads every turn ahead.',
  },
];

export type QuizSeedKey = keyof QuizRecruitSeeds;
export type QuizOptionKey = 'A' | 'B' | 'C' | 'D' | 'E' | 'F';

export interface QuizAnswerOption {
  id: QuizOptionKey;
  text: string;
  primaryLord: DragonLordSpeciesId;
  secondaryLord: DragonLordSpeciesId;
  recruitSpeciesIds: ReadonlyArray<string>;
  recruitLabel: string;
}

export interface QuizQuestionDefinition {
  id: 'q1' | 'q2' | 'q3' | 'q4' | 'q5' | 'q6' | 'q7' | 'q8' | 'q9';
  number: number;
  seedKey: QuizSeedKey;
  chapterSlotTitle: string;
  prompt: string;
  options: ReadonlyArray<QuizAnswerOption>;
}

export const PERSONALITY_QUIZ_QUESTIONS: ReadonlyArray<QuizQuestionDefinition> = [
  {
    id: 'q1',
    number: 1,
    seedKey: 'q1Healer',
    chapterSlotTitle: 'Beach Cave Healer',
    prompt: 'An exhausted traveler stumbles into town after a storm. How do you help?',
    options: [
      {
        id: 'A',
        text: 'Bring a warm meal and a soft blanket right away.',
        primaryLord: 'goomy',
        secondaryLord: 'dratini',
        recruitSpeciesIds: ['happiny'],
        recruitLabel: 'Happiny',
      },
      {
        id: 'B',
        text: 'Gather soothing herbs and flowers to calm them.',
        primaryLord: 'dratini',
        secondaryLord: 'dreepy',
        recruitSpeciesIds: ['flabebe'],
        recruitLabel: 'Flabébé',
      },
      {
        id: 'C',
        text: 'Cheer them up with a bright, lively smile!',
        primaryLord: 'bagon',
        secondaryLord: 'gible',
        recruitSpeciesIds: ['bounsweet'],
        recruitLabel: 'Bounsweet',
      },
      {
        id: 'D',
        text: 'Lead them somewhere quiet to rest in peace.',
        primaryLord: 'frigibax',
        secondaryLord: 'deino',
        recruitSpeciesIds: ['hatenna'],
        recruitLabel: 'Hatenna',
      },
      {
        id: 'E',
        text: 'Check their supplies and share your own rations.',
        primaryLord: 'jangmo_o',
        secondaryLord: 'goomy',
        recruitSpeciesIds: ['smoliv'],
        recruitLabel: 'Smoliv',
      },
      {
        id: 'F',
        text: 'Share an uplifting story to restore their hope.',
        primaryLord: 'dreepy',
        secondaryLord: 'bagon',
        recruitSpeciesIds: ['togepi'],
        recruitLabel: 'Togepi',
      },
    ],
  },
  {
    id: 'q2',
    number: 2,
    seedKey: 'q2BugFlying',
    chapterSlotTitle: 'Drenched Bluff Duo',
    prompt: 'The coastal trail splits into three routes. Which path do you take?',
    options: [
      {
        id: 'A',
        text: 'The sunlit road with a clear view of the horizon.',
        primaryLord: 'bagon',
        secondaryLord: 'jangmo_o',
        recruitSpeciesIds: ['caterpie', 'pidgey'],
        recruitLabel: 'Caterpie & Pidgey',
      },
      {
        id: 'B',
        text: 'The shaded forest path beneath tall canopy trees.',
        primaryLord: 'goomy',
        secondaryLord: 'dratini',
        recruitSpeciesIds: ['sewaddle', 'pidove'],
        recruitLabel: 'Sewaddle & Pidove',
      },
      {
        id: 'C',
        text: 'The steep rocky shortcut straight up the cliffs.',
        primaryLord: 'gible',
        secondaryLord: 'deino',
        recruitSpeciesIds: ['grubbin', 'pikipek'],
        recruitLabel: 'Grubbin & Pikipek',
      },
    ],
  },
  {
    id: 'q3',
    number: 3,
    seedKey: 'q3GhostPsychic',
    chapterSlotTitle: 'Mt. Bristle Duo',
    prompt: 'Eerie footsteps echo behind a sealed ruin door at dusk. Your instinct?',
    options: [
      {
        id: 'A',
        text: 'Inspect the runes to outsmart whatever is inside.',
        primaryLord: 'dreepy',
        secondaryLord: 'frigibax',
        recruitSpeciesIds: ['duskull', 'abra'],
        recruitLabel: 'Duskull & Abra',
      },
      {
        id: 'B',
        text: 'Call out kindly—someone inside may need help.',
        primaryLord: 'dratini',
        secondaryLord: 'goomy',
        recruitSpeciesIds: ['duskull', 'ralts'],
        recruitLabel: 'Duskull & Ralts',
      },
      {
        id: 'C',
        text: 'Hold your ground calmly until it reveals itself.',
        primaryLord: 'frigibax',
        secondaryLord: 'jangmo_o',
        recruitSpeciesIds: ['duskull', 'solosis'],
        recruitLabel: 'Duskull & Solosis',
      },
    ],
  },
  {
    id: 'q4',
    number: 4,
    seedKey: 'q4Electric',
    chapterSlotTitle: 'Apple Woods Tracker',
    prompt: 'Enemy scouts spot your camp from the treetops! How do you react?',
    options: [
      {
        id: 'A',
        text: 'Dash in fast before they can sound the alarm!',
        primaryLord: 'dreepy',
        secondaryLord: 'bagon',
        recruitSpeciesIds: ['pichu'],
        recruitLabel: 'Pichu',
      },
      {
        id: 'B',
        text: 'Charge straight at their leader to break their nerve!',
        primaryLord: 'gible',
        secondaryLord: 'deino',
        recruitSpeciesIds: ['shinx'],
        recruitLabel: 'Shinx',
      },
      {
        id: 'C',
        text: 'Coordinate your squad to cut off their escape.',
        primaryLord: 'jangmo_o',
        secondaryLord: 'frigibax',
        recruitSpeciesIds: ['mareep'],
        recruitLabel: 'Mareep',
      },
    ],
  },
  {
    id: 'q5',
    number: 5,
    seedKey: 'q5FrontlineTrio',
    chapterSlotTitle: 'Frontline Trio',
    prompt: 'An armored column marches down a narrow pass. Your frontline plan?',
    options: [
      {
        id: 'A',
        text: 'Adapt to terrain and strike from shifting angles.',
        primaryLord: 'jangmo_o',
        secondaryLord: 'dreepy',
        recruitSpeciesIds: ['machop', 'geodude', 'trapinch'],
        recruitLabel: 'Machop, Geodude & Trapinch',
      },
      {
        id: 'B',
        text: 'Hold an unbreakable wall of stone and grit.',
        primaryLord: 'deino',
        secondaryLord: 'frigibax',
        recruitSpeciesIds: ['machop', 'roggenrola', 'rhyhorn'],
        recruitLabel: 'Machop, Roggenrola & Rhyhorn',
      },
      {
        id: 'C',
        text: 'Launch an all-out charge before they brace.',
        primaryLord: 'gible',
        secondaryLord: 'bagon',
        recruitSpeciesIds: ['mankey', 'nacli', 'rhyhorn'],
        recruitLabel: 'Mankey, Nacli & Rhyhorn',
      },
    ],
  },
  {
    id: 'q6',
    number: 6,
    seedKey: 'q6WaterGrass',
    chapterSlotTitle: 'Water & Grass Duo',
    prompt: 'Making camp beside a quiet forest pond at night, how do you unwind?',
    options: [
      {
        id: 'A',
        text: 'Run light combat drills to stay sharp for dawn.',
        primaryLord: 'bagon',
        secondaryLord: 'jangmo_o',
        recruitSpeciesIds: ['poliwag', 'bellsprout'],
        recruitLabel: 'Poliwag & Bellsprout',
      },
      {
        id: 'B',
        text: 'Listen to the rain and keep everyone smiling.',
        primaryLord: 'goomy',
        secondaryLord: 'dreepy',
        recruitSpeciesIds: ['lotad', 'oddish'],
        recruitLabel: 'Lotad & Oddish',
      },
      {
        id: 'C',
        text: 'Stand quiet perimeter watch while allies sleep.',
        primaryLord: 'deino',
        secondaryLord: 'dratini',
        recruitSpeciesIds: ['tympole', 'budew'],
        recruitLabel: 'Tympole & Budew',
      },
    ],
  },
  {
    id: 'q7',
    number: 7,
    seedKey: 'q7Fire',
    chapterSlotTitle: 'Fire Attacker',
    prompt: 'A river of magma blocks the cavern bridge ahead. What drives you onward?',
    options: [
      {
        id: 'A',
        text: 'Pure fiery grit—no obstacle stops me!',
        primaryLord: 'gible',
        secondaryLord: 'deino',
        recruitSpeciesIds: ['magby'],
        recruitLabel: 'Magby',
      },
      {
        id: 'B',
        text: 'The thrill of soaring across danger.',
        primaryLord: 'bagon',
        secondaryLord: 'dreepy',
        recruitSpeciesIds: ['fletchling'],
        recruitLabel: 'Fletchling',
      },
      {
        id: 'C',
        text: 'Quiet resolve to uncover the hidden truth.',
        primaryLord: 'dratini',
        secondaryLord: 'frigibax',
        recruitSpeciesIds: ['litwick'],
        recruitLabel: 'Litwick',
      },
    ],
  },
  {
    id: 'q8',
    number: 8,
    seedKey: 'q8SteelFairy',
    chapterSlotTitle: 'Steel & Fairy Duo',
    prompt: 'You uncover a half-buried chest in the desert sands. What do you hope is inside?',
    options: [
      {
        id: 'A',
        text: 'A heavy weapon built to smash enemy armor!',
        primaryLord: 'deino',
        secondaryLord: 'gible',
        recruitSpeciesIds: ['tinkatink', 'cleffa'],
        recruitLabel: 'Tinkatink & Cleffa',
      },
      {
        id: 'B',
        text: 'Dependable gear that keeps the team in sync.',
        primaryLord: 'jangmo_o',
        secondaryLord: 'goomy',
        recruitSpeciesIds: ['klink', 'azurill'],
        recruitLabel: 'Klink & Azurill',
      },
      {
        id: 'C',
        text: 'An ancient relic humming with strange power.',
        primaryLord: 'dreepy',
        secondaryLord: 'dratini',
        recruitSpeciesIds: ['magnemite', 'igglybuff'],
        recruitLabel: 'Magnemite & Igglybuff',
      },
    ],
  },
  {
    id: 'q9',
    number: 9,
    seedKey: 'q9IceArmored',
    chapterSlotTitle: 'Ice & Armored Duo',
    prompt: 'Before the fortress gates in a howling blizzard, what is your final thought?',
    options: [
      {
        id: 'A',
        text: 'Stay cool—every turn on the grid is a puzzle.',
        primaryLord: 'frigibax',
        secondaryLord: 'dratini',
        recruitSpeciesIds: ['mime_jr_galar', 'beldum'],
        recruitLabel: 'Galarian Mime Jr. & Beldum',
      },
      {
        id: 'B',
        text: 'Trust our bonds—we can weather any storm.',
        primaryLord: 'goomy',
        secondaryLord: 'bagon',
        recruitSpeciesIds: ['vanillite', 'porygon'],
        recruitLabel: 'Vanillite & Porygon',
      },
      {
        id: 'C',
        text: 'No hesitation—press forward to the end!',
        primaryLord: 'deino',
        secondaryLord: 'gible',
        recruitSpeciesIds: ['swinub', 'blipbug'],
        recruitLabel: 'Swinub & Blipbug',
      },
    ],
  },
];

export function getStarterPartnerOptions() {
  return getStage1SpeciesByCategory('starter_partner');
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
    dratini: 0,
    bagon: 0,
    gible: 0,
    deino: 0,
    goomy: 0,
    jangmo_o: 0,
    dreepy: 0,
    frigibax: 0,
  };

  const firstOrder: Record<DragonLordSpeciesId, number> = {
    dratini: Number.POSITIVE_INFINITY,
    bagon: Number.POSITIVE_INFINITY,
    gible: Number.POSITIVE_INFINITY,
    deino: Number.POSITIVE_INFINITY,
    goomy: Number.POSITIVE_INFINITY,
    jangmo_o: Number.POSITIVE_INFINITY,
    dreepy: Number.POSITIVE_INFINITY,
    frigibax: Number.POSITIVE_INFINITY,
  };

  const seeds: QuizRecruitSeeds = {
    q1Healer: ['happiny'],
    q2BugFlying: ['caterpie', 'pidgey'],
    q3GhostPsychic: ['duskull', 'ralts'],
    q4Electric: ['shinx'],
    q5FrontlineTrio: ['machop', 'geodude', 'trapinch'],
    q6WaterGrass: ['poliwag', 'bellsprout'],
    q7Fire: ['litwick'],
    q8SteelFairy: ['tinkatink', 'cleffa'],
    q9IceArmored: ['mime_jr_galar', 'beldum'],
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

    const validIds = chosen.recruitSpeciesIds.filter((id) => Boolean(getSpeciesById(id)));
    if (validIds.length > 0) {
      seeds[q.seedKey] = [...validIds];
    }
  }

  let bestLord: DragonLordSpeciesId = 'dratini';
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
    q1HealerSpeciesId: seeds.q1Healer[0] ?? 'happiny',
  };
}
