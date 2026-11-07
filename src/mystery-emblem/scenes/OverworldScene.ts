/**
 * Mystery Emblem — Fire Emblem Awakening Overworld Map Scene (`OVERWORLD_SCENE`, Step 4)
 *
 * Strictly obeys:
 * - Rule 1: 100% Data-Driven Manual Balance (reads manual registries & skirmish stat blocks)
 * - Rule 2: Unified Pointer Events ONLY (`pointerdown`, `pointermove`, `pointerup`, `pointercancel`);
 *   ZERO keyboard listeners; PC right-click + Mobile long-press + Top-Right `Menu`/`Back` parity;
 *   `>= 44x44px` touch targets; zero clipping on `1920x1080`, `390x844`, and `844x390`.
 * - Rule 3: Authentic PMD: Explorers of Sky visual skin, crisp `imageSmoothingEnabled = false` map & sprites,
 *   Kecleon (`0352`) sprite/portrait, and `#025 Kecleon's Shop` BGM.
 * - Rule 5 & 7: Strict faction separation, 1-item-slot per unit, and instant localStorage + Firestore sync.
 */

import { loadImage } from '../../utils/sprite-utils';
import {
  computePmdTileSpritePlacement,
  loadSpeciesSpriteBundle,
  resolveUnitVisualAssetId,
  type LoadedSpriteBundle,
  type PmdDirection,
  type PmdSpriteAction,
} from '../assets/pmdAssetLoader';
import { getAudioManager, type AudioManager } from '../audio/AudioManager';
import {
  DEMO_OVERWORLD_GRAPH,
  KECLEON_PMD_ASSET_ID,
  KECLEON_SHOP_METADATA,
  buildSkirmishBattlePayload,
  getOverworldNodeById,
  type OverworldGraphDefinition,
  type OverworldNodeDefinition,
  type OverworldPoint,
} from '../data/overworldMapData';
import {
  getItemById,
  getMoveById,
  getPersonalSkillById,
  getSpeciesById,
} from '../data/index';
import {
  ensureOverworldGraphState,
  findOverworldRoute,
  getEdgePointsOrdered,
  samplePolylineAtDistance,
  type OverworldRouteResult,
} from '../engine/overworldEngine';
import {
  getUnitEquippedItemId,
  type SaveStateManager,
} from '../state/SaveStateManager';
import type {
  DungeonMapDefinition,
  ItemDefinition,
  KecleonShopType,
  ManualEnemyBattleSpawn,
  OverworldNodeState,
  OwnedPokemonInstance,
  SaveData,
} from '../types/schemas';
import {
  createItemIconCell,
  createMiniItemIcon,
} from '../ui/PmdItemIconGrid';
import { PmdPortraitView } from '../ui/PmdSpriteCanvas';
import {
  createMiniSpeciesPortrait,
  createUnitPortraitCell,
} from '../ui/PmdUnitPortraitGrid';
import {
  MAP_OVERSCROLL_NATIVE_PX,
  MultiTouchPinchTracker,
  OVERWORLD_SCALE_BOUNDS,
  clampMapScale,
  computeCenteredMapCameraBounds,
  computeWheelZoomScale,
  type MapCameraBounds,
} from '../ui/mapZoomController';
import { bindPointerTap } from '../ui/pointerControls';

const DRAG_THRESHOLD_PX = 8;
const LONG_PRESS_MS = 520;
const LORD_WALK_SPEED_NORMAL_PX_PER_SEC = 105;
const LORD_WALK_SPEED_FAST_PX_PER_SEC = 560;
const OVERWORLD_SPRITE_SCALE_FACTOR = 0.5;

export type OverworldMenuTab = 'units' | 'convoy' | 'system';

export interface OverworldSceneOptions {
  viewportEl: HTMLElement;
  saveManager: SaveStateManager;
  audioManager?: AudioManager;
  graph?: OverworldGraphDefinition;
  onExit: () => void;
  onRequestNewGame?: () => void;
  onLayerStateChanged: () => void;
  onRequestRenameUnit?: (instanceId: string) => Promise<void> | void;
  onLaunchChapterBattle?: (payload: { nodeId: string; levelId: string }) => void;
  onLaunchSkirmishBattle?: (payload: {
    nodeId: string;
    customMap: DungeonMapDefinition;
    enemyOverrides: ManualEnemyBattleSpawn[];
    goldBounty: number;
  }) => void;
}

export interface OverworldSceneSnapshot {
  isOpen: boolean;
  currentNodeId: string;
  isTraveling: boolean;
  travelTargetNodeId: string | null;
  lastRouteNodePath: string[];
  lastRoutePoints: OverworldPoint[];
  lastTravelDirections: PmdDirection[];
  lordWorldPos: { x: number; y: number };
  lordDirection: PmdDirection;
  lordSpeciesId: string;
  lordNickname: string;
  displayScale: number;
  camera: {
    x: number;
    y: number;
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
    viewWidthPx: number;
    viewHeightPx: number;
  };
  unlockedNodeIds: string[];
  clearedNodeIds: string[];
  activeShopNodes: Array<{ nodeId: string; shopType: KecleonShopType; stockCount: number }>;
  activeSkirmishNodes: Array<{ nodeId: string; recommendedLevel: number; scoutSpeciesId: string }>;
  kecleonShopOpen: boolean;
  systemMenuOpen: boolean;
  activeMenuTab: OverworldMenuTab;
  fastMode: boolean;
}

const mapImageCache = new Map<string, Promise<CanvasImageSource>>();

function createFallbackOverworldCanvas(width: number, height: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = width;
  c.height = height;
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = '#d89848';
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = '#c8883c';
  for (let y = 0; y < height; y += 24) {
    ctx.fillRect(0, y, width, 1);
  }
  for (let x = 0; x < width; x += 24) {
    ctx.fillRect(x, 0, 1, height);
  }
  return c;
}

export function loadOverworldMapImage(
  graph: OverworldGraphDefinition = DEMO_OVERWORLD_GRAPH
): Promise<CanvasImageSource> {
  const existing = mapImageCache.get(graph.imageUrl);
  if (existing) return existing;

  const p = loadImage(graph.imageUrl)
    .then((img) => img as CanvasImageSource)
    .catch(() => createFallbackOverworldCanvas(graph.imageWidth, graph.imageHeight));
  mapImageCache.set(graph.imageUrl, p);
  return p;
}

export async function renderOverworldPreviewCanvas(
  canvas: HTMLCanvasElement,
  save: SaveData | null,
  graph: OverworldGraphDefinition = DEMO_OVERWORLD_GRAPH
): Promise<void> {
  const mapSource = await loadOverworldMapImage(graph);
  canvas.width = graph.imageWidth;
  canvas.height = graph.imageHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.imageSmoothingEnabled = false;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(mapSource, 0, 0, graph.imageWidth, graph.imageHeight);

  const reconciled = save
    ? ensureOverworldGraphState(save, graph)
    : {
        currentNodeId: graph.startNodeId,
        nodes: Object.fromEntries(
          graph.nodes.map((n) => [
            n.id,
            {
              nodeId: n.id,
              unlocked: Boolean(n.initiallyUnlocked || n.id === graph.startNodeId),
              cleared: false,
              activeSkirmish: null,
              activeKecleonShop: null,
            } satisfies OverworldNodeState,
          ])
        ),
        mutated: false,
      };

  const nodeMap = new Map(graph.nodes.map((n) => [n.id, n]));

  for (const edge of graph.edges) {
    const a = nodeMap.get(edge.fromNodeId);
    const b = nodeMap.get(edge.toNodeId);
    if (!a || !b) continue;
    const pts = getEdgePointsOrdered(edge, a, b);
    const unlocked =
      Boolean(reconciled.nodes[a.id]?.unlocked) && Boolean(reconciled.nodes[b.id]?.unlocked);

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(pts[0]!.x, pts[0]!.y);
    for (let i = 1; i < pts.length; i++) {
      ctx.lineTo(pts[i]!.x, pts[i]!.y);
    }
    if (unlocked) {
      ctx.strokeStyle = '#2c1808';
      ctx.lineWidth = 4;
      ctx.stroke();
      ctx.strokeStyle = '#ffe078';
      ctx.lineWidth = 2;
      ctx.stroke();
    } else {
      ctx.setLineDash([3, 3]);
      ctx.strokeStyle = 'rgba(32, 20, 12, 0.55)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
    ctx.restore();
  }

  for (const node of graph.nodes) {
    const st = reconciled.nodes[node.id];
    const isCurrent = reconciled.currentNodeId === node.id;
    ctx.save();
    ctx.beginPath();
    ctx.arc(node.x, node.y, isCurrent ? 7 : 5, 0, Math.PI * 2);
    if (!st?.unlocked) {
      ctx.fillStyle = 'rgba(36, 44, 60, 0.78)';
      ctx.strokeStyle = '#7888a0';
    } else if (st.cleared) {
      ctx.fillStyle = '#1c4c88';
      ctx.strokeStyle = isCurrent ? '#f8d048' : '#70d8ff';
    } else {
      ctx.fillStyle = '#b8283c';
      ctx.strokeStyle = '#f8d048';
    }
    ctx.lineWidth = 2;
    ctx.fill();
    ctx.stroke();

    if (st?.activeKecleonShop) {
      ctx.fillStyle = '#38c868';
      ctx.fillRect(node.x + 5, node.y - 9, 6, 6);
    }
    if (st?.activeSkirmish) {
      ctx.fillStyle = '#ff4858';
      ctx.fillRect(node.x - 11, node.y - 9, 6, 6);
    }
    ctx.restore();
  }
}

export class OverworldScene {
  private readonly viewportEl: HTMLElement;
  private readonly saveManager: SaveStateManager;
  private readonly audioManager: AudioManager;
  private graph: OverworldGraphDefinition;
  private readonly onExitCallback: () => void;
  private readonly onRequestNewGame?: () => void;
  private readonly onLayerStateChanged: () => void;
  private readonly onRequestRenameUnit?: (instanceId: string) => Promise<void> | void;
  private readonly onLaunchChapterBattle?: OverworldSceneOptions['onLaunchChapterBattle'];
  private readonly onLaunchSkirmishBattle?: OverworldSceneOptions['onLaunchSkirmishBattle'];

  private readonly rootEl: HTMLElement;
  private readonly canvasStageEl: HTMLElement;
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;

  // Top HUD Bar
  private readonly topHudBarEl: HTMLElement;
  private readonly lordHudPillEl: HTMLElement;
  private readonly goldHudPillEl: HTMLElement;

  // Toast Banner & Concise Bottom Location Dock
  private readonly toastEl: HTMLElement;
  private toastTimer: number | null = null;
  private readonly dockEl: HTMLElement;
  private readonly dockTitleEl: HTMLElement;
  private readonly dockBadgesEl: HTMLElement;
  private readonly dockActionsEl: HTMLElement;
  private readonly btnEnterChapterEl: HTMLButtonElement;
  private readonly btnFightSkirmishEl: HTMLButtonElement;
  private readonly btnOpenShopEl: HTMLButtonElement;

  // Kecleon Shop Modal
  private readonly kecleonBackdropEl: HTMLElement;
  private readonly kecleonTitleEl: HTMLElement;
  private readonly kecleonGoldEl: HTMLElement;
  private readonly kecleonSpeechNameEl: HTMLElement;
  private readonly kecleonSpeechTextEl: HTMLElement;
  private readonly kecleonShelfEl: HTMLElement;
  private readonly kecleonStatusEl: HTMLElement;
  private readonly kecleonPortraitView: PmdPortraitView;

  // Overworld System Menu Modal (3 Tabs: `Units`, `Items`, `System`)
  private readonly systemMenuBackdropEl: HTMLElement;
  private readonly menuPanelBodyEl: HTMLElement;
  private readonly menuFeedbackEl: HTMLElement;
  private unitDetailPortraitView: PmdPortraitView | null = null;

  private openState = false;
  private previousBgmId: string | null = null;
  private kecleonShopOpen = false;
  private systemMenuOpen = false;
  private activeMenuTab: OverworldMenuTab = 'units';
  private selectedUnitInstanceId: string | null = null;
  private selectedShopItemId: string | null = null;
  private selectedConvoyItemId: string | null = null;
  private selectedUnitVitaminId: string | null = null;
  private selectedUnitTmId: string | null = null;
  private pendingSystemConfirm: 'new_game' | 'delete_save' | null = null;
  private menuFeedbackMessage = '';
  private kecleonStatusMessage = '';
  private fastMode = false;

  // Rendering & Camera State
  private mapSource: CanvasImageSource | null = null;
  private readonly spriteBundles = new Map<string, LoadedSpriteBundle>();
  private readonly loadingSpriteIds = new Set<string>();
  private viewWidthPx = 960;
  private viewHeightPx = 540;
  private displayScale = OVERWORLD_SCALE_BOUNDS.defaultScale;
  private cameraX = 0;
  private cameraY = 0;
  private hasInitializedCamera = false;
  private hoveredNodeId: string | null = null;
  private hoverRoutePreview: OverworldRouteResult | null = null;

  // Dragon Lord Map Actor & Travel Interpolation State
  private lordWorldX = 208;
  private lordWorldY = 194;
  private lordDirection: PmdDirection = 0;
  private lordAction: PmdSpriteAction = 'Idle';
  private animClockMs = 0;
  private lastRafTickMs = 0;
  private rafId: number | null = null;

  private activeTravel: {
    targetNodeId: string;
    route: OverworldRouteResult;
    walkedDistancePx: number;
    resolveArrival: () => void;
  } | null = null;
  private lastRouteNodePath: string[] = [];
  private lastRoutePoints: OverworldPoint[] = [];
  private lastTravelDirections: PmdDirection[] = [];

  // Pointer Panning, Pinch-to-Zoom & Long-Press State
  private readonly pinchTracker = new MultiTouchPinchTracker(OVERWORLD_SCALE_BOUNDS);
  private activePointerId: number | null = null;
  private pointerStartX = 0;
  private pointerStartY = 0;
  private pointerStartCamX = 0;
  private pointerStartCamY = 0;
  private isDraggingCamera = false;
  private longPressFired = false;
  private longPressTimer: number | null = null;

  private resizeObserver: ResizeObserver | null = null;
  private unsubscribeSave: (() => void) | null = null;
  private readonly abortController = new AbortController();

  constructor(options: OverworldSceneOptions) {
    this.viewportEl = options.viewportEl;
    this.saveManager = options.saveManager;
    this.audioManager = options.audioManager ?? getAudioManager();
    this.graph = options.graph ?? DEMO_OVERWORLD_GRAPH;
    this.onExitCallback = options.onExit;
    this.onRequestNewGame = options.onRequestNewGame;
    this.onLayerStateChanged = options.onLayerStateChanged;
    this.onRequestRenameUnit = options.onRequestRenameUnit;
    this.onLaunchChapterBattle = options.onLaunchChapterBattle;
    this.onLaunchSkirmishBattle = options.onLaunchSkirmishBattle;

    // Root Scene Container
    this.rootEl = document.createElement('section');
    this.rootEl.id = 'pmd-overworld-scene';
    this.rootEl.className = 'pmd-battle-scene pmd-overworld-scene';
    this.rootEl.dataset.testid = 'overworld-scene';
    this.rootEl.dataset.noLongpress = 'true';
    this.rootEl.hidden = true;

    // 1. Full-Viewport Canvas Stage
    this.canvasStageEl = document.createElement('div');
    this.canvasStageEl.className = 'pmd-battle-canvas-stage';
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'pmd-overworld-canvas pmd-pixelated';
    this.canvas.dataset.testid = 'overworld-canvas';
    const ctx = this.canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Could not initialize 2D context for OverworldScene.');
    }
    ctx.imageSmoothingEnabled = false;
    this.ctx = ctx;
    this.canvasStageEl.appendChild(this.canvas);

    // 2. Top HUD Bar
    this.topHudBarEl = document.createElement('div');
    this.topHudBarEl.className = 'pmd-battle-hud-top';
    this.topHudBarEl.innerHTML = `
      <div class="pmd-window pmd-window--compact pmd-window--translucent pmd-battle-pill" data-testid="overworld-lord-pill">Squad</div>
      <div class="pmd-window pmd-window--compact pmd-window--translucent pmd-battle-pill" data-testid="overworld-gold-pill">0G</div>
    `;
    this.lordHudPillEl = this.topHudBarEl.querySelector('[data-testid="overworld-lord-pill"]')!;
    this.goldHudPillEl = this.topHudBarEl.querySelector('[data-testid="overworld-gold-pill"]')!;

    // 3. Toast Notification Banner
    this.toastEl = document.createElement('div');
    this.toastEl.className = 'pmd-window pmd-window--translucent pmd-overworld-toast';
    this.toastEl.dataset.testid = 'overworld-toast';
    this.toastEl.hidden = true;

    // 4. Concise Bottom Location Dock (No lore paragraph, no Replay button on cleared nodes)
    this.dockEl = document.createElement('div');
    this.dockEl.className = 'pmd-window pmd-window--translucent pmd-overworld-dock';
    this.dockEl.dataset.testid = 'overworld-location-dock';
    this.dockEl.innerHTML = `
      <div class="pmd-overworld-dock-info">
        <div class="pmd-overworld-dock-title-row">
          <h3 class="pmd-overworld-dock-title" data-testid="overworld-current-node-title">—</h3>
          <div class="pmd-inline-btns" data-dock-badges></div>
        </div>
      </div>
      <div class="pmd-overworld-dock-actions" data-dock-actions>
        <button type="button" class="pmd-btn pmd-btn-primary" data-testid="overworld-enter-chapter-btn">Enter Dungeon</button>
        <button type="button" class="pmd-btn pmd-btn-danger" data-testid="overworld-fight-skirmish-btn" hidden>Skirmish</button>
        <button type="button" class="pmd-btn pmd-btn-primary" data-testid="overworld-open-shop-btn" hidden>Shop</button>
      </div>
    `;
    this.dockTitleEl = this.dockEl.querySelector('[data-testid="overworld-current-node-title"]')!;
    this.dockBadgesEl = this.dockEl.querySelector('[data-dock-badges]')!;
    this.dockActionsEl = this.dockEl.querySelector('[data-dock-actions]')!;
    this.btnEnterChapterEl = this.dockEl.querySelector(
      '[data-testid="overworld-enter-chapter-btn"]'
    )!;
    this.btnFightSkirmishEl = this.dockEl.querySelector(
      '[data-testid="overworld-fight-skirmish-btn"]'
    )!;
    this.btnOpenShopEl = this.dockEl.querySelector('[data-testid="overworld-open-shop-btn"]')!;

    // 5. Kecleon Shop Modal (`#025 Kecleon's Shop` BGM)
    this.kecleonBackdropEl = document.createElement('div');
    this.kecleonBackdropEl.className = 'pmd-battle-modal-backdrop';
    this.kecleonBackdropEl.dataset.testid = 'overworld-kecleon-shop-modal';
    this.kecleonBackdropEl.hidden = true;
    this.kecleonBackdropEl.innerHTML = `
      <div class="pmd-window pmd-window--gold pmd-overworld-modal-dialog" role="dialog" aria-modal="true" aria-labelledby="kecleon-shop-title">
        <div class="pmd-devtools-row-between">
          <h3 id="kecleon-shop-title" class="pmd-panel-title" style="margin:0;">KECLEON SHOP</h3>
          <div class="pmd-inline-btns">
            <span class="pmd-window pmd-window--compact pmd-battle-pill" data-testid="kecleon-shop-gold">0G</span>
            <button type="button" class="pmd-btn pmd-chip-btn" data-testid="kecleon-open-units-btn">Units</button>
            <button type="button" class="pmd-btn pmd-chip-btn" data-testid="kecleon-shop-close-btn">Leave</button>
          </div>
        </div>
        <div class="pmd-kecleon-hero">
          <div class="pmd-kecleon-portrait-box" data-kecleon-portrait-slot></div>
          <div class="pmd-kecleon-speech">
            <strong data-kecleon-speech-name>Kecleon</strong>
            <p data-kecleon-speech-text>Welcome!</p>
          </div>
        </div>
        <p class="pmd-subcard-text" data-testid="kecleon-shop-status" hidden></p>
        <div class="pmd-kecleon-shelf" data-testid="kecleon-shop-shelf"></div>
      </div>
    `;
    this.kecleonTitleEl = this.kecleonBackdropEl.querySelector('#kecleon-shop-title')!;
    this.kecleonGoldEl = this.kecleonBackdropEl.querySelector('[data-testid="kecleon-shop-gold"]')!;
    this.kecleonSpeechNameEl = this.kecleonBackdropEl.querySelector('[data-kecleon-speech-name]')!;
    this.kecleonSpeechTextEl = this.kecleonBackdropEl.querySelector('[data-kecleon-speech-text]')!;
    this.kecleonShelfEl = this.kecleonBackdropEl.querySelector(
      '[data-testid="kecleon-shop-shelf"]'
    )!;
    this.kecleonStatusEl = this.kecleonBackdropEl.querySelector(
      '[data-testid="kecleon-shop-status"]'
    )!;
    this.kecleonPortraitView = new PmdPortraitView({
      pixelScale: 1.5,
      testId: 'kecleon-shop-portrait',
    });
    this.kecleonBackdropEl
      .querySelector('[data-kecleon-portrait-slot]')!
      .appendChild(this.kecleonPortraitView.canvas);

    // 6. Overworld System Menu Modal (3 Tabs: `Units`, `Items`, `System`)
    this.systemMenuBackdropEl = document.createElement('div');
    this.systemMenuBackdropEl.className = 'pmd-battle-modal-backdrop';
    this.systemMenuBackdropEl.dataset.testid = 'overworld-system-menu';
    this.systemMenuBackdropEl.hidden = true;
    this.systemMenuBackdropEl.innerHTML = `
      <div class="pmd-window pmd-overworld-modal-dialog" role="dialog" aria-modal="true" aria-label="Overworld Menu">
        <div class="pmd-devtools-row-between">
          <h3 class="pmd-panel-title" style="margin:0;">MENU</h3>
          <button type="button" class="pmd-btn pmd-chip-btn" data-testid="overworld-menu-close-btn">Close</button>
        </div>
        <nav class="pmd-inline-btns" aria-label="Overworld Menu Sections">
          <button type="button" class="pmd-btn pmd-chip-btn is-active" data-ow-tab="units" data-testid="overworld-menu-tab-units">Units</button>
          <button type="button" class="pmd-btn pmd-chip-btn" data-ow-tab="convoy" data-testid="overworld-menu-tab-convoy">Items</button>
          <button type="button" class="pmd-btn pmd-chip-btn" data-ow-tab="system" data-testid="overworld-menu-tab-system">System</button>
        </nav>
        <p class="pmd-subcard-text" data-testid="overworld-menu-feedback" style="color:#90ffbe;" hidden></p>
        <div data-testid="overworld-menu-body"></div>
      </div>
    `;
    this.menuPanelBodyEl = this.systemMenuBackdropEl.querySelector(
      '[data-testid="overworld-menu-body"]'
    )!;
    this.menuFeedbackEl = this.systemMenuBackdropEl.querySelector(
      '[data-testid="overworld-menu-feedback"]'
    )!;

    this.rootEl.append(
      this.canvasStageEl,
      this.topHudBarEl,
      this.toastEl,
      this.dockEl,
      this.kecleonBackdropEl,
      this.systemMenuBackdropEl
    );
    this.viewportEl.appendChild(this.rootEl);

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
    return this.kecleonShopOpen || this.systemMenuOpen;
  }

  public setFastMode(enabled: boolean): void {
    this.fastMode = Boolean(enabled);
  }

  public async open(options?: {
    graph?: OverworldGraphDefinition;
    preservePosition?: boolean;
  }): Promise<void> {
    if (options?.graph) {
      this.graph = options.graph;
    }

    if (!this.openState) {
      this.previousBgmId = this.audioManager.getCurrentTrackId();
    }
    this.openState = true;

    let save = this.saveManager.getSave();
    if (!save) {
      save = this.saveManager.createNewCampaignSave({
        lordSpeciesId: 'dratini',
        lordNickname: 'Dratini',
        partnerSpeciesId: 'bulbasaur',
        partnerNickname: 'Bulbasaur',
        healerSpeciesId: 'happiny',
        healerNickname: 'Happiny',
      });
    }
    this.saveManager.ensureOverworldInitialized(this.graph);

    this.kecleonShopOpen = false;
    this.systemMenuOpen = false;
    this.pendingSystemConfirm = null;
    this.kecleonBackdropEl.hidden = true;
    this.systemMenuBackdropEl.hidden = true;
    this.activeTravel = null;
    const shouldResetCamera = !options?.preservePosition || !this.hasInitializedCamera;
    this.pinchTracker.reset();
    if (shouldResetCamera) {
      this.displayScale = OVERWORLD_SCALE_BOUNDS.defaultScale;
    }

    this.rootEl.hidden = false;
    this.viewportEl.classList.add('is-battle-active');

    this.unsubscribeSave?.();
    this.unsubscribeSave = this.saveManager.subscribe(() => {
      if (!this.openState) return;
      this.preloadActiveSprites();
      this.syncHudAndDock();
      if (this.kecleonShopOpen) {
        this.renderKecleonShopContents();
      }
      if (this.systemMenuOpen) {
        this.renderSystemMenuBody();
      }
      this.renderFrame();
    });

    this.mapSource = await loadOverworldMapImage(this.graph);
    this.preloadActiveSprites();
    await this.ensureLordAndKecleonPreloaded();

    this.syncViewportDimensions();
    this.snapLordToCurrentNode();
    if (shouldResetCamera) {
      this.centerCameraInitiallyOnLord();
      this.hasInitializedCamera = true;
    } else {
      this.clampCamera();
    }

    this.syncHudAndDock();
    this.audioManager.playBgm('exploration_theme', { fadeMs: 280 });
    this.startLoop();
    this.onLayerStateChanged();
    this.renderFrame();
  }

  public close(): void {
    this.closeInternal(true);
  }

  private closeInternal(notifyExit: boolean): void {
    if (!this.openState) return;
    this.openState = false;
    this.stopLoop();
    this.clearLongPressTimer();
    this.pinchTracker.reset();
    this.activePointerId = null;
    this.isDraggingCamera = false;
    this.longPressFired = false;
    this.activeTravel = null;
    this.kecleonShopOpen = false;
    this.systemMenuOpen = false;
    this.pendingSystemConfirm = null;
    this.kecleonBackdropEl.hidden = true;
    this.systemMenuBackdropEl.hidden = true;
    this.unsubscribeSave?.();
    this.unsubscribeSave = null;

    this.rootEl.hidden = true;
    this.viewportEl.classList.remove('is-battle-active');

    if (notifyExit) {
      if (this.previousBgmId) {
        this.audioManager.playBgm(this.previousBgmId, { fadeMs: 250 });
      } else {
        this.audioManager.playBgm('top_menu', { fadeMs: 250 });
      }
    }

    this.onLayerStateChanged();
    if (notifyExit) {
      this.onExitCallback();
    }
  }

  public destroy(): void {
    this.stopLoop();
    this.clearLongPressTimer();
    if (this.toastTimer !== null) {
      window.clearTimeout(this.toastTimer);
      this.toastTimer = null;
    }
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    this.unsubscribeSave?.();
    this.unsubscribeSave = null;
    this.abortController.abort();
    this.viewportEl.classList.remove('is-battle-active');
    this.rootEl.remove();
  }

  /**
   * Unified Back / Right-Click / Long-Press / Top-Right `Menu` handler (Rule 2).
   */
  public handleMenuOrBack(): void {
    if (!this.openState) return;

    if (this.kecleonShopOpen) {
      this.closeKecleonShop();
      return;
    }
    if (this.systemMenuOpen) {
      this.closeSystemMenu();
      return;
    }

    this.openSystemMenu('units');
  }

  // ==========================================================================
  // Inspection & Travel Helpers
  // ==========================================================================

  public getNodeClientCenter(nodeId: string): { clientX: number; clientY: number } | null {
    const def = getOverworldNodeById(nodeId, this.graph);
    if (!def) return null;
    const rect = this.canvas.getBoundingClientRect();
    return {
      clientX: rect.left + (def.x - this.cameraX) * this.displayScale,
      clientY: rect.top + (def.y - this.cameraY) * this.displayScale,
    };
  }

  public centerCameraOnNode(nodeId: string): void {
    const def = getOverworldNodeById(nodeId, this.graph);
    if (!def) return;
    this.centerCameraOnMapPoint(def.x, def.y);
    this.renderFrame();
  }

  public setZoomScale(
    nextScale: number,
    anchorClientX?: number,
    anchorClientY?: number
  ): void {
    const rect = this.canvas.getBoundingClientRect();
    const cx = anchorClientX ?? rect.left + rect.width / 2;
    const cy = anchorClientY ?? rect.top + rect.height / 2;
    const anchor = this.clientPointToWorld(cx, cy);
    this.applyZoomWithWorldAnchor(
      clampMapScale(nextScale, OVERWORLD_SCALE_BOUNDS),
      cx,
      cy,
      anchor.worldX,
      anchor.worldY
    );
    this.renderFrame();
  }

  public snapToCurrentSaveNode(): void {
    if (!this.openState) return;
    this.snapLordToCurrentNode();
    this.centerCameraInitiallyOnLord();
    this.syncHudAndDock();
    this.renderFrame();
  }

  public async travelToNode(nodeId: string): Promise<boolean> {
    if (!this.openState || this.activeTravel) return false;
    const save = this.saveManager.getSave();
    if (!save) return false;
    const reconciled = ensureOverworldGraphState(save, this.graph);
    const currentId = reconciled.currentNodeId;
    if (nodeId === currentId) {
      this.audioManager.playSfx('select');
      this.centerCameraOnMapPoint(this.lordWorldX, this.lordWorldY);
      this.renderFrame();
      return true;
    }
    const route = findOverworldRoute(this.graph, reconciled.nodes, currentId, nodeId);
    if (!route.reachable || route.points.length < 2) {
      this.audioManager.playSfx('cancel');
      this.showToast('Locked');
      return false;
    }

    this.audioManager.playSfx('select');
    this.lastRouteNodePath = [...route.nodePath];
    this.lastRoutePoints = route.points.map((p) => ({ x: p.x, y: p.y }));
    this.lastTravelDirections = [];

    return new Promise<boolean>((resolve) => {
      const firstSample = samplePolylineAtDistance(route.points, 0, this.lordDirection);
      this.lordWorldX = firstSample.x;
      this.lordWorldY = firstSample.y;
      this.lordDirection = firstSample.direction;
      this.lordAction = 'Walk';
      this.recordTravelDirection(firstSample.direction);

      this.activeTravel = {
        targetNodeId: nodeId,
        route,
        walkedDistancePx: 0,
        resolveArrival: () => resolve(true),
      };
      this.renderFrame();
    });
  }

  public getSnapshot(): OverworldSceneSnapshot {
    const save = this.saveManager.getSave();
    const reconciled = save
      ? ensureOverworldGraphState(save, this.graph)
      : { currentNodeId: this.graph.startNodeId, nodes: {}, mutated: false };
    const lord = this.getActiveLordUnit(save);
    const maxBounds = this.getMaxCameraBounds();

    const unlockedNodeIds: string[] = [];
    const clearedNodeIds: string[] = [];
    const activeShopNodes: OverworldSceneSnapshot['activeShopNodes'] = [];
    const activeSkirmishNodes: OverworldSceneSnapshot['activeSkirmishNodes'] = [];

    for (const def of this.graph.nodes) {
      const st = reconciled.nodes[def.id];
      if (st?.unlocked) unlockedNodeIds.push(def.id);
      if (st?.cleared) clearedNodeIds.push(def.id);
      if (st?.activeKecleonShop) {
        activeShopNodes.push({
          nodeId: def.id,
          shopType: st.activeKecleonShop.shopType,
          stockCount: st.activeKecleonShop.inventoryItemIds.length,
        });
      }
      if (st?.activeSkirmish) {
        activeSkirmishNodes.push({
          nodeId: def.id,
          recommendedLevel: st.activeSkirmish.recommendedLevel,
          scoutSpeciesId: def.skirmishScoutSpeciesId,
        });
      }
    }

    return {
      isOpen: this.openState,
      currentNodeId: reconciled.currentNodeId,
      isTraveling: Boolean(this.activeTravel),
      travelTargetNodeId: this.activeTravel?.targetNodeId ?? null,
      lastRouteNodePath: [...this.lastRouteNodePath],
      lastRoutePoints: this.lastRoutePoints.map((p) => ({ x: p.x, y: p.y })),
      lastTravelDirections: [...this.lastTravelDirections],
      lordWorldPos: {
        x: Math.round(this.lordWorldX * 100) / 100,
        y: Math.round(this.lordWorldY * 100) / 100,
      },
      lordDirection: this.lordDirection,
      lordSpeciesId: lord?.speciesId ?? 'dratini',
      lordNickname: lord?.nickname ?? 'Dratini',
      displayScale: this.displayScale,
      camera: {
        x: Math.round(this.cameraX * 100) / 100,
        y: Math.round(this.cameraY * 100) / 100,
        minX: Math.round(maxBounds.minX * 100) / 100,
        minY: Math.round(maxBounds.minY * 100) / 100,
        maxX: Math.round(maxBounds.maxX * 100) / 100,
        maxY: Math.round(maxBounds.maxY * 100) / 100,
        viewWidthPx: this.viewWidthPx,
        viewHeightPx: this.viewHeightPx,
      },
      unlockedNodeIds,
      clearedNodeIds,
      activeShopNodes,
      activeSkirmishNodes,
      kecleonShopOpen: this.kecleonShopOpen,
      systemMenuOpen: this.systemMenuOpen,
      activeMenuTab: this.activeMenuTab,
      fastMode: this.fastMode,
    };
  }

  // ==========================================================================
  // Sprite Preloading & Animation Loop
  // ==========================================================================

  private getActiveLordUnit(save: SaveData | null): OwnedPokemonInstance | undefined {
    if (!save || save.roster.length === 0) return undefined;
    return (
      save.roster.find((u) => u.instanceId === save.campaign.lordInstanceId) ??
      save.roster.find((u) => u.isLord) ??
      save.roster[0]
    );
  }

  private requestSpriteBundle(speciesOrAssetId: string): void {
    if (this.spriteBundles.has(speciesOrAssetId) || this.loadingSpriteIds.has(speciesOrAssetId)) {
      return;
    }
    this.loadingSpriteIds.add(speciesOrAssetId);
    void loadSpeciesSpriteBundle(speciesOrAssetId)
      .then((bundle) => {
        this.spriteBundles.set(speciesOrAssetId, bundle);
        this.loadingSpriteIds.delete(speciesOrAssetId);
        if (this.openState) this.renderFrame();
      })
      .catch(() => {
        this.loadingSpriteIds.delete(speciesOrAssetId);
      });
  }

  private preloadActiveSprites(): void {
    const save = this.saveManager.getSave();
    const lord = this.getActiveLordUnit(save);
    if (lord) {
      this.requestSpriteBundle(lord.speciesId);
    }
    this.requestSpriteBundle(KECLEON_PMD_ASSET_ID);
    if (save) {
      const reconciled = ensureOverworldGraphState(save, this.graph);
      for (const def of this.graph.nodes) {
        if (reconciled.nodes[def.id]?.activeSkirmish) {
          this.requestSpriteBundle(def.skirmishScoutSpeciesId);
        }
      }
    }
  }

  private async ensureLordAndKecleonPreloaded(): Promise<void> {
    const save = this.saveManager.getSave();
    const lord = this.getActiveLordUnit(save);
    const ids = [KECLEON_PMD_ASSET_ID, lord?.speciesId ?? 'dratini'];
    await Promise.all(
      ids.map(async (id) => {
        if (!this.spriteBundles.has(id)) {
          const bundle = await loadSpeciesSpriteBundle(id);
          this.spriteBundles.set(id, bundle);
        }
      })
    );
  }

  private snapLordToCurrentNode(): void {
    const save = this.saveManager.getSave();
    if (!save) return;
    const reconciled = ensureOverworldGraphState(save, this.graph);
    const def =
      getOverworldNodeById(reconciled.currentNodeId, this.graph) ??
      getOverworldNodeById(this.graph.startNodeId, this.graph);
    if (def) {
      this.lordWorldX = def.x;
      this.lordWorldY = def.y;
      this.lordAction = 'Idle';
      this.lordDirection = 0;
    }
  }

  private startLoop(): void {
    if (this.rafId !== null) return;
    this.lastRafTickMs = performance.now();
    const tick = (nowMs: number) => {
      if (!this.openState) {
        this.rafId = null;
        return;
      }
      const dtMs = Math.min(80, Math.max(0, nowMs - this.lastRafTickMs));
      this.lastRafTickMs = nowMs;
      this.animClockMs += dtMs;
      this.stepTravel(dtMs);
      this.renderFrame();
      this.rafId = window.requestAnimationFrame(tick);
    };
    this.rafId = window.requestAnimationFrame(tick);
  }

  private stopLoop(): void {
    if (this.rafId !== null) {
      window.cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  private recordTravelDirection(dir: PmdDirection): void {
    const last = this.lastTravelDirections[this.lastTravelDirections.length - 1];
    if (last !== dir) {
      this.lastTravelDirections.push(dir);
    }
  }

  private stepTravel(dtMs: number): void {
    if (!this.activeTravel) return;
    const speed = this.fastMode
      ? LORD_WALK_SPEED_FAST_PX_PER_SEC
      : LORD_WALK_SPEED_NORMAL_PX_PER_SEC;
    this.activeTravel.walkedDistancePx += (speed * dtMs) / 1000;

    const sample = samplePolylineAtDistance(
      this.activeTravel.route.points,
      this.activeTravel.walkedDistancePx,
      this.lordDirection
    );
    this.lordWorldX = sample.x;
    this.lordWorldY = sample.y;
    this.lordDirection = sample.direction;
    this.lordAction = 'Walk';
    this.recordTravelDirection(sample.direction);

    this.ensurePointComfortableInCamera(this.lordWorldX, this.lordWorldY);

    if (sample.completed) {
      const arrivedNodeId = this.activeTravel.targetNodeId;
      const done = this.activeTravel.resolveArrival;
      this.activeTravel = null;
      this.lordAction = 'Idle';
      this.lordDirection = 0;
      const arrivedDef = getOverworldNodeById(arrivedNodeId, this.graph);
      if (arrivedDef) {
        this.lordWorldX = arrivedDef.x;
        this.lordWorldY = arrivedDef.y;
      }
      this.saveManager.setOverworldCurrentNode(arrivedNodeId, this.graph);
      this.audioManager.playSfx('dialogue_advance');
      this.syncHudAndDock();
      done();
    }
  }

  // ==========================================================================
  // Viewport Sizing & Camera Clamping
  // ==========================================================================

  private syncViewportDimensions(): void {
    const rect = this.canvasStageEl.getBoundingClientRect();
    const w = Math.max(320, Math.round(rect.width || window.innerWidth || 960));
    const h = Math.max(240, Math.round(rect.height || window.innerHeight || 540));
    this.viewWidthPx = w;
    this.viewHeightPx = h;
    this.displayScale = clampMapScale(this.displayScale, OVERWORLD_SCALE_BOUNDS);

    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
    this.ctx.imageSmoothingEnabled = false;
    this.clampCamera();

    if (!this.resizeObserver && typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => {
        if (!this.openState) return;
        this.syncViewportDimensions();
        this.renderFrame();
      });
      this.resizeObserver.observe(this.canvasStageEl);
    }
  }

  private getMaxCameraBounds(): MapCameraBounds {
    const visibleNativeW = this.viewWidthPx / this.displayScale;
    const visibleNativeH = this.viewHeightPx / this.displayScale;
    return computeCenteredMapCameraBounds(
      this.graph.imageWidth,
      this.graph.imageHeight,
      visibleNativeW,
      visibleNativeH,
      MAP_OVERSCROLL_NATIVE_PX
    );
  }

  private clampCamera(): void {
    const { minX, maxX, minY, maxY } = this.getMaxCameraBounds();
    this.cameraX = Math.max(minX, Math.min(maxX, this.cameraX));
    this.cameraY = Math.max(minY, Math.min(maxY, this.cameraY));
  }

  private centerCameraInitiallyOnLord(): void {
    const visibleNativeW = this.viewWidthPx / this.displayScale;
    const visibleNativeH = this.viewHeightPx / this.displayScale;
    this.cameraX =
      this.graph.imageWidth <= visibleNativeW
        ? (this.graph.imageWidth - visibleNativeW) / 2
        : this.lordWorldX - visibleNativeW / 2;
    this.cameraY =
      this.graph.imageHeight <= visibleNativeH
        ? (this.graph.imageHeight - visibleNativeH) / 2
        : this.lordWorldY - visibleNativeH / 2;
    this.clampCamera();
  }

  private centerCameraOnMapPoint(mapX: number, mapY: number): void {
    const visibleNativeW = this.viewWidthPx / this.displayScale;
    const visibleNativeH = this.viewHeightPx / this.displayScale;
    this.cameraX = mapX - visibleNativeW / 2;
    this.cameraY = mapY - visibleNativeH / 2;
    this.clampCamera();
  }

  private clientPointToWorld(clientX: number, clientY: number): { worldX: number; worldY: number } {
    const rect = this.canvas.getBoundingClientRect();
    const localX = clientX - rect.left;
    const localY = clientY - rect.top;
    return {
      worldX: this.cameraX + localX / this.displayScale,
      worldY: this.cameraY + localY / this.displayScale,
    };
  }

  private applyZoomWithWorldAnchor(
    nextScale: number,
    clientX: number,
    clientY: number,
    anchorWorldX: number,
    anchorWorldY: number
  ): void {
    const clamped = clampMapScale(nextScale, OVERWORLD_SCALE_BOUNDS);
    const rect = this.canvas.getBoundingClientRect();
    const localX = clientX - rect.left;
    const localY = clientY - rect.top;
    this.displayScale = clamped;
    this.cameraX = anchorWorldX - localX / this.displayScale;
    this.cameraY = anchorWorldY - localY / this.displayScale;
    this.clampCamera();
  }

  private canInteractWithMapCanvas(): boolean {
    return this.openState && !this.kecleonShopOpen && !this.systemMenuOpen;
  }

  private ensurePointComfortableInCamera(mapX: number, mapY: number): void {
    const visibleNativeW = this.viewWidthPx / this.displayScale;
    const visibleNativeH = this.viewHeightPx / this.displayScale;
    const padX = Math.min(64, visibleNativeW * 0.25);
    const padY = Math.min(52, visibleNativeH * 0.25);

    if (mapX < this.cameraX + padX) {
      this.cameraX = mapX - padX;
    } else if (mapX > this.cameraX + visibleNativeW - padX) {
      this.cameraX = mapX - (visibleNativeW - padX);
    }
    if (mapY < this.cameraY + padY) {
      this.cameraY = mapY - padY;
    } else if (mapY > this.cameraY + visibleNativeH - padY) {
      this.cameraY = mapY - (visibleNativeH - padY);
    }
    this.clampCamera();
  }

  // ==========================================================================
  // Unified Pointer Event Bindings (Rule 2 — Zero Keyboard Listeners)
  // ==========================================================================

  private clearLongPressTimer(): void {
    if (this.longPressTimer !== null) {
      window.clearTimeout(this.longPressTimer);
      this.longPressTimer = null;
    }
  }

  private hitTestNodeAtLocalCss(localCssX: number, localCssY: number): OverworldNodeDefinition | null {
    const hitRadiusCss = Math.max(26, 9 * this.displayScale);
    let best: OverworldNodeDefinition | null = null;
    let bestDist = hitRadiusCss;

    for (const def of this.graph.nodes) {
      const nodeCssX = (def.x - this.cameraX) * this.displayScale;
      const nodeCssY = (def.y - this.cameraY) * this.displayScale;
      const d = Math.hypot(localCssX - nodeCssX, localCssY - nodeCssY);
      if (d <= bestDist) {
        bestDist = d;
        best = def;
      }
    }
    return best;
  }

  private bindPointerInteractions(): void {
    const signal = this.abortController.signal;

    // Right-click (`contextmenu`) anywhere in Overworld mirrors mobile `Menu`/`Back`
    this.rootEl.addEventListener(
      'contextmenu',
      (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!this.openState) return;
        this.handleMenuOrBack();
      },
      { signal }
    );

    this.canvas.addEventListener(
      'wheel',
      (e: WheelEvent) => {
        if (!this.canInteractWithMapCanvas()) return;
        e.preventDefault();
        const nextScale = computeWheelZoomScale(this.displayScale, e, OVERWORLD_SCALE_BOUNDS);
        if (nextScale === this.displayScale) return;
        const anchor = this.clientPointToWorld(e.clientX, e.clientY);
        this.applyZoomWithWorldAnchor(
          nextScale,
          e.clientX,
          e.clientY,
          anchor.worldX,
          anchor.worldY
        );
        this.renderFrame();
      },
      { passive: false, signal }
    );

    this.canvas.addEventListener(
      'pointerdown',
      (e: PointerEvent) => {
        if (!this.canInteractWithMapCanvas()) return;
        if (e.pointerType === 'mouse' && e.button !== 0) return;

        try {
          this.canvas.setPointerCapture(e.pointerId);
        } catch {
          // Ignore synthetic events without capture support
        }

        const pinchDown = this.pinchTracker.onPointerDown(
          e,
          this.displayScale,
          (cx, cy) => this.clientPointToWorld(cx, cy)
        );
        if (pinchDown.isMultiTouch) {
          this.clearLongPressTimer();
          this.activePointerId = null;
          this.isDraggingCamera = false;
          this.longPressFired = false;
          return;
        }

        this.activePointerId = e.pointerId;
        this.pointerStartX = e.clientX;
        this.pointerStartY = e.clientY;
        this.pointerStartCamX = this.cameraX;
        this.pointerStartCamY = this.cameraY;
        this.isDraggingCamera = false;
        this.longPressFired = false;

        this.clearLongPressTimer();
        if (e.pointerType !== 'mouse') {
          this.longPressTimer = window.setTimeout(() => {
            this.longPressTimer = null;
            if (
              this.activePointerId === e.pointerId &&
              !this.isDraggingCamera &&
              !this.pinchTracker.isMultiTouchSession()
            ) {
              this.longPressFired = true;
              this.handleMenuOrBack();
            }
          }, LONG_PRESS_MS);
        }
      },
      { signal }
    );

    this.canvas.addEventListener(
      'pointermove',
      (e: PointerEvent) => {
        if (!this.canInteractWithMapCanvas()) return;

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
          this.clearLongPressTimer();
          this.renderFrame();
          return;
        }
        if (this.pinchTracker.isMultiTouchSession() && this.activePointerId !== e.pointerId) {
          return;
        }

        const rect = this.canvas.getBoundingClientRect();
        const localX = e.clientX - rect.left;
        const localY = e.clientY - rect.top;

        if (this.activePointerId === e.pointerId) {
          const dx = e.clientX - this.pointerStartX;
          const dy = e.clientY - this.pointerStartY;
          if (!this.isDraggingCamera && Math.hypot(dx, dy) > DRAG_THRESHOLD_PX) {
            this.isDraggingCamera = true;
            this.clearLongPressTimer();
          }
          if (this.isDraggingCamera) {
            this.cameraX = this.pointerStartCamX - dx / this.displayScale;
            this.cameraY = this.pointerStartCamY - dy / this.displayScale;
            this.clampCamera();
            this.renderFrame();
          }
          return;
        }

        if (e.pointerType === 'mouse' && !this.activeTravel) {
          const hovered = this.hitTestNodeAtLocalCss(localX, localY);
          const nextHoverId = hovered?.id ?? null;
          if (nextHoverId !== this.hoveredNodeId) {
            this.hoveredNodeId = nextHoverId;
            const save = this.saveManager.getSave();
            if (save && nextHoverId) {
              const reconciled = ensureOverworldGraphState(save, this.graph);
              if (nextHoverId !== reconciled.currentNodeId && reconciled.nodes[nextHoverId]?.unlocked) {
                this.hoverRoutePreview = findOverworldRoute(
                  this.graph,
                  reconciled.nodes,
                  reconciled.currentNodeId,
                  nextHoverId
                );
              } else {
                this.hoverRoutePreview = null;
              }
            } else {
              this.hoverRoutePreview = null;
            }
            this.renderFrame();
          }
        }
      },
      { signal }
    );

    const finishPointer = (e: PointerEvent, cancelled: boolean) => {
      try {
        if (this.canvas.hasPointerCapture(e.pointerId)) {
          this.canvas.releasePointerCapture(e.pointerId);
        }
      } catch {
        // Ignore
      }

      const pinchUp = this.pinchTracker.onPointerUp(e);
      if (pinchUp.hadMultiTouch) {
        this.clearLongPressTimer();
        this.longPressFired = false;
        if (pinchUp.remainingPointer) {
          this.activePointerId = pinchUp.remainingPointer.pointerId;
          this.pointerStartX = pinchUp.remainingPointer.clientX;
          this.pointerStartY = pinchUp.remainingPointer.clientY;
          this.pointerStartCamX = this.cameraX;
          this.pointerStartCamY = this.cameraY;
          this.isDraggingCamera = true;
        } else {
          this.activePointerId = null;
          this.isDraggingCamera = false;
        }
        return;
      }

      if (this.activePointerId !== e.pointerId) return;
      this.clearLongPressTimer();

      const wasDrag = this.isDraggingCamera;
      const wasLongPress = this.longPressFired;
      this.activePointerId = null;
      this.isDraggingCamera = false;
      this.longPressFired = false;

      if (cancelled || wasDrag || wasLongPress || !this.openState) return;
      if (this.kecleonShopOpen || this.systemMenuOpen) return;

      const rect = this.canvas.getBoundingClientRect();
      const localX = e.clientX - rect.left;
      const localY = e.clientY - rect.top;
      const tappedNode = this.hitTestNodeAtLocalCss(localX, localY);
      if (tappedNode) {
        void this.handleNodeTapped(tappedNode);
      }
    };

    this.canvas.addEventListener('pointerup', (e) => finishPointer(e, false), { signal });
    this.canvas.addEventListener('pointercancel', (e) => finishPointer(e, true), { signal });

    // Bottom Dock Buttons
    bindPointerTap(
      this.btnEnterChapterEl,
      () => {
        if (this.activeTravel) return;
        this.launchCurrentChapterBattle();
      },
      { signal }
    );

    bindPointerTap(
      this.btnFightSkirmishEl,
      () => {
        if (this.activeTravel) return;
        this.launchCurrentSkirmishBattle();
      },
      { signal }
    );

    bindPointerTap(
      this.btnOpenShopEl,
      () => {
        if (this.activeTravel) return;
        this.openKecleonShop();
      },
      { signal }
    );

    // Kecleon Shop Modal Controls
    bindPointerTap(
      this.kecleonBackdropEl.querySelector<HTMLElement>('[data-testid="kecleon-shop-close-btn"]'),
      () => this.closeKecleonShop(),
      { signal }
    );
    bindPointerTap(
      this.kecleonBackdropEl.querySelector<HTMLElement>('[data-testid="kecleon-open-units-btn"]'),
      () => {
        this.closeKecleonShop();
        this.openSystemMenu('units');
      },
      { signal }
    );

    // Overworld System Menu Controls
    bindPointerTap(
      this.systemMenuBackdropEl.querySelector<HTMLElement>(
        '[data-testid="overworld-menu-close-btn"]'
      ),
      () => this.closeSystemMenu(),
      { signal }
    );
    this.systemMenuBackdropEl.querySelectorAll<HTMLElement>('[data-ow-tab]').forEach((tabBtn) => {
      bindPointerTap(
        tabBtn,
        () => {
          const tab = tabBtn.dataset.owTab as OverworldMenuTab | undefined;
          if (!tab) return;
          this.audioManager.playSfx('select');
          this.activeMenuTab = tab;
          this.pendingSystemConfirm = null;
          this.menuFeedbackMessage = '';
          this.renderSystemMenuBody();
        },
        { signal }
      );
    });
  }

  private async handleNodeTapped(node: OverworldNodeDefinition): Promise<void> {
    if (this.activeTravel) return;
    const save = this.saveManager.getSave();
    if (!save) return;
    const reconciled = ensureOverworldGraphState(save, this.graph);
    const st = reconciled.nodes[node.id];
    if (!st?.unlocked) {
      this.audioManager.playSfx('cancel');
      this.showToast(`${node.name} is locked`);
      return;
    }

    if (node.id === reconciled.currentNodeId) {
      if (st.activeKecleonShop && st.cleared && !st.activeSkirmish) {
        this.openKecleonShop();
      } else if (!st.cleared) {
        this.launchCurrentChapterBattle();
      } else if (st.activeSkirmish) {
        this.launchCurrentSkirmishBattle();
      } else {
        this.audioManager.playSfx('select');
        this.centerCameraOnMapPoint(this.lordWorldX, this.lordWorldY);
        this.renderFrame();
      }
      return;
    }

    this.hoverRoutePreview = null;
    await this.travelToNode(node.id);
  }

  // ==========================================================================
  // Chapter Battle, Feral Skirmish & Kecleon Shop Flows
  // ==========================================================================

  private launchCurrentChapterBattle(): void {
    const save = this.saveManager.getSave();
    if (!save) return;
    const reconciled = ensureOverworldGraphState(save, this.graph);
    const def = getOverworldNodeById(reconciled.currentNodeId, this.graph);
    const st = def ? reconciled.nodes[def.id] : undefined;
    if (!def || st?.cleared) return;

    this.audioManager.playSfx('select');
    if (this.onLaunchChapterBattle) {
      this.onLaunchChapterBattle({
        nodeId: def.id,
        levelId: def.levelId,
      });
    }
  }

  private launchCurrentSkirmishBattle(): void {
    const save = this.saveManager.getSave();
    if (!save) return;
    const reconciled = ensureOverworldGraphState(save, this.graph);
    const def = getOverworldNodeById(reconciled.currentNodeId, this.graph);
    const skirmish = reconciled.nodes[reconciled.currentNodeId]?.activeSkirmish;
    if (!def || !skirmish) return;

    this.audioManager.playSfx('select');
    const payload = buildSkirmishBattlePayload(def, skirmish);
    if (this.onLaunchSkirmishBattle) {
      this.onLaunchSkirmishBattle({
        nodeId: def.id,
        customMap: payload.customMap,
        enemyOverrides: payload.enemyOverrides,
        goldBounty: payload.goldBounty,
      });
    }
  }

  public openKecleonShop(): void {
    const save = this.saveManager.getSave();
    if (!save) return;
    const reconciled = ensureOverworldGraphState(save, this.graph);
    const shop = reconciled.nodes[reconciled.currentNodeId]?.activeKecleonShop;
    if (!shop) {
      this.audioManager.playSfx('cancel');
      this.showToast('No shop here.');
      return;
    }

    this.kecleonShopOpen = true;
    this.kecleonStatusMessage = '';
    this.kecleonBackdropEl.hidden = false;
    void this.kecleonPortraitView.setPortrait({
      speciesIdOrAssetId: KECLEON_PMD_ASSET_ID,
      emotion: 'Happy',
    });
    this.renderKecleonShopContents();
    this.audioManager.playSfx('select');
    this.audioManager.playBgm('kecleon_shop', { fadeMs: 220 });
    this.onLayerStateChanged();
  }

  private closeKecleonShop(): void {
    if (!this.kecleonShopOpen) return;
    this.kecleonShopOpen = false;
    this.kecleonBackdropEl.hidden = true;
    this.audioManager.playSfx('cancel');
    if (this.openState) {
      this.audioManager.playBgm('exploration_theme', { fadeMs: 220 });
    }
    this.onLayerStateChanged();
  }

  private renderKecleonShopContents(): void {
    const save = this.saveManager.getSave();
    if (!save) return;
    const reconciled = ensureOverworldGraphState(save, this.graph);
    const shop = reconciled.nodes[reconciled.currentNodeId]?.activeKecleonShop;

    this.kecleonGoldEl.textContent = `${save.gold}G`;
    this.kecleonStatusEl.textContent = this.kecleonStatusMessage;
    this.kecleonStatusEl.hidden = this.kecleonStatusMessage.length === 0;

    this.kecleonShelfEl.innerHTML = '';

    if (!shop) {
      this.kecleonTitleEl.textContent = 'KECLEON SHOP — SOLD OUT';
      this.kecleonSpeechNameEl.textContent = 'Kecleon';
      this.kecleonSpeechTextEl.textContent = 'Sold out! Safe travels!';
      return;
    }

    const meta = KECLEON_SHOP_METADATA[shop.shopType];
    this.kecleonTitleEl.textContent = meta.title.toUpperCase();
    this.kecleonSpeechNameEl.textContent = 'Kecleon';
    this.kecleonSpeechTextEl.textContent = meta.greeting;

    const shopItems: ItemDefinition[] = [];
    for (const itemId of shop.inventoryItemIds) {
      const item = getItemById(itemId);
      if (item && item.buyPrice !== null) {
        shopItems.push(item);
      }
    }

    if (shopItems.length === 0) {
      this.kecleonTitleEl.textContent = 'KECLEON SHOP — SOLD OUT';
      this.kecleonSpeechNameEl.textContent = 'Kecleon';
      this.kecleonSpeechTextEl.textContent = 'Sold out! Safe travels!';
      return;
    }

    if (!this.selectedShopItemId || !shopItems.some((it) => it.id === this.selectedShopItemId)) {
      this.selectedShopItemId = shopItems[0]!.id;
    }
    const selectedItem =
      shopItems.find((it) => it.id === this.selectedShopItemId) ?? shopItems[0]!;

    const gridEl = document.createElement('div');
    gridEl.className = 'pmd-item-icon-grid';
    gridEl.dataset.testid = 'kecleon-item-grid';
    for (const item of shopItems) {
      gridEl.appendChild(
        createItemIconCell({
          itemId: item.id,
          testId: `kecleon-item-cell-${item.id}`,
          isSelected: item.id === selectedItem.id,
          priceGold: item.buyPrice ?? undefined,
          isDepleted: save.gold < (item.buyPrice ?? 0),
          onSelect: () => {
            this.audioManager.playSfx('select');
            this.selectedShopItemId = item.id;
            this.renderKecleonShopContents();
          },
        })
      );
    }

    const canAfford = save.gold >= (selectedItem.buyPrice ?? 0);
    const bannerEl = document.createElement('div');
    bannerEl.className = 'pmd-item-inspector-banner';
    bannerEl.dataset.testid = 'kecleon-inspector-banner';

    const mainEl = document.createElement('div');
    mainEl.className = 'pmd-item-inspector-main';
    mainEl.appendChild(createMiniItemIcon(selectedItem.id, { sizePx: 28, decorative: true }));

    const copyEl = document.createElement('div');
    copyEl.className = 'pmd-item-inspector-copy';
    const headEl = document.createElement('div');
    headEl.className = 'pmd-item-inspector-head';
    const nameEl = document.createElement('strong');
    nameEl.className = 'pmd-item-inspector-name';
    nameEl.textContent = selectedItem.name;
    const priceEl = document.createElement('span');
    priceEl.className = 'pmd-kecleon-item-price';
    priceEl.textContent = `${selectedItem.buyPrice}G`;
    headEl.append(nameEl, priceEl);

    const descEl = document.createElement('span');
    descEl.className = 'pmd-item-inspector-desc';
    descEl.textContent = selectedItem.description;
    copyEl.append(headEl, descEl);

    if (selectedItem.category === 'tm') {
      const compatibleUnits = save.roster.filter((u) => {
        const sp = getSpeciesById(u.speciesId);
        const mvId = selectedItem.effect.teachesMoveId;
        return (
          sp &&
          sp.compatibleTmIds.includes(selectedItem.id) &&
          (!mvId || !u.unlockedMoveIds.includes(mvId))
        );
      });
      const fitsRow = document.createElement('div');
      fitsRow.className = 'pmd-kecleon-tm-fits';
      fitsRow.dataset.testid = `kecleon-tm-fits-${selectedItem.id}`;
      const fitsLbl = document.createElement('span');
      fitsLbl.className = 'pmd-kecleon-fits-lbl';
      fitsLbl.textContent = 'Fits:';
      fitsRow.appendChild(fitsLbl);

      if (compatibleUnits.length > 0) {
        for (const u of compatibleUnits) {
          fitsRow.appendChild(
            createMiniSpeciesPortrait(resolveUnitVisualAssetId(u.speciesId, u.cosmeticForm), {
              title: u.nickname,
              testId: `kecleon-tm-fit-${selectedItem.id}-${u.instanceId}`,
              sizePx: 24,
            })
          );
        }
      } else {
        const noneSpan = document.createElement('span');
        noneSpan.className = 'pmd-kecleon-fits-none';
        noneSpan.textContent = 'None';
        fitsRow.appendChild(noneSpan);
      }
      copyEl.appendChild(fitsRow);
    }

    mainEl.appendChild(copyEl);

    const buyBtn = document.createElement('button');
    buyBtn.type = 'button';
    buyBtn.className = 'pmd-btn pmd-btn-primary';
    buyBtn.dataset.testid = `kecleon-buy-${selectedItem.id}`;
    buyBtn.disabled = !canAfford;
    buyBtn.textContent = canAfford ? `Buy (${selectedItem.buyPrice}G)` : `${selectedItem.buyPrice}G`;

    bindPointerTap(buyBtn, () => {
      try {
        const outcome = this.saveManager.buyKecleonShopItem(
          reconciled.currentNodeId,
          selectedItem.id,
          this.graph
        );
        this.audioManager.playSfx('heal');
        this.kecleonStatusMessage = `Bought ${outcome.item.name} (${outcome.save.gold}G left).`;
        this.renderKecleonShopContents();
      } catch (err) {
        this.audioManager.playSfx('cancel');
        this.kecleonStatusMessage =
          err instanceof Error ? err.message : 'Purchase failed.';
        this.renderKecleonShopContents();
      }
    });

    bannerEl.append(mainEl, buyBtn);
    this.kecleonShelfEl.append(gridEl, bannerEl);
  }

  // ==========================================================================
  // Overworld System Menu (`Units`, `Items`, `System`)
  // ==========================================================================

  public openSystemMenu(tab: OverworldMenuTab = 'units'): void {
    this.activeMenuTab = tab;
    this.pendingSystemConfirm = null;
    this.menuFeedbackMessage = '';
    this.systemMenuOpen = true;
    this.systemMenuBackdropEl.hidden = false;
    this.audioManager.playSfx('select');
    this.renderSystemMenuBody();
    this.onLayerStateChanged();
  }

  private closeSystemMenu(): void {
    if (!this.systemMenuOpen) return;
    this.systemMenuOpen = false;
    this.pendingSystemConfirm = null;
    this.systemMenuBackdropEl.hidden = true;
    this.audioManager.playSfx('cancel');
    this.onLayerStateChanged();
  }

  private setMenuFeedback(msg: string): void {
    this.menuFeedbackMessage = msg.trim();
    this.menuFeedbackEl.textContent = this.menuFeedbackMessage;
    this.menuFeedbackEl.hidden = this.menuFeedbackMessage.length === 0;
  }

  private renderSystemMenuBody(): void {
    this.systemMenuBackdropEl.querySelectorAll<HTMLElement>('[data-ow-tab]').forEach((btn) => {
      btn.classList.toggle('is-active', btn.dataset.owTab === this.activeMenuTab);
    });
    this.setMenuFeedback(this.menuFeedbackMessage);
    this.menuPanelBodyEl.innerHTML = '';

    const save = this.saveManager.getSave();
    if (!save) return;

    if (this.activeMenuTab === 'units') {
      this.renderUnitsRosterTab(save);
    } else if (this.activeMenuTab === 'convoy') {
      this.renderConvoyTab(save);
    } else {
      this.renderSystemTab(save);
    }
  }

  private renderUnitsRosterTab(save: SaveData): void {
    if (
      !this.selectedUnitInstanceId ||
      !save.roster.some((u) => u.instanceId === this.selectedUnitInstanceId)
    ) {
      this.selectedUnitInstanceId = save.roster[0]?.instanceId ?? null;
    }

    const grid = document.createElement('div');
    grid.className = 'pmd-overworld-roster-grid';

    const listCol = document.createElement('div');
    listCol.className = 'pmd-overworld-unit-list pmd-unit-portrait-grid';
    listCol.dataset.testid = 'overworld-roster-grid';

    for (const u of save.roster) {
      const uItemId = getUnitEquippedItemId(u);
      const btn = createUnitPortraitCell({
        speciesIdOrAssetId: resolveUnitVisualAssetId(u.speciesId, u.cosmeticForm),
        ariaLabel: u.nickname,
        testId: `overworld-roster-unit-${u.instanceId}`,
        portraitTestId: `overworld-roster-portrait-${u.instanceId}`,
        isSelected: u.instanceId === this.selectedUnitInstanceId,
        isLord: u.isLord,
        hasItem: Boolean(uItemId),
        equippedItemId: uItemId,
        onSelect: () => {
          this.audioManager.playSfx('select');
          this.selectedUnitInstanceId = u.instanceId;
          this.menuFeedbackMessage = '';
          this.renderSystemMenuBody();
        },
      });
      listCol.appendChild(btn);
    }

    const detailCol = document.createElement('div');
    detailCol.className = 'pmd-overworld-unit-detail';

    const selected = save.roster.find((u) => u.instanceId === this.selectedUnitInstanceId);
    if (selected) {
      const sp = getSpeciesById(selected.speciesId);
      const skill = sp ? getPersonalSkillById(sp.personalSkillId) : undefined;
      const equippedItemId = getUnitEquippedItemId(selected);
      const equippedItem = equippedItemId ? getItemById(equippedItemId) : undefined;
      const showSpeciesMeta =
        sp && selected.nickname.trim().toLowerCase() !== sp.name.trim().toLowerCase()
          ? `${sp.name} · `
          : '';

      const headerRow = document.createElement('div');
      headerRow.className = 'pmd-devtools-row-between';
      headerRow.innerHTML = `
        <div class="pmd-forecast-unit-head">
          <div class="pmd-forecast-portrait-slot" data-ow-unit-portrait></div>
          <div class="pmd-forecast-unit-id">
            <strong class="pmd-forecast-unit-name" data-testid="overworld-unit-detail-name">${selected.nickname}${selected.isLord ? ' ★' : ''}</strong>
            <span class="pmd-forecast-unit-meta">${showSpeciesMeta}Lv. ${selected.level} · ${sp?.types.join('/') ?? ''} · ${sp?.traversalClass ?? 'Grounded'}</span>
          </div>
        </div>
        <button type="button" class="pmd-btn pmd-chip-btn" data-testid="overworld-unit-rename-btn">Rename</button>
      `;

      if (!this.unitDetailPortraitView) {
        this.unitDetailPortraitView = new PmdPortraitView({ testId: 'overworld-unit-portrait' });
      }
      headerRow
        .querySelector('[data-ow-unit-portrait]')!
        .appendChild(this.unitDetailPortraitView.canvas);
      void this.unitDetailPortraitView.setPortrait({
        speciesIdOrAssetId: resolveUnitVisualAssetId(selected.speciesId, selected.cosmeticForm),
        emotion: 'Normal',
      });

      bindPointerTap(
        headerRow.querySelector<HTMLElement>('[data-testid="overworld-unit-rename-btn"]'),
        () => {
          if (!this.onRequestRenameUnit) return;
          this.audioManager.playSfx('select');
          void Promise.resolve(this.onRequestRenameUnit(selected.instanceId)).then(() => {
            if (this.systemMenuOpen) {
              this.renderSystemMenuBody();
            }
          });
        }
      );

      // 7-Stat Strip
      const statStrip = document.createElement('div');
      statStrip.className = 'pmd-overworld-stat-strip';
      statStrip.dataset.testid = 'overworld-unit-stats';
      const stats: Array<[string, number, string]> = [
        ['HP', selected.currentStats.hp, 'hp'],
        ['ATK', selected.currentStats.atk, 'atk'],
        ['DEF', selected.currentStats.def, 'def'],
        ['SPA', selected.currentStats.spa, 'spa'],
        ['SPD', selected.currentStats.spd, 'spd'],
        ['SPE', selected.currentStats.spe, 'spe'],
        ['MOV', selected.currentStats.mov, 'mov'],
      ];
      for (const [label, val, key] of stats) {
        const cell = document.createElement('div');
        cell.className = 'pmd-overworld-stat-cell';
        cell.innerHTML = `<span>${label}</span><strong data-testid="overworld-stat-${key}">${val}</strong>`;
        statStrip.appendChild(cell);
      }

      // Concise Ability + Icon-First Item Box
      const gearBox = document.createElement('div');
      gearBox.className = 'pmd-overworld-subbox';
      gearBox.innerHTML = `
        <div class="pmd-overworld-action-row">
          <div class="pmd-overworld-action-meta">
            <strong>${skill?.name ?? 'Ability'}</strong>
            <span>${skill?.description ?? ''}</span>
          </div>
        </div>
      `;
      const itemActionRow = document.createElement('div');
      itemActionRow.className = 'pmd-overworld-action-row';
      const itemMeta = document.createElement('div');
      itemMeta.className = 'pmd-overworld-action-meta';
      itemMeta.dataset.testid = 'overworld-unit-equipped-item';
      if (equippedItem) {
        const iconRow = document.createElement('div');
        iconRow.className = 'pmd-inline-item-row';
        iconRow.appendChild(createMiniItemIcon(equippedItem.id, { sizePx: 22 }));
        const descSpan = document.createElement('span');
        descSpan.textContent = equippedItem.description;
        iconRow.appendChild(descSpan);
        itemMeta.appendChild(iconRow);
      } else {
        const emptyStrong = document.createElement('strong');
        emptyStrong.textContent = 'Item: Empty';
        itemMeta.appendChild(emptyStrong);
      }
      itemActionRow.appendChild(itemMeta);

      if (equippedItem) {
        const unequipBtn = document.createElement('button');
        unequipBtn.type = 'button';
        unequipBtn.className = 'pmd-btn pmd-chip-btn';
        unequipBtn.dataset.testid = 'overworld-unequip-item-btn';
        unequipBtn.textContent = 'Unequip';
        bindPointerTap(unequipBtn, () => {
          this.audioManager.playSfx('cancel');
          this.saveManager.equipItemToUnit(selected.instanceId, null);
          this.setMenuFeedback(`Returned ${equippedItem.name} to Bag.`);
          this.renderSystemMenuBody();
        });
        itemActionRow.appendChild(unequipBtn);
      }
      gearBox.appendChild(itemActionRow);

      detailCol.append(headerRow, statStrip, gearBox);

      // Conditional Evolution Promotion Box (only when applicable stone/gem is owned)
      const ownedBranches = (sp?.evolutions ?? []).filter(
        (b) =>
          selected.consumableItemId === b.requiredItemId ||
          save.convoy.some((c) => c.itemId === b.requiredItemId && c.quantity > 0)
      );
      if (ownedBranches.length > 0) {
        const promoBox = document.createElement('div');
        promoBox.className = 'pmd-overworld-subbox';
        promoBox.innerHTML = `<p class="pmd-overworld-subbox-title">Evolution</p>`;
        for (const branch of ownedBranches) {
          const targetSp = getSpeciesById(branch.targetSpeciesId);
          const meetsLevel = selected.level >= branch.minLevel;
          const row = document.createElement('div');
          row.className = 'pmd-overworld-action-row';
          const metaDiv = document.createElement('div');
          metaDiv.className = 'pmd-overworld-action-meta';
          const titleStrong = document.createElement('strong');
          titleStrong.textContent = `Evolve → ${targetSp?.name ?? branch.targetSpeciesId}`;
          const reqRow = document.createElement('div');
          reqRow.className = 'pmd-inline-item-row';
          reqRow.appendChild(createMiniItemIcon(branch.requiredItemId, { sizePx: 20 }));
          const lvlSpan = document.createElement('span');
          lvlSpan.textContent = `Lv. ${branch.minLevel}+`;
          reqRow.appendChild(lvlSpan);
          metaDiv.append(titleStrong, reqRow);

          const evoBtn = document.createElement('button');
          evoBtn.type = 'button';
          evoBtn.className = 'pmd-btn pmd-btn-primary pmd-chip-btn';
          evoBtn.dataset.testid = `overworld-promote-${branch.targetSpeciesId}`;
          evoBtn.disabled = !meetsLevel;
          evoBtn.textContent = 'Evolve';
          bindPointerTap(evoBtn, () => {
            try {
              this.saveManager.useEvolutionItemOnUnit(
                selected.instanceId,
                branch.requiredItemId,
                branch.targetSpeciesId
              );
              this.audioManager.playSfx('victory_fanfare');
              this.preloadActiveSprites();
              this.setMenuFeedback(
                `${selected.nickname} evolved into ${targetSp?.name ?? branch.targetSpeciesId}!`
              );
              this.renderSystemMenuBody();
            } catch (err) {
              this.audioManager.playSfx('cancel');
              this.setMenuFeedback(err instanceof Error ? err.message : 'Cannot evolve yet.');
            }
          });
          row.append(metaDiv, evoBtn);
          promoBox.appendChild(row);
        }
        detailCol.appendChild(promoBox);
      }

      // Conditional Stat Vitamins Box (compact icon strip + inline inspector banner)
      const vitaminsInBag = save.convoy.filter(
        (c) => c.quantity > 0 && getItemById(c.itemId)?.category === 'vitamin'
      );
      if (vitaminsInBag.length > 0) {
        if (
          !this.selectedUnitVitaminId ||
          !vitaminsInBag.some((v) => v.itemId === this.selectedUnitVitaminId)
        ) {
          this.selectedUnitVitaminId = vitaminsInBag[0]!.itemId;
        }
        const selVitSlot =
          vitaminsInBag.find((v) => v.itemId === this.selectedUnitVitaminId) ?? vitaminsInBag[0]!;
        const selVitItem = getItemById(selVitSlot.itemId)!;

        const vitaminBox = document.createElement('div');
        vitaminBox.className = 'pmd-overworld-subbox';
        vitaminBox.innerHTML = `<p class="pmd-overworld-subbox-title">Vitamins</p>`;

        const vitStrip = document.createElement('div');
        vitStrip.className = 'pmd-item-icon-grid is-strip';
        vitStrip.dataset.testid = 'overworld-unit-vitamins-grid';
        for (const slot of vitaminsInBag) {
          vitStrip.appendChild(
            createItemIconCell({
              itemId: slot.itemId,
              testId: `overworld-vitamin-cell-${slot.itemId}`,
              quantity: slot.quantity,
              isSelected: slot.itemId === selVitItem.id,
              onSelect: () => {
                this.audioManager.playSfx('select');
                this.selectedUnitVitaminId = slot.itemId;
                this.renderSystemMenuBody();
              },
            })
          );
        }

        const vitBanner = document.createElement('div');
        vitBanner.className = 'pmd-item-inspector-banner';
        vitBanner.style.marginTop = '6px';
        const vitMain = document.createElement('div');
        vitMain.className = 'pmd-item-inspector-main';
        vitMain.appendChild(createMiniItemIcon(selVitItem.id, { sizePx: 24, decorative: true }));
        const vitCopy = document.createElement('div');
        vitCopy.className = 'pmd-item-inspector-copy';
        vitCopy.innerHTML = `
          <div class="pmd-item-inspector-head"><strong class="pmd-item-inspector-name">${selVitItem.name} ×${selVitSlot.quantity}</strong></div>
          <span class="pmd-item-inspector-desc">${selVitItem.description}</span>
        `;
        vitMain.appendChild(vitCopy);

        const useBtn = document.createElement('button');
        useBtn.type = 'button';
        useBtn.className = 'pmd-btn pmd-btn-primary pmd-chip-btn';
        useBtn.dataset.testid = `overworld-use-vitamin-${selVitItem.id}`;
        useBtn.textContent = 'Use';
        bindPointerTap(useBtn, () => {
          try {
            this.saveManager.useVitaminOnUnit(selected.instanceId, selVitItem.id);
            this.audioManager.playSfx('heal');
            this.setMenuFeedback(`Used ${selVitItem.name} on ${selected.nickname}!`);
            this.renderSystemMenuBody();
          } catch (err) {
            this.audioManager.playSfx('cancel');
            this.setMenuFeedback(err instanceof Error ? err.message : 'Could not use Vitamin.');
          }
        });

        vitBanner.append(vitMain, useBtn);
        vitaminBox.append(vitStrip, vitBanner);
        detailCol.appendChild(vitaminBox);
      }

      // Conditional Technical Machines Box (compact icon strip + inline inspector banner)
      const tmsInBag = save.convoy.filter(
        (c) => c.quantity > 0 && getItemById(c.itemId)?.category === 'tm'
      );
      if (tmsInBag.length > 0) {
        if (
          !this.selectedUnitTmId ||
          !tmsInBag.some((t) => t.itemId === this.selectedUnitTmId)
        ) {
          const firstTeachable = tmsInBag.find((slot) => {
            const it = getItemById(slot.itemId);
            const mvId = it?.effect.teachesMoveId;
            return Boolean(
              it &&
                sp?.compatibleTmIds.includes(it.id) &&
                mvId &&
                !selected.unlockedMoveIds.includes(mvId)
            );
          });
          this.selectedUnitTmId = (firstTeachable ?? tmsInBag[0]!).itemId;
        }
        const selTmSlot =
          tmsInBag.find((t) => t.itemId === this.selectedUnitTmId) ?? tmsInBag[0]!;
        const selTmItem = getItemById(selTmSlot.itemId)!;
        const selMoveId = selTmItem.effect.teachesMoveId ?? '';
        const selMove = getMoveById(selMoveId);
        const selCompatible = Boolean(sp?.compatibleTmIds.includes(selTmItem.id));
        const selAlreadyKnown = Boolean(selMoveId && selected.unlockedMoveIds.includes(selMoveId));
        const selCanTeach = selCompatible && !selAlreadyKnown;

        const tmBox = document.createElement('div');
        tmBox.className = 'pmd-overworld-subbox';
        tmBox.innerHTML = `<p class="pmd-overworld-subbox-title">TMs</p>`;

        const tmStrip = document.createElement('div');
        tmStrip.className = 'pmd-item-icon-grid is-strip';
        tmStrip.dataset.testid = 'overworld-unit-tms-grid';
        for (const slot of tmsInBag) {
          const it = getItemById(slot.itemId)!;
          const mvId = it.effect.teachesMoveId ?? '';
          const compat = Boolean(sp?.compatibleTmIds.includes(it.id));
          const known = Boolean(mvId && selected.unlockedMoveIds.includes(mvId));
          tmStrip.appendChild(
            createItemIconCell({
              itemId: it.id,
              testId: `overworld-tm-cell-${it.id}`,
              quantity: slot.quantity,
              isSelected: it.id === selTmItem.id,
              isDepleted: !(compat && !known),
              onSelect: () => {
                this.audioManager.playSfx('select');
                this.selectedUnitTmId = it.id;
                this.renderSystemMenuBody();
              },
            })
          );
        }

        const tmBanner = document.createElement('div');
        tmBanner.className = 'pmd-item-inspector-banner';
        tmBanner.style.marginTop = '6px';
        const tmMain = document.createElement('div');
        tmMain.className = 'pmd-item-inspector-main';
        tmMain.appendChild(createMiniItemIcon(selTmItem.id, { sizePx: 24, decorative: true }));
        const tmCopy = document.createElement('div');
        tmCopy.className = 'pmd-item-inspector-copy';
        const statusNote = selAlreadyKnown
          ? 'Already known'
          : selCompatible
            ? `Teaches ${selMove?.name ?? selMoveId}`
            : 'Incompatible';
        tmCopy.innerHTML = `
          <div class="pmd-item-inspector-head"><strong class="pmd-item-inspector-name">${selTmItem.name} ×${selTmSlot.quantity}</strong></div>
          <span class="pmd-item-inspector-desc">${statusNote}</span>
        `;
        tmMain.appendChild(tmCopy);

        const teachBtn = document.createElement('button');
        teachBtn.type = 'button';
        teachBtn.className = 'pmd-btn pmd-btn-primary pmd-chip-btn';
        teachBtn.dataset.testid = `overworld-teach-tm-${selTmItem.id}`;
        teachBtn.disabled = !selCanTeach;
        teachBtn.textContent = selAlreadyKnown ? 'Known' : selCompatible ? 'Teach' : 'Incompatible';
        bindPointerTap(teachBtn, () => {
          try {
            this.saveManager.teachTmMove(selected.instanceId, selTmItem.id);
            this.audioManager.playSfx('heal');
            this.setMenuFeedback(
              `${selected.nickname} learned ${selMove?.name ?? selTmItem.name}!`
            );
            this.renderSystemMenuBody();
          } catch (err) {
            this.audioManager.playSfx('cancel');
            this.setMenuFeedback(err instanceof Error ? err.message : 'Could not teach TM.');
          }
        });

        tmBanner.append(tmMain, teachBtn);
        tmBox.append(tmStrip, tmBanner);
        detailCol.appendChild(tmBox);
      }

      // Moves & `[E]` Counter Move Box
      const movesBox = document.createElement('div');
      movesBox.className = 'pmd-overworld-subbox';
      movesBox.innerHTML = `<p class="pmd-overworld-subbox-title">Moves (${selected.activeMoveIds.length}/4 Active · [E] Counter)</p>`;
      for (const mId of selected.unlockedMoveIds) {
        const mv = getMoveById(mId);
        if (!mv) continue;
        const isActive = selected.activeMoveIds.includes(mId);
        const isEquipped = selected.equippedMoveId === mId;
        const canCounter = mv.category === 'Physical' || mv.category === 'Special';
        const row = document.createElement('div');
        row.className = 'pmd-overworld-action-row';
        row.dataset.testid = `overworld-unit-move-${mId}`;
        row.innerHTML = `
          <div class="pmd-overworld-action-meta">
            <strong>${isEquipped ? '[E] ' : ''}${mv.name}</strong>
            <span>${mv.type} · R${mv.range[0]} · ${canCounter ? `Mt ${mv.mt} · Hit ${mv.hit}% · ` : ''}PP ${mv.pp + (selected.bonusPpByMoveId[mId] ?? 0)}</span>
          </div>
          <div class="pmd-inline-btns">
            ${
              isActive && canCounter && !isEquipped
                ? `<button type="button" class="pmd-btn pmd-chip-btn" data-set-eq="${mId}">Set [E]</button>`
                : ''
            }
            ${
              !isActive && selected.activeMoveIds.length < 4
                ? `<button type="button" class="pmd-btn pmd-chip-btn" data-add-active="${mId}">Equip</button>`
                : ''
            }
            ${
              isActive && selected.activeMoveIds.length > 1
                ? `<button type="button" class="pmd-btn pmd-chip-btn" data-rem-active="${mId}">Unequip</button>`
                : ''
            }
          </div>
        `;
        bindPointerTap(row.querySelector<HTMLElement>(`[data-set-eq="${mId}"]`), () => {
          this.audioManager.playSfx('select');
          this.saveManager.setEquippedMove(selected.instanceId, mId);
          this.setMenuFeedback(`[E] ${mv.name} set for Enemy Phase.`);
          this.renderSystemMenuBody();
        });
        bindPointerTap(row.querySelector<HTMLElement>(`[data-add-active="${mId}"]`), () => {
          this.audioManager.playSfx('select');
          this.saveManager.setActiveMoves(selected.instanceId, [...selected.activeMoveIds, mId]);
          this.setMenuFeedback(`Equipped ${mv.name}.`);
          this.renderSystemMenuBody();
        });
        bindPointerTap(row.querySelector<HTMLElement>(`[data-rem-active="${mId}"]`), () => {
          this.audioManager.playSfx('cancel');
          this.saveManager.setActiveMoves(
            selected.instanceId,
            selected.activeMoveIds.filter((id) => id !== mId)
          );
          this.setMenuFeedback(`Unequipped ${mv.name}.`);
          this.renderSystemMenuBody();
        });
        movesBox.appendChild(row);
      }

      detailCol.appendChild(movesBox);
    }

    grid.append(listCol, detailCol);
    this.menuPanelBodyEl.appendChild(grid);
  }

  private renderConvoyTab(save: SaveData): void {
    if (
      !this.selectedUnitInstanceId ||
      !save.roster.some((u) => u.instanceId === this.selectedUnitInstanceId)
    ) {
      this.selectedUnitInstanceId = save.roster[0]?.instanceId ?? null;
    }
    const targetUnit =
      save.roster.find((u) => u.instanceId === this.selectedUnitInstanceId) ?? save.roster[0];

    const unitBar = document.createElement('div');
    unitBar.className = 'pmd-unit-portrait-grid pmd-overworld-items-unit-grid';
    unitBar.dataset.testid = 'overworld-items-unit-grid';
    for (const u of save.roster) {
      const uItemId = getUnitEquippedItemId(u);
      const cell = createUnitPortraitCell({
        speciesIdOrAssetId: resolveUnitVisualAssetId(u.speciesId, u.cosmeticForm),
        ariaLabel: u.nickname,
        testId: `overworld-items-unit-${u.instanceId}`,
        portraitTestId: `overworld-items-portrait-${u.instanceId}`,
        isSelected: u.instanceId === targetUnit?.instanceId,
        isLord: u.isLord,
        hasItem: Boolean(uItemId),
        equippedItemId: uItemId,
        onSelect: () => {
          this.audioManager.playSfx('select');
          this.selectedUnitInstanceId = u.instanceId;
          this.renderSystemMenuBody();
        },
      });
      unitBar.appendChild(cell);
    }

    const slotBanner = document.createElement('div');
    slotBanner.className = 'pmd-prep-slot-banner';
    slotBanner.dataset.testid = 'overworld-items-slot-card';
    slotBanner.style.marginBottom = '0.45rem';
    if (targetUnit) {
      const currentItemId = getUnitEquippedItemId(targetUnit);
      const currentItem = currentItemId ? getItemById(currentItemId) : undefined;
      const infoDiv = document.createElement('div');
      infoDiv.className = 'pmd-prep-slot-info';
      const titleLine = document.createElement('div');
      titleLine.className = 'pmd-inline-item-row';
      const nickStrong = document.createElement('strong');
      nickStrong.textContent = currentItem ? `${targetUnit.nickname}:` : `${targetUnit.nickname}: Empty`;
      titleLine.appendChild(nickStrong);
      if (currentItem) {
        titleLine.appendChild(
          createMiniItemIcon(currentItem.id, {
            sizePx: 22,
            testId: 'overworld-items-slot-icon',
          })
        );
      }
      infoDiv.appendChild(titleLine);
      if (currentItem) {
        const descSpan = document.createElement('span');
        descSpan.className = 'pmd-prep-move-stats';
        descSpan.textContent = currentItem.description;
        infoDiv.appendChild(descSpan);
      }
      slotBanner.appendChild(infoDiv);
      if (currentItem) {
        const unequipBtn = document.createElement('button');
        unequipBtn.type = 'button';
        unequipBtn.className = 'pmd-btn pmd-chip-btn';
        unequipBtn.dataset.testid = 'overworld-items-unequip-btn';
        unequipBtn.textContent = 'Unequip';
        bindPointerTap(unequipBtn, () => {
          this.audioManager.playSfx('cancel');
          this.saveManager.equipItemToUnit(targetUnit.instanceId, null);
          this.setMenuFeedback(`Returned ${currentItem.name} to Bag.`);
          this.renderSystemMenuBody();
        });
        slotBanner.appendChild(unequipBtn);
      }
    }

    const box = document.createElement('div');
    box.className = 'pmd-overworld-subbox';
    box.innerHTML = `<p class="pmd-overworld-subbox-title">Bag (${save.gold}G)</p>`;

    const validBagEntries: Array<{ item: ItemDefinition; quantity: number }> = [];
    for (const entry of save.convoy) {
      if (entry.quantity <= 0) continue;
      const item = getItemById(entry.itemId);
      if (item) {
        validBagEntries.push({ item, quantity: entry.quantity });
      }
    }

    if (validBagEntries.length === 0) {
      box.innerHTML += `<span style="font-size:0.72rem;color:#b8dcff;">Bag is empty.</span>`;
    } else {
      const targetItemId = targetUnit ? getUnitEquippedItemId(targetUnit) : null;
      if (
        !this.selectedConvoyItemId ||
        !validBagEntries.some((e) => e.item.id === this.selectedConvoyItemId)
      ) {
        this.selectedConvoyItemId =
          targetItemId && validBagEntries.some((e) => e.item.id === targetItemId)
            ? targetItemId
            : validBagEntries[0]!.item.id;
      }
      const selBag =
        validBagEntries.find((e) => e.item.id === this.selectedConvoyItemId) ?? validBagEntries[0]!;
      const selItem = selBag.item;

      const bagGrid = document.createElement('div');
      bagGrid.className = 'pmd-item-icon-grid';
      bagGrid.dataset.testid = 'overworld-convoy-grid';
      for (const entry of validBagEntries) {
        bagGrid.appendChild(
          createItemIconCell({
            itemId: entry.item.id,
            testId: `overworld-convoy-cell-${entry.item.id}`,
            quantity: entry.quantity,
            isSelected: entry.item.id === selItem.id,
            isEquippedOnSelected: targetItemId === entry.item.id,
            onSelect: () => {
              this.audioManager.playSfx('select');
              this.selectedConvoyItemId = entry.item.id;
              this.renderSystemMenuBody();
            },
          })
        );
      }

      const bagBanner = document.createElement('div');
      bagBanner.className = 'pmd-item-inspector-banner';
      bagBanner.dataset.testid = 'overworld-convoy-inspector';
      bagBanner.style.marginTop = '6px';

      const bagMain = document.createElement('div');
      bagMain.className = 'pmd-item-inspector-main';
      bagMain.appendChild(createMiniItemIcon(selItem.id, { sizePx: 26, decorative: true }));
      const bagCopy = document.createElement('div');
      bagCopy.className = 'pmd-item-inspector-copy';
      bagCopy.innerHTML = `
        <div class="pmd-item-inspector-head"><strong class="pmd-item-inspector-name">${selItem.name} ×${selBag.quantity}</strong></div>
        <span class="pmd-item-inspector-desc">${selItem.description}</span>
      `;
      bagMain.appendChild(bagCopy);
      bagBanner.appendChild(bagMain);

      const equippable = selItem.equipSlot === 'held' || selItem.equipSlot === 'consumable';
      if (equippable && targetUnit) {
        const giveBtn = document.createElement('button');
        giveBtn.type = 'button';
        giveBtn.className = 'pmd-btn pmd-btn-primary pmd-chip-btn pmd-portrait-action-btn';
        giveBtn.dataset.equipConvoy = selItem.id;
        giveBtn.dataset.testid = `overworld-convoy-equip-btn-${selItem.id}`;
        giveBtn.appendChild(
          createMiniSpeciesPortrait(
            resolveUnitVisualAssetId(targetUnit.speciesId, targetUnit.cosmeticForm),
            {
              title: targetUnit.nickname,
              sizePx: 20,
            }
          )
        );
        const lbl = document.createElement('span');
        lbl.textContent = targetItemId ? 'Replace' : 'Equip';
        giveBtn.appendChild(lbl);
        bindPointerTap(giveBtn, () => {
          this.audioManager.playSfx('select');
          this.saveManager.equipItemToUnit(targetUnit.instanceId, selItem.id);
          this.setMenuFeedback(`Equipped ${selItem.name} on ${targetUnit.nickname}.`);
          this.renderSystemMenuBody();
        });
        bagBanner.appendChild(giveBtn);
      }

      box.append(bagGrid, bagBanner);
    }

    this.menuPanelBodyEl.append(unitBar, slotBanner, box);
  }

  private renderSystemTab(save: SaveData): void {
    const sync = this.saveManager.getSyncStatus();
    const audioSettings = this.audioManager.getSettings();

    // 1. Audio Controls Box
    const audioBox = document.createElement('div');
    audioBox.className = 'pmd-overworld-subbox';
    audioBox.innerHTML = `
      <p class="pmd-overworld-subbox-title">Audio</p>
      <div class="pmd-overworld-action-row">
        <button type="button" class="pmd-btn pmd-chip-btn${audioSettings.muted ? '' : ' is-active'}" data-testid="overworld-audio-mute-btn">
          ${audioSettings.muted ? 'Audio: Muted' : 'Audio: ON'}
        </button>
        <label style="display:flex;align-items:center;gap:0.4rem;font-size:0.75rem;">
          <span>BGM</span>
          <input type="range" min="0" max="100" value="${Math.round(audioSettings.bgmVolume * 100)}" data-testid="overworld-bgm-slider" />
        </label>
        <label style="display:flex;align-items:center;gap:0.4rem;font-size:0.75rem;">
          <span>SFX</span>
          <input type="range" min="0" max="100" value="${Math.round(audioSettings.sfxVolume * 100)}" data-testid="overworld-sfx-slider" />
        </label>
      </div>
    `;

    bindPointerTap(
      audioBox.querySelector<HTMLElement>('[data-testid="overworld-audio-mute-btn"]'),
      () => {
        const nowMuted = this.audioManager.toggleMute();
        if (!nowMuted) this.audioManager.playSfx('select');
        this.renderSystemMenuBody();
      }
    );

    const bgmSlider = audioBox.querySelector<HTMLInputElement>('[data-testid="overworld-bgm-slider"]');
    bgmSlider?.addEventListener('input', () => {
      this.audioManager.setBgmVolume(Number(bgmSlider.value) / 100);
    });

    const sfxSlider = audioBox.querySelector<HTMLInputElement>('[data-testid="overworld-sfx-slider"]');
    sfxSlider?.addEventListener('input', () => {
      this.audioManager.setSfxVolume(Number(sfxSlider.value) / 100);
    });

    // 2. Save Sync & Backup Box
    const saveBox = document.createElement('div');
    saveBox.className = 'pmd-overworld-subbox';
    saveBox.style.marginTop = '0.5rem';
    saveBox.innerHTML = `
      <p class="pmd-overworld-subbox-title">Save Data</p>
      <div class="pmd-overworld-action-row">
        <div class="pmd-overworld-action-meta">
          <strong>${sync.user?.email ?? 'Local Save'}</strong>
          <span>Saved ${new Date(save.lastUpdated).toLocaleTimeString()}</span>
        </div>
        <div class="pmd-inline-btns">
          <button type="button" class="pmd-btn pmd-chip-btn" data-testid="overworld-export-save-btn">Export</button>
          <button type="button" class="pmd-btn pmd-chip-btn" data-testid="overworld-import-save-btn">Import</button>
          <input type="file" accept=".json,application/json" hidden data-ow-import-input />
        </div>
      </div>
    `;

    bindPointerTap(
      saveBox.querySelector<HTMLElement>('[data-testid="overworld-export-save-btn"]'),
      () => {
        try {
          const json = this.saveManager.exportSaveJson();
          const blob = new Blob([json], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `mystery-emblem-save.json`;
          a.click();
          URL.revokeObjectURL(url);
          this.audioManager.playSfx('select');
          this.setMenuFeedback('Exported save backup.');
        } catch (err) {
          this.audioManager.playSfx('cancel');
          this.setMenuFeedback(err instanceof Error ? err.message : 'Export failed.');
        }
      }
    );

    const fileInput = saveBox.querySelector<HTMLInputElement>('[data-ow-import-input]');
    bindPointerTap(
      saveBox.querySelector<HTMLElement>('[data-testid="overworld-import-save-btn"]'),
      () => {
        fileInput?.click();
      }
    );
    fileInput?.addEventListener('change', () => {
      const f = fileInput.files?.[0];
      if (!f) return;
      void f.text().then((raw) => {
        try {
          this.saveManager.importSaveJson(raw);
          this.snapLordToCurrentNode();
          this.centerCameraOnMapPoint(this.lordWorldX, this.lordWorldY);
          this.audioManager.playSfx('heal');
          this.setMenuFeedback('Imported save backup!');
          this.renderSystemMenuBody();
        } catch (err) {
          this.audioManager.playSfx('cancel');
          this.setMenuFeedback(err instanceof Error ? err.message : 'Invalid save JSON.');
        }
      });
    });

    // 3. Campaign Actions Box (`New Game`, `Delete Save`, `Title Screen`)
    const actionsBox = document.createElement('div');
    actionsBox.className = 'pmd-overworld-subbox';
    actionsBox.style.marginTop = '0.5rem';
    actionsBox.innerHTML = `
      <p class="pmd-overworld-subbox-title">Campaign</p>
      <div class="pmd-inline-btns">
        <button type="button" class="pmd-btn" data-testid="overworld-new-game-btn">New Game</button>
        <button type="button" class="pmd-btn pmd-btn-danger" data-testid="overworld-delete-save-btn">Delete Save</button>
        <button type="button" class="pmd-btn" data-testid="overworld-exit-btn">Title Screen</button>
      </div>
      <div data-ow-confirm-slot style="margin-top:0.45rem;" ${this.pendingSystemConfirm ? '' : 'hidden'}></div>
    `;

    bindPointerTap(
      actionsBox.querySelector<HTMLElement>('[data-testid="overworld-new-game-btn"]'),
      () => {
        this.audioManager.playSfx('select');
        this.pendingSystemConfirm = 'new_game';
        this.renderSystemMenuBody();
      }
    );

    bindPointerTap(
      actionsBox.querySelector<HTMLElement>('[data-testid="overworld-delete-save-btn"]'),
      () => {
        this.audioManager.playSfx('select');
        this.pendingSystemConfirm = 'delete_save';
        this.renderSystemMenuBody();
      }
    );

    bindPointerTap(actionsBox.querySelector<HTMLElement>('[data-testid="overworld-exit-btn"]'), () => {
      this.audioManager.playSfx('cancel');
      this.close();
    });

    const confirmSlot = actionsBox.querySelector<HTMLElement>('[data-ow-confirm-slot]');
    if (confirmSlot && this.pendingSystemConfirm) {
      if (this.pendingSystemConfirm === 'new_game') {
        confirmSlot.innerHTML = `
          <div class="pmd-overworld-action-row">
            <span style="color:#ffd878;font-size:0.78rem;">Start a new run? Current progress will be replaced.</span>
            <div class="pmd-inline-btns">
              <button type="button" class="pmd-btn pmd-btn-primary pmd-chip-btn" data-testid="overworld-confirm-new-game-btn">Start New Game</button>
              <button type="button" class="pmd-btn pmd-chip-btn" data-ow-cancel-confirm>Cancel</button>
            </div>
          </div>
        `;
        bindPointerTap(
          confirmSlot.querySelector<HTMLElement>('[data-testid="overworld-confirm-new-game-btn"]'),
          () => {
            this.audioManager.playSfx('select');
            this.closeInternal(false);
            this.onRequestNewGame?.();
          }
        );
      } else {
        confirmSlot.innerHTML = `
          <div class="pmd-overworld-action-row">
            <span style="color:#ff9aa2;font-size:0.78rem;">Delete your save file permanently?</span>
            <div class="pmd-inline-btns">
              <button type="button" class="pmd-btn pmd-btn-danger pmd-chip-btn" data-testid="overworld-confirm-delete-save-btn">Confirm Delete</button>
              <button type="button" class="pmd-btn pmd-chip-btn" data-ow-cancel-confirm>Cancel</button>
            </div>
          </div>
        `;
        bindPointerTap(
          confirmSlot.querySelector<HTMLElement>(
            '[data-testid="overworld-confirm-delete-save-btn"]'
          ),
          () => {
            this.audioManager.playSfx('cancel');
            void this.saveManager.deleteSaveFromLinkedAccount().then(() => {
              this.close();
            });
          }
        );
      }
      bindPointerTap(confirmSlot.querySelector<HTMLElement>('[data-ow-cancel-confirm]'), () => {
        this.audioManager.playSfx('cancel');
        this.pendingSystemConfirm = null;
        this.renderSystemMenuBody();
      });
    }

    this.menuPanelBodyEl.append(audioBox, saveBox, actionsBox);
  }

  // ==========================================================================
  // HUD, Dock & Toast Updates
  // ==========================================================================

  private showToast(text: string): void {
    if (this.toastTimer !== null) {
      window.clearTimeout(this.toastTimer);
    }
    this.toastEl.textContent = text;
    this.toastEl.hidden = false;
    this.toastTimer = window.setTimeout(
      () => {
        this.toastEl.hidden = true;
        this.toastTimer = null;
      },
      this.fastMode ? 350 : 1800
    );
  }

  private syncHudAndDock(): void {
    const save = this.saveManager.getSave();
    if (!save) return;
    const reconciled = ensureOverworldGraphState(save, this.graph);
    const lord = this.getActiveLordUnit(save);

    this.lordHudPillEl.textContent = lord
      ? `${lord.nickname} · Lv.${lord.level}`
      : 'Squad';
    this.goldHudPillEl.textContent = `${save.gold}G`;

    const nodeDef =
      getOverworldNodeById(reconciled.currentNodeId, this.graph) ??
      getOverworldNodeById(this.graph.startNodeId, this.graph);
    const nodeState = nodeDef ? reconciled.nodes[nodeDef.id] : undefined;

    if (!nodeDef) return;

    this.dockTitleEl.textContent = `${nodeDef.code} · ${nodeDef.name}`;

    this.dockBadgesEl.innerHTML = '';
    if (nodeState?.cleared) {
      const statusBadge = document.createElement('span');
      statusBadge.className = 'pmd-overworld-badge is-cleared';
      statusBadge.textContent = 'CLEARED';
      this.dockBadgesEl.appendChild(statusBadge);
    }

    if (nodeState?.activeKecleonShop) {
      const shopMeta = KECLEON_SHOP_METADATA[nodeState.activeKecleonShop.shopType];
      const shopBadge = document.createElement('span');
      shopBadge.className = 'pmd-overworld-badge is-shop';
      shopBadge.textContent = shopMeta.shortBadge;
      this.dockBadgesEl.appendChild(shopBadge);
    }

    if (nodeState?.activeSkirmish) {
      const skBadge = document.createElement('span');
      skBadge.className = 'pmd-overworld-badge is-skirmish';
      skBadge.textContent = 'SKIRMISH';
      this.dockBadgesEl.appendChild(skBadge);
    }

    const canEnterDungeon = !nodeState?.cleared;
    const hasSkirmish = Boolean(nodeState?.activeSkirmish);
    const hasShop = Boolean(nodeState?.activeKecleonShop);

    this.btnEnterChapterEl.hidden = !canEnterDungeon;
    this.btnFightSkirmishEl.hidden = !hasSkirmish;
    this.btnOpenShopEl.hidden = !hasShop;
    this.dockActionsEl.hidden = !canEnterDungeon && !hasSkirmish && !hasShop;
  }

  // ==========================================================================
  // Crisp Pixel-Art Canvas Renderer (`imageSmoothingEnabled = false`)
  // ==========================================================================

  private drawAnimatedSpriteAtMapPoint(
    bundle: LoadedSpriteBundle | undefined,
    action: PmdSpriteAction,
    direction: PmdDirection,
    mapX: number,
    mapY: number,
    tintGlowColor?: string
  ): void {
    if (!bundle) return;
    const anim = bundle.actions[action] ?? bundle.actions.Idle;
    const scale = this.displayScale;
    const spriteScale = scale * OVERWORLD_SPRITE_SCALE_FACTOR;
    const screenX = Math.round((mapX - this.cameraX) * scale);
    const screenY = Math.round((mapY - this.cameraY) * scale);

    const totalAnimMs = Math.max(
      80,
      anim.durationsMs.reduce((acc, d) => acc + Math.max(16, d), 0)
    );
    let rem = this.animClockMs % totalAnimMs;
    let frameIdx = 0;
    for (let i = 0; i < anim.frameCount; i++) {
      const dur = Math.max(16, anim.durationsMs[i] ?? 120);
      if (rem < dur) {
        frameIdx = i;
        break;
      }
      rem -= dur;
    }

    const rowIdx = anim.rowCount > 1 ? direction % anim.rowCount : 0;
    const sx = frameIdx * anim.frameWidth;
    const sy = rowIdx * anim.frameHeight;

    const placement = computePmdTileSpritePlacement(
      -12,
      -20,
      anim.frameWidth,
      anim.frameHeight,
      24
    );
    const drawX = Math.round(screenX + placement.drawX * spriteScale);
    const drawY = Math.round(screenY + placement.drawY * spriteScale);
    const drawW = Math.round(anim.frameWidth * spriteScale);
    const drawH = Math.round(anim.frameHeight * spriteScale);

    this.ctx.save();
    this.ctx.imageSmoothingEnabled = false;

    this.ctx.fillStyle = tintGlowColor ?? 'rgba(8, 12, 24, 0.55)';
    this.ctx.beginPath();
    this.ctx.ellipse(
      screenX,
      screenY + 2 * spriteScale,
      6 * spriteScale,
      2.6 * spriteScale,
      0,
      0,
      Math.PI * 2
    );
    this.ctx.fill();

    this.ctx.drawImage(
      anim.source,
      sx,
      sy,
      anim.frameWidth,
      anim.frameHeight,
      drawX,
      drawY,
      drawW,
      drawH
    );
    this.ctx.restore();
  }

  public renderFrame(): void {
    if (!this.openState) return;
    const ctx = this.ctx;
    const scale = this.displayScale;
    ctx.imageSmoothingEnabled = false;

    ctx.fillStyle = '#080e1c';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // 1. Wonder Map Pixel Art Layer + Crisp Stepped PMD Outer Frame
    if (this.mapSource) {
      const mapDrawX = Math.round(-this.cameraX * scale);
      const mapDrawY = Math.round(-this.cameraY * scale);
      const mapDrawW = Math.round(this.graph.imageWidth * scale);
      const mapDrawH = Math.round(this.graph.imageHeight * scale);

      ctx.fillStyle = 'rgba(2, 6, 14, 0.65)';
      ctx.fillRect(mapDrawX - 4, mapDrawY - 2, mapDrawW + 10, mapDrawH + 10);
      ctx.fillStyle = '#a8c0e0';
      ctx.fillRect(mapDrawX - 4, mapDrawY - 4, mapDrawW + 8, mapDrawH + 8);
      ctx.fillStyle = '#385078';
      ctx.fillRect(mapDrawX - 2, mapDrawY - 2, mapDrawW + 4, mapDrawH + 4);

      ctx.drawImage(this.mapSource, mapDrawX, mapDrawY, mapDrawW, mapDrawH);
    }

    const save = this.saveManager.getSave();
    const reconciled = save
      ? ensureOverworldGraphState(save, this.graph)
      : { currentNodeId: this.graph.startNodeId, nodes: {}, mutated: false };
    const nodeMap = new Map(this.graph.nodes.map((n) => [n.id, n]));
    const pulse01 = 0.5 + 0.5 * Math.sin(this.animClockMs / 240);

    const activeRouteEdgeSet = new Set<string>(
      this.activeTravel?.route.edgeIds ?? this.hoverRoutePreview?.edgeIds ?? []
    );

    // 2. Continent Road Network & Intermediate Waypoint Markers
    for (const edge of this.graph.edges) {
      const a = nodeMap.get(edge.fromNodeId);
      const b = nodeMap.get(edge.toNodeId);
      if (!a || !b) continue;
      const stA = reconciled.nodes[a.id];
      const stB = reconciled.nodes[b.id];
      const bothUnlocked = Boolean(stA?.unlocked && stB?.unlocked);
      const eitherUnlocked = Boolean(stA?.unlocked || stB?.unlocked);
      if (!eitherUnlocked) continue;

      const pts = getEdgePointsOrdered(edge, a, b);
      const isHighlightedRoute = activeRouteEdgeSet.has(edge.id);

      ctx.save();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo((pts[0]!.x - this.cameraX) * scale, (pts[0]!.y - this.cameraY) * scale);
      for (let i = 1; i < pts.length; i++) {
        ctx.lineTo((pts[i]!.x - this.cameraX) * scale, (pts[i]!.y - this.cameraY) * scale);
      }

      if (bothUnlocked) {
        ctx.strokeStyle = '#2b1708';
        ctx.lineWidth = Math.max(6, 2.6 * scale);
        ctx.stroke();

        ctx.strokeStyle = isHighlightedRoute ? '#70f0ff' : '#ffe074';
        ctx.lineWidth = Math.max(3, 1.3 * scale);
        ctx.stroke();

        for (const wp of edge.waypoints) {
          const wx = (wp.x - this.cameraX) * scale;
          const wy = (wp.y - this.cameraY) * scale;
          ctx.fillStyle = isHighlightedRoute ? '#ffffff' : '#fff0a8';
          ctx.beginPath();
          ctx.arc(wx, wy, Math.max(2, 0.85 * scale), 0, Math.PI * 2);
          ctx.fill();
        }
      } else {
        ctx.setLineDash([scale * 2, scale * 2]);
        ctx.strokeStyle = 'rgba(28, 18, 10, 0.55)';
        ctx.lineWidth = Math.max(2, 1.1 * scale);
        ctx.stroke();
      }
      ctx.restore();
    }

    // 3. Landmark Node Crests, Kecleon Merchants & Skirmish Scouts
    for (const def of this.graph.nodes) {
      const st = reconciled.nodes[def.id];
      const isUnlocked = Boolean(st?.unlocked);
      const isCleared = Boolean(st?.cleared);
      const isCurrent = reconciled.currentNodeId === def.id && !this.activeTravel;
      const isHovered = this.hoveredNodeId === def.id;

      const cx = Math.round((def.x - this.cameraX) * scale);
      const cy = Math.round((def.y - this.cameraY) * scale);

      ctx.save();
      if (isCurrent || isHovered) {
        ctx.beginPath();
        ctx.arc(cx, cy, (7.5 + pulse01 * 2) * scale, 0, Math.PI * 2);
        ctx.strokeStyle = isCurrent
          ? `rgba(248, 208, 72, ${(0.55 + pulse01 * 0.4).toFixed(2)})`
          : 'rgba(112, 240, 255, 0.75)';
        ctx.lineWidth = Math.max(2, 1.1 * scale);
        ctx.stroke();
      }

      const crestRadius = (isUnlocked ? 5.2 : 3.8) * scale;
      ctx.beginPath();
      ctx.arc(cx, cy, crestRadius, 0, Math.PI * 2);
      if (!isUnlocked) {
        ctx.fillStyle = 'rgba(28, 36, 52, 0.82)';
        ctx.strokeStyle = '#8898b0';
      } else if (st?.activeSkirmish) {
        ctx.fillStyle = '#a81c2c';
        ctx.strokeStyle = '#ff98a0';
      } else if (!isCleared) {
        ctx.fillStyle = def.kind === 'paralogue' ? '#1c7c54' : '#b8283c';
        ctx.strokeStyle = '#f8d048';
      } else {
        ctx.fillStyle = '#163c74';
        ctx.strokeStyle = isCurrent ? '#f8d048' : '#58c8f8';
      }
      ctx.lineWidth = Math.max(2, 1 * scale);
      ctx.fill();
      ctx.stroke();

      if (isUnlocked) {
        ctx.beginPath();
        ctx.arc(cx, cy, 1.8 * scale, 0, Math.PI * 2);
        ctx.fillStyle = isCleared ? '#90e8ff' : '#ffe888';
        ctx.fill();
      }
      ctx.restore();

      if (isUnlocked && st?.activeKecleonShop) {
        const kecBundle = this.spriteBundles.get(KECLEON_PMD_ASSET_ID);
        this.drawAnimatedSpriteAtMapPoint(
          kecBundle,
          'Idle',
          0,
          def.x + 12,
          def.y - 4,
          'rgba(56, 216, 120, 0.65)'
        );
      }

      if (isUnlocked && st?.activeSkirmish) {
        const scoutBundle = this.spriteBundles.get(def.skirmishScoutSpeciesId);
        this.drawAnimatedSpriteAtMapPoint(
          scoutBundle,
          'Idle',
          0,
          def.x - 12,
          def.y - 4,
          'rgba(255, 72, 88, 0.72)'
        );
      }

      if (isUnlocked) {
        const label = `${def.code}: ${def.name}`;
        ctx.save();
        ctx.font = `bold ${scale >= 4 ? 13 : 11}px "Fusion Pixel 12px Proportional KR", sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const metrics = ctx.measureText(label);
        const padX = 6;
        const boxW = Math.ceil(metrics.width) + padX * 2;
        const boxH = scale >= 4 ? 18 : 16;
        const labelY = cy + Math.round(7.4 * scale);

        ctx.fillStyle = isCurrent ? 'rgba(16, 28, 54, 0.94)' : 'rgba(10, 18, 34, 0.86)';
        ctx.strokeStyle = isCurrent ? '#f8d048' : '#48b8e8';
        ctx.lineWidth = 1.5;
        ctx.fillRect(Math.round(cx - boxW / 2), labelY, boxW, boxH);
        ctx.strokeRect(Math.round(cx - boxW / 2), labelY, boxW, boxH);

        ctx.fillStyle = isCurrent ? '#f8d048' : '#f4f8ff';
        ctx.fillText(label, cx, labelY + boxH / 2 + 0.5);
        ctx.restore();
      }
    }

    // 4. Player's Active Dragon Lord Animated 8-Directional PMD Sprite
    const lord = this.getActiveLordUnit(save);
    const lordBundle = this.spriteBundles.get(lord?.speciesId ?? 'dratini');
    this.drawAnimatedSpriteAtMapPoint(
      lordBundle,
      this.lordAction,
      this.lordDirection,
      this.lordWorldX,
      this.lordWorldY,
      'rgba(248, 208, 72, 0.72)'
    );
  }
}
