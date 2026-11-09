/**
 * Barrel for Tactical EXP, Level-Up Growth Roll & Mid-Battle Promotion Engine
 */

export {
  MAX_UNIT_LEVEL,
  EXP_PER_LEVEL,
  STAT_KEYS_SIX,
  getEffectiveGrowthRates,
  computeManualScaledStatsForJoinLevel,
  computeCombatExpGain,
  computeSupportHealExpGain,
  rollSingleLevelUp,
  awardBattleUnitExp,
  type CombatExpContext,
  type LevelUpResult,
} from './progression/expAndLevelUp';

export {
  getEligibleEvolutionBranches,
  promoteBattleUnitMidBattle,
  type BattlePromotionOutcome,
} from './progression/battlePromotion';
