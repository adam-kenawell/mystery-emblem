/**
 * Public Types, Options & Snapshot Contracts for `BattleScene`
 */

import type { AudioManager } from '../../audio/AudioManager';
import type { LevelUpResult } from '../../engine/progressionEngine';
import { PMD_TILE_NATIVE_PX } from '../../assets/tilesetLoader';
import type { SaveStateManager } from '../../state/SaveStateManager';
import type {
  BattleObjectiveType,
  ConvoyEntry,
  DungeonEventDefinition,
  DungeonMapDefinition,
  ManualEnemyBattleSpawn,
  PokemonType,
  PrepDeploymentSlot,
  ReinforcementWaveDefinition,
  SaveData,
  StatusCondition,
  TraversalClass,
  UnitBattleFaction,
  UnitCosmeticForm,
} from '../../types/schemas';
import type { DialogueOverlay, DialogueScript } from '../../ui/DialogueOverlay';
import type { PrepSubMode } from '../../ui/DungeonPrepOverlay';
import type { TutorialOverlay } from '../../ui/TutorialOverlay';
import { MAP_DEFAULT_SCALE } from '../../ui/mapZoomController';

export const BATTLE_TILE_SCALE = MAP_DEFAULT_SCALE;
export const BATTLE_TILE_DISPLAY_PX = PMD_TILE_NATIVE_PX * BATTLE_TILE_SCALE;

export type BattlePhase =
  | 'dungeon_prep'
  | 'player_phase'
  | 'ally_phase'
  | 'enemy_phase'
  | 'victory'
  | 'defeat';

export type BattleInteractionState =
  | 'idle'
  | 'unit_selected'
  | 'walking'
  | 'action_menu'
  | 'combat_forecast'
  | 'combat_animating'
  | 'enemy_acting';

export type BattleExitDestination = 'default' | 'overworld' | 'title';

export type BattleFieldMenuSubView =
  | 'root'
  | 'objective'
  | 'units'
  | 'settings'
  | 'confirm_overworld'
  | 'confirm_title';

/** Identifies how to rebuild a battle's rules/callbacks when resuming a mid-battle save. */
export type BattleSuspendSource =
  | { kind: 'chapter'; nodeId: string }
  | { kind: 'node'; nodeId: string; levelId: string }
  | {
      kind: 'skirmish';
      nodeId: string;
      goldBounty: number;
      customMap: DungeonMapDefinition;
      enemyOverrides?: ReadonlyArray<ManualEnemyBattleSpawn>;
    };

export interface BattleSceneOptions {
  viewportEl: HTMLElement;
  saveManager: SaveStateManager;
  audioManager?: AudioManager;
  dialogueOverlay?: DialogueOverlay;
  tutorialOverlay?: TutorialOverlay;
  onExit: (destination?: BattleExitDestination) => void;
  onLayerStateChanged: () => void;
}

export interface BattleOpenOptions {
  levelId?: string;
  customMap?: DungeonMapDefinition;
  enemyOverrides?: ReadonlyArray<ManualEnemyBattleSpawn>;
  objectiveType?: BattleObjectiveType;
  objectiveLabel?: string;
  surviveTurns?: number;
  defeatIfUnitIdsFall?: ReadonlyArray<string>;
  reinforcements?: ReadonlyArray<ReinforcementWaveDefinition>;
  events?: ReadonlyArray<DungeonEventDefinition>;
  eventScripts?: Readonly<Record<string, (save: SaveData | null) => DialogueScript>>;
  commitToSaveOnVictory?: boolean;
  clearRewardItems?: ReadonlyArray<ConvoyEntry>;
  preferredDeployInstanceIds?: ReadonlyArray<string>;
  pauseOnLevelUpInFastMode?: boolean;
  skipPrepPhase?: boolean;
  onDungeonEnteredBeforePrep?: () => Promise<void>;
  onVictory?: () => void;
  onBeforeVictoryModal?: () => Promise<void>;
  exitButtonLabel?: string;
  hideReplayOnVictory?: boolean;
  /** Enables in-battle "Save Progress" and tells Continue how to rebuild this battle. */
  suspendSource?: BattleSuspendSource;
  /** Raw `battleSuspendJson` to restore instead of starting fresh (skips intro + prep). */
  resumeSuspendJson?: string;
}

export interface BattleSceneSnapshot {
  isOpen: boolean;
  phase: BattlePhase;
  cutsceneInProgress: boolean;
  objectiveType: BattleObjectiveType;
  objectiveLabel: string;
  surviveTurns: number | null;
  defeatIfUnitIdsFall: string[];
  prepSubMode: PrepSubMode | null;
  deploymentSlots: PrepDeploymentSlot[];
  prepSwapSlotIndex: number | null;
  interactionState: BattleInteractionState;
  turnNumber: number;
  selectedUnitId: string | null;
  forecastMode: 'attack' | 'heal' | null;
  forecastTargetId: string | null;
  forecastMoveId: string | null;
  systemMenuOpen: boolean;
  levelUpModalOpen: boolean;
  moveLearnedModalOpen: boolean;
  talkChoiceModalOpen: boolean;
  levelUpHistory: LevelUpResult[];
  collectedDrops: string[];
  spawnedReinforcementIds: string[];
  blockedReinforcementIds: string[];
  triggeredEventIds: string[];
  globalDangerEnabled: boolean;
  trackedEnemyIds: string[];
  fastMode: boolean;
  camera: {
    x: number;
    y: number;
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
    bufferWidth: number;
    bufferHeight: number;
    displayScale: number;
    imageSmoothingEnabled: boolean;
  };
  map: {
    id: string;
    name: string;
    width: number;
    height: number;
    isCustomized: boolean;
  };
  units: Array<{
    id: string;
    rosterInstanceId: string | null;
    faction: UnitBattleFaction;
    isLord: boolean;
    isBoss: boolean;
    mustSurvive: boolean;
    stationary: boolean;
    droppableItemId: string | null;
    aiMode: string;
    speciesId: string;
    speciesName: string;
    cosmeticForm?: UnitCosmeticForm;
    spriteAssetKey: string;
    nickname: string;
    level: number;
    exp: number;
    x: number;
    y: number;
    currentHp: number;
    maxHp: number;
    mov: number;
    effectiveMov: number;
    traversalClass: TraversalClass;
    types: ReadonlyArray<PokemonType>;
    activeMoveIds: string[];
    equippedPhysicalMoveId: string | null;
    equippedSpecialMoveId: string | null;
    equippedItemId: string | null;
    status: StatusCondition | null;
    waited: boolean;
    defeated: boolean;
  }>;
  reachableCoords: string[];
  traversedMoveCoords: string[];
  attackBorderCoords: string[];
  supportBorderCoords: string[];
  allAttackableCoords: string[];
  dangerCoords: string[];
  inspectedAllyRangeUnitId: string | null;
}
