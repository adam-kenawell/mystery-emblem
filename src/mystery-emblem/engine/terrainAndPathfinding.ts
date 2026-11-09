/**
 * Barrel for Tactical Terrain Traversal, Dijkstra Range & A* Pathfinding Engine
 */

export {
  TERRAIN_METADATA,
  areBattleFactionsAllied,
  coordKey,
  parseCoordKey,
  isInMapBounds,
  getMapTerrainAt,
  hasHeavyDutyBootsEffect,
  getEffectiveMovementPoints,
  getTerrainMoveCost,
  getTerrainBonuses,
  type ActiveMoveRangeEntry,
  type PathfindingUnitContext,
  type TerrainMetadata,
} from './pathfinding/terrainRules';

export {
  computeUnitMovementAndAttackRange,
  computeEnemyDangerArea,
  type ReachableTileInfo,
  type MovementRangeResult,
  type DangerAreaResult,
} from './pathfinding/attackEnvelope';

export { findShortestPathAStar, type AStarPathStep } from './pathfinding/pathfindingAStar';
