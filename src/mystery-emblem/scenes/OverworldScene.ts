/**
 * Mystery Emblem — Fire Emblem Awakening Overworld Map Scene (`OVERWORLD_SCENE`, Step 4)
 *
 * Reusable across both:
 * 1. Admin Dev Tools Overworld Sandbox (`sandboxMode: true`), and
 * 2. Upcoming Campaign / Demo Mode (`sandboxMode: false`).
 *
 * Strictly obeys:
 * - Rule 1: 100% Data-Driven Manual Balance (reads manual registries & skirmish stat blocks)
 * - Rule 2: Unified Pointer Events ONLY (`pointerdown`, `pointermove`, `pointerup`, `pointercancel`);
 *   ZERO keyboard listeners; PC right-click + Mobile long-press + Top-Right `Menu`/`Back` parity;
 *   `>= 44x44px` touch targets; zero clipping on `1920x1080`, `390x844`, and `844x390`.
 * - Rule 3: Authentic PMD: Explorers of Sky visual skin, crisp `imageSmoothingEnabled = false` map & sprites,
 *   Master Merchant Kecleon (`0352`) sprite/portrait, and `#025 Kecleon's Shop` BGM.
 * - Rule 5 & 7: Strict faction separation, 1-item-slot per unit, and instant localStorage + Firestore sync.
 */

import { loadImage } from '../../utils/sprite-utils';
import {
  computePmdTileSpritePlacement,
  loadSpeciesSpriteBundle,
  type LoadedSpriteBundle,
  type PmdDirection,
  type PmdSpriteAction,
} from '../assets/pmdAssetLoader';
import { getAudioManager, type AudioManager } from '../audio/AudioManager';
import {
  ALL_KECLEON_SHOP_TYPES,
  DEFAULT_OVERWORLD_GRAPH,
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
import type { ManualEnemyBattleSpawn } from '../data/playableBattleMap';
import {
  ensureOverworldGraphState,
  findOverworldRoute,
  getEdgePointsOrdered,
  samplePolylineAtDistance,
  type OverworldRouteResult,
} from '../engine/overworldEngine';
import {
  SUPPORT_LEVEL_THRESHOLDS,
  getUnitEquippedItemId,
  makeSupportPairKey,
  type SaveStateManager,
} from '../state/SaveStateManager';
import type {
  DungeonMapDefinition,
  KecleonShopType,
  OverworldNodeState,
  OwnedPokemonInstance,
  SaveData,
} from '../types/schemas';
import { PmdPortraitView } from '../ui/PmdSpriteCanvas';
import { bindPointerTap } from '../ui/pointerControls';

const DRAG_THRESHOLD_PX = 8;
const LONG_PRESS_MS = 520;
const LORD_WALK_SPEED_NORMAL_PX_PER_SEC = 105;
const LORD_WALK_SPEED_FAST_PX_PER_SEC = 560;

export type OverworldMenuTab = 'units' | 'convoy' | 'supports' | 'system';

export interface OverworldSceneOptions {
  viewportEl: HTMLElement;
  saveManager: SaveStateManager;
  audioManager?: AudioManager;
  graph?: OverworldGraphDefinition;
  sandboxMode?: boolean;
  onExit: () => void;
  onLayerStateChanged: () => void;
  onRequestRenameUnit?: (instanceId: string) => void;
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
  sandboxMode: boolean;
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
  sandboxDrawerOpen: boolean;
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
  graph: OverworldGraphDefinition = DEFAULT_OVERWORLD_GRAPH
): Promise<CanvasImageSource> {
  const existing = mapImageCache.get(graph.imageUrl);
  if (existing) return existing;

  const p = loadImage(graph.imageUrl)
    .then((img) => img as CanvasImageSource)
    .catch(() => createFallbackOverworldCanvas(graph.imageWidth, graph.imageHeight));
  mapImageCache.set(graph.imageUrl, p);
  return p;
}

/**
 * Renders a crisp static overview of the Overworld Wonder Map, road network, unlocked/cleared nodes,
 * active Kecleon Shops, Feral Skirmishes, and the Dragon Lord's current node into `canvas`
 * (used by the Admin Dev Tools `Overworld` tab preview).
 */
export async function renderOverworldPreviewCanvas(
  canvas: HTMLCanvasElement,
  save: SaveData | null,
  graph: OverworldGraphDefinition = DEFAULT_OVERWORLD_GRAPH
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

  // Roads
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

  // Nodes
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
      ctx.strokeStyle = '#081810';
      ctx.lineWidth = 1;
      ctx.strokeRect(node.x + 5, node.y - 9, 6, 6);
    }
    if (st?.activeSkirmish) {
      ctx.fillStyle = '#ff4858';
      ctx.fillRect(node.x - 11, node.y - 9, 6, 6);
      ctx.strokeStyle = '#240408';
      ctx.lineWidth = 1;
      ctx.strokeRect(node.x - 11, node.y - 9, 6, 6);
    }
    ctx.restore();
  }
}

export class OverworldScene {
  private readonly viewportEl: HTMLElement;
  private readonly saveManager: SaveStateManager;
  private readonly audioManager: AudioManager;
  private graph: OverworldGraphDefinition;
  private sandboxMode: boolean;
  private readonly onExitCallback: () => void;
  private readonly onLayerStateChanged: () => void;
  private readonly onRequestRenameUnit?: (instanceId: string) => void;
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
  private readonly sandboxToggleBtnEl: HTMLButtonElement;

  // Toast Banner & Bottom Location Dock
  private readonly toastEl: HTMLElement;
  private toastTimer: number | null = null;
  private readonly dockEl: HTMLElement;
  private readonly dockTitleEl: HTMLElement;
  private readonly dockBadgesEl: HTMLElement;
  private readonly dockSubEl: HTMLElement;
  private readonly btnEnterChapterEl: HTMLButtonElement;
  private readonly btnFightSkirmishEl: HTMLButtonElement;
  private readonly btnOpenShopEl: HTMLButtonElement;
  private readonly btnCenterLordEl: HTMLButtonElement;

  // Sandbox Drawer (strictly shown only when `sandboxMode === true`)
  private readonly sandboxDrawerEl: HTMLElement;
  private readonly sandboxSummaryEl: HTMLElement;

  // Kecleon Shop Modal
  private readonly kecleonBackdropEl: HTMLElement;
  private readonly kecleonTitleEl: HTMLElement;
  private readonly kecleonGoldEl: HTMLElement;
  private readonly kecleonSpeechNameEl: HTMLElement;
  private readonly kecleonSpeechTextEl: HTMLElement;
  private readonly kecleonShelfEl: HTMLElement;
  private readonly kecleonStatusEl: HTMLElement;
  private readonly kecleonPortraitView: PmdPortraitView;

  // Overworld System Menu Modal (`Units / Roster`, `Items / Convoy`, `Supports`, `Save / System`)
  private readonly systemMenuBackdropEl: HTMLElement;
  private readonly menuPanelBodyEl: HTMLElement;
  private readonly menuFeedbackEl: HTMLElement;
  private unitDetailPortraitView: PmdPortraitView | null = null;

  private openState = false;
  private previousBgmId: string | null = null;
  private kecleonShopOpen = false;
  private systemMenuOpen = false;
  private sandboxDrawerOpen = false;
  private activeMenuTab: OverworldMenuTab = 'units';
  private selectedUnitInstanceId: string | null = null;
  private menuFeedbackMessage = '';
  private kecleonStatusMessage = '';
  private fastMode = false;

  // Rendering & Camera State
  private mapSource: CanvasImageSource | null = null;
  private readonly spriteBundles = new Map<string, LoadedSpriteBundle>();
  private readonly loadingSpriteIds = new Set<string>();
  private viewWidthPx = 960;
  private viewHeightPx = 540;
  private displayScale = 3;
  private cameraX = 0;
  private cameraY = 0;
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

  // Pointer Panning & Long-Press State
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
    this.graph = options.graph ?? DEFAULT_OVERWORLD_GRAPH;
    this.sandboxMode = Boolean(options.sandboxMode);
    this.onExitCallback = options.onExit;
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

    // 2. Top HUD Bar (Clears top-left `Dev Tools` & top-right `Menu`/`Back`)
    this.topHudBarEl = document.createElement('div');
    this.topHudBarEl.className = 'pmd-battle-hud-top';
    this.topHudBarEl.innerHTML = `
      <div class="pmd-window pmd-window--compact pmd-battle-pill" data-testid="overworld-lord-pill">Lord: —</div>
      <div class="pmd-window pmd-window--gold pmd-window--compact pmd-battle-pill" data-testid="overworld-gold-pill">0G</div>
      <button type="button" class="pmd-btn pmd-battle-hud-btn" data-testid="overworld-sandbox-toggle">Sandbox</button>
    `;
    this.lordHudPillEl = this.topHudBarEl.querySelector('[data-testid="overworld-lord-pill"]')!;
    this.goldHudPillEl = this.topHudBarEl.querySelector('[data-testid="overworld-gold-pill"]')!;
    this.sandboxToggleBtnEl = this.topHudBarEl.querySelector(
      '[data-testid="overworld-sandbox-toggle"]'
    )!;
    this.sandboxToggleBtnEl.hidden = !this.sandboxMode;

    // 3. Toast Notification Banner
    this.toastEl = document.createElement('div');
    this.toastEl.className = 'pmd-window pmd-window--gold pmd-overworld-toast';
    this.toastEl.dataset.testid = 'overworld-toast';
    this.toastEl.hidden = true;

    // 4. Bottom Location Dock
    this.dockEl = document.createElement('div');
    this.dockEl.className = 'pmd-window pmd-overworld-dock';
    this.dockEl.dataset.testid = 'overworld-location-dock';
    this.dockEl.innerHTML = `
      <div class="pmd-overworld-dock-info">
        <div class="pmd-overworld-dock-title-row">
          <h3 class="pmd-overworld-dock-title" data-testid="overworld-current-node-title">—</h3>
          <div class="pmd-inline-btns" data-dock-badges></div>
        </div>
        <p class="pmd-overworld-dock-sub" data-testid="overworld-current-node-desc">—</p>
      </div>
      <div class="pmd-overworld-dock-actions">
        <button type="button" class="pmd-btn pmd-btn-primary" data-testid="overworld-enter-chapter-btn">Enter Chapter</button>
        <button type="button" class="pmd-btn pmd-btn-danger" data-testid="overworld-fight-skirmish-btn" hidden>Fight Skirmish</button>
        <button type="button" class="pmd-btn pmd-btn-primary" data-testid="overworld-open-shop-btn" hidden>Kecleon Shop</button>
        <button type="button" class="pmd-btn" data-testid="overworld-center-lord-btn">Center</button>
      </div>
    `;
    this.dockTitleEl = this.dockEl.querySelector('[data-testid="overworld-current-node-title"]')!;
    this.dockBadgesEl = this.dockEl.querySelector('[data-dock-badges]')!;
    this.dockSubEl = this.dockEl.querySelector('[data-testid="overworld-current-node-desc"]')!;
    this.btnEnterChapterEl = this.dockEl.querySelector(
      '[data-testid="overworld-enter-chapter-btn"]'
    )!;
    this.btnFightSkirmishEl = this.dockEl.querySelector(
      '[data-testid="overworld-fight-skirmish-btn"]'
    )!;
    this.btnOpenShopEl = this.dockEl.querySelector('[data-testid="overworld-open-shop-btn"]')!;
    this.btnCenterLordEl = this.dockEl.querySelector(
      '[data-testid="overworld-center-lord-btn"]'
    )!;

    // 5. Dev Tools Sandbox Drawer (`sandboxMode === true`)
    this.sandboxDrawerEl = document.createElement('aside');
    this.sandboxDrawerEl.className = 'pmd-window pmd-battle-sandbox-drawer';
    this.sandboxDrawerEl.dataset.testid = 'overworld-sandbox-drawer';
    this.sandboxDrawerEl.hidden = true;
    this.sandboxDrawerEl.innerHTML = `
      <div class="pmd-devtools-row-between">
        <h3 class="pmd-panel-title" style="margin:0;font-size:0.9rem;">OVERWORLD SANDBOX</h3>
        <button type="button" class="pmd-btn pmd-chip-btn" data-testid="ow-sandbox-close">Close</button>
      </div>
      <p class="pmd-subcard-text" data-ow-sandbox-summary>—</p>

      <div class="pmd-battle-sandbox-section">
        <strong style="font-size:0.76rem;color:#f8d048;">1. Map Progression Presets</strong>
        <div class="pmd-inline-btns">
          <button type="button" class="pmd-btn pmd-chip-btn" data-testid="ow-sandbox-preset-tour">Sandbox Tour</button>
          <button type="button" class="pmd-btn pmd-chip-btn" data-testid="ow-sandbox-preset-prologue">Prologue Start</button>
          <button type="button" class="pmd-btn pmd-chip-btn" data-testid="ow-sandbox-preset-all">Unlock All (12)</button>
        </div>
      </div>

      <div class="pmd-battle-sandbox-section">
        <strong style="font-size:0.76rem;color:#90ffbe;">2. Spawn Kecleon Shop on Current Node</strong>
        <div class="pmd-inline-btns">
          <button type="button" class="pmd-btn pmd-chip-btn" data-testid="ow-sandbox-spawn-shop-tm_shop">TM Shop</button>
          <button type="button" class="pmd-btn pmd-chip-btn" data-testid="ow-sandbox-spawn-shop-held_shop">Held Shop</button>
          <button type="button" class="pmd-btn pmd-chip-btn" data-testid="ow-sandbox-spawn-shop-healing_shop">Heal/Stone Shop</button>
          <button type="button" class="pmd-btn pmd-chip-btn" data-testid="ow-sandbox-spawn-shop-x_item_shop">X-Item Shop</button>
        </div>
      </div>

      <div class="pmd-battle-sandbox-section">
        <strong style="font-size:0.76rem;color:#ff9aa2;">3. Feral Skirmish &amp; Post-Battle Spawner</strong>
        <div class="pmd-inline-btns">
          <button type="button" class="pmd-btn pmd-chip-btn" data-testid="ow-sandbox-spawn-skirmish">Spawn Skirmish Here</button>
          <button type="button" class="pmd-btn pmd-chip-btn" data-testid="ow-sandbox-complete-chapter">Simulate Chapter Clear (+Roll)</button>
        </div>
      </div>

      <div class="pmd-battle-sandbox-section">
        <strong style="font-size:0.76rem;color:#90d8f8;">4. Gold, Vitamins &amp; Promotion Kit</strong>
        <div class="pmd-inline-btns">
          <button type="button" class="pmd-btn pmd-chip-btn" data-testid="ow-sandbox-grant-kit">+2,500G &amp; Test Kit</button>
          <button type="button" class="pmd-btn pmd-chip-btn" data-testid="ow-sandbox-level-boost">+5 Squad Levels</button>
        </div>
      </div>
    `;
    this.sandboxSummaryEl = this.sandboxDrawerEl.querySelector('[data-ow-sandbox-summary]')!;

    // 6. Kecleon Shop Modal (`#025 Kecleon's Shop` BGM)
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
            <button type="button" class="pmd-btn pmd-chip-btn" data-testid="kecleon-open-units-btn">Units / Teach TM</button>
            <button type="button" class="pmd-btn pmd-chip-btn" data-testid="kecleon-shop-close-btn">Leave Shop</button>
          </div>
        </div>
        <div class="pmd-kecleon-hero">
          <div class="pmd-kecleon-portrait-box" data-kecleon-portrait-slot></div>
          <div class="pmd-kecleon-speech">
            <strong data-kecleon-speech-name>Master Merchant Kecleon</strong>
            <p data-kecleon-speech-text>Welcome, traveler!</p>
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
    this.kecleonPortraitView = new PmdPortraitView({ testId: 'kecleon-shop-portrait' });
    this.kecleonBackdropEl
      .querySelector('[data-kecleon-portrait-slot]')!
      .appendChild(this.kecleonPortraitView.canvas);

    // 7. Overworld System Menu Modal (`Units / Roster`, `Items / Convoy`, `Supports`, `Save / System`)
    this.systemMenuBackdropEl = document.createElement('div');
    this.systemMenuBackdropEl.className = 'pmd-battle-modal-backdrop';
    this.systemMenuBackdropEl.dataset.testid = 'overworld-system-menu';
    this.systemMenuBackdropEl.hidden = true;
    this.systemMenuBackdropEl.innerHTML = `
      <div class="pmd-window pmd-overworld-modal-dialog" role="dialog" aria-modal="true" aria-label="Overworld Menu">
        <div class="pmd-devtools-row-between">
          <h3 class="pmd-panel-title" style="margin:0;">OVERWORLD MENU</h3>
          <button type="button" class="pmd-btn pmd-chip-btn" data-testid="overworld-menu-close-btn">Resume Map</button>
        </div>
        <nav class="pmd-inline-btns" aria-label="Overworld Menu Sections">
          <button type="button" class="pmd-btn pmd-chip-btn is-active" data-ow-tab="units" data-testid="overworld-menu-tab-units">Units / Roster</button>
          <button type="button" class="pmd-btn pmd-chip-btn" data-ow-tab="convoy" data-testid="overworld-menu-tab-convoy">Items / Convoy</button>
          <button type="button" class="pmd-btn pmd-chip-btn" data-ow-tab="supports" data-testid="overworld-menu-tab-supports">Supports</button>
          <button type="button" class="pmd-btn pmd-chip-btn" data-ow-tab="system" data-testid="overworld-menu-tab-system">Save / System</button>
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
      this.sandboxDrawerEl,
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
    return this.kecleonShopOpen || this.systemMenuOpen || this.sandboxDrawerOpen;
  }

  public setFastMode(enabled: boolean): void {
    this.fastMode = Boolean(enabled);
  }

  public async open(options?: {
    sandboxMode?: boolean;
    graph?: OverworldGraphDefinition;
    preservePosition?: boolean;
    skipDefaultSandboxSeed?: boolean;
  }): Promise<void> {
    if (options?.sandboxMode !== undefined) {
      this.sandboxMode = options.sandboxMode;
    }
    if (options?.graph) {
      this.graph = options.graph;
    }
    this.sandboxToggleBtnEl.hidden = !this.sandboxMode;
    if (!this.sandboxMode) {
      this.sandboxDrawerOpen = false;
      this.sandboxDrawerEl.hidden = true;
    }

    // Ensure an active save exists and has valid Overworld state
    let save = this.saveManager.getSave();
    if (!save) {
      save = this.saveManager.createNewCampaignSave({
        lordSpeciesId: 'dratini',
        lordNickname: 'Bahamut',
        partnerSpeciesId: 'bulbasaur',
        partnerNickname: 'Sprout',
        healerSpeciesId: 'happiny',
        healerNickname: 'Clover',
      });
      if (this.sandboxMode && !options?.skipDefaultSandboxSeed) {
        save = this.saveManager.applyOverworldSandboxPreset(this.graph);
      } else {
        save = this.saveManager.ensureOverworldInitialized(this.graph);
      }
    } else {
      const existingNodeKeyCount = Object.keys(save.overworld?.nodes ?? {}).length;
      if (
        this.sandboxMode &&
        !options?.skipDefaultSandboxSeed &&
        existingNodeKeyCount <= 1 &&
        save.campaign.completedChapterIds.length === 0
      ) {
        save = this.saveManager.applyOverworldSandboxPreset(this.graph);
      } else {
        save = this.saveManager.ensureOverworldInitialized(this.graph);
      }
    }

    if (!this.openState) {
      this.previousBgmId = this.audioManager.getCurrentTrackId();
    }

    this.openState = true;
    this.kecleonShopOpen = false;
    this.systemMenuOpen = false;
    this.kecleonBackdropEl.hidden = true;
    this.systemMenuBackdropEl.hidden = true;
    this.activeTravel = null;

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
      if (this.sandboxDrawerOpen) {
        this.renderSandboxSummary();
      }
      this.renderFrame();
    });

    this.mapSource = await loadOverworldMapImage(this.graph);
    this.preloadActiveSprites();
    await this.ensureLordAndKecleonPreloaded();

    this.syncViewportDimensions();
    this.snapLordToCurrentNode();
    if (!options?.preservePosition) {
      this.centerCameraOnMapPoint(this.lordWorldX, this.lordWorldY);
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
    if (!this.openState) return;
    this.openState = false;
    this.stopLoop();
    this.clearLongPressTimer();
    this.activeTravel = null;
    this.kecleonShopOpen = false;
    this.systemMenuOpen = false;
    this.sandboxDrawerOpen = false;
    this.kecleonBackdropEl.hidden = true;
    this.systemMenuBackdropEl.hidden = true;
    this.sandboxDrawerEl.hidden = true;
    this.unsubscribeSave?.();
    this.unsubscribeSave = null;

    this.rootEl.hidden = true;
    this.viewportEl.classList.remove('is-battle-active');

    if (this.previousBgmId) {
      this.audioManager.playBgm(this.previousBgmId, { fadeMs: 250 });
    } else {
      this.audioManager.playBgm('top_menu', { fadeMs: 250 });
    }

    this.onLayerStateChanged();
    this.onExitCallback();
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
    if (this.sandboxDrawerOpen) {
      this.audioManager.playSfx('cancel');
      this.sandboxDrawerOpen = false;
      this.sandboxDrawerEl.hidden = true;
      this.sandboxToggleBtnEl.classList.remove('is-active');
      this.onLayerStateChanged();
      return;
    }

    this.openSystemMenu('units');
  }

  // ==========================================================================
  // Diagnostics & Playwright Inspection Helpers
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
      this.showToast('That destination is still locked!');
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
      sandboxMode: this.sandboxMode,
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
      lordNickname: lord?.nickname ?? 'Bahamut',
      displayScale: this.displayScale,
      camera: {
        x: Math.round(this.cameraX * 100) / 100,
        y: Math.round(this.cameraY * 100) / 100,
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
      sandboxDrawerOpen: this.sandboxDrawerOpen,
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

    // Smoothly keep traveling Lord framed inside the camera viewport
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
    this.displayScale = w >= 1024 ? 4 : 3;

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

  private getMaxCameraBounds(): { maxX: number; maxY: number } {
    const visibleNativeW = this.viewWidthPx / this.displayScale;
    const visibleNativeH = this.viewHeightPx / this.displayScale;
    return {
      maxX: Math.max(0, this.graph.imageWidth - visibleNativeW),
      maxY: Math.max(0, this.graph.imageHeight - visibleNativeH),
    };
  }

  private clampCamera(): void {
    const { maxX, maxY } = this.getMaxCameraBounds();
    this.cameraX = Math.max(0, Math.min(maxX, this.cameraX));
    this.cameraY = Math.max(0, Math.min(maxY, this.cameraY));
  }

  private centerCameraOnMapPoint(mapX: number, mapY: number): void {
    const visibleNativeW = this.viewWidthPx / this.displayScale;
    const visibleNativeH = this.viewHeightPx / this.displayScale;
    this.cameraX = mapX - visibleNativeW / 2;
    this.cameraY = mapY - visibleNativeH / 2;
    this.clampCamera();
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
      'pointerdown',
      (e: PointerEvent) => {
        if (!this.openState || this.kecleonShopOpen || this.systemMenuOpen) return;
        if (e.pointerType === 'mouse' && e.button !== 0) return;

        this.activePointerId = e.pointerId;
        this.pointerStartX = e.clientX;
        this.pointerStartY = e.clientY;
        this.pointerStartCamX = this.cameraX;
        this.pointerStartCamY = this.cameraY;
        this.isDraggingCamera = false;
        this.longPressFired = false;

        try {
          this.canvas.setPointerCapture(e.pointerId);
        } catch {
          // Ignore synthetic events without capture support
        }

        this.clearLongPressTimer();
        if (e.pointerType !== 'mouse') {
          this.longPressTimer = window.setTimeout(() => {
            this.longPressTimer = null;
            if (this.activePointerId === e.pointerId && !this.isDraggingCamera) {
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
        if (!this.openState) return;
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

        // Desktop hover route preview
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
      if (this.activePointerId !== e.pointerId) return;
      this.clearLongPressTimer();
      try {
        if (this.canvas.hasPointerCapture(e.pointerId)) {
          this.canvas.releasePointerCapture(e.pointerId);
        }
      } catch {
        // Ignore
      }

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

    // Top HUD Sandbox Toggle
    bindPointerTap(
      this.sandboxToggleBtnEl,
      () => {
        if (!this.sandboxMode) return;
        this.audioManager.playSfx('select');
        this.sandboxDrawerOpen = !this.sandboxDrawerOpen;
        this.sandboxDrawerEl.hidden = !this.sandboxDrawerOpen;
        this.sandboxToggleBtnEl.classList.toggle('is-active', this.sandboxDrawerOpen);
        if (this.sandboxDrawerOpen) {
          this.renderSandboxSummary();
        }
        this.onLayerStateChanged();
      },
      { signal }
    );

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

    bindPointerTap(
      this.btnCenterLordEl,
      () => {
        this.audioManager.playSfx('select');
        this.centerCameraOnMapPoint(this.lordWorldX, this.lordWorldY);
        this.renderFrame();
      },
      { signal }
    );

    // Sandbox Drawer Buttons
    bindPointerTap(
      this.sandboxDrawerEl.querySelector<HTMLElement>('[data-testid="ow-sandbox-close"]'),
      () => {
        this.audioManager.playSfx('cancel');
        this.sandboxDrawerOpen = false;
        this.sandboxDrawerEl.hidden = true;
        this.sandboxToggleBtnEl.classList.remove('is-active');
        this.onLayerStateChanged();
      },
      { signal }
    );

    bindPointerTap(
      this.sandboxDrawerEl.querySelector<HTMLElement>('[data-testid="ow-sandbox-preset-tour"]'),
      () => {
        this.audioManager.playSfx('select');
        this.saveManager.applyOverworldSandboxPreset(this.graph);
        this.snapLordToCurrentNode();
        this.centerCameraOnMapPoint(this.lordWorldX, this.lordWorldY);
        this.showToast('Loaded Sandbox Tour (6 cleared nodes + Kecleon Shop + Skirmish)!');
      },
      { signal }
    );

    bindPointerTap(
      this.sandboxDrawerEl.querySelector<HTMLElement>('[data-testid="ow-sandbox-preset-prologue"]'),
      () => {
        this.audioManager.playSfx('select');
        this.saveManager.resetOverworldToPrologue(this.graph);
        this.snapLordToCurrentNode();
        this.centerCameraOnMapPoint(this.lordWorldX, this.lordWorldY);
        this.showToast('Reset Overworld to fresh Prologue start!');
      },
      { signal }
    );

    bindPointerTap(
      this.sandboxDrawerEl.querySelector<HTMLElement>('[data-testid="ow-sandbox-preset-all"]'),
      () => {
        this.audioManager.playSfx('select');
        this.saveManager.unlockAllOverworldNodes(this.graph);
        this.showToast('Unlocked all 12 Overworld nodes across the continent!');
      },
      { signal }
    );

    for (const shopType of ALL_KECLEON_SHOP_TYPES) {
      bindPointerTap(
        this.sandboxDrawerEl.querySelector<HTMLElement>(
          `[data-testid="ow-sandbox-spawn-shop-${shopType}"]`
        ),
        () => {
          const save = this.saveManager.getSave();
          if (!save) return;
          const nodeId = ensureOverworldGraphState(save, this.graph).currentNodeId;
          this.audioManager.playSfx('select');
          this.saveManager.spawnOverworldKecleonShop(nodeId, shopType, Math.random, this.graph);
          const meta = KECLEON_SHOP_METADATA[shopType];
          this.showToast(`Spawned ${meta.title} on current node!`);
        },
        { signal }
      );
    }

    bindPointerTap(
      this.sandboxDrawerEl.querySelector<HTMLElement>('[data-testid="ow-sandbox-spawn-skirmish"]'),
      () => {
        const save = this.saveManager.getSave();
        if (!save) return;
        const nodeId = ensureOverworldGraphState(save, this.graph).currentNodeId;
        this.audioManager.playSfx('select');
        this.saveManager.spawnOverworldSkirmish(nodeId, undefined, undefined, this.graph);
        this.preloadActiveSprites();
        this.showToast('Spawned Feral Skirmish encounter on current node!');
      },
      { signal }
    );

    bindPointerTap(
      this.sandboxDrawerEl.querySelector<HTMLElement>(
        '[data-testid="ow-sandbox-complete-chapter"]'
      ),
      () => {
        const save = this.saveManager.getSave();
        if (!save) return;
        const nodeId = ensureOverworldGraphState(save, this.graph).currentNodeId;
        this.audioManager.playSfx('victory_fanfare');
        const res = this.saveManager.completeOverworldChapter(nodeId, {
          graph: this.graph,
          skirmishChance: 0.75,
          shopChance: 0.85,
        });
        this.preloadActiveSprites();
        const notes: string[] = [`Cleared ${getOverworldNodeById(nodeId, this.graph)?.name ?? nodeId}!`];
        if (res.spawns.spawnedSkirmishNodeId) {
          notes.push(
            `Skirmish at ${getOverworldNodeById(res.spawns.spawnedSkirmishNodeId, this.graph)?.name}`
          );
        }
        if (res.spawns.spawnedShopNodeId) {
          notes.push(
            `Kecleon at ${getOverworldNodeById(res.spawns.spawnedShopNodeId, this.graph)?.name}`
          );
        }
        this.showToast(notes.join(' · '));
      },
      { signal }
    );

    bindPointerTap(
      this.sandboxDrawerEl.querySelector<HTMLElement>('[data-testid="ow-sandbox-grant-kit"]'),
      () => {
        this.audioManager.playSfx('heal');
        this.saveManager.addGold(2500);
        this.saveManager.addConvoyItem('protein', 2);
        this.saveManager.addConvoyItem('carbos', 2);
        this.saveManager.addConvoyItem('hp_up', 2);
        this.saveManager.addConvoyItem('evolution_stone', 2);
        this.saveManager.addConvoyItem('evolution_gem', 2);
        this.saveManager.addConvoyItem('tm05_aerial_ace', 1);
        this.showToast('Added +2,500G, Vitamins, Evolution Stones/Gems & TM05 Aerial Ace!');
      },
      { signal }
    );

    bindPointerTap(
      this.sandboxDrawerEl.querySelector<HTMLElement>('[data-testid="ow-sandbox-level-boost"]'),
      () => {
        const save = this.saveManager.getSave();
        if (!save) return;
        this.audioManager.playSfx('heal');
        for (const unit of save.roster) {
          this.saveManager.setUnitLevelForTest(unit.instanceId, Math.min(40, unit.level + 5));
        }
        this.showToast('Boosted all squad members by +5 Levels!');
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
      this.showToast(`${node.code}: ${node.name} is still locked!`);
      return;
    }

    if (node.id === reconciled.currentNodeId) {
      // Tapping the current node opens Kecleon Shop if present and cleared, or pulses dock
      if (st.activeKecleonShop && st.cleared && !st.activeSkirmish) {
        this.openKecleonShop();
      } else {
        this.audioManager.playSfx('select');
        this.showToast(
          `${node.code} · ${node.name} — Choose an action in the bottom dock!`
        );
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
    if (!def) return;

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
      this.showToast('No Kecleon merchant is currently camped at this landmark.');
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
    const nodeDef = getOverworldNodeById(reconciled.currentNodeId, this.graph);
    const shop = reconciled.nodes[reconciled.currentNodeId]?.activeKecleonShop;

    this.kecleonGoldEl.textContent = `${save.gold}G`;
    this.kecleonStatusEl.textContent = this.kecleonStatusMessage;
    this.kecleonStatusEl.hidden = this.kecleonStatusMessage.length === 0;

    this.kecleonShelfEl.innerHTML = '';

    if (!shop) {
      this.kecleonTitleEl.textContent = 'KECLEON SHOP — SOLD OUT';
      this.kecleonSpeechNameEl.textContent = 'Master Merchant Kecleon';
      this.kecleonSpeechTextEl.textContent =
        'Thank you kindly! You bought every last item on our wagon—safe travels, friend!';
      return;
    }

    const meta = KECLEON_SHOP_METADATA[shop.shopType];
    this.kecleonTitleEl.textContent = `${meta.title.toUpperCase()} · ${nodeDef?.name ?? ''}`;
    this.kecleonSpeechNameEl.textContent = `Master Merchant Kecleon (${meta.shortBadge})`;
    this.kecleonSpeechTextEl.textContent = meta.greeting;

    for (const itemId of shop.inventoryItemIds) {
      const item = getItemById(itemId);
      if (!item || item.buyPrice === null) continue;
      const canAfford = save.gold >= item.buyPrice;

      let compatNote = '';
      if (item.category === 'tm') {
        const compatibleUnits = save.roster
          .filter((u) => {
            const sp = getSpeciesById(u.speciesId);
            const mvId = item.effect.teachesMoveId;
            return (
              sp &&
              sp.compatibleTmIds.includes(item.id) &&
              (!mvId || !u.unlockedMoveIds.includes(mvId))
            );
          })
          .map((u) => u.nickname);
        compatNote =
          compatibleUnits.length > 0
            ? `Compatible: ${compatibleUnits.join(', ')}`
            : 'Compatible: None in current party';
      }

      const card = document.createElement('div');
      card.className = 'pmd-kecleon-item-card';
      card.innerHTML = `
        <div>
          <div class="pmd-kecleon-item-top">
            <strong class="pmd-kecleon-item-name">${item.name}</strong>
            <span class="pmd-kecleon-item-price">${item.buyPrice}G</span>
          </div>
          <p class="pmd-kecleon-item-desc">${item.description}</p>
          ${compatNote ? `<p class="pmd-kecleon-item-desc" style="color:#90ffbe;margin-top:0.2rem;">${compatNote}</p>` : ''}
        </div>
        <button type="button" class="pmd-btn pmd-btn-primary" data-testid="kecleon-buy-${item.id}" ${canAfford ? '' : 'disabled'}>
          ${canAfford ? `Buy (${item.buyPrice}G)` : `Need ${item.buyPrice}G`}
        </button>
      `;

      const buyBtn = card.querySelector<HTMLButtonElement>(`[data-testid="kecleon-buy-${item.id}"]`);
      bindPointerTap(buyBtn, () => {
        try {
          const outcome = this.saveManager.buyKecleonShopItem(
            reconciled.currentNodeId,
            item.id,
            this.graph
          );
          this.audioManager.playSfx('heal');
          this.kecleonStatusMessage = `Purchased ${outcome.item.name}! Stored in Convoy (${outcome.save.gold}G left).`;
          this.renderKecleonShopContents();
        } catch (err) {
          this.audioManager.playSfx('cancel');
          this.kecleonStatusMessage =
            err instanceof Error ? err.message : 'Purchase could not be completed.';
          this.renderKecleonShopContents();
        }
      });

      this.kecleonShelfEl.appendChild(card);
    }
  }

  // ==========================================================================
  // Overworld System Menu (`Units / Roster`, `Items / Convoy`, `Supports`, `System`)
  // ==========================================================================

  public openSystemMenu(tab: OverworldMenuTab = 'units'): void {
    this.activeMenuTab = tab;
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
    } else if (this.activeMenuTab === 'supports') {
      this.renderSupportsTab(save);
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
    listCol.className = 'pmd-overworld-unit-list';

    for (const u of save.roster) {
      const sp = getSpeciesById(u.speciesId);
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `pmd-btn pmd-overworld-unit-btn${u.instanceId === this.selectedUnitInstanceId ? ' is-active' : ''}`;
      btn.dataset.testid = `overworld-roster-unit-${u.instanceId}`;
      btn.innerHTML = `
        <span><strong>${u.nickname}</strong>${u.isLord ? ' ★' : ''}<br/><small style="color:#90d8f8;">${sp?.name ?? u.speciesId} · Lv.${u.level}</small></span>
        <span style="font-size:0.68rem;color:#ffe888;">S${sp?.stage ?? 1}</span>
      `;
      bindPointerTap(btn, () => {
        this.audioManager.playSfx('select');
        this.selectedUnitInstanceId = u.instanceId;
        this.menuFeedbackMessage = '';
        this.renderSystemMenuBody();
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

      const headerRow = document.createElement('div');
      headerRow.className = 'pmd-devtools-row-between';
      headerRow.innerHTML = `
        <div class="pmd-forecast-unit-head">
          <div class="pmd-forecast-portrait-slot" data-ow-unit-portrait></div>
          <div class="pmd-forecast-unit-id">
            <strong class="pmd-forecast-unit-name" data-testid="overworld-unit-detail-name">${selected.nickname}${selected.isLord ? ' ★ [LORD]' : ''}</strong>
            <span class="pmd-forecast-unit-meta">${sp?.name ?? selected.speciesId} · Stage ${sp?.stage ?? 1} · Lv. ${selected.level} · ${sp?.types.join('/') ?? ''} · ${sp?.traversalClass ?? 'Grounded'}</span>
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
        speciesIdOrAssetId: selected.speciesId,
        emotion: 'Normal',
      });

      bindPointerTap(
        headerRow.querySelector<HTMLElement>('[data-testid="overworld-unit-rename-btn"]'),
        () => {
          this.audioManager.playSfx('select');
          this.onRequestRenameUnit?.(selected.instanceId);
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

      // Personal Skill + Equipped Item Box
      const gearBox = document.createElement('div');
      gearBox.className = 'pmd-overworld-subbox';
      gearBox.innerHTML = `
        <p class="pmd-overworld-subbox-title">Personal Skill &amp; 1-Slot Item</p>
        <div class="pmd-overworld-action-row">
          <div class="pmd-overworld-action-meta">
            <strong>Ability: ${skill?.name ?? 'None'}</strong>
            <span>${skill?.description ?? ''}</span>
          </div>
        </div>
        <div class="pmd-overworld-action-row">
          <div class="pmd-overworld-action-meta">
            <strong data-testid="overworld-unit-equipped-item">Item Slot: ${equippedItem ? equippedItem.name : 'Empty'}</strong>
            <span>${equippedItem ? equippedItem.description : 'Equip 1 Held Gear, Berry, Potion, Stone, or X-Item from Convoy.'}</span>
          </div>
          ${equippedItem ? '<button type="button" class="pmd-btn pmd-chip-btn" data-testid="overworld-unequip-item-btn">Unequip</button>' : ''}
        </div>
      `;
      bindPointerTap(
        gearBox.querySelector<HTMLElement>('[data-testid="overworld-unequip-item-btn"]'),
        () => {
          this.audioManager.playSfx('cancel');
          this.saveManager.equipItemToUnit(selected.instanceId, null);
          this.setMenuFeedback(`Returned ${equippedItem?.name ?? 'item'} to Convoy.`);
          this.renderSystemMenuBody();
        }
      );

      // Active Moves & `[E]` Counter Move Box
      const movesBox = document.createElement('div');
      movesBox.className = 'pmd-overworld-subbox';
      movesBox.innerHTML = `<p class="pmd-overworld-subbox-title">Unlocked Moves (${selected.unlockedMoveIds.length}) &amp; [E] Counter</p>`;
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
            <strong>${isEquipped ? '[E] ' : ''}${mv.name} (${mv.type} · ${mv.category} R${mv.range[0]})</strong>
            <span>Mt ${mv.mt} · Hit ${mv.hit} · PP ${mv.pp + (selected.bonusPpByMoveId[mId] ?? 0)}</span>
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
          </div>
        `;
        bindPointerTap(row.querySelector<HTMLElement>(`[data-set-eq="${mId}"]`), () => {
          this.audioManager.playSfx('select');
          this.saveManager.setEquippedMove(selected.instanceId, mId);
          this.setMenuFeedback(`${selected.nickname} set [E] ${mv.name} for Enemy Phase!`);
          this.renderSystemMenuBody();
        });
        bindPointerTap(row.querySelector<HTMLElement>(`[data-add-active="${mId}"]`), () => {
          this.audioManager.playSfx('select');
          this.saveManager.setActiveMoves(selected.instanceId, [...selected.activeMoveIds, mId]);
          this.setMenuFeedback(`Equipped ${mv.name} to ${selected.nickname}'s 4-move loadout!`);
          this.renderSystemMenuBody();
        });
        movesBox.appendChild(row);
      }

      // Vitamins Box (Step 4 Checklist: permanent stat boost)
      const vitaminsInBag = save.convoy.filter((c) => getItemById(c.itemId)?.category === 'vitamin');
      const vitaminBox = document.createElement('div');
      vitaminBox.className = 'pmd-overworld-subbox';
      vitaminBox.innerHTML = `<p class="pmd-overworld-subbox-title">Stat Vitamins in Convoy (${vitaminsInBag.length})</p>`;
      if (vitaminsInBag.length === 0) {
        vitaminBox.innerHTML += `<span style="font-size:0.66rem;color:#9ab8d8;">No Vitamins currently in Convoy.</span>`;
      } else {
        for (const slot of vitaminsInBag) {
          const item = getItemById(slot.itemId)!;
          const row = document.createElement('div');
          row.className = 'pmd-overworld-action-row';
          row.innerHTML = `
            <div class="pmd-overworld-action-meta">
              <strong>${item.name} ×${slot.quantity}</strong>
              <span>${item.description}</span>
            </div>
            <button type="button" class="pmd-btn pmd-btn-primary pmd-chip-btn" data-testid="overworld-use-vitamin-${item.id}">Use</button>
          `;
          bindPointerTap(
            row.querySelector<HTMLElement>(`[data-testid="overworld-use-vitamin-${item.id}"]`),
            () => {
              try {
                this.saveManager.useVitaminOnUnit(selected.instanceId, item.id);
                this.audioManager.playSfx('heal');
                this.setMenuFeedback(`Used ${item.name} on ${selected.nickname}! Permanent stat increased.`);
                this.renderSystemMenuBody();
              } catch (err) {
                this.audioManager.playSfx('cancel');
                this.setMenuFeedback(err instanceof Error ? err.message : 'Could not use Vitamin.');
              }
            }
          );
          vitaminBox.appendChild(row);
        }
      }

      // Technical Machines Box (Step 4 Checklist: consumes TM & adds move to permanent Unlocked Move Pool)
      const tmsInBag = save.convoy.filter((c) => getItemById(c.itemId)?.category === 'tm');
      const tmBox = document.createElement('div');
      tmBox.className = 'pmd-overworld-subbox';
      tmBox.innerHTML = `<p class="pmd-overworld-subbox-title">Technical Machines in Convoy (${tmsInBag.length})</p>`;
      if (tmsInBag.length === 0) {
        tmBox.innerHTML += `<span style="font-size:0.66rem;color:#9ab8d8;">Buy TMs from a Kecleon TM Shop to teach permanent new moves!</span>`;
      } else {
        for (const slot of tmsInBag) {
          const item = getItemById(slot.itemId)!;
          const moveId = item.effect.teachesMoveId ?? '';
          const move = getMoveById(moveId);
          const compatible = Boolean(sp?.compatibleTmIds.includes(item.id));
          const alreadyKnown = Boolean(moveId && selected.unlockedMoveIds.includes(moveId));
          const canTeach = compatible && !alreadyKnown;

          const row = document.createElement('div');
          row.className = 'pmd-overworld-action-row';
          row.innerHTML = `
            <div class="pmd-overworld-action-meta">
              <strong>${item.name} ×${slot.quantity}</strong>
              <span>${
                alreadyKnown
                  ? `${selected.nickname} already knows ${move?.name ?? moveId}`
                  : compatible
                    ? `Compatible with ${selected.nickname}! Teaches ${move?.name ?? moveId}`
                    : `Incompatible with ${sp?.name ?? selected.speciesId}`
              }</span>
            </div>
            <button type="button" class="pmd-btn pmd-btn-primary pmd-chip-btn" data-testid="overworld-teach-tm-${item.id}" ${canTeach ? '' : 'disabled'}>
              ${alreadyKnown ? 'Known' : compatible ? 'Teach' : 'Incompatible'}
            </button>
          `;
          bindPointerTap(
            row.querySelector<HTMLElement>(`[data-testid="overworld-teach-tm-${item.id}"]`),
            () => {
              try {
                this.saveManager.teachTmMove(selected.instanceId, item.id);
                this.audioManager.playSfx('heal');
                this.setMenuFeedback(
                  `${selected.nickname} permanently learned ${move?.name ?? item.name}! (${item.name} consumed)`
                );
                this.renderSystemMenuBody();
              } catch (err) {
                this.audioManager.playSfx('cancel');
                this.setMenuFeedback(err instanceof Error ? err.message : 'Could not teach TM.');
              }
            }
          );
          tmBox.appendChild(row);
        }
      }

      // Evolution Promotion Box (Lv.10+ Stone, Lv.15+ Eevee 8-way, Lv.20+ Gem)
      const promoBox = document.createElement('div');
      promoBox.className = 'pmd-overworld-subbox';
      promoBox.innerHTML = `<p class="pmd-overworld-subbox-title">Evolution Promotion</p>`;
      if (!sp || sp.evolutions.length === 0) {
        promoBox.innerHTML += `<span style="font-size:0.66rem;color:#9ab8d8;">${selected.nickname} is at final evolution stage.</span>`;
      } else {
        for (const branch of sp.evolutions) {
          const targetSp = getSpeciesById(branch.targetSpeciesId);
          const reqItem = getItemById(branch.requiredItemId);
          const hasItem =
            selected.consumableItemId === branch.requiredItemId ||
            save.convoy.some((c) => c.itemId === branch.requiredItemId && c.quantity > 0);
          const meetsLevel = selected.level >= branch.minLevel;
          const canPromote = hasItem && meetsLevel;

          const row = document.createElement('div');
          row.className = 'pmd-overworld-action-row';
          row.innerHTML = `
            <div class="pmd-overworld-action-meta">
              <strong>Promote → ${targetSp?.name ?? branch.targetSpeciesId}</strong>
              <span>Requires Lv. ${branch.minLevel}+ &amp; ${reqItem?.name ?? branch.requiredItemId} ${hasItem ? '(Owned)' : '(Missing)'}</span>
            </div>
            <button type="button" class="pmd-btn pmd-btn-primary pmd-chip-btn" data-testid="overworld-promote-${branch.targetSpeciesId}" ${canPromote ? '' : 'disabled'}>
              Promote
            </button>
          `;
          bindPointerTap(
            row.querySelector<HTMLElement>(
              `[data-testid="overworld-promote-${branch.targetSpeciesId}"]`
            ),
            () => {
              try {
                this.saveManager.useEvolutionItemOnUnit(
                  selected.instanceId,
                  branch.requiredItemId,
                  branch.targetSpeciesId
                );
                this.audioManager.playSfx('victory_fanfare');
                this.preloadActiveSprites();
                this.setMenuFeedback(
                  `${selected.nickname} promoted into ${targetSp?.name ?? branch.targetSpeciesId}!`
                );
                this.renderSystemMenuBody();
              } catch (err) {
                this.audioManager.playSfx('cancel');
                this.setMenuFeedback(err instanceof Error ? err.message : 'Cannot promote yet.');
              }
            }
          );
          promoBox.appendChild(row);
        }
      }

      detailCol.append(headerRow, statStrip, gearBox, vitaminBox, tmBox, promoBox, movesBox);
    }

    grid.append(listCol, detailCol);
    this.menuPanelBodyEl.appendChild(grid);
  }

  private renderConvoyTab(save: SaveData): void {
    const box = document.createElement('div');
    box.className = 'pmd-overworld-subbox';
    box.innerHTML = `<p class="pmd-overworld-subbox-title">Convoy Inventory (${save.convoy.length} stacks · ${save.gold}G)</p>`;

    const targetUnit =
      save.roster.find((u) => u.instanceId === this.selectedUnitInstanceId) ?? save.roster[0];

    if (save.convoy.length === 0) {
      box.innerHTML += `<span style="font-size:0.72rem;color:#b8dcff;">Convoy is currently empty.</span>`;
    } else {
      for (const entry of save.convoy) {
        const item = getItemById(entry.itemId);
        if (!item) continue;
        const equippable = item.equipSlot === 'held' || item.equipSlot === 'consumable';
        const row = document.createElement('div');
        row.className = 'pmd-overworld-action-row';
        row.dataset.testid = `overworld-convoy-row-${item.id}`;
        row.innerHTML = `
          <div class="pmd-overworld-action-meta">
            <strong>${item.name} ×${entry.quantity}</strong>
            <span>${item.description}</span>
          </div>
          ${
            equippable && targetUnit
              ? `<button type="button" class="pmd-btn pmd-chip-btn" data-equip-convoy="${item.id}">Give to ${targetUnit.nickname}</button>`
              : ''
          }
        `;
        bindPointerTap(row.querySelector<HTMLElement>(`[data-equip-convoy="${item.id}"]`), () => {
          if (!targetUnit) return;
          this.audioManager.playSfx('select');
          this.saveManager.equipItemToUnit(targetUnit.instanceId, item.id);
          this.setMenuFeedback(`Equipped ${item.name} on ${targetUnit.nickname}!`);
          this.renderSystemMenuBody();
        });
        box.appendChild(row);
      }
    }

    this.menuPanelBodyEl.appendChild(box);
  }

  private renderSupportsTab(save: SaveData): void {
    const box = document.createElement('div');
    box.className = 'pmd-overworld-subbox';
    box.innerHTML = `<p class="pmd-overworld-subbox-title">Squad Bond Supports (Levels 1–5 · Thresholds ${SUPPORT_LEVEL_THRESHOLDS.join('/')})</p>`;

    for (let i = 0; i < save.roster.length; i++) {
      for (let j = i + 1; j < save.roster.length; j++) {
        const a = save.roster[i]!;
        const b = save.roster[j]!;
        const pairKey = makeSupportPairKey(a.instanceId, b.instanceId);
        const prog = save.supports[pairKey] ?? { points: 0, level: 0 };
        const nextThresh =
          prog.level < 5 ? SUPPORT_LEVEL_THRESHOLDS[prog.level] : SUPPORT_LEVEL_THRESHOLDS[4];

        const row = document.createElement('div');
        row.className = 'pmd-overworld-action-row';
        row.innerHTML = `
          <div class="pmd-overworld-action-meta">
            <strong>${a.nickname} &amp; ${b.nickname}</strong>
            <span>Support Rank: Lv. ${prog.level} (${prog.points}/${nextThresh} pts)</span>
          </div>
        `;
        box.appendChild(row);
      }
    }

    this.menuPanelBodyEl.appendChild(box);
  }

  private renderSystemTab(save: SaveData): void {
    const sync = this.saveManager.getSyncStatus();
    const box = document.createElement('div');
    box.className = 'pmd-overworld-subbox';
    box.innerHTML = `
      <p class="pmd-overworld-subbox-title">Save &amp; Overworld System</p>
      <div class="pmd-overworld-action-row">
        <div class="pmd-overworld-action-meta">
          <strong>Save Sync Status</strong>
          <span>Account: ${sync.user?.email ?? 'Guest (localStorage)'} · Last Updated: ${new Date(save.lastUpdated).toLocaleTimeString()}</span>
        </div>
      </div>
      <div class="pmd-inline-btns">
        <button type="button" class="pmd-btn" data-testid="overworld-sys-center-btn">Center Camera on Lord</button>
        <button type="button" class="pmd-btn pmd-btn-danger" data-testid="overworld-exit-btn">Exit Overworld</button>
      </div>
    `;

    bindPointerTap(
      box.querySelector<HTMLElement>('[data-testid="overworld-sys-center-btn"]'),
      () => {
        this.closeSystemMenu();
        this.centerCameraOnMapPoint(this.lordWorldX, this.lordWorldY);
        this.renderFrame();
      }
    );
    bindPointerTap(box.querySelector<HTMLElement>('[data-testid="overworld-exit-btn"]'), () => {
      this.audioManager.playSfx('cancel');
      this.close();
    });

    this.menuPanelBodyEl.appendChild(box);
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
      this.fastMode ? 350 : 2100
    );
  }

  private syncHudAndDock(): void {
    const save = this.saveManager.getSave();
    if (!save) return;
    const reconciled = ensureOverworldGraphState(save, this.graph);
    const lord = this.getActiveLordUnit(save);
    const lordSp = lord ? getSpeciesById(lord.speciesId) : undefined;

    this.lordHudPillEl.textContent = lord
      ? `${lord.nickname} (${lordSp?.name ?? lord.speciesId} Lv.${lord.level})`
      : 'Squad';
    this.goldHudPillEl.textContent = `${save.gold}G`;

    const nodeDef =
      getOverworldNodeById(reconciled.currentNodeId, this.graph) ??
      getOverworldNodeById(this.graph.startNodeId, this.graph);
    const nodeState = nodeDef ? reconciled.nodes[nodeDef.id] : undefined;

    if (!nodeDef) return;

    this.dockTitleEl.textContent = `${nodeDef.code} · ${nodeDef.name}`;
    this.dockSubEl.textContent = `${nodeDef.kingdom} — ${nodeDef.description}`;

    this.dockBadgesEl.innerHTML = '';
    const statusBadge = document.createElement('span');
    if (nodeState?.cleared) {
      statusBadge.className = 'pmd-overworld-badge is-cleared';
      statusBadge.textContent = 'CLEARED';
    } else {
      statusBadge.className = 'pmd-overworld-badge is-story';
      statusBadge.textContent = nodeDef.kind === 'paralogue' ? 'PARALOGUE' : 'NEXT CHAPTER';
    }
    this.dockBadgesEl.appendChild(statusBadge);

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
      skBadge.textContent = `SKIRMISH LV.${nodeState.activeSkirmish.recommendedLevel}`;
      this.dockBadgesEl.appendChild(skBadge);
    }

    this.btnEnterChapterEl.textContent = nodeState?.cleared ? 'Replay Chapter' : 'Enter Chapter';
    this.btnFightSkirmishEl.hidden = !nodeState?.activeSkirmish;
    this.btnOpenShopEl.hidden = !nodeState?.activeKecleonShop;
  }

  private renderSandboxSummary(): void {
    const snap = this.getSnapshot();
    this.sandboxSummaryEl.textContent = [
      `Node: ${snap.currentNodeId}`,
      `Unlocked: ${snap.unlockedNodeIds.length}/${this.graph.nodes.length}`,
      `Cleared: ${snap.clearedNodeIds.length}`,
      `Active Shops: ${snap.activeShopNodes.length}`,
      `Active Skirmishes: ${snap.activeSkirmishNodes.length}`,
    ].join(' · ');
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
    const screenX = Math.round((mapX - this.cameraX) * scale);
    const screenY = Math.round((mapY - this.cameraY) * scale);

    // Compute current animation frame from durationsMs
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

    // Anchor ground shadow directly onto `(mapX, mapY)` using PMD footline placement
    const placement = computePmdTileSpritePlacement(
      -12,
      -20,
      anim.frameWidth,
      anim.frameHeight,
      24
    );
    const drawX = screenX + placement.drawX * scale;
    const drawY = screenY + placement.drawY * scale;
    const drawW = anim.frameWidth * scale;
    const drawH = anim.frameHeight * scale;

    this.ctx.save();
    this.ctx.imageSmoothingEnabled = false;

    // Ground shadow ellipse
    this.ctx.fillStyle = tintGlowColor ?? 'rgba(8, 12, 24, 0.55)';
    this.ctx.beginPath();
    this.ctx.ellipse(screenX, screenY + 2 * scale, 6 * scale, 2.6 * scale, 0, 0, Math.PI * 2);
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

    // Parchment ocean backdrop
    ctx.fillStyle = '#141c2c';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // 1. Wonder Map Pixel Art Layer
    if (this.mapSource) {
      const mapDrawX = Math.round(-this.cameraX * scale);
      const mapDrawY = Math.round(-this.cameraY * scale);
      ctx.drawImage(
        this.mapSource,
        mapDrawX,
        mapDrawY,
        this.graph.imageWidth * scale,
        this.graph.imageHeight * scale
      );
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

        // Draw intermediate trail stepping-stones along waypoints
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

      // Inner gem highlight
      if (isUnlocked) {
        ctx.beginPath();
        ctx.arc(cx, cy, 1.8 * scale, 0, Math.PI * 2);
        ctx.fillStyle = isCleared ? '#90e8ff' : '#ffe888';
        ctx.fill();
      }
      ctx.restore();

      // Spawned Kecleon Merchant Sprite (`0352`) beside node
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

      // Spawned Feral Skirmish Enemy Scout Sprite beside node
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

      // Crisp Bitmap Landmark Nameplate for Unlocked Nodes
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
