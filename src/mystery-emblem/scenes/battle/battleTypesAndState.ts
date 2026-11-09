/**
 * Internal Runtime State & Shared Controller Context for `BattleScene`
 */

import type { LoadedSpriteBundle, PmdDirection } from '../../assets/pmdAssetLoader';
import type { LoadedTilesetSheet } from '../../assets/tilesetLoader';
import type { AudioManager } from '../../audio/AudioManager';
import { getEffectiveChapterMap } from '../../data/chapterMapRegistry';
import { resolveEnemySpawnsForMap } from '../../engine/battleSetup';
import type { BattleUnitState, CombatForecast, HealForecast } from '../../engine/combatEngine';
import type { LevelUpResult } from '../../engine/progressionEngine';
import type {
  AStarPathStep,
  DangerAreaResult,
  MovementRangeResult,
} from '../../engine/terrainAndPathfinding';
import type { SaveStateManager } from '../../state/SaveStateManager';
import type {
  BattleObjectiveType,
  ConvoyEntry,
  DungeonEventDefinition,
  DungeonMapDefinition,
  DungeonTalkChoiceOption,
  KecleonShopType,
  ManualEnemyBattleSpawn,
  PrepDeploymentSlot,
  ReinforcementWaveDefinition,
  SaveData,
} from '../../types/schemas';
import type { DialogueOverlay, DialogueScript } from '../../ui/DialogueOverlay';
import type { DungeonPrepOverlay } from '../../ui/DungeonPrepOverlay';
import type { TutorialOverlay } from '../../ui/TutorialOverlay';
import {
  createInitialDungeonGridCamera,
  type DungeonGridCameraState,
} from '../../ui/gridViewportMath';
import { MAP_DEFAULT_SCALE, MultiTouchPinchTracker } from '../../ui/mapZoomController';
import type { BattleDomRefs } from './battleDomShell';
import type {
  BattleExitDestination,
  BattleFieldMenuSubView,
  BattleInteractionState,
  BattlePhase,
} from './battlePublicTypes';

export const BATTLE_DRAG_THRESHOLD_PX = 8;
export const BATTLE_LONG_PRESS_MS = 520;
export const WALK_MS_PER_TILE_NORMAL = 85;
export const WALK_MS_PER_TILE_FAST = 16;
export const RANGE_PULSE_PERIOD_MS = 1500;

export interface FloatingBattleText {
  id: number;
  worldX: number;
  worldY: number;
  text: string;
  color: string;
  emphasis: boolean;
  createdAtMs: number;
  durationMs: number;
}

export interface ActiveStrikeVfx {
  kind: 'melee' | 'ranged' | 'impact_burst';
  fromWorldX: number;
  fromWorldY: number;
  toWorldX: number;
  toWorldY: number;
  color: string;
  startedAtMs: number;
  durationMs: number;
}

export interface ActiveBattleWalk {
  unitId: string;
  steps: AStarPathStep[];
  segmentIndex: number;
  segmentElapsedMs: number;
  lastTickMs: number;
  followCamera: boolean;
  onComplete: () => void;
}

export interface PendingPostBattleRecruit {
  speciesId: string;
  level: number;
  nickname?: string;
  scaleStatsToLevel?: boolean;
}

export interface BattleRuntimeState {
  openState: boolean;
  battleRunGen: number;
  previousBgmId: string | null;
  activeLevelId: string;
  explicitCustomMap: DungeonMapDefinition | null;
  explicitEnemyOverrides: ReadonlyArray<ManualEnemyBattleSpawn> | undefined;
  explicitObjectiveType: BattleObjectiveType | undefined;
  explicitObjectiveLabel: string | undefined;
  explicitSurviveTurns: number | undefined;
  explicitDefeatIfUnitIdsFall: ReadonlyArray<string> | undefined;
  explicitReinforcements: ReadonlyArray<ReinforcementWaveDefinition> | undefined;
  explicitEvents: ReadonlyArray<DungeonEventDefinition> | undefined;
  objectiveType: BattleObjectiveType;
  objectiveLabel: string;
  surviveTurns: number | undefined;
  defeatIfUnitIdsFall: string[];
  defeatReasonText: string | null;
  reinforcements: ReadonlyArray<ReinforcementWaveDefinition>;
  events: ReadonlyArray<DungeonEventDefinition>;
  eventScripts: Readonly<Record<string, (save: SaveData | null) => DialogueScript>>;
  triggeredEventIds: Set<string>;
  talkChoiceResolver: ((option: DungeonTalkChoiceOption | null) => void) | null;
  spawnedReinforcementIds: Set<string>;
  blockedReinforcementIds: Set<string>;
  collectedDrops: string[];
  eventBonusItems: ConvoyEntry[];
  eventBonusGold: number;
  pendingShopUnlocks: Array<{ nodeId: string; shopType?: KecleonShopType }>;
  pendingPostBattleRecruits: PendingPostBattleRecruit[];
  commitToSaveOnVictory: boolean;
  clearRewardItems: ReadonlyArray<ConvoyEntry>;
  pauseOnLevelUpInFastMode: boolean;
  skipPrepPhase: boolean;
  levelUpHistory: LevelUpResult[];
  levelUpResolver: (() => void) | null;
  cutsceneInProgress: boolean;
  currentOnDungeonEnteredBeforePrep: (() => Promise<void>) | undefined;
  currentOnBeforeVictoryModal: (() => Promise<void>) | undefined;
  currentOnVictory: (() => void) | undefined;
  victoryCallbackFired: boolean;
  map: DungeonMapDefinition;
  enemySpawnDefs: ReadonlyArray<ManualEnemyBattleSpawn>;
  guestPrepManager: SaveStateManager | null;
  deploymentSlots: PrepDeploymentSlot[];
  prepSwapSlotIndex: number | null;
  units: BattleUnitState[];
  turnNumber: number;
  phase: BattlePhase;
  interactionState: BattleInteractionState;
  selectedUnitId: string | null;
  inspectedTile: { x: number; y: number };
  hoveredTile: { x: number; y: number } | null;
  touchInspectedUnitId: string | null;
  renderedPopupSpeciesKey: string;
  prepMapStatusNotice: string | null;
  previewPath: AStarPathStep[] | null;
  currentRange: MovementRangeResult | null;
  uncommittedOrigin: { unitId: string; x: number; y: number; direction: PmdDirection } | null;
  originRangeSnapshot: MovementRangeResult | null;
  forecastMode: 'attack' | 'heal';
  forecastReturnMode: 'unit_selected' | 'action_menu';
  forecastTargetId: string | null;
  forecastMoveId: string | null;
  currentForecast: CombatForecast | null;
  currentHealForecast: HealForecast | null;
  activeWalk: ActiveBattleWalk | null;
  floatingTexts: FloatingBattleText[];
  floatingTextEls: Map<number, HTMLElement>;
  nextFloatingTextId: number;
  activeStrikeVfx: ActiveStrikeVfx | null;
  globalDangerEnabled: boolean;
  trackedEnemyIds: Set<string>;
  lastComputedHoverEnemyId: string | null;
  suppressedHoverEnemyId: string | null;
  currentDanger: DangerAreaResult;
  cam: DungeonGridCameraState;
  pinchTracker: MultiTouchPinchTracker;
  systemMenuOpen: boolean;
  systemMenuSubView: BattleFieldMenuSubView;
  lastFieldMenuAnchorClient: { x: number; y: number } | null;
  fastMode: boolean;
  customRng: (() => number) | null;
  tilesetSheets: Map<string, LoadedTilesetSheet>;
  spriteBundles: Map<string, LoadedSpriteBundle>;
  phaseBannerTimer: number | null;
  beginBattleTimer: number | null;
  beginBattleResolver: (() => void) | null;
  phaseTransitionTimer: number | null;
  phaseTransitionResolver: (() => void) | null;
  selectionPulseStartMs: number;
}

export function createInitialBattleRuntimeState(): BattleRuntimeState {
  const map = getEffectiveChapterMap('prologue');
  const cam = createInitialDungeonGridCamera(MAP_DEFAULT_SCALE);
  cam.bufferWidth = 320;
  cam.bufferHeight = 240;
  return {
    openState: false,
    battleRunGen: 0,
    previousBgmId: null,
    activeLevelId: 'prologue',
    explicitCustomMap: null,
    explicitEnemyOverrides: undefined,
    explicitObjectiveType: undefined,
    explicitObjectiveLabel: undefined,
    explicitSurviveTurns: undefined,
    explicitDefeatIfUnitIdsFall: undefined,
    explicitReinforcements: undefined,
    explicitEvents: undefined,
    objectiveType: 'rout',
    objectiveLabel: 'Rout All Enemies',
    surviveTurns: undefined,
    defeatIfUnitIdsFall: [],
    defeatReasonText: null,
    reinforcements: [],
    events: [],
    eventScripts: {},
    triggeredEventIds: new Set(),
    talkChoiceResolver: null,
    spawnedReinforcementIds: new Set(),
    blockedReinforcementIds: new Set(),
    collectedDrops: [],
    eventBonusItems: [],
    eventBonusGold: 0,
    pendingShopUnlocks: [],
    pendingPostBattleRecruits: [],
    commitToSaveOnVictory: false,
    clearRewardItems: [],
    pauseOnLevelUpInFastMode: false,
    skipPrepPhase: false,
    levelUpHistory: [],
    levelUpResolver: null,
    cutsceneInProgress: false,
    currentOnDungeonEnteredBeforePrep: undefined,
    currentOnBeforeVictoryModal: undefined,
    currentOnVictory: undefined,
    victoryCallbackFired: false,
    map,
    enemySpawnDefs: resolveEnemySpawnsForMap(map),
    guestPrepManager: null,
    deploymentSlots: [],
    prepSwapSlotIndex: null,
    units: [],
    turnNumber: 1,
    phase: 'dungeon_prep',
    interactionState: 'idle',
    selectedUnitId: null,
    inspectedTile: { x: 3, y: 5 },
    hoveredTile: null,
    touchInspectedUnitId: null,
    renderedPopupSpeciesKey: '',
    prepMapStatusNotice: null,
    previewPath: null,
    currentRange: null,
    uncommittedOrigin: null,
    originRangeSnapshot: null,
    forecastMode: 'attack',
    forecastReturnMode: 'unit_selected',
    forecastTargetId: null,
    forecastMoveId: null,
    currentForecast: null,
    currentHealForecast: null,
    activeWalk: null,
    floatingTexts: [],
    floatingTextEls: new Map(),
    nextFloatingTextId: 1,
    activeStrikeVfx: null,
    globalDangerEnabled: false,
    trackedEnemyIds: new Set(),
    lastComputedHoverEnemyId: null,
    suppressedHoverEnemyId: null,
    currentDanger: {
      globalDangerTiles: new Set(),
      individualDangerTiles: new Set(),
      combinedDangerTiles: new Set(),
    },
    cam,
    pinchTracker: new MultiTouchPinchTracker(),
    systemMenuOpen: false,
    systemMenuSubView: 'root',
    lastFieldMenuAnchorClient: null,
    fastMode: false,
    customRng: null,
    tilesetSheets: new Map(),
    spriteBundles: new Map(),
    phaseBannerTimer: null,
    beginBattleTimer: null,
    beginBattleResolver: null,
    phaseTransitionTimer: null,
    phaseTransitionResolver: null,
    selectionPulseStartMs: 0,
  };
}

export interface BattleControllerContext {
  viewportEl: HTMLElement;
  state: BattleRuntimeState;
  dom: BattleDomRefs;
  prepOverlay: DungeonPrepOverlay;
  saveManager: SaveStateManager;
  audioManager: AudioManager;
  dialogueOverlay?: DialogueOverlay;
  tutorialOverlay?: TutorialOverlay;
  abortSignal: AbortSignal;
  onExitCallback: (destination?: BattleExitDestination) => void;
  onLayerStateChanged: () => void;
  onRequestRenameUnit?: (instanceId: string) => Promise<void> | void;
  startLoop: () => void;
  stopLoop: () => void;
  renderNow: () => void;
  syncViewportDimensions: () => void;
  centerCameraOnTile: (tx: number, ty: number) => void;
}
