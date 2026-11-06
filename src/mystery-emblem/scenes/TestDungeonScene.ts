/**
 * Step 5 Tactical Battlefield Grid Renderer & Skirmish Sandbox (`TestDungeonScene`)
 *
 * Implements:
 * - Authentic PMD: Explorers of Sky `24x24` chunk grid rendered onto a 1:1 native pixel buffer
 *   (`imageSmoothingEnabled = false`) scaled at exact `2x` (`48x48` CSS px per tile) across Desktop & Mobile.
 * - Dijkstra legal movement (`Blue`), active-loadout offensive union (`Red`), ally support union (`Green`),
 *   A* shortest-cost path preview & 8-directional tile-by-tile `Walk` animation, and Fire Emblem Awakening
 *   `Danger Area` overlay (`Purple/Red`, global toggle + per-enemy tap toggle).
 * - Full turn-based `Wait` + uncommitted `Cancel` flow (`Right-Click`, `Long-Press`, or corner `Back`
 *   snaps uncommitted unit back to its starting tile; `End Turn` in Battlefield Menu refreshes units).
 * - Unified Pointer Event click-and-drag (PC) and single-finger touch-drag (Mobile) camera panning
 *   with strict drag-threshold disambiguation (`8px`) so panning never selects or moves units.
 * - Collapsible Dev Sandbox HUD with unit species presets (`Grounded`, `Water`, `Fire`, `Rock/Ground`,
 *   `Fighting`, `Flying`, `Levitate`), `Heavy-Duty Boots` toggle, live `24x24` Tileset Chunk Picker /
 *   Map Brush across all 144 sheets (`tileset_000`..`tileset_143`), and `Export Map JSON`.
 */

import {
  computePmdTileSpritePlacement,
  loadSpeciesSpriteBundle,
  type LoadedSpriteBundle,
  type PmdDirection,
  type PmdSpriteAction,
} from '../assets/pmdAssetLoader';
import {
  PMD_TILE_NATIVE_PX,
  PMD_TILESET_LIST,
  drawSpecialTerrainOverlay,
  drawTilesetChunk,
  loadTilesetSheet,
  normalizeTilesetId,
  type LoadedTilesetSheet,
} from '../assets/tilesetLoader';
import { getAudioManager, type AudioManager } from '../audio/AudioManager';
import {
  POKEMON_SPECIES_LIST,
  getItemById,
  getMoveById,
  getPersonalSkillById,
  getSpeciesById,
} from '../data/index';
import {
  DEFAULT_TERRAIN_PALETTE,
  cloneDungeonMap,
  createDefaultTestDungeonMap,
} from '../data/testDungeonMap';
import {
  TERRAIN_METADATA,
  computeEnemyDangerArea,
  computeUnitMovementAndAttackRange,
  coordKey,
  findShortestPathAStar,
  getEffectiveMovementPoints,
  getMapTerrainAt,
  getTerrainBonuses,
  getTerrainMoveCost,
  isInMapBounds,
  parseCoordKey,
  type AStarPathStep,
  type ActiveMoveRangeEntry,
  type DangerAreaResult,
  type MovementRangeResult,
  type PathfindingUnitContext,
} from '../engine/terrainAndPathfinding';
import {
  TERRAIN_TYPES,
  type DungeonMapDefinition,
  type PokemonType,
  type TerrainType,
  type TraversalClass,
} from '../types/schemas';
import { bindPointerTap } from '../ui/pointerControls';

export const BATTLE_TILE_SCALE = 2;
export const BATTLE_TILE_DISPLAY_PX = PMD_TILE_NATIVE_PX * BATTLE_TILE_SCALE; // 48px
const DRAG_THRESHOLD_PX = 8;
const LONG_PRESS_MS = 520;
const WALK_MS_PER_TILE = 85;
const RANGE_PULSE_PERIOD_MS = 1500;

type RgbaTuple = readonly [number, number, number, number];

function lerpChannel(a: number, b: number, t: number): number {
  return Math.round(a + (b - a) * t);
}

function lerpRgba(from: RgbaTuple, to: RgbaTuple, t: number): string {
  const alpha = (from[3] + (to[3] - from[3]) * t).toFixed(3);
  return `rgba(${lerpChannel(from[0], to[0], t)}, ${lerpChannel(from[1], to[1], t)}, ${lerpChannel(from[2], to[2], t)}, ${alpha})`;
}

export interface TestDungeonUnit {
  id: string;
  slotIndex: number;
  faction: 'player' | 'enemy';
  speciesId: string;
  speciesName: string;
  nickname: string;
  level: number;
  x: number;
  y: number;
  mov: number;
  traversalClass: TraversalClass;
  types: ReadonlyArray<PokemonType>;
  personalSkillId: string;
  heldItemId: string | null;
  activeMoves: ActiveMoveRangeEntry[];
  equippedMoveId: string | null;
  waited: boolean;
  direction: PmdDirection;
  action: PmdSpriteAction;
  frameIndex: number;
  nextFrameAt: number;
  /** World-space pixel coordinates in native 1x PMD pixels (`x * 24`, `y * 24`) during walk interpolation */
  renderWorldX: number;
  renderWorldY: number;
}

export type DungeonInteractionState =
  | 'idle'
  | 'unit_selected'
  | 'walking'
  | 'action_menu';

const SANDBOX_UNIT_PRESETS: ReadonlyArray<{
  label: string;
  speciesId: string;
  nickname: string;
}> = [
  { label: 'Dratini (Grounded)', speciesId: 'dratini', nickname: 'Bahamut' },
  { label: 'Squirtle (Water)', speciesId: 'squirtle', nickname: 'Torrent' },
  { label: 'Charmander (Fire)', speciesId: 'charmander', nickname: 'Ember' },
  { label: 'Geodude (Rock/Gnd)', speciesId: 'geodude', nickname: 'Boulder' },
  { label: 'Machop (Fighting)', speciesId: 'machop', nickname: 'Atlas' },
  { label: 'Pidgey (Flying)', speciesId: 'pidgey', nickname: 'Zephyr' },
  { label: 'Fletchling (Flying)', speciesId: 'fletchling', nickname: 'Talon' },
  { label: 'Duskull (Levitate)', speciesId: 'duskull', nickname: 'Wisp' },
  { label: 'Happiny (Healer)', speciesId: 'happiny', nickname: 'Clover' },
];

export interface TestDungeonSceneOptions {
  viewportEl: HTMLElement;
  audioManager?: AudioManager;
  onExit: () => void;
  onLayerStateChanged: () => void;
}

export interface TestDungeonSnapshot {
  isOpen: boolean;
  turnNumber: number;
  paintMode: boolean;
  sandboxOpen: boolean;
  systemMenuOpen: boolean;
  enemiesVisible: boolean;
  globalDangerEnabled: boolean;
  trackedEnemyIds: string[];
  interactionState: DungeonInteractionState;
  selectedUnitId: string | null;
  camera: {
    x: number;
    y: number;
    maxX: number;
    maxY: number;
    bufferWidth: number;
    bufferHeight: number;
    displayScale: number;
    imageSmoothingEnabled: boolean;
  };
  map: {
    id: string;
    width: number;
    height: number;
  };
  units: Array<{
    id: string;
    faction: 'player' | 'enemy';
    speciesId: string;
    nickname: string;
    x: number;
    y: number;
    mov: number;
    effectiveMov: number;
    traversalClass: TraversalClass;
    types: ReadonlyArray<PokemonType>;
    heldItemId: string | null;
    waited: boolean;
    frameWidth: number;
    frameHeight: number;
    drawOffsetX: number;
    drawOffsetY: number;
    shadowOffsetY: number;
  }>;
  reachableCoords: string[];
  attackBorderCoords: string[];
  supportBorderCoords: string[];
  dangerCoords: string[];
}

export class TestDungeonScene {
  private readonly viewportEl: HTMLElement;
  private readonly audioManager: AudioManager;
  private readonly onExitCallback: () => void;
  private readonly onLayerStateChanged: () => void;

  private readonly rootEl: HTMLElement;
  private readonly canvasStageEl: HTMLElement;
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly tintScratchCanvas: HTMLCanvasElement;
  private readonly tintScratchCtx: CanvasRenderingContext2D;

  // HUD & Modals
  private readonly topHudBarEl: HTMLElement;
  private readonly turnBadgeEl: HTMLElement;
  private readonly dangerBtnEl: HTMLButtonElement;
  private readonly sandboxToggleBtnEl: HTMLButtonElement;
  private readonly phaseBannerEl: HTMLElement;
  private readonly infoStripEl: HTMLElement;
  private readonly actionMenuEl: HTMLElement;
  private readonly systemMenuBackdropEl: HTMLElement;
  private readonly systemDangerBtnEl: HTMLButtonElement;
  private readonly sandboxDrawerEl: HTMLElement;
  private readonly exportModalBackdropEl: HTMLElement;
  private readonly exportTextareaEl: HTMLTextAreaElement;

  // Sandbox inner elements
  private sandboxSlotButtonsRow!: HTMLElement;
  private sandboxPresetRow!: HTMLElement;
  private sandboxSpeciesSelect!: HTMLSelectElement;
  private sandboxBootsBtn!: HTMLButtonElement;
  private sandboxEnemiesBtn!: HTMLButtonElement;
  private sandboxPaintToggleBtn!: HTMLButtonElement;
  private sandboxTilesetSelect!: HTMLSelectElement;
  private sandboxTerrainRow!: HTMLElement;
  private sandboxChunkGrid!: HTMLElement;
  private sandboxBrushMetaEl!: HTMLElement;

  private readonly abortController = new AbortController();
  private resizeObserver: ResizeObserver | null = null;
  private rafId: number | null = null;

  // Runtime state
  private openState = false;
  private previousBgmId: string | null = null;
  private map: DungeonMapDefinition = createDefaultTestDungeonMap();
  private units: TestDungeonUnit[] = [];
  private enemiesVisible = true;
  private turnNumber = 1;

  private interactionState: DungeonInteractionState = 'idle';
  private selectedUnitId: string | null = null;
  private inspectedTile: { x: number; y: number } = { x: 8, y: 8 };
  private hoveredTile: { x: number; y: number } | null = null;
  private previewPath: AStarPathStep[] | null = null;
  private currentRange: MovementRangeResult | null = null;

  // Uncommitted pre-Wait origin snapshot
  private uncommittedOrigin: {
    unitId: string;
    x: number;
    y: number;
    direction: PmdDirection;
  } | null = null;

  // Walking animation state
  private activeWalk: {
    unitId: string;
    steps: AStarPathStep[];
    segmentIndex: number;
    segmentElapsedMs: number;
    lastTickMs: number;
  } | null = null;

  // Danger Area
  private globalDangerEnabled = false;
  private readonly trackedEnemyIds = new Set<string>();
  private currentDanger: DangerAreaResult = {
    globalDangerTiles: new Set(),
    individualDangerTiles: new Set(),
    combinedDangerTiles: new Set(),
  };

  // Camera in 1x native PMD world pixels (`0 .. map.width * 24 - bufferWidth`)
  private cameraX = 0;
  private cameraY = 0;
  private bufferWidth = 320;
  private bufferHeight = 240;

  // Sandbox & Brush state
  private sandboxOpen = false;
  private systemMenuOpen = false;
  private exportModalOpen = false;
  private activeSandboxSlot = 0;
  private paintMode = false;
  private brushTilesetId = '142';
  private brushChunkIndex = 59;
  private brushTerrainType: TerrainType = 'floor';

  // Loaded caches
  private readonly tilesetSheets = new Map<string, LoadedTilesetSheet>();
  private readonly spriteBundles = new Map<string, LoadedSpriteBundle>();
  private phaseBannerTimer: number | null = null;
  private selectionPulseStartMs = 0;
  private rangePulseOverride: number | null = null;

  constructor(options: TestDungeonSceneOptions) {
    this.viewportEl = options.viewportEl;
    this.audioManager = options.audioManager ?? getAudioManager();
    this.onExitCallback = options.onExit;
    this.onLayerStateChanged = options.onLayerStateChanged;

    this.tintScratchCanvas = document.createElement('canvas');
    this.tintScratchCanvas.width = 96;
    this.tintScratchCanvas.height = 96;
    this.tintScratchCtx = this.tintScratchCanvas.getContext('2d')!;
    this.tintScratchCtx.imageSmoothingEnabled = false;

    this.rootEl = document.createElement('section');
    this.rootEl.id = 'pmd-test-dungeon-scene';
    this.rootEl.className = 'pmd-battle-scene';
    this.rootEl.hidden = true;
    this.rootEl.dataset.testid = 'test-dungeon-scene';

    // Canvas container
    this.canvasStageEl = document.createElement('div');
    this.canvasStageEl.className = 'pmd-battle-canvas-stage';
    this.canvasStageEl.dataset.noLongpress = 'true';

    this.canvas = document.createElement('canvas');
    this.canvas.className = 'pmd-battle-canvas pmd-pixelated';
    this.canvas.dataset.testid = 'test-dungeon-canvas';
    this.canvas.style.imageRendering = 'pixelated';
    this.ctx = this.canvas.getContext('2d')!;
    this.ctx.imageSmoothingEnabled = false;
    this.canvasStageEl.appendChild(this.canvas);

    // Compact Top-Center Tactical Pill Bar
    this.topHudBarEl = document.createElement('div');
    this.topHudBarEl.className = 'pmd-battle-hud-top';

    this.turnBadgeEl = document.createElement('span');
    this.turnBadgeEl.className = 'pmd-window pmd-battle-pill';
    this.turnBadgeEl.dataset.testid = 'battle-turn-badge';
    this.turnBadgeEl.textContent = 'Turn 1 · Player';

    this.dangerBtnEl = document.createElement('button');
    this.dangerBtnEl.type = 'button';
    this.dangerBtnEl.className = 'pmd-btn pmd-battle-hud-btn';
    this.dangerBtnEl.dataset.testid = 'battle-danger-toggle-btn';
    this.dangerBtnEl.textContent = 'Danger: OFF';

    this.sandboxToggleBtnEl = document.createElement('button');
    this.sandboxToggleBtnEl.type = 'button';
    this.sandboxToggleBtnEl.className = 'pmd-btn pmd-battle-hud-btn';
    this.sandboxToggleBtnEl.dataset.testid = 'battle-sandbox-toggle-btn';
    this.sandboxToggleBtnEl.textContent = 'Sandbox';

    this.topHudBarEl.append(this.turnBadgeEl, this.dangerBtnEl, this.sandboxToggleBtnEl);

    // Phase Banner Toast
    this.phaseBannerEl = document.createElement('div');
    this.phaseBannerEl.className = 'pmd-window pmd-window--gold pmd-battle-phase-banner';
    this.phaseBannerEl.dataset.testid = 'battle-phase-banner';
    this.phaseBannerEl.hidden = true;

    // Bottom Terrain & Unit Info Strip
    this.infoStripEl = document.createElement('div');
    this.infoStripEl.className = 'pmd-window pmd-battle-info-strip';
    this.infoStripEl.dataset.testid = 'battle-info-strip';

    // Floating Uncommitted Action Menu (`Wait` / `Cancel`)
    this.actionMenuEl = document.createElement('div');
    this.actionMenuEl.className = 'pmd-window pmd-window--gold pmd-battle-action-menu';
    this.actionMenuEl.dataset.testid = 'battle-action-menu';
    this.actionMenuEl.hidden = true;
    this.actionMenuEl.innerHTML = `
      <button type="button" class="pmd-btn pmd-btn-primary pmd-battle-cmd-btn" data-testid="battle-cmd-wait">Wait</button>
      <button type="button" class="pmd-btn pmd-battle-cmd-btn" data-testid="battle-cmd-cancel">Cancel</button>
    `;

    // Battlefield Right-Click / Corner Menu System Modal
    this.systemMenuBackdropEl = document.createElement('div');
    this.systemMenuBackdropEl.className = 'pmd-battle-modal-backdrop';
    this.systemMenuBackdropEl.dataset.testid = 'battle-system-menu';
    this.systemMenuBackdropEl.hidden = true;
    this.systemMenuBackdropEl.innerHTML = `
      <div class="pmd-window pmd-battle-system-dialog" role="dialog" aria-label="Battlefield Menu">
        <h3 class="pmd-panel-title">SKIRMISH MENU</h3>
        <p class="pmd-panel-sub" data-sys-sub>Turn 1 · Test Skirmish — Convergence Ruins</p>
        <div class="pmd-battle-system-actions">
          <button type="button" class="pmd-btn" data-testid="sys-btn-danger">Danger Area: OFF</button>
          <button type="button" class="pmd-btn pmd-btn-primary" data-testid="sys-btn-end-turn">End Turn</button>
          <button type="button" class="pmd-btn" data-testid="sys-btn-reset">Reset Skirmish</button>
          <button type="button" class="pmd-btn pmd-btn-danger" data-testid="sys-btn-exit">Return to Dev Tools</button>
          <button type="button" class="pmd-btn" data-testid="sys-btn-close">Resume</button>
        </div>
      </div>
    `;
    this.systemDangerBtnEl = this.systemMenuBackdropEl.querySelector<HTMLButtonElement>(
      '[data-testid="sys-btn-danger"]'
    )!;

    // Collapsible Dev Sandbox Drawer (Unit Switcher + Boots + Tileset Chunk Picker / Map Brush)
    this.sandboxDrawerEl = document.createElement('aside');
    this.sandboxDrawerEl.className = 'pmd-window pmd-battle-sandbox-drawer';
    this.sandboxDrawerEl.dataset.testid = 'battle-sandbox-drawer';
    this.sandboxDrawerEl.hidden = true;
    this.buildSandboxDrawerDom();

    // Export Map JSON Modal
    this.exportModalBackdropEl = document.createElement('div');
    this.exportModalBackdropEl.className = 'pmd-battle-modal-backdrop';
    this.exportModalBackdropEl.dataset.testid = 'battle-export-modal';
    this.exportModalBackdropEl.hidden = true;
    this.exportModalBackdropEl.innerHTML = `
      <div class="pmd-window pmd-battle-export-dialog" role="dialog" aria-label="Export Map JSON">
        <h3 class="pmd-panel-title">EXPORT DUNGEON MAP JSON</h3>
        <p class="pmd-panel-sub">Copy this JSON definition for chapters or skirmishes.</p>
        <textarea class="pmd-textarea" rows="7" readonly spellcheck="false" data-testid="battle-export-textarea"></textarea>
        <div class="pmd-inline-btns">
          <button type="button" class="pmd-btn pmd-btn-primary" data-testid="battle-export-copy">Copy JSON</button>
          <button type="button" class="pmd-btn" data-testid="battle-export-close">Close</button>
        </div>
      </div>
    `;
    this.exportTextareaEl = this.exportModalBackdropEl.querySelector<HTMLTextAreaElement>(
      '[data-testid="battle-export-textarea"]'
    )!;

    this.rootEl.append(
      this.canvasStageEl,
      this.topHudBarEl,
      this.phaseBannerEl,
      this.infoStripEl,
      this.actionMenuEl,
      this.sandboxDrawerEl,
      this.systemMenuBackdropEl,
      this.exportModalBackdropEl
    );
    this.viewportEl.appendChild(this.rootEl);

    this.bindEvents();
  }

  public isOpen(): boolean {
    return this.openState;
  }

  public hasActiveSubLayer(): boolean {
    if (!this.openState) return false;
    return (
      this.exportModalOpen ||
      this.systemMenuOpen ||
      this.sandboxOpen ||
      this.interactionState === 'action_menu' ||
      this.interactionState === 'unit_selected'
    );
  }

  /**
   * Handles top-right `Menu` / `Back` button, PC Right-Click, and Mobile Long-Press
   * in strict LIFO priority order.
   */
  public handleMenuOrBack(): void {
    if (!this.openState) return;

    if (this.exportModalOpen) {
      this.closeExportModal();
      return;
    }
    if (this.systemMenuOpen) {
      this.closeSystemMenu();
      return;
    }
    if (this.sandboxOpen) {
      this.setSandboxOpen(false);
      return;
    }
    if (this.interactionState === 'walking') {
      return;
    }
    if (this.interactionState === 'action_menu') {
      this.cancelUncommittedMove();
      return;
    }
    if (this.interactionState === 'unit_selected') {
      this.audioManager.playSfx('cancel');
      this.clearSelection();
      return;
    }

    // Idle state on battlefield -> open Battlefield System Menu
    this.openSystemMenu();
  }

  public async open(): Promise<void> {
    if (this.openState) return;
    this.openState = true;
    this.viewportEl.classList.add('is-battle-active');
    this.rootEl.hidden = false;

    this.previousBgmId = this.audioManager.getCurrentTrackId();
    if (this.map.bgmCue) {
      this.audioManager.playBgm(this.map.bgmCue, { fadeMs: 300 });
    }

    const resetTask = this.resetSkirmishState(true);
    this.syncViewportDimensions();
    this.centerCameraOnTile(8, 8);
    this.startLoop();
    this.onLayerStateChanged();
    await resetTask;
  }

  public close(): void {
    if (!this.openState) return;
    this.openState = false;
    this.stopLoop();
    this.systemMenuOpen = false;
    this.sandboxOpen = false;
    this.exportModalOpen = false;
    this.systemMenuBackdropEl.hidden = true;
    this.sandboxDrawerEl.hidden = true;
    this.exportModalBackdropEl.hidden = true;
    this.actionMenuEl.hidden = true;
    this.rootEl.hidden = true;
    this.viewportEl.classList.remove('is-battle-active');

    if (this.previousBgmId) {
      this.audioManager.playBgm(this.previousBgmId, { fadeMs: 300 });
    } else {
      this.audioManager.playBgm('top_menu', { fadeMs: 300 });
    }

    this.onLayerStateChanged();
    this.onExitCallback();
  }

  public destroy(): void {
    this.stopLoop();
    if (this.phaseBannerTimer !== null) {
      window.clearTimeout(this.phaseBannerTimer);
      this.phaseBannerTimer = null;
    }
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    this.abortController.abort();
    this.viewportEl.classList.remove('is-battle-active');
    this.rootEl.remove();
  }

  public getMap(): DungeonMapDefinition {
    return this.map;
  }

  public getSnapshot(): TestDungeonSnapshot {
    const activeUnits = this.getActiveUnits();
    const maxCam = this.getMaxCameraBounds();
    return {
      isOpen: this.openState,
      turnNumber: this.turnNumber,
      paintMode: this.paintMode,
      sandboxOpen: this.sandboxOpen,
      systemMenuOpen: this.systemMenuOpen,
      enemiesVisible: this.enemiesVisible,
      globalDangerEnabled: this.globalDangerEnabled,
      trackedEnemyIds: [...this.trackedEnemyIds],
      interactionState: this.interactionState,
      selectedUnitId: this.selectedUnitId,
      camera: {
        x: this.cameraX,
        y: this.cameraY,
        maxX: maxCam.maxX,
        maxY: maxCam.maxY,
        bufferWidth: this.bufferWidth,
        bufferHeight: this.bufferHeight,
        displayScale: BATTLE_TILE_SCALE,
        imageSmoothingEnabled: this.ctx.imageSmoothingEnabled,
      },
      map: {
        id: this.map.id,
        width: this.map.width,
        height: this.map.height,
      },
      units: activeUnits.map((u) => {
        const bundle = this.spriteBundles.get(u.speciesId);
        const anim = bundle ? (bundle.actions[u.action] ?? bundle.actions.Idle) : undefined;
        const fw = anim?.frameWidth ?? PMD_TILE_NATIVE_PX;
        const fh = anim?.frameHeight ?? PMD_TILE_NATIVE_PX;
        const placement = computePmdTileSpritePlacement(0, 0, fw, fh, PMD_TILE_NATIVE_PX);
        return {
          id: u.id,
          faction: u.faction,
          speciesId: u.speciesId,
          nickname: u.nickname,
          x: u.x,
          y: u.y,
          mov: u.mov,
          effectiveMov: getEffectiveMovementPoints(u),
          traversalClass: u.traversalClass,
          types: u.types,
          heldItemId: u.heldItemId,
          waited: u.waited,
          frameWidth: anim?.frameWidth ?? 0,
          frameHeight: anim?.frameHeight ?? 0,
          drawOffsetX: placement.drawX,
          drawOffsetY: placement.drawY,
          shadowOffsetY: placement.shadowCenterY,
        };
      }),
      reachableCoords: this.currentRange ? [...this.currentRange.reachableTiles.keys()] : [],
      attackBorderCoords: this.currentRange ? [...this.currentRange.attackBorderTiles] : [],
      supportBorderCoords: this.currentRange ? [...this.currentRange.supportBorderTiles] : [],
      dangerCoords: [...this.currentDanger.combinedDangerTiles],
    };
  }

  /**
   * Helper for tests/diagnostics: converts tile `(tx, ty)` into client viewport coordinates
   * at the current camera offset.
   */
  public getTileClientCenter(tx: number, ty: number): { clientX: number; clientY: number } {
    const rect = this.canvas.getBoundingClientRect();
    const worldCenterX = tx * PMD_TILE_NATIVE_PX + PMD_TILE_NATIVE_PX / 2 - this.cameraX;
    const worldCenterY = ty * PMD_TILE_NATIVE_PX + PMD_TILE_NATIVE_PX / 2 - this.cameraY;
    return {
      clientX: rect.left + worldCenterX * BATTLE_TILE_SCALE,
      clientY: rect.top + worldCenterY * BATTLE_TILE_SCALE,
    };
  }

  public centerCameraOnTile(tx: number, ty: number): void {
    const targetWorldX = tx * PMD_TILE_NATIVE_PX + PMD_TILE_NATIVE_PX / 2 - this.bufferWidth / 2;
    const targetWorldY = ty * PMD_TILE_NATIVE_PX + PMD_TILE_NATIVE_PX / 2 - this.bufferHeight / 2;
    this.setCameraPosition(targetWorldX, targetWorldY);
  }

  /**
   * Returns synchronized `[0..1]` pulse phase (`0` = darker trough, `1` = lighter peak)
   * used to breathe selected-unit Blue/Red/Green range overlays together in unison.
   */
  public getSelectionRangePulse(now = performance.now()): number {
    if (this.rangePulseOverride !== null) {
      return Math.max(0, Math.min(1, this.rangePulseOverride));
    }
    const elapsedMs = Math.max(0, now - this.selectionPulseStartMs);
    const angle = (elapsedMs / RANGE_PULSE_PERIOD_MS) * Math.PI * 2 + Math.PI * 0.25;
    return 0.5 + 0.5 * Math.sin(angle);
  }

  public setRangePulseOverride(pulse01: number | null): void {
    this.rangePulseOverride = pulse01 === null ? null : Math.max(0, Math.min(1, pulse01));
    this.renderFrame(performance.now());
  }

  public async swapPlayerSlotSpecies(
    slotIndex: number,
    speciesId: string,
    customNickname?: string
  ): Promise<void> {
    const unit = this.units.find((u) => u.faction === 'player' && u.slotIndex === slotIndex);
    const sp = getSpeciesById(speciesId);
    if (!unit || !sp) return;

    const rebuilt = this.createUnitFromSpawn(
      {
        x: unit.x,
        y: unit.y,
        speciesId: sp.id,
        level: unit.level,
        nickname: customNickname ?? sp.name,
        heldItemId: unit.heldItemId,
      },
      'player',
      slotIndex,
      unit.id
    );
    if (!rebuilt) return;

    const idx = this.units.indexOf(unit);
    if (idx >= 0) {
      this.units[idx] = rebuilt;
    }

    await this.ensureSpriteBundle(sp.id);

    // Ensure the unit isn't standing on terrain that is now impassable to its new class; if so, keep on tile (starting tile is always cost 0)
    if (this.selectedUnitId === rebuilt.id) {
      this.recomputeSelectedUnitRange();
    }
    this.recomputeDangerArea();
    this.syncSandboxUiState();
    this.updateInfoStrip();
    this.renderFrame(performance.now());
  }

  public toggleSlotHeavyDutyBoots(slotIndex: number): boolean {
    const unit = this.units.find((u) => u.faction === 'player' && u.slotIndex === slotIndex);
    if (!unit) return false;
    unit.heldItemId = unit.heldItemId === 'heavy_duty_boots' ? null : 'heavy_duty_boots';
    if (this.selectedUnitId === unit.id) {
      this.recomputeSelectedUnitRange();
    }
    this.syncSandboxUiState();
    this.updateInfoStrip();
    this.renderFrame(performance.now());
    return unit.heldItemId === 'heavy_duty_boots';
  }

  public endTurn(): void {
    if (this.interactionState === 'action_menu') {
      this.cancelUncommittedMove();
    }
    this.clearSelection();
    this.turnNumber += 1;
    for (const u of this.units) {
      u.waited = false;
    }
    this.turnBadgeEl.textContent = `Turn ${this.turnNumber} · Player`;
    this.audioManager.playSfx('select');
    this.showPhaseBanner(`PLAYER PHASE — TURN ${this.turnNumber}`);
    this.updateInfoStrip();
    this.renderFrame(performance.now());
  }

  // ==========================================================================
  // Initialization & Asset Preloading
  // ==========================================================================

  private async resetSkirmishState(resetMap = true): Promise<void> {
    if (resetMap) {
      this.map = cloneDungeonMap(createDefaultTestDungeonMap());
    }
    this.turnNumber = 1;
    this.turnBadgeEl.textContent = 'Turn 1 · Player';
    this.interactionState = 'idle';
    this.selectedUnitId = null;
    this.currentRange = null;
    this.previewPath = null;
    this.uncommittedOrigin = null;
    this.activeWalk = null;
    this.actionMenuEl.hidden = true;
    this.trackedEnemyIds.clear();

    const nextUnits: TestDungeonUnit[] = [];
    this.map.playerSpawns.forEach((spawn, idx) => {
      const created = this.createUnitFromSpawn(spawn, 'player', idx, `player_${idx}`);
      if (created) nextUnits.push(created);
    });
    this.map.enemySpawns.forEach((spawn, idx) => {
      const created = this.createUnitFromSpawn(spawn, 'enemy', idx, `enemy_${idx}`);
      if (created) nextUnits.push(created);
    });
    this.units = nextUnits;

    this.recomputeDangerArea();
    this.syncSandboxUiState();
    this.inspectedTile = { x: 8, y: 8 };
    this.updateInfoStrip();
    this.renderFrame(performance.now());

    await this.preloadMapAndUnitAssets();
    if (this.openState) {
      this.renderFrame(performance.now());
    }
  }

  private createUnitFromSpawn(
    spawn: {
      x: number;
      y: number;
      speciesId: string;
      level: number;
      nickname?: string;
      heldItemId?: string | null;
    },
    faction: 'player' | 'enemy',
    slotIndex: number,
    id: string
  ): TestDungeonUnit | null {
    const sp = getSpeciesById(spawn.speciesId);
    if (!sp) return null;

    const unlockedMoveIds = sp.learnset
      .filter((entry) => entry.level <= Math.max(spawn.level, sp.defaultJoinLevel))
      .map((entry) => entry.moveId);
    if (unlockedMoveIds.length === 0 && sp.learnset[0]) {
      unlockedMoveIds.push(sp.learnset[0].moveId);
    }

    const activeMoveIds = unlockedMoveIds.slice(-4);
    const activeMoves: ActiveMoveRangeEntry[] = [];
    let equippedMoveId: string | null = null;

    for (const moveId of activeMoveIds) {
      const mv = getMoveById(moveId);
      if (!mv) continue;
      activeMoves.push({
        id: mv.id,
        range: mv.range,
        targetType: mv.targetType,
        ppRemaining: mv.pp,
      });
      if (!equippedMoveId && (mv.category === 'Physical' || mv.category === 'Special')) {
        equippedMoveId = mv.id;
      }
    }

    return {
      id,
      slotIndex,
      faction,
      speciesId: sp.id,
      speciesName: sp.name,
      nickname: spawn.nickname ?? sp.name,
      level: spawn.level,
      x: spawn.x,
      y: spawn.y,
      mov: sp.baseStats.mov,
      traversalClass: sp.traversalClass,
      types: sp.types,
      personalSkillId: sp.personalSkillId,
      heldItemId: spawn.heldItemId ?? null,
      activeMoves,
      equippedMoveId,
      waited: false,
      direction: faction === 'player' ? 2 : 6,
      action: 'Idle',
      frameIndex: 0,
      nextFrameAt: performance.now() + 140,
      renderWorldX: spawn.x * PMD_TILE_NATIVE_PX,
      renderWorldY: spawn.y * PMD_TILE_NATIVE_PX,
    };
  }

  private async preloadMapAndUnitAssets(): Promise<void> {
    const tilesetIds = new Set<string>([this.brushTilesetId]);
    for (const row of this.map.tiles) {
      for (const cell of row) {
        tilesetIds.add(normalizeTilesetId(cell.tilesetId));
      }
    }
    const speciesIds = new Set<string>(this.units.map((u) => u.speciesId));

    await Promise.all([
      ...[...tilesetIds].map((id) => this.ensureTilesetSheet(id)),
      ...[...speciesIds].map((spId) => this.ensureSpriteBundle(spId)),
    ]);
  }

  private async ensureTilesetSheet(rawId: string): Promise<LoadedTilesetSheet> {
    const id = normalizeTilesetId(rawId);
    const cached = this.tilesetSheets.get(id);
    if (cached) return cached;
    const loaded = await loadTilesetSheet(id);
    this.tilesetSheets.set(id, loaded);
    return loaded;
  }

  private async ensureSpriteBundle(speciesId: string): Promise<LoadedSpriteBundle> {
    const cached = this.spriteBundles.get(speciesId);
    if (cached) return cached;
    const loaded = await loadSpeciesSpriteBundle(speciesId);
    this.spriteBundles.set(speciesId, loaded);
    return loaded;
  }

  private getActiveUnits(): TestDungeonUnit[] {
    return this.enemiesVisible
      ? this.units
      : this.units.filter((u) => u.faction === 'player');
  }

  // ==========================================================================
  // Sandbox Drawer & Brush DOM Construction
  // ==========================================================================

  private buildSandboxDrawerDom(): void {
    this.sandboxDrawerEl.innerHTML = `
      <div class="pmd-devtools-row-between">
        <h3 class="pmd-subcard-title">DEV SKIRMISH SANDBOX</h3>
        <button type="button" class="pmd-btn pmd-chip-btn" data-testid="sandbox-close-btn">Close</button>
      </div>

      <div class="pmd-battle-sandbox-section">
        <span class="pmd-preset-label">1. Test Unit Slot &amp; Traversal Presets</span>
        <div class="pmd-inline-btns" data-sandbox-slots></div>
        <div class="pmd-inline-btns" data-sandbox-presets></div>
        <select class="pmd-select" aria-label="Swap Slot Species" data-testid="sandbox-species-select"></select>
        <div class="pmd-inline-btns">
          <button type="button" class="pmd-btn pmd-chip-btn" data-testid="sandbox-boots-btn">Heavy-Duty Boots: OFF</button>
          <button type="button" class="pmd-btn pmd-chip-btn is-active" data-testid="sandbox-enemies-btn">Dummy Enemies: ON</button>
          <button type="button" class="pmd-btn pmd-chip-btn" data-testid="sandbox-end-turn-btn">End Turn</button>
          <button type="button" class="pmd-btn pmd-chip-btn" data-testid="sandbox-reset-btn">Reset Map</button>
        </div>
      </div>

      <div class="pmd-battle-sandbox-section">
        <div class="pmd-devtools-row-between">
          <span class="pmd-preset-label">2. Tileset Parser &amp; Live Map Brush</span>
          <button type="button" class="pmd-btn pmd-chip-btn" data-testid="sandbox-paint-toggle">Paint Mode: OFF</button>
        </div>
        <select class="pmd-select" aria-label="Inspect Tileset PNG" data-testid="sandbox-tileset-select"></select>
        <div class="pmd-inline-btns" data-sandbox-terrains></div>
        <p class="pmd-subcard-text" data-sandbox-brush-meta>—</p>
        <div class="pmd-battle-chunk-palette" data-testid="sandbox-chunk-palette"></div>
        <div class="pmd-inline-btns">
          <button type="button" class="pmd-btn pmd-chip-btn" data-testid="sandbox-export-json-btn">Export Map JSON</button>
          <button type="button" class="pmd-btn pmd-chip-btn pmd-btn-danger" data-testid="sandbox-exit-btn">Exit to Dev Tools</button>
        </div>
      </div>
    `;

    this.sandboxSlotButtonsRow = this.sandboxDrawerEl.querySelector<HTMLElement>('[data-sandbox-slots]')!;
    this.sandboxPresetRow = this.sandboxDrawerEl.querySelector<HTMLElement>('[data-sandbox-presets]')!;
    this.sandboxSpeciesSelect = this.sandboxDrawerEl.querySelector<HTMLSelectElement>(
      '[data-testid="sandbox-species-select"]'
    )!;
    this.sandboxBootsBtn = this.sandboxDrawerEl.querySelector<HTMLButtonElement>(
      '[data-testid="sandbox-boots-btn"]'
    )!;
    this.sandboxEnemiesBtn = this.sandboxDrawerEl.querySelector<HTMLButtonElement>(
      '[data-testid="sandbox-enemies-btn"]'
    )!;
    this.sandboxPaintToggleBtn = this.sandboxDrawerEl.querySelector<HTMLButtonElement>(
      '[data-testid="sandbox-paint-toggle"]'
    )!;
    this.sandboxTilesetSelect = this.sandboxDrawerEl.querySelector<HTMLSelectElement>(
      '[data-testid="sandbox-tileset-select"]'
    )!;
    this.sandboxTerrainRow = this.sandboxDrawerEl.querySelector<HTMLElement>('[data-sandbox-terrains]')!;
    this.sandboxChunkGrid = this.sandboxDrawerEl.querySelector<HTMLElement>(
      '[data-testid="sandbox-chunk-palette"]'
    )!;
    this.sandboxBrushMetaEl = this.sandboxDrawerEl.querySelector<HTMLElement>(
      '[data-sandbox-brush-meta]'
    )!;

    // Populate species dropdown (playable + paralogue6)
    for (const sp of POKEMON_SPECIES_LIST) {
      if (sp.faction === 'enemy') continue;
      const opt = document.createElement('option');
      opt.value = sp.id;
      opt.textContent = `${sp.name} (${sp.traversalClass} · ${sp.types.join('/')} · ${sp.baseStats.mov} Mov)`;
      this.sandboxSpeciesSelect.appendChild(opt);
    }

    // Quick presets
    for (const preset of SANDBOX_UNIT_PRESETS) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'pmd-btn pmd-chip-btn';
      btn.dataset.testid = `sandbox-preset-${preset.speciesId}`;
      btn.textContent = preset.label;
      bindPointerTap(
        btn,
        () => {
          void this.swapPlayerSlotSpecies(this.activeSandboxSlot, preset.speciesId, preset.nickname);
        },
        { signal: this.abortController.signal }
      );
      this.sandboxPresetRow.appendChild(btn);
    }

    // Populate 144 tilesets dropdown
    for (const ts of PMD_TILESET_LIST) {
      const opt = document.createElement('option');
      opt.value = ts.id;
      opt.textContent = ts.label;
      this.sandboxTilesetSelect.appendChild(opt);
    }
    this.sandboxTilesetSelect.value = this.brushTilesetId;

    // Populate 10 Terrain Type brush buttons
    for (const tType of TERRAIN_TYPES) {
      const meta = TERRAIN_METADATA[tType];
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `pmd-btn pmd-chip-btn${tType === this.brushTerrainType ? ' is-active' : ''}`;
      btn.dataset.terrainBtn = tType;
      btn.dataset.testid = `sandbox-terrain-${tType}`;
      btn.textContent = meta.shortLabel;
      bindPointerTap(
        btn,
        () => {
          this.brushTerrainType = tType;
          const def = DEFAULT_TERRAIN_PALETTE[tType];
          this.brushTilesetId = def.tilesetId;
          this.brushChunkIndex = def.chunkIndex;
          this.sandboxTilesetSelect.value = this.brushTilesetId;
          void this.refreshSandboxChunkPalette();
          this.syncSandboxUiState();
        },
        { signal: this.abortController.signal }
      );
      this.sandboxTerrainRow.appendChild(btn);
    }
  }

  private syncSandboxUiState(): void {
    // Render 3 player slot buttons
    this.sandboxSlotButtonsRow.innerHTML = '';
    const playerUnits = this.units.filter((u) => u.faction === 'player');
    for (const pu of playerUnits) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `pmd-btn pmd-chip-btn${pu.slotIndex === this.activeSandboxSlot ? ' is-active' : ''}`;
      btn.dataset.testid = `sandbox-slot-${pu.slotIndex}`;
      btn.textContent = `Slot ${pu.slotIndex + 1}: ${pu.speciesName} (${pu.traversalClass})`;
      bindPointerTap(
        btn,
        () => {
          this.activeSandboxSlot = pu.slotIndex;
          this.centerCameraOnTile(pu.x, pu.y);
          if (!pu.waited && !this.paintMode) {
            this.selectUnit(pu);
          }
          this.syncSandboxUiState();
        },
        { signal: this.abortController.signal }
      );
      this.sandboxSlotButtonsRow.appendChild(btn);
    }

    const activeUnit = playerUnits.find((u) => u.slotIndex === this.activeSandboxSlot);
    if (activeUnit) {
      this.sandboxSpeciesSelect.value = activeUnit.speciesId;
      const hasBoots = activeUnit.heldItemId === 'heavy_duty_boots';
      this.sandboxBootsBtn.textContent = hasBoots
        ? 'Heavy-Duty Boots: ON'
        : 'Heavy-Duty Boots: OFF';
      this.sandboxBootsBtn.classList.toggle('is-active', hasBoots);
    }

    this.sandboxEnemiesBtn.textContent = this.enemiesVisible
      ? 'Dummy Enemies: ON'
      : 'Dummy Enemies: OFF';
    this.sandboxEnemiesBtn.classList.toggle('is-active', this.enemiesVisible);

    this.sandboxPaintToggleBtn.textContent = this.paintMode
      ? 'Paint Mode: ON'
      : 'Paint Mode: OFF';
    this.sandboxPaintToggleBtn.classList.toggle('is-active', this.paintMode);

    this.sandboxTerrainRow.querySelectorAll<HTMLElement>('[data-terrain-btn]').forEach((btn) => {
      btn.classList.toggle('is-active', btn.dataset.terrainBtn === this.brushTerrainType);
    });

    const tMeta = TERRAIN_METADATA[this.brushTerrainType];
    this.sandboxBrushMetaEl.textContent = `Brush: ${tMeta.label} · Sheet #${this.brushTilesetId} · Chunk #${this.brushChunkIndex} (${tMeta.summary})`;
  }

  private async refreshSandboxChunkPalette(): Promise<void> {
    const sheet = await this.ensureTilesetSheet(this.brushTilesetId);
    if (!sheet.validChunkSet.has(this.brushChunkIndex)) {
      this.brushChunkIndex = sheet.validChunkIndices[0] ?? 1;
    }

    this.sandboxChunkGrid.innerHTML = '';
    for (const chunkIdx of sheet.validChunkIndices) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `pmd-chunk-cell${chunkIdx === this.brushChunkIndex ? ' is-active' : ''}`;
      btn.dataset.chunkIdx = String(chunkIdx);
      btn.dataset.testid = `sandbox-chunk-${chunkIdx}`;
      btn.title = `Sheet #${sheet.id} · Chunk #${chunkIdx}`;

      const tileCanvas = document.createElement('canvas');
      tileCanvas.width = PMD_TILE_NATIVE_PX;
      tileCanvas.height = PMD_TILE_NATIVE_PX;
      tileCanvas.className = 'pmd-pixelated pmd-chunk-thumb';
      const tCtx = tileCanvas.getContext('2d')!;
      tCtx.imageSmoothingEnabled = false;
      drawTilesetChunk(tCtx, sheet, chunkIdx, 0, 0, PMD_TILE_NATIVE_PX);
      drawSpecialTerrainOverlay(
        tCtx,
        this.brushTerrainType,
        sheet.id,
        0,
        0,
        PMD_TILE_NATIVE_PX
      );

      const badge = document.createElement('span');
      badge.className = 'pmd-chunk-idx';
      badge.textContent = String(chunkIdx);

      btn.append(tileCanvas, badge);
      bindPointerTap(
        btn,
        () => {
          this.brushChunkIndex = chunkIdx;
          if (!this.paintMode) {
            this.setPaintMode(true);
          }
          this.sandboxChunkGrid.querySelectorAll<HTMLElement>('[data-chunk-idx]').forEach((el) => {
            el.classList.toggle('is-active', Number(el.dataset.chunkIdx) === chunkIdx);
          });
          this.syncSandboxUiState();
        },
        { signal: this.abortController.signal }
      );
      this.sandboxChunkGrid.appendChild(btn);
    }
    this.syncSandboxUiState();
  }

  // ==========================================================================
  // Unified Pointer Events: Panning vs. Tap Disambiguation + Menus
  // ==========================================================================

  private bindEvents(): void {
    const signal = this.abortController.signal;

    // Resize observer keeps buffer exact 1:2 integer ratio with viewport
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => {
        if (!this.openState) return;
        this.syncViewportDimensions();
        this.renderFrame(performance.now());
      });
      this.resizeObserver.observe(this.canvasStageEl);
    }

    // Top HUD buttons
    bindPointerTap(
      this.dangerBtnEl,
      () => {
        this.toggleGlobalDangerArea();
      },
      { signal }
    );

    bindPointerTap(
      this.sandboxToggleBtnEl,
      () => {
        this.setSandboxOpen(!this.sandboxOpen);
      },
      { signal }
    );

    // Floating uncommitted Action Menu (`Wait` / `Cancel`)
    const waitBtn = this.actionMenuEl.querySelector<HTMLButtonElement>(
      '[data-testid="battle-cmd-wait"]'
    );
    const cancelBtn = this.actionMenuEl.querySelector<HTMLButtonElement>(
      '[data-testid="battle-cmd-cancel"]'
    );
    bindPointerTap(waitBtn, () => this.confirmUnitWait(), { signal, stopPropagation: true });
    bindPointerTap(cancelBtn, () => this.cancelUncommittedMove(), { signal, stopPropagation: true });

    // Battlefield System Menu buttons
    bindPointerTap(
      this.systemDangerBtnEl,
      () => {
        this.toggleGlobalDangerArea();
        this.closeSystemMenu();
      },
      { signal }
    );
    bindPointerTap(
      this.systemMenuBackdropEl.querySelector('[data-testid="sys-btn-end-turn"]'),
      () => {
        this.closeSystemMenu();
        this.endTurn();
      },
      { signal }
    );
    bindPointerTap(
      this.systemMenuBackdropEl.querySelector('[data-testid="sys-btn-reset"]'),
      () => {
        this.closeSystemMenu();
        void this.resetSkirmishState(true);
      },
      { signal }
    );
    bindPointerTap(
      this.systemMenuBackdropEl.querySelector('[data-testid="sys-btn-exit"]'),
      () => {
        this.close();
      },
      { signal }
    );
    bindPointerTap(
      this.systemMenuBackdropEl.querySelector('[data-testid="sys-btn-close"]'),
      () => {
        this.closeSystemMenu();
      },
      { signal }
    );

    // Sandbox controls
    bindPointerTap(
      this.sandboxDrawerEl.querySelector('[data-testid="sandbox-close-btn"]'),
      () => this.setSandboxOpen(false),
      { signal }
    );
    this.sandboxSpeciesSelect.addEventListener(
      'change',
      () => {
        void this.swapPlayerSlotSpecies(this.activeSandboxSlot, this.sandboxSpeciesSelect.value);
      },
      { signal }
    );
    bindPointerTap(
      this.sandboxBootsBtn,
      () => {
        this.toggleSlotHeavyDutyBoots(this.activeSandboxSlot);
      },
      { signal }
    );
    bindPointerTap(
      this.sandboxEnemiesBtn,
      () => {
        this.enemiesVisible = !this.enemiesVisible;
        if (!this.enemiesVisible) {
          this.trackedEnemyIds.clear();
        }
        if (this.selectedUnitId) {
          this.recomputeSelectedUnitRange();
        }
        this.recomputeDangerArea();
        this.syncSandboxUiState();
        this.updateInfoStrip();
        this.renderFrame(performance.now());
      },
      { signal }
    );
    bindPointerTap(
      this.sandboxDrawerEl.querySelector('[data-testid="sandbox-end-turn-btn"]'),
      () => this.endTurn(),
      { signal }
    );
    bindPointerTap(
      this.sandboxDrawerEl.querySelector('[data-testid="sandbox-reset-btn"]'),
      () => void this.resetSkirmishState(true),
      { signal }
    );
    bindPointerTap(
      this.sandboxPaintToggleBtn,
      () => this.setPaintMode(!this.paintMode),
      { signal }
    );
    this.sandboxTilesetSelect.addEventListener(
      'change',
      () => {
        this.brushTilesetId = this.sandboxTilesetSelect.value;
        void this.refreshSandboxChunkPalette();
      },
      { signal }
    );
    bindPointerTap(
      this.sandboxDrawerEl.querySelector('[data-testid="sandbox-export-json-btn"]'),
      () => this.openExportModal(),
      { signal }
    );
    bindPointerTap(
      this.sandboxDrawerEl.querySelector('[data-testid="sandbox-exit-btn"]'),
      () => this.close(),
      { signal }
    );

    // Export modal controls
    bindPointerTap(
      this.exportModalBackdropEl.querySelector('[data-testid="battle-export-copy"]'),
      () => {
        if (navigator.clipboard?.writeText) {
          void navigator.clipboard.writeText(this.exportTextareaEl.value);
        }
      },
      { signal }
    );
    bindPointerTap(
      this.exportModalBackdropEl.querySelector('[data-testid="battle-export-close"]'),
      () => this.closeExportModal(),
      { signal }
    );

    // Unified Pointer Panning + Tap + Long-Press + PC Right-Click on Battlefield Canvas
    let activePointerId: number | null = null;
    let pointerStartX = 0;
    let pointerStartY = 0;
    let cameraStartX = 0;
    let cameraStartY = 0;
    let isDraggingCamera = false;
    let longPressTriggered = false;
    let longPressTimer: number | null = null;

    const clearLongPress = () => {
      if (longPressTimer !== null) {
        window.clearTimeout(longPressTimer);
        longPressTimer = null;
      }
    };

    this.canvas.addEventListener(
      'contextmenu',
      (ev: MouseEvent) => {
        ev.preventDefault();
        ev.stopPropagation();
        this.handleMenuOrBack();
      },
      { signal }
    );

    this.canvas.addEventListener(
      'pointerdown',
      (ev: PointerEvent) => {
        if (ev.pointerType === 'mouse' && ev.button !== 0) {
          return;
        }
        activePointerId = ev.pointerId;
        pointerStartX = ev.clientX;
        pointerStartY = ev.clientY;
        cameraStartX = this.cameraX;
        cameraStartY = this.cameraY;
        isDraggingCamera = false;
        longPressTriggered = false;

        try {
          this.canvas.setPointerCapture(ev.pointerId);
        } catch {
          // Synthetic events in headless tests may omit pointer capture registration
        }

        clearLongPress();
        if (ev.pointerType === 'touch') {
          longPressTimer = window.setTimeout(() => {
            longPressTimer = null;
            if (!isDraggingCamera) {
              longPressTriggered = true;
              this.handleMenuOrBack();
            }
          }, LONG_PRESS_MS);
        }
      },
      { signal }
    );

    this.canvas.addEventListener(
      'pointermove',
      (ev: PointerEvent) => {
        // PC hover path preview when not dragging
        if (activePointerId === null && ev.pointerType === 'mouse') {
          const tile = this.clientPointToTile(ev.clientX, ev.clientY);
          if (
            tile &&
            (this.hoveredTile?.x !== tile.x || this.hoveredTile?.y !== tile.y)
          ) {
            this.hoveredTile = tile;
            this.updateHoverPathPreview(tile.x, tile.y);
            this.renderFrame(performance.now());
          }
          return;
        }

        if (activePointerId !== ev.pointerId) return;

        const dxCss = ev.clientX - pointerStartX;
        const dyCss = ev.clientY - pointerStartY;
        const distCss = Math.hypot(dxCss, dyCss);

        if (!isDraggingCamera && distCss > DRAG_THRESHOLD_PX) {
          isDraggingCamera = true;
          clearLongPress();
        }

        if (isDraggingCamera) {
          const nextWorldX = cameraStartX - dxCss / BATTLE_TILE_SCALE;
          const nextWorldY = cameraStartY - dyCss / BATTLE_TILE_SCALE;
          this.setCameraPosition(nextWorldX, nextWorldY);
          if (this.interactionState === 'action_menu') {
            this.positionFloatingActionMenu();
          }
          this.renderFrame(performance.now());
        }
      },
      { signal }
    );

    this.canvas.addEventListener(
      'pointerup',
      (ev: PointerEvent) => {
        if (activePointerId !== ev.pointerId) return;
        clearLongPress();
        try {
          if (this.canvas.hasPointerCapture(ev.pointerId)) {
            this.canvas.releasePointerCapture(ev.pointerId);
          }
        } catch {
          // Ignore synthetic pointer release errors
        }

        const wasDrag = isDraggingCamera;
        const wasLongPress = longPressTriggered;
        activePointerId = null;
        isDraggingCamera = false;
        longPressTriggered = false;

        if (wasDrag || wasLongPress) {
          return;
        }

        const dist = Math.hypot(ev.clientX - pointerStartX, ev.clientY - pointerStartY);
        if (dist <= DRAG_THRESHOLD_PX) {
          const tile = this.clientPointToTile(ev.clientX, ev.clientY);
          if (tile) {
            void this.handleTileTap(tile.x, tile.y);
          }
        }
      },
      { signal }
    );

    this.canvas.addEventListener(
      'pointercancel',
      () => {
        clearLongPress();
        activePointerId = null;
        isDraggingCamera = false;
        longPressTriggered = false;
      },
      { signal }
    );
  }

  // ==========================================================================
  // Grid Interaction State Machine
  // ==========================================================================

  private async handleTileTap(tx: number, ty: number): Promise<void> {
    if (!isInMapBounds(this.map, tx, ty)) return;
    if (this.interactionState === 'walking') return;

    this.inspectedTile = { x: tx, y: ty };

    // Live Map Brush mode: paint `{ tilesetId, chunkIndex, terrainType }` directly onto cell
    if (this.paintMode) {
      await this.ensureTilesetSheet(this.brushTilesetId);
      const row = this.map.tiles[ty];
      if (row && row[tx]) {
        row[tx] = {
          terrainType: this.brushTerrainType,
          tilesetId: normalizeTilesetId(this.brushTilesetId),
          chunkIndex: this.brushChunkIndex,
        };
      }
      this.recomputeDangerArea();
      this.updateInfoStrip();
      this.renderFrame(performance.now());
      return;
    }

    // While uncommitted Action Menu is open, tapping outside cancels back to origin
    if (this.interactionState === 'action_menu') {
      const movingUnit = this.getSelectedUnit();
      if (movingUnit && movingUnit.x === tx && movingUnit.y === ty) {
        this.confirmUnitWait();
      } else {
        this.cancelUncommittedMove();
      }
      return;
    }

    const activeUnits = this.getActiveUnits();
    const tappedUnit = activeUnits.find((u) => u.x === tx && u.y === ty);

    if (this.interactionState === 'unit_selected') {
      const selected = this.getSelectedUnit();
      if (!selected) {
        this.clearSelection();
        return;
      }

      const key = coordKey(tx, ty);
      if (this.currentRange?.reachableTiles.has(key)) {
        const path = findShortestPathAStar(this.map, selected, tx, ty, activeUnits);
        if (path) {
          this.beginUnitWalkToUncommitted(selected, path);
          return;
        }
      }

      // Tapping a different unmoved player unit switches selection directly
      if (tappedUnit && tappedUnit.faction === 'player' && !tappedUnit.waited) {
        this.selectUnit(tappedUnit);
        return;
      }

      // Tapping an enemy toggles its personal Danger Area
      if (tappedUnit && tappedUnit.faction === 'enemy') {
        this.clearSelection();
        this.toggleIndividualEnemyDanger(tappedUnit.id);
        this.updateInfoStrip();
        this.renderFrame(performance.now());
        return;
      }

      // Otherwise deselect and inspect tapped terrain
      this.audioManager.playSfx('cancel');
      this.clearSelection();
      this.updateInfoStrip();
      this.renderFrame(performance.now());
      return;
    }

    // `idle` state
    if (tappedUnit) {
      if (tappedUnit.faction === 'player') {
        if (!tappedUnit.waited) {
          this.activeSandboxSlot = tappedUnit.slotIndex;
          this.syncSandboxUiState();
          this.selectUnit(tappedUnit);
          return;
        }
      } else {
        this.toggleIndividualEnemyDanger(tappedUnit.id);
      }
    }

    this.updateInfoStrip();
    this.renderFrame(performance.now());
  }

  private selectUnit(unit: TestDungeonUnit): void {
    const now = performance.now();
    this.selectedUnitId = unit.id;
    this.selectionPulseStartMs = now;
    this.interactionState = 'unit_selected';
    this.inspectedTile = { x: unit.x, y: unit.y };
    this.previewPath = [{ x: unit.x, y: unit.y, cumulativeCost: 0 }];
    this.recomputeSelectedUnitRange();
    this.audioManager.playSfx('select');
    this.updateInfoStrip();
    this.onLayerStateChanged();
    this.renderFrame(now);
  }

  private clearSelection(): void {
    this.selectedUnitId = null;
    this.currentRange = null;
    this.previewPath = null;
    this.uncommittedOrigin = null;
    this.actionMenuEl.hidden = true;
    this.interactionState = 'idle';
    this.onLayerStateChanged();
    this.updateInfoStrip();
    this.renderFrame(performance.now());
  }

  private getSelectedUnit(): TestDungeonUnit | undefined {
    if (!this.selectedUnitId) return undefined;
    return this.units.find((u) => u.id === this.selectedUnitId);
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
      this.getActiveUnits()
    );
  }

  private updateHoverPathPreview(tx: number, ty: number): void {
    if (this.interactionState !== 'unit_selected') {
      this.previewPath = null;
      return;
    }
    const unit = this.getSelectedUnit();
    const key = coordKey(tx, ty);
    if (!unit || !this.currentRange?.reachableTiles.has(key)) {
      this.previewPath = null;
      return;
    }
    this.previewPath = findShortestPathAStar(
      this.map,
      unit,
      tx,
      ty,
      this.getActiveUnits()
    );
    this.inspectedTile = { x: tx, y: ty };
    this.updateInfoStrip();
  }

  private beginUnitWalkToUncommitted(unit: TestDungeonUnit, steps: AStarPathStep[]): void {
    this.uncommittedOrigin = {
      unitId: unit.id,
      x: unit.x,
      y: unit.y,
      direction: unit.direction,
    };
    this.previewPath = steps;

    if (steps.length <= 1) {
      unit.renderWorldX = unit.x * PMD_TILE_NATIVE_PX;
      unit.renderWorldY = unit.y * PMD_TILE_NATIVE_PX;
      this.openUncommittedActionMenu(unit);
      return;
    }

    this.interactionState = 'walking';
    unit.action = 'Walk';
    unit.frameIndex = 0;
    this.activeWalk = {
      unitId: unit.id,
      steps,
      segmentIndex: 0,
      segmentElapsedMs: 0,
      lastTickMs: performance.now(),
    };
    this.onLayerStateChanged();
  }

  private openUncommittedActionMenu(unit: TestDungeonUnit): void {
    unit.action = 'Idle';
    unit.frameIndex = 0;
    unit.renderWorldX = unit.x * PMD_TILE_NATIVE_PX;
    unit.renderWorldY = unit.y * PMD_TILE_NATIVE_PX;
    this.activeWalk = null;
    this.interactionState = 'action_menu';
    this.inspectedTile = { x: unit.x, y: unit.y };
    this.actionMenuEl.hidden = false;
    this.positionFloatingActionMenu();
    this.updateInfoStrip();
    this.onLayerStateChanged();
    this.renderFrame(performance.now());
  }

  private positionFloatingActionMenu(): void {
    const unit = this.getSelectedUnit();
    if (!unit) return;

    const stageW = this.canvasStageEl.clientWidth;
    const stageH = this.canvasStageEl.clientHeight;
    const unitScreenX = (unit.x * PMD_TILE_NATIVE_PX - this.cameraX) * BATTLE_TILE_SCALE;
    const unitScreenY = (unit.y * PMD_TILE_NATIVE_PX - this.cameraY) * BATTLE_TILE_SCALE;

    const menuW = 136;
    const menuH = 108;
    // Place menu to the right of the unit if space permits, otherwise to the left
    let left = unitScreenX + BATTLE_TILE_DISPLAY_PX + 8;
    if (left + menuW > stageW - 8) {
      left = unitScreenX - menuW - 8;
    }
    left = Math.max(8, Math.min(stageW - menuW - 8, left));

    let top = unitScreenY - 8;
    const minTop = stageW <= 720 && stageH > 500 ? 114 : 58;
    const maxTop = Math.max(minTop, stageH - menuH - 48);
    top = Math.max(minTop, Math.min(maxTop, top));

    this.actionMenuEl.style.left = `${Math.round(left)}px`;
    this.actionMenuEl.style.top = `${Math.round(top)}px`;
  }

  private confirmUnitWait(): void {
    const unit = this.getSelectedUnit();
    if (!unit) return;
    unit.waited = true;
    unit.action = 'Idle';
    unit.renderWorldX = unit.x * PMD_TILE_NATIVE_PX;
    unit.renderWorldY = unit.y * PMD_TILE_NATIVE_PX;
    this.audioManager.playSfx('select');
    this.clearSelection();
    this.recomputeDangerArea();
    this.updateInfoStrip();
    this.renderFrame(performance.now());
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
    this.actionMenuEl.hidden = true;
    this.audioManager.playSfx('cancel');

    if (unit) {
      this.interactionState = 'unit_selected';
      this.selectionPulseStartMs = performance.now();
      this.recomputeSelectedUnitRange();
      this.previewPath = [{ x: unit.x, y: unit.y, cumulativeCost: 0 }];
    } else {
      this.interactionState = 'idle';
    }
    this.updateInfoStrip();
    this.onLayerStateChanged();
    this.renderFrame(performance.now());
  }

  // ==========================================================================
  // Danger Area, Modals & Info Strip
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
    this.audioManager.playSfx('select');
    this.recomputeDangerArea();
  }

  private recomputeDangerArea(): void {
    this.currentDanger = computeEnemyDangerArea(this.map, this.getActiveUnits(), {
      globalEnabled: this.globalDangerEnabled,
      trackedEnemyIds: this.trackedEnemyIds,
    });
    this.dangerBtnEl.textContent = this.globalDangerEnabled ? 'Danger: ON' : 'Danger: OFF';
    this.dangerBtnEl.classList.toggle('is-active', this.globalDangerEnabled);
    this.systemDangerBtnEl.textContent = this.globalDangerEnabled
      ? 'Danger Area: ON'
      : 'Danger Area: OFF';
    this.systemDangerBtnEl.classList.toggle('is-active', this.globalDangerEnabled);
  }

  private setPaintMode(enabled: boolean): void {
    this.paintMode = enabled;
    if (enabled) {
      this.clearSelection();
      void this.refreshSandboxChunkPalette();
    }
    this.syncSandboxUiState();
    this.updateInfoStrip();
    this.renderFrame(performance.now());
  }

  private setSandboxOpen(open: boolean): void {
    this.sandboxOpen = open;
    this.sandboxDrawerEl.hidden = !open;
    this.sandboxToggleBtnEl.classList.toggle('is-active', open);
    this.sandboxToggleBtnEl.textContent = open ? 'Hide Sandbox' : 'Sandbox';
    if (open) {
      this.syncSandboxUiState();
      void this.refreshSandboxChunkPalette();
    }
    this.onLayerStateChanged();
  }

  private openSystemMenu(): void {
    this.systemMenuOpen = true;
    const sub = this.systemMenuBackdropEl.querySelector('[data-sys-sub]');
    if (sub) {
      sub.textContent = `Turn ${this.turnNumber} · ${this.map.name}`;
    }
    this.systemMenuBackdropEl.hidden = false;
    this.audioManager.playSfx('select');
    this.onLayerStateChanged();
  }

  private closeSystemMenu(): void {
    this.systemMenuOpen = false;
    this.systemMenuBackdropEl.hidden = true;
    this.onLayerStateChanged();
  }

  private openExportModal(): void {
    this.exportModalOpen = true;
    this.exportTextareaEl.value = JSON.stringify(this.map, null, 2);
    this.exportModalBackdropEl.hidden = false;
    this.onLayerStateChanged();
  }

  private closeExportModal(): void {
    this.exportModalOpen = false;
    this.exportModalBackdropEl.hidden = true;
    this.onLayerStateChanged();
  }

  private showPhaseBanner(text: string): void {
    if (this.phaseBannerTimer !== null) {
      window.clearTimeout(this.phaseBannerTimer);
    }
    this.phaseBannerEl.textContent = text;
    this.phaseBannerEl.hidden = false;
    this.phaseBannerTimer = window.setTimeout(() => {
      this.phaseBannerEl.hidden = true;
      this.phaseBannerTimer = null;
    }, 1100);
  }

  private updateInfoStrip(): void {
    const { x, y } = this.inspectedTile;
    const terrain = getMapTerrainAt(this.map, x, y) ?? 'floor';
    const meta = TERRAIN_METADATA[terrain];
    const activeUnits = this.getActiveUnits();
    const occupant = activeUnits.find((u) => u.x === x && u.y === y);
    const contextUnit = this.getSelectedUnit() ?? occupant;

    const parts: string[] = [`(${x},${y}) ${meta.label}`];

    if (contextUnit) {
      const moveCost = getTerrainMoveCost(terrain, contextUnit);
      const bonuses = getTerrainBonuses(terrain, contextUnit);
      const costText = moveCost === null ? 'Impassable' : `${moveCost} Mov`;
      const bonusText =
        bonuses.defBonus || bonuses.avoidBonus
          ? `+${bonuses.defBonus} Def/SpD, +${bonuses.avoidBonus}% Avo`
          : '0 Bonus';

      const skill = getPersonalSkillById(contextUnit.personalSkillId);
      const item = contextUnit.heldItemId ? getItemById(contextUnit.heldItemId) : undefined;
      const eqMove = contextUnit.equippedMoveId
        ? getMoveById(contextUnit.equippedMoveId)
        : undefined;
      const effMov = getEffectiveMovementPoints(contextUnit);

      parts.push(
        `${contextUnit.nickname} (${contextUnit.speciesName} · ${contextUnit.traversalClass} · ${contextUnit.types.join('/')} · Mov ${effMov})`,
        `Tile for ${contextUnit.speciesName}: ${costText} · ${bonusText}`
      );
      if (eqMove) {
        parts.push(`[E] ${eqMove.name} (R${eqMove.range[0]})`);
      }
      if (item) {
        parts.push(`Held: ${item.name}`);
      } else if (skill) {
        parts.push(`Skill: ${skill.name}`);
      }
    } else {
      parts.push(meta.summary);
    }

    if (this.paintMode) {
      parts.unshift('[PAINT MODE]');
    }

    this.infoStripEl.textContent = parts.join(' · ');
  }

  // ==========================================================================
  // Camera Math & 1:1 Native Buffer Rendering (`2x` CSS Pixelated Scaling)
  // ==========================================================================

  private syncViewportDimensions(): void {
    const stageW = Math.max(240, this.canvasStageEl.clientWidth || 640);
    const stageH = Math.max(180, this.canvasStageEl.clientHeight || 480);

    // Exact 1:2 buffer-to-CSS pixel ratio guarantees crisp 2x integer pixel scaling
    this.bufferWidth = Math.max(120, Math.floor(stageW / BATTLE_TILE_SCALE));
    this.bufferHeight = Math.max(90, Math.floor(stageH / BATTLE_TILE_SCALE));

    if (this.canvas.width !== this.bufferWidth || this.canvas.height !== this.bufferHeight) {
      this.canvas.width = this.bufferWidth;
      this.canvas.height = this.bufferHeight;
      this.canvas.style.width = `${this.bufferWidth * BATTLE_TILE_SCALE}px`;
      this.canvas.style.height = `${this.bufferHeight * BATTLE_TILE_SCALE}px`;
      this.ctx.imageSmoothingEnabled = false;
    }

    this.setCameraPosition(this.cameraX, this.cameraY);
  }

  private getMaxCameraBounds(): { minX: number; maxX: number; minY: number; maxY: number } {
    const worldW = this.map.width * PMD_TILE_NATIVE_PX;
    const worldH = this.map.height * PMD_TILE_NATIVE_PX;
    const overscroll = 6 * PMD_TILE_NATIVE_PX;

    let minX: number;
    let maxX: number;
    if (worldW <= this.bufferWidth) {
      const centerCamX = Math.round((worldW - this.bufferWidth) / 2);
      minX = centerCamX - overscroll;
      maxX = centerCamX + overscroll;
    } else {
      minX = -Math.round(overscroll / 2);
      maxX = worldW - this.bufferWidth + Math.round(overscroll / 2);
    }

    let minY: number;
    let maxY: number;
    if (worldH <= this.bufferHeight) {
      const centerCamY = Math.round((worldH - this.bufferHeight) / 2);
      minY = centerCamY - overscroll;
      maxY = centerCamY + overscroll;
    } else {
      minY = -Math.round(overscroll / 2);
      maxY = worldH - this.bufferHeight + Math.round(overscroll / 2);
    }

    return { minX, maxX, minY, maxY };
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
    const worldX = localCssX / BATTLE_TILE_SCALE + this.cameraX;
    const worldY = localCssY / BATTLE_TILE_SCALE + this.cameraY;
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
    // 1. Advance active A* walk interpolation
    if (this.activeWalk) {
      const unit = this.units.find((u) => u.id === this.activeWalk!.unitId);
      if (!unit) {
        this.activeWalk = null;
      } else {
        const dt = Math.min(80, Math.max(0, now - this.activeWalk.lastTickMs));
        this.activeWalk.lastTickMs = now;
        this.activeWalk.segmentElapsedMs += dt;

        while (this.activeWalk && this.activeWalk.segmentElapsedMs >= WALK_MS_PER_TILE) {
          this.activeWalk.segmentElapsedMs -= WALK_MS_PER_TILE;
          this.activeWalk.segmentIndex += 1;
          const reachedStep = this.activeWalk.steps[this.activeWalk.segmentIndex];
          if (!reachedStep) break;
          unit.x = reachedStep.x;
          unit.y = reachedStep.y;

          if (this.activeWalk.segmentIndex >= this.activeWalk.steps.length - 1) {
            this.openUncommittedActionMenu(unit);
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

          const t = Math.min(1, this.activeWalk.segmentElapsedMs / WALK_MS_PER_TILE);
          unit.renderWorldX = Math.round((fromStep.x + dx * t) * PMD_TILE_NATIVE_PX);
          unit.renderWorldY = Math.round((fromStep.y + dy * t) * PMD_TILE_NATIVE_PX);
        }
      }
    }

    // 2. Advance 8-directional PMD sprite frames
    for (const unit of this.getActiveUnits()) {
      const bundle = this.spriteBundles.get(unit.speciesId);
      if (!bundle) continue;
      const anim = bundle.actions[unit.action] ?? bundle.actions.Idle;
      if (now >= unit.nextFrameAt) {
        unit.frameIndex = (unit.frameIndex + 1) % Math.max(1, anim.frameCount);
        const dur = anim.durationsMs[unit.frameIndex % anim.durationsMs.length] ?? 140;
        unit.nextFrameAt = now + dur;
      }
    }
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

    // 1. Render Seamless PMD 24x24 Dungeon Chunks + Stairs / Wonder Tile / Barrier Overlays (zero grid lines)
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

    // 2. Render Enemy Danger Area Overlay (Modern Contiguous Perimeter + Slight Interior Fill)
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

    // 5. Render Inspected / Selected Tile Pixel Cursor
    {
      const cx = this.inspectedTile.x * PMD_TILE_NATIVE_PX - this.cameraX;
      const cy = this.inspectedTile.y * PMD_TILE_NATIVE_PX - this.cameraY;
      ctx.fillStyle = this.paintMode ? '#68f098' : '#f8d048';
      // 4 crisp corner brackets
      ctx.fillRect(cx, cy, 5, 2);
      ctx.fillRect(cx, cy, 2, 5);
      ctx.fillRect(cx + PMD_TILE_NATIVE_PX - 5, cy, 5, 2);
      ctx.fillRect(cx + PMD_TILE_NATIVE_PX - 2, cy, 2, 5);
      ctx.fillRect(cx, cy + PMD_TILE_NATIVE_PX - 2, 5, 2);
      ctx.fillRect(cx, cy + PMD_TILE_NATIVE_PX - 5, 2, 5);
      ctx.fillRect(cx + PMD_TILE_NATIVE_PX - 5, cy + PMD_TILE_NATIVE_PX - 2, 5, 2);
      ctx.fillRect(cx + PMD_TILE_NATIVE_PX - 2, cy + PMD_TILE_NATIVE_PX - 5, 2, 5);
    }

    // 6. Render Units (Y-sorted & anchored via PMD2 frame-center / ground-shadow geometry)
    const sortedUnits = [...this.getActiveUnits()].sort(
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

        if (unit.waited) {
          // Rested/dimmed state rendered via 1:1 nearest-neighbor scratch canvas
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
          this.tintScratchCtx.fillStyle = 'rgba(18, 26, 44, 0.56)';
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

      // Boots indicator pip if holding Heavy-Duty Boots
      if (unit.heldItemId === 'heavy_duty_boots') {
        ctx.fillStyle = '#081020';
        ctx.fillRect(tileScreenX + 18, tileScreenY + 1, 5, 5);
        ctx.fillStyle = '#f8d048';
        ctx.fillRect(tileScreenX + 19, tileScreenY + 2, 3, 3);
      }
    }
  }

  /**
   * Renders a modern contiguous range overlay with a very slight seamless interior fill,
   * zero interior grid lines, a soft `1px` inner rim glow, and a crisp `1px` outer perimeter
   * (including watertight concave corner pixels).
   */
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

    // Pass 1: Subtle full-tile interior wash (zero gaps between adjacent tiles)
    ctx.fillStyle = style.fillRgba;
    for (const key of zoneTiles) {
      const { x, y } = parseCoordKey(key);
      if (x < startCol || x > endCol || y < startRow || y > endRow) continue;
      ctx.fillRect(x * S - this.cameraX, y * S - this.cameraY, S, S);
    }

    // Pass 2: Soft 1px inner rim glow along exposed boundary edges
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

    // Pass 3: Crisp 1px outer perimeter outline (with concave 1x1 corner seals)
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

  /**
   * Renders a crisp pixel-art oval ground shadow & faction ring anchored at `(shadowCenterX, shadowCenterY)`
   * (`(12, 20)` in native `24x24` PMD tile space).
   */
  private drawUnitGroundShadow(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    shadowSize: number,
    unit: TestDungeonUnit
  ): void {
    const halfW = shadowSize <= 0 ? 5 : shadowSize === 1 ? 6 : 8;
    const innerSpan = (halfW - 2) * 2;

    // Soft dark ground shadow interior
    ctx.fillStyle = 'rgba(6, 12, 24, 0.42)';
    ctx.fillRect(cx - halfW + 2, cy - 1, innerSpan, 3);

    // Crisp 1px faction ring rim around the shadow oval
    ctx.fillStyle =
      unit.faction === 'player'
        ? unit.waited
          ? 'rgba(136, 152, 176, 0.50)'
          : 'rgba(72, 204, 255, 0.82)'
        : this.trackedEnemyIds.has(unit.id)
          ? 'rgba(255, 112, 196, 0.90)'
          : 'rgba(248, 84, 92, 0.82)';

    ctx.fillRect(cx - halfW + 2, cy - 2, innerSpan, 1);
    ctx.fillRect(cx - halfW + 2, cy + 2, innerSpan, 1);
    ctx.fillRect(cx - halfW, cy - 1, 2, 3);
    ctx.fillRect(cx + halfW - 2, cy - 1, 2, 3);
  }
}
