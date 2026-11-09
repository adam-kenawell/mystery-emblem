/**
 * Barrel for Tactical Combat Math, Forecast, Exchange, Status Conditions & Support Heal Engine
 */

export {
  getTypeEffectiveness,
  type TypeEffectivenessMultiplier,
  type TypeEffectivenessLabel,
} from './combat/typeEffectiveness';

export {
  isOffensiveMove,
  isHealingMove,
  manhattanDistance,
  getOffensiveMovesAtDistance,
  getEnemyTargetingMovesAtDistance,
  getUnitEffectiveCombatStats,
  computeUnitPopupStats,
  type BattleMoveSlot,
  type TempBattleBoosts,
  type BattleUnitState,
  type CombatSideForecast,
  type CombatForecast,
  type UnitPopupCombatSummary,
} from './combat/combatTypesAndStats';

export { computeCombatForecast } from './combat/combatForecast';

export {
  resolveCombatExchange,
  type CombatStrikeOutcome,
  type CombatExchangeOutcome,
} from './combat/combatResolver';

export {
  STATUS_BADGE_COLORS,
  STATUS_ACTION_CALLOUTS,
  STATUS_SHORT_EFFECT_TEXT,
  isEnemyStatusMove,
  getDefaultStatusDuration,
  isUnitImmuneToStatus,
  getEnemyStatusMovesAtDistance,
  computeStatusMoveForecast,
  rollSecondaryStatusOnHit,
  applyInflictedStatusToUnit,
  applyPhaseStartStatusTick,
  type StatusMoveForecast,
  type PhaseStatusTickOutcome,
} from './combat/statusEngine';

export {
  findBestAttackPlanForTarget,
  getOffensiveMovesReachableForTarget,
  findBestStopTileForOffensiveMove,
  type DirectAttackPlan,
} from './combat/attackPlanFinder';

export {
  doesUnitNeedHealing,
  getHealingMovesForTargetAtDistance,
  computeHealForecast,
  findBestHealPlanForAlly,
  type HealForecast,
  type DirectHealPlan,
} from './combat/supportHealEngine';

export {
  isDanceMove,
  isDancerUnit,
  canUnitBeRefreshedByDance,
  getDanceMovesForTargetAtDistance,
  findBestDancePlanForAlly,
  type DirectDancePlan,
} from './combat/danceEngine';
