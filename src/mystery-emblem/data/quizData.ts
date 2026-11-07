/**
 * Mystery Emblem — Step 3 Personality Quiz, Dragon Lord Trait Scorer & NG+ Seed Registry (`quizData.ts`)
 *
 * Implements GDD Section 1.1 word-for-word:
 * - 8 Stage-1 Dragon Lords (`dratini`, `bagon`, `gible`, `deino`, `goomy`, `jangmo_o`, `dreepy`, `frigibax`)
 * - 9 Personality Questions (`Q1` = 6 choices seeding Prologue Healer; `Q2`–`Q9` = 3 choices each,
 *   where each of the 8 Dragon Lords appears 3× as primary `+2` and 3× as secondary `+1`)
 * - Deterministic earliest-point tie-breaker when 2+ Dragon Lords tie for top score
 * - Full `QuizRecruitSeeds` mapping for Prologue through Chapter 12 (and NG+ Custom Roster Picker)
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
    auraSummary: 'Calm, empathetic leader whose serene Dragon Aura steadies allies in any storm.',
  },
  {
    speciesId: 'bagon',
    name: 'Bagon',
    traitLabel: 'Bold & Determined',
    auraSummary: 'Fearless vanguard who leaps toward impossible horizons and rallies every heart.',
  },
  {
    speciesId: 'gible',
    name: 'Gible',
    traitLabel: 'Fierce & Impulsive',
    auraSummary: 'Hard-hitting frontliner whose fiery grit shatters enemy lines head-on.',
  },
  {
    speciesId: 'deino',
    name: 'Deino',
    traitLabel: 'Tenacious & Relentless',
    auraSummary: 'Unbreakable iron resolve that presses forward until the very last foe falls.',
  },
  {
    speciesId: 'goomy',
    name: 'Goomy',
    traitLabel: 'Kind & Resilient',
    auraSummary: 'Warm-hearted guardian who treasures squad bonds and endures the harshest trials.',
  },
  {
    speciesId: 'jangmo_o',
    name: 'Jangmo-o',
    traitLabel: 'Honorable & Disciplined',
    auraSummary: 'Tactical martial commander who coordinates formations with unyielding honor.',
  },
  {
    speciesId: 'dreepy',
    name: 'Dreepy',
    traitLabel: 'Clever & Swift',
    auraSummary: 'Quick-witted strategist who outsmarts traps and strikes like a phantom gale.',
  },
  {
    speciesId: 'frigibax',
    name: 'Frigibax',
    traitLabel: 'Stoic & Composed',
    auraSummary: 'Cool-headed tactician who reads every grid turn like a crystalline puzzle.',
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
    chapterSlotTitle: 'Prologue — Partner’s Healer Friend',
    prompt:
      'A fierce storm has just passed over your coastal village, and a weary traveler stumbles into the town square looking exhausted. How do you help them recover?',
    options: [
      {
        id: 'A',
        text: 'Bring them a warm meal and a soft blanket right away.',
        primaryLord: 'goomy',
        secondaryLord: 'dratini',
        recruitSpeciesIds: ['happiny'],
        recruitLabel: 'Happiny',
      },
      {
        id: 'B',
        text: 'Gather soothing herbs and flowers to calm their spirits.',
        primaryLord: 'dratini',
        secondaryLord: 'dreepy',
        recruitSpeciesIds: ['flabebe'],
        recruitLabel: 'Flabébé',
      },
      {
        id: 'C',
        text: 'Rally the neighbors and cheer them up with a lively smile!',
        primaryLord: 'bagon',
        secondaryLord: 'gible',
        recruitSpeciesIds: ['bounsweet'],
        recruitLabel: 'Bounsweet',
      },
      {
        id: 'D',
        text: 'Lead them somewhere quiet so they can rest in peace and silence.',
        primaryLord: 'frigibax',
        secondaryLord: 'deino',
        recruitSpeciesIds: ['hatenna'],
        recruitLabel: 'Hatenna',
      },
      {
        id: 'E',
        text: 'Check their supplies and share your own rations for the road ahead.',
        primaryLord: 'jangmo_o',
        secondaryLord: 'goomy',
        recruitSpeciesIds: ['smoliv'],
        recruitLabel: 'Smoliv',
      },
      {
        id: 'F',
        text: 'Tell them an encouraging story to bring back their luck and hope.',
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
    chapterSlotTitle: 'Dungeon 2 (Ch. 1) — Bug & Flying Duo',
    prompt:
      'You are setting out on your very first expedition up a misty coastal bluff when the main trail splits into three paths. Which route do you take?',
    options: [
      {
        id: 'A',
        text: 'The familiar, sunlit dirt road where I can see the horizon clearly.',
        primaryLord: 'bagon',
        secondaryLord: 'jangmo_o',
        recruitSpeciesIds: ['caterpie', 'pidgey'],
        recruitLabel: 'Caterpie & Pidgey',
      },
      {
        id: 'B',
        text: 'The winding forest footpath shaded by tall, rustling canopy trees.',
        primaryLord: 'goomy',
        secondaryLord: 'dratini',
        recruitSpeciesIds: ['sewaddle', 'pidove'],
        recruitLabel: 'Sewaddle & Pidove',
      },
      {
        id: 'C',
        text: 'The steep rocky shortcut climbing straight up the seaside cliffs.',
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
    chapterSlotTitle: 'Dungeon 3 (Ch. 2) — Ghost & Psychic Duo',
    prompt:
      'While exploring an ancient mountain ruin at dusk, you hear eerie footsteps echoing from behind a locked stone door. What is your first instinct?',
    options: [
      {
        id: 'A',
        text: 'Study the runes on the doorframe to outsmart whatever is inside.',
        primaryLord: 'dreepy',
        secondaryLord: 'frigibax',
        recruitSpeciesIds: ['duskull', 'abra'],
        recruitLabel: 'Duskull & Abra',
      },
      {
        id: 'B',
        text: 'Reach out with empathy—someone inside might be trapped and scared.',
        primaryLord: 'dratini',
        secondaryLord: 'goomy',
        recruitSpeciesIds: ['duskull', 'ralts'],
        recruitLabel: 'Duskull & Ralts',
      },
      {
        id: 'C',
        text: 'Brace yourself and hold your ground until the mystery reveals itself.',
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
    chapterSlotTitle: 'Dungeon 5 (Ch. 4) — Solo Electric Attacker',
    prompt:
      'Enemy scouts have spotted your camp from the treetops and are about to signal their main force! How do you react?',
    options: [
      {
        id: 'A',
        text: 'Dash in with a burst of speed to surprise them before they can move!',
        primaryLord: 'dreepy',
        secondaryLord: 'bagon',
        recruitSpeciesIds: ['pichu'],
        recruitLabel: 'Pichu',
      },
      {
        id: 'B',
        text: 'Lock eyes with their leader and charge straight at them to break their nerve!',
        primaryLord: 'gible',
        secondaryLord: 'deino',
        recruitSpeciesIds: ['shinx'],
        recruitLabel: 'Shinx',
      },
      {
        id: 'C',
        text: 'Coordinate with your squad to cut off their escape route from range.',
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
    chapterSlotTitle: 'Chapter 5 — Fighting, Rock & Ground Trio',
    prompt:
      'A heavily armed vanguard is marching down a narrow coastal pass toward your allies. What kind of frontline strategy do you trust most?',
    options: [
      {
        id: 'A',
        text: 'A balanced formation that adapts to terrain and strikes from every angle.',
        primaryLord: 'jangmo_o',
        secondaryLord: 'dreepy',
        recruitSpeciesIds: ['machop', 'geodude', 'trapinch'],
        recruitLabel: 'Machop, Geodude & Trapinch',
      },
      {
        id: 'B',
        text: 'An unbreakable wall of muscle and stone that refuses to yield an inch.',
        primaryLord: 'deino',
        secondaryLord: 'frigibax',
        recruitSpeciesIds: ['machop', 'roggenrola', 'rhyhorn'],
        recruitLabel: 'Machop, Roggenrola & Rhyhorn',
      },
      {
        id: 'C',
        text: 'A relentless, hard-hitting charge that overwhelms their line before they dig in.',
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
    chapterSlotTitle: 'Chapter 7 — Water & Grass Duo',
    prompt:
      'After a grueling battle, your team makes camp beside a quiet pond in a foggy forest. How do you spend the evening watch?',
    options: [
      {
        id: 'A',
        text: "Practicing combat drills by the water's edge to stay sharp for tomorrow.",
        primaryLord: 'bagon',
        secondaryLord: 'jangmo_o',
        recruitSpeciesIds: ['poliwag', 'bellsprout'],
        recruitLabel: 'Poliwag & Bellsprout',
      },
      {
        id: 'B',
        text: "Listening to the rain on the lily pads and keeping everyone's spirits light.",
        primaryLord: 'goomy',
        secondaryLord: 'dreepy',
        recruitSpeciesIds: ['lotad', 'oddish'],
        recruitLabel: 'Lotad & Oddish',
      },
      {
        id: 'C',
        text: 'Standing silent guard on the perimeter so the rest of the squad can sleep.',
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
    chapterSlotTitle: 'Chapter 8 — Solo Fire Attacker',
    prompt:
      'Deep inside a volcanic cavern, a river of magma blocks the bridge to the enemy commander. What drives you to push forward through the heat?',
    options: [
      {
        id: 'A',
        text: 'Pure fiery grit—no obstacle is going to stand in my way!',
        primaryLord: 'gible',
        secondaryLord: 'deino',
        recruitSpeciesIds: ['magby'],
        recruitLabel: 'Magby',
      },
      {
        id: 'B',
        text: 'The thrill of soaring over danger and striking where they least expect it.',
        primaryLord: 'bagon',
        secondaryLord: 'dreepy',
        recruitSpeciesIds: ['fletchling'],
        recruitLabel: 'Fletchling',
      },
      {
        id: 'C',
        text: 'A quiet, burning resolve to uncover the truth hidden in the shadows.',
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
    chapterSlotTitle: 'Chapter 10 — Steel & Fairy Duo',
    prompt:
      'While crossing a vast desert, you discover a buried treasure chest half-covered in sand. What do you hope to find inside?',
    options: [
      {
        id: 'A',
        text: 'A giant, custom-forged weapon that can smash through enemy armor!',
        primaryLord: 'deino',
        secondaryLord: 'gible',
        recruitSpeciesIds: ['tinkatink', 'cleffa'],
        recruitLabel: 'Tinkatink & Cleffa',
      },
      {
        id: 'B',
        text: 'A dependable piece of gear that keeps my whole team working in sync.',
        primaryLord: 'jangmo_o',
        secondaryLord: 'goomy',
        recruitSpeciesIds: ['klink', 'azurill'],
        recruitLabel: 'Klink & Azurill',
      },
      {
        id: 'C',
        text: 'An ancient, mysterious gadget pulsing with strange energy.',
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
    chapterSlotTitle: 'Chapter 12 — Ice & Armored Duo',
    prompt:
      'You finally stand before the crystal gates of the enemy stronghold as a bitter blizzard howls around you. What final thought crosses your mind before battle?',
    options: [
      {
        id: 'A',
        text: 'Keep a cool head—every move on the grid is a puzzle waiting to be solved.',
        primaryLord: 'frigibax',
        secondaryLord: 'dratini',
        recruitSpeciesIds: ['mime_jr_galar', 'beldum'],
        recruitLabel: 'Galarian Mime Jr. & Beldum',
      },
      {
        id: 'B',
        text: "Trust in the bonds we've built—we'll weather any storm together.",
        primaryLord: 'goomy',
        secondaryLord: 'bagon',
        recruitSpeciesIds: ['vanillite', 'porygon'],
        recruitLabel: 'Vanillite & Porygon',
      },
      {
        id: 'C',
        text: 'No hesitation—press forward until the very last enemy falls!',
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

/**
 * Evaluates either a map of chosen answer option IDs (`{ q1: 'A', q2: 'B', ... }`)
 * or an ordered 9-answer array (`['A', 'B', ...]`), tallying Dragon Lord trait points
 * (`+2` primary, `+1` secondary) with the exact GDD earliest-point tie-breaker
 * and constructing `QuizRecruitSeeds`.
 */
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
    frigibax: 0 + Number.POSITIVE_INFINITY,
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

    // Primary +2
    awardStep += 1;
    scores[chosen.primaryLord] += 2;
    if (!Number.isFinite(firstOrder[chosen.primaryLord])) {
      firstOrder[chosen.primaryLord] = awardStep;
    }

    // Secondary +1
    awardStep += 1;
    scores[chosen.secondaryLord] += 1;
    if (!Number.isFinite(firstOrder[chosen.secondaryLord])) {
      firstOrder[chosen.secondaryLord] = awardStep;
    }

    // Validate species exist in registry before seeding
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
