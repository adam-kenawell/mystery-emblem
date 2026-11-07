/**
 * Dev Tools Interactive Level & Chapter Map Editor (`ChapterMapEditorScene`)
 *
 * Full-viewport `2x` (`48x48` CSS px per tile) PMD: Explorers of Sky dungeon map editor:
 * - Select & customize any level/chapter in the game (`Drenched Bluff`, `Convergence Ruins`,
 *   `Prologue`, `Chapter 1`–`Chapter 25`, and `Paralogue 1`–`Paralogue 6`).
 * - Paint tiles from all 144 EoS `24x24` chunk sheets (`tileset_000`..`tileset_143`) with
 *   independent gameplay `TerrainType` rules + 1-tap biome presets, Drag Stroke painting,
 *   Eyedropper tile picker, Undo history, Blue Player Spawn editor, Enemy Spawn editor,
 *   and Map Width/Height/Deployment Cap controls.
 * - Saves immediately to `ChapterMapStore` (`localStorage` + `SaveData.customMaps` Cloud Sync)
 *   so customized maps update live in `BattleScene` and `TestDungeonScene`.
 *
 * Strictly obeys Rule 2 (Unified Pointer Events ONLY — zero keyboard listeners) and Rule 3
 * (`image-rendering: pixelated`, `imageSmoothingEnabled = false`).
 */

import {
  computePmdTileSpritePlacement,
  loadSpeciesSpriteBundle,
  type LoadedSpriteBundle,
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
  CHAPTER_LEVEL_CATALOG,
  exportChapterMapJson,
  getChapterCatalogEntry,
  getDefaultChapterMap,
  getEffectiveChapterMap,
  hasChapterMapOverride,
  resetChapterMapOverride,
  saveChapterMapOverride,
  validateDungeonMapDefinition,
  type ChapterLevelGroup,
} from '../data/chapterMapRegistry';
import { POKEMON_SPECIES_LIST, getSpeciesById } from '../data/index';
import { cloneDungeonMap } from '../data/testDungeonMap';
import { TERRAIN_METADATA } from '../engine/terrainAndPathfinding';
import type { SaveStateManager } from '../state/SaveStateManager';
import {
  TERRAIN_TYPES,
  type DungeonMapDefinition,
  type DungeonMapTileCell,
  type TerrainType,
} from '../types/schemas';
import { bindPointerTap } from '../ui/pointerControls';

const EDITOR_TILE_SCALE = 2;
const DRAG_THRESHOLD_PX = 8;
const MAX_UNDO_STEPS = 40;

export type MapEditorToolMode =
  | 'paint'
  | 'stroke'
  | 'eyedropper'
  | 'player_spawn'
  | 'enemy_spawn'
  | 'pan';

interface BiomeBrushPreset {
  id: string;
  label: string;
  terrainType: TerrainType;
  tilesetId: string;
  chunkIndex: number;
}

const BIOME_BRUSH_PRESETS: ReadonlyArray<BiomeBrushPreset> = [
  { id: 'bluff_floor', label: 'Bluff Floor', terrainType: 'floor', tilesetId: '003', chunkIndex: 59 },
  { id: 'grass_floor', label: 'Lush Grass', terrainType: 'floor', tilesetId: '142', chunkIndex: 59 },
  { id: 'stone_road', label: 'Stone Road', terrainType: 'floor', tilesetId: '110', chunkIndex: 59 },
  { id: 'beach_sand', label: 'Beach Sand', terrainType: 'floor', tilesetId: '001', chunkIndex: 59 },
  { id: 'water_pool', label: 'Water', terrainType: 'water', tilesetId: '142', chunkIndex: 88 },
  { id: 'trees', label: 'Trees', terrainType: 'trees', tilesetId: '142', chunkIndex: 1 },
  { id: 'mountain', label: 'Mountain', terrainType: 'mountain', tilesetId: '110', chunkIndex: 1 },
  { id: 'bluff_wall', label: 'Bluff Wall', terrainType: 'wall', tilesetId: '003', chunkIndex: 1 },
  { id: 'cave_wall', label: 'Cave Wall', terrainType: 'wall', tilesetId: '001', chunkIndex: 1 },
  { id: 'lava', label: 'Lava', terrainType: 'lava', tilesetId: '110', chunkIndex: 106 },
  { id: 'void', label: 'Void', terrainType: 'void', tilesetId: '061', chunkIndex: 100 },
  { id: 'barrier', label: 'Barrier', terrainType: 'barrier', tilesetId: '080', chunkIndex: 15 },
  { id: 'stairs', label: 'Stairs', terrainType: 'stairs', tilesetId: '110', chunkIndex: 59 },
  { id: 'wonder', label: 'Wonder Tile', terrainType: 'wonder_tile', tilesetId: '142', chunkIndex: 59 },
];

const GROUP_FILTERS: ReadonlyArray<{ id: 'all' | ChapterLevelGroup; label: string }> = [
  { id: 'all', label: 'All (34)' },
  { id: 'test', label: 'Test' },
  { id: 'act1', label: 'Act 1' },
  { id: 'act2', label: 'Act 2' },
  { id: 'act3', label: 'Act 3' },
  { id: 'act4', label: 'Act 4' },
  { id: 'paralogue', label: 'Paralogues' },
];

export interface ChapterMapEditorSnapshot {
  isOpen: boolean;
  levelId: string;
  mapName: string;
  width: number;
  height: number;
  deploymentCap: number;
  playerSpawnCount: number;
  enemySpawnCount: number;
  isCustomizedInStore: boolean;
  hasUnsavedChanges: boolean;
  toolMode: MapEditorToolMode;
  drawerOpen: boolean;
  systemMenuOpen: boolean;
  jsonModalOpen: boolean;
  showGrid: boolean;
  showSpawns: boolean;
  undoCount: number;
  brush: {
    terrainType: TerrainType;
    tilesetId: string;
    chunkIndex: number;
  };
  camera: {
    x: number;
    y: number;
    displayScale: number;
    imageSmoothingEnabled: boolean;
  };
}

export interface ChapterMapEditorSceneOptions {
  viewportEl: HTMLElement;
  saveManager: SaveStateManager;
  audioManager?: AudioManager;
  onExit: () => void;
  onPlayLevel: (levelId: string) => void;
  onLayerStateChanged?: () => void;
}

export class ChapterMapEditorScene {
  private readonly viewportEl: HTMLElement;
  private readonly saveManager: SaveStateManager;
  private readonly audioManager: AudioManager;
  private readonly onExitCallback: () => void;
  private readonly onPlayLevelCallback: (levelId: string) => void;
  private readonly onLayerStateChanged: () => void;

  private readonly rootEl: HTMLElement;
  private readonly canvasStageEl: HTMLElement;
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;

  // Top HUD controls
  private readonly topHudBarEl: HTMLElement;
  private readonly hudPaletteBtnEl: HTMLButtonElement;
  private readonly hudToolBtnEl: HTMLButtonElement;
  private readonly hudUndoBtnEl: HTMLButtonElement;
  private readonly hudSaveBtnEl: HTMLButtonElement;
  private readonly hudPlayBtnEl: HTMLButtonElement;

  private readonly toastBannerEl: HTMLElement;
  private readonly infoStripEl: HTMLElement;

  // Collapsible Map Editor Drawer
  private readonly drawerEl: HTMLElement;
  private readonly levelGroupRowEl: HTMLElement;
  private readonly levelSelectEl: HTMLSelectElement;
  private readonly statusBadgeEl: HTMLElement;
  private readonly enemyConfigBoxEl: HTMLElement;
  private readonly enemySpeciesSelectEl: HTMLSelectElement;
  private readonly enemyLevelValEl: HTMLElement;
  private readonly gridToggleBtnEl: HTMLButtonElement;
  private readonly spawnsToggleBtnEl: HTMLButtonElement;
  private readonly activeBrushSummaryEl: HTMLElement;
  private readonly tilesetSelectEl: HTMLSelectElement;
  private readonly chunkPaletteEl: HTMLElement;
  private readonly mapWidthValEl: HTMLElement;
  private readonly mapHeightValEl: HTMLElement;
  private readonly deployCapValEl: HTMLElement;

  // System Menu & JSON Import/Export Modals
  private readonly systemMenuBackdropEl: HTMLElement;
  private readonly jsonModalBackdropEl: HTMLElement;
  private readonly jsonTextareaEl: HTMLTextAreaElement;
  private readonly jsonStatusEl: HTMLElement;

  private readonly abortController = new AbortController();
  private resizeObserver: ResizeObserver | null = null;
  private rafId: number | null = null;
  private toastTimer: number | null = null;

  // Editor Runtime State
  private openState = false;
  private drawerOpen = true;
  private systemMenuOpen = false;
  private jsonModalOpen = false;
  private previousBgmId: string | null = null;

  private activeGroupFilter: 'all' | ChapterLevelGroup = 'all';
  private activeLevelId = 'drenched_bluff_vanguard';
  private map: DungeonMapDefinition = getEffectiveChapterMap('drenched_bluff_vanguard');
  private undoStack: DungeonMapDefinition[] = [];
  private dirty = false;

  private toolMode: MapEditorToolMode = 'paint';
  private brushTerrainType: TerrainType = 'floor';
  private brushTilesetId = '003';
  private brushChunkIndex = 59;

  private spawnEnemySpeciesId = 'zigzagoon_galar';
  private spawnEnemyLevel = 2;

  private showGrid = false;
  private showSpawns = true;

  private inspectedTile: { x: number; y: number } = { x: 8, y: 5 };
  private hoveredTile: { x: number; y: number } | null = null;

  // Camera & Buffer
  private bufferWidth = 480;
  private bufferHeight = 320;
  private cameraX = 0;
  private cameraY = 0;

  // Pointer Gesture State
  private activePointerId: number | null = null;
  private pointerStartX = 0;
  private pointerStartY = 0;
  private pointerStartCamX = 0;
  private pointerStartCamY = 0;
  private pointerMoved = false;
  private strokeUndoPushed = false;
  private lastStrokedCoordKey: string | null = null;

  // Cached Tilesets & Unit Preview Sprites
  private readonly loadedSheets = new Map<string, LoadedTilesetSheet>();
  private readonly spriteBundles = new Map<string, LoadedSpriteBundle>();

  constructor(options: ChapterMapEditorSceneOptions) {
    this.viewportEl = options.viewportEl;
    this.saveManager = options.saveManager;
    this.audioManager = options.audioManager ?? getAudioManager();
    this.onExitCallback = options.onExit;
    this.onPlayLevelCallback = options.onPlayLevel;
    this.onLayerStateChanged = options.onLayerStateChanged ?? (() => {});

    this.rootEl = document.createElement('section');
    this.rootEl.id = 'pmd-map-editor-scene';
    this.rootEl.className = 'pmd-battle-scene pmd-map-editor-scene';
    this.rootEl.dataset.testid = 'chapter-map-editor-scene';
    this.rootEl.hidden = true;

    this.canvasStageEl = document.createElement('div');
    this.canvasStageEl.className = 'pmd-battle-canvas-stage';
    this.canvasStageEl.dataset.testid = 'map-editor-canvas-stage';

    this.canvas = document.createElement('canvas');
    this.canvas.className = 'pmd-battle-canvas';
    this.canvas.dataset.testid = 'map-editor-canvas';
    const ctx = this.canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Could not initialize 2D context for ChapterMapEditorScene.');
    }
    ctx.imageSmoothingEnabled = false;
    this.ctx = ctx;
    this.canvasStageEl.appendChild(this.canvas);

    // Top HUD Bar (fits cleanly between top-left Dev Tools and top-right Menu/Back across all viewports)
    this.topHudBarEl = document.createElement('div');
    this.topHudBarEl.className = 'pmd-battle-hud-top';
    this.topHudBarEl.dataset.testid = 'map-editor-top-hud';

    this.hudPaletteBtnEl = document.createElement('button');
    this.hudPaletteBtnEl.type = 'button';
    this.hudPaletteBtnEl.className = 'pmd-btn pmd-battle-hud-btn is-active';
    this.hudPaletteBtnEl.dataset.testid = 'editor-hud-palette-btn';
    this.hudPaletteBtnEl.textContent = 'Palette';

    this.hudToolBtnEl = document.createElement('button');
    this.hudToolBtnEl.type = 'button';
    this.hudToolBtnEl.className = 'pmd-btn pmd-battle-hud-btn';
    this.hudToolBtnEl.dataset.testid = 'editor-hud-tool-btn';
    this.hudToolBtnEl.textContent = 'Tool: Paint';

    this.hudUndoBtnEl = document.createElement('button');
    this.hudUndoBtnEl.type = 'button';
    this.hudUndoBtnEl.className = 'pmd-btn pmd-battle-hud-btn';
    this.hudUndoBtnEl.dataset.testid = 'editor-hud-undo-btn';
    this.hudUndoBtnEl.textContent = 'Undo';
    this.hudUndoBtnEl.disabled = true;

    this.hudSaveBtnEl = document.createElement('button');
    this.hudSaveBtnEl.type = 'button';
    this.hudSaveBtnEl.className = 'pmd-btn pmd-btn-primary pmd-battle-hud-btn';
    this.hudSaveBtnEl.dataset.testid = 'editor-hud-save-btn';
    this.hudSaveBtnEl.textContent = 'Save';

    this.hudPlayBtnEl = document.createElement('button');
    this.hudPlayBtnEl.type = 'button';
    this.hudPlayBtnEl.className = 'pmd-btn pmd-battle-hud-btn';
    this.hudPlayBtnEl.dataset.testid = 'editor-hud-play-btn';
    this.hudPlayBtnEl.textContent = 'Play';

    this.topHudBarEl.append(
      this.hudPaletteBtnEl,
      this.hudToolBtnEl,
      this.hudUndoBtnEl,
      this.hudSaveBtnEl,
      this.hudPlayBtnEl
    );

    // Toast Banner
    this.toastBannerEl = document.createElement('div');
    this.toastBannerEl.className = 'pmd-window pmd-window--translucent pmd-battle-phase-banner';
    this.toastBannerEl.dataset.testid = 'map-editor-toast';
    this.toastBannerEl.hidden = true;

    // Bottom Info Strip
    this.infoStripEl = document.createElement('div');
    this.infoStripEl.className = 'pmd-window pmd-window--translucent pmd-battle-info-strip';
    this.infoStripEl.dataset.testid = 'map-editor-info-strip';

    // Collapsible Sandbox Map Editor Drawer
    this.drawerEl = document.createElement('aside');
    this.drawerEl.className = 'pmd-window pmd-battle-sandbox-drawer pmd-map-editor-drawer';
    this.drawerEl.dataset.testid = 'map-editor-drawer';
    this.drawerEl.innerHTML = `
      <div class="pmd-devtools-row-between">
        <h3 class="pmd-subcard-title">LEVEL &amp; CHAPTER MAP EDITOR</h3>
        <button type="button" class="pmd-btn pmd-chip-btn" data-testid="editor-drawer-close-btn">Hide Panel</button>
      </div>

      <div class="pmd-battle-sandbox-section">
        <div class="pmd-devtools-row-between">
          <span class="pmd-preset-label">1. Select Level / Chapter</span>
          <span class="pmd-editor-status-pill" data-testid="editor-status-badge">DEFAULT</span>
        </div>
        <div class="pmd-inline-btns" data-editor-group-filters></div>
        <select class="pmd-select" data-testid="editor-level-select" aria-label="Select Level or Chapter"></select>
        <div class="pmd-inline-btns">
          <button type="button" class="pmd-btn pmd-btn-primary pmd-chip-btn" data-testid="editor-save-btn">Save to Game</button>
          <button type="button" class="pmd-btn pmd-chip-btn" data-testid="editor-save-play-btn">Save &amp; Play</button>
          <button type="button" class="pmd-btn pmd-chip-btn" data-testid="editor-json-modal-btn">Import / Export JSON</button>
          <button type="button" class="pmd-btn pmd-btn-danger pmd-chip-btn" data-testid="editor-reset-default-btn">Reset Default</button>
        </div>
      </div>

      <div class="pmd-battle-sandbox-section">
        <span class="pmd-preset-label">2. Pointer Tool &amp; View Overlays</span>
        <div class="pmd-inline-btns" data-editor-tool-row>
          <button type="button" class="pmd-btn pmd-chip-btn is-active" data-editor-tool="paint" data-testid="editor-tool-paint">Tap Paint</button>
          <button type="button" class="pmd-btn pmd-chip-btn" data-editor-tool="stroke" data-testid="editor-tool-stroke">Drag Stroke</button>
          <button type="button" class="pmd-btn pmd-chip-btn" data-editor-tool="eyedropper" data-testid="editor-tool-eyedropper">Pick Tile</button>
          <button type="button" class="pmd-btn pmd-chip-btn" data-editor-tool="player_spawn" data-testid="editor-tool-player_spawn">Blue Spawns</button>
          <button type="button" class="pmd-btn pmd-chip-btn" data-editor-tool="enemy_spawn" data-testid="editor-tool-enemy_spawn">Enemy Spawns</button>
          <button type="button" class="pmd-btn pmd-chip-btn" data-editor-tool="pan" data-testid="editor-tool-pan">Pan Only</button>
        </div>
        <div class="pmd-editor-enemy-config" data-editor-enemy-config hidden>
          <span class="pmd-subcard-text">Tap map tile to place/remove enemy spawn (Rule 5 enemy lines):</span>
          <select class="pmd-select" data-testid="editor-enemy-species-select" aria-label="Enemy Spawn Species"></select>
          <div class="pmd-inline-btns pmd-editor-stepper-row">
            <span class="pmd-subcard-text">Enemy Level: <strong data-enemy-level-val>2</strong></span>
            <button type="button" class="pmd-btn pmd-chip-btn" data-testid="editor-enemy-lv-dec">- Lv</button>
            <button type="button" class="pmd-btn pmd-chip-btn" data-testid="editor-enemy-lv-inc">+ Lv</button>
          </div>
        </div>
        <div class="pmd-inline-btns">
          <button type="button" class="pmd-btn pmd-chip-btn" data-testid="editor-grid-toggle-btn">Grid: OFF</button>
          <button type="button" class="pmd-btn pmd-chip-btn is-active" data-testid="editor-spawns-toggle-btn">Spawns: ON</button>
        </div>
      </div>

      <div class="pmd-battle-sandbox-section">
        <span class="pmd-preset-label">3. Quick Biome Presets &amp; Terrain Rule</span>
        <div class="pmd-inline-btns" data-editor-biome-presets></div>
        <span class="pmd-subcard-text">Gameplay Terrain Rule (keeps selected chunk):</span>
        <div class="pmd-inline-btns" data-editor-terrain-chips></div>
        <p class="pmd-subcard-text pmd-editor-brush-readout" data-testid="editor-active-brush-summary">—</p>
        <select class="pmd-select" data-testid="editor-tileset-select" aria-label="Select EoS 24x24 Tileset Sheet"></select>
        <div class="pmd-battle-chunk-palette" data-testid="editor-chunk-grid"></div>
      </div>

      <div class="pmd-battle-sandbox-section">
        <span class="pmd-preset-label">4. Map Dimensions &amp; Deployment Cap</span>
        <div class="pmd-editor-dim-grid">
          <div class="pmd-editor-dim-item">
            <span class="pmd-subcard-text">Width: <strong data-testid="editor-width-val">18</strong></span>
            <div class="pmd-inline-btns">
              <button type="button" class="pmd-btn pmd-chip-btn" data-testid="editor-width-dec">-W</button>
              <button type="button" class="pmd-btn pmd-chip-btn" data-testid="editor-width-inc">+W</button>
            </div>
          </div>
          <div class="pmd-editor-dim-item">
            <span class="pmd-subcard-text">Height: <strong data-testid="editor-height-val">12</strong></span>
            <div class="pmd-inline-btns">
              <button type="button" class="pmd-btn pmd-chip-btn" data-testid="editor-height-dec">-H</button>
              <button type="button" class="pmd-btn pmd-chip-btn" data-testid="editor-height-inc">+H</button>
            </div>
          </div>
          <div class="pmd-editor-dim-item">
            <span class="pmd-subcard-text">Deploy Cap: <strong data-testid="editor-cap-val">3</strong></span>
            <div class="pmd-inline-btns">
              <button type="button" class="pmd-btn pmd-chip-btn" data-testid="editor-cap-dec">-Cap</button>
              <button type="button" class="pmd-btn pmd-chip-btn" data-testid="editor-cap-inc">+Cap</button>
            </div>
          </div>
        </div>
        <div class="pmd-inline-btns">
          <button type="button" class="pmd-btn pmd-btn-danger pmd-chip-btn" data-testid="editor-exit-btn">Exit Map Editor</button>
        </div>
      </div>
    `;

    this.levelGroupRowEl = this.drawerEl.querySelector<HTMLElement>('[data-editor-group-filters]')!;
    this.levelSelectEl = this.drawerEl.querySelector<HTMLSelectElement>(
      '[data-testid="editor-level-select"]'
    )!;
    this.statusBadgeEl = this.drawerEl.querySelector<HTMLElement>(
      '[data-testid="editor-status-badge"]'
    )!;
    this.enemyConfigBoxEl = this.drawerEl.querySelector<HTMLElement>(
      '[data-editor-enemy-config]'
    )!;
    this.enemySpeciesSelectEl = this.drawerEl.querySelector<HTMLSelectElement>(
      '[data-testid="editor-enemy-species-select"]'
    )!;
    this.enemyLevelValEl = this.drawerEl.querySelector<HTMLElement>('[data-enemy-level-val]')!;
    this.gridToggleBtnEl = this.drawerEl.querySelector<HTMLButtonElement>(
      '[data-testid="editor-grid-toggle-btn"]'
    )!;
    this.spawnsToggleBtnEl = this.drawerEl.querySelector<HTMLButtonElement>(
      '[data-testid="editor-spawns-toggle-btn"]'
    )!;
    this.activeBrushSummaryEl = this.drawerEl.querySelector<HTMLElement>(
      '[data-testid="editor-active-brush-summary"]'
    )!;
    this.tilesetSelectEl = this.drawerEl.querySelector<HTMLSelectElement>(
      '[data-testid="editor-tileset-select"]'
    )!;
    this.chunkPaletteEl = this.drawerEl.querySelector<HTMLElement>(
      '[data-testid="editor-chunk-grid"]'
    )!;
    this.mapWidthValEl = this.drawerEl.querySelector<HTMLElement>(
      '[data-testid="editor-width-val"]'
    )!;
    this.mapHeightValEl = this.drawerEl.querySelector<HTMLElement>(
      '[data-testid="editor-height-val"]'
    )!;
    this.deployCapValEl = this.drawerEl.querySelector<HTMLElement>(
      '[data-testid="editor-cap-val"]'
    )!;

    // System Menu Modal
    this.systemMenuBackdropEl = document.createElement('div');
    this.systemMenuBackdropEl.className = 'pmd-battle-modal-backdrop';
    this.systemMenuBackdropEl.dataset.testid = 'editor-system-menu-modal';
    this.systemMenuBackdropEl.hidden = true;
    this.systemMenuBackdropEl.innerHTML = `
      <div class="pmd-window pmd-battle-system-dialog" role="dialog" aria-modal="true" aria-labelledby="editor-sys-title">
        <h3 id="editor-sys-title" class="pmd-panel-title">MAP EDITOR MENU</h3>
        <p class="pmd-panel-sub">Save your custom dungeon tiles to the live game or jump straight into battle.</p>
        <div class="pmd-battle-system-actions pmd-menu-list">
          <button type="button" class="pmd-btn pmd-btn-primary pmd-menu-row" data-testid="editor-sys-save-btn">Save Map to Game</button>
          <button type="button" class="pmd-btn pmd-menu-row" data-testid="editor-sys-play-btn">Save &amp; Play Level</button>
          <button type="button" class="pmd-btn pmd-menu-row" data-testid="editor-sys-drawer-btn">Open Palette Drawer</button>
          <button type="button" class="pmd-btn pmd-btn-danger pmd-menu-row" data-testid="editor-sys-reset-btn">Reset Level to Default</button>
          <button type="button" class="pmd-btn pmd-btn-danger pmd-menu-row" data-testid="editor-sys-exit-btn">Exit to Dev Tools</button>
          <button type="button" class="pmd-btn pmd-menu-row" data-testid="editor-sys-resume-btn">Resume Editing</button>
        </div>
      </div>
    `;

    // JSON Import / Export Modal
    this.jsonModalBackdropEl = document.createElement('div');
    this.jsonModalBackdropEl.className = 'pmd-battle-modal-backdrop';
    this.jsonModalBackdropEl.dataset.testid = 'editor-json-modal';
    this.jsonModalBackdropEl.hidden = true;
    this.jsonModalBackdropEl.innerHTML = `
      <div class="pmd-window pmd-battle-export-dialog" role="dialog" aria-modal="true" aria-labelledby="editor-json-title">
        <h3 id="editor-json-title" class="pmd-panel-title">IMPORT / EXPORT MAP JSON</h3>
        <p class="pmd-panel-sub">Copy this level's DungeonMapDefinition JSON or paste edited JSON to apply &amp; save.</p>
        <textarea class="pmd-textarea" rows="8" data-testid="editor-json-textarea"></textarea>
        <p class="pmd-subcard-text" data-testid="editor-json-status" hidden></p>
        <div class="pmd-inline-btns">
          <button type="button" class="pmd-btn pmd-btn-primary" data-testid="editor-json-apply-btn">Import &amp; Save JSON</button>
          <button type="button" class="pmd-btn" data-testid="editor-json-copy-btn">Copy JSON</button>
          <button type="button" class="pmd-btn" data-testid="editor-json-close-btn">Close</button>
        </div>
      </div>
    `;
    this.jsonTextareaEl = this.jsonModalBackdropEl.querySelector<HTMLTextAreaElement>(
      '[data-testid="editor-json-textarea"]'
    )!;
    this.jsonStatusEl = this.jsonModalBackdropEl.querySelector<HTMLElement>(
      '[data-testid="editor-json-status"]'
    )!;

    this.rootEl.append(
      this.canvasStageEl,
      this.topHudBarEl,
      this.toastBannerEl,
      this.infoStripEl,
      this.drawerEl,
      this.systemMenuBackdropEl,
      this.jsonModalBackdropEl
    );
    this.viewportEl.appendChild(this.rootEl);

    this.populateStaticControls();
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
    return this.jsonModalOpen || this.systemMenuOpen || this.drawerOpen;
  }

  public async open(levelId = 'drenched_bluff_vanguard', options?: { startDrawerOpen?: boolean }): Promise<void> {
    if (!this.openState) {
      this.previousBgmId = this.audioManager.getCurrentTrackId();
    }
    this.openState = true;
    this.drawerOpen = options?.startDrawerOpen ?? true;
    this.systemMenuOpen = false;
    this.jsonModalOpen = false;
    this.systemMenuBackdropEl.hidden = true;
    this.jsonModalBackdropEl.hidden = true;
    this.drawerEl.hidden = !this.drawerOpen;

    this.rootEl.hidden = false;
    this.viewportEl.classList.add('is-battle-active');

    this.syncViewportDimensions();
    await this.selectLevel(levelId, { resetGroupFilter: true, recenterCamera: true });

    this.startLoop();
    this.onLayerStateChanged();
    this.renderFrame();
  }

  public close(): void {
    if (!this.openState) return;
    this.openState = false;
    this.stopLoop();
    this.systemMenuOpen = false;
    this.jsonModalOpen = false;
    this.systemMenuBackdropEl.hidden = true;
    this.jsonModalBackdropEl.hidden = true;
    this.rootEl.hidden = true;
    this.viewportEl.classList.remove('is-battle-active');

    if (this.previousBgmId) {
      this.audioManager.playBgm(this.previousBgmId, { fadeMs: 260 });
    } else {
      this.audioManager.playBgm('top_menu', { fadeMs: 260 });
    }

    this.onLayerStateChanged();
    this.onExitCallback();
  }

  public destroy(): void {
    this.stopLoop();
    if (this.toastTimer !== null) {
      window.clearTimeout(this.toastTimer);
      this.toastTimer = null;
    }
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    this.abortController.abort();
    this.viewportEl.classList.remove('is-battle-active');
    this.rootEl.remove();
  }

  public handleMenuOrBack(): void {
    if (!this.openState) return;
    if (this.jsonModalOpen) {
      this.audioManager.playSfx('cancel');
      this.jsonModalOpen = false;
      this.jsonModalBackdropEl.hidden = true;
      this.onLayerStateChanged();
      return;
    }
    if (this.systemMenuOpen) {
      this.audioManager.playSfx('cancel');
      this.systemMenuOpen = false;
      this.systemMenuBackdropEl.hidden = true;
      this.onLayerStateChanged();
      return;
    }
    if (this.drawerOpen) {
      this.audioManager.playSfx('cancel');
      this.setDrawerOpen(false);
      return;
    }
    this.audioManager.playSfx('select');
    this.systemMenuOpen = true;
    this.systemMenuBackdropEl.hidden = false;
    this.onLayerStateChanged();
  }

  // ==========================================================================
  // Public Programmatic & Verification Helpers
  // ==========================================================================

  public async selectLevel(
    levelId: string,
    opts?: { resetGroupFilter?: boolean; recenterCamera?: boolean }
  ): Promise<void> {
    const entry = getChapterCatalogEntry(levelId) ?? CHAPTER_LEVEL_CATALOG[0]!;
    this.activeLevelId = entry.id;
    if (opts?.resetGroupFilter) {
      this.activeGroupFilter = 'all';
      this.renderLevelSelectOptions();
    }
    this.levelSelectEl.value = this.activeLevelId;

    this.map = getEffectiveChapterMap(this.activeLevelId);
    this.undoStack = [];
    this.dirty = false;

    // Default the chunk sheet to the chapter's signature tileset so Drenched Bluff opens on #003
    const preferredSheet = normalizeTilesetId(entry.primaryTilesetId);
    this.brushTilesetId = preferredSheet;
    this.tilesetSelectEl.value = preferredSheet;

    this.inspectedTile = {
      x: this.map.playerSpawns[0]?.x ?? Math.floor(this.map.width / 2),
      y: this.map.playerSpawns[0]?.y ?? Math.floor(this.map.height / 2),
    };

    this.syncUiControls();
    this.updateInfoStrip();

    if (opts?.recenterCamera !== false) {
      this.centerCameraOnTile(
        Math.floor(this.map.width / 2),
        Math.floor(this.map.height / 2)
      );
    }

    if (this.openState && this.map.bgmCue) {
      this.audioManager.playBgm(this.map.bgmCue, { fadeMs: 280 });
    }

    await Promise.all([
      this.preloadMapAndUnitAssets(),
      this.refreshChunkPalette(),
    ]);
    this.renderFrame();
  }

  public setDrawerOpen(open: boolean): void {
    this.drawerOpen = open;
    this.drawerEl.hidden = !open;
    this.hudPaletteBtnEl.classList.toggle('is-active', open);
    this.onLayerStateChanged();
  }

  public setToolMode(mode: MapEditorToolMode): void {
    this.toolMode = mode;
    this.syncUiControls();
    this.updateInfoStrip();
  }

  public setBrush(brush: {
    terrainType?: TerrainType;
    tilesetId?: string;
    chunkIndex?: number;
  }): void {
    if (brush.terrainType) {
      this.brushTerrainType = brush.terrainType;
    }
    if (brush.tilesetId) {
      this.brushTilesetId = normalizeTilesetId(brush.tilesetId);
      this.tilesetSelectEl.value = this.brushTilesetId;
      void this.refreshChunkPalette();
    }
    if (typeof brush.chunkIndex === 'number') {
      this.brushChunkIndex = Math.max(0, Math.min(399, Math.floor(brush.chunkIndex)));
      this.highlightSelectedChunkCell();
    }
    this.syncUiControls();
    this.updateInfoStrip();
  }

  public paintTileAt(tx: number, ty: number, pushUndo = true): boolean {
    if (tx < 0 || ty < 0 || tx >= this.map.width || ty >= this.map.height) return false;
    const existing = this.map.tiles[ty]?.[tx];
    if (
      existing &&
      existing.terrainType === this.brushTerrainType &&
      existing.tilesetId === this.brushTilesetId &&
      existing.chunkIndex === this.brushChunkIndex
    ) {
      return false;
    }
    if (pushUndo) {
      this.pushUndoSnapshot();
    }
    this.map.tiles[ty]![tx] = {
      terrainType: this.brushTerrainType,
      tilesetId: this.brushTilesetId,
      chunkIndex: this.brushChunkIndex,
    };
    this.dirty = true;
    this.inspectedTile = { x: tx, y: ty };
    void this.ensureTilesetLoaded(this.brushTilesetId).then(() => this.renderFrame());
    this.syncUiControls();
    this.updateInfoStrip();
    this.renderFrame();
    return true;
  }

  public undo(): boolean {
    const prev = this.undoStack.pop();
    if (!prev) return false;
    this.map = prev;
    this.dirty = true;
    this.syncUiControls();
    this.updateInfoStrip();
    void this.preloadMapAndUnitAssets().then(() => this.renderFrame());
    this.renderFrame();
    return true;
  }

  public saveCurrentMapToGame(): DungeonMapDefinition {
    const saved = saveChapterMapOverride(this.activeLevelId, this.map);
    this.map = cloneDungeonMap(saved);
    this.dirty = false;
    this.syncUiControls();
    this.updateInfoStrip();
    const isSignedIn = Boolean(this.saveManager.getSyncStatus().user);
    this.showToast(
      isSignedIn
        ? `SAVED — ${this.map.name} (Syncing to Cloud...)`
        : `SAVED LOCALLY — ${this.map.name}`
    );
    void this.saveManager.syncCustomMapsWithActiveSave().then((res) => {
      if (!this.openState) return;
      if (res === 'pushed_newer_local') {
        this.showToast(`SAVED & SYNCED TO CLOUD — ${this.map.name}`);
      } else if (res === 'cloud_error') {
        const err = this.saveManager.getSyncStatus().errorMessage ?? 'Sync error';
        this.showToast(`SAVED LOCALLY (Cloud Error: ${err})`);
      }
    });
    this.renderFrame();
    return saved;
  }

  public resetCurrentMapToDefault(): DungeonMapDefinition {
    this.pushUndoSnapshot();
    const def = resetChapterMapOverride(this.activeLevelId);
    this.map = cloneDungeonMap(def);
    this.dirty = false;
    this.syncUiControls();
    this.updateInfoStrip();
    void this.preloadMapAndUnitAssets().then(() => this.renderFrame());
    const isSignedIn = Boolean(this.saveManager.getSyncStatus().user);
    this.showToast(isSignedIn ? 'RESET TO DEFAULT (Syncing Cloud...)' : 'RESET TO DEFAULT MAP');
    void this.saveManager.syncCustomMapsWithActiveSave().then((res) => {
      if (!this.openState) return;
      if (res === 'pushed_newer_local') {
        this.showToast('RESET TO DEFAULT & SYNCED TO CLOUD');
      }
    });
    this.renderFrame();
    return def;
  }

  public centerCameraOnTile(tx: number, ty: number): void {
    const targetWorldX =
      tx * PMD_TILE_NATIVE_PX + PMD_TILE_NATIVE_PX / 2 - this.bufferWidth / 2;
    const targetWorldY =
      ty * PMD_TILE_NATIVE_PX + PMD_TILE_NATIVE_PX / 2 - this.bufferHeight / 2;
    this.setCameraPosition(targetWorldX, targetWorldY);
    this.renderFrame();
  }

  public getTileClientCenter(tx: number, ty: number): { clientX: number; clientY: number } {
    const rect = this.canvas.getBoundingClientRect();
    const worldCenterX = tx * PMD_TILE_NATIVE_PX + PMD_TILE_NATIVE_PX / 2;
    const worldCenterY = ty * PMD_TILE_NATIVE_PX + PMD_TILE_NATIVE_PX / 2;
    return {
      clientX: rect.left + (worldCenterX - this.cameraX) * EDITOR_TILE_SCALE,
      clientY: rect.top + (worldCenterY - this.cameraY) * EDITOR_TILE_SCALE,
    };
  }

  public getMap(): DungeonMapDefinition {
    return cloneDungeonMap(this.map);
  }

  public getSnapshot(): ChapterMapEditorSnapshot {
    return {
      isOpen: this.openState,
      levelId: this.activeLevelId,
      mapName: this.map.name,
      width: this.map.width,
      height: this.map.height,
      deploymentCap:
        this.map.deploymentCap ?? Math.max(1, this.map.playerSpawns.length),
      playerSpawnCount: this.map.playerSpawns.length,
      enemySpawnCount: this.map.enemySpawns.length,
      isCustomizedInStore: hasChapterMapOverride(this.activeLevelId),
      hasUnsavedChanges: this.dirty,
      toolMode: this.toolMode,
      drawerOpen: this.drawerOpen,
      systemMenuOpen: this.systemMenuOpen,
      jsonModalOpen: this.jsonModalOpen,
      showGrid: this.showGrid,
      showSpawns: this.showSpawns,
      undoCount: this.undoStack.length,
      brush: {
        terrainType: this.brushTerrainType,
        tilesetId: this.brushTilesetId,
        chunkIndex: this.brushChunkIndex,
      },
      camera: {
        x: this.cameraX,
        y: this.cameraY,
        displayScale: EDITOR_TILE_SCALE,
        imageSmoothingEnabled: this.ctx.imageSmoothingEnabled,
      },
    };
  }

  // ==========================================================================
  // Control Population & Pointer Event Wiring (Rule 2: Zero Keyboard Listeners)
  // ==========================================================================

  private populateStaticControls(): void {
    // 1. Group Filter Chips
    this.levelGroupRowEl.innerHTML = '';
    for (const grp of GROUP_FILTERS) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `pmd-btn pmd-chip-btn${grp.id === this.activeGroupFilter ? ' is-active' : ''}`;
      btn.dataset.groupFilter = grp.id;
      btn.dataset.testid = `editor-group-${grp.id}`;
      btn.textContent = grp.label;
      bindPointerTap(
        btn,
        () => {
          this.audioManager.playSfx('select');
          this.activeGroupFilter = grp.id;
          this.renderLevelSelectOptions();
          const firstMatch = CHAPTER_LEVEL_CATALOG.find(
            (c) => grp.id === 'all' || c.group === grp.id
          );
          if (
            firstMatch &&
            !CHAPTER_LEVEL_CATALOG.some(
              (c) =>
                c.id === this.activeLevelId && (grp.id === 'all' || c.group === grp.id)
            )
          ) {
            void this.selectLevel(firstMatch.id, { resetGroupFilter: false, recenterCamera: true });
          } else {
            this.syncUiControls();
          }
        },
        { signal: this.abortController.signal }
      );
      this.levelGroupRowEl.appendChild(btn);
    }

    this.renderLevelSelectOptions();

    // 2. Enemy Species Select (Rule 5: strictly non-playable enemy/shared species)
    this.enemySpeciesSelectEl.innerHTML = '';
    for (const sp of POKEMON_SPECIES_LIST) {
      if (sp.faction === 'playable') continue;
      const opt = document.createElement('option');
      opt.value = sp.id;
      opt.textContent = `${sp.name} (Stage ${sp.stage} · ${sp.types.join('/')})`;
      this.enemySpeciesSelectEl.appendChild(opt);
    }
    this.enemySpeciesSelectEl.value = this.spawnEnemySpeciesId;

    // 3. Quick Biome Presets
    const presetsContainer = this.drawerEl.querySelector<HTMLElement>(
      '[data-editor-biome-presets]'
    )!;
    presetsContainer.innerHTML = '';
    for (const preset of BIOME_BRUSH_PRESETS) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'pmd-btn pmd-chip-btn';
      btn.dataset.testid = `editor-biome-preset-${preset.id}`;
      btn.textContent = preset.label;
      bindPointerTap(
        btn,
        () => {
          this.audioManager.playSfx('select');
          if (
            this.toolMode !== 'paint' &&
            this.toolMode !== 'stroke'
          ) {
            this.toolMode = 'paint';
          }
          this.setBrush({
            terrainType: preset.terrainType,
            tilesetId: preset.tilesetId,
            chunkIndex: preset.chunkIndex,
          });
        },
        { signal: this.abortController.signal }
      );
      presetsContainer.appendChild(btn);
    }

    // 4. Independent Gameplay Terrain Type Chips (10 Types)
    const terrainContainer = this.drawerEl.querySelector<HTMLElement>(
      '[data-editor-terrain-chips]'
    )!;
    terrainContainer.innerHTML = '';
    for (const tType of TERRAIN_TYPES) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `pmd-btn pmd-chip-btn${tType === this.brushTerrainType ? ' is-active' : ''}`;
      btn.dataset.editorTerrain = tType;
      btn.dataset.testid = `editor-terrain-${tType}`;
      btn.textContent = TERRAIN_METADATA[tType].shortLabel;
      bindPointerTap(
        btn,
        () => {
          this.audioManager.playSfx('select');
          if (this.toolMode !== 'paint' && this.toolMode !== 'stroke') {
            this.toolMode = 'paint';
          }
          // Intentionally preserves brushTilesetId & brushChunkIndex so any chunk can carry any rule!
          this.setBrush({ terrainType: tType });
        },
        { signal: this.abortController.signal }
      );
      terrainContainer.appendChild(btn);
    }

    // 5. All 144 EoS Tileset Sheets (`#000`..`#143`)
    this.tilesetSelectEl.innerHTML = '';
    for (const ts of PMD_TILESET_LIST) {
      const opt = document.createElement('option');
      opt.value = ts.id;
      opt.textContent = ts.label;
      this.tilesetSelectEl.appendChild(opt);
    }
    this.tilesetSelectEl.value = this.brushTilesetId;
  }

  private renderLevelSelectOptions(): void {
    this.levelSelectEl.innerHTML = '';
    for (const item of CHAPTER_LEVEL_CATALOG) {
      if (this.activeGroupFilter !== 'all' && item.group !== this.activeGroupFilter) {
        continue;
      }
      const opt = document.createElement('option');
      opt.value = item.id;
      const customizedSuffix = hasChapterMapOverride(item.id) ? ' ★ [Custom]' : '';
      opt.textContent = `${item.label}${customizedSuffix}`;
      this.levelSelectEl.appendChild(opt);
    }
    if ([...this.levelSelectEl.options].some((o) => o.value === this.activeLevelId)) {
      this.levelSelectEl.value = this.activeLevelId;
    }

    this.levelGroupRowEl.querySelectorAll<HTMLElement>('[data-group-filter]').forEach((btn) => {
      btn.classList.toggle('is-active', btn.dataset.groupFilter === this.activeGroupFilter);
    });
  }

  private bindPointerInteractions(): void {
    const signal = this.abortController.signal;

    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => {
        if (!this.openState) return;
        this.syncViewportDimensions();
        this.renderFrame();
      });
      this.resizeObserver.observe(this.canvasStageEl);
    }

    // Top HUD Buttons
    bindPointerTap(
      this.hudPaletteBtnEl,
      () => {
        this.audioManager.playSfx('select');
        this.setDrawerOpen(!this.drawerOpen);
      },
      { signal, stopPropagation: true }
    );

    bindPointerTap(
      this.hudToolBtnEl,
      () => {
        this.audioManager.playSfx('select');
        const cycle: MapEditorToolMode[] = ['paint', 'stroke', 'eyedropper', 'pan'];
        const idx = cycle.indexOf(this.toolMode);
        const next = cycle[(idx + 1) % cycle.length] ?? 'paint';
        this.setToolMode(next);
      },
      { signal, stopPropagation: true }
    );

    bindPointerTap(
      this.hudUndoBtnEl,
      () => {
        if (this.undo()) {
          this.audioManager.playSfx('cancel');
          this.showToast('UNDO');
        }
      },
      { signal, stopPropagation: true }
    );

    bindPointerTap(
      this.hudSaveBtnEl,
      () => {
        this.audioManager.playSfx('select');
        this.saveCurrentMapToGame();
      },
      { signal, stopPropagation: true }
    );

    bindPointerTap(
      this.hudPlayBtnEl,
      () => {
        this.audioManager.playSfx('select');
        this.saveCurrentMapToGame();
        const targetId = this.activeLevelId;
        this.openState = false;
        this.stopLoop();
        this.rootEl.hidden = true;
        this.viewportEl.classList.remove('is-battle-active');
        this.onPlayLevelCallback(targetId);
      },
      { signal, stopPropagation: true }
    );

    // Drawer Controls
    bindPointerTap(
      this.drawerEl.querySelector<HTMLElement>('[data-testid="editor-drawer-close-btn"]'),
      () => {
        this.audioManager.playSfx('cancel');
        this.setDrawerOpen(false);
      },
      { signal }
    );

    this.levelSelectEl.addEventListener(
      'change',
      () => {
        this.audioManager.playSfx('select');
        void this.selectLevel(this.levelSelectEl.value, {
          resetGroupFilter: false,
          recenterCamera: true,
        });
      },
      { signal }
    );

    bindPointerTap(
      this.drawerEl.querySelector<HTMLElement>('[data-testid="editor-save-btn"]'),
      () => {
        this.audioManager.playSfx('select');
        this.saveCurrentMapToGame();
      },
      { signal }
    );

    bindPointerTap(
      this.drawerEl.querySelector<HTMLElement>('[data-testid="editor-save-play-btn"]'),
      () => {
        this.audioManager.playSfx('select');
        this.saveCurrentMapToGame();
        const targetId = this.activeLevelId;
        this.openState = false;
        this.stopLoop();
        this.rootEl.hidden = true;
        this.viewportEl.classList.remove('is-battle-active');
        this.onPlayLevelCallback(targetId);
      },
      { signal }
    );

    bindPointerTap(
      this.drawerEl.querySelector<HTMLElement>('[data-testid="editor-reset-default-btn"]'),
      () => {
        this.audioManager.playSfx('cancel');
        this.resetCurrentMapToDefault();
      },
      { signal }
    );

    bindPointerTap(
      this.drawerEl.querySelector<HTMLElement>('[data-testid="editor-json-modal-btn"]'),
      () => {
        this.audioManager.playSfx('select');
        this.openJsonModal();
      },
      { signal }
    );

    // Tool Mode Buttons
    this.drawerEl.querySelectorAll<HTMLElement>('[data-editor-tool]').forEach((btn) => {
      bindPointerTap(
        btn,
        () => {
          const tool = btn.dataset.editorTool as MapEditorToolMode | undefined;
          if (!tool) return;
          this.audioManager.playSfx('select');
          this.setToolMode(tool);
        },
        { signal }
      );
    });

    // Enemy Spawn Controls
    this.enemySpeciesSelectEl.addEventListener(
      'change',
      () => {
        this.spawnEnemySpeciesId = this.enemySpeciesSelectEl.value;
        void this.ensureSpriteBundle(this.spawnEnemySpeciesId);
      },
      { signal }
    );

    bindPointerTap(
      this.drawerEl.querySelector<HTMLElement>('[data-testid="editor-enemy-lv-dec"]'),
      () => {
        this.spawnEnemyLevel = Math.max(1, this.spawnEnemyLevel - 1);
        this.enemyLevelValEl.textContent = String(this.spawnEnemyLevel);
      },
      { signal }
    );

    bindPointerTap(
      this.drawerEl.querySelector<HTMLElement>('[data-testid="editor-enemy-lv-inc"]'),
      () => {
        this.spawnEnemyLevel = Math.min(40, this.spawnEnemyLevel + 1);
        this.enemyLevelValEl.textContent = String(this.spawnEnemyLevel);
      },
      { signal }
    );

    // View Toggles
    bindPointerTap(
      this.gridToggleBtnEl,
      () => {
        this.audioManager.playSfx('select');
        this.showGrid = !this.showGrid;
        this.syncUiControls();
        this.renderFrame();
      },
      { signal }
    );

    bindPointerTap(
      this.spawnsToggleBtnEl,
      () => {
        this.audioManager.playSfx('select');
        this.showSpawns = !this.showSpawns;
        this.syncUiControls();
        this.renderFrame();
      },
      { signal }
    );

    // Tileset Select
    this.tilesetSelectEl.addEventListener(
      'change',
      () => {
        this.brushTilesetId = normalizeTilesetId(this.tilesetSelectEl.value);
        void this.refreshChunkPalette().then(() => {
          this.syncUiControls();
          this.updateInfoStrip();
        });
      },
      { signal }
    );

    // Map Dimensions & Deployment Cap Controls
    bindPointerTap(
      this.drawerEl.querySelector<HTMLElement>('[data-testid="editor-width-dec"]'),
      () => this.resizeMap(this.map.width - 1, this.map.height),
      { signal }
    );
    bindPointerTap(
      this.drawerEl.querySelector<HTMLElement>('[data-testid="editor-width-inc"]'),
      () => this.resizeMap(this.map.width + 1, this.map.height),
      { signal }
    );
    bindPointerTap(
      this.drawerEl.querySelector<HTMLElement>('[data-testid="editor-height-dec"]'),
      () => this.resizeMap(this.map.width, this.map.height - 1),
      { signal }
    );
    bindPointerTap(
      this.drawerEl.querySelector<HTMLElement>('[data-testid="editor-height-inc"]'),
      () => this.resizeMap(this.map.width, this.map.height + 1),
      { signal }
    );
    bindPointerTap(
      this.drawerEl.querySelector<HTMLElement>('[data-testid="editor-cap-dec"]'),
      () => this.adjustDeploymentCap(-1),
      { signal }
    );
    bindPointerTap(
      this.drawerEl.querySelector<HTMLElement>('[data-testid="editor-cap-inc"]'),
      () => this.adjustDeploymentCap(1),
      { signal }
    );
    bindPointerTap(
      this.drawerEl.querySelector<HTMLElement>('[data-testid="editor-exit-btn"]'),
      () => {
        this.audioManager.playSfx('cancel');
        this.close();
      },
      { signal }
    );

    // Stop pointer events inside Drawer / Modals from bubbling to the canvas stage
    for (const el of [this.drawerEl, this.systemMenuBackdropEl, this.jsonModalBackdropEl]) {
      el.addEventListener(
        'pointerdown',
        (ev) => {
          ev.stopPropagation();
        },
        { signal }
      );
    }

    // System Menu Modal Buttons
    bindPointerTap(
      this.systemMenuBackdropEl.querySelector<HTMLElement>('[data-testid="editor-sys-save-btn"]'),
      () => {
        this.audioManager.playSfx('select');
        this.saveCurrentMapToGame();
        this.systemMenuOpen = false;
        this.systemMenuBackdropEl.hidden = true;
        this.onLayerStateChanged();
      },
      { signal }
    );
    bindPointerTap(
      this.systemMenuBackdropEl.querySelector<HTMLElement>('[data-testid="editor-sys-play-btn"]'),
      () => {
        this.audioManager.playSfx('select');
        this.saveCurrentMapToGame();
        const targetId = this.activeLevelId;
        this.systemMenuOpen = false;
        this.systemMenuBackdropEl.hidden = true;
        this.openState = false;
        this.stopLoop();
        this.rootEl.hidden = true;
        this.viewportEl.classList.remove('is-battle-active');
        this.onPlayLevelCallback(targetId);
      },
      { signal }
    );
    bindPointerTap(
      this.systemMenuBackdropEl.querySelector<HTMLElement>('[data-testid="editor-sys-drawer-btn"]'),
      () => {
        this.audioManager.playSfx('select');
        this.systemMenuOpen = false;
        this.systemMenuBackdropEl.hidden = true;
        this.setDrawerOpen(true);
      },
      { signal }
    );
    bindPointerTap(
      this.systemMenuBackdropEl.querySelector<HTMLElement>('[data-testid="editor-sys-reset-btn"]'),
      () => {
        this.audioManager.playSfx('cancel');
        this.resetCurrentMapToDefault();
        this.systemMenuOpen = false;
        this.systemMenuBackdropEl.hidden = true;
        this.onLayerStateChanged();
      },
      { signal }
    );
    bindPointerTap(
      this.systemMenuBackdropEl.querySelector<HTMLElement>('[data-testid="editor-sys-exit-btn"]'),
      () => {
        this.audioManager.playSfx('cancel');
        this.close();
      },
      { signal }
    );
    bindPointerTap(
      this.systemMenuBackdropEl.querySelector<HTMLElement>('[data-testid="editor-sys-resume-btn"]'),
      () => {
        this.audioManager.playSfx('cancel');
        this.systemMenuOpen = false;
        this.systemMenuBackdropEl.hidden = true;
        this.onLayerStateChanged();
      },
      { signal }
    );

    // JSON Modal Buttons
    bindPointerTap(
      this.jsonModalBackdropEl.querySelector<HTMLElement>('[data-testid="editor-json-apply-btn"]'),
      () => {
        try {
          const parsed = JSON.parse(this.jsonTextareaEl.value) as unknown;
          const v = validateDungeonMapDefinition(parsed, this.activeLevelId);
          if (!v.valid || !v.map) {
            this.jsonStatusEl.textContent = `Validation failed: ${v.errors.join(' ')}`;
            this.jsonStatusEl.hidden = false;
            return;
          }
          this.pushUndoSnapshot();
          this.map = cloneDungeonMap(v.map);
          this.saveCurrentMapToGame();
          this.jsonModalOpen = false;
          this.jsonModalBackdropEl.hidden = true;
          this.onLayerStateChanged();
          void this.preloadMapAndUnitAssets().then(() => this.renderFrame());
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Invalid JSON';
          this.jsonStatusEl.textContent = `JSON error: ${msg}`;
          this.jsonStatusEl.hidden = false;
        }
      },
      { signal }
    );

    bindPointerTap(
      this.jsonModalBackdropEl.querySelector<HTMLElement>('[data-testid="editor-json-copy-btn"]'),
      () => {
        if (navigator.clipboard?.writeText) {
          void navigator.clipboard.writeText(this.jsonTextareaEl.value);
        }
        this.jsonStatusEl.textContent = 'Copied map JSON to clipboard.';
        this.jsonStatusEl.hidden = false;
      },
      { signal }
    );

    bindPointerTap(
      this.jsonModalBackdropEl.querySelector<HTMLElement>('[data-testid="editor-json-close-btn"]'),
      () => {
        this.audioManager.playSfx('cancel');
        this.jsonModalOpen = false;
        this.jsonModalBackdropEl.hidden = true;
        this.onLayerStateChanged();
      },
      { signal }
    );

    // Unified Pointer Events on Dungeon Canvas Stage (Pan + Tap Paint + Continuous Stroke)
    this.canvasStageEl.addEventListener(
      'pointerdown',
      (ev: PointerEvent) => {
        if (!this.openState) return;
        if (ev.pointerType === 'mouse' && ev.button !== 0) return;

        this.activePointerId = ev.pointerId;
        this.pointerStartX = ev.clientX;
        this.pointerStartY = ev.clientY;
        this.pointerStartCamX = this.cameraX;
        this.pointerStartCamY = this.cameraY;
        this.pointerMoved = false;
        this.strokeUndoPushed = false;
        this.lastStrokedCoordKey = null;

        try {
          this.canvasStageEl.setPointerCapture(ev.pointerId);
        } catch {
          // Synthetic pointer events in tests may omit capture support
        }

        if (this.toolMode === 'stroke') {
          const tile = this.clientPointToTile(ev.clientX, ev.clientY);
          if (tile) {
            this.applyStrokeAtTile(tile.x, tile.y);
          }
        }
      },
      { signal }
    );

    this.canvasStageEl.addEventListener(
      'pointermove',
      (ev: PointerEvent) => {
        if (!this.openState) return;

        if (this.activePointerId === null && ev.pointerType === 'mouse') {
          const hover = this.clientPointToTile(ev.clientX, ev.clientY);
          if (
            hover?.x !== this.hoveredTile?.x ||
            hover?.y !== this.hoveredTile?.y
          ) {
            this.hoveredTile = hover;
            this.renderFrame();
          }
          return;
        }

        if (ev.pointerId !== this.activePointerId) return;

        if (this.toolMode === 'stroke') {
          const tile = this.clientPointToTile(ev.clientX, ev.clientY);
          if (tile) {
            this.hoveredTile = tile;
            this.applyStrokeAtTile(tile.x, tile.y);
          }
          return;
        }

        const dx = ev.clientX - this.pointerStartX;
        const dy = ev.clientY - this.pointerStartY;
        if (!this.pointerMoved && Math.hypot(dx, dy) > DRAG_THRESHOLD_PX) {
          this.pointerMoved = true;
        }
        if (this.pointerMoved) {
          this.setCameraPosition(
            this.pointerStartCamX - dx / EDITOR_TILE_SCALE,
            this.pointerStartCamY - dy / EDITOR_TILE_SCALE
          );
          this.renderFrame();
        }
      },
      { signal }
    );

    const finishPointer = (ev: PointerEvent, cancelled: boolean) => {
      if (ev.pointerId !== this.activePointerId) return;
      const wasDrag = this.pointerMoved;
      const usedStroke = this.toolMode === 'stroke';
      this.activePointerId = null;
      this.pointerMoved = false;
      this.strokeUndoPushed = false;
      this.lastStrokedCoordKey = null;

      try {
        if (this.canvasStageEl.hasPointerCapture(ev.pointerId)) {
          this.canvasStageEl.releasePointerCapture(ev.pointerId);
        }
      } catch {
        // Ignore
      }

      if (cancelled || wasDrag || usedStroke) return;
      const tile = this.clientPointToTile(ev.clientX, ev.clientY);
      if (tile) {
        this.handleTileTap(tile.x, tile.y);
      }
    };

    this.canvasStageEl.addEventListener(
      'pointerup',
      (ev: PointerEvent) => finishPointer(ev, false),
      { signal }
    );
    this.canvasStageEl.addEventListener(
      'pointercancel',
      (ev: PointerEvent) => finishPointer(ev, true),
      { signal }
    );
  }

  // ==========================================================================
  // Editing Operations (Paint, Stroke, Eyedropper, Spawns, Resize, Undo)
  // ==========================================================================

  private pushUndoSnapshot(): void {
    this.undoStack.push(cloneDungeonMap(this.map));
    if (this.undoStack.length > MAX_UNDO_STEPS) {
      this.undoStack.shift();
    }
  }

  private applyStrokeAtTile(tx: number, ty: number): void {
    const key = `${tx},${ty}`;
    if (this.lastStrokedCoordKey === key) return;
    this.lastStrokedCoordKey = key;

    if (tx < 0 || ty < 0 || tx >= this.map.width || ty >= this.map.height) return;
    const cell = this.map.tiles[ty]?.[tx];
    if (
      cell &&
      cell.terrainType === this.brushTerrainType &&
      cell.tilesetId === this.brushTilesetId &&
      cell.chunkIndex === this.brushChunkIndex
    ) {
      return;
    }

    if (!this.strokeUndoPushed) {
      this.pushUndoSnapshot();
      this.strokeUndoPushed = true;
    }
    this.paintTileAt(tx, ty, false);
  }

  private handleTileTap(tx: number, ty: number): void {
    this.inspectedTile = { x: tx, y: ty };

    if (this.toolMode === 'pan') {
      this.updateInfoStrip();
      this.renderFrame();
      return;
    }

    if (this.toolMode === 'eyedropper') {
      const cell = this.map.tiles[ty]?.[tx];
      if (!cell) return;
      this.audioManager.playSfx('select');
      this.setBrush({
        terrainType: cell.terrainType,
        tilesetId: cell.tilesetId,
        chunkIndex: cell.chunkIndex,
      });
      this.toolMode = 'paint';
      this.syncUiControls();
      this.showToast(
        `PICKED ${TERRAIN_METADATA[cell.terrainType].shortLabel.toUpperCase()} (#${cell.tilesetId}:${cell.chunkIndex})`
      );
      this.renderFrame();
      return;
    }

    if (this.toolMode === 'player_spawn') {
      this.togglePlayerSpawnAt(tx, ty);
      return;
    }

    if (this.toolMode === 'enemy_spawn') {
      this.toggleEnemySpawnAt(tx, ty);
      return;
    }

    // Default `paint` mode
    if (this.paintTileAt(tx, ty, true)) {
      this.audioManager.playSfx('select');
    } else {
      this.updateInfoStrip();
      this.renderFrame();
    }
  }

  private togglePlayerSpawnAt(tx: number, ty: number): void {
    const existingIdx = this.map.playerSpawns.findIndex((s) => s.x === tx && s.y === ty);
    if (existingIdx >= 0) {
      if (this.map.playerSpawns.length <= 1) {
        this.showToast('Map requires at least 1 Blue Starting Tile');
        return;
      }
      this.pushUndoSnapshot();
      this.map.playerSpawns.splice(existingIdx, 1);
      if ((this.map.deploymentCap ?? 1) > this.map.playerSpawns.length) {
        this.map.deploymentCap = this.map.playerSpawns.length;
      }
      this.dirty = true;
      this.audioManager.playSfx('cancel');
      this.syncUiControls();
      this.updateInfoStrip();
      this.renderFrame();
      return;
    }

    if (this.map.playerSpawns.length >= 12) {
      this.showToast('Maximum 12 Blue Starting Tiles');
      return;
    }

    if (this.map.enemySpawns.some((e) => e.x === tx && e.y === ty)) {
      this.showToast('Remove enemy spawn on this tile first');
      return;
    }

    const cell = this.map.tiles[ty]?.[tx];
    this.pushUndoSnapshot();
    if (cell && cell.terrainType === 'wall') {
      this.map.tiles[ty]![tx] = {
        terrainType: 'floor',
        tilesetId: this.brushTilesetId,
        chunkIndex: 59,
      };
    }

    const defaultPool = ['dratini', 'bulbasaur', 'happiny', 'caterpie', 'pidgey', 'duskull'];
    const spId = defaultPool[this.map.playerSpawns.length % defaultPool.length] ?? 'dratini';
    const sp = getSpeciesById(spId);

    this.map.playerSpawns.push({
      x: tx,
      y: ty,
      speciesId: spId,
      level: 1,
      nickname: sp?.name ?? 'Ally',
      heldItemId: null,
    });
    this.map.deploymentCap = Math.min(
      12,
      Math.max(this.map.deploymentCap ?? 1, this.map.playerSpawns.length)
    );
    this.dirty = true;
    this.audioManager.playSfx('select');
    void this.ensureSpriteBundle(spId).then(() => this.renderFrame());
    this.syncUiControls();
    this.updateInfoStrip();
    this.renderFrame();
  }

  private toggleEnemySpawnAt(tx: number, ty: number): void {
    const existingIdx = this.map.enemySpawns.findIndex((e) => e.x === tx && e.y === ty);
    if (existingIdx >= 0) {
      const existing = this.map.enemySpawns[existingIdx]!;
      if (
        existing.speciesId !== this.spawnEnemySpeciesId ||
        existing.level !== this.spawnEnemyLevel
      ) {
        const sp = getSpeciesById(this.spawnEnemySpeciesId);
        if (!sp || sp.faction === 'playable') return;
        this.pushUndoSnapshot();
        this.map.enemySpawns[existingIdx] = {
          ...existing,
          speciesId: sp.id,
          level: this.spawnEnemyLevel,
          nickname: sp.name,
        };
        this.dirty = true;
        this.audioManager.playSfx('select');
        void this.ensureSpriteBundle(sp.id).then(() => this.renderFrame());
        this.syncUiControls();
        this.updateInfoStrip();
        this.renderFrame();
        return;
      }

      if (this.map.enemySpawns.length <= 1) {
        this.showToast('Map requires at least 1 Enemy Spawn');
        return;
      }
      this.pushUndoSnapshot();
      this.map.enemySpawns.splice(existingIdx, 1);
      this.dirty = true;
      this.audioManager.playSfx('cancel');
      this.syncUiControls();
      this.updateInfoStrip();
      this.renderFrame();
      return;
    }

    if (this.map.playerSpawns.some((p) => p.x === tx && p.y === ty)) {
      this.showToast('Cannot place enemy on a Blue Starting Tile');
      return;
    }

    const sp = getSpeciesById(this.spawnEnemySpeciesId);
    if (!sp || sp.faction === 'playable') return;

    this.pushUndoSnapshot();
    const cell = this.map.tiles[ty]?.[tx];
    if (cell && cell.terrainType === 'wall') {
      this.map.tiles[ty]![tx] = {
        terrainType: 'floor',
        tilesetId: this.brushTilesetId,
        chunkIndex: 59,
      };
    }
    this.map.enemySpawns.push({
      x: tx,
      y: ty,
      speciesId: sp.id,
      level: this.spawnEnemyLevel,
      nickname: sp.name,
      heldItemId: null,
    });
    this.dirty = true;
    this.audioManager.playSfx('select');
    void this.ensureSpriteBundle(sp.id).then(() => this.renderFrame());
    this.syncUiControls();
    this.updateInfoStrip();
    this.renderFrame();
  }

  private resizeMap(nextWidth: number, nextHeight: number): void {
    const clampedW = Math.max(10, Math.min(36, Math.floor(nextWidth)));
    const clampedH = Math.max(8, Math.min(26, Math.floor(nextHeight)));
    if (clampedW === this.map.width && clampedH === this.map.height) return;

    this.pushUndoSnapshot();
    const newTiles: DungeonMapTileCell[][] = [];
    for (let y = 0; y < clampedH; y++) {
      const row: DungeonMapTileCell[] = [];
      for (let x = 0; x < clampedW; x++) {
        const isBorder = x === 0 || y === 0 || x === clampedW - 1 || y === clampedH - 1;
        const old = this.map.tiles[y]?.[x];
        if (
          old &&
          !(x === this.map.width - 1 && clampedW > this.map.width && old.terrainType === 'wall') &&
          !(y === this.map.height - 1 && clampedH > this.map.height && old.terrainType === 'wall')
        ) {
          row.push(
            isBorder
              ? { terrainType: 'wall', tilesetId: old.tilesetId, chunkIndex: 1 }
              : { ...old }
          );
        } else {
          row.push(
            isBorder
              ? { terrainType: 'wall', tilesetId: this.brushTilesetId, chunkIndex: 1 }
              : { terrainType: 'floor', tilesetId: this.brushTilesetId, chunkIndex: 59 }
          );
        }
      }
      newTiles.push(row);
    }

    this.map.width = clampedW;
    this.map.height = clampedH;
    this.map.tiles = newTiles;

    for (const p of this.map.playerSpawns) {
      p.x = Math.max(1, Math.min(clampedW - 2, p.x));
      p.y = Math.max(1, Math.min(clampedH - 2, p.y));
      this.map.tiles[p.y]![p.x] = {
        terrainType: 'floor',
        tilesetId: this.brushTilesetId,
        chunkIndex: 59,
      };
    }
    for (const e of this.map.enemySpawns) {
      e.x = Math.max(1, Math.min(clampedW - 2, e.x));
      e.y = Math.max(1, Math.min(clampedH - 2, e.y));
      if (this.map.tiles[e.y]![e.x]!.terrainType === 'wall') {
        this.map.tiles[e.y]![e.x] = {
          terrainType: 'floor',
          tilesetId: this.brushTilesetId,
          chunkIndex: 59,
        };
      }
    }

    this.dirty = true;
    this.audioManager.playSfx('select');
    this.setCameraPosition(this.cameraX, this.cameraY);
    this.syncUiControls();
    this.updateInfoStrip();
    this.renderFrame();
  }

  private adjustDeploymentCap(delta: number): void {
    const maxCap = Math.min(12, Math.max(1, this.map.playerSpawns.length));
    const current = Math.max(1, Math.min(maxCap, this.map.deploymentCap ?? maxCap));
    const next = Math.max(1, Math.min(maxCap, current + delta));
    if (next === current) {
      if (delta > 0 && next >= this.map.playerSpawns.length && next < 12) {
        this.showToast('Add another Blue Spawn tile to raise Deployment Cap further');
      }
      return;
    }
    this.pushUndoSnapshot();
    this.map.deploymentCap = next;
    this.dirty = true;
    this.audioManager.playSfx('select');
    this.syncUiControls();
    this.updateInfoStrip();
  }

  private openJsonModal(): void {
    this.jsonTextareaEl.value = JSON.stringify(this.map, null, 2);
    this.jsonStatusEl.hidden = true;
    this.jsonStatusEl.textContent = '';
    this.jsonModalOpen = true;
    this.jsonModalBackdropEl.hidden = false;
    this.onLayerStateChanged();
  }

  // ==========================================================================
  // Asset Loading & Chunk Palette Rendering
  // ==========================================================================

  private async ensureTilesetLoaded(tilesetId: string): Promise<LoadedTilesetSheet> {
    const norm = normalizeTilesetId(tilesetId);
    const cached = this.loadedSheets.get(norm);
    if (cached) return cached;
    const sheet = await loadTilesetSheet(norm);
    this.loadedSheets.set(norm, sheet);
    return sheet;
  }

  private async ensureSpriteBundle(speciesId: string): Promise<void> {
    if (this.spriteBundles.has(speciesId)) return;
    try {
      const bundle = await loadSpeciesSpriteBundle(speciesId);
      this.spriteBundles.set(speciesId, bundle);
    } catch {
      // Fallback marker will render if unavailable
    }
  }

  private async preloadMapAndUnitAssets(): Promise<void> {
    const sheetIds = new Set<string>([this.brushTilesetId]);
    for (const row of this.map.tiles) {
      for (const cell of row) {
        sheetIds.add(normalizeTilesetId(cell.tilesetId));
      }
    }
    const spIds = new Set<string>([this.spawnEnemySpeciesId]);
    for (const p of this.map.playerSpawns) spIds.add(p.speciesId);
    for (const e of this.map.enemySpawns) spIds.add(e.speciesId);

    await Promise.all([
      ...[...sheetIds].map((id) => this.ensureTilesetLoaded(id)),
      ...[...spIds].map((id) => this.ensureSpriteBundle(id)),
    ]);
  }

  private async refreshChunkPalette(): Promise<void> {
    const requestedId = this.brushTilesetId;
    const sheet = await this.ensureTilesetLoaded(requestedId);
    if (this.brushTilesetId !== requestedId) return;

    this.chunkPaletteEl.innerHTML = '';
    const chunks = sheet.validChunkIndices.slice(0, 140);
    if (!sheet.validChunkSet.has(this.brushChunkIndex) && chunks[0] !== undefined) {
      this.brushChunkIndex = chunks[0];
    }

    for (const chunkIdx of chunks) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `pmd-chunk-cell${chunkIdx === this.brushChunkIndex ? ' is-active' : ''}`;
      btn.dataset.chunkIdx = String(chunkIdx);
      btn.dataset.testid = `editor-chunk-${chunkIdx}`;
      btn.title = `Tileset #${sheet.id} · Chunk ${chunkIdx}`;

      const thumb = document.createElement('canvas');
      thumb.width = PMD_TILE_NATIVE_PX;
      thumb.height = PMD_TILE_NATIVE_PX;
      thumb.className = 'pmd-chunk-thumb pmd-pixelated';
      const tCtx = thumb.getContext('2d');
      if (tCtx) {
        tCtx.imageSmoothingEnabled = false;
        drawTilesetChunk(tCtx, sheet, chunkIdx, 0, 0, PMD_TILE_NATIVE_PX);
      }

      const badge = document.createElement('span');
      badge.className = 'pmd-chunk-idx';
      badge.textContent = String(chunkIdx);

      btn.append(thumb, badge);
      bindPointerTap(
        btn,
        () => {
          this.brushChunkIndex = chunkIdx;
          if (this.toolMode !== 'paint' && this.toolMode !== 'stroke') {
            this.toolMode = 'paint';
          }
          this.highlightSelectedChunkCell();
          this.syncUiControls();
          this.updateInfoStrip();
        },
        { signal: this.abortController.signal }
      );
      this.chunkPaletteEl.appendChild(btn);
    }
  }

  private highlightSelectedChunkCell(): void {
    this.chunkPaletteEl.querySelectorAll<HTMLElement>('[data-chunk-idx]').forEach((cell) => {
      cell.classList.toggle('is-active', Number(cell.dataset.chunkIdx) === this.brushChunkIndex);
    });
  }

  // ==========================================================================
  // UI State Synchronization & Toast / Info Strip
  // ==========================================================================

  private syncUiControls(): void {
    this.renderLevelSelectOptions();

    const isStoredCustom = hasChapterMapOverride(this.activeLevelId);
    if (this.dirty) {
      this.statusBadgeEl.textContent = 'UNSAVED EDITS';
      this.statusBadgeEl.className = 'pmd-editor-status-pill is-unsaved';
    } else if (isStoredCustom) {
      this.statusBadgeEl.textContent = 'CUSTOMIZED ★';
      this.statusBadgeEl.className = 'pmd-editor-status-pill is-custom';
    } else {
      this.statusBadgeEl.textContent = 'DEFAULT';
      this.statusBadgeEl.className = 'pmd-editor-status-pill';
    }

    const toolLabels: Record<MapEditorToolMode, string> = {
      paint: 'Tool: Paint',
      stroke: 'Tool: Stroke',
      eyedropper: 'Tool: Pick',
      player_spawn: 'Tool: Blue',
      enemy_spawn: 'Tool: Enemy',
      pan: 'Tool: Pan',
    };
    this.hudToolBtnEl.textContent = toolLabels[this.toolMode];
    this.hudUndoBtnEl.disabled = this.undoStack.length === 0;
    this.hudUndoBtnEl.textContent =
      this.undoStack.length > 0 ? `Undo (${this.undoStack.length})` : 'Undo';

    this.drawerEl.querySelectorAll<HTMLElement>('[data-editor-tool]').forEach((btn) => {
      btn.classList.toggle('is-active', btn.dataset.editorTool === this.toolMode);
    });
    this.enemyConfigBoxEl.hidden = this.toolMode !== 'enemy_spawn';
    this.enemyLevelValEl.textContent = String(this.spawnEnemyLevel);

    this.drawerEl.querySelectorAll<HTMLElement>('[data-editor-terrain]').forEach((btn) => {
      btn.classList.toggle('is-active', btn.dataset.editorTerrain === this.brushTerrainType);
    });

    this.gridToggleBtnEl.textContent = this.showGrid ? 'Grid: ON' : 'Grid: OFF';
    this.gridToggleBtnEl.classList.toggle('is-active', this.showGrid);

    this.spawnsToggleBtnEl.textContent = this.showSpawns ? 'Spawns: ON' : 'Spawns: OFF';
    this.spawnsToggleBtnEl.classList.toggle('is-active', this.showSpawns);

    const tMeta = TERRAIN_METADATA[this.brushTerrainType];
    this.activeBrushSummaryEl.textContent = `Active Brush: ${tMeta.label} · Sheet #${this.brushTilesetId} · Chunk #${this.brushChunkIndex}`;

    this.mapWidthValEl.textContent = String(this.map.width);
    this.mapHeightValEl.textContent = String(this.map.height);
    const cap = Math.max(
      1,
      Math.min(this.map.deploymentCap ?? this.map.playerSpawns.length, this.map.playerSpawns.length)
    );
    this.deployCapValEl.textContent = `${cap} / ${this.map.playerSpawns.length}`;
  }

  private showToast(text: string): void {
    this.toastBannerEl.textContent = text;
    this.toastBannerEl.hidden = false;
    if (this.toastTimer !== null) {
      window.clearTimeout(this.toastTimer);
    }
    this.toastTimer = window.setTimeout(() => {
      this.toastBannerEl.hidden = true;
      this.toastTimer = null;
    }, 1500);
  }

  private updateInfoStrip(): void {
    const { x, y } = this.inspectedTile;
    const cell = this.map.tiles[y]?.[x];
    const tLabel = cell
      ? `${TERRAIN_METADATA[cell.terrainType].label} (#${cell.tilesetId}:${cell.chunkIndex})`
      : 'Out of bounds';

    const pIdx = this.map.playerSpawns.findIndex((p) => p.x === x && p.y === y);
    const eSpawn = this.map.enemySpawns.find((e) => e.x === x && e.y === y);
    const spawnDesc =
      pIdx >= 0
        ? ` · Blue Spawn P${pIdx + 1}`
        : eSpawn
          ? ` · Enemy: ${eSpawn.nickname ?? eSpawn.speciesId} Lv.${eSpawn.level}`
          : '';

    this.infoStripEl.textContent = `${this.map.name} (${this.map.width}×${this.map.height}) · Tile (${x},${y}): ${tLabel}${spawnDesc} · Brush: ${TERRAIN_METADATA[this.brushTerrainType].shortLabel} (#${this.brushTilesetId}:${this.brushChunkIndex})`;
  }

  // ==========================================================================
  // Camera, Coordinate Math & 2x Pixelated Canvas Rendering
  // ==========================================================================

  private syncViewportDimensions(): void {
    const stageRect = this.canvasStageEl.getBoundingClientRect();
    const stageW = Math.max(240, Math.floor(stageRect.width || window.innerWidth || 960));
    const stageH = Math.max(200, Math.floor(stageRect.height || window.innerHeight || 640));

    const mapWorldW = this.map.width * PMD_TILE_NATIVE_PX;
    const mapWorldH = this.map.height * PMD_TILE_NATIVE_PX;

    const desiredBufW = Math.max(120, Math.floor(stageW / EDITOR_TILE_SCALE));
    const desiredBufH = Math.max(100, Math.floor(stageH / EDITOR_TILE_SCALE));

    this.bufferWidth = Math.min(mapWorldW, desiredBufW);
    this.bufferHeight = Math.min(mapWorldH, desiredBufH);

    this.canvas.width = this.bufferWidth;
    this.canvas.height = this.bufferHeight;
    this.canvas.style.width = `${this.bufferWidth * EDITOR_TILE_SCALE}px`;
    this.canvas.style.height = `${this.bufferHeight * EDITOR_TILE_SCALE}px`;
    this.ctx.imageSmoothingEnabled = false;

    this.setCameraPosition(this.cameraX, this.cameraY);
  }

  private setCameraPosition(worldX: number, worldY: number): void {
    const maxX = Math.max(0, this.map.width * PMD_TILE_NATIVE_PX - this.bufferWidth);
    const maxY = Math.max(0, this.map.height * PMD_TILE_NATIVE_PX - this.bufferHeight);
    this.cameraX = Math.round(Math.max(0, Math.min(maxX, worldX)));
    this.cameraY = Math.round(Math.max(0, Math.min(maxY, worldY)));
  }

  private clientPointToTile(clientX: number, clientY: number): { x: number; y: number } | null {
    const rect = this.canvas.getBoundingClientRect();
    if (
      clientX < rect.left ||
      clientX > rect.right ||
      clientY < rect.top ||
      clientY > rect.bottom
    ) {
      return null;
    }
    const worldX = this.cameraX + (clientX - rect.left) / EDITOR_TILE_SCALE;
    const worldY = this.cameraY + (clientY - rect.top) / EDITOR_TILE_SCALE;
    const tx = Math.floor(worldX / PMD_TILE_NATIVE_PX);
    const ty = Math.floor(worldY / PMD_TILE_NATIVE_PX);
    if (tx < 0 || ty < 0 || tx >= this.map.width || ty >= this.map.height) {
      return null;
    }
    return { x: tx, y: ty };
  }

  private startLoop(): void {
    if (this.rafId !== null) return;
    const step = () => {
      if (!this.openState) {
        this.rafId = null;
        return;
      }
      this.renderFrame();
      this.rafId = window.requestAnimationFrame(step);
    };
    this.rafId = window.requestAnimationFrame(step);
  }

  private stopLoop(): void {
    if (this.rafId !== null) {
      window.cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  private renderFrame(): void {
    const mapWorldW = this.map.width * PMD_TILE_NATIVE_PX;
    const mapWorldH = this.map.height * PMD_TILE_NATIVE_PX;
    if (this.bufferWidth > mapWorldW || this.bufferHeight > mapWorldH) {
      this.syncViewportDimensions();
    }

    const ctx = this.ctx;
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#080e1c';
    ctx.fillRect(0, 0, this.bufferWidth, this.bufferHeight);

    const startCol = Math.max(0, Math.floor(this.cameraX / PMD_TILE_NATIVE_PX));
    const endCol = Math.min(
      this.map.width - 1,
      Math.ceil((this.cameraX + this.bufferWidth) / PMD_TILE_NATIVE_PX)
    );
    const startRow = Math.max(0, Math.floor(this.cameraY / PMD_TILE_NATIVE_PX));
    const endRow = Math.min(
      this.map.height - 1,
      Math.ceil((this.cameraY + this.bufferHeight) / PMD_TILE_NATIVE_PX)
    );

    // 1. Render 24x24 PMD Tileset Chunks & Special Terrain Overlays
    for (let ty = startRow; ty <= endRow; ty++) {
      const row = this.map.tiles[ty];
      if (!row) continue;
      for (let tx = startCol; tx <= endCol; tx++) {
        const cell = row[tx];
        if (!cell) continue;
        const dx = tx * PMD_TILE_NATIVE_PX - this.cameraX;
        const dy = ty * PMD_TILE_NATIVE_PX - this.cameraY;

        const sheet = this.loadedSheets.get(normalizeTilesetId(cell.tilesetId));
        if (sheet) {
          drawTilesetChunk(ctx, sheet, cell.chunkIndex, dx, dy, PMD_TILE_NATIVE_PX);
        } else {
          ctx.fillStyle = cell.terrainType === 'wall' ? '#1c2638' : '#2a4234';
          ctx.fillRect(dx, dy, PMD_TILE_NATIVE_PX, PMD_TILE_NATIVE_PX);
        }
        drawSpecialTerrainOverlay(
          ctx,
          cell.terrainType,
          cell.tilesetId,
          dx,
          dy,
          PMD_TILE_NATIVE_PX
        );

        if (this.showGrid) {
          ctx.strokeStyle = 'rgba(144, 216, 248, 0.24)';
          ctx.lineWidth = 1;
          ctx.strokeRect(dx + 0.5, dy + 0.5, PMD_TILE_NATIVE_PX - 1, PMD_TILE_NATIVE_PX - 1);
        }
      }
    }

    // 2. Render Blue Player Spawns & Red Enemy Spawns
    if (this.showSpawns) {
      const cap = Math.max(
        1,
        Math.min(this.map.deploymentCap ?? this.map.playerSpawns.length, this.map.playerSpawns.length)
      );

      this.map.playerSpawns.forEach((spawn, idx) => {
        const dx = spawn.x * PMD_TILE_NATIVE_PX - this.cameraX;
        const dy = spawn.y * PMD_TILE_NATIVE_PX - this.cameraY;
        const withinCap = idx < cap;

        ctx.fillStyle = withinCap ? 'rgba(56, 152, 248, 0.42)' : 'rgba(56, 152, 248, 0.2)';
        ctx.fillRect(dx + 1, dy + 1, PMD_TILE_NATIVE_PX - 2, PMD_TILE_NATIVE_PX - 2);
        ctx.strokeStyle = idx === 0 ? '#f8d048' : '#78d8ff';
        ctx.lineWidth = 1;
        ctx.strokeRect(dx + 1.5, dy + 1.5, PMD_TILE_NATIVE_PX - 3, PMD_TILE_NATIVE_PX - 3);

        this.drawUnitPreviewSprite(ctx, spawn.speciesId, spawn.x, spawn.y, 2);
      });

      this.map.enemySpawns.forEach((spawn) => {
        const dx = spawn.x * PMD_TILE_NATIVE_PX - this.cameraX;
        const dy = spawn.y * PMD_TILE_NATIVE_PX - this.cameraY;

        ctx.fillStyle = 'rgba(232, 72, 72, 0.38)';
        ctx.fillRect(dx + 1, dy + 1, PMD_TILE_NATIVE_PX - 2, PMD_TILE_NATIVE_PX - 2);
        ctx.strokeStyle = '#ff8888';
        ctx.lineWidth = 1;
        ctx.strokeRect(dx + 1.5, dy + 1.5, PMD_TILE_NATIVE_PX - 3, PMD_TILE_NATIVE_PX - 3);

        this.drawUnitPreviewSprite(ctx, spawn.speciesId, spawn.x, spawn.y, 6);
      });
    }

    // 3. Render Inspected & Hovered Tile Reticle
    const focusTile = this.hoveredTile ?? this.inspectedTile;
    if (focusTile) {
      const fx = focusTile.x * PMD_TILE_NATIVE_PX - this.cameraX;
      const fy = focusTile.y * PMD_TILE_NATIVE_PX - this.cameraY;
      ctx.strokeStyle = '#f8d048';
      ctx.lineWidth = 1;
      ctx.strokeRect(fx + 0.5, fy + 0.5, PMD_TILE_NATIVE_PX - 1, PMD_TILE_NATIVE_PX - 1);
    }
  }

  private drawUnitPreviewSprite(
    ctx: CanvasRenderingContext2D,
    speciesId: string,
    tileX: number,
    tileY: number,
    direction: 2 | 6
  ): void {
    const bundle = this.spriteBundles.get(speciesId);
    const anim = bundle ? (bundle.actions.Idle ?? bundle.actions.Walk) : undefined;
    if (!anim) return;
    const row = anim.rowCount >= 8 ? direction : direction % Math.max(1, anim.rowCount);
    const sx = 0;
    const sy = row * anim.frameHeight;
    const screenTileX = tileX * PMD_TILE_NATIVE_PX - this.cameraX;
    const screenTileY = tileY * PMD_TILE_NATIVE_PX - this.cameraY;
    const pos = computePmdTileSpritePlacement(
      screenTileX,
      screenTileY,
      anim.frameWidth,
      anim.frameHeight,
      PMD_TILE_NATIVE_PX
    );
    ctx.drawImage(
      anim.source,
      sx,
      sy,
      anim.frameWidth,
      anim.frameHeight,
      pos.drawX,
      pos.drawY,
      anim.frameWidth,
      anim.frameHeight
    );
  }
}

/**
 * Renders a crisp `image-rendering: pixelated` mini preview of any `DungeonMapDefinition`
 * onto a Dev Tools `<canvas>` element so the developer can browse all 34 levels visually.
 */
export async function renderDungeonMapPreviewCanvas(
  canvas: HTMLCanvasElement,
  map: DungeonMapDefinition
): Promise<void> {
  const sheetIds = new Set<string>();
  for (const row of map.tiles) {
    for (const cell of row) {
      sheetIds.add(normalizeTilesetId(cell.tilesetId));
    }
  }

  const loaded = new Map<string, LoadedTilesetSheet>();
  await Promise.all(
    [...sheetIds].map(async (id) => {
      const sheet = await loadTilesetSheet(id);
      loaded.set(id, sheet);
    })
  );

  canvas.width = map.width * PMD_TILE_NATIVE_PX;
  canvas.height = map.height * PMD_TILE_NATIVE_PX;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = '#080e1c';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (let y = 0; y < map.height; y++) {
    const row = map.tiles[y];
    if (!row) continue;
    for (let x = 0; x < map.width; x++) {
      const cell = row[x];
      if (!cell) continue;
      const dx = x * PMD_TILE_NATIVE_PX;
      const dy = y * PMD_TILE_NATIVE_PX;
      const sheet = loaded.get(normalizeTilesetId(cell.tilesetId));
      if (sheet) {
        drawTilesetChunk(ctx, sheet, cell.chunkIndex, dx, dy, PMD_TILE_NATIVE_PX);
      }
      drawSpecialTerrainOverlay(
        ctx,
        cell.terrainType,
        cell.tilesetId,
        dx,
        dy,
        PMD_TILE_NATIVE_PX
      );
    }
  }

  // Highlight Blue Player Spawns & Red Enemy Spawns clearly on the preview
  for (const p of map.playerSpawns) {
    const dx = p.x * PMD_TILE_NATIVE_PX;
    const dy = p.y * PMD_TILE_NATIVE_PX;
    ctx.fillStyle = 'rgba(56, 168, 255, 0.55)';
    ctx.fillRect(dx + 3, dy + 3, PMD_TILE_NATIVE_PX - 6, PMD_TILE_NATIVE_PX - 6);
    ctx.strokeStyle = '#d8f4ff';
    ctx.strokeRect(dx + 3.5, dy + 3.5, PMD_TILE_NATIVE_PX - 7, PMD_TILE_NATIVE_PX - 7);
  }
  for (const e of map.enemySpawns) {
    const dx = e.x * PMD_TILE_NATIVE_PX;
    const dy = e.y * PMD_TILE_NATIVE_PX;
    ctx.fillStyle = 'rgba(240, 72, 72, 0.6)';
    ctx.fillRect(dx + 3, dy + 3, PMD_TILE_NATIVE_PX - 6, PMD_TILE_NATIVE_PX - 6);
    ctx.strokeStyle = '#ffd0d0';
    ctx.strokeRect(dx + 3.5, dy + 3.5, PMD_TILE_NATIVE_PX - 7, PMD_TILE_NATIVE_PX - 7);
  }
}

export { exportChapterMapJson, getDefaultChapterMap };
