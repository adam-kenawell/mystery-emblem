/**
 * Dragon Aura Quiz Tally & Tie-Breaker Engine (`quizScoring.ts`)
 */

import {
  FIXED_HEALER_SPECIES_ID,
  FIXED_PARTNER_SPECIES_ID,
  type DragonLordSpeciesId,
} from '../data/campaignConfig';
import { DRAGON_LORD_OPTIONS } from '../data/quizLordProfiles';
import {
  PERSONALITY_QUIZ_QUESTIONS,
  type QuizQuestionDefinition,
} from '../data/quizQuestions';

export interface QuizEvaluationResult {
  assignedLordSpeciesId: DragonLordSpeciesId;
  scoresByDragonId: Record<DragonLordSpeciesId, number>;
  firstPointOrderByDragonId: Record<DragonLordSpeciesId, number>;
  partnerSpeciesId: string;
  healerSpeciesId: string;
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
  }

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
    partnerSpeciesId: FIXED_PARTNER_SPECIES_ID,
    healerSpeciesId: FIXED_HEALER_SPECIES_ID,
  };
}
