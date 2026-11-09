/**
 * Barrel for Tactical Combat Math, Forecast, Exchange & Support Heal Engine
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
