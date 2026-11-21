/**
 * Mystery Emblem - Fire Emblem Awakening Overworld Map Coordinator (`OverworldScene.ts`)
 */

import { getAudioManager, type AudioManager } from '../audio/AudioManager';
import { HERO_BIRTHDAY_GIFT_ITEM_ID, isHeroBirthdayToday } from '../data/heroCustomization';
import { getItemById } from '../data/index';
import { DEMO_OVERWORLD_GRAPH, getOverworldNodeById, type OverworldGraphDefinition, type OverworldNodeDefinition } from '../data/overworldMapData';
import { ensureOverworldGraphState, resolveCurrentStoryChapterNodeId } from '../engine/overworldEngine';
import type { SaveStateManager } from '../state/SaveStateManager';
import type { OverworldNodeState, SaveData } from '../types/schemas';
import { PmdPortraitView } from '../ui/PmdSpriteCanvas';
import type { TutorialOverlay } from '../ui/TutorialOverlay';
import {
  OVERWORLD_SCALE_BOUNDS,
  clampMapScale,
  isDefaultMapScale,
  resolveInitialOverworldScale,
} from '../ui/mapZoomController';
import { bindPointerTap } from '../ui/pointerControls';
import { OverworldCameraAndPointersController } from './overworld/OverworldCameraAndPointers';
import { renderOverworldFrame, type NodeLabelDomEntry } from './overworld/OverworldCanvasRenderer';
import { OverworldModalCoordinator } from './overworld/OverworldModalCoordinator';
import {
  OverworldTravelAndSpritesController,
  formatOverworldChapterAnnouncement,
  getActiveLordUnit,
  type OverworldSceneOptions,
} from './overworld/OverworldTravelAndSprites';
import {
  createOverworldDomElements, loadOverworldMapImage, syncOverworldHudAndDock,
  syncOverworldSupportsTabButton,
  type OverworldDomElements, type OverworldMenuTab,
} from './overworld/overworldDomTemplates';

export { loadOverworldMapImage };
export type { OverworldMenuTab, OverworldSceneOptions };

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
  private toastTimer: number | null = null;
  private mapSource: CanvasImageSource | null = null;
  private unsubscribeSave: (() => void) | null = null;
  private cachedNodeMapGraph: OverworldGraphDefinition | null = null;
  private cachedNodeMap = new Map<string, OverworldNodeDefinition>();
  private cachedReconciled: {
    save: SaveData | null;
    graph: OverworldGraphDefinition;
    state: { currentNodeId: string; nodes: Record<string, OverworldNodeState> };
  } | null = null;

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
        getReconciledState: (save) => this.getCachedReconciledState(save),
        isOpen: () => this.openState,
        canInteractWithCanvas: () =>
          this.openState &&
          !this.modals.kecleonShopOpen &&
          !this.modals.systemMenuOpen &&
          !this.tutorialOverlay?.isBlockingSceneInput() &&
          !this.travelCtrl.activeClearSequence,
        isModalOpen: () => this.modals.kecleonShopOpen || this.modals.systemMenuOpen,
        isTraveling: () => Boolean(this.travelCtrl.activeTravel || this.travelCtrl.activeClearSequence),
        onRenderFrame: () => this.renderFrame(),
        onZoomScaleChange: () => this.syncZoomResetButton(),
        onMenuOrBack: () => this.handleMenuOrBack(),
        onNodeTapped: (node: OverworldNodeDefinition) => {
          void this.travelCtrl.handleNodeTapped(node);
        },
        getActiveClearSequence: () => this.travelCtrl.activeClearSequence,
      },
      this.abortController.signal
    );

    this.modals = new OverworldModalCoordinator(
      {
        dom: this.dom,
        kecleonPortraitView,
        saveManager: this.saveManager,
        audioManager: this.audioManager,
        dialogueOverlay: options.dialogueOverlay,
        tutorialOverlay: this.tutorialOverlay,
        getGraph: () => this.graph,
        getReconciledState: (save) => this.getCachedReconciledState(save),
        isOpen: () => this.openState,
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
      getReconciledState: (save) => this.getCachedReconciledState(save),
      getMapSourceLoaded: () => Boolean(this.mapSource),
      isOpen: () => this.openState,
      onRenderFrame: () => this.renderFrame(),
      onSyncHudAndDock: () => this.syncHudAndDock(),
      onShowToast: (text) => this.showToast(text),
      onOpenKecleonShop: () => this.modals.openKecleonShop(),
      onLaunchChapterBattle: this.opts.onLaunchChapterBattle,
      onLaunchSkirmishBattle: this.opts.onLaunchSkirmishBattle,
    });

    const signal = this.abortController.signal;
    const guard = (fn: () => void) => {
      if (!this.travelCtrl.activeTravel) fn();
    };
    bindPointerTap(this.dom.btnEnterChapterEl, () => guard(() => this.travelCtrl.launchCurrentChapterBattle()), { signal });
    bindPointerTap(this.dom.btnFightSkirmishEl, () => guard(() => this.travelCtrl.launchCurrentSkirmishBattle()), { signal });
    bindPointerTap(this.dom.btnOpenShopEl, () => guard(() => this.modals.openKecleonShop()), { signal });
    bindPointerTap(
      this.dom.zoomResetBtnEl,
      () => {
        const defaultScale = resolveInitialOverworldScale(this.cam.viewWidthPx, this.cam.viewHeightPx);
        this.setZoomScale(defaultScale);
        this.audioManager.playSfx('select');
      },
      { signal, stopPropagation: true }
    );
  }

  private syncZoomResetButton(): void {
    const defaultScale = resolveInitialOverworldScale(this.cam.viewWidthPx, this.cam.viewHeightPx);
    this.dom.zoomResetBtnEl.hidden =
      !this.openState || isDefaultMapScale(this.cam.displayScale, defaultScale);
  }

  public isOpen(): boolean { return this.openState; }
  public hasActiveSubLayer(): boolean {
    return this.openState && (this.modals.kecleonShopOpen || this.modals.systemMenuOpen || this.modals.hasSupportsSubLayer());
  }
  public close(): void { this.closeInternal(true); }
  public openKecleonShop(): void { this.modals.openKecleonShop(); }
  public openSystemMenu(tab: OverworldMenuTab = 'units'): void { this.modals.openSystemMenu(tab); }
  public travelToNode(nodeId: string): Promise<boolean> { return this.travelCtrl.travelToNode(nodeId); }

  private getCachedNodeMap(): Map<string, OverworldNodeDefinition> {
    if (this.cachedNodeMapGraph !== this.graph) {
      this.cachedNodeMapGraph = this.graph;
      this.cachedNodeMap = new Map(this.graph.nodes.map((n) => [n.id, n]));
    }
    return this.cachedNodeMap;
  }

  private getCachedReconciledState(
    save: SaveData | null
  ): { currentNodeId: string; nodes: Record<string, OverworldNodeState> } {
    if (!save) {
      return { currentNodeId: this.graph.startNodeId, nodes: {} };
    }
    if (this.cachedReconciled && this.cachedReconciled.save === save && this.cachedReconciled.graph === this.graph) {
      return this.cachedReconciled.state;
    }
    const rec = ensureOverworldGraphState(save, this.graph);
    const state = { currentNodeId: rec.currentNodeId, nodes: rec.nodes };
    this.cachedReconciled = { save, graph: this.graph, state };
    return state;
  }

  public async open(options?: {
    graph?: OverworldGraphDefinition;
    preservePosition?: boolean;
    announceCurrentChapter?: boolean;
    celebrateClearedNodeId?: string;
  }): Promise<void> {
    if (options?.graph) this.graph = options.graph;
    if (!this.openState) this.previousBgmId = this.audioManager.getCurrentTrackId();
    this.openState = true;
    this.cachedReconciled = null;

    if (!this.saveManager.getReadOnlySave()) {
      this.saveManager.createNewCampaignSave({ lordSpeciesId: 'axew', partnerSpeciesId: 'quaxly', healerSpeciesId: 'flabebe' });
    }
    this.saveManager.ensureOverworldInitialized(this.graph);
    this.modals.resetModals();
    this.travelCtrl.clearCelebrationSequence();
    this.travelCtrl.activeTravel = null;
    const shouldResetCamera = !options?.preservePosition || !this.cam.hasInitializedCamera;
    this.cam.resetGestureState(shouldResetCamera);

    this.dom.rootEl.hidden = false;
    this.opts.viewportEl.classList.add('is-battle-active');

    this.unsubscribeSave?.();
    this.unsubscribeSave = this.saveManager.subscribe(() => {
      if (!this.openState) return;
      this.cachedReconciled = null;
      this.travelCtrl.invalidateRenderCache();
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
    let showedBirthdaySurprise = false;
    const latestSave = this.saveManager.getReadOnlySave();
    if (latestSave) {
      const now = new Date();
      const currentYear = now.getFullYear();
      if (
        isHeroBirthdayToday(latestSave.campaign.heroBirthMonth, latestSave.campaign.heroBirthDay, now) &&
        latestSave.campaign.lastBirthdayRewardYear !== currentYear
      ) {
        const giftItem = getItemById(HERO_BIRTHDAY_GIFT_ITEM_ID);
        if (giftItem) {
          this.saveManager.claimHeroBirthdayGift(currentYear, giftItem.id);
          const lordName = getActiveLordUnit(latestSave)?.nickname ?? 'Hero';
          this.audioManager.playSfx('heal');
          this.showToast(
            `Happy Birthday, ${lordName}! Your teammates prepared a ${giftItem.name} for you!`,
            5000
          );
          showedBirthdaySurprise = true;
        }
      }
    }
    const curSave = options?.announceCurrentChapter ? this.saveManager.getReadOnlySave() : null;
    if (curSave && !showedBirthdaySurprise) {
      this.showToast(
        formatOverworldChapterAnnouncement(curSave, this.graph, this.getCachedReconciledState(curSave)),
        2800
      );
    }
    this.audioManager.playBgm('exploration_theme', { fadeMs: 280 });
    this.travelCtrl.invalidateRenderCache();
    this.travelCtrl.startLoop();
    this.opts.onLayerStateChanged();
    this.renderFrame();

    if (options?.celebrateClearedNodeId) {
      const celebrateClearedNodeId = options.celebrateClearedNodeId;
      const clearedDef = getOverworldNodeById(celebrateClearedNodeId, this.graph);
      const save = this.saveManager.getReadOnlySave();
      const rec = save ? this.getCachedReconciledState(save) : null;
      if (clearedDef && rec) {
        const newlyUnlockedNodeIds = (clearedDef.unlocksNodeIdsOnClear ?? []).filter(
          (nid) => Boolean(rec.nodes[nid]?.unlocked)
        );
        const newlyUnlockedEdgeIds = this.graph.edges
          .filter((e) => {
            const stA = rec.nodes[e.fromNodeId]?.unlocked;
            const stB = rec.nodes[e.toNodeId]?.unlocked;
            return (
              Boolean(stA && stB) &&
              (newlyUnlockedNodeIds.includes(e.fromNodeId) || newlyUnlockedNodeIds.includes(e.toNodeId))
            );
          })
          .map((e) => e.id);

        await this.travelCtrl.playChapterClearCelebration({
          clearedNodeId: celebrateClearedNodeId,
          newlyUnlockedNodeIds,
          newlyUnlockedEdgeIds,
        });

        const nextStoryId = resolveCurrentStoryChapterNodeId(rec.nodes, this.graph);
        if (nextStoryId && nextStoryId !== celebrateClearedNodeId) {
          await this.travelToNode(nextStoryId);
        }
      }
    }

    this.modals.triggerOverworldArrivalTutorials();
  }

  private closeInternal(notifyExit: boolean): void {
    if (!this.openState) return;
    this.openState = false;
    this.travelCtrl.clearCelebrationSequence();
    this.travelCtrl.stopLoop();
    this.cam.resetGestureState(false);
    this.travelCtrl.activeTravel = null;
    this.modals.resetModals();
    this.unsubscribeSave?.();
    this.unsubscribeSave = null;
    this.dom.rootEl.hidden = true;
    this.opts.viewportEl.classList.remove('is-battle-active');
    if (notifyExit) {
      if (this.previousBgmId && this.previousBgmId !== 'top_menu') {
        this.audioManager.playBgm(this.previousBgmId, { fadeMs: 250 });
      } else {
        this.audioManager.stopBgm({ fadeMs: 250 });
      }
    }
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
    if (this.modals.handleSubBack()) return;
    if (this.modals.kecleonShopOpen) this.modals.closeKecleonShop();
    else if (this.modals.systemMenuOpen) this.modals.closeSystemMenu();
    else this.modals.openSystemMenu('units');
  }

  public setZoomScale(nextScale: number, anchorClientX?: number, anchorClientY?: number): void {
    const rect = this.dom.canvas.getBoundingClientRect();
    const cx = anchorClientX ?? rect.left + rect.width / 2;
    const cy = anchorClientY ?? rect.top + rect.height / 2;
    const anchor = this.cam.clientPointToWorld(cx, cy);
    this.cam.applyZoomWithWorldAnchor(clampMapScale(nextScale, OVERWORLD_SCALE_BOUNDS), cx, cy, anchor.worldX, anchor.worldY);
    this.travelCtrl.invalidateRenderCache();
    this.renderFrame();
  }

  public snapToCurrentSaveNode(): void {
    if (!this.openState) return;
    this.travelCtrl.snapLordToCurrentNode();
    this.cam.centerCameraInitiallyOnPoint(this.travelCtrl.lordWorldX, this.travelCtrl.lordWorldY);
    this.syncHudAndDock();
    this.travelCtrl.invalidateRenderCache();
    this.renderFrame();
  }

  public renderFrame(): void {
    if (!this.openState) return;
    const save = this.saveManager.getReadOnlySave();
    renderOverworldFrame({
      ctx: this.dom.ctx,
      nodeLabelsLayerEl: this.dom.nodeLabelsLayerEl,
      nodeLabelMap: this.nodeLabelMap,
      graph: this.graph,
      nodeMap: this.getCachedNodeMap(),
      reconciled: this.getCachedReconciledState(save),
      mapSource: this.mapSource,
      spriteBundles: this.travelCtrl.spriteBundles,
      lordSpeciesId: getActiveLordUnit(save)?.speciesId ?? 'dratini',
      lordWorldX: this.travelCtrl.lordWorldX,
      lordWorldY: this.travelCtrl.lordWorldY,
      lordDirection: this.travelCtrl.lordDirection,
      lordAction: this.travelCtrl.lordAction,
      animClockMs: this.travelCtrl.animClockMs,
      displayScale: this.cam.displayScale,
      canvasDpr: this.cam.canvasDpr,
      viewWidthPx: this.cam.viewWidthPx,
      viewHeightPx: this.cam.viewHeightPx,
      cameraX: this.cam.cameraX,
      cameraY: this.cam.cameraY,
      isTraveling: Boolean(this.travelCtrl.activeTravel || this.travelCtrl.activeClearSequence),
      hoveredNodeId: this.cam.hoveredNodeId,
      highlightedEdgeIds: this.travelCtrl.activeTravel?.route.edgeIds ?? this.cam.hoverRoutePreview?.edgeIds ?? [],
      clearSequence: this.travelCtrl.activeClearSequence,
    });
  }

  private showToast(text: string, customDurationMs?: number): void {
    if (this.toastTimer !== null) window.clearTimeout(this.toastTimer);
    this.dom.toastEl.textContent = text;
    this.dom.toastEl.hidden = false;
    this.toastTimer = window.setTimeout(() => {
      this.dom.toastEl.hidden = true;
      this.toastTimer = null;
    }, customDurationMs ?? 1800);
  }

  private syncHudAndDock(): void {
    const save = this.saveManager.getReadOnlySave();
    if (save) {
      syncOverworldHudAndDock(this.dom, save, this.graph);
      syncOverworldSupportsTabButton(this.dom, save);
      this.opts.onLayerStateChanged();
    }
  }
}
