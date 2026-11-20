/**
 * Declarative Dungeon Event Engine Barrel (`battleEvents.ts`)
 */

export {
  resolveDefaultObjectiveLabel,
  doesUnitMatchTalkInitiator,
  getMatchingTurnStartEvents,
  getAvailableTalkEventsForPair,
  getAvailableTalkTargetIds,
  findBestTalkPlanForTarget,
  getMatchingUnitDefeatedEvents,
  getMatchingTileReachedEvents,
  getMatchingUnitHealedEvents,
  getMatchingUnitDamagedEvents,
  getMatchingPlayerPhaseEndEvents,
  getMatchingVictoryEvents,
  type DirectTalkPlan,
} from './events/eventEvaluator';

export type {
  DungeonEventAction,
  DungeonEventCondition,
  DungeonEventDefinition,
  DungeonEventDialogueLine,
  DungeonEventTrigger,
  DungeonTalkChoiceOption,
  ReinforcementWaveDefinition,
  UnitBattleFaction,
} from '../types/schemas';
