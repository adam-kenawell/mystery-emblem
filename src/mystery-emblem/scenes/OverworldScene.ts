/**
 * Mystery Emblem - Fire Emblem Awakening Overworld Map Coordinator (`OverworldScene.ts`)
 */

import { getAudioManager, type AudioManager } from '../audio/AudioManager';
import { DEMO_OVERWORLD_GRAPH, getOverworldNodeById, type OverworldGraphDefinition } from '../data/overworldMapData';
import type { SaveStateManager } from '../state/SaveStateManager';
import { PmdPortraitView } from '../ui/PmdSpriteCanvas';
import type { TutorialOverlay } from '../ui/TutorialOverlay';
import { OVERWORLD_SCALE_BOUNDS, clampMapScale } from '../ui/mapZoomController';
import { bindPointerTap } from '../ui/pointerControls';
import { OverworldCameraAndPointersController } from './overworld/OverworldCameraAndPointers';
import { renderOverworldFrame, type NodeLabelDomEntry } from './overworld/OverworldCanvasRenderer';
import { OverworldModalCoordinator } from './overworld/OverworldModalCoordinator';
import { OverworldTravelAndSpritesController, formatOverworldChapterAnnouncement } from './overworld/OverworldTravelAndSprites';
import {
  createOverworldDomElements, loadOverworldMapImage, syncOverworldHudAndDock,
  type OverworldDomElements, type OverworldMenuTab,
} from './overworld/overworldDomTemplates';
import {
  buildOverworldSceneSnapshot, getActiveLordUnit,
  type OverworldSceneOptions, type OverworldSceneSnapshot,
} from './overworld/overworldSnapshot';

export { loadOverworldMapImage };
export type { OverworldMenuTab, OverworldSceneOptions, OverworldSceneSnapshot };

export class OverworldScene {
  private readonly opts: OverworldSceneOptions;
  private readonly saveManager: SaveStateManager;
  private readonly audioManager: AudioManager;
  private readonly tutorialOverlay?: TutorialOverlay;
  private graph: OverworldGraphDefinition;
  private readonly dom: OverworldDomElements;
  private readonly cam: OverworldCameraAndPointersController;
  private readonly travelCtrl: OverworldTravelAndSpritesController;
  private readonly modals: OverworldModalCoordinator;
  private readonly nodeLabelMap = new Map<string, NodeLabelDomEntry>();
  private readonly abortController = new AbortController();

  private openState = false;
  private previousBgmId: string | null = null;
  private fastMode = false;
  private toastTimer: number | null = null;
  private mapSource: CanvasImageSource | null = null;
  private unsubscribeSave: (() => void) | null = null;

  constructor(options: OverworldSceneOptions) {
    this.opts = options;
    this.saveManager = options.saveManager;
    this.audioManager = options.audioManager ?? getAudioManager();
    this.tutorialOverlay = options.tutorialOverlay;
    this.graph = options.graph ?? DEMO_OVERWORLD_GRAPH;

    const kecleonPortraitView = new PmdPortraitView({ pixelScale: 1.5, testId: 'kecleon-shop-portrait' });
    this.dom = createOverworldDomElements(options.viewportEl, kecleonPortraitView);
    this.cam = new OverworldCameraAndPointersController(
      {
        rootEl: this.dom.rootEl,
        canvasStageEl: this.dom.canvasStageEl,
        canvas: this.dom.canvas,
        ctx: this.dom.ctx,
        saveManager: this.saveManager,
        getGraph: () => this.graph,
        isOpen: () => this.openState,
        canInteractWithCanvas: () =>
          this.openState && !this.modals.kecleonShopOpen && !this.modals.systemMenuOpen && !this.tutorialOverlay?.isBlockingSceneInput(),
        isModalOpen: () => this.modals.kecleonShopOpen || this.modals.systemMenuOpen,
        isTraveling: () => Boolean(this.travelCtrl.activeTravel),
        onRenderFrame: () => this.renderFrame(),
        onMenuOrBack: () => this.handleMenuOrBack(),
        onNodeTapped: (node) => {
          if (this.tutorialOverlay?.getExpectedAction()) this.tutorialOverlay.nudgeActiveStep();
          else void this.travelCtrl.handleNodeTapped(node);
        },
      },
      this.abortController.signal
    );

    this.modals = new OverworldModalCoordinator(
      {
        dom: this.dom,
        kecleonPortraitView,
        saveManager: this.saveManager,
        audioManager: this.audioManager,
        tutorialOverlay: this.tutorialOverlay,
        getGraph: () => this.graph,
        isOpen: () => this.openState,
        isFastMode: () => this.fastMode,
        onLayerStateChanged: () => this.opts.onLayerStateChanged(),
        onPreloadActiveSprites: () => this.travelCtrl.preloadActiveSprites(),
        onShowToast: (msg) => this.showToast(msg),
        onImportedSaveSnapLordAndCamera: () => {
          this.travelCtrl.snapLordToCurrentNode();
          this.cam.centerCameraOnMapPoint(this.travelCtrl.lordWorldX, this.travelCtrl.lordWorldY);
        },
        onConfirmNewGame: () => {
          this.closeInternal(false);
          this.opts.onRequestNewGame?.();
        },
        onExitToTitle: () => this.close(),
        onReplayCutscene: this.opts.onReplayCutscene,
        onReplayCredits: this.opts.onReplayCredits,
      },
      this.abortController.signal
    );

    this.travelCtrl = new OverworldTravelAndSpritesController({
      saveManager: this.saveManager,
      audioManager: this.audioManager,
      cam: this.cam,
      getGraph: () => this.graph,
      isOpen: () => this.openState,
      isFastMode: () => this.fastMode,
      onRenderFrame: () => this.renderFrame(),
      onSyncHudAndDock: () => this.syncHudAndDock(),
      onShowToast: (text) => this.showToast(text),
      onOpenKecleonShop: () => this.modals.openKecleonShop(),
      onLaunchChapterBattle: this.opts.onLaunchChapterBattle,
      onLaunchSkirmishBattle: this.opts.onLaunchSkirmishBattle,
    });

    const signal = this.abortController.signal;
    const guard = (fn: () => void) => {
      if (this.tutorialOverlay?.getExpectedAction()) this.tutorialOverlay.nudgeActiveStep();
      else if (!this.travelCtrl.activeTravel) fn();
    };
    bindPointerTap(this.dom.btnEnterChapterEl, () => guard(() => this.travelCtrl.launchCurrentChapterBattle()), { signal });
    bindPointerTap(this.dom.btnFightSkirmishEl, () => guard(() => this.travelCtrl.launchCurrentSkirmishBattle()), { signal });
    bindPointerTap(this.dom.btnOpenShopEl, () => guard(() => this.modals.openKecleonShop()), { signal });
  }

  public isOpen(): boolean { return this.openState; }
  public hasActiveSubLayer(): boolean { return this.openState && (this.modals.kecleonShopOpen || this.modals.systemMenuOpen); }
  public setFastMode(enabled: boolean): void { this.fastMode = Boolean(enabled); }
  public close(): void { this.closeInternal(true); }
  public openKecleonShop(): void { this.modals.openKecleonShop(); }
  public openSystemMenu(tab: OverworldMenuTab = 'units'): void { this.modals.openSystemMenu(tab); }
  public travelToNode(nodeId: string): Promise<boolean> { return this.travelCtrl.travelToNode(nodeId); }

  public async open(options?: {
    graph?: OverworldGraphDefinition;
    preservePosition?: boolean;
    announceCurrentChapter?: boolean;
  }): Promise<void> {
    if (options?.graph) this.graph = options.graph;
    if (!this.openState) this.previousBgmId = this.audioManager.getCurrentTrackId();
    this.openState = true;

    if (!this.saveManager.getSave()) {
      this.saveManager.createNewCampaignSave({ lordSpeciesId: 'axew', partnerSpeciesId: 'quaxly', healerSpeciesId: 'flabebe' });
    }
    this.saveManager.ensureOverworldInitialized(this.graph);
    this.modals.resetModals();
    this.travelCtrl.activeTravel = null;
    const shouldResetCamera = !options?.preservePosition || !this.cam.hasInitializedCamera;
    this.cam.resetGestureState(shouldResetCamera);

    this.dom.rootEl.hidden = false;
    this.opts.viewportEl.classList.add('is-battle-active');
    this.tutorialOverlay?.setActionAvailabilityProvider({
      isActionAlreadyDone: (a) => a === 'overworld_open_menu' && this.openState && this.modals.systemMenuOpen,
      canPerformActionNow: (a) => a === 'overworld_open_menu' && this.openState && !this.modals.kecleonShopOpen,
    });

    this.unsubscribeSave?.();
    this.unsubscribeSave = this.saveManager.subscribe(() => {
      if (!this.openState) return;
      this.travelCtrl.preloadActiveSprites();
      this.syncHudAndDock();
      if (this.modals.kecleonShopOpen) this.modals.renderKecleonShopContents();
      if (this.modals.systemMenuOpen) this.modals.renderSystemMenuBody();
      this.renderFrame();
    });

    this.mapSource = await loadOverworldMapImage(this.graph);
    this.travelCtrl.preloadActiveSprites();
    await this.travelCtrl.ensureLordAndKecleonPreloaded();
    this.cam.syncViewportDimensions();
    this.travelCtrl.snapLordToCurrentNode();
    if (shouldResetCamera) {
      this.cam.centerCameraInitiallyOnPoint(this.travelCtrl.lordWorldX, this.travelCtrl.lordWorldY);
      this.cam.hasInitializedCamera = true;
    } else this.cam.clampCamera();

    this.syncHudAndDock();
    const curSave = options?.announceCurrentChapter ? this.saveManager.getSave() : null;
    if (curSave) {
      this.showToast(formatOverworldChapterAnnouncement(curSave, this.graph), this.fastMode ? 500 : 2800);
    }
    this.audioManager.playBgm('exploration_theme', { fadeMs: 280 });
    this.travelCtrl.startLoop();
    this.opts.onLayerStateChanged();
    this.renderFrame();
    this.modals.triggerOverworldArrivalTutorials();
  }

  private closeInternal(notifyExit: boolean): void {
    if (!this.openState) return;
    this.openState = false;
    this.travelCtrl.stopLoop();
    this.cam.resetGestureState(false);
    this.travelCtrl.activeTravel = null;
    this.modals.resetModals();
    this.unsubscribeSave?.();
    this.unsubscribeSave = null;
    this.dom.rootEl.hidden = true;
    this.opts.viewportEl.classList.remove('is-battle-active');
    if (notifyExit) this.audioManager.playBgm(this.previousBgmId ?? 'top_menu', { fadeMs: 250 });
    this.opts.onLayerStateChanged();
    if (notifyExit) this.opts.onExit();
  }

  public destroy(): void {
    this.travelCtrl.stopLoop();
    if (this.toastTimer !== null) window.clearTimeout(this.toastTimer);
    this.cam.destroy();
    this.unsubscribeSave?.();
    this.abortController.abort();
    this.opts.viewportEl.classList.remove('is-battle-active');
    this.dom.rootEl.remove();
  }

  public handleMenuOrBack(): void {
    if (!this.openState) return;
    if (this.modals.kecleonShopOpen) this.modals.closeKecleonShop();
    else if (this.modals.systemMenuOpen) this.modals.closeSystemMenu();
    else this.modals.openSystemMenu('units');
  }

  public getNodeClientCenter(nodeId: string): { clientX: number; clientY: number } | null {
    const def = getOverworldNodeById(nodeId, this.graph);
    if (!def) return null;
    const rect = this.dom.canvas.getBoundingClientRect();
    return {
      clientX: rect.left + (def.x - this.cam.cameraX) * this.cam.displayScale,
      clientY: rect.top + (def.y - this.cam.cameraY) * this.cam.displayScale,
    };
  }

  public centerCameraOnNode(nodeId: string): void {
    const def = getOverworldNodeById(nodeId, this.graph);
    if (!def) return;
    this.cam.centerCameraOnMapPoint(def.x, def.y);
    this.renderFrame();
  }

  public setZoomScale(nextScale: number, anchorClientX?: number, anchorClientY?: number): void {
    const rect = this.dom.canvas.getBoundingClientRect();
    const cx = anchorClientX ?? rect.left + rect.width / 2;
    const cy = anchorClientY ?? rect.top + rect.height / 2;
    const anchor = this.cam.clientPointToWorld(cx, cy);
    this.cam.applyZoomWithWorldAnchor(clampMapScale(nextScale, OVERWORLD_SCALE_BOUNDS), cx, cy, anchor.worldX, anchor.worldY);
    this.renderFrame();
  }

  public snapToCurrentSaveNode(): void {
    if (!this.openState) return;
    this.travelCtrl.snapLordToCurrentNode();
    this.cam.centerCameraInitiallyOnPoint(this.travelCtrl.lordWorldX, this.travelCtrl.lordWorldY);
    this.syncHudAndDock();
    this.renderFrame();
  }

  public getSnapshot(): OverworldSceneSnapshot {
    return buildOverworldSceneSnapshot({
      isOpen: this.openState, fastMode: this.fastMode, save: this.saveManager.getSave(),
      graph: this.graph, cam: this.cam, travelCtrl: this.travelCtrl,
      kecleonShopOpen: this.modals.kecleonShopOpen, systemMenuOpen: this.modals.systemMenuOpen,
      activeMenuTab: this.modals.activeMenuTab,
    });
  }

  public renderFrame(): void {
    if (!this.openState) return;
    const save = this.saveManager.getSave();
    renderOverworldFrame({
      ctx: this.dom.ctx, nodeLabelsLayerEl: this.dom.nodeLabelsLayerEl, nodeLabelMap: this.nodeLabelMap,
      graph: this.graph, mapSource: this.mapSource, spriteBundles: this.travelCtrl.spriteBundles, save,
      lordSpeciesId: getActiveLordUnit(save)?.speciesId ?? 'dratini',
      lordWorldX: this.travelCtrl.lordWorldX, lordWorldY: this.travelCtrl.lordWorldY,
      lordDirection: this.travelCtrl.lordDirection, lordAction: this.travelCtrl.lordAction,
      animClockMs: this.travelCtrl.animClockMs, displayScale: this.cam.displayScale,
      canvasDpr: this.cam.canvasDpr, viewWidthPx: this.cam.viewWidthPx, viewHeightPx: this.cam.viewHeightPx,
      cameraX: this.cam.cameraX, cameraY: this.cam.cameraY, isTraveling: Boolean(this.travelCtrl.activeTravel),
      hoveredNodeId: this.cam.hoveredNodeId,
      highlightedEdgeIds: this.travelCtrl.activeTravel?.route.edgeIds ?? this.cam.hoverRoutePreview?.edgeIds ?? [],
    });
  }

  private showToast(text: string, customDurationMs?: number): void {
    if (this.toastTimer !== null) window.clearTimeout(this.toastTimer);
    this.dom.toastEl.textContent = text;
    this.dom.toastEl.hidden = false;
    this.toastTimer = window.setTimeout(() => {
      this.dom.toastEl.hidden = true;
      this.toastTimer = null;
    }, customDurationMs ?? (this.fastMode ? 350 : 1800));
  }

  private syncHudAndDock(): void {
    const save = this.saveManager.getSave();
    if (save) syncOverworldHudAndDock(this.dom, save, this.graph);
  }
}
