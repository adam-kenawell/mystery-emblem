/**
 * Mystery Emblem - Overworld DOM Shell, Map Loader & HUD Sync (`overworldDomTemplates.ts`)
 */

import { loadImage } from '../../../utils/sprite-utils';
import {
  DEMO_OVERWORLD_GRAPH,
  KECLEON_SHOP_METADATA,
  getOverworldNodeById,
  type OverworldGraphDefinition,
} from '../../data/overworldMapData';
import { ensureOverworldGraphState } from '../../engine/overworldEngine';
import type { SaveData } from '../../types/schemas';
import type { PmdPortraitView } from '../../ui/PmdSpriteCanvas';

export type OverworldMenuTab = 'units' | 'convoy' | 'system';

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
  for (let y = 0; y < height; y += 24) ctx.fillRect(0, y, width, 1);
  for (let x = 0; x < width; x += 24) ctx.fillRect(x, 0, 1, height);
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

export interface OverworldDomElements {
  rootEl: HTMLElement;
  canvasStageEl: HTMLElement;
  nodeLabelsLayerEl: HTMLElement;
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  toastEl: HTMLElement;
  dockEl: HTMLElement;
  dockTitleEl: HTMLElement;
  dockBadgesEl: HTMLElement;
  dockActionsEl: HTMLElement;
  btnEnterChapterEl: HTMLButtonElement;
  btnFightSkirmishEl: HTMLButtonElement;
  btnOpenShopEl: HTMLButtonElement;
  kecleonBackdropEl: HTMLElement;
  kecleonTitleEl: HTMLElement;
  kecleonGoldEl: HTMLElement;
  kecleonSpeechNameEl: HTMLElement;
  kecleonSpeechTextEl: HTMLElement;
  kecleonShelfEl: HTMLElement;
  kecleonStatusEl: HTMLElement;
  systemMenuBackdropEl: HTMLElement;
  menuPanelBodyEl: HTMLElement;
  menuFeedbackEl: HTMLElement;
}

export function createOverworldDomElements(
  viewportEl: HTMLElement,
  kecleonPortraitView: PmdPortraitView
): OverworldDomElements {
  const rootEl = document.createElement('section');
  rootEl.id = 'pmd-overworld-scene';
  rootEl.className = 'pmd-battle-scene pmd-overworld-scene';
  rootEl.dataset.testid = 'overworld-scene';
  rootEl.dataset.noLongpress = 'true';
  rootEl.hidden = true;

  const canvasStageEl = document.createElement('div');
  canvasStageEl.className = 'pmd-battle-canvas-stage';
  const canvas = document.createElement('canvas');
  canvas.className = 'pmd-overworld-canvas pmd-pixelated';
  canvas.dataset.testid = 'overworld-canvas';
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Could not initialize 2D context for OverworldScene.');
  }
  ctx.imageSmoothingEnabled = false;
  canvasStageEl.appendChild(canvas);

  const nodeLabelsLayerEl = document.createElement('div');
  nodeLabelsLayerEl.className = 'pmd-overworld-node-labels';
  nodeLabelsLayerEl.dataset.testid = 'overworld-node-labels';
  canvasStageEl.appendChild(nodeLabelsLayerEl);

  const toastEl = document.createElement('div');
  toastEl.className = 'pmd-window pmd-window--translucent pmd-overworld-toast';
  toastEl.dataset.testid = 'overworld-toast';
  toastEl.hidden = true;

  const dockEl = document.createElement('div');
  dockEl.className = 'pmd-window pmd-window--translucent pmd-overworld-dock';
  dockEl.dataset.testid = 'overworld-location-dock';
  dockEl.innerHTML = `
    <div class="pmd-overworld-dock-info">
      <div class="pmd-overworld-dock-title-row">
        <h3 class="pmd-overworld-dock-title" data-testid="overworld-current-node-title">-</h3>
        <div class="pmd-inline-btns" data-dock-badges></div>
      </div>
    </div>
    <div class="pmd-overworld-dock-actions" data-dock-actions>
      <button type="button" class="pmd-btn pmd-btn-primary" data-testid="overworld-enter-chapter-btn">Enter Chapter</button>
      <button type="button" class="pmd-btn pmd-btn-danger" data-testid="overworld-fight-skirmish-btn" hidden>Skirmish</button>
      <button type="button" class="pmd-btn pmd-btn-primary" data-testid="overworld-open-shop-btn" hidden>Shop</button>
    </div>
  `;

  const kecleonBackdropEl = document.createElement('div');
  kecleonBackdropEl.className = 'pmd-battle-modal-backdrop';
  kecleonBackdropEl.dataset.testid = 'overworld-kecleon-shop-modal';
  kecleonBackdropEl.hidden = true;
  kecleonBackdropEl.innerHTML = `
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
  kecleonBackdropEl
    .querySelector('[data-kecleon-portrait-slot]')!
    .appendChild(kecleonPortraitView.canvas);

  const systemMenuBackdropEl = document.createElement('div');
  systemMenuBackdropEl.className = 'pmd-battle-modal-backdrop';
  systemMenuBackdropEl.dataset.testid = 'overworld-system-menu';
  systemMenuBackdropEl.hidden = true;
  systemMenuBackdropEl.innerHTML = `
    <div class="pmd-window pmd-overworld-modal-dialog" role="dialog" aria-modal="true" aria-label="Overworld Menu">
      <div class="pmd-devtools-row-between">
        <h3 class="pmd-panel-title" style="margin:0;">MENU</h3>
        <div class="pmd-inline-btns">
          <button type="button" class="pmd-btn pmd-btn-primary pmd-chip-btn" data-testid="overworld-menu-save-btn">Save Progress</button>
          <button type="button" class="pmd-btn pmd-chip-btn" data-testid="overworld-menu-close-btn">Close</button>
        </div>
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

  rootEl.append(
    canvasStageEl,
    toastEl,
    dockEl,
    kecleonBackdropEl,
    systemMenuBackdropEl
  );
  viewportEl.appendChild(rootEl);

  return {
    rootEl,
    canvasStageEl,
    nodeLabelsLayerEl,
    canvas,
    ctx,
    toastEl,
    dockEl,
    dockTitleEl: dockEl.querySelector('[data-testid="overworld-current-node-title"]')!,
    dockBadgesEl: dockEl.querySelector('[data-dock-badges]')!,
    dockActionsEl: dockEl.querySelector('[data-dock-actions]')!,
    btnEnterChapterEl: dockEl.querySelector('[data-testid="overworld-enter-chapter-btn"]')!,
    btnFightSkirmishEl: dockEl.querySelector('[data-testid="overworld-fight-skirmish-btn"]')!,
    btnOpenShopEl: dockEl.querySelector('[data-testid="overworld-open-shop-btn"]')!,
    kecleonBackdropEl,
    kecleonTitleEl: kecleonBackdropEl.querySelector('#kecleon-shop-title')!,
    kecleonGoldEl: kecleonBackdropEl.querySelector('[data-testid="kecleon-shop-gold"]')!,
    kecleonSpeechNameEl: kecleonBackdropEl.querySelector('[data-kecleon-speech-name]')!,
    kecleonSpeechTextEl: kecleonBackdropEl.querySelector('[data-kecleon-speech-text]')!,
    kecleonShelfEl: kecleonBackdropEl.querySelector('[data-testid="kecleon-shop-shelf"]')!,
    kecleonStatusEl: kecleonBackdropEl.querySelector('[data-testid="kecleon-shop-status"]')!,
    systemMenuBackdropEl,
    menuPanelBodyEl: systemMenuBackdropEl.querySelector('[data-testid="overworld-menu-body"]')!,
    menuFeedbackEl: systemMenuBackdropEl.querySelector('[data-testid="overworld-menu-feedback"]')!,
  };
}

const OVERWORLD_NODE_CODE_PREFIXES: ReadonlyArray<[RegExp, string]> = [
  [/^Ch\.\s*/i, 'Chapter '],
  [/^Par\.\s*/i, 'Paralogue '],
];

/** `"Ch. 3"` -> `"Chapter 3"`, `"Par. 1"` -> `"Paralogue 1"`, `"Prologue"` unchanged. */
export function expandOverworldNodeCode(code: string): string {
  for (const [pattern, replacement] of OVERWORLD_NODE_CODE_PREFIXES) {
    if (pattern.test(code)) return code.replace(pattern, replacement);
  }
  return code;
}

export function syncOverworldHudAndDock(
  dom: OverworldDomElements,
  save: SaveData,
  graph: OverworldGraphDefinition
): void {
  const reconciled = ensureOverworldGraphState(save, graph);

  const nodeDef =
    getOverworldNodeById(reconciled.currentNodeId, graph) ??
    getOverworldNodeById(graph.startNodeId, graph);
  const nodeState = nodeDef ? reconciled.nodes[nodeDef.id] : undefined;
  if (!nodeDef) return;

  dom.dockTitleEl.textContent = `${expandOverworldNodeCode(nodeDef.code)}: ${nodeDef.name}`;
  dom.dockBadgesEl.innerHTML = '';

  if (nodeState?.cleared) {
    const statusBadge = document.createElement('span');
    statusBadge.className = 'pmd-overworld-badge is-cleared';
    statusBadge.textContent = 'CLEARED';
    dom.dockBadgesEl.appendChild(statusBadge);
  }
  if (nodeState?.activeKecleonShop) {
    const shopMeta = KECLEON_SHOP_METADATA[nodeState.activeKecleonShop.shopType];
    const shopBadge = document.createElement('span');
    shopBadge.className = 'pmd-overworld-badge is-shop';
    shopBadge.textContent = shopMeta.shortBadge;
    dom.dockBadgesEl.appendChild(shopBadge);
  }
  if (nodeState?.activeSkirmish) {
    const skBadge = document.createElement('span');
    skBadge.className = 'pmd-overworld-badge is-skirmish';
    skBadge.textContent = 'SKIRMISH';
    dom.dockBadgesEl.appendChild(skBadge);
  }

  const canEnterDungeon = !nodeState?.cleared;
  const hasSkirmish = Boolean(nodeState?.activeSkirmish);
  const hasShop = Boolean(nodeState?.activeKecleonShop);

  dom.btnEnterChapterEl.hidden = !canEnterDungeon;
  dom.btnFightSkirmishEl.hidden = !hasSkirmish;
  dom.btnOpenShopEl.hidden = !hasShop;
  dom.dockActionsEl.hidden = !canEnterDungeon && !hasSkirmish && !hasShop;
}
