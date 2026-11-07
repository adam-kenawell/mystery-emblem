/**
 * Mystery Emblem — Playable Tactical Dungeon Battle Scene (`BattleScene`)
 *
 * Implements a complete, start-to-finish tactical dungeon battle loop:
 * 1. `DUNGEON PREP` phase (`Manage Units`, `Manage Items`, `View Map` starting-tile swap, `Enter Dungeon`
 *    confirmation popup) -> transitions to Turn 1 Player Phase (`PLAYER PHASE — TURN 1` banner).
 * 2. Player Phase tactical movement, floating Command Menu (`Attack`, `Heal`, `Item`, `Wait`, `Cancel`),
 *    direct tap-enemy-to-attack routing, manual `End Phase` button, AND automatic Enemy Phase
 *    transition once all living player units complete their actions.
 * 3. Fire Emblem-style Combat Forecast modal displaying weapon/move, Range, STAB / Type Effectiveness,
 *    current -> projected HP, Damage (with `x2` follow-up badge), Hit %, Crit %, and Rule 4 `[E]`
 *    counter-attack status (`Cannot Counter` reason when out of range).
 * 4. Animated on-map combat resolution (`Attack` / `Special` / `Hurt` 8-directional PMD sprites,
 *    melee lunge / ranged energy orb, hit flash, floating pixel damage / `CRIT!` / `MISS` / `DEFEATED!`
 *    callouts, and `0 HP` KO dissolve & unit removal).
 * 5. Active Enemy Phase AI (`chooseEnemyAction`) visibly walking tile-by-tile across the map and
 *    attacking player units with full counter-attack exchanges.
 * 6. `VICTORY!` popup when all enemies are defeated, and `DEFEAT` popup with `Restart Match`
 *    when the player's Dragon Lord reaches `0 HP`.
 *
 * Strictly obeys Rule 2 (Unified Pointer Events ONLY — zero keyboard listeners), Rule 3 (PMD EoS
 * visual skin, `2x` integer pixelated canvas, zero tile grid lines), and Rule 4 (Single `[E]` counter).
 */

import {
  computePmdTileSpritePlacement,
  directionFromDelta,
  loadSpeciesSpriteBundle,
  type LoadedSpriteBundle,
  type PmdDirection,
} from '../assets/pmdAssetLoader';
import {
  PMD_TILE_NATIVE_PX,
  drawSpecialTerrainOverlay,
  drawTilesetChunk,
  loadTilesetSheet,
  normalizeTilesetId,
  type LoadedTilesetSheet,
} from '../assets/tilesetLoader';
import { getAudioManager, type AudioManager } from '../audio/AudioManager';
import type { ReinforcementWaveDefinition } from '../data/campaignRegistry';
import {
  cloneDungeonMap,
  getEffectiveChapterMap,
  hasChapterMapOverride,
  subscribeChapterMapChanges,
} from '../data/chapterMapRegistry';
import { getItemById, getMoveById, getPersonalSkillById } from '../data/index';
import {
  buildBattleUnitsFromPrepDeployment,
  buildSingleEnemyBattleUnit,
  createFallbackBattlePrepManager,
  createInitialPrepDeploymentSlots,
  getMapDeploymentCap,
  resolveEnemySpawnsForMap,
} from '../engine/battleSetup';
import {
  computeCombatForecast,
  computeHealForecast,
  findBestAttackPlanForTarget,
  findBestHealPlanForAlly,
  findBestStopTileForOffensiveMove,
  getHealingMovesForTargetAtDistance,
  getOffensiveMovesAtDistance,
  getOffensiveMovesReachableForTarget,
  manhattanDistance,
  resolveCombatExchange,
  type BattleMoveSlot,
  type BattleUnitState,
  type CombatForecast,
  type HealForecast,
} from '../engine/combatEngine';
import { chooseEnemyAction } from '../engine/enemyAi';
import {
  awardBattleUnitExp,
  computeCombatExpGain,
  computeSupportHealExpGain,
  getEligibleEvolutionBranches,
  promoteBattleUnitMidBattle,
  type LevelUpResult,
} from '../engine/progressionEngine';
import {
  TERRAIN_METADATA,
  computeEnemyDangerArea,
  computeUnitMovementAndAttackRange,
  coordKey,
  findShortestPathAStar,
  getEffectiveMovementPoints,
  getMapTerrainAt,
  getTerrainBonuses,
  isInMapBounds,
  parseCoordKey,
  type AStarPathStep,
  type DangerAreaResult,
  type MovementRangeResult,
} from '../engine/terrainAndPathfinding';
import type { SaveStateManager } from '../state/SaveStateManager';
import type {
  BattleObjectiveType,
  ConvoyEntry,
  DungeonMapDefinition,
  ManualEnemyBattleSpawn,
  PokemonType,
  PrepDeploymentSlot,
  TraversalClass,
} from '../types/schemas';
import { DungeonPrepOverlay, type PrepSubMode } from '../ui/DungeonPrepOverlay';
import { PmdPortraitView } from '../ui/PmdSpriteCanvas';
import {
  MAP_DEFAULT_SCALE,
  MAP_OVERSCROLL_NATIVE_PX,
  MultiTouchPinchTracker,
  clampMapScale,
  computeCenteredMapCameraBounds,
  computeWheelZoomScale,
  type MapCameraBounds,
} from '../ui/mapZoomController';
import { bindPointerTap } from '../ui/pointerControls';

export const BATTLE_TILE_SCALE = MAP_DEFAULT_SCALE;
export const BATTLE_TILE_DISPLAY_PX = PMD_TILE_NATIVE_PX * BATTLE_TILE_SCALE;

const DRAG_THRESHOLD_PX = 8;
const LONG_PRESS_MS = 520;
const WALK_MS_PER_TILE_NORMAL = 85;
const WALK_MS_PER_TILE_FAST = 16;
const RANGE_PULSE_PERIOD_MS = 1500;

type RgbaTuple = readonly [number, number, number, number];

function lerpChannel(a: number, b: number, t: number): number {
  return Math.round(a + (b - a) * t);
}

function lerpRgba(from: RgbaTuple, to: RgbaTuple, t: number): string {
  const alpha = (from[3] + (to[3] - from[3]) * t).toFixed(3);
  return `rgba(${lerpChannel(from[0], to[0], t)}, ${lerpChannel(from[1], to[1], t)}, ${lerpChannel(from[2], to[2], t)}, ${alpha})`;
}

export type BattlePhase =
  | 'dungeon_prep'
  | 'player_phase'
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

interface FloatingBattleText {
  id: number;
  worldX: number;
  worldY: number;
  text: string;
  color: string;
  createdAtMs: number;
  durationMs: number;
}

interface ActiveStrikeVfx {
  kind: 'melee' | 'ranged' | 'impact_burst';
  fromWorldX: number;
  fromWorldY: number;
  toWorldX: number;
  toWorldY: number;
  color: string;
  startedAtMs: number;
  durationMs: number;
}

export interface BattleSceneOptions {
  viewportEl: HTMLElement;
  saveManager: SaveStateManager;
  audioManager?: AudioManager;
  onExit: () => void;
  onLayerStateChanged: () => void;
  onRequestRenameUnit?: (instanceId: string) => Promise<void> | void;
}

export interface BattleSceneSnapshot {
  isOpen: boolean;
  phase: BattlePhase;
  objectiveType: BattleObjectiveType;
  objectiveLabel: string;
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
  levelUpHistory: LevelUpResult[];
  collectedDrops: string[];
  spawnedReinforcementIds: string[];
  blockedReinforcementIds: string[];
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
    faction: 'player' | 'enemy';
    isLord: boolean;
    isBoss: boolean;
    stationary: boolean;
    droppableItemId: string | null;
    aiMode: string;
    speciesId: string;
    speciesName: string;
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
    equippedMoveId: string | null;
    equippedItemId: string | null;
    waited: boolean;
    defeated: boolean;
  }>;
  reachableCoords: string[];
  attackBorderCoords: string[];
  supportBorderCoords: string[];
  allAttackableCoords: string[];
  dangerCoords: string[];
}

export class BattleScene {
  private readonly viewportEl: HTMLElement;
  private readonly saveManager: SaveStateManager;
  private readonly audioManager: AudioManager;
  private readonly onExitCallback: () => void;
  private readonly onLayerStateChanged: () => void;
  private readonly onRequestRenameUnit?: (instanceId: string) => Promise<void> | void;

  private readonly rootEl: HTMLElement;
  private readonly canvasStageEl: HTMLElement;
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly tintScratchCanvas: HTMLCanvasElement;
  private readonly tintScratchCtx: CanvasRenderingContext2D;

  // Top HUD & Toast
  private readonly topHudBarEl: HTMLElement;
  private readonly turnBadgeEl: HTMLElement;
  private readonly dangerBtnEl: HTMLButtonElement;
  private readonly endPhaseBtnEl: HTMLButtonElement;
  private readonly phaseBannerEl: HTMLElement;
  private readonly infoStripEl: HTMLElement;

  // Floating Command Menu (`Attack` / `Heal` / `Item` / `Wait` / `Cancel`)
  private readonly actionMenuEl: HTMLElement;
  private readonly cmdAttackBtnEl: HTMLButtonElement;
  private readonly cmdHealBtnEl: HTMLButtonElement;
  private readonly cmdItemBtnEl: HTMLButtonElement;
  private readonly cmdWaitBtnEl: HTMLButtonElement;
  private readonly cmdCancelBtnEl: HTMLButtonElement;

  // Modals: Dungeon Prep Overlay, Combat Forecast, Level-Up, System Menu, Victory, Defeat
  private readonly prepOverlay: DungeonPrepOverlay;
  private readonly forecastModalBackdropEl: HTMLElement;
  private readonly attackerPortraitView: PmdPortraitView;
  private readonly defenderPortraitView: PmdPortraitView;
  private readonly levelUpModalBackdropEl: HTMLElement;
  private readonly levelUpPortraitView: PmdPortraitView;
  private readonly systemMenuBackdropEl: HTMLElement;
  private readonly systemDangerBtnEl: HTMLButtonElement;
  private readonly systemAudioBtnEl: HTMLButtonElement;
  private readonly systemEndPhaseBtnEl: HTMLButtonElement;
  private readonly victoryModalBackdropEl: HTMLElement;
  private readonly defeatModalBackdropEl: HTMLElement;

  private readonly abortController = new AbortController();
  private unsubscribeMapChanges: (() => void) | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private rafId: number | null = null;

  // Runtime state
  private openState = false;
  private battleRunGen = 0;
  private previousBgmId: string | null = null;
  private activeLevelId = 'prologue';
  private explicitCustomMap: DungeonMapDefinition | null = null;
  private explicitEnemyOverrides: ReadonlyArray<ManualEnemyBattleSpawn> | undefined = undefined;
  private explicitObjectiveType: BattleObjectiveType | undefined = undefined;
  private explicitObjectiveLabel: string | undefined = undefined;
  private objectiveType: BattleObjectiveType = 'rout';
  private objectiveLabel = 'Rout All Enemies';
  private reinforcements: ReadonlyArray<ReinforcementWaveDefinition> = [];
  private spawnedReinforcementIds = new Set<string>();
  private blockedReinforcementIds = new Set<string>();
  private collectedDrops: string[] = [];
  private commitToSaveOnVictory = false;
  private clearRewardItems: ReadonlyArray<ConvoyEntry> = [];
  private pauseOnLevelUpInFastMode = false;
  private levelUpHistory: LevelUpResult[] = [];
  private levelUpResolver: (() => void) | null = null;
  private currentOnVictory: (() => void) | undefined = undefined;
  private victoryCallbackFired = false;
  private map: DungeonMapDefinition = getEffectiveChapterMap('prologue');
  private enemySpawnDefs: ReadonlyArray<ManualEnemyBattleSpawn> = resolveEnemySpawnsForMap(
    this.map
  );
  private guestPrepManager: SaveStateManager | null = null;
  private deploymentSlots: PrepDeploymentSlot[] = [];
  private prepSwapSlotIndex: number | null = null;
  private units: BattleUnitState[] = [];
  private turnNumber = 1;
  private phase: BattlePhase = 'dungeon_prep';
  private interactionState: BattleInteractionState = 'idle';

  private selectedUnitId: string | null = null;
  private inspectedTile: { x: number; y: number } = { x: 3, y: 5 };
  private hoveredTile: { x: number; y: number } | null = null;
  private previewPath: AStarPathStep[] | null = null;
  private currentRange: MovementRangeResult | null = null;

  private uncommittedOrigin: {
    unitId: string;
    x: number;
    y: number;
    direction: PmdDirection;
  } | null = null;
  private originRangeSnapshot: MovementRangeResult | null = null;

  // Forecast Modal State (`attack` vs `heal`)
  private forecastMode: 'attack' | 'heal' = 'attack';
  private forecastReturnMode: 'unit_selected' | 'action_menu' = 'unit_selected';
  private forecastTargetId: string | null = null;
  private forecastMoveId: string | null = null;
  private currentForecast: CombatForecast | null = null;
  private currentHealForecast: HealForecast | null = null;

  // Walking interpolation state (used for both player movement & enemy AI movement)
  private activeWalk: {
    unitId: string;
    steps: AStarPathStep[];
    segmentIndex: number;
    segmentElapsedMs: number;
    lastTickMs: number;
    followCamera: boolean;
    onComplete: () => void;
  } | null = null;

  // Combat visual effects & floating callouts
  private readonly floatingTexts: FloatingBattleText[] = [];
  private nextFloatingTextId = 1;
  private activeStrikeVfx: ActiveStrikeVfx | null = null;

  // Danger Area
  private globalDangerEnabled = false;
  private readonly trackedEnemyIds = new Set<string>();
  private currentDanger: DangerAreaResult = {
    globalDangerTiles: new Set(),
    individualDangerTiles: new Set(),
    combinedDangerTiles: new Set(),
  };

  // Camera in 1x native PMD world pixels
  private cameraX = 0;
  private cameraY = 0;
  private bufferWidth = 320;
  private bufferHeight = 240;
  private displayScale = MAP_DEFAULT_SCALE;
  private readonly pinchTracker = new MultiTouchPinchTracker();

  private systemMenuOpen = false;
  private fastMode = false;
  private customRng: (() => number) | null = null;

  private readonly tilesetSheets = new Map<string, LoadedTilesetSheet>();
  private readonly spriteBundles = new Map<string, LoadedSpriteBundle>();
  private phaseBannerTimer: number | null = null;
  private selectionPulseStartMs = 0;

  constructor(options: BattleSceneOptions) {
    this.viewportEl = options.viewportEl;
    this.saveManager = options.saveManager;
    this.audioManager = options.audioManager ?? getAudioManager();
    this.onExitCallback = options.onExit;
    this.onLayerStateChanged = options.onLayerStateChanged;
    this.onRequestRenameUnit = options.onRequestRenameUnit;

    this.tintScratchCanvas = document.createElement('canvas');
    this.tintScratchCanvas.width = 96;
    this.tintScratchCanvas.height = 96;
    this.tintScratchCtx = this.tintScratchCanvas.getContext('2d')!;
    this.tintScratchCtx.imageSmoothingEnabled = false;

    this.rootEl = document.createElement('section');
    this.rootEl.id = 'pmd-battle-scene';
    this.rootEl.className = 'pmd-battle-scene';
    this.rootEl.hidden = true;
    this.rootEl.dataset.testid = 'battle-scene';

    // 1. Canvas Stage
    this.canvasStageEl = document.createElement('div');
    this.canvasStageEl.className = 'pmd-battle-canvas-stage';
    this.canvasStageEl.dataset.noLongpress = 'true';

    this.canvas = document.createElement('canvas');
    this.canvas.className = 'pmd-battle-canvas pmd-pixelated';
    this.canvas.dataset.testid = 'battle-canvas';
    this.canvas.style.imageRendering = 'pixelated';
    this.canvas.style.flexShrink = '0';
    this.ctx = this.canvas.getContext('2d')!;
    this.ctx.imageSmoothingEnabled = false;
    this.canvasStageEl.appendChild(this.canvas);

    // 2. Top Tactical HUD Bar
    this.topHudBarEl = document.createElement('div');
    this.topHudBarEl.className = 'pmd-battle-hud-top';

    this.turnBadgeEl = document.createElement('span');
    this.turnBadgeEl.className =
      'pmd-window pmd-window--compact pmd-window--translucent pmd-battle-pill';
    this.turnBadgeEl.dataset.testid = 'battle-hud-turn';
    this.turnBadgeEl.textContent = 'Turn 1 · Player';

    this.dangerBtnEl = document.createElement('button');
    this.dangerBtnEl.type = 'button';
    this.dangerBtnEl.className = 'pmd-btn pmd-battle-hud-btn';
    this.dangerBtnEl.dataset.testid = 'battle-hud-danger-btn';
    this.dangerBtnEl.textContent = 'Danger: OFF';

    this.endPhaseBtnEl = document.createElement('button');
    this.endPhaseBtnEl.type = 'button';
    this.endPhaseBtnEl.className = 'pmd-btn pmd-btn-primary pmd-battle-hud-btn';
    this.endPhaseBtnEl.dataset.testid = 'battle-end-phase-btn';
    this.endPhaseBtnEl.textContent = 'End Phase';

    this.topHudBarEl.append(this.turnBadgeEl, this.dangerBtnEl, this.endPhaseBtnEl);

    // 3. Phase Transition Toast Banner
    this.phaseBannerEl = document.createElement('div');
    this.phaseBannerEl.className = 'pmd-window pmd-window--translucent pmd-battle-phase-banner';
    this.phaseBannerEl.dataset.testid = 'dungeon-phase-banner';
    this.phaseBannerEl.hidden = true;

    // 4. Bottom Terrain & Unit Info Strip
    this.infoStripEl = document.createElement('div');
    this.infoStripEl.className = 'pmd-window pmd-window--translucent pmd-battle-info-strip';
    this.infoStripEl.dataset.testid = 'dungeon-info-strip';

    // 5. Floating Command Menu (`Attack` / `Heal` / `Item` / `Wait` / `Cancel`)
    this.actionMenuEl = document.createElement('div');
    this.actionMenuEl.className =
      'pmd-window pmd-window--translucent pmd-battle-action-menu pmd-menu-list';
    this.actionMenuEl.dataset.testid = 'dungeon-cmd-menu';
    this.actionMenuEl.hidden = true;
    this.actionMenuEl.innerHTML = `
      <button type="button" class="pmd-btn pmd-btn-primary pmd-menu-row pmd-battle-cmd-btn" data-testid="dungeon-cmd-attack">Attack</button>
      <button type="button" class="pmd-btn pmd-btn-primary pmd-menu-row pmd-battle-cmd-btn" data-testid="dungeon-cmd-heal" hidden>Heal</button>
      <button type="button" class="pmd-btn pmd-btn-primary pmd-menu-row pmd-battle-cmd-btn" data-testid="dungeon-cmd-item" hidden>Item</button>
      <button type="button" class="pmd-btn pmd-menu-row pmd-battle-cmd-btn" data-testid="dungeon-cmd-wait">Wait</button>
      <button type="button" class="pmd-btn pmd-menu-row pmd-battle-cmd-btn" data-testid="dungeon-cmd-cancel">Cancel</button>
    `;
    this.cmdAttackBtnEl = this.actionMenuEl.querySelector('[data-testid="dungeon-cmd-attack"]')!;
    this.cmdHealBtnEl = this.actionMenuEl.querySelector('[data-testid="dungeon-cmd-heal"]')!;
    this.cmdItemBtnEl = this.actionMenuEl.querySelector('[data-testid="dungeon-cmd-item"]')!;
    this.cmdWaitBtnEl = this.actionMenuEl.querySelector('[data-testid="dungeon-cmd-wait"]')!;
    this.cmdCancelBtnEl = this.actionMenuEl.querySelector('[data-testid="dungeon-cmd-cancel"]')!;

    // 6. Fire Emblem Combat Forecast Modal
    this.attackerPortraitView = new PmdPortraitView({
      pixelScale: 1,
      testId: 'forecast-attacker-portrait',
    });
    this.defenderPortraitView = new PmdPortraitView({
      pixelScale: 1,
      testId: 'forecast-defender-portrait',
    });

    this.forecastModalBackdropEl = document.createElement('div');
    this.forecastModalBackdropEl.className = 'pmd-battle-modal-backdrop';
    this.forecastModalBackdropEl.dataset.testid = 'battle-forecast-modal';
    this.forecastModalBackdropEl.hidden = true;
    this.forecastModalBackdropEl.innerHTML = `
      <div class="pmd-window pmd-window--gold pmd-battle-forecast-dialog" role="dialog" aria-modal="true" aria-label="Combat Forecast">
        <div class="pmd-forecast-header">
          <div>
            <h3 class="pmd-panel-title" data-forecast-title>COMBAT FORECAST</h3>
            <p class="pmd-panel-sub" data-forecast-subtitle>Range 1 · Physical</p>
          </div>
          <span class="pmd-forecast-eff-badge" data-testid="forecast-effectiveness-badge">Neutral (1x)</span>
        </div>

        <div class="pmd-forecast-selector-row" data-forecast-targets-wrap hidden>
          <span class="pmd-preset-label">Target:</span>
          <div class="pmd-inline-btns" data-forecast-targets></div>
        </div>

        <div class="pmd-forecast-selector-row">
          <span class="pmd-preset-label">Move:</span>
          <div class="pmd-inline-btns" data-forecast-moves></div>
        </div>

        <div class="pmd-forecast-versus-grid">
          <!-- Attacker / Healer Card (Blue) -->
          <div class="pmd-forecast-side is-attacker" data-testid="forecast-attacker-card">
            <div class="pmd-forecast-unit-head">
              <div class="pmd-forecast-portrait-slot" data-attacker-portrait-slot></div>
              <div class="pmd-forecast-unit-id">
                <strong class="pmd-forecast-unit-name" data-testid="forecast-attacker-name">—</strong>
                <span class="pmd-forecast-unit-meta" data-attacker-meta>—</span>
                <span class="pmd-forecast-move-line" data-testid="forecast-attacker-weapon">—</span>
              </div>
            </div>
            <div class="pmd-forecast-hp-bar-track">
              <div class="pmd-forecast-hp-bar-ghost" data-attacker-hp-cur-bar></div>
              <div class="pmd-forecast-hp-bar-fill" data-attacker-hp-proj-bar></div>
            </div>
            <div class="pmd-forecast-stats-grid">
              <div class="pmd-forecast-stat">
                <span>HP</span>
                <strong data-testid="forecast-attacker-hp">—</strong>
              </div>
              <div class="pmd-forecast-stat">
                <span data-atk-stat2-label>DMG</span>
                <strong data-testid="forecast-attacker-dmg">—</strong>
              </div>
              <div class="pmd-forecast-stat">
                <span data-atk-stat3-label>HIT</span>
                <strong data-testid="forecast-attacker-hit">—</strong>
              </div>
              <div class="pmd-forecast-stat">
                <span data-atk-stat4-label>CRIT</span>
                <strong data-testid="forecast-attacker-crit">—</strong>
              </div>
            </div>
          </div>

          <!-- Defender / Heal Target Card -->
          <div class="pmd-forecast-side is-defender" data-testid="forecast-defender-card">
            <div class="pmd-forecast-unit-head">
              <div class="pmd-forecast-portrait-slot" data-defender-portrait-slot></div>
              <div class="pmd-forecast-unit-id">
                <strong class="pmd-forecast-unit-name" data-testid="forecast-defender-name">—</strong>
                <span class="pmd-forecast-unit-meta" data-defender-meta>—</span>
                <span class="pmd-forecast-move-line" data-testid="forecast-defender-weapon">—</span>
              </div>
            </div>
            <div class="pmd-forecast-hp-bar-track">
              <div class="pmd-forecast-hp-bar-ghost" data-defender-hp-cur-bar></div>
              <div class="pmd-forecast-hp-bar-fill is-enemy" data-defender-hp-proj-bar></div>
            </div>
            <div class="pmd-forecast-stats-grid">
              <div class="pmd-forecast-stat">
                <span>HP</span>
                <strong data-testid="forecast-defender-hp">—</strong>
              </div>
              <div class="pmd-forecast-stat">
                <span data-def-stat2-label>DMG</span>
                <strong data-testid="forecast-defender-dmg">—</strong>
              </div>
              <div class="pmd-forecast-stat">
                <span data-def-stat3-label>HIT</span>
                <strong data-testid="forecast-defender-hit">—</strong>
              </div>
              <div class="pmd-forecast-stat">
                <span data-def-stat4-label>CRIT</span>
                <strong data-testid="forecast-defender-crit">—</strong>
              </div>
            </div>
          </div>
        </div>

        <div class="pmd-forecast-actions">
          <button type="button" class="pmd-btn pmd-btn-primary" data-testid="forecast-attack-btn">Attack!</button>
          <button type="button" class="pmd-btn" data-testid="forecast-cancel-btn">Cancel</button>
        </div>
      </div>
    `;
    this.forecastModalBackdropEl
      .querySelector('[data-attacker-portrait-slot]')
      ?.appendChild(this.attackerPortraitView.canvas);
    this.forecastModalBackdropEl
      .querySelector('[data-defender-portrait-slot]')
      ?.appendChild(this.defenderPortraitView.canvas);

    // 8. Battlefield System Menu Modal (Right-Click / Corner Menu)
    this.systemMenuBackdropEl = document.createElement('div');
    this.systemMenuBackdropEl.className = 'pmd-battle-modal-backdrop';
    this.systemMenuBackdropEl.dataset.testid = 'dungeon-system-menu';
    this.systemMenuBackdropEl.hidden = true;
    this.systemMenuBackdropEl.innerHTML = `
      <div class="pmd-window pmd-battle-system-dialog" role="dialog" aria-modal="true" aria-label="Battlefield Menu">
        <h3 class="pmd-panel-title">BATTLE MENU</h3>
        <p class="pmd-panel-sub" data-sys-sub>Turn 1 · Beach Cave</p>
        <div class="pmd-battle-system-actions pmd-menu-list">
          <button type="button" class="pmd-btn pmd-menu-row" data-testid="battle-sys-danger">Danger Area: OFF</button>
          <button type="button" class="pmd-btn pmd-menu-row" data-testid="battle-sys-audio">Audio: ON</button>
          <button type="button" class="pmd-btn pmd-btn-primary pmd-menu-row" data-testid="battle-sys-end-phase">End Phase</button>
          <button type="button" class="pmd-btn pmd-menu-row" data-testid="battle-sys-restart">Restart Match</button>
          <button type="button" class="pmd-btn pmd-btn-danger pmd-menu-row" data-testid="battle-sys-exit">Return to Menu</button>
          <button type="button" class="pmd-btn pmd-menu-row" data-testid="battle-sys-resume">Resume</button>
        </div>
      </div>
    `;
    this.systemDangerBtnEl = this.systemMenuBackdropEl.querySelector(
      '[data-testid="battle-sys-danger"]'
    )!;
    this.systemAudioBtnEl = this.systemMenuBackdropEl.querySelector(
      '[data-testid="battle-sys-audio"]'
    )!;
    this.systemEndPhaseBtnEl = this.systemMenuBackdropEl.querySelector(
      '[data-testid="battle-sys-end-phase"]'
    )!;

    // 9. `VICTORY!` Modal
    this.victoryModalBackdropEl = document.createElement('div');
    this.victoryModalBackdropEl.className = 'pmd-battle-modal-backdrop';
    this.victoryModalBackdropEl.dataset.testid = 'battle-victory-modal';
    this.victoryModalBackdropEl.hidden = true;
    this.victoryModalBackdropEl.innerHTML = `
      <div class="pmd-window pmd-window--gold pmd-battle-outcome-dialog" role="dialog" aria-modal="true" aria-labelledby="battle-victory-title">
        <span class="pmd-battle-kicker is-victory">STAGE CLEAR</span>
        <h2 id="battle-victory-title" class="pmd-panel-title">VICTORY!</h2>
        <p class="pmd-panel-sub" data-victory-sub>All enemy forces have been routed!</p>
        <p class="pmd-subcard-text" data-victory-summary></p>
        <div class="pmd-battle-outcome-actions">
          <button type="button" class="pmd-btn pmd-btn-primary" data-testid="victory-replay-btn">Play Again</button>
          <button type="button" class="pmd-btn" data-testid="victory-exit-btn">Return to Menu</button>
        </div>
      </div>
    `;

    // 10. `DEFEAT` Modal
    this.defeatModalBackdropEl = document.createElement('div');
    this.defeatModalBackdropEl.className = 'pmd-battle-modal-backdrop';
    this.defeatModalBackdropEl.dataset.testid = 'battle-defeat-modal';
    this.defeatModalBackdropEl.hidden = true;
    this.defeatModalBackdropEl.innerHTML = `
      <div class="pmd-window pmd-battle-outcome-dialog is-defeat-window" role="dialog" aria-modal="true" aria-labelledby="battle-defeat-title">
        <span class="pmd-battle-kicker is-defeat">DEFEATED</span>
        <h2 id="battle-defeat-title" class="pmd-panel-title is-danger-title">DEFEAT</h2>
        <p class="pmd-panel-sub" data-defeat-sub>Your Dragon Lord fell in battle.</p>
        <p class="pmd-subcard-text" data-defeat-summary>Regroup and challenge the dungeon again from Turn 1.</p>
        <div class="pmd-battle-outcome-actions">
          <button type="button" class="pmd-btn pmd-btn-primary" data-testid="defeat-restart-btn">Restart Match</button>
          <button type="button" class="pmd-btn" data-testid="defeat-exit-btn">Return to Menu</button>
        </div>
      </div>
    `;

    // 10b. Fire Emblem-Style Level-Up Growth Modal
    this.levelUpPortraitView = new PmdPortraitView({
      pixelScale: 1,
      testId: 'levelup-portrait',
    });
    this.levelUpModalBackdropEl = document.createElement('div');
    this.levelUpModalBackdropEl.className = 'pmd-battle-modal-backdrop';
    this.levelUpModalBackdropEl.dataset.testid = 'battle-levelup-modal';
    this.levelUpModalBackdropEl.hidden = true;
    this.levelUpModalBackdropEl.style.zIndex = '94';
    this.levelUpModalBackdropEl.innerHTML = `
      <div class="pmd-window pmd-window--gold pmd-battle-outcome-dialog" role="dialog" aria-modal="true" aria-label="Level Up" style="width:min(420px, 94vw);">
        <span class="pmd-battle-kicker is-victory">LEVEL UP!</span>
        <div class="pmd-forecast-unit-head" style="justify-content:center; margin:0.35rem 0 0.5rem;">
          <div class="pmd-forecast-portrait-slot" data-levelup-portrait-slot></div>
          <div class="pmd-forecast-unit-id" style="text-align:left;">
            <strong class="pmd-forecast-unit-name" data-testid="levelup-unit-title">—</strong>
            <span class="pmd-forecast-unit-meta" data-testid="levelup-level-line">Lv. 9 → Lv. 10</span>
          </div>
        </div>
        <div class="pmd-prep-stats-grid" data-testid="levelup-stats-grid" style="margin-bottom:0.5rem;"></div>
        <p class="pmd-subcard-text" data-testid="levelup-extra-notes" style="color:#98f8b8; margin:0.25rem 0 0.5rem;" hidden></p>
        <div class="pmd-battle-outcome-actions">
          <button type="button" class="pmd-btn pmd-btn-primary" data-testid="levelup-continue-btn" style="min-height:44px;">Continue</button>
        </div>
      </div>
    `;
    this.levelUpModalBackdropEl
      .querySelector('[data-levelup-portrait-slot]')
      ?.appendChild(this.levelUpPortraitView.canvas);

    this.rootEl.append(
      this.canvasStageEl,
      this.topHudBarEl,
      this.phaseBannerEl,
      this.infoStripEl,
      this.actionMenuEl,
      this.forecastModalBackdropEl,
      this.levelUpModalBackdropEl,
      this.systemMenuBackdropEl,
      this.victoryModalBackdropEl,
      this.defeatModalBackdropEl
    );

    // 10. Step 6 Dungeon Prep Phase Overlay (`Manage Units`, `Manage Items`, `View Map`, `Enter Dungeon`)
    this.prepOverlay = new DungeonPrepOverlay({
      parentEl: this.rootEl,
      audioManager: this.audioManager,
      getSaveManager: () => this.getActivePrepSaveManager(),
      getMap: () => this.map,
      getEnemyCount: () => this.getLivingEnemies().length,
      getObjectiveLabel: () => this.objectiveLabel,
      getDeploymentSlots: () => this.deploymentSlots,
      getDeploymentCap: () => getMapDeploymentCap(this.map),
      getGlobalDangerEnabled: () => this.globalDangerEnabled,
      getSelectedSwapSlotIndex: () => this.prepSwapSlotIndex,
      onToggleDeployUnit: (instanceId) => this.togglePrepDeployUnit(instanceId),
      onRosterOrLoadoutMutated: () => this.rebuildPrepBattleUnits(),
      onRequestRenameUnit: (instanceId) => this.onRequestRenameUnit?.(instanceId),
      onEnterViewMap: () => {
        this.prepSwapSlotIndex = null;
        this.syncPrepChromeVisibility();
        this.updateInfoStrip();
        this.renderFrame(performance.now());
      },
      onExitViewMap: () => {
        this.prepSwapSlotIndex = null;
        this.syncPrepChromeVisibility();
        this.renderFrame(performance.now());
      },
      onToggleGlobalDanger: () => this.toggleGlobalDangerArea(),
      onConfirmEnterDungeon: () => this.confirmEnterDungeonFromPrep(),
      onSubLayerChanged: () => {
        this.syncPrepChromeVisibility();
        this.onLayerStateChanged();
      },
    });

    this.viewportEl.appendChild(this.rootEl);

    this.unsubscribeMapChanges = subscribeChapterMapChanges((changedLevelId) => {
      if (
        this.openState &&
        this.phase === 'dungeon_prep' &&
        !this.explicitCustomMap &&
        (changedLevelId === null || changedLevelId === this.activeLevelId)
      ) {
        this.map = getEffectiveChapterMap(this.activeLevelId);
        this.enemySpawnDefs = resolveEnemySpawnsForMap(this.map, this.explicitEnemyOverrides);
        void this.setupFreshBattleState().then(() => {
          if (this.openState) {
            this.renderFrame(performance.now());
          }
        });
      }
    });

    this.bindPointerInteractions();
  }

  // ==========================================================================
  // Public Lifecycle & Back-Stack Integration
  // ==========================================================================

  public isOpen(): boolean {
    return this.openState;
  }

  public hasActiveSubLayer(): boolean {
    if (!this.openState) return false;
    if (!this.levelUpModalBackdropEl.hidden) return true;
    if (this.systemMenuOpen) return true;
    if (this.phase === 'dungeon_prep') {
      return this.prepSwapSlotIndex !== null || this.prepOverlay.hasActiveSubLayer();
    }
    return (
      this.interactionState === 'combat_forecast' ||
      this.interactionState === 'action_menu' ||
      this.interactionState === 'unit_selected'
    );
  }

  public async open(options?: {
    levelId?: string;
    customMap?: DungeonMapDefinition;
    enemyOverrides?: ReadonlyArray<ManualEnemyBattleSpawn>;
    objectiveType?: BattleObjectiveType;
    objectiveLabel?: string;
    reinforcements?: ReadonlyArray<ReinforcementWaveDefinition>;
    commitToSaveOnVictory?: boolean;
    clearRewardItems?: ReadonlyArray<ConvoyEntry>;
    pauseOnLevelUpInFastMode?: boolean;
    onVictory?: () => void;
    exitButtonLabel?: string;
    hideReplayOnVictory?: boolean;
  }): Promise<void> {
    this.battleRunGen += 1;
    this.activeLevelId = options?.levelId?.trim() || options?.customMap?.id || 'prologue';
    this.explicitCustomMap = options?.customMap ? cloneDungeonMap(options.customMap) : null;
    this.explicitEnemyOverrides = options?.enemyOverrides;
    this.explicitObjectiveType = options?.objectiveType;
    this.explicitObjectiveLabel = options?.objectiveLabel;
    this.reinforcements = options?.reinforcements ?? [];
    this.commitToSaveOnVictory = Boolean(options?.commitToSaveOnVictory);
    this.clearRewardItems = options?.clearRewardItems ?? [];
    this.pauseOnLevelUpInFastMode = Boolean(options?.pauseOnLevelUpInFastMode);
    this.currentOnVictory = options?.onVictory;
    this.victoryCallbackFired = false;

    const exitLabel = options?.exitButtonLabel ?? 'Return to Menu';
    const hideReplay = Boolean(options?.hideReplayOnVictory);
    const victoryReplayBtn = this.victoryModalBackdropEl.querySelector<HTMLElement>(
      '[data-testid="victory-replay-btn"]'
    );
    if (victoryReplayBtn) {
      victoryReplayBtn.hidden = hideReplay;
    }
    const victoryExitBtn = this.victoryModalBackdropEl.querySelector<HTMLElement>(
      '[data-testid="victory-exit-btn"]'
    );
    if (victoryExitBtn) {
      victoryExitBtn.textContent = exitLabel;
    }
    const defeatExitBtn = this.defeatModalBackdropEl.querySelector<HTMLElement>(
      '[data-testid="defeat-exit-btn"]'
    );
    if (defeatExitBtn) {
      defeatExitBtn.textContent = exitLabel;
    }
    const sysExitBtn = this.systemMenuBackdropEl.querySelector<HTMLElement>(
      '[data-testid="battle-sys-exit"]'
    );
    if (sysExitBtn) {
      sysExitBtn.textContent = exitLabel;
    }

    if (this.explicitCustomMap) {
      this.map = cloneDungeonMap(this.explicitCustomMap);
    } else {
      this.map = getEffectiveChapterMap(this.activeLevelId);
    }
    this.objectiveType = this.explicitObjectiveType ?? this.map.objectiveType ?? 'rout';
    this.objectiveLabel =
      this.explicitObjectiveLabel ??
      (this.objectiveType === 'defeat_boss' ? 'Defeat the Enemy Leader' : 'Rout All Enemies');
    this.enemySpawnDefs = resolveEnemySpawnsForMap(this.map, this.explicitEnemyOverrides);

    if (this.saveManager.getSave() === null) {
      this.guestPrepManager?.dispose();
      this.guestPrepManager = createFallbackBattlePrepManager(
        Math.max(5, getMapDeploymentCap(this.map) + 2)
      );
    }

    if (!this.openState) {
      this.previousBgmId = this.audioManager.getCurrentTrackId();
    }

    this.openState = true;
    this.displayScale = MAP_DEFAULT_SCALE;
    this.pinchTracker.reset();
    this.rootEl.hidden = false;
    this.viewportEl.classList.add('is-battle-active');

    await this.setupFreshBattleState();

    this.syncViewportDimensions();
    const lord = this.getLordUnit() ?? this.units[0];
    this.centerCameraOnTile(lord?.x ?? 3, lord?.y ?? 5);

    this.audioManager.playBgm(this.map.bgmCue || 'drenched_bluff', { fadeMs: 300 });
    this.startLoop();
    this.onLayerStateChanged();
    this.renderFrame(performance.now());
  }

  public close(): void {
    if (!this.openState) return;
    this.battleRunGen += 1;
    this.openState = false;
    this.stopLoop();
    this.pinchTracker.reset();
    this.activeWalk = null;
    this.activeStrikeVfx = null;
    this.floatingTexts.length = 0;
    this.prepSwapSlotIndex = null;
    this.hideAllModals();
    this.clearSelection();
    this.rootEl.hidden = true;
    this.viewportEl.classList.remove('is-battle-active');

    if (this.previousBgmId) {
      this.audioManager.playBgm(this.previousBgmId, { fadeMs: 280 });
    } else {
      this.audioManager.playBgm('top_menu', { fadeMs: 280 });
    }

    this.onLayerStateChanged();
    this.onExitCallback();
  }

  public destroy(): void {
    this.battleRunGen += 1;
    this.stopLoop();
    if (this.phaseBannerTimer !== null) {
      window.clearTimeout(this.phaseBannerTimer);
      this.phaseBannerTimer = null;
    }
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    this.unsubscribeMapChanges?.();
    this.unsubscribeMapChanges = null;
    this.guestPrepManager?.dispose();
    this.guestPrepManager = null;
    this.prepOverlay.destroy();
    this.abortController.abort();
    this.viewportEl.classList.remove('is-battle-active');
    this.rootEl.remove();
  }

  /**
   * Unified Back / Right-Click / Long-Press / Corner Menu handler (Rule 2).
   */
  public handleMenuOrBack(): void {
    if (!this.openState) return;

    if (!this.levelUpModalBackdropEl.hidden) {
      this.dismissLevelUpModal();
      return;
    }

    if (this.systemMenuOpen) {
      this.audioManager.playSfx('cancel');
      this.closeSystemMenu();
      return;
    }

    if (this.phase === 'victory' || this.phase === 'defeat') {
      return;
    }

    if (this.phase === 'dungeon_prep') {
      if (this.prepSwapSlotIndex !== null) {
        this.prepSwapSlotIndex = null;
        this.audioManager.playSfx('cancel');
        this.prepOverlay.syncMapHudState();
        this.updateInfoStrip();
        this.onLayerStateChanged();
        this.renderFrame(performance.now());
        return;
      }
      if (this.prepOverlay.handleBack()) {
        this.syncPrepChromeVisibility();
        this.onLayerStateChanged();
        this.renderFrame(performance.now());
        return;
      }
      this.openSystemMenu();
      return;
    }

    if (
      this.phase === 'enemy_phase' ||
      this.interactionState === 'walking' ||
      this.interactionState === 'combat_animating' ||
      this.interactionState === 'enemy_acting'
    ) {
      return;
    }

    if (this.interactionState === 'combat_forecast') {
      this.cancelCombatForecast();
      return;
    }

    if (this.interactionState === 'action_menu') {
      this.cancelUncommittedMove();
      return;
    }

    if (this.interactionState === 'unit_selected') {
      this.audioManager.playSfx('cancel');
      this.clearSelection();
      this.updateInfoStrip();
      this.onLayerStateChanged();
      this.renderFrame(performance.now());
      return;
    }

    this.openSystemMenu();
  }

  public async restartMatch(): Promise<void> {
    if (!this.openState) return;
    this.battleRunGen += 1;
    this.audioManager.playSfx('select');
    if (this.explicitCustomMap) {
      this.map = cloneDungeonMap(this.explicitCustomMap);
    } else {
      this.map = getEffectiveChapterMap(this.activeLevelId);
    }
    this.objectiveType = this.explicitObjectiveType ?? this.map.objectiveType ?? 'rout';
    this.objectiveLabel =
      this.explicitObjectiveLabel ??
      (this.objectiveType === 'defeat_boss' ? 'Defeat the Enemy Leader' : 'Rout All Enemies');
    this.enemySpawnDefs = resolveEnemySpawnsForMap(this.map, this.explicitEnemyOverrides);
    await this.setupFreshBattleState();
    const lord = this.getLordUnit() ?? this.units[0];
    this.centerCameraOnTile(lord?.x ?? 3, lord?.y ?? 5);
    this.audioManager.playBgm(this.map.bgmCue || 'drenched_bluff', {
      fadeMs: 250,
      restart: true,
    });
    this.onLayerStateChanged();
    this.renderFrame(performance.now());
  }

  // ==========================================================================
  // Diagnostics & Playwright Verification Helpers
  // ==========================================================================

  public setFastMode(enabled: boolean): void {
    this.fastMode = Boolean(enabled);
  }

  public setPauseOnLevelUpInFastMode(enabled: boolean): void {
    this.pauseOnLevelUpInFastMode = Boolean(enabled);
  }

  public setRng(rngFn: (() => number) | null): void {
    this.customRng = rngFn;
  }

  public forceUnitHpForTest(unitId: string, nextHp: number): void {
    const u = this.units.find((item) => item.id === unitId);
    if (!u) return;
    u.currentHp = Math.max(0, Math.min(u.maxHp, Math.round(nextHp)));
    if (u.currentHp <= 0) {
      u.defeated = true;
    } else {
      u.defeated = false;
      u.koDissolveProgress = 0;
    }
    this.recomputeDangerArea();
    this.updateInfoStrip();
    this.renderFrame(performance.now());
  }

  public forceUnitPositionForTest(unitId: string, x: number, y: number): void {
    const u = this.units.find((item) => item.id === unitId);
    if (!u || !isInMapBounds(this.map, x, y)) return;
    u.x = x;
    u.y = y;
    u.renderWorldX = x * PMD_TILE_NATIVE_PX;
    u.renderWorldY = y * PMD_TILE_NATIVE_PX;
    this.recomputeDangerArea();
    if (this.selectedUnitId === unitId) {
      this.recomputeSelectedUnitRange();
    }
    this.updateInfoStrip();
    this.renderFrame(performance.now());
  }

  public cheatFullHealSquad(): void {
    if (!this.openState) return;
    for (const u of this.units) {
      if (u.faction !== 'player' || u.defeated) continue;
      u.currentHp = u.maxHp;
      u.status = null;
      u.statusTurns = 0;
      u.waited = false;
      for (const slot of u.activeMoves) {
        slot.ppRemaining = slot.maxPp;
      }
      this.spawnFloatingText(u.x, u.y, 'FULL HEAL!', '#68f8a8', 900);
    }
    this.audioManager.playSfx('heal');
    this.showPhaseBanner('SQUAD FULLY RESTORED!');
    this.recomputeDangerArea();
    this.syncHudControls();
    this.updateInfoStrip();
    this.renderFrame(performance.now());
  }

  public cheatInstantWin(): void {
    if (!this.openState) return;
    if (this.phase === 'dungeon_prep') {
      this.confirmEnterDungeonFromPrep();
    }
    if (this.phase !== 'player_phase' && this.phase !== 'enemy_phase') {
      return;
    }
    this.battleRunGen += 1;
    this.activeWalk = null;
    this.activeStrikeVfx = null;
    for (const enemy of this.getLivingEnemies()) {
      if (enemy.droppableItemId) {
        this.collectedDrops.push(enemy.droppableItemId);
        enemy.droppableItemId = null;
      }
      enemy.currentHp = 0;
      enemy.defeated = true;
      this.trackedEnemyIds.delete(enemy.id);
    }
    this.recomputeDangerArea();
    this.triggerVictoryModal();
  }

  public refreshFromExternalSaveCheat(): void {
    if (!this.openState) return;
    if (this.phase === 'dungeon_prep') {
      const activeSave = this.getActivePrepSaveManager().getSave();
      if (activeSave) {
        const rosterIds = new Set(activeSave.roster.map((u) => u.instanceId));
        const slotsStillValid =
          this.deploymentSlots.length > 0 &&
          this.deploymentSlots.every(
            (s) => s.unitInstanceId === null || rosterIds.has(s.unitInstanceId)
          ) &&
          this.deploymentSlots.some((s) => s.unitInstanceId !== null);
        if (!slotsStillValid) {
          this.deploymentSlots = createInitialPrepDeploymentSlots(this.map, activeSave.roster);
        }
        this.rebuildPrepBattleUnits();
        this.prepOverlay.refreshAll();
      }
    }
  }

  public centerCameraOnTile(tx: number, ty: number): void {
    const targetWorldX =
      tx * PMD_TILE_NATIVE_PX + PMD_TILE_NATIVE_PX / 2 - this.bufferWidth / 2;
    const targetWorldY =
      ty * PMD_TILE_NATIVE_PX + PMD_TILE_NATIVE_PX / 2 - this.bufferHeight / 2;
    this.setCameraPosition(targetWorldX, targetWorldY);
    this.renderFrame(performance.now());
  }

  public setZoomScale(
    nextScale: number,
    anchorClientX?: number,
    anchorClientY?: number
  ): void {
    const rect = this.canvasStageEl.getBoundingClientRect();
    const cx = anchorClientX ?? rect.left + rect.width / 2;
    const cy = anchorClientY ?? rect.top + rect.height / 2;
    const anchor = this.clientPointToWorld(cx, cy);
    this.applyZoomWithWorldAnchor(clampMapScale(nextScale), cx, cy, anchor.worldX, anchor.worldY);
    this.renderFrame(performance.now());
  }

  public getTileClientCenter(tx: number, ty: number): { clientX: number; clientY: number } {
    const rect = this.canvas.getBoundingClientRect();
    const worldCenterX = tx * PMD_TILE_NATIVE_PX + PMD_TILE_NATIVE_PX / 2;
    const worldCenterY = ty * PMD_TILE_NATIVE_PX + PMD_TILE_NATIVE_PX / 2;
    const localCssX = (worldCenterX - this.cameraX) * this.displayScale;
    const localCssY = (worldCenterY - this.cameraY) * this.displayScale;
    return {
      clientX: rect.left + localCssX,
      clientY: rect.top + localCssY,
    };
  }

  public getUnits(): ReadonlyArray<BattleUnitState> {
    return this.units;
  }

  public getMap(): DungeonMapDefinition {
    return cloneDungeonMap(this.map);
  }

  public getTileAt(x: number, y: number) {
    if (!isInMapBounds(this.map, x, y)) return null;
    const cell = this.map.tiles[y]?.[x];
    return cell ? { ...cell } : null;
  }

  public getCurrentForecast(): CombatForecast | null {
    return this.currentForecast;
  }

  public getCurrentHealForecast(): HealForecast | null {
    return this.currentHealForecast;
  }

  public getPrepSaveManager(): SaveStateManager {
    return this.getActivePrepSaveManager();
  }

  public getSnapshot(): BattleSceneSnapshot {
    const bounds = this.getMaxCameraBounds();
    return {
      isOpen: this.openState,
      phase: this.phase,
      objectiveType: this.objectiveType,
      objectiveLabel: this.objectiveLabel,
      prepSubMode: this.phase === 'dungeon_prep' && this.prepOverlay.isOpen() ? this.prepOverlay.getSubMode() : null,
      deploymentSlots: this.deploymentSlots.map((s) => ({ ...s })),
      prepSwapSlotIndex: this.prepSwapSlotIndex,
      interactionState: this.interactionState,
      turnNumber: this.turnNumber,
      selectedUnitId: this.selectedUnitId,
      forecastMode: this.interactionState === 'combat_forecast' ? this.forecastMode : null,
      forecastTargetId: this.forecastTargetId,
      forecastMoveId: this.forecastMoveId,
      systemMenuOpen: this.systemMenuOpen,
      levelUpModalOpen: !this.levelUpModalBackdropEl.hidden,
      levelUpHistory: this.levelUpHistory.map((h) => ({
        ...h,
        statGains: { ...h.statGains },
        statsBefore: { ...h.statsBefore },
        statsAfter: { ...h.statsAfter },
        newlyLearnedMoveIds: [...h.newlyLearnedMoveIds],
      })),
      collectedDrops: [...this.collectedDrops],
      spawnedReinforcementIds: [...this.spawnedReinforcementIds],
      blockedReinforcementIds: [...this.blockedReinforcementIds],
      globalDangerEnabled: this.globalDangerEnabled,
      trackedEnemyIds: [...this.trackedEnemyIds],
      fastMode: this.fastMode,
      camera: {
        x: this.cameraX,
        y: this.cameraY,
        minX: bounds.minX,
        minY: bounds.minY,
        maxX: bounds.maxX,
        maxY: bounds.maxY,
        bufferWidth: this.bufferWidth,
        bufferHeight: this.bufferHeight,
        displayScale: this.displayScale,
        imageSmoothingEnabled: this.ctx.imageSmoothingEnabled,
      },
      map: {
        id: this.map.id,
        name: this.map.name,
        width: this.map.width,
        height: this.map.height,
        isCustomized: hasChapterMapOverride(this.map.id),
      },
      units: this.units.map((u) => ({
        id: u.id,
        rosterInstanceId: u.rosterInstanceId ?? null,
        faction: u.faction,
        isLord: u.isLord,
        isBoss: Boolean(u.isBoss),
        stationary: Boolean(u.stationary),
        droppableItemId: u.droppableItemId ?? null,
        aiMode: u.aiMode ?? (u.stationary ? 'stationary' : 'wait_until_in_range'),
        speciesId: u.speciesId,
        speciesName: u.speciesName,
        nickname: u.nickname,
        level: u.level,
        exp: u.exp ?? 0,
        x: u.x,
        y: u.y,
        currentHp: u.currentHp,
        maxHp: u.maxHp,
        mov: u.mov,
        effectiveMov: getEffectiveMovementPoints(u),
        traversalClass: u.traversalClass,
        types: u.types,
        activeMoveIds: u.activeMoves.map((m) => m.id),
        equippedMoveId: u.equippedMoveId,
        equippedItemId: u.heldItemId ?? u.consumableItemId ?? null,
        waited: u.waited,
        defeated: u.defeated,
      })),
      reachableCoords: this.currentRange ? [...this.currentRange.reachableTiles.keys()] : [],
      attackBorderCoords: this.currentRange ? [...this.currentRange.attackBorderTiles] : [],
      supportBorderCoords: this.currentRange ? [...this.currentRange.supportBorderTiles] : [],
      allAttackableCoords: this.currentRange ? [...this.currentRange.allAttackableTiles] : [],
      dangerCoords: [...this.currentDanger.combinedDangerTiles],
    };
  }

  // ==========================================================================
  // Battle Initialization, Dungeon Prep & Asset Preloading
  // ==========================================================================

  private getActivePrepSaveManager(): SaveStateManager {
    if (this.saveManager.getSave() !== null) {
      return this.saveManager;
    }
    if (!this.guestPrepManager) {
      this.guestPrepManager = createFallbackBattlePrepManager();
    }
    return this.guestPrepManager;
  }

  private hideAllModals(): void {
    this.prepOverlay.hide();
    this.forecastModalBackdropEl.hidden = true;
    this.levelUpModalBackdropEl.hidden = true;
    if (this.levelUpResolver) {
      const resolve = this.levelUpResolver;
      this.levelUpResolver = null;
      resolve();
    }
    this.systemMenuBackdropEl.hidden = true;
    this.victoryModalBackdropEl.hidden = true;
    this.defeatModalBackdropEl.hidden = true;
    this.actionMenuEl.hidden = true;
    this.phaseBannerEl.hidden = true;
    this.systemMenuOpen = false;
  }

  private syncPrepChromeVisibility(): void {
    if (this.phase === 'dungeon_prep') {
      this.topHudBarEl.hidden = true;
      const inViewMap = this.prepOverlay.isOpen() && this.prepOverlay.getSubMode() === 'view_map';
      this.infoStripEl.hidden = !inViewMap;
    } else {
      this.topHudBarEl.hidden = false;
      this.infoStripEl.hidden = false;
    }
  }

  private rebuildPrepBattleUnits(): void {
    const activeSave = this.getActivePrepSaveManager().getSave();
    if (!activeSave) return;
    this.units = buildBattleUnitsFromPrepDeployment(
      this.map,
      activeSave.roster,
      this.deploymentSlots,
      this.enemySpawnDefs
    );
    void this.preloadAllUnitSprites().then(() => {
      if (this.openState) this.renderFrame(performance.now());
    });
    this.recomputeDangerArea();
    this.updateInfoStrip();
    this.renderFrame(performance.now());
  }

  private togglePrepDeployUnit(instanceId: string): { ok: boolean; message: string } {
    const activeSave = this.getActivePrepSaveManager().getSave();
    const unit = activeSave?.roster.find((u) => u.instanceId === instanceId);
    if (!unit) {
      return { ok: false, message: 'Unit not found in roster.' };
    }
    if (unit.isLord) {
      return {
        ok: false,
        message: `${unit.nickname} is your Dragon Lord and must enter every dungeon.`,
      };
    }

    const existingSlot = this.deploymentSlots.find((s) => s.unitInstanceId === instanceId);
    if (existingSlot) {
      existingSlot.unitInstanceId = null;
      if (this.prepSwapSlotIndex === existingSlot.slotIndex) {
        this.prepSwapSlotIndex = null;
      }
      this.rebuildPrepBattleUnits();
      return { ok: true, message: `${unit.nickname} moved to Standby.` };
    }

    const deployedCount = this.deploymentSlots.filter((s) => s.unitInstanceId !== null).length;
    const cap = getMapDeploymentCap(this.map);
    if (deployedCount >= cap) {
      return {
        ok: false,
        message: `Deployment cap reached (${cap}/${cap}). Bench another unit first.`,
      };
    }

    const openSlot = this.deploymentSlots.find((s) => s.unitInstanceId === null);
    if (!openSlot) {
      return { ok: false, message: 'No open starting tile available.' };
    }

    openSlot.unitInstanceId = unit.instanceId;
    this.rebuildPrepBattleUnits();
    return {
      ok: true,
      message: `${unit.nickname} deployed.`,
    };
  }

  private async setupFreshBattleState(): Promise<void> {
    this.hideAllModals();
    this.activeWalk = null;
    this.activeStrikeVfx = null;
    this.floatingTexts.length = 0;
    this.trackedEnemyIds.clear();
    this.spawnedReinforcementIds.clear();
    this.blockedReinforcementIds.clear();
    this.collectedDrops = [];
    this.levelUpHistory = [];
    this.prepSwapSlotIndex = null;
    this.clearSelection();

    this.turnNumber = 1;
    this.victoryCallbackFired = false;
    this.phase = 'dungeon_prep';
    this.interactionState = 'idle';
    this.selectionPulseStartMs = performance.now();

    this.enemySpawnDefs = resolveEnemySpawnsForMap(this.map, this.explicitEnemyOverrides);
    const activeSave = this.getActivePrepSaveManager().getSave()!;
    this.deploymentSlots = createInitialPrepDeploymentSlots(this.map, activeSave.roster);
    this.units = buildBattleUnitsFromPrepDeployment(
      this.map,
      activeSave.roster,
      this.deploymentSlots,
      this.enemySpawnDefs
    );

    const lord = this.getLordUnit() ?? this.units[0];
    this.inspectedTile = { x: lord?.x ?? 3, y: lord?.y ?? 5 };

    await Promise.all([this.preloadMapTilesets(), this.preloadAllUnitSprites()]);

    this.recomputeDangerArea();
    this.syncHudControls();
    this.updateInfoStrip();
    this.prepOverlay.show();
    this.syncPrepChromeVisibility();
  }

  private confirmEnterDungeonFromPrep(): void {
    if (this.phase !== 'dungeon_prep') return;
    this.prepSwapSlotIndex = null;
    this.prepOverlay.hide();
    this.rebuildPrepBattleUnits();

    this.phase = 'player_phase';
    this.interactionState = 'idle';
    this.syncPrepChromeVisibility();

    const lord = this.getLordUnit() ?? this.units[0];
    if (lord) {
      this.inspectedTile = { x: lord.x, y: lord.y };
      this.centerCameraOnTile(lord.x, lord.y);
    }

    this.audioManager.playSfx('phase_change');
    this.showPhaseBanner(`PLAYER PHASE — TURN ${this.turnNumber}`);
    this.syncHudControls();
    this.updateInfoStrip();
    this.onLayerStateChanged();
    this.renderFrame(performance.now());
  }

  private async preloadMapTilesets(): Promise<void> {
    const needed = new Set<string>();
    for (const row of this.map.tiles) {
      for (const cell of row) {
        needed.add(normalizeTilesetId(cell.tilesetId));
      }
    }
    await Promise.all(
      [...needed].map(async (id) => {
        if (!this.tilesetSheets.has(id)) {
          const loaded = await loadTilesetSheet(id);
          this.tilesetSheets.set(id, loaded);
        }
      })
    );
  }

  private async preloadAllUnitSprites(): Promise<void> {
    const speciesIds = new Set<string>(this.units.map((u) => u.speciesId));
    await Promise.all(
      [...speciesIds].map(async (spId) => {
        if (!this.spriteBundles.has(spId)) {
          const bundle = await loadSpeciesSpriteBundle(spId);
          this.spriteBundles.set(spId, bundle);
        }
      })
    );
  }

  // ==========================================================================
  // Unit Queries & State Helpers
  // ==========================================================================

  private getLivingUnits(): BattleUnitState[] {
    return this.units.filter((u) => !u.defeated && u.currentHp > 0);
  }

  /**
   * Units that should still be drawn on canvas (living units + units currently playing KO dissolve).
   */
  private getRenderableUnits(): BattleUnitState[] {
    return this.units.filter((u) => !u.defeated);
  }

  private getLivingPlayers(): BattleUnitState[] {
    return this.units.filter((u) => u.faction === 'player' && !u.defeated && u.currentHp > 0);
  }

  private getLivingEnemies(): BattleUnitState[] {
    return this.units.filter((u) => u.faction === 'enemy' && !u.defeated && u.currentHp > 0);
  }

  private getLordUnit(): BattleUnitState | undefined {
    return (
      this.units.find((u) => u.faction === 'player' && u.isLord) ??
      this.units.find((u) => u.faction === 'player')
    );
  }

  private getSelectedUnit(): BattleUnitState | null {
    if (!this.selectedUnitId) return null;
    return (
      this.units.find(
        (u) => u.id === this.selectedUnitId && !u.defeated && u.currentHp > 0
      ) ?? null
    );
  }

  private isLordDefeated(): boolean {
    const lord = this.getLordUnit();
    if (!lord) return this.getLivingPlayers().length === 0;
    return lord.defeated || lord.currentHp <= 0;
  }

  private areAllLivingPlayersWaited(): boolean {
    const livingPlayers = this.getLivingPlayers();
    return livingPlayers.length > 0 && livingPlayers.every((u) => u.waited);
  }

  private clearSelection(): void {
    this.selectedUnitId = null;
    this.uncommittedOrigin = null;
    this.originRangeSnapshot = null;
    this.currentRange = null;
    this.previewPath = null;
    this.forecastMode = 'attack';
    this.forecastTargetId = null;
    this.forecastMoveId = null;
    this.currentForecast = null;
    this.currentHealForecast = null;
    this.actionMenuEl.hidden = true;
    this.forecastModalBackdropEl.hidden = true;
    if (this.phase === 'player_phase') {
      this.interactionState = 'idle';
    }
  }

  private recomputeSelectedUnitRange(): void {
    const unit = this.getSelectedUnit();
    if (!unit) {
      this.currentRange = null;
      return;
    }
    this.currentRange = computeUnitMovementAndAttackRange(
      this.map,
      unit,
      this.getLivingUnits()
    );
  }

  private syncHudControls(): void {
    const phaseLabel =
      this.phase === 'enemy_phase'
        ? 'Enemy'
        : this.phase === 'victory'
          ? 'Victory'
          : this.phase === 'defeat'
            ? 'Defeat'
            : 'Player';
    this.turnBadgeEl.textContent = `Turn ${this.turnNumber} · ${phaseLabel}`;

    const canEndPhase =
      this.phase === 'player_phase' &&
      (this.interactionState === 'idle' || this.interactionState === 'unit_selected');
    this.endPhaseBtnEl.disabled = !canEndPhase;
    this.systemEndPhaseBtnEl.disabled = !canEndPhase;
  }

  // ==========================================================================
  // Unified Pointer Event Bindings (Rule 2 — Zero Keyboard Listeners)
  // ==========================================================================

  private bindPointerInteractions(): void {
    const signal = this.abortController.signal;

    // Top HUD Buttons
    bindPointerTap(this.dangerBtnEl, () => this.toggleGlobalDangerArea(), { signal });
    bindPointerTap(this.endPhaseBtnEl, () => void this.requestManualEndPhase(), { signal });

    // Floating Command Menu Buttons
    bindPointerTap(this.cmdAttackBtnEl, () => this.openForecastFromCommandMenu(), { signal });
    bindPointerTap(this.cmdHealBtnEl, () => this.openHealForecastFromCommandMenu(), { signal });
    bindPointerTap(this.cmdItemBtnEl, () => void this.useEquippedBattleConsumable(), { signal });
    bindPointerTap(this.cmdWaitBtnEl, () => void this.confirmUnitWait(), { signal });
    bindPointerTap(this.cmdCancelBtnEl, () => this.cancelUncommittedMove(), { signal });

    // Combat / Heal Forecast Modal Buttons
    bindPointerTap(
      this.forecastModalBackdropEl.querySelector<HTMLElement>(
        '[data-testid="forecast-attack-btn"]'
      ),
      () => void this.confirmForecastAction(),
      { signal }
    );
    bindPointerTap(
      this.forecastModalBackdropEl.querySelector<HTMLElement>(
        '[data-testid="forecast-cancel-btn"]'
      ),
      () => this.cancelCombatForecast(),
      { signal }
    );

    // Battlefield System Menu Buttons
    bindPointerTap(this.systemDangerBtnEl, () => this.toggleGlobalDangerArea(), { signal });
    bindPointerTap(
      this.systemAudioBtnEl,
      () => {
        const muted = this.audioManager.toggleMute();
        if (!muted) {
          this.audioManager.playSfx('select');
        }
        this.syncSystemAudioButton();
      },
      { signal }
    );
    bindPointerTap(
      this.systemEndPhaseBtnEl,
      () => {
        this.closeSystemMenu();
        void this.requestManualEndPhase();
      },
      { signal }
    );
    bindPointerTap(
      this.systemMenuBackdropEl.querySelector<HTMLElement>(
        '[data-testid="battle-sys-restart"]'
      ),
      () => {
        this.closeSystemMenu();
        void this.restartMatch();
      },
      { signal }
    );
    bindPointerTap(
      this.systemMenuBackdropEl.querySelector<HTMLElement>('[data-testid="battle-sys-exit"]'),
      () => {
        this.audioManager.playSfx('cancel');
        this.closeSystemMenu();
        this.close();
      },
      { signal }
    );
    bindPointerTap(
      this.systemMenuBackdropEl.querySelector<HTMLElement>(
        '[data-testid="battle-sys-resume"]'
      ),
      () => {
        this.audioManager.playSfx('cancel');
        this.closeSystemMenu();
      },
      { signal }
    );

    // Victory & Defeat Modal Buttons
    bindPointerTap(
      this.victoryModalBackdropEl.querySelector<HTMLElement>(
        '[data-testid="victory-replay-btn"]'
      ),
      () => void this.restartMatch(),
      { signal }
    );
    bindPointerTap(
      this.victoryModalBackdropEl.querySelector<HTMLElement>('[data-testid="victory-exit-btn"]'),
      () => {
        this.audioManager.playSfx('select');
        this.close();
      },
      { signal }
    );
    bindPointerTap(
      this.defeatModalBackdropEl.querySelector<HTMLElement>(
        '[data-testid="defeat-restart-btn"]'
      ),
      () => void this.restartMatch(),
      { signal }
    );
    bindPointerTap(
      this.defeatModalBackdropEl.querySelector<HTMLElement>('[data-testid="defeat-exit-btn"]'),
      () => {
        this.audioManager.playSfx('select');
        this.close();
      },
      { signal }
    );
    bindPointerTap(
      this.levelUpModalBackdropEl.querySelector<HTMLElement>(
        '[data-testid="levelup-continue-btn"]'
      ),
      () => {
        this.audioManager.playSfx('select');
        this.dismissLevelUpModal();
      },
      { signal }
    );

    // Canvas Pointer Gesture Disambiguation: Tap vs Camera Drag vs Long-Press vs Right-Click
    let activePointerId: number | null = null;
    let downClientX = 0;
    let downClientY = 0;
    let startCameraX = 0;
    let startCameraY = 0;
    let isDraggingCamera = false;
    let longPressTriggered = false;
    let longPressTimer: number | null = null;

    const clearLongPress = () => {
      if (longPressTimer !== null) {
        window.clearTimeout(longPressTimer);
        longPressTimer = null;
      }
    };

    this.canvasStageEl.addEventListener(
      'contextmenu',
      (e: MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        this.handleMenuOrBack();
      },
      { signal }
    );

    this.canvasStageEl.addEventListener(
      'wheel',
      (e: WheelEvent) => {
        if (!this.canInteractWithMapViewport()) return;
        e.preventDefault();
        const nextScale = computeWheelZoomScale(this.displayScale, e);
        if (nextScale === this.displayScale) return;
        const anchor = this.clientPointToWorld(e.clientX, e.clientY);
        this.applyZoomWithWorldAnchor(
          nextScale,
          e.clientX,
          e.clientY,
          anchor.worldX,
          anchor.worldY
        );
        this.renderFrame(performance.now());
      },
      { passive: false, signal }
    );

    this.canvasStageEl.addEventListener(
      'pointerdown',
      (e: PointerEvent) => {
        if (!this.openState) return;
        if (e.pointerType === 'mouse' && e.button !== 0) return;

        try {
          this.canvasStageEl.setPointerCapture(e.pointerId);
        } catch {
          // Synthetic Playwright events may omit pointer capture
        }

        if (this.canInteractWithMapViewport()) {
          const pinchDown = this.pinchTracker.onPointerDown(
            e,
            this.displayScale,
            (cx, cy) => this.clientPointToWorld(cx, cy)
          );
          if (pinchDown.isMultiTouch) {
            clearLongPress();
            activePointerId = null;
            isDraggingCamera = false;
            longPressTriggered = false;
            return;
          }
        }

        if (activePointerId !== null) return;

        activePointerId = e.pointerId;
        downClientX = e.clientX;
        downClientY = e.clientY;
        startCameraX = this.cameraX;
        startCameraY = this.cameraY;
        isDraggingCamera = false;
        longPressTriggered = false;
        clearLongPress();

        if (e.pointerType !== 'mouse') {
          longPressTimer = window.setTimeout(() => {
            if (
              !isDraggingCamera &&
              activePointerId === e.pointerId &&
              !this.pinchTracker.isMultiTouchSession()
            ) {
              longPressTriggered = true;
              this.handleMenuOrBack();
            }
          }, LONG_PRESS_MS);
        }
      },
      { signal }
    );

    this.canvasStageEl.addEventListener(
      'pointermove',
      (e: PointerEvent) => {
        if (!this.openState) return;

        if (this.canInteractWithMapViewport()) {
          const handledPinch = this.pinchTracker.onPointerMove(
            e,
            () => this.displayScale,
            (cx, cy) => this.clientPointToWorld(cx, cy),
            ({ nextScale, midClientX, midClientY, anchorWorldX, anchorWorldY }) => {
              this.applyZoomWithWorldAnchor(
                nextScale,
                midClientX,
                midClientY,
                anchorWorldX,
                anchorWorldY
              );
            }
          );
          if (handledPinch) {
            clearLongPress();
            this.renderFrame(performance.now());
            return;
          }
        }
        if (this.pinchTracker.isMultiTouchSession() && activePointerId !== e.pointerId) {
          return;
        }

        if (activePointerId === null && e.pointerType === 'mouse') {
          const tile = this.clientPointToTile(e.clientX, e.clientY);
          this.updateHoveredTile(tile);
          return;
        }

        if (e.pointerId !== activePointerId) return;

        const dx = e.clientX - downClientX;
        const dy = e.clientY - downClientY;

        if (!isDraggingCamera && Math.hypot(dx, dy) > DRAG_THRESHOLD_PX) {
          isDraggingCamera = true;
          clearLongPress();
        }

        if (isDraggingCamera) {
          const worldDeltaX = dx / this.displayScale;
          const worldDeltaY = dy / this.displayScale;
          this.setCameraPosition(startCameraX - worldDeltaX, startCameraY - worldDeltaY);
          if (this.interactionState === 'action_menu') {
            this.positionFloatingActionMenu();
          }
          this.renderFrame(performance.now());
        }
      },
      { signal }
    );

    const finishPointer = (e: PointerEvent, commitTap: boolean) => {
      try {
        if (this.canvasStageEl.hasPointerCapture(e.pointerId)) {
          this.canvasStageEl.releasePointerCapture(e.pointerId);
        }
      } catch {
        // Ignore
      }

      const pinchUp = this.pinchTracker.onPointerUp(e);
      if (pinchUp.hadMultiTouch) {
        clearLongPress();
        longPressTriggered = false;
        if (pinchUp.remainingPointer) {
          activePointerId = pinchUp.remainingPointer.pointerId;
          downClientX = pinchUp.remainingPointer.clientX;
          downClientY = pinchUp.remainingPointer.clientY;
          startCameraX = this.cameraX;
          startCameraY = this.cameraY;
          isDraggingCamera = true;
        } else {
          activePointerId = null;
          isDraggingCamera = false;
        }
        return;
      }

      if (e.pointerId !== activePointerId) return;
      const wasDrag = isDraggingCamera;
      const wasLongPress = longPressTriggered;
      activePointerId = null;
      isDraggingCamera = false;
      longPressTriggered = false;
      clearLongPress();

      if (commitTap && !wasDrag && !wasLongPress) {
        const tile = this.clientPointToTile(e.clientX, e.clientY);
        if (tile) {
          this.handleTileTap(tile.x, tile.y);
        }
      }
    };

    this.canvasStageEl.addEventListener('pointerup', (e) => finishPointer(e, true), { signal });
    this.canvasStageEl.addEventListener('pointercancel', (e) => finishPointer(e, false), {
      signal,
    });

    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => {
        if (!this.openState) return;
        this.syncViewportDimensions();
        if (this.interactionState === 'action_menu') {
          this.positionFloatingActionMenu();
        }
        this.renderFrame(performance.now());
      });
      this.resizeObserver.observe(this.canvasStageEl);
    }
  }

  private updateHoveredTile(tile: { x: number; y: number } | null): void {
    if (
      tile?.x === this.hoveredTile?.x &&
      tile?.y === this.hoveredTile?.y
    ) {
      return;
    }
    this.hoveredTile = tile;

    if (
      this.phase === 'player_phase' &&
      this.interactionState === 'unit_selected' &&
      this.currentRange &&
      tile
    ) {
      const unit = this.getSelectedUnit();
      const key = coordKey(tile.x, tile.y);
      const occupant = this.getLivingUnits().find(
        (u) => u.x === tile.x && u.y === tile.y && u.id !== unit?.id
      );

      if (unit && occupant && occupant.faction === 'enemy') {
        const plan = findBestAttackPlanForTarget(
          this.map,
          unit,
          occupant,
          this.currentRange.reachableTiles,
          this.getLivingUnits()
        );
        this.previewPath = plan ? plan.path : null;
      } else if (unit && occupant && occupant.faction === 'player') {
        const healPlan = findBestHealPlanForAlly(
          this.map,
          unit,
          occupant,
          this.currentRange.reachableTiles,
          this.getLivingUnits()
        );
        this.previewPath = healPlan ? healPlan.path : null;
      } else if (unit && this.currentRange.reachableTiles.has(key) && !occupant) {
        this.previewPath = findShortestPathAStar(
          this.map,
          unit,
          tile.x,
          tile.y,
          this.getLivingUnits()
        );
      } else {
        this.previewPath = null;
      }
    }
  }

  // ==========================================================================
  // Player Phase Tile Tap, Direct-Attack Routing & Command Menu
  // ==========================================================================

  private handleTileTap(tx: number, ty: number): void {
    if (!isInMapBounds(this.map, tx, ty) || this.systemMenuOpen) return;

    if (this.phase === 'dungeon_prep') {
      if (!this.prepOverlay.isOpen() || this.prepOverlay.getSubMode() !== 'view_map') {
        return;
      }
      this.handlePrepViewMapTileTap(tx, ty);
      return;
    }

    if (
      this.phase !== 'player_phase' ||
      this.interactionState === 'walking' ||
      this.interactionState === 'combat_forecast' ||
      this.interactionState === 'combat_animating' ||
      this.interactionState === 'enemy_acting'
    ) {
      return;
    }

    // While the floating Command Menu is open, tapping an in-range enemy or injured ally opens Forecast directly!
    if (this.interactionState === 'action_menu') {
      const selected = this.getSelectedUnit();
      const tappedEnemy = this.getLivingEnemies().find((e) => e.x === tx && e.y === ty);
      if (selected && tappedEnemy) {
        const dist = manhattanDistance(selected.x, selected.y, tappedEnemy.x, tappedEnemy.y);
        const validMoves = getOffensiveMovesAtDistance(selected, dist);
        if (validMoves.length > 0) {
          this.forecastReturnMode = 'action_menu';
          this.actionMenuEl.hidden = true;
          this.openCombatForecastModal(tappedEnemy.id, validMoves[0]!.id);
          return;
        }
      }

      const tappedAlly = this.getLivingPlayers().find((p) => p.x === tx && p.y === ty);
      if (selected && tappedAlly) {
        const dist =
          tappedAlly.id === selected.id
            ? 0
            : manhattanDistance(selected.x, selected.y, tappedAlly.x, tappedAlly.y);
        const validHealMoves = getHealingMovesForTargetAtDistance(selected, tappedAlly, dist);
        if (validHealMoves.length > 0) {
          this.forecastReturnMode = 'action_menu';
          this.actionMenuEl.hidden = true;
          this.openHealForecastModal(tappedAlly.id, validHealMoves[0]!.id);
          return;
        }
      }

      this.cancelUncommittedMove();
      return;
    }

    this.inspectedTile = { x: tx, y: ty };
    const livingUnits = this.getLivingUnits();
    const occupant = livingUnits.find((u) => u.x === tx && u.y === ty);

    // 1. IDLE STATE
    if (this.interactionState === 'idle') {
      if (occupant && occupant.faction === 'player') {
        if (occupant.waited) {
          this.audioManager.playSfx('dialogue_advance');
          this.updateInfoStrip();
          this.renderFrame(performance.now());
          return;
        }
        this.selectPlayerUnit(occupant);
        return;
      }

      if (occupant && occupant.faction === 'enemy') {
        this.toggleIndividualEnemyDanger(occupant.id);
        this.updateInfoStrip();
        this.renderFrame(performance.now());
        return;
      }

      this.audioManager.playSfx('dialogue_advance');
      this.updateInfoStrip();
      this.renderFrame(performance.now());
      return;
    }

    // 2. UNIT SELECTED STATE
    if (this.interactionState === 'unit_selected') {
      const selected = this.getSelectedUnit();
      if (!selected || !this.currentRange) {
        this.clearSelection();
        return;
      }

      // 2a. Player tapped a living ENEMY -> route to optimal attack tile & open Combat Forecast!
      if (occupant && occupant.faction === 'enemy') {
        const plan = findBestAttackPlanForTarget(
          this.map,
          selected,
          occupant,
          this.currentRange.reachableTiles,
          livingUnits
        );
        if (plan) {
          this.audioManager.playSfx('select');
          this.uncommittedOrigin = {
            unitId: selected.id,
            x: selected.x,
            y: selected.y,
            direction: selected.direction,
          };
          this.originRangeSnapshot = this.currentRange;
          this.forecastReturnMode = 'unit_selected';
          this.previewPath = plan.path;

          const openForecastOnArrival = () => {
            selected.direction = directionFromDelta(
              occupant.x - selected.x,
              occupant.y - selected.y
            );
            this.openCombatForecastModal(occupant.id, plan.defaultMoveId);
          };

          if (plan.path.length <= 1) {
            openForecastOnArrival();
          } else {
            this.startInteractiveWalk(selected, plan.path, openForecastOnArrival);
          }
          return;
        }

        // Enemy is outside this unit's reach this turn -> inspect & play gentle cancel chime
        this.audioManager.playSfx('cancel');
        this.toggleIndividualEnemyDanger(occupant.id);
        this.updateInfoStrip();
        this.renderFrame(performance.now());
        return;
      }

      // 2b. Player tapped ANOTHER player unit -> heal injured ally if selected unit has a heal move, else switch selection
      if (occupant && occupant.id !== selected.id && occupant.faction === 'player') {
        const healPlan = findBestHealPlanForAlly(
          this.map,
          selected,
          occupant,
          this.currentRange.reachableTiles,
          livingUnits
        );
        if (healPlan) {
          this.audioManager.playSfx('select');
          this.uncommittedOrigin = {
            unitId: selected.id,
            x: selected.x,
            y: selected.y,
            direction: selected.direction,
          };
          this.originRangeSnapshot = this.currentRange;
          this.forecastReturnMode = 'unit_selected';
          this.previewPath = healPlan.path;

          const openHealOnArrival = () => {
            selected.direction = directionFromDelta(
              occupant.x - selected.x,
              occupant.y - selected.y
            );
            this.openHealForecastModal(occupant.id, healPlan.defaultMoveId);
          };

          if (healPlan.path.length <= 1) {
            openHealOnArrival();
          } else {
            this.startInteractiveWalk(selected, healPlan.path, openHealOnArrival);
          }
          return;
        }

        if (!occupant.waited) {
          this.selectPlayerUnit(occupant);
          return;
        }
        this.audioManager.playSfx('cancel');
        this.updateInfoStrip();
        this.renderFrame(performance.now());
        return;
      }

      // 2c. Player tapped a reachable Blue tile (or unit's own tile) -> walk & open Command Menu
      const targetKey = coordKey(tx, ty);
      if (this.currentRange.reachableTiles.has(targetKey)) {
        const path = findShortestPathAStar(this.map, selected, tx, ty, livingUnits);
        if (path && path.length > 0) {
          this.uncommittedOrigin = {
            unitId: selected.id,
            x: selected.x,
            y: selected.y,
            direction: selected.direction,
          };
          this.originRangeSnapshot = this.currentRange;
          this.previewPath = path;
          this.audioManager.playSfx('select');

          if (path.length === 1) {
            this.openFloatingCommandMenu(selected);
          } else {
            this.startInteractiveWalk(selected, path, () => {
              this.openFloatingCommandMenu(selected);
            });
          }
          return;
        }
      }

      // 2d. Tapped unreachable tile -> deselect
      this.audioManager.playSfx('cancel');
      this.clearSelection();
      this.updateInfoStrip();
      this.onLayerStateChanged();
      this.renderFrame(performance.now());
    }
  }

  /**
   * Handles tile clicks/taps during Dungeon Prep `View Map` mode:
   * - Tapping two valid blue starting tiles swaps the deployed Pokémon (or moves a unit onto an open blue starting tile).
   * - Tapping any non-deployment tile in the dungeon strictly refuses placement and cancels the swap selection.
   */
  private handlePrepViewMapTileTap(tx: number, ty: number): void {
    this.inspectedTile = { x: tx, y: ty };
    const clickedSlot = this.deploymentSlots.find((s) => s.x === tx && s.y === ty) ?? null;
    const activeSave = this.getActivePrepSaveManager().getSave();

    if (this.prepSwapSlotIndex === null) {
      if (clickedSlot && clickedSlot.unitInstanceId) {
        this.prepSwapSlotIndex = clickedSlot.slotIndex;
        this.selectionPulseStartMs = performance.now();
        this.audioManager.playSfx('select');
        this.prepOverlay.syncMapHudState();
        const selectedOwned = activeSave?.roster.find(
          (u) => u.instanceId === clickedSlot.unitInstanceId
        );
        this.infoStripEl.textContent = selectedOwned
          ? `Selected ${selectedOwned.nickname} — tap another blue tile to swap.`
          : 'Selected starting tile — tap another blue tile to swap.';
        this.onLayerStateChanged();
        this.renderFrame(performance.now());
        return;
      }

      if (clickedSlot) {
        this.audioManager.playSfx('dialogue_advance');
        this.infoStripEl.textContent = 'Open starting tile — tap a deployed unit first.';
        this.renderFrame(performance.now());
        return;
      }

      const tappedEnemy = this.getLivingEnemies().find((e) => e.x === tx && e.y === ty);
      if (tappedEnemy) {
        this.audioManager.playSfx('select');
        this.toggleIndividualEnemyDanger(tappedEnemy.id);
      } else {
        this.audioManager.playSfx('dialogue_advance');
      }
      this.updateInfoStrip();
      this.renderFrame(performance.now());
      return;
    }

    const sourceSlot = this.deploymentSlots.find((s) => s.slotIndex === this.prepSwapSlotIndex);
    if (!sourceSlot) {
      this.prepSwapSlotIndex = null;
      this.prepOverlay.syncMapHudState();
      this.onLayerStateChanged();
      return;
    }

    if (clickedSlot && clickedSlot.slotIndex === sourceSlot.slotIndex) {
      this.prepSwapSlotIndex = null;
      this.audioManager.playSfx('cancel');
      this.prepOverlay.syncMapHudState();
      this.updateInfoStrip();
      this.onLayerStateChanged();
      this.renderFrame(performance.now());
      return;
    }

    if (clickedSlot) {
      const tempUnitId = sourceSlot.unitInstanceId;
      sourceSlot.unitInstanceId = clickedSlot.unitInstanceId;
      clickedSlot.unitInstanceId = tempUnitId;
      this.prepSwapSlotIndex = null;
      this.audioManager.playSfx('select');
      this.rebuildPrepBattleUnits();
      this.prepOverlay.refreshAll();

      const unitAtDest = activeSave?.roster.find(
        (u) => u.instanceId === clickedSlot.unitInstanceId
      );
      const unitAtSource = activeSave?.roster.find(
        (u) => u.instanceId === sourceSlot.unitInstanceId
      );
      if (unitAtDest && unitAtSource) {
        this.infoStripEl.textContent = `Swapped ${unitAtDest.nickname} and ${unitAtSource.nickname}.`;
      } else if (unitAtDest) {
        this.infoStripEl.textContent = `Moved ${unitAtDest.nickname}.`;
      } else {
        this.updateInfoStrip();
      }
      this.onLayerStateChanged();
      this.renderFrame(performance.now());
      return;
    }

    // Clicked outside the valid blue starting tiles: strictly forbid moving units onto arbitrary dungeon tiles!
    this.prepSwapSlotIndex = null;
    this.audioManager.playSfx('cancel');
    this.prepOverlay.syncMapHudState();
    this.infoStripEl.textContent = 'Units can only swap among blue starting tiles.';
    this.onLayerStateChanged();
    this.renderFrame(performance.now());
  }

  private selectPlayerUnit(unit: BattleUnitState): void {
    this.selectedUnitId = unit.id;
    this.interactionState = 'unit_selected';
    this.selectionPulseStartMs = performance.now();
    this.inspectedTile = { x: unit.x, y: unit.y };
    this.recomputeSelectedUnitRange();
    this.previewPath = [{ x: unit.x, y: unit.y, cumulativeCost: 0 }];
    this.audioManager.playSfx('select');
    this.syncHudControls();
    this.updateInfoStrip();
    this.onLayerStateChanged();
    this.renderFrame(performance.now());
  }

  private startInteractiveWalk(
    unit: BattleUnitState,
    path: AStarPathStep[],
    onComplete: () => void
  ): void {
    this.interactionState = 'walking';
    unit.action = 'Walk';
    unit.frameIndex = 0;
    this.activeWalk = {
      unitId: unit.id,
      steps: path,
      segmentIndex: 0,
      segmentElapsedMs: 0,
      lastTickMs: performance.now(),
      followCamera: false,
      onComplete,
    };
    this.syncHudControls();
    this.onLayerStateChanged();
  }

  private getAttackableEnemiesFromCurrentTile(unit: BattleUnitState): Array<{
    enemy: BattleUnitState;
    distance: number;
    moves: BattleMoveSlot[];
  }> {
    const out: Array<{ enemy: BattleUnitState; distance: number; moves: BattleMoveSlot[] }> = [];
    for (const enemy of this.getLivingEnemies()) {
      const dist = manhattanDistance(unit.x, unit.y, enemy.x, enemy.y);
      const moves = getOffensiveMovesAtDistance(unit, dist);
      if (moves.length > 0) {
        out.push({ enemy, distance: dist, moves });
      }
    }
    return out;
  }

  private getHealableTargetsFromCurrentTile(unit: BattleUnitState): Array<{
    ally: BattleUnitState;
    distance: number;
    moves: BattleMoveSlot[];
  }> {
    const out: Array<{ ally: BattleUnitState; distance: number; moves: BattleMoveSlot[] }> = [];
    // Prioritize injured adjacent allies first, then injured self (for `self_or_ally` moves like Soft-Boiled)
    for (const ally of this.getLivingPlayers()) {
      if (ally.id === unit.id) continue;
      const dist = manhattanDistance(unit.x, unit.y, ally.x, ally.y);
      const moves = getHealingMovesForTargetAtDistance(unit, ally, dist);
      if (moves.length > 0) {
        out.push({ ally, distance: dist, moves });
      }
    }
    const selfMoves = getHealingMovesForTargetAtDistance(unit, unit, 0);
    if (selfMoves.length > 0) {
      out.push({ ally: unit, distance: 0, moves: selfMoves });
    }
    return out;
  }

  private canUseUnitEquippedConsumable(unit: BattleUnitState): boolean {
    if (!unit.consumableItemId) return false;
    const item = getItemById(unit.consumableItemId);
    if (!item) return false;
    if (item.category === 'x_item') {
      return true;
    }
    if (item.category === 'promotion') {
      return getEligibleEvolutionBranches(unit.speciesId, unit.level, item.id).length > 0;
    }
    if (item.category === 'consumable') {
      const canHeal =
        Boolean(item.effect.healFlat || item.effect.healFull) && unit.currentHp < unit.maxHp;
      const canCure = Boolean(item.effect.cureStatus) && unit.status !== null;
      return canHeal || canCure;
    }
    return false;
  }

  private openFloatingCommandMenu(unit: BattleUnitState): void {
    this.activeWalk = null;
    unit.action = 'Idle';
    unit.renderWorldX = unit.x * PMD_TILE_NATIVE_PX;
    unit.renderWorldY = unit.y * PMD_TILE_NATIVE_PX;
    this.inspectedTile = { x: unit.x, y: unit.y };
    this.interactionState = 'action_menu';

    const targets = this.getAttackableEnemiesFromCurrentTile(unit);
    const healTargets = this.getHealableTargetsFromCurrentTile(unit);
    const canUseItem = this.canUseUnitEquippedConsumable(unit);
    this.cmdAttackBtnEl.hidden = targets.length === 0;
    this.cmdHealBtnEl.hidden = healTargets.length === 0;
    this.cmdItemBtnEl.hidden = !canUseItem;
    if (canUseItem && unit.consumableItemId) {
      const heldItem = getItemById(unit.consumableItemId);
      this.cmdItemBtnEl.textContent = heldItem?.category === 'promotion' ? 'Evolve!' : 'Item';
    } else {
      this.cmdItemBtnEl.textContent = 'Item';
    }

    if (targets.length > 0) {
      const target = targets[0]!.enemy;
      unit.direction = directionFromDelta(target.x - unit.x, target.y - unit.y);
    } else if (healTargets.length > 0 && healTargets[0]!.ally.id !== unit.id) {
      const ally = healTargets[0]!.ally;
      unit.direction = directionFromDelta(ally.x - unit.x, ally.y - unit.y);
    }

    this.actionMenuEl.hidden = false;
    this.positionFloatingActionMenu();
    this.syncHudControls();
    this.updateInfoStrip();
    this.onLayerStateChanged();
    this.renderFrame(performance.now());
  }

  private positionFloatingActionMenu(): void {
    const unit = this.getSelectedUnit();
    if (!unit) return;

    const stageW = this.canvasStageEl.clientWidth || 640;
    const stageH = this.canvasStageEl.clientHeight || 480;
    const canvasOffsetX = (stageW - this.bufferWidth * this.displayScale) / 2;
    const canvasOffsetY = (stageH - this.bufferHeight * this.displayScale) / 2;
    const tileDisplayPx = PMD_TILE_NATIVE_PX * this.displayScale;
    const unitScreenX =
      canvasOffsetX + (unit.x * PMD_TILE_NATIVE_PX - this.cameraX) * this.displayScale;
    const unitScreenY =
      canvasOffsetY + (unit.y * PMD_TILE_NATIVE_PX - this.cameraY) * this.displayScale;

    const visibleBtnCount =
      2 +
      (this.cmdAttackBtnEl.hidden ? 0 : 1) +
      (this.cmdHealBtnEl.hidden ? 0 : 1) +
      (this.cmdItemBtnEl.hidden ? 0 : 1);
    const menuW = 144;
    const menuH = visibleBtnCount * 50 + 14;

    let left = unitScreenX + tileDisplayPx + 8;
    if (left + menuW > stageW - 8) {
      left = unitScreenX - menuW - 8;
    }
    left = Math.max(8, Math.min(stageW - menuW - 8, left));

    let top = unitScreenY - 8;
    const minTop = stageW <= 720 && stageH > 500 ? 110 : 58;
    const maxTop = Math.max(minTop, stageH - menuH - 44);
    top = Math.max(minTop, Math.min(maxTop, top));

    this.actionMenuEl.style.left = `${Math.round(left)}px`;
    this.actionMenuEl.style.top = `${Math.round(top)}px`;
  }

  private async useEquippedBattleConsumable(): Promise<void> {
    const unit = this.getSelectedUnit();
    if (!unit || !unit.consumableItemId || !this.canUseUnitEquippedConsumable(unit)) return;
    const item = getItemById(unit.consumableItemId);
    if (!item) return;

    const runGen = this.battleRunGen;
    let calloutText = item.name;
    let needsSpriteReloadSpeciesId: string | null = null;

    if (item.category === 'x_item') {
      if (!unit.tempBattleBoosts) {
        unit.tempBattleBoosts = { atk: 0, def: 0, spa: 0, spd: 0, spe: 0, crit: 0 };
      }
      if (item.effect.battleStatBoost) {
        const appliedLabels: string[] = [];
        for (const key of ['atk', 'def', 'spa', 'spd', 'spe'] as const) {
          const amt = item.effect.battleStatBoost[key];
          if (typeof amt === 'number' && amt !== 0) {
            unit.tempBattleBoosts[key] += amt;
            appliedLabels.push(`${key.toUpperCase()} +${amt}`);
          }
        }
        if (appliedLabels.length > 0) {
          calloutText = `${appliedLabels.join(' ')}!`;
        }
      }
      if (typeof item.effect.battleCritBoost === 'number' && item.effect.battleCritBoost !== 0) {
        unit.tempBattleBoosts.crit += item.effect.battleCritBoost;
        calloutText = `CRIT +${item.effect.battleCritBoost}%!`;
      }
    } else if (item.category === 'consumable') {
      let healed = 0;
      if (item.effect.healFull) {
        healed = unit.maxHp - unit.currentHp;
        unit.currentHp = unit.maxHp;
      } else if (item.effect.healFlat) {
        const nextHp = Math.min(unit.maxHp, unit.currentHp + item.effect.healFlat);
        healed = nextHp - unit.currentHp;
        unit.currentHp = nextHp;
      }
      if (item.effect.cureStatus && unit.status !== null) {
        unit.status = null;
        unit.statusTurns = 0;
      }
      calloutText = healed > 0 ? `+${healed} HP` : 'CURED!';
    } else if (
      item.category === 'promotion' &&
      (item.id === 'evolution_stone' || item.id === 'evolution_gem')
    ) {
      const promo = promoteBattleUnitMidBattle(unit, item.id);
      if (!this.spriteBundles.has(unit.speciesId)) {
        needsSpriteReloadSpeciesId = unit.speciesId;
      }
      calloutText = `EVOLVED → ${promo.newSpeciesName}!`;
      this.showPhaseBanner(`${unit.nickname} evolved into ${promo.newSpeciesName}!`);
    }

    unit.consumableItemId = null;
    unit.waited = true;
    unit.action = 'Idle';
    unit.renderWorldX = unit.x * PMD_TILE_NATIVE_PX;
    unit.renderWorldY = unit.y * PMD_TILE_NATIVE_PX;

    this.audioManager.playSfx(item.category === 'promotion' ? 'victory_fanfare' : 'heal');
    this.spawnFloatingText(
      unit.x,
      unit.y,
      calloutText,
      item.category === 'promotion' ? '#ffd860' : '#68f8a8',
      item.category === 'promotion' ? 1150 : 820
    );
    this.clearSelection();
    this.recomputeDangerArea();
    this.syncHudControls();
    this.updateInfoStrip();
    this.onLayerStateChanged();
    this.renderFrame(performance.now());

    if (needsSpriteReloadSpeciesId) {
      const bundle = await loadSpeciesSpriteBundle(needsSpriteReloadSpeciesId);
      this.spriteBundles.set(needsSpriteReloadSpeciesId, bundle);
      if (this.openState) {
        this.renderFrame(performance.now());
      }
    }

    if (this.areAllLivingPlayersWaited()) {
      await this.waitBattleMs(200);
      if (!this.openState || runGen !== this.battleRunGen || this.phase !== 'player_phase') {
        return;
      }
      await this.runEnemyPhase();
    }
  }

  private openForecastFromCommandMenu(): void {
    const unit = this.getSelectedUnit();
    if (!unit) return;
    const targets = this.getAttackableEnemiesFromCurrentTile(unit);
    if (targets.length === 0) return;

    this.audioManager.playSfx('select');
    this.forecastReturnMode = 'action_menu';
    this.actionMenuEl.hidden = true;
    const first = targets[0]!;
    unit.direction = directionFromDelta(first.enemy.x - unit.x, first.enemy.y - unit.y);
    this.openCombatForecastModal(first.enemy.id, first.moves[0]!.id);
  }

  private openHealForecastFromCommandMenu(): void {
    const unit = this.getSelectedUnit();
    if (!unit) return;
    const healTargets = this.getHealableTargetsFromCurrentTile(unit);
    if (healTargets.length === 0) return;

    this.audioManager.playSfx('select');
    this.forecastReturnMode = 'action_menu';
    this.actionMenuEl.hidden = true;
    const first = healTargets[0]!;
    if (first.ally.id !== unit.id) {
      unit.direction = directionFromDelta(first.ally.x - unit.x, first.ally.y - unit.y);
    }
    this.openHealForecastModal(first.ally.id, first.moves[0]!.id);
  }

  private async confirmUnitWait(): Promise<void> {
    const unit = this.getSelectedUnit();
    if (!unit) return;
    const runGen = this.battleRunGen;

    unit.waited = true;
    unit.action = 'Idle';
    unit.renderWorldX = unit.x * PMD_TILE_NATIVE_PX;
    unit.renderWorldY = unit.y * PMD_TILE_NATIVE_PX;
    this.audioManager.playSfx('select');
    this.clearSelection();
    this.recomputeDangerArea();
    this.syncHudControls();
    this.updateInfoStrip();
    this.onLayerStateChanged();
    this.renderFrame(performance.now());

    if (this.areAllLivingPlayersWaited()) {
      await this.waitBattleMs(200);
      if (!this.openState || runGen !== this.battleRunGen || this.phase !== 'player_phase') {
        return;
      }
      await this.runEnemyPhase();
    }
  }

  private cancelUncommittedMove(): void {
    const unit = this.getSelectedUnit();
    if (unit && this.uncommittedOrigin && this.uncommittedOrigin.unitId === unit.id) {
      unit.x = this.uncommittedOrigin.x;
      unit.y = this.uncommittedOrigin.y;
      unit.direction = this.uncommittedOrigin.direction;
      unit.action = 'Idle';
      unit.renderWorldX = unit.x * PMD_TILE_NATIVE_PX;
      unit.renderWorldY = unit.y * PMD_TILE_NATIVE_PX;
      this.inspectedTile = { x: unit.x, y: unit.y };
    }
    this.uncommittedOrigin = null;
    this.originRangeSnapshot = null;
    this.currentForecast = null;
    this.currentHealForecast = null;
    this.actionMenuEl.hidden = true;
    this.forecastModalBackdropEl.hidden = true;
    this.audioManager.playSfx('cancel');

    if (unit) {
      this.interactionState = 'unit_selected';
      this.selectionPulseStartMs = performance.now();
      this.recomputeSelectedUnitRange();
      this.previewPath = [{ x: unit.x, y: unit.y, cumulativeCost: 0 }];
    } else {
      this.interactionState = 'idle';
    }
    this.syncHudControls();
    this.updateInfoStrip();
    this.onLayerStateChanged();
    this.renderFrame(performance.now());
  }

  // ==========================================================================
  // Fire Emblem Combat & Heal Forecast Modals
  // ==========================================================================

  private openCombatForecastModal(targetEnemyId: string, moveId: string): void {
    const attacker = this.getSelectedUnit();
    const defender = this.units.find(
      (u) => u.id === targetEnemyId && !u.defeated && u.currentHp > 0
    );
    if (!attacker || !defender) return;

    this.activeWalk = null;
    attacker.action = 'Idle';
    attacker.renderWorldX = attacker.x * PMD_TILE_NATIVE_PX;
    attacker.renderWorldY = attacker.y * PMD_TILE_NATIVE_PX;

    this.forecastMode = 'attack';
    this.currentHealForecast = null;
    this.interactionState = 'combat_forecast';
    this.forecastTargetId = defender.id;
    this.forecastMoveId = moveId;

    this.refreshCombatForecastModalDom();
    this.forecastModalBackdropEl.hidden = false;
    this.syncHudControls();
    this.onLayerStateChanged();
    this.renderFrame(performance.now());
  }

  private openHealForecastModal(targetAllyId: string, moveId: string): void {
    const healer = this.getSelectedUnit();
    const targetAlly = this.units.find(
      (u) => u.id === targetAllyId && !u.defeated && u.currentHp > 0
    );
    if (!healer || !targetAlly) return;

    this.activeWalk = null;
    healer.action = 'Idle';
    healer.renderWorldX = healer.x * PMD_TILE_NATIVE_PX;
    healer.renderWorldY = healer.y * PMD_TILE_NATIVE_PX;

    this.forecastMode = 'heal';
    this.currentForecast = null;
    this.interactionState = 'combat_forecast';
    this.forecastTargetId = targetAlly.id;
    this.forecastMoveId = moveId;

    this.refreshHealForecastModalDom();
    this.forecastModalBackdropEl.hidden = false;
    this.syncHudControls();
    this.onLayerStateChanged();
    this.renderFrame(performance.now());
  }

  private refreshCombatForecastModalDom(): void {
    const attacker = this.getSelectedUnit();
    const defender = this.units.find(
      (u) => u.id === this.forecastTargetId && !u.defeated && u.currentHp > 0
    );
    if (!attacker || !defender) return;

    const canRepositionAcrossRange =
      this.forecastReturnMode === 'unit_selected' &&
      this.originRangeSnapshot !== null &&
      this.uncommittedOrigin !== null &&
      this.uncommittedOrigin.unitId === attacker.id;

    let validMoves: BattleMoveSlot[];
    if (canRepositionAcrossRange && this.originRangeSnapshot) {
      validMoves = getOffensiveMovesReachableForTarget(
        attacker,
        defender,
        this.originRangeSnapshot.reachableTiles
      );
    } else {
      const distNow = manhattanDistance(attacker.x, attacker.y, defender.x, defender.y);
      validMoves = getOffensiveMovesAtDistance(attacker, distNow);
    }
    if (validMoves.length === 0) return;

    if (!this.forecastMoveId || !validMoves.some((m) => m.id === this.forecastMoveId)) {
      this.forecastMoveId = validMoves[0]!.id;
    }
    const chosenSlot = validMoves.find((m) => m.id === this.forecastMoveId) ?? validMoves[0]!;

    // If initiated via direct enemy tap and the player switched between Range 1 (`Wrap`/`Tackle`)
    // and Range 2 (`Dragon Breath`/`Razor Leaf`), reposition onto the optimal tile for that move's range!
    if (canRepositionAcrossRange && this.originRangeSnapshot && this.uncommittedOrigin) {
      const curDist = manhattanDistance(attacker.x, attacker.y, defender.x, defender.y);
      if (curDist < chosenSlot.range[0] || curDist > chosenSlot.range[1]) {
        const originContext: BattleUnitState = {
          ...attacker,
          x: this.uncommittedOrigin.x,
          y: this.uncommittedOrigin.y,
        };
        const bestStop = findBestStopTileForOffensiveMove(
          this.map,
          originContext,
          defender,
          chosenSlot,
          this.originRangeSnapshot.reachableTiles,
          this.getLivingUnits()
        );
        if (bestStop) {
          attacker.x = bestStop.stopX;
          attacker.y = bestStop.stopY;
          attacker.renderWorldX = attacker.x * PMD_TILE_NATIVE_PX;
          attacker.renderWorldY = attacker.y * PMD_TILE_NATIVE_PX;
          attacker.direction = directionFromDelta(
            defender.x - attacker.x,
            defender.y - attacker.y
          );
          this.previewPath = bestStop.path;
          this.inspectedTile = { x: attacker.x, y: attacker.y };
        }
      }
    }

    const allTargets = this.getAttackableEnemiesFromCurrentTile(attacker);
    const forecast = computeCombatForecast(this.map, attacker, defender, this.forecastMoveId);
    if (!forecast) return;
    this.currentForecast = forecast;

    // Restore Attack-Mode Modal Chrome & Labels
    const titleEl = this.forecastModalBackdropEl.querySelector('[data-forecast-title]');
    if (titleEl) titleEl.textContent = 'COMBAT FORECAST';
    const defCardEl = this.forecastModalBackdropEl.querySelector<HTMLElement>(
      '[data-testid="forecast-defender-card"]'
    );
    if (defCardEl) defCardEl.className = 'pmd-forecast-side is-defender';
    const confirmBtnEl = this.forecastModalBackdropEl.querySelector<HTMLElement>(
      '[data-testid="forecast-attack-btn"]'
    );
    if (confirmBtnEl) confirmBtnEl.textContent = 'Attack!';

    const setStatLabel = (sel: string, txt: string) => {
      const el = this.forecastModalBackdropEl.querySelector(sel);
      if (el) el.textContent = txt;
    };
    setStatLabel('[data-atk-stat2-label]', 'DMG');
    setStatLabel('[data-atk-stat3-label]', 'HIT');
    setStatLabel('[data-atk-stat4-label]', 'CRIT');
    setStatLabel('[data-def-stat2-label]', 'DMG');
    setStatLabel('[data-def-stat3-label]', 'HIT');
    setStatLabel('[data-def-stat4-label]', 'CRIT');

    // Load pixelated portraits asynchronously
    void this.attackerPortraitView.setPortrait({
      speciesIdOrAssetId: attacker.speciesId,
      emotion: 'Determined',
      mirrorHorizontal: false,
    });
    void this.defenderPortraitView.setPortrait({
      speciesIdOrAssetId: defender.speciesId,
      emotion: 'Angry',
      mirrorHorizontal: true,
    });

    // Header & Effectiveness Badge
    const subEl = this.forecastModalBackdropEl.querySelector('[data-forecast-subtitle]');
    const effBadgeEl = this.forecastModalBackdropEl.querySelector<HTMLElement>(
      '[data-testid="forecast-effectiveness-badge"]'
    );
    const atkSide = forecast.attackerSide;
    if (subEl) {
      subEl.textContent = `R${forecast.distance} · ${atkSide.move.category} · ${atkSide.move.type}`;
    }
    if (effBadgeEl) {
      effBadgeEl.className = 'pmd-forecast-eff-badge';
      if (atkSide.typeMultiplier === 1 && !atkSide.hasStab) {
        effBadgeEl.textContent = 'Neutral (1x)';
        effBadgeEl.hidden = true;
      } else if (atkSide.typeMultiplier === 1 && atkSide.hasStab) {
        effBadgeEl.textContent = 'STAB 1.25x';
        effBadgeEl.hidden = false;
      } else {
        const stabPart = atkSide.hasStab ? ' · STAB' : '';
        effBadgeEl.textContent = `${atkSide.effectivenessLabel} (${atkSide.typeMultiplier}x)${stabPart}`;
        if (atkSide.typeMultiplier > 1) effBadgeEl.classList.add('is-super');
        else if (atkSide.typeMultiplier < 1) effBadgeEl.classList.add('is-resisted');
        effBadgeEl.hidden = false;
      }
    }

    // Target selector pills (shown when 2+ enemies are in range from current tile)
    const targetsWrap = this.forecastModalBackdropEl.querySelector<HTMLElement>(
      '[data-forecast-targets-wrap]'
    );
    const targetsRow = this.forecastModalBackdropEl.querySelector<HTMLElement>(
      '[data-forecast-targets]'
    );
    if (targetsWrap && targetsRow) {
      targetsRow.innerHTML = '';
      if (allTargets.length > 1) {
        targetsWrap.hidden = false;
        for (const entry of allTargets) {
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = `pmd-btn pmd-chip-btn${entry.enemy.id === defender.id ? ' is-active' : ''}`;
          btn.dataset.testid = `forecast-target-${entry.enemy.id}`;
          btn.textContent = `${entry.enemy.nickname} (HP ${entry.enemy.currentHp})`;
          bindPointerTap(
            btn,
            () => {
              this.audioManager.playSfx('select');
              this.forecastTargetId = entry.enemy.id;
              attacker.direction = directionFromDelta(
                entry.enemy.x - attacker.x,
                entry.enemy.y - attacker.y
              );
              this.refreshCombatForecastModalDom();
              this.renderFrame(performance.now());
            },
            { signal: this.abortController.signal }
          );
          targetsRow.appendChild(btn);
        }
      } else {
        targetsWrap.hidden = true;
      }
    }

    // Move selector pills
    const movesRow = this.forecastModalBackdropEl.querySelector<HTMLElement>(
      '[data-forecast-moves]'
    );
    if (movesRow) {
      movesRow.innerHTML = '';
      for (const slot of validMoves) {
        const isSelected = slot.id === this.forecastMoveId;
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `pmd-btn pmd-chip-btn${isSelected ? ' is-active' : ''}`;
        btn.dataset.testid = `forecast-move-${slot.id}`;
        btn.textContent = `${slot.move.name} · R${slot.range[0]} · ${slot.ppRemaining} PP`;
        bindPointerTap(
          btn,
          () => {
            this.audioManager.playSfx('select');
            this.forecastMoveId = slot.id;
            this.refreshCombatForecastModalDom();
            this.renderFrame(performance.now());
          },
          { signal: this.abortController.signal }
        );
        movesRow.appendChild(btn);
      }
    }

    // Attacker Card
    const atkNameEl = this.forecastModalBackdropEl.querySelector(
      '[data-testid="forecast-attacker-name"]'
    );
    const atkMetaEl = this.forecastModalBackdropEl.querySelector('[data-attacker-meta]');
    const atkWpnEl = this.forecastModalBackdropEl.querySelector(
      '[data-testid="forecast-attacker-weapon"]'
    );
    const atkHpEl = this.forecastModalBackdropEl.querySelector(
      '[data-testid="forecast-attacker-hp"]'
    );
    const atkDmgEl = this.forecastModalBackdropEl.querySelector(
      '[data-testid="forecast-attacker-dmg"]'
    );
    const atkHitEl = this.forecastModalBackdropEl.querySelector(
      '[data-testid="forecast-attacker-hit"]'
    );
    const atkCritEl = this.forecastModalBackdropEl.querySelector(
      '[data-testid="forecast-attacker-crit"]'
    );
    const atkCurBar = this.forecastModalBackdropEl.querySelector<HTMLElement>(
      '[data-attacker-hp-cur-bar]'
    );
    const atkProjBar = this.forecastModalBackdropEl.querySelector<HTMLElement>(
      '[data-attacker-hp-proj-bar]'
    );

    const atkTerrainMeta = TERRAIN_METADATA[forecast.attackerTerrain];
    if (atkNameEl) {
      atkNameEl.textContent = `${attacker.nickname}${attacker.isLord ? ' ★' : ''}`;
    }
    if (atkMetaEl) {
      const spPrefix = attacker.nickname === attacker.speciesName ? '' : `${attacker.speciesName} `;
      atkMetaEl.textContent = `${spPrefix}Lv.${attacker.level} · ${atkTerrainMeta.label}`;
    }
    if (atkWpnEl) {
      atkWpnEl.textContent = `[E] ${atkSide.move.name} (Mt ${atkSide.move.mt})`;
    }
    if (atkHpEl) {
      atkHpEl.textContent = `${attacker.currentHp} → ${forecast.projectedAttackerHp}`;
    }
    if (atkDmgEl) {
      atkDmgEl.textContent =
        atkSide.strikes === 2 ? `${atkSide.damage} ×2` : `${atkSide.damage}`;
    }
    if (atkHitEl) atkHitEl.textContent = `${atkSide.hitRate}%`;
    if (atkCritEl) atkCritEl.textContent = `${atkSide.critRate}%`;
    if (atkCurBar) {
      atkCurBar.style.width = `${Math.round((attacker.currentHp / attacker.maxHp) * 100)}%`;
    }
    if (atkProjBar) {
      atkProjBar.className = 'pmd-forecast-hp-bar-fill';
      atkProjBar.style.width = `${Math.round((forecast.projectedAttackerHp / attacker.maxHp) * 100)}%`;
    }

    // Defender Card
    const defNameEl = this.forecastModalBackdropEl.querySelector(
      '[data-testid="forecast-defender-name"]'
    );
    const defMetaEl = this.forecastModalBackdropEl.querySelector('[data-defender-meta]');
    const defWpnEl = this.forecastModalBackdropEl.querySelector(
      '[data-testid="forecast-defender-weapon"]'
    );
    const defHpEl = this.forecastModalBackdropEl.querySelector(
      '[data-testid="forecast-defender-hp"]'
    );
    const defDmgEl = this.forecastModalBackdropEl.querySelector(
      '[data-testid="forecast-defender-dmg"]'
    );
    const defHitEl = this.forecastModalBackdropEl.querySelector(
      '[data-testid="forecast-defender-hit"]'
    );
    const defCritEl = this.forecastModalBackdropEl.querySelector(
      '[data-testid="forecast-defender-crit"]'
    );
    const defCurBar = this.forecastModalBackdropEl.querySelector<HTMLElement>(
      '[data-defender-hp-cur-bar]'
    );
    const defProjBar = this.forecastModalBackdropEl.querySelector<HTMLElement>(
      '[data-defender-hp-proj-bar]'
    );

    const defTerrainMeta = TERRAIN_METADATA[forecast.defenderTerrain];
    if (defNameEl) {
      const bossTag = defender.isBoss ? ' [BOSS]' : '';
      defNameEl.textContent = `${defender.nickname}${bossTag}`;
    }
    if (defMetaEl) {
      const extraTags: string[] = [];
      if (defender.stationary) extraTags.push('Immovable');
      if (defender.droppableItemId) {
        const dropItem = getItemById(defender.droppableItemId);
        if (dropItem) extraTags.push(`Drops: ${dropItem.name}`);
      }
      const tagSuffix = extraTags.length > 0 ? ` · ${extraTags.join(' · ')}` : '';
      const spPrefix = defender.nickname === defender.speciesName ? '' : `${defender.speciesName} `;
      defMetaEl.textContent = `${spPrefix}Lv.${defender.level} · ${defTerrainMeta.label}${tagSuffix}`;
    }
    if (defHpEl) {
      defHpEl.textContent =
        forecast.projectedDefenderHp <= 0
          ? `${defender.currentHp} → 0 (KO!)`
          : `${defender.currentHp} → ${forecast.projectedDefenderHp}`;
    }

    if (forecast.defenderCanCounter && forecast.defenderSide) {
      const ds = forecast.defenderSide;
      if (defWpnEl) defWpnEl.textContent = `[E] ${ds.move.name} (Mt ${ds.move.mt})`;
      if (defDmgEl) defDmgEl.textContent = ds.strikes === 2 ? `${ds.damage} ×2` : `${ds.damage}`;
      if (defHitEl) defHitEl.textContent = `${ds.hitRate}%`;
      if (defCritEl) defCritEl.textContent = `${ds.critRate}%`;
    } else {
      if (defWpnEl) {
        defWpnEl.textContent = 'No Counter';
      }
      if (defDmgEl) defDmgEl.textContent = '—';
      if (defHitEl) defHitEl.textContent = '—';
      if (defCritEl) defCritEl.textContent = '—';
    }

    if (defCurBar) {
      defCurBar.style.width = `${Math.round((defender.currentHp / defender.maxHp) * 100)}%`;
    }
    if (defProjBar) {
      defProjBar.className = 'pmd-forecast-hp-bar-fill is-enemy';
      defProjBar.style.width = `${Math.round((forecast.projectedDefenderHp / defender.maxHp) * 100)}%`;
    }
  }

  private refreshHealForecastModalDom(): void {
    const healer = this.getSelectedUnit();
    const target = this.units.find(
      (u) => u.id === this.forecastTargetId && !u.defeated && u.currentHp > 0
    );
    if (!healer || !target) return;

    const allHealTargets = this.getHealableTargetsFromCurrentTile(healer);
    const dist =
      target.id === healer.id ? 0 : manhattanDistance(healer.x, healer.y, target.x, target.y);
    const validMoves = getHealingMovesForTargetAtDistance(healer, target, dist);
    if (validMoves.length === 0) return;

    if (!this.forecastMoveId || !validMoves.some((m) => m.id === this.forecastMoveId)) {
      this.forecastMoveId = validMoves[0]!.id;
    }
    const activeSlot = validMoves.find((m) => m.id === this.forecastMoveId) ?? validMoves[0]!;

    const healForecast = computeHealForecast(this.map, healer, target, this.forecastMoveId);
    if (!healForecast) return;
    this.currentHealForecast = healForecast;

    // Heal-Mode Modal Chrome & Labels
    const titleEl = this.forecastModalBackdropEl.querySelector('[data-forecast-title]');
    if (titleEl) titleEl.textContent = 'HEAL FORECAST';
    const defCardEl = this.forecastModalBackdropEl.querySelector<HTMLElement>(
      '[data-testid="forecast-defender-card"]'
    );
    if (defCardEl) defCardEl.className = 'pmd-forecast-side is-ally-heal';
    const confirmBtnEl = this.forecastModalBackdropEl.querySelector<HTMLElement>(
      '[data-testid="forecast-attack-btn"]'
    );
    if (confirmBtnEl) confirmBtnEl.textContent = 'Heal!';

    const setStatLabel = (sel: string, txt: string) => {
      const el = this.forecastModalBackdropEl.querySelector(sel);
      if (el) el.textContent = txt;
    };
    setStatLabel('[data-atk-stat2-label]', 'HEAL');
    setStatLabel('[data-atk-stat3-label]', 'HIT');
    setStatLabel('[data-atk-stat4-label]', 'PP');
    setStatLabel('[data-def-stat2-label]', 'GAIN');
    setStatLabel('[data-def-stat3-label]', 'MAX');
    setStatLabel('[data-def-stat4-label]', 'STAT');

    void this.attackerPortraitView.setPortrait({
      speciesIdOrAssetId: healer.speciesId,
      emotion: 'Happy',
      mirrorHorizontal: false,
    });
    void this.defenderPortraitView.setPortrait({
      speciesIdOrAssetId: target.speciesId,
      emotion: 'Happy',
      mirrorHorizontal: true,
    });

    const subEl = this.forecastModalBackdropEl.querySelector('[data-forecast-subtitle]');
    const effBadgeEl = this.forecastModalBackdropEl.querySelector<HTMLElement>(
      '[data-testid="forecast-effectiveness-badge"]'
    );
    if (subEl) {
      const rangeDesc = healForecast.distance === 0 ? 'Self' : `R${healForecast.distance}`;
      subEl.textContent = `${rangeDesc} · ${healForecast.move.category} · ${healForecast.move.type}`;
    }
    if (effBadgeEl) {
      effBadgeEl.textContent = `+${healForecast.actualHeal} HP`;
      effBadgeEl.className = 'pmd-forecast-eff-badge is-super';
      effBadgeEl.hidden = false;
    }

    // Target selector pills (shown when 2+ allies/self are healable from current tile)
    const targetsWrap = this.forecastModalBackdropEl.querySelector<HTMLElement>(
      '[data-forecast-targets-wrap]'
    );
    const targetsRow = this.forecastModalBackdropEl.querySelector<HTMLElement>(
      '[data-forecast-targets]'
    );
    if (targetsWrap && targetsRow) {
      targetsRow.innerHTML = '';
      if (allHealTargets.length > 1) {
        targetsWrap.hidden = false;
        for (const entry of allHealTargets) {
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = `pmd-btn pmd-chip-btn${entry.ally.id === target.id ? ' is-active' : ''}`;
          btn.dataset.testid = `forecast-target-${entry.ally.id}`;
          const suffix = entry.ally.id === healer.id ? ' [Self]' : '';
          btn.textContent = `${entry.ally.nickname}${suffix} (HP ${entry.ally.currentHp}/${entry.ally.maxHp})`;
          bindPointerTap(
            btn,
            () => {
              this.audioManager.playSfx('select');
              this.forecastTargetId = entry.ally.id;
              if (entry.ally.id !== healer.id) {
                healer.direction = directionFromDelta(
                  entry.ally.x - healer.x,
                  entry.ally.y - healer.y
                );
              }
              this.refreshHealForecastModalDom();
              this.renderFrame(performance.now());
            },
            { signal: this.abortController.signal }
          );
          targetsRow.appendChild(btn);
        }
      } else {
        targetsWrap.hidden = true;
      }
    }

    // Move selector pills
    const movesRow = this.forecastModalBackdropEl.querySelector<HTMLElement>(
      '[data-forecast-moves]'
    );
    if (movesRow) {
      movesRow.innerHTML = '';
      for (const slot of validMoves) {
        const isSelected = slot.id === this.forecastMoveId;
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `pmd-btn pmd-chip-btn${isSelected ? ' is-active' : ''}`;
        btn.dataset.testid = `forecast-move-${slot.id}`;
        btn.textContent = `${slot.move.name} · R${slot.range[0]} · ${slot.ppRemaining} PP`;
        bindPointerTap(
          btn,
          () => {
            this.audioManager.playSfx('select');
            this.forecastMoveId = slot.id;
            this.refreshHealForecastModalDom();
          },
          { signal: this.abortController.signal }
        );
        movesRow.appendChild(btn);
      }
    }

    // Left Card (Healer)
    const atkNameEl = this.forecastModalBackdropEl.querySelector(
      '[data-testid="forecast-attacker-name"]'
    );
    const atkMetaEl = this.forecastModalBackdropEl.querySelector('[data-attacker-meta]');
    const atkWpnEl = this.forecastModalBackdropEl.querySelector(
      '[data-testid="forecast-attacker-weapon"]'
    );
    const atkHpEl = this.forecastModalBackdropEl.querySelector(
      '[data-testid="forecast-attacker-hp"]'
    );
    const atkDmgEl = this.forecastModalBackdropEl.querySelector(
      '[data-testid="forecast-attacker-dmg"]'
    );
    const atkHitEl = this.forecastModalBackdropEl.querySelector(
      '[data-testid="forecast-attacker-hit"]'
    );
    const atkCritEl = this.forecastModalBackdropEl.querySelector(
      '[data-testid="forecast-attacker-crit"]'
    );
    const atkCurBar = this.forecastModalBackdropEl.querySelector<HTMLElement>(
      '[data-attacker-hp-cur-bar]'
    );
    const atkProjBar = this.forecastModalBackdropEl.querySelector<HTMLElement>(
      '[data-attacker-hp-proj-bar]'
    );

    const healerTerrainMeta = TERRAIN_METADATA[healForecast.healerTerrain];
    const healerProjectedHp =
      target.id === healer.id ? healForecast.projectedTargetHp : healer.currentHp;
    if (atkNameEl) {
      atkNameEl.textContent = `${healer.nickname}${healer.isLord ? ' ★' : ''}`;
    }
    if (atkMetaEl) {
      const spPrefix = healer.nickname === healer.speciesName ? '' : `${healer.speciesName} `;
      atkMetaEl.textContent = `${spPrefix}Lv.${healer.level} · ${healerTerrainMeta.label}`;
    }
    if (atkWpnEl) {
      atkWpnEl.textContent = `${healForecast.move.name} (PP ${healForecast.ppBefore} → ${healForecast.ppAfter})`;
    }
    if (atkHpEl) {
      atkHpEl.textContent =
        target.id === healer.id
          ? `${healer.currentHp} → ${healerProjectedHp}`
          : `${healer.currentHp}/${healer.maxHp}`;
    }
    if (atkDmgEl) atkDmgEl.textContent = `+${healForecast.actualHeal}`;
    if (atkHitEl) atkHitEl.textContent = '100%';
    if (atkCritEl) atkCritEl.textContent = `${healForecast.ppAfter}/${activeSlot.maxPp}`;
    if (atkCurBar) {
      atkCurBar.style.width = `${Math.round((healer.currentHp / healer.maxHp) * 100)}%`;
    }
    if (atkProjBar) {
      atkProjBar.className = 'pmd-forecast-hp-bar-fill';
      atkProjBar.style.width = `${Math.round((healerProjectedHp / healer.maxHp) * 100)}%`;
    }

    // Right Card (Heal Target)
    const defNameEl = this.forecastModalBackdropEl.querySelector(
      '[data-testid="forecast-defender-name"]'
    );
    const defMetaEl = this.forecastModalBackdropEl.querySelector('[data-defender-meta]');
    const defWpnEl = this.forecastModalBackdropEl.querySelector(
      '[data-testid="forecast-defender-weapon"]'
    );
    const defHpEl = this.forecastModalBackdropEl.querySelector(
      '[data-testid="forecast-defender-hp"]'
    );
    const defDmgEl = this.forecastModalBackdropEl.querySelector(
      '[data-testid="forecast-defender-dmg"]'
    );
    const defHitEl = this.forecastModalBackdropEl.querySelector(
      '[data-testid="forecast-defender-hit"]'
    );
    const defCritEl = this.forecastModalBackdropEl.querySelector(
      '[data-testid="forecast-defender-crit"]'
    );
    const defCurBar = this.forecastModalBackdropEl.querySelector<HTMLElement>(
      '[data-defender-hp-cur-bar]'
    );
    const defProjBar = this.forecastModalBackdropEl.querySelector<HTMLElement>(
      '[data-defender-hp-proj-bar]'
    );

    const targetTerrainMeta = TERRAIN_METADATA[healForecast.targetTerrain];
    if (defNameEl) {
      defNameEl.textContent = `${target.nickname}${target.isLord ? ' ★' : ''}`;
    }
    if (defMetaEl) {
      const spPrefix = target.nickname === target.speciesName ? '' : `${target.speciesName} `;
      defMetaEl.textContent = `${spPrefix}Lv.${target.level} · ${targetTerrainMeta.label}`;
    }
    if (defWpnEl) {
      defWpnEl.textContent = `Recovers +${healForecast.actualHeal} HP (${Math.round((healForecast.projectedTargetHp / target.maxHp) * 100)}% Max)`;
    }
    if (defHpEl) {
      defHpEl.textContent = `${target.currentHp} → ${healForecast.projectedTargetHp}`;
    }
    if (defDmgEl) defDmgEl.textContent = `+${healForecast.actualHeal}`;
    if (defHitEl) defHitEl.textContent = `${target.maxHp}`;
    if (defCritEl) {
      defCritEl.textContent = healForecast.curesStatus ? 'Cured!' : (target.status ?? 'OK');
    }
    if (defCurBar) {
      defCurBar.style.width = `${Math.round((target.currentHp / target.maxHp) * 100)}%`;
    }
    if (defProjBar) {
      defProjBar.className = 'pmd-forecast-hp-bar-fill is-heal';
      defProjBar.style.width = `${Math.round((healForecast.projectedTargetHp / target.maxHp) * 100)}%`;
    }
  }

  private cancelCombatForecast(): void {
    this.forecastModalBackdropEl.hidden = true;
    this.forecastTargetId = null;
    this.forecastMoveId = null;
    this.currentForecast = null;
    this.currentHealForecast = null;

    if (this.forecastReturnMode === 'action_menu') {
      const selected = this.getSelectedUnit();
      if (selected) {
        this.audioManager.playSfx('cancel');
        this.openFloatingCommandMenu(selected);
        return;
      }
    }
    this.cancelUncommittedMove();
  }

  private async confirmForecastAction(): Promise<void> {
    if (this.forecastMode === 'heal') {
      await this.confirmForecastHeal();
    } else {
      await this.confirmForecastAttack();
    }
  }

  private async confirmForecastAttack(): Promise<void> {
    const attacker = this.getSelectedUnit();
    const defender = this.units.find(
      (u) => u.id === this.forecastTargetId && !u.defeated && u.currentHp > 0
    );
    if (!attacker || !defender || !this.forecastMoveId) return;

    const forecast = computeCombatForecast(this.map, attacker, defender, this.forecastMoveId);
    if (!forecast) return;

    const runGen = this.battleRunGen;

    // Rule 4: Initiating combat with an offensive move marks it `[E]` Equipped for Enemy Phase!
    attacker.equippedMoveId = forecast.attackerSide.move.id;

    this.audioManager.playSfx('select');
    this.forecastModalBackdropEl.hidden = true;
    this.actionMenuEl.hidden = true;
    this.currentRange = null;
    this.previewPath = null;
    this.interactionState = 'combat_animating';
    this.syncHudControls();
    this.onLayerStateChanged();

    await this.playCombatExchangeAsync(attacker, defender, forecast, runGen);
    if (!this.openState || runGen !== this.battleRunGen) return;

    this.recomputeDangerArea();
    if (this.checkAndTriggerMatchEnd()) {
      return;
    }

    if (!attacker.defeated && attacker.currentHp > 0) {
      attacker.waited = true;
      attacker.action = 'Idle';
      attacker.renderWorldX = attacker.x * PMD_TILE_NATIVE_PX;
      attacker.renderWorldY = attacker.y * PMD_TILE_NATIVE_PX;
    }

    this.clearSelection();
    this.syncHudControls();
    this.updateInfoStrip();
    this.onLayerStateChanged();
    this.renderFrame(performance.now());

    if (this.areAllLivingPlayersWaited()) {
      await this.waitBattleMs(240);
      if (!this.openState || runGen !== this.battleRunGen || this.phase !== 'player_phase') {
        return;
      }
      await this.runEnemyPhase();
    }
  }

  private async confirmForecastHeal(): Promise<void> {
    const healer = this.getSelectedUnit();
    const target = this.units.find(
      (u) => u.id === this.forecastTargetId && !u.defeated && u.currentHp > 0
    );
    if (!healer || !target || !this.forecastMoveId) return;

    const healForecast = computeHealForecast(this.map, healer, target, this.forecastMoveId);
    if (!healForecast) return;

    const runGen = this.battleRunGen;

    // Note (Rule 4): Support/Heal moves are never marked `[E]` Equipped; `healer.equippedMoveId` remains its offensive move!
    this.audioManager.playSfx('select');
    this.forecastModalBackdropEl.hidden = true;
    this.actionMenuEl.hidden = true;
    this.currentRange = null;
    this.previewPath = null;
    this.interactionState = 'combat_animating';
    this.syncHudControls();
    this.onLayerStateChanged();

    await this.playHealActionAsync(healer, target, healForecast, runGen);
    if (!this.openState || runGen !== this.battleRunGen) return;

    healer.waited = true;
    healer.action = 'Idle';
    healer.renderWorldX = healer.x * PMD_TILE_NATIVE_PX;
    healer.renderWorldY = healer.y * PMD_TILE_NATIVE_PX;

    this.recomputeDangerArea();
    this.clearSelection();
    this.syncHudControls();
    this.updateInfoStrip();
    this.onLayerStateChanged();
    this.renderFrame(performance.now());

    if (this.areAllLivingPlayersWaited()) {
      await this.waitBattleMs(240);
      if (!this.openState || runGen !== this.battleRunGen || this.phase !== 'player_phase') {
        return;
      }
      await this.runEnemyPhase();
    }
  }

  private async playHealActionAsync(
    healer: BattleUnitState,
    target: BattleUnitState,
    healForecast: HealForecast,
    runGen = this.battleRunGen
  ): Promise<void> {
    this.ensureTilePairVisible(healer.x, healer.y, target.x, target.y);

    if (target.id !== healer.id) {
      healer.direction = directionFromDelta(target.x - healer.x, target.y - healer.y);
    }
    healer.action = 'Special';
    healer.frameIndex = 0;

    // Deduct 1 PP from the healing move slot
    const slot = healer.activeMoves.find((s) => s.id === healForecast.move.id);
    if (slot) {
      slot.ppRemaining = healForecast.ppAfter;
    }

    const fromCenterX = healer.x * PMD_TILE_NATIVE_PX + PMD_TILE_NATIVE_PX / 2;
    const fromCenterY = healer.y * PMD_TILE_NATIVE_PX + PMD_TILE_NATIVE_PX / 2;
    const toCenterX = target.x * PMD_TILE_NATIVE_PX + PMD_TILE_NATIVE_PX / 2;
    const toCenterY = target.y * PMD_TILE_NATIVE_PX + PMD_TILE_NATIVE_PX / 2;

    this.activeStrikeVfx = {
      kind: target.id === healer.id ? 'impact_burst' : 'ranged',
      fromWorldX: fromCenterX,
      fromWorldY: fromCenterY,
      toWorldX: toCenterX,
      toWorldY: toCenterY,
      color: '#68f8a8',
      startedAtMs: performance.now(),
      durationMs: this.fastMode ? 70 : 280,
    };

    await this.waitBattleMs(200);
    if (!this.openState || runGen !== this.battleRunGen) return;

    this.audioManager.playSfx('heal');
    target.currentHp = healForecast.projectedTargetHp;
    if (healForecast.curesStatus) {
      target.status = null;
      target.statusTurns = 0;
    }

    this.activeStrikeVfx = {
      kind: 'impact_burst',
      fromWorldX: toCenterX,
      fromWorldY: toCenterY,
      toWorldX: toCenterX,
      toWorldY: toCenterY,
      color: '#68f8a8',
      startedAtMs: performance.now(),
      durationMs: this.fastMode ? 80 : 300,
    };

    this.spawnFloatingText(target.x, target.y, `+${healForecast.actualHeal} HP`, '#68f8a8');
    this.updateInfoStrip();

    await this.waitBattleMs(320);
    if (!this.openState || runGen !== this.battleRunGen) return;

    this.activeStrikeVfx = null;
    healer.action = 'Idle';

    if (healer.faction === 'player' && !healer.defeated && healer.currentHp > 0) {
      const enemies = this.units.filter((u) => u.faction === 'enemy');
      const chapterLv =
        enemies.length > 0
          ? Math.max(1, Math.round(enemies.reduce((s, e) => s + e.level, 0) / enemies.length))
          : healer.level;
      const healExp = computeSupportHealExpGain(healer.level, chapterLv);
      await this.grantExpAndHandleLevelUps(healer, healExp, runGen);
    }
  }

  private dismissLevelUpModal(): void {
    if (this.levelUpModalBackdropEl.hidden && !this.levelUpResolver) return;
    this.levelUpModalBackdropEl.hidden = true;
    const resolver = this.levelUpResolver;
    this.levelUpResolver = null;
    this.onLayerStateChanged();
    this.renderFrame(performance.now());
    resolver?.();
  }

  private presentLevelUpModalAsync(
    unit: BattleUnitState,
    roll: LevelUpResult,
    runGen: number
  ): Promise<void> {
    if (!this.openState || runGen !== this.battleRunGen) {
      return Promise.resolve();
    }

    const titleEl = this.levelUpModalBackdropEl.querySelector('[data-testid="levelup-unit-title"]');
    const levelLineEl = this.levelUpModalBackdropEl.querySelector(
      '[data-testid="levelup-level-line"]'
    );
    const statsGridEl = this.levelUpModalBackdropEl.querySelector<HTMLElement>(
      '[data-testid="levelup-stats-grid"]'
    );
    const extraNotesEl = this.levelUpModalBackdropEl.querySelector<HTMLElement>(
      '[data-testid="levelup-extra-notes"]'
    );

    if (titleEl) {
      titleEl.textContent = `${unit.nickname} (${roll.speciesName})`;
    }
    if (levelLineEl) {
      levelLineEl.textContent = `Lv. ${roll.previousLevel} → Lv. ${roll.newLevel}`;
    }

    void this.levelUpPortraitView.setPortrait({
      speciesIdOrAssetId: unit.speciesId,
      emotion: 'Happy',
      mirrorHorizontal: false,
    });

    if (statsGridEl) {
      statsGridEl.innerHTML = '';
      const statDefs: ReadonlyArray<{
        key: 'hp' | 'atk' | 'def' | 'spa' | 'spd' | 'spe';
        label: string;
      }> = [
        { key: 'hp', label: 'HP' },
        { key: 'atk', label: 'ATK' },
        { key: 'def', label: 'DEF' },
        { key: 'spa', label: 'SPA' },
        { key: 'spd', label: 'SPD' },
        { key: 'spe', label: 'SPE' },
      ];
      for (const sd of statDefs) {
        const gain = roll.statGains[sd.key];
        const cell = document.createElement('div');
        cell.className = 'pmd-prep-stat-cell';
        cell.dataset.testid = `levelup-stat-${sd.key}`;
        if (gain > 0) {
          cell.style.borderColor = '#f8d048';
        }
        const valText =
          gain > 0 ? `${roll.statsAfter[sd.key]} (+${gain})` : `${roll.statsAfter[sd.key]}`;
        cell.innerHTML = `<span>${sd.label}</span><strong style="${gain > 0 ? 'color:#ffe066;' : ''}">${valText}</strong>`;
        statsGridEl.appendChild(cell);
      }
      const movCell = document.createElement('div');
      movCell.className = 'pmd-prep-stat-cell';
      movCell.dataset.testid = 'levelup-stat-mov';
      movCell.innerHTML = `<span>MOV</span><strong>${roll.statsAfter.mov}</strong>`;
      statsGridEl.appendChild(movCell);
    }

    if (extraNotesEl) {
      const notes: string[] = [];
      if (roll.newlyLearnedMoveIds.length > 0) {
        const moveNames = roll.newlyLearnedMoveIds
          .map((mId) => getMoveById(mId)?.name ?? mId)
          .join(', ');
        notes.push(`Learned ${moveNames}!`);
      }
      if (roll.canPromoteWithStoneNow) {
        notes.push(`★ Evolution Stone Ready at Lv. ${roll.newLevel}!`);
      }
      if (notes.length > 0) {
        extraNotesEl.textContent = notes.join(' · ');
        extraNotesEl.hidden = false;
      } else {
        extraNotesEl.textContent = '';
        extraNotesEl.hidden = true;
      }
    }

    this.levelUpModalBackdropEl.hidden = false;
    this.onLayerStateChanged();
    this.renderFrame(performance.now());

    return new Promise<void>((resolve) => {
      this.levelUpResolver = resolve;
      if (this.fastMode && !this.pauseOnLevelUpInFastMode) {
        window.setTimeout(() => {
          if (this.levelUpResolver === resolve) {
            this.dismissLevelUpModal();
          }
        }, 45);
      }
    });
  }

  private async grantExpAndHandleLevelUps(
    unit: BattleUnitState,
    expGain: number,
    runGen: number
  ): Promise<void> {
    if (
      !this.openState ||
      runGen !== this.battleRunGen ||
      unit.faction !== 'player' ||
      unit.defeated ||
      unit.currentHp <= 0 ||
      expGain <= 0
    ) {
      return;
    }

    const rng = this.customRng ?? Math.random;
    const { expAdded, levelUps } = awardBattleUnitExp(unit, expGain, rng);
    if (expAdded <= 0) return;

    this.spawnFloatingText(unit.x, unit.y, `+${expAdded} EXP`, '#7ce8ff', 900);
    this.updateInfoStrip();
    await this.waitBattleMs(220);
    if (!this.openState || runGen !== this.battleRunGen) return;

    for (const lv of levelUps) {
      this.levelUpHistory.push(lv);
      this.audioManager.playSfx('victory_fanfare');
      this.spawnFloatingText(unit.x, unit.y, `LEVEL UP! Lv.${lv.newLevel}`, '#ffe066', 1100);
      await this.presentLevelUpModalAsync(unit, lv, runGen);
      if (!this.openState || runGen !== this.battleRunGen) return;
      this.updateInfoStrip();
    }
  }

  // ==========================================================================
  // Animated Combat Resolution & Enemy Phase Sequencer
  // ==========================================================================

  private waitBattleMs(normalMs: number): Promise<void> {
    const scaled = this.fastMode ? Math.max(20, Math.round(normalMs * 0.12)) : normalMs;
    return new Promise((resolve) => {
      window.setTimeout(resolve, scaled);
    });
  }

  private spawnFloatingText(
    tileX: number,
    tileY: number,
    text: string,
    color: string,
    durationMs = 820
  ): void {
    this.floatingTexts.push({
      id: this.nextFloatingTextId++,
      worldX: tileX * PMD_TILE_NATIVE_PX + PMD_TILE_NATIVE_PX / 2,
      worldY: tileY * PMD_TILE_NATIVE_PX + 2,
      text,
      color,
      createdAtMs: performance.now(),
      durationMs: this.fastMode ? Math.max(120, Math.round(durationMs * 0.25)) : durationMs,
    });
  }

  private ensureTilePairVisible(ax: number, ay: number, bx: number, by: number): void {
    const midWorldX = ((ax + bx) / 2) * PMD_TILE_NATIVE_PX + PMD_TILE_NATIVE_PX / 2;
    const midWorldY = ((ay + by) / 2) * PMD_TILE_NATIVE_PX + PMD_TILE_NATIVE_PX / 2;
    const margin = 36;
    if (
      midWorldX < this.cameraX + margin ||
      midWorldX > this.cameraX + this.bufferWidth - margin ||
      midWorldY < this.cameraY + margin ||
      midWorldY > this.cameraY + this.bufferHeight - margin
    ) {
      this.setCameraPosition(
        midWorldX - this.bufferWidth / 2,
        midWorldY - this.bufferHeight / 2
      );
    }
  }

  private async playCombatExchangeAsync(
    attacker: BattleUnitState,
    defender: BattleUnitState,
    forecast: CombatForecast,
    runGen = this.battleRunGen
  ): Promise<void> {
    const rng = this.customRng ?? Math.random;
    const outcome = resolveCombatExchange(forecast, attacker, defender, rng);

    this.ensureTilePairVisible(attacker.x, attacker.y, defender.x, defender.y);

    for (const strike of outcome.strikes) {
      if (!this.openState || runGen !== this.battleRunGen) return;

      const actor = strike.actorId === attacker.id ? attacker : defender;
      const target = strike.targetId === attacker.id ? attacker : defender;
      if (actor.defeated || target.defeated) break;

      actor.direction = directionFromDelta(target.x - actor.x, target.y - actor.y);
      target.direction = directionFromDelta(actor.x - target.x, actor.y - target.y);

      // Deduct PP on the used move slot
      const actorMoveSlot = actor.activeMoves.find((s) => s.id === strike.move.id);
      if (actorMoveSlot) {
        actorMoveSlot.ppRemaining = strike.actorPpAfter;
      }

      if (strike.paralyzedSkip) {
        this.audioManager.playSfx('cancel');
        this.spawnFloatingText(actor.x, actor.y, 'PARALYZED!', '#f8d048');
        await this.waitBattleMs(340);
        continue;
      }

      const isPhysical = strike.move.category === 'Physical';
      actor.action = isPhysical ? 'Attack' : 'Special';
      actor.frameIndex = 0;
      actor.nextFrameAt = performance.now() + 70;

      const dxNorm = Math.sign(target.x - actor.x);
      const dyNorm = Math.sign(target.y - actor.y);

      if (isPhysical) {
        // Melee lunge toward target
        actor.renderWorldX = actor.x * PMD_TILE_NATIVE_PX + dxNorm * 6;
        actor.renderWorldY = actor.y * PMD_TILE_NATIVE_PX + dyNorm * 6;
        this.activeStrikeVfx = {
          kind: 'melee',
          fromWorldX: actor.x * PMD_TILE_NATIVE_PX + 12,
          fromWorldY: actor.y * PMD_TILE_NATIVE_PX + 12,
          toWorldX: target.x * PMD_TILE_NATIVE_PX + 12,
          toWorldY: target.y * PMD_TILE_NATIVE_PX + 12,
          color: strike.isCrit ? '#f8d048' : '#ffffff',
          startedAtMs: performance.now(),
          durationMs: this.fastMode ? 45 : 220,
        };
        await this.waitBattleMs(190);
      } else {
        // Ranged Special energy projectile traveling from actor to target
        this.activeStrikeVfx = {
          kind: 'ranged',
          fromWorldX: actor.x * PMD_TILE_NATIVE_PX + 12,
          fromWorldY: actor.y * PMD_TILE_NATIVE_PX + 12,
          toWorldX: target.x * PMD_TILE_NATIVE_PX + 12,
          toWorldY: target.y * PMD_TILE_NATIVE_PX + 12,
          color: strike.isCrit ? '#f8d048' : '#68e0ff',
          startedAtMs: performance.now(),
          durationMs: this.fastMode ? 55 : 260,
        };
        await this.waitBattleMs(240);
      }

      if (!this.openState || runGen !== this.battleRunGen) return;

      // Restore lunge offset at impact
      actor.renderWorldX = actor.x * PMD_TILE_NATIVE_PX;
      actor.renderWorldY = actor.y * PMD_TILE_NATIVE_PX;

      if (!strike.didHit) {
        this.audioManager.playSfx('attack_miss');
        // Quick dodge sidestep
        target.renderWorldX = target.x * PMD_TILE_NATIVE_PX + (dyNorm !== 0 ? 4 : 0);
        target.renderWorldY = target.y * PMD_TILE_NATIVE_PX + (dxNorm !== 0 ? -3 : 0);
        this.spawnFloatingText(target.x, target.y, 'MISS', '#90d8f8');
        await this.waitBattleMs(260);
        target.renderWorldX = target.x * PMD_TILE_NATIVE_PX;
        target.renderWorldY = target.y * PMD_TILE_NATIVE_PX;
        actor.action = 'Idle';
        continue;
      }

      // Apply HP impact
      target.currentHp = strike.targetHpAfter;
      target.action = 'Hurt';
      target.frameIndex = 0;
      target.hitFlashUntilMs = performance.now() + (this.fastMode ? 60 : 230);

      this.activeStrikeVfx = {
        kind: 'impact_burst',
        fromWorldX: target.x * PMD_TILE_NATIVE_PX + 12,
        fromWorldY: target.y * PMD_TILE_NATIVE_PX + 12,
        toWorldX: target.x * PMD_TILE_NATIVE_PX + 12,
        toWorldY: target.y * PMD_TILE_NATIVE_PX + 12,
        color: strike.isCrit ? '#f8d048' : '#ff6878',
        startedAtMs: performance.now(),
        durationMs: this.fastMode ? 50 : 210,
      };

      if (strike.typeMultiplier === 0) {
        this.audioManager.playSfx('attack_miss');
        this.spawnFloatingText(target.x, target.y, 'IMMUNE (0)', '#c8d4e8');
      } else if (strike.isCrit) {
        this.audioManager.playSfx('critical_hit');
        this.spawnFloatingText(target.x, target.y, `CRIT! -${strike.damageDealt}`, '#f8d048');
      } else {
        this.audioManager.playSfx('attack_hit');
        this.spawnFloatingText(target.x, target.y, `-${strike.damageDealt}`, '#ff7888');
      }

      this.updateInfoStrip();
      await this.waitBattleMs(310);
      if (!this.openState || runGen !== this.battleRunGen) return;

      actor.action = 'Idle';
      this.activeStrikeVfx = null;

      if (strike.targetDefeated) {
        this.audioManager.playSfx('unit_ko');
        this.spawnFloatingText(target.x, target.y, 'DEFEATED!', '#ffb060', 950);
        if (target.faction === 'enemy' && target.droppableItemId) {
          const dropId = target.droppableItemId;
          target.droppableItemId = null;
          this.collectedDrops.push(dropId);
          const dropDef = getItemById(dropId);
          const dropName = dropDef?.name ?? dropId;
          this.audioManager.playSfx('heal');
          this.spawnFloatingText(target.x, Math.max(0, target.y - 1), `Got ${dropName}!`, '#ffd860', 1200);
        }
        const koSteps = 6;
        for (let s = 1; s <= koSteps; s++) {
          if (!this.openState || runGen !== this.battleRunGen) return;
          target.koDissolveProgress = s / koSteps;
          await this.waitBattleMs(55);
        }
        target.defeated = true;
        this.trackedEnemyIds.delete(target.id);
        break;
      } else {
        target.action = 'Idle';
      }
    }

    this.activeStrikeVfx = null;

    // Award Combat EXP to the surviving player participant (on either Player Phase or Enemy Phase counter!)
    const playerUnit =
      attacker.faction === 'player' ? attacker : defender.faction === 'player' ? defender : null;
    const enemyUnit =
      attacker.faction === 'enemy' ? attacker : defender.faction === 'enemy' ? defender : null;

    if (
      playerUnit &&
      enemyUnit &&
      !playerUnit.defeated &&
      playerUnit.currentHp > 0 &&
      outcome.strikes.some((s) => s.actorId === playerUnit.id)
    ) {
      const playerStrikes = outcome.strikes.filter((s) => s.actorId === playerUnit.id);
      const landedHit = playerStrikes.some((s) => s.didHit);
      const dealtDamage = playerStrikes.some((s) => s.didHit && s.damageDealt > 0);
      const defeatedEnemy = enemyUnit.defeated || enemyUnit.currentHp <= 0;
      const expGain = computeCombatExpGain({
        playerLevel: playerUnit.level,
        enemyLevel: enemyUnit.level,
        landedHit,
        dealtDamage,
        defeatedEnemy,
      });
      await this.grantExpAndHandleLevelUps(playerUnit, expGain, runGen);
    }
  }

  private playWalkPathAsync(
    unit: BattleUnitState,
    path: AStarPathStep[],
    followCamera: boolean
  ): Promise<void> {
    if (path.length <= 1) {
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      unit.action = 'Walk';
      unit.frameIndex = 0;
      this.activeWalk = {
        unitId: unit.id,
        steps: path,
        segmentIndex: 0,
        segmentElapsedMs: 0,
        lastTickMs: performance.now(),
        followCamera,
        onComplete: () => {
          unit.action = 'Idle';
          unit.renderWorldX = unit.x * PMD_TILE_NATIVE_PX;
          unit.renderWorldY = unit.y * PMD_TILE_NATIVE_PX;
          resolve();
        },
      };
    });
  }

  public async requestManualEndPhase(): Promise<void> {
    if (
      !this.openState ||
      this.phase !== 'player_phase' ||
      (this.interactionState !== 'idle' && this.interactionState !== 'unit_selected')
    ) {
      return;
    }
    this.audioManager.playSfx('select');
    this.clearSelection();
    await this.runEnemyPhase();
  }

  private async runEnemyPhase(): Promise<void> {
    const runGen = this.battleRunGen;
    if (!this.openState || this.phase !== 'player_phase') return;

    this.clearSelection();
    this.phase = 'enemy_phase';
    this.interactionState = 'enemy_acting';
    this.syncHudControls();
    this.onLayerStateChanged();

    this.audioManager.playSfx('phase_change');
    this.showPhaseBanner(`ENEMY PHASE — TURN ${this.turnNumber}`);
    await this.waitBattleMs(480);
    if (!this.openState || runGen !== this.battleRunGen) return;

    const enemiesOrder = [...this.getLivingEnemies()];
    for (const enemy of enemiesOrder) {
      if (!this.openState || runGen !== this.battleRunGen) return;
      if (enemy.defeated || enemy.currentHp <= 0) continue;

      this.inspectedTile = { x: enemy.x, y: enemy.y };
      this.ensureTilePairVisible(enemy.x, enemy.y, enemy.x, enemy.y);
      this.updateInfoStrip();

      const decision = chooseEnemyAction(this.map, enemy, this.getLivingUnits());

      if (decision.path.length > 1) {
        await this.playWalkPathAsync(enemy, decision.path, true);
        if (!this.openState || runGen !== this.battleRunGen) return;
        this.inspectedTile = { x: enemy.x, y: enemy.y };
        this.updateInfoStrip();
      }

      if (decision.kind === 'attack' && decision.attack) {
        const target = this.units.find(
          (u) => u.id === decision.attack!.targetUnitId && !u.defeated && u.currentHp > 0
        );
        if (target) {
          enemy.equippedMoveId = decision.attack.moveId;
          const liveForecast = computeCombatForecast(
            this.map,
            enemy,
            target,
            decision.attack.moveId
          );
          if (liveForecast) {
            await this.waitBattleMs(160);
            if (!this.openState || runGen !== this.battleRunGen) return;
            await this.playCombatExchangeAsync(enemy, target, liveForecast, runGen);
            if (!this.openState || runGen !== this.battleRunGen) return;

            this.recomputeDangerArea();
            if (this.checkAndTriggerMatchEnd()) {
              return;
            }
          }
        }
      }

      if (!enemy.defeated && enemy.currentHp > 0) {
        enemy.waited = true;
        enemy.action = 'Idle';
      }
      await this.waitBattleMs(140);
    }

    if (!this.openState || runGen !== this.battleRunGen) return;

    // Transition to Next Player Phase
    this.turnNumber += 1;
    for (const unit of this.getLivingUnits()) {
      unit.waited = false;
      unit.action = 'Idle';
    }

    // Scheduled Dungeon Stairs Reinforcements (blocked if any living unit occupies the Stairs tile)
    await this.processTurnReinforcements(runGen);
    if (!this.openState || runGen !== this.battleRunGen) return;

    // Start-of-Player-Phase Wonder Tile 20% Max HP Healing
    for (const pu of this.getLivingPlayers()) {
      const terrain = getMapTerrainAt(this.map, pu.x, pu.y);
      if (terrain === 'wonder_tile' && pu.currentHp < pu.maxHp) {
        const healAmt = Math.max(1, Math.floor(pu.maxHp * 0.2));
        const actualHeal = Math.min(pu.maxHp - pu.currentHp, healAmt);
        pu.currentHp += actualHeal;
        this.spawnFloatingText(pu.x, pu.y, `+${actualHeal} HP`, '#68f098');
      }
    }

    this.recomputeDangerArea();
    const lord = this.getLordUnit() ?? this.getLivingPlayers()[0];
    if (lord) {
      this.ensureTilePairVisible(lord.x, lord.y, lord.x, lord.y);
      this.inspectedTile = { x: lord.x, y: lord.y };
    }

    this.phase = 'player_phase';
    this.interactionState = 'idle';
    this.audioManager.playSfx('phase_change');
    this.showPhaseBanner(`PLAYER PHASE — TURN ${this.turnNumber}`);
    this.syncHudControls();
    this.updateInfoStrip();
    this.onLayerStateChanged();
    this.renderFrame(performance.now());
  }

  private async processTurnReinforcements(runGen: number): Promise<void> {
    if (this.reinforcements.length === 0) return;
    const dueWaves = this.reinforcements.filter(
      (w) =>
        w.turnNumber === this.turnNumber &&
        !this.spawnedReinforcementIds.has(w.id) &&
        !this.blockedReinforcementIds.has(w.id)
    );
    if (dueWaves.length === 0) return;

    for (const wave of dueWaves) {
      if (!this.openState || runGen !== this.battleRunGen) return;
      const occupant = this.getLivingUnits().find(
        (u) => u.x === wave.stairsX && u.y === wave.stairsY
      );
      if (occupant) {
        this.blockedReinforcementIds.add(wave.id);
        this.audioManager.playSfx('select');
        this.spawnFloatingText(
          wave.stairsX,
          wave.stairsY,
          'STAIRS BLOCKED!',
          '#88f8b8',
          1050
        );
        await this.waitBattleMs(200);
        continue;
      }

      const spawnDef: ManualEnemyBattleSpawn = {
        ...wave.enemy,
        id: wave.enemy.id || wave.id,
        x: wave.stairsX,
        y: wave.stairsY,
      };
      const newEnemy = buildSingleEnemyBattleUnit(
        spawnDef,
        this.units.length,
        performance.now()
      );
      if (!this.spriteBundles.has(newEnemy.speciesId)) {
        const bundle = await loadSpeciesSpriteBundle(newEnemy.speciesId);
        this.spriteBundles.set(newEnemy.speciesId, bundle);
      }
      this.units.push(newEnemy);
      this.spawnedReinforcementIds.add(wave.id);
      this.ensureTilePairVisible(newEnemy.x, newEnemy.y, newEnemy.x, newEnemy.y);
      this.audioManager.playSfx('phase_change');
      this.spawnFloatingText(
        newEnemy.x,
        newEnemy.y,
        `REINFORCEMENT!`,
        '#ff8090',
        1050
      );
      this.renderFrame(performance.now());
      await this.waitBattleMs(260);
    }
  }

  private checkAndTriggerMatchEnd(): boolean {
    if (this.isLordDefeated()) {
      this.triggerDefeatModal();
      return true;
    }
    const livingEnemies = this.getLivingEnemies();
    if (this.objectiveType === 'defeat_boss') {
      const hasAnyBossConfigured = this.units.some((u) => u.faction === 'enemy' && u.isBoss);
      const livingBosses = livingEnemies.filter((u) => u.isBoss);
      if (livingEnemies.length === 0 || (hasAnyBossConfigured && livingBosses.length === 0)) {
        this.triggerVictoryModal();
        return true;
      }
      return false;
    }
    if (livingEnemies.length === 0) {
      this.triggerVictoryModal();
      return true;
    }
    return false;
  }

  private triggerVictoryModal(): void {
    this.clearSelection();
    this.phase = 'victory';
    this.interactionState = 'idle';
    this.phaseBannerEl.hidden = true;

    if (!this.victoryCallbackFired) {
      this.victoryCallbackFired = true;
      if (this.commitToSaveOnVictory && this.saveManager.getSave() !== null) {
        const deployedSync = this.units
          .filter((u) => u.faction === 'player' && u.rosterInstanceId)
          .map((u) => ({
            instanceId: u.rosterInstanceId!,
            speciesId: u.speciesId,
            nickname: u.nickname,
            level: u.level,
            exp: u.exp ?? 0,
            currentStats: { ...u.stats },
            unlockedMoveIds: [...(u.unlockedMoveIds ?? u.activeMoves.map((m) => m.id))],
            activeMoveIds: u.activeMoves.map((m) => m.id),
            equippedMoveId: u.equippedMoveId,
            heldItemId: u.heldItemId,
            consumableItemId: u.consumableItemId,
          }));
        this.saveManager.commitBattleResults({
          deployedUnits: deployedSync,
          droppedItemIds: this.collectedDrops,
          clearRewardItems: this.clearRewardItems,
        });
      }
      this.currentOnVictory?.();
    }

    const subEl = this.victoryModalBackdropEl.querySelector('[data-victory-sub]');
    const summaryEl = this.victoryModalBackdropEl.querySelector<HTMLElement>(
      '[data-victory-summary]'
    );
    if (subEl) {
      subEl.textContent = `${this.map.name} · Turn ${this.turnNumber}`;
    }
    if (summaryEl) {
      const lootNames: string[] = [];
      for (const dropId of this.collectedDrops) {
        lootNames.push(getItemById(dropId)?.name ?? dropId);
      }
      for (const rew of this.clearRewardItems) {
        const nm = getItemById(rew.itemId)?.name ?? rew.itemId;
        lootNames.push(rew.quantity > 1 ? `${nm} ×${rew.quantity}` : nm);
      }
      if (lootNames.length > 0) {
        summaryEl.textContent = `Acquired: ${lootNames.join(', ')}`;
        summaryEl.hidden = false;
      } else {
        summaryEl.textContent = '';
        summaryEl.hidden = true;
      }
    }

    this.victoryModalBackdropEl.hidden = false;
    this.audioManager.playSfx('victory_fanfare');
    this.audioManager.playBgm('job_clear', { fadeMs: 180, loop: false, restart: true });
    this.syncHudControls();
    this.onLayerStateChanged();
    this.renderFrame(performance.now());
  }

  private triggerDefeatModal(): void {
    this.clearSelection();
    this.phase = 'defeat';
    this.interactionState = 'idle';
    this.phaseBannerEl.hidden = true;

    const lord = this.getLordUnit();
    const subEl = this.defeatModalBackdropEl.querySelector('[data-defeat-sub]');
    const summaryEl = this.defeatModalBackdropEl.querySelector<HTMLElement>(
      '[data-defeat-summary]'
    );
    if (subEl) {
      subEl.textContent = `${lord ? lord.nickname : 'Squad'} fainted on Turn ${this.turnNumber}.`;
    }
    if (summaryEl) {
      summaryEl.textContent = '';
      summaryEl.hidden = true;
    }

    this.defeatModalBackdropEl.hidden = false;
    this.audioManager.playSfx('game_over');
    this.audioManager.playBgm('oh_no', { fadeMs: 180, loop: false, restart: true });
    this.syncHudControls();
    this.onLayerStateChanged();
    this.renderFrame(performance.now());
  }

  // ==========================================================================
  // Danger Area, System Menu, Banner & Info Strip
  // ==========================================================================

  private toggleGlobalDangerArea(): void {
    this.globalDangerEnabled = !this.globalDangerEnabled;
    this.audioManager.playSfx('select');
    this.recomputeDangerArea();
    this.renderFrame(performance.now());
  }

  private toggleIndividualEnemyDanger(enemyId: string): void {
    if (this.trackedEnemyIds.has(enemyId)) {
      this.trackedEnemyIds.delete(enemyId);
    } else {
      this.trackedEnemyIds.add(enemyId);
    }
    this.recomputeDangerArea();
  }

  private recomputeDangerArea(): void {
    this.currentDanger = computeEnemyDangerArea(this.map, this.getLivingUnits(), {
      globalEnabled: this.globalDangerEnabled,
      trackedEnemyIds: this.trackedEnemyIds,
    });
    this.dangerBtnEl.textContent = this.globalDangerEnabled ? 'Danger: ON' : 'Danger: OFF';
    this.dangerBtnEl.classList.toggle('is-active', this.globalDangerEnabled);
    this.systemDangerBtnEl.textContent = this.globalDangerEnabled
      ? 'Danger Area: ON'
      : 'Danger Area: OFF';
    this.systemDangerBtnEl.classList.toggle('is-active', this.globalDangerEnabled);
    this.prepOverlay.syncMapHudState();
  }

  private syncSystemAudioButton(): void {
    const muted = this.audioManager.getSettings().muted;
    this.systemAudioBtnEl.textContent = muted ? 'Audio: Muted' : 'Audio: ON';
    this.systemAudioBtnEl.classList.toggle('is-active', !muted);
  }

  private openSystemMenu(): void {
    this.systemMenuOpen = true;
    const sub = this.systemMenuBackdropEl.querySelector('[data-sys-sub]');
    if (sub) {
      sub.textContent =
        this.phase === 'dungeon_prep'
          ? `Prep · ${this.map.name}`
          : `Turn ${this.turnNumber} · ${this.map.name}`;
    }
    this.syncSystemAudioButton();
    this.syncHudControls();
    this.systemMenuBackdropEl.hidden = false;
    this.audioManager.playSfx('select');
    this.onLayerStateChanged();
  }

  private closeSystemMenu(): void {
    this.systemMenuOpen = false;
    this.systemMenuBackdropEl.hidden = true;
    this.onLayerStateChanged();
  }

  private showPhaseBanner(text: string): void {
    if (this.phaseBannerTimer !== null) {
      window.clearTimeout(this.phaseBannerTimer);
    }
    this.phaseBannerEl.textContent = text;
    this.phaseBannerEl.hidden = false;
    this.phaseBannerTimer = window.setTimeout(
      () => {
        this.phaseBannerEl.hidden = true;
        this.phaseBannerTimer = null;
      },
      this.fastMode ? 240 : 1100
    );
  }

  private updateInfoStrip(): void {
    const { x, y } = this.inspectedTile;
    const terrain = getMapTerrainAt(this.map, x, y) ?? 'floor';
    const meta = TERRAIN_METADATA[terrain];
    const occupant = this.getLivingUnits().find((u) => u.x === x && u.y === y);
    const contextUnit = this.getSelectedUnit() ?? occupant;

    const parts: string[] = [meta.label];

    if (contextUnit) {
      const bonuses = getTerrainBonuses(terrain, contextUnit);
      const eqMove = contextUnit.equippedMoveId
        ? getMoveById(contextUnit.equippedMoveId)
        : undefined;
      const skill = getPersonalSkillById(contextUnit.personalSkillId);
      const eqItemId = contextUnit.heldItemId ?? contextUnit.consumableItemId ?? null;
      const item = eqItemId ? getItemById(eqItemId) : undefined;
      const effMov = getEffectiveMovementPoints(contextUnit);

      const roleBadge = contextUnit.isLord
        ? ' [LORD]'
        : contextUnit.isBoss
          ? ' [BOSS]'
          : '';
      const spPrefix =
        contextUnit.nickname === contextUnit.speciesName ? '' : `${contextUnit.speciesName} `;
      parts.push(
        `${contextUnit.nickname}${roleBadge} (${spPrefix}Lv.${contextUnit.level} · HP ${contextUnit.currentHp}/${contextUnit.maxHp} · Mov ${effMov}${contextUnit.stationary ? ' · Immovable' : ''})`
      );
      if (bonuses.defBonus || bonuses.avoidBonus) {
        parts.push(`+${bonuses.defBonus} Def/SpD, +${bonuses.avoidBonus}% Avo`);
      }
      if (eqMove) {
        parts.push(`[E] ${eqMove.name} (R${eqMove.range[0]})`);
      }
      if (contextUnit.droppableItemId) {
        const dropItem = getItemById(contextUnit.droppableItemId);
        parts.push(`Drops: ${dropItem?.name ?? contextUnit.droppableItemId}`);
      } else if (item) {
        parts.push(`Item: ${item.name}`);
      } else if (skill) {
        parts.push(`Ability: ${skill.name}`);
      }
    } else {
      parts.push(meta.summary);
    }

    this.infoStripEl.textContent = parts.join(' · ');
  }

  // ==========================================================================
  // Camera & 1:1 Native Pixel Buffer Rendering (`2x` Pixelated CSS Scale)
  // ==========================================================================

  private canInteractWithMapViewport(): boolean {
    if (!this.openState || this.systemMenuOpen || !this.levelUpModalBackdropEl.hidden) {
      return false;
    }
    if (this.phase === 'dungeon_prep') {
      return this.prepOverlay.isOpen() && this.prepOverlay.getSubMode() === 'view_map';
    }
    return (
      (this.phase === 'player_phase' || this.phase === 'enemy_phase') &&
      this.interactionState !== 'combat_forecast'
    );
  }

  private syncBufferForCurrentScale(): { stageW: number; stageH: number } {
    const stageW = Math.max(240, this.canvasStageEl.clientWidth || 640);
    const stageH = Math.max(180, this.canvasStageEl.clientHeight || 480);
    this.displayScale = clampMapScale(this.displayScale);

    this.bufferWidth = Math.max(96, Math.ceil(stageW / this.displayScale));
    this.bufferHeight = Math.max(72, Math.ceil(stageH / this.displayScale));

    if (this.canvas.width !== this.bufferWidth || this.canvas.height !== this.bufferHeight) {
      this.canvas.width = this.bufferWidth;
      this.canvas.height = this.bufferHeight;
      this.ctx.imageSmoothingEnabled = false;
    }
    this.canvas.style.width = `${Math.round(this.bufferWidth * this.displayScale * 100) / 100}px`;
    this.canvas.style.height = `${Math.round(this.bufferHeight * this.displayScale * 100) / 100}px`;

    return { stageW, stageH };
  }

  private syncViewportDimensions(): void {
    this.syncBufferForCurrentScale();
    this.setCameraPosition(this.cameraX, this.cameraY);
  }

  private clientPointToWorld(clientX: number, clientY: number): { worldX: number; worldY: number } {
    const rect = this.canvas.getBoundingClientRect();
    const localCssX = clientX - rect.left;
    const localCssY = clientY - rect.top;
    return {
      worldX: this.cameraX + localCssX / this.displayScale,
      worldY: this.cameraY + localCssY / this.displayScale,
    };
  }

  private applyZoomWithWorldAnchor(
    nextScale: number,
    clientX: number,
    clientY: number,
    anchorWorldX: number,
    anchorWorldY: number
  ): void {
    this.displayScale = clampMapScale(nextScale);
    const { stageW, stageH } = this.syncBufferForCurrentScale();
    const stageRect = this.canvasStageEl.getBoundingClientRect();
    const canvasCssW = this.bufferWidth * this.displayScale;
    const canvasCssH = this.bufferHeight * this.displayScale;
    const canvasLeft = stageRect.left + (stageW - canvasCssW) / 2;
    const canvasTop = stageRect.top + (stageH - canvasCssH) / 2;
    const localCssX = clientX - canvasLeft;
    const localCssY = clientY - canvasTop;

    this.setCameraPosition(
      anchorWorldX - localCssX / this.displayScale,
      anchorWorldY - localCssY / this.displayScale
    );
    if (this.interactionState === 'action_menu') {
      this.positionFloatingActionMenu();
    }
  }

  private getMaxCameraBounds(): MapCameraBounds {
    const worldW = this.map.width * PMD_TILE_NATIVE_PX;
    const worldH = this.map.height * PMD_TILE_NATIVE_PX;
    const raw = computeCenteredMapCameraBounds(
      worldW,
      worldH,
      this.bufferWidth,
      this.bufferHeight,
      MAP_OVERSCROLL_NATIVE_PX
    );
    return {
      minX: Math.round(raw.minX),
      maxX: Math.round(raw.maxX),
      minY: Math.round(raw.minY),
      maxY: Math.round(raw.maxY),
    };
  }

  private setCameraPosition(nextWorldX: number, nextWorldY: number): void {
    const { minX, maxX, minY, maxY } = this.getMaxCameraBounds();
    this.cameraX = Math.round(Math.max(minX, Math.min(maxX, nextWorldX)));
    this.cameraY = Math.round(Math.max(minY, Math.min(maxY, nextWorldY)));
  }

  private clientPointToTile(clientX: number, clientY: number): { x: number; y: number } | null {
    const rect = this.canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;
    const localCssX = clientX - rect.left;
    const localCssY = clientY - rect.top;
    const worldX = localCssX / this.displayScale + this.cameraX;
    const worldY = localCssY / this.displayScale + this.cameraY;
    const tx = Math.floor(worldX / PMD_TILE_NATIVE_PX);
    const ty = Math.floor(worldY / PMD_TILE_NATIVE_PX);
    if (!isInMapBounds(this.map, tx, ty)) return null;
    return { x: tx, y: ty };
  }

  private startLoop(): void {
    if (this.rafId !== null) return;
    const tick = (now: number) => {
      if (!this.openState) {
        this.rafId = null;
        return;
      }
      this.advanceAnimations(now);
      this.renderFrame(now);
      this.rafId = requestAnimationFrame(tick);
    };
    this.rafId = requestAnimationFrame(tick);
  }

  private stopLoop(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  private advanceAnimations(now: number): void {
    const walkMsPerTile = this.fastMode ? WALK_MS_PER_TILE_FAST : WALK_MS_PER_TILE_NORMAL;

    // 1. Advance active tile-by-tile Walk path
    if (this.activeWalk) {
      const unit = this.units.find((u) => u.id === this.activeWalk!.unitId);
      if (!unit) {
        const done = this.activeWalk.onComplete;
        this.activeWalk = null;
        done();
      } else {
        const dt = Math.min(80, Math.max(0, now - this.activeWalk.lastTickMs));
        this.activeWalk.lastTickMs = now;
        this.activeWalk.segmentElapsedMs += dt;

        while (this.activeWalk && this.activeWalk.segmentElapsedMs >= walkMsPerTile) {
          this.activeWalk.segmentElapsedMs -= walkMsPerTile;
          this.activeWalk.segmentIndex += 1;
          const reachedStep = this.activeWalk.steps[this.activeWalk.segmentIndex];
          if (!reachedStep) break;
          unit.x = reachedStep.x;
          unit.y = reachedStep.y;

          if (this.activeWalk.segmentIndex >= this.activeWalk.steps.length - 1) {
            const done = this.activeWalk.onComplete;
            this.activeWalk = null;
            unit.renderWorldX = unit.x * PMD_TILE_NATIVE_PX;
            unit.renderWorldY = unit.y * PMD_TILE_NATIVE_PX;
            done();
            break;
          }
        }

        if (this.activeWalk) {
          const fromStep = this.activeWalk.steps[this.activeWalk.segmentIndex]!;
          const toStep = this.activeWalk.steps[this.activeWalk.segmentIndex + 1]!;
          const dx = toStep.x - fromStep.x;
          const dy = toStep.y - fromStep.y;
          if (dx > 0) unit.direction = 2;
          else if (dx < 0) unit.direction = 6;
          else if (dy < 0) unit.direction = 4;
          else if (dy > 0) unit.direction = 0;

          const t = Math.min(1, this.activeWalk.segmentElapsedMs / walkMsPerTile);
          unit.renderWorldX = Math.round((fromStep.x + dx * t) * PMD_TILE_NATIVE_PX);
          unit.renderWorldY = Math.round((fromStep.y + dy * t) * PMD_TILE_NATIVE_PX);

          if (this.activeWalk.followCamera) {
            this.ensureTilePairVisible(unit.x, unit.y, toStep.x, toStep.y);
          }
        }
      }
    }

    // 2. Advance 8-directional PMD sprite frames
    for (const unit of this.getRenderableUnits()) {
      const bundle = this.spriteBundles.get(unit.speciesId);
      if (!bundle) continue;
      const anim = bundle.actions[unit.action] ?? bundle.actions.Idle;
      if (now >= unit.nextFrameAt) {
        unit.frameIndex = (unit.frameIndex + 1) % Math.max(1, anim.frameCount);
        const dur = anim.durationsMs[unit.frameIndex % anim.durationsMs.length] ?? 140;
        unit.nextFrameAt = now + dur;
      }
    }

    // 3. Prune expired floating combat callouts
    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const ft = this.floatingTexts[i]!;
      if (now - ft.createdAtMs >= ft.durationMs) {
        this.floatingTexts.splice(i, 1);
      }
    }
  }

  private getSelectionRangePulse(now: number): number {
    const elapsed = Math.max(0, now - this.selectionPulseStartMs);
    const phase = ((elapsed % RANGE_PULSE_PERIOD_MS) / RANGE_PULSE_PERIOD_MS) * Math.PI * 2;
    return 0.5 - 0.5 * Math.cos(phase);
  }

  private renderFrame(now: number): void {
    const ctx = this.ctx;
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#080e1c';
    ctx.fillRect(0, 0, this.bufferWidth, this.bufferHeight);

    const startCol = Math.max(0, Math.floor(this.cameraX / PMD_TILE_NATIVE_PX) - 1);
    const endCol = Math.min(
      this.map.width - 1,
      Math.ceil((this.cameraX + this.bufferWidth) / PMD_TILE_NATIVE_PX) + 1
    );
    const startRow = Math.max(0, Math.floor(this.cameraY / PMD_TILE_NATIVE_PX) - 1);
    const endRow = Math.min(
      this.map.height - 1,
      Math.ceil((this.cameraY + this.bufferHeight) / PMD_TILE_NATIVE_PX) + 1
    );

    // 1. Render Seamless PMD 24x24 Dungeon Chunks + Stairs / Wonder Tile Overlays (zero grid lines)
    for (let y = startRow; y <= endRow; y++) {
      const row = this.map.tiles[y];
      if (!row) continue;
      const drawY = y * PMD_TILE_NATIVE_PX - this.cameraY;

      for (let x = startCol; x <= endCol; x++) {
        const cell = row[x];
        if (!cell) continue;
        const drawX = x * PMD_TILE_NATIVE_PX - this.cameraX;
        const sheet = this.tilesetSheets.get(normalizeTilesetId(cell.tilesetId));
        if (sheet) {
          drawTilesetChunk(ctx, sheet, cell.chunkIndex, drawX, drawY, PMD_TILE_NATIVE_PX);
        } else {
          ctx.fillStyle = '#1c2c44';
          ctx.fillRect(drawX, drawY, PMD_TILE_NATIVE_PX, PMD_TILE_NATIVE_PX);
        }

        drawSpecialTerrainOverlay(
          ctx,
          cell.terrainType,
          cell.tilesetId,
          drawX,
          drawY,
          PMD_TILE_NATIVE_PX
        );
      }
    }

    const visibleBounds = { startCol, endCol, startRow, endRow };

    // 2. Render Static Enemy Danger Area Overlay
    if (this.currentDanger.combinedDangerTiles.size > 0) {
      this.drawConnectedRangeZone(
        ctx,
        this.currentDanger.combinedDangerTiles,
        this.currentDanger.combinedDangerTiles,
        {
          fillRgba: 'rgba(188, 68, 248, 0.10)',
          outerBorderRgba: 'rgba(216, 120, 255, 0.88)',
          innerGlowRgba: 'rgba(188, 76, 248, 0.28)',
        },
        visibleBounds
      );

      if (this.currentDanger.individualDangerTiles.size > 0) {
        this.drawConnectedRangeZone(
          ctx,
          this.currentDanger.individualDangerTiles,
          this.currentDanger.individualDangerTiles,
          {
            fillRgba: 'rgba(248, 64, 148, 0.12)',
            outerBorderRgba: 'rgba(255, 128, 196, 0.95)',
            innerGlowRgba: 'rgba(248, 76, 156, 0.32)',
          },
          visibleBounds
        );
      }
    }

    // 2b. Render Blue Starting Deployment Tiles & Selected Swap Tile during Dungeon Prep
    if (this.phase === 'dungeon_prep' && this.deploymentSlots.length > 0) {
      const pulse = this.getSelectionRangePulse(now);
      const deployTileSet = new Set<string>(
        this.deploymentSlots.map((slot) => coordKey(slot.x, slot.y))
      );
      this.drawConnectedRangeZone(
        ctx,
        deployTileSet,
        deployTileSet,
        {
          fillRgba: lerpRgba([24, 132, 240, 0.22], [116, 224, 255, 0.42], pulse),
          outerBorderRgba: lerpRgba([72, 192, 255, 0.92], [220, 252, 255, 1.0], pulse),
          innerGlowRgba: lerpRgba([48, 164, 248, 0.34], [164, 240, 255, 0.64], pulse),
        },
        visibleBounds
      );

      if (this.prepSwapSlotIndex !== null) {
        const selectedSlot = this.deploymentSlots.find(
          (s) => s.slotIndex === this.prepSwapSlotIndex
        );
        if (selectedSlot) {
          const sx = selectedSlot.x * PMD_TILE_NATIVE_PX - this.cameraX;
          const sy = selectedSlot.y * PMD_TILE_NATIVE_PX - this.cameraY;
          ctx.save();
          ctx.fillStyle = 'rgba(248, 208, 72, 0.26)';
          ctx.fillRect(sx + 1, sy + 1, PMD_TILE_NATIVE_PX - 2, PMD_TILE_NATIVE_PX - 2);
          ctx.strokeStyle = '#f8d048';
          ctx.lineWidth = 2;
          ctx.strokeRect(sx + 1, sy + 1, PMD_TILE_NATIVE_PX - 2, PMD_TILE_NATIVE_PX - 2);
          ctx.restore();
        }
      }
    }

    // 3. Render Selected Unit Range Overlays (Synchronized Pulsating Blue Move, Red Attack, Green Support)
    if (
      this.currentRange &&
      (this.interactionState === 'unit_selected' || this.interactionState === 'walking')
    ) {
      const pulse = this.getSelectionRangePulse(now);
      const reachableSet = new Set<string>(this.currentRange.reachableTiles.keys());

      if (this.currentRange.supportBorderTiles.size > 0) {
        const supportUnion = new Set<string>(reachableSet);
        for (const k of this.currentRange.supportBorderTiles) supportUnion.add(k);
        this.drawConnectedRangeZone(
          ctx,
          this.currentRange.supportBorderTiles,
          supportUnion,
          {
            fillRgba: lerpRgba([28, 184, 96, 0.15], [132, 255, 188, 0.36], pulse),
            outerBorderRgba: lerpRgba([72, 228, 140, 0.88], [212, 255, 232, 1.0], pulse),
            innerGlowRgba: lerpRgba([48, 212, 120, 0.28], [168, 255, 208, 0.6], pulse),
          },
          visibleBounds
        );
      }

      if (this.currentRange.attackBorderTiles.size > 0) {
        const attackUnion = new Set<string>(reachableSet);
        for (const k of this.currentRange.attackBorderTiles) attackUnion.add(k);
        this.drawConnectedRangeZone(
          ctx,
          this.currentRange.attackBorderTiles,
          attackUnion,
          {
            fillRgba: lerpRgba([212, 36, 56, 0.16], [255, 132, 144, 0.38], pulse),
            outerBorderRgba: lerpRgba([244, 80, 96, 0.88], [255, 208, 214, 1.0], pulse),
            innerGlowRgba: lerpRgba([232, 56, 76, 0.3], [255, 168, 178, 0.62], pulse),
          },
          visibleBounds
        );
      }

      this.drawConnectedRangeZone(
        ctx,
        reachableSet,
        reachableSet,
        {
          fillRgba: lerpRgba([24, 128, 236, 0.16], [132, 232, 255, 0.38], pulse),
          outerBorderRgba: lerpRgba([64, 184, 252, 0.88], [216, 252, 255, 1.0], pulse),
          innerGlowRgba: lerpRgba([44, 156, 248, 0.3], [164, 242, 255, 0.62], pulse),
        },
        visibleBounds
      );
    }

    // 4. Render A* Path Preview Line & Destination Reticle
    if (
      this.previewPath &&
      this.previewPath.length > 1 &&
      this.interactionState === 'unit_selected'
    ) {
      ctx.save();
      ctx.strokeStyle = '#f8d048';
      ctx.lineWidth = 2;
      ctx.beginPath();
      this.previewPath.forEach((step, idx) => {
        const cx = step.x * PMD_TILE_NATIVE_PX - this.cameraX + PMD_TILE_NATIVE_PX / 2;
        const cy = step.y * PMD_TILE_NATIVE_PX - this.cameraY + PMD_TILE_NATIVE_PX / 2;
        if (idx === 0) ctx.moveTo(cx, cy);
        else ctx.lineTo(cx, cy);
      });
      ctx.stroke();

      const dest = this.previewPath[this.previewPath.length - 1]!;
      const destX = dest.x * PMD_TILE_NATIVE_PX - this.cameraX;
      const destY = dest.y * PMD_TILE_NATIVE_PX - this.cameraY;
      ctx.fillStyle = '#f8d048';
      ctx.fillRect(destX + 9, destY + 9, 6, 6);
      ctx.restore();
    }

    // 5. Render Inspected / Active Tile Pixel Cursor
    {
      const cx = this.inspectedTile.x * PMD_TILE_NATIVE_PX - this.cameraX;
      const cy = this.inspectedTile.y * PMD_TILE_NATIVE_PX - this.cameraY;
      ctx.fillStyle = '#f8d048';
      ctx.fillRect(cx, cy, 5, 2);
      ctx.fillRect(cx, cy, 2, 5);
      ctx.fillRect(cx + PMD_TILE_NATIVE_PX - 5, cy, 5, 2);
      ctx.fillRect(cx + PMD_TILE_NATIVE_PX - 2, cy, 2, 5);
      ctx.fillRect(cx, cy + PMD_TILE_NATIVE_PX - 2, 5, 2);
      ctx.fillRect(cx, cy + PMD_TILE_NATIVE_PX - 5, 2, 5);
      ctx.fillRect(cx + PMD_TILE_NATIVE_PX - 5, cy + PMD_TILE_NATIVE_PX - 2, 5, 2);
      ctx.fillRect(cx + PMD_TILE_NATIVE_PX - 2, cy + PMD_TILE_NATIVE_PX - 5, 2, 5);
    }

    // 6. Render Units (Y-sorted & anchored via PMDCollab ground-shadow footline geometry)
    const sortedUnits = [...this.getRenderableUnits()].sort(
      (a, b) => a.renderWorldY - b.renderWorldY || a.renderWorldX - b.renderWorldX
    );

    for (const unit of sortedUnits) {
      const tileScreenX = unit.renderWorldX - this.cameraX;
      const tileScreenY = unit.renderWorldY - this.cameraY;
      const bundle = this.spriteBundles.get(unit.speciesId);
      const anim = bundle ? (bundle.actions[unit.action] ?? bundle.actions.Idle) : undefined;
      const placement = computePmdTileSpritePlacement(
        tileScreenX,
        tileScreenY,
        anim?.frameWidth ?? PMD_TILE_NATIVE_PX,
        anim?.frameHeight ?? PMD_TILE_NATIVE_PX,
        PMD_TILE_NATIVE_PX
      );

      ctx.save();
      if (unit.koDissolveProgress > 0) {
        ctx.globalAlpha = Math.max(0.05, 1 - unit.koDissolveProgress);
      }

      this.drawUnitGroundShadow(
        ctx,
        placement.shadowCenterX,
        placement.shadowCenterY,
        bundle?.shadowSize ?? 1,
        unit
      );

      if (bundle && anim) {
        const frameIdx = unit.frameIndex % Math.max(1, anim.frameCount);
        const rowIdx = anim.rowCount >= 8 ? unit.direction : unit.direction % anim.rowCount;
        const { drawX, drawY } = placement;
        const isHitFlashing = now < unit.hitFlashUntilMs;

        if (isHitFlashing || unit.waited) {
          if (
            this.tintScratchCanvas.width < anim.frameWidth ||
            this.tintScratchCanvas.height < anim.frameHeight
          ) {
            this.tintScratchCanvas.width = anim.frameWidth;
            this.tintScratchCanvas.height = anim.frameHeight;
          }
          this.tintScratchCtx.clearRect(0, 0, anim.frameWidth, anim.frameHeight);
          this.tintScratchCtx.imageSmoothingEnabled = false;
          this.tintScratchCtx.globalCompositeOperation = 'source-over';
          this.tintScratchCtx.drawImage(
            anim.source,
            frameIdx * anim.frameWidth,
            rowIdx * anim.frameHeight,
            anim.frameWidth,
            anim.frameHeight,
            0,
            0,
            anim.frameWidth,
            anim.frameHeight
          );
          this.tintScratchCtx.globalCompositeOperation = 'source-atop';
          this.tintScratchCtx.fillStyle = isHitFlashing
            ? 'rgba(255, 232, 236, 0.72)'
            : 'rgba(18, 26, 44, 0.56)';
          this.tintScratchCtx.fillRect(0, 0, anim.frameWidth, anim.frameHeight);
          this.tintScratchCtx.globalCompositeOperation = 'source-over';

          ctx.drawImage(
            this.tintScratchCanvas,
            0,
            0,
            anim.frameWidth,
            anim.frameHeight,
            drawX,
            drawY,
            anim.frameWidth,
            anim.frameHeight
          );
        } else {
          ctx.drawImage(
            anim.source,
            frameIdx * anim.frameWidth,
            rowIdx * anim.frameHeight,
            anim.frameWidth,
            anim.frameHeight,
            drawX,
            drawY,
            anim.frameWidth,
            anim.frameHeight
          );
        }
      }

      // Micro HP Bar (`18x3` native px) & Dragon Lord Crown Pip
      if (unit.koDissolveProgress === 0) {
        const barX = Math.round(tileScreenX + 3);
        const barY = Math.round(tileScreenY + PMD_TILE_NATIVE_PX - 3);
        const hpRatio = Math.max(0, Math.min(1, unit.currentHp / Math.max(1, unit.maxHp)));
        const fillW = Math.round(16 * hpRatio);

        ctx.fillStyle = 'rgba(4, 8, 18, 0.92)';
        ctx.fillRect(barX, barY, 18, 3);
        if (fillW > 0) {
          ctx.fillStyle =
            unit.faction === 'enemy'
              ? '#ff5c6c'
              : hpRatio > 0.5
                ? '#58e890'
                : hpRatio > 0.25
                  ? '#f8d048'
                  : '#ff5464';
          ctx.fillRect(barX + 1, barY + 1, fillW, 1);
        }

        if (unit.isLord) {
          // Crisp gold crown pip at top-left of tile
          const cx = Math.round(tileScreenX + 1);
          const cy = Math.round(tileScreenY + 1);
          ctx.fillStyle = '#081020';
          ctx.fillRect(cx, cy, 7, 5);
          ctx.fillStyle = '#f8d048';
          ctx.fillRect(cx + 1, cy + 3, 5, 1);
          ctx.fillRect(cx + 1, cy + 1, 1, 2);
          ctx.fillRect(cx + 3, cy + 1, 1, 2);
          ctx.fillRect(cx + 5, cy + 1, 1, 2);
        } else if (unit.isBoss) {
          // Crisp crimson boss crown pip at top-left of tile
          const cx = Math.round(tileScreenX + 1);
          const cy = Math.round(tileScreenY + 1);
          ctx.fillStyle = '#081020';
          ctx.fillRect(cx, cy, 7, 5);
          ctx.fillStyle = '#ff5468';
          ctx.fillRect(cx + 1, cy + 3, 5, 1);
          ctx.fillRect(cx + 1, cy + 1, 1, 2);
          ctx.fillRect(cx + 3, cy + 1, 1, 2);
          ctx.fillRect(cx + 5, cy + 1, 1, 2);
        }

        if (unit.droppableItemId) {
          // Gold treasure pouch pip at top-right of tile
          const dx = Math.round(tileScreenX + PMD_TILE_NATIVE_PX - 6);
          const dy = Math.round(tileScreenY + 1);
          ctx.fillStyle = '#081020';
          ctx.fillRect(dx, dy, 5, 5);
          ctx.fillStyle = '#ffd860';
          ctx.fillRect(dx + 1, dy + 1, 3, 3);
        }
      }

      ctx.restore();
    }

    // 7. Render Active Strike VFX (Melee Slash / Ranged Projectile / Impact Burst)
    if (this.activeStrikeVfx) {
      const vfx = this.activeStrikeVfx;
      const progress = Math.max(
        0,
        Math.min(1, (now - vfx.startedAtMs) / Math.max(1, vfx.durationMs))
      );
      ctx.save();
      ctx.fillStyle = vfx.color;
      if (vfx.kind === 'ranged') {
        const wx = vfx.fromWorldX + (vfx.toWorldX - vfx.fromWorldX) * progress - this.cameraX;
        const wy = vfx.fromWorldY + (vfx.toWorldY - vfx.fromWorldY) * progress - this.cameraY;
        ctx.fillRect(Math.round(wx - 3), Math.round(wy - 3), 6, 6);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(Math.round(wx - 1), Math.round(wy - 1), 2, 2);
      } else {
        const bx = vfx.toWorldX - this.cameraX;
        const by = vfx.toWorldY - this.cameraY;
        const spread = Math.round(2 + progress * 6);
        ctx.fillRect(Math.round(bx - spread), Math.round(by - 1), 3, 2);
        ctx.fillRect(Math.round(bx + spread - 3), Math.round(by - 1), 3, 2);
        ctx.fillRect(Math.round(bx - 1), Math.round(by - spread), 2, 3);
        ctx.fillRect(Math.round(bx - 1), Math.round(by + spread - 3), 2, 3);
      }
      ctx.restore();
    }

    // 8. Render Floating Combat Callouts (`-X`, `CRIT!`, `MISS`, `DEFEATED!`)
    if (this.floatingTexts.length > 0) {
      ctx.save();
      ctx.font = 'bold 8px "Fusion Pixel 12px Proportional KR", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';

      for (const ft of this.floatingTexts) {
        const t = Math.max(0, Math.min(1, (now - ft.createdAtMs) / ft.durationMs));
        const risePx = Math.round(t * 10);
        const sx = Math.round(ft.worldX - this.cameraX);
        const sy = Math.round(ft.worldY - this.cameraY - risePx);

        ctx.globalAlpha = t > 0.78 ? Math.max(0, (1 - t) / 0.22) : 1;
        ctx.fillStyle = '#050a14';
        ctx.fillText(ft.text, sx + 1, sy + 1);
        ctx.fillText(ft.text, sx - 1, sy + 1);
        ctx.fillText(ft.text, sx, sy + 2);
        ctx.fillStyle = ft.color;
        ctx.fillText(ft.text, sx, sy);
      }
      ctx.restore();
    }
  }

  private drawConnectedRangeZone(
    ctx: CanvasRenderingContext2D,
    zoneTiles: ReadonlySet<string>,
    boundaryMask: ReadonlySet<string>,
    style: {
      fillRgba: string;
      outerBorderRgba: string;
      innerGlowRgba: string;
    },
    bounds: {
      startCol: number;
      endCol: number;
      startRow: number;
      endRow: number;
    }
  ): void {
    if (zoneTiles.size === 0) return;
    const S = PMD_TILE_NATIVE_PX;
    const { startCol, endCol, startRow, endRow } = bounds;

    ctx.fillStyle = style.fillRgba;
    for (const key of zoneTiles) {
      const { x, y } = parseCoordKey(key);
      if (x < startCol || x > endCol || y < startRow || y > endRow) continue;
      ctx.fillRect(x * S - this.cameraX, y * S - this.cameraY, S, S);
    }

    ctx.fillStyle = style.innerGlowRgba;
    for (const key of zoneTiles) {
      const { x, y } = parseCoordKey(key);
      if (x < startCol || x > endCol || y < startRow || y > endRow) continue;
      const drawX = x * S - this.cameraX;
      const drawY = y * S - this.cameraY;

      const hasN = boundaryMask.has(coordKey(x, y - 1));
      const hasS = boundaryMask.has(coordKey(x, y + 1));
      const hasW = boundaryMask.has(coordKey(x - 1, y));
      const hasE = boundaryMask.has(coordKey(x + 1, y));

      const x0 = !hasW ? 1 : 0;
      const x1 = !hasE ? S - 1 : S;
      if (!hasN && x1 > x0) ctx.fillRect(drawX + x0, drawY + 1, x1 - x0, 1);
      if (!hasS && x1 > x0) ctx.fillRect(drawX + x0, drawY + S - 2, x1 - x0, 1);

      const y0 = !hasN ? 2 : 0;
      const y1 = !hasS ? S - 2 : S;
      if (!hasW && y1 > y0) ctx.fillRect(drawX + 1, drawY + y0, 1, y1 - y0);
      if (!hasE && y1 > y0) ctx.fillRect(drawX + S - 2, drawY + y0, 1, y1 - y0);

      if (hasN && hasW && !boundaryMask.has(coordKey(x - 1, y - 1))) {
        ctx.fillRect(drawX + 1, drawY, 1, 2);
        ctx.fillRect(drawX, drawY + 1, 1, 1);
      }
      if (hasN && hasE && !boundaryMask.has(coordKey(x + 1, y - 1))) {
        ctx.fillRect(drawX + S - 2, drawY, 1, 2);
        ctx.fillRect(drawX + S - 1, drawY + 1, 1, 1);
      }
      if (hasS && hasW && !boundaryMask.has(coordKey(x - 1, y + 1))) {
        ctx.fillRect(drawX + 1, drawY + S - 2, 1, 2);
        ctx.fillRect(drawX, drawY + S - 2, 1, 1);
      }
      if (hasS && hasE && !boundaryMask.has(coordKey(x + 1, y + 1))) {
        ctx.fillRect(drawX + S - 2, drawY + S - 2, 1, 2);
        ctx.fillRect(drawX + S - 1, drawY + S - 2, 1, 1);
      }
    }

    ctx.fillStyle = style.outerBorderRgba;
    for (const key of zoneTiles) {
      const { x, y } = parseCoordKey(key);
      if (x < startCol || x > endCol || y < startRow || y > endRow) continue;
      const drawX = x * S - this.cameraX;
      const drawY = y * S - this.cameraY;

      const hasN = boundaryMask.has(coordKey(x, y - 1));
      const hasS = boundaryMask.has(coordKey(x, y + 1));
      const hasW = boundaryMask.has(coordKey(x - 1, y));
      const hasE = boundaryMask.has(coordKey(x + 1, y));

      if (!hasN) ctx.fillRect(drawX, drawY, S, 1);
      if (!hasS) ctx.fillRect(drawX, drawY + S - 1, S, 1);

      const oy0 = !hasN ? 1 : 0;
      const oy1 = !hasS ? S - 1 : S;
      if (!hasW && oy1 > oy0) ctx.fillRect(drawX, drawY + oy0, 1, oy1 - oy0);
      if (!hasE && oy1 > oy0) ctx.fillRect(drawX + S - 1, drawY + oy0, 1, oy1 - oy0);

      if (hasN && hasW && !boundaryMask.has(coordKey(x - 1, y - 1))) {
        ctx.fillRect(drawX, drawY, 1, 1);
      }
      if (hasN && hasE && !boundaryMask.has(coordKey(x + 1, y - 1))) {
        ctx.fillRect(drawX + S - 1, drawY, 1, 1);
      }
      if (hasS && hasW && !boundaryMask.has(coordKey(x - 1, y + 1))) {
        ctx.fillRect(drawX, drawY + S - 1, 1, 1);
      }
      if (hasS && hasE && !boundaryMask.has(coordKey(x + 1, y + 1))) {
        ctx.fillRect(drawX + S - 1, drawY + S - 1, 1, 1);
      }
    }
  }

  private drawUnitGroundShadow(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    shadowSize: number,
    unit: BattleUnitState
  ): void {
    const halfW = shadowSize <= 0 ? 5 : shadowSize === 1 ? 6 : 8;
    const innerSpan = (halfW - 2) * 2;

    ctx.fillStyle = 'rgba(6, 12, 24, 0.42)';
    ctx.fillRect(cx - halfW + 2, cy - 1, innerSpan, 3);

    ctx.fillStyle =
      unit.faction === 'player'
        ? unit.waited
          ? 'rgba(136, 152, 176, 0.50)'
          : 'rgba(72, 204, 255, 0.85)'
        : this.trackedEnemyIds.has(unit.id)
          ? 'rgba(255, 112, 196, 0.90)'
          : 'rgba(248, 84, 92, 0.85)';

    ctx.fillRect(cx - halfW + 2, cy - 2, innerSpan, 1);
    ctx.fillRect(cx - halfW + 2, cy + 2, innerSpan, 1);
    ctx.fillRect(cx - halfW, cy - 1, 2, 3);
    ctx.fillRect(cx + halfW - 2, cy - 1, 2, 3);
  }
}
