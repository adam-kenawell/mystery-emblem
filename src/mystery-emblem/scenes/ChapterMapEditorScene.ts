/**
 * Dev Tools Interactive Level & Chapter Map Editor (`ChapterMapEditorScene`)
 */

import { getAudioManager, type AudioManager } from '../audio/AudioManager';
import { cloneDungeonMap, exportChapterMapJson, getDefaultChapterMap } from '../data/chapterMapRegistry';
import type { SaveStateManager } from '../state/SaveStateManager';
import type { DungeonMapDefinition, TerrainType } from '../types/schemas';
import {
  applyDungeonZoomWithWorldAnchor,
  centerDungeonCameraOnTile,
  clampDungeonCameraPosition,
  clientPointToDungeonWorld,
  syncDungeonCanvasBuffer,
  tileCenterToClientPoint,
} from '../ui/gridViewportMath';
import { clampMapScale } from '../ui/mapZoomController';
import { refreshEditorChunkPalette } from './editor/editorAssetsAndPalette';
import {
  applyEditorStrokeAtTile,
  handleEditorTileTap,
  paintEditorTileAt,
  undoEditorStep,
  type EditorMutationHooks,
} from './editor/editorBrushAndUndo';
import { renderDungeonMapPreviewCanvas, renderEditorFrame } from './editor/editorCanvasRenderer';
import { createEditorDomShell, type EditorDomRefs } from './editor/editorDomShell';
import { bindEditorHudAndDrawerInteractions, type EditorControlCallbacks } from './editor/editorHudAndDrawerBindings';
import {
  applyEditorBrushUpdate,
  handleEditorMenuOrBackAction,
  performEditorCloseState,
  prepareEditorOpenState,
} from './editor/editorLifecycleHelpers';
import { bindEditorModalInteractions } from './editor/editorModalBindings';
import { resetEditorMapToDefault, saveEditorMapToGame, selectEditorLevel } from './editor/editorPersistenceActions';
import {
  populateEditorStaticControls,
  showEditorToast,
  syncEditorUiControls,
  updateEditorInfoStrip,
} from './editor/editorSidebarAndStatus';
import { adjustEditorDeploymentCap, resizeEditorMap } from './editor/editorSpawnsAndResize';
import { bindEditorCanvasStagePointers } from './editor/editorStagePointers';
import {
  buildEditorSnapshot,
  createInitialEditorState,
  type ChapterMapEditorSceneOptions,
  type ChapterMapEditorSnapshot,
  type EditorRuntimeState,
  type MapEditorToolMode,
} from './editor/editorTypesAndState';

export {
  renderDungeonMapPreviewCanvas,
  exportChapterMapJson,
  getDefaultChapterMap,
  type ChapterMapEditorSceneOptions,
  type ChapterMapEditorSnapshot,
  type MapEditorToolMode,
};

export class ChapterMapEditorScene {
  private readonly viewportEl: HTMLElement;
  private readonly saveManager: SaveStateManager;
  private readonly audioManager: AudioManager;
  private readonly onExitCallback: () => void;
  private readonly onPlayLevelCallback: (levelId: string) => void;
  private readonly onLayerStateChanged: () => void;
  private readonly dom: EditorDomRefs;
  private readonly state: EditorRuntimeState;
  private readonly abortController = new AbortController();
  private resizeObserver: ResizeObserver | null = null;
  private rafId: number | null = null;

  constructor(options: ChapterMapEditorSceneOptions) {
    this.viewportEl = options.viewportEl;
    this.saveManager = options.saveManager;
    this.audioManager = options.audioManager ?? getAudioManager();
    this.onExitCallback = options.onExit;
    this.onPlayLevelCallback = options.onPlayLevel;
    this.onLayerStateChanged = options.onLayerStateChanged ?? (() => {});
    this.dom = createEditorDomShell(this.viewportEl);
    this.state = createInitialEditorState();

    populateEditorStaticControls(this.dom, this.state, this.audioManager, this.abortController.signal, (b) => this.setBrush(b));

    const ctrlCallbacks: EditorControlCallbacks = {
      dom: this.dom,
      state: this.state,
      audioManager: this.audioManager,
      signal: this.abortController.signal,
      setDrawerOpen: (open) => this.setDrawerOpen(open),
      setToolMode: (mode) => this.setToolMode(mode),
      selectLevel: (id, opts) => this.selectLevel(id, opts),
      undo: () => this.undo(),
      saveCurrentMapToGame: () => void this.saveCurrentMapToGame(),
      saveAndPlayCurrentLevel: () => this.saveAndPlayCurrentLevel(),
      resetCurrentMapToDefault: () => void this.resetCurrentMapToDefault(),
      resizeMap: (w, h) => resizeEditorMap(this.getMutationHooks(), w, h),
      adjustDeploymentCap: (d) => adjustEditorDeploymentCap(this.getMutationHooks(), d),
      refreshChunkPaletteAndSync: () => {
        void refreshEditorChunkPalette(this.dom, this.state, this.abortController.signal, () => this.syncUiAndInfo()).then(() => this.syncUiAndInfo());
      },
      syncUiAndInfo: () => this.syncUiAndInfo(),
      renderFrame: () => this.renderFrame(),
      showToast: (msg) => showEditorToast(this.dom, this.state, msg),
      closeScene: () => this.close(),
      onLayerStateChanged: () => this.onLayerStateChanged(),
    };
    bindEditorHudAndDrawerInteractions(ctrlCallbacks);
    bindEditorModalInteractions(ctrlCallbacks);

    this.resizeObserver = bindEditorCanvasStagePointers({
      dom: this.dom,
      state: this.state,
      signal: this.abortController.signal,
      syncViewportDimensions: () => this.syncViewportDimensions(),
      applyStrokeAtTile: (tx, ty) => applyEditorStrokeAtTile(this.getMutationHooks(), tx, ty),
      handleTileTap: (tx, ty) => handleEditorTileTap(this.getMutationHooks(), tx, ty),
      renderFrame: () => this.renderFrame(),
    });
  }

  public isOpen(): boolean {
    return this.state.openState;
  }

  public hasActiveSubLayer(): boolean {
    return this.state.openState && (this.state.jsonModalOpen || this.state.systemMenuOpen || this.state.drawerOpen);
  }

  public async open(levelId = 'prologue', options?: { startDrawerOpen?: boolean }): Promise<void> {
    prepareEditorOpenState({ dom: this.dom, state: this.state, viewportEl: this.viewportEl, audioManager: this.audioManager, startDrawerOpen: options?.startDrawerOpen });
    this.syncViewportDimensions();
    await this.selectLevel(levelId, { recenterCamera: true });
    this.startLoop();
    this.onLayerStateChanged();
    this.renderFrame();
  }

  public close(): void {
    performEditorCloseState({
      dom: this.dom,
      state: this.state,
      viewportEl: this.viewportEl,
      audioManager: this.audioManager,
      stopLoop: () => this.stopLoop(),
      onLayerStateChanged: () => this.onLayerStateChanged(),
      onExitCallback: () => this.onExitCallback(),
    });
  }

  public destroy(): void {
    this.stopLoop();
    if (this.state.toastTimer !== null) {
      window.clearTimeout(this.state.toastTimer);
      this.state.toastTimer = null;
    }
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    this.abortController.abort();
    this.viewportEl.classList.remove('is-battle-active');
    this.dom.rootEl.remove();
  }

  public handleMenuOrBack(): void {
    handleEditorMenuOrBackAction({ dom: this.dom, state: this.state, audioManager: this.audioManager, setDrawerOpen: (o) => this.setDrawerOpen(o), onLayerStateChanged: () => this.onLayerStateChanged() });
  }

  public async selectLevel(levelId: string, opts?: { recenterCamera?: boolean }): Promise<void> {
    await selectEditorLevel({
      dom: this.dom,
      state: this.state,
      audioManager: this.audioManager,
      signal: this.abortController.signal,
      levelId,
      recenterCamera: opts?.recenterCamera !== false,
      syncUiAndInfo: () => this.syncUiAndInfo(),
      renderFrame: () => this.renderFrame(),
    });
  }

  public setDrawerOpen(open: boolean): void {
    this.state.drawerOpen = open;
    this.dom.drawerEl.hidden = !open;
    this.dom.hudPaletteBtnEl.classList.toggle('is-active', open);
    this.onLayerStateChanged();
  }

  public setToolMode(mode: MapEditorToolMode): void {
    this.state.toolMode = mode;
    this.syncUiAndInfo();
  }

  public setBrush(brush: { terrainType?: TerrainType; tilesetId?: string; chunkIndex?: number }): void {
    applyEditorBrushUpdate({ dom: this.dom, state: this.state, signal: this.abortController.signal, brush, syncUiAndInfo: () => this.syncUiAndInfo() });
  }

  public paintTileAt(tx: number, ty: number, pushUndo = true): boolean {
    return paintEditorTileAt(this.getMutationHooks(), tx, ty, pushUndo);
  }

  public undo(): boolean {
    return undoEditorStep(this.getMutationHooks());
  }

  public saveCurrentMapToGame(): DungeonMapDefinition {
    return saveEditorMapToGame({ dom: this.dom, state: this.state, saveManager: this.saveManager, syncUiAndInfo: () => this.syncUiAndInfo(), renderFrame: () => this.renderFrame() });
  }

  public resetCurrentMapToDefault(): DungeonMapDefinition {
    return resetEditorMapToDefault({ dom: this.dom, state: this.state, saveManager: this.saveManager, syncUiAndInfo: () => this.syncUiAndInfo(), renderFrame: () => this.renderFrame() });
  }

  public centerCameraOnTile(tx: number, ty: number): void {
    centerDungeonCameraOnTile(this.state.cam, this.state.map.width, this.state.map.height, tx, ty);
    this.renderFrame();
  }

  public setZoomScale(nextScale: number, anchorClientX?: number, anchorClientY?: number): void {
    const rect = this.dom.canvasStageEl.getBoundingClientRect();
    const cx = anchorClientX ?? rect.left + rect.width / 2;
    const cy = anchorClientY ?? rect.top + rect.height / 2;
    const anchor = clientPointToDungeonWorld(this.dom.canvas, this.state.cam, cx, cy);
    applyDungeonZoomWithWorldAnchor(this.dom.canvasStageEl, this.dom.canvas, this.dom.ctx, this.state.cam, this.state.map.width, this.state.map.height, clampMapScale(nextScale), cx, cy, anchor.worldX, anchor.worldY);
    this.renderFrame();
  }

  public getTileClientCenter(tx: number, ty: number): { clientX: number; clientY: number } {
    return tileCenterToClientPoint(this.dom.canvas, this.state.cam, tx, ty);
  }

  public getMap(): DungeonMapDefinition {
    return cloneDungeonMap(this.state.map);
  }

  public getSnapshot(): ChapterMapEditorSnapshot {
    return buildEditorSnapshot(this.state, this.dom.ctx.imageSmoothingEnabled);
  }

  private saveAndPlayCurrentLevel(): void {
    this.saveCurrentMapToGame();
    const targetId = this.state.activeLevelId;
    this.state.openState = false;
    this.stopLoop();
    this.dom.rootEl.hidden = true;
    this.viewportEl.classList.remove('is-battle-active');
    this.onPlayLevelCallback(targetId);
  }

  private syncViewportDimensions(): void {
    syncDungeonCanvasBuffer(this.dom.canvasStageEl, this.dom.canvas, this.dom.ctx, this.state.cam);
    clampDungeonCameraPosition(this.state.cam, this.state.map.width, this.state.map.height, this.state.cam.cameraX, this.state.cam.cameraY);
  }

  private syncUiAndInfo(): void {
    syncEditorUiControls(this.dom, this.state);
    updateEditorInfoStrip(this.dom, this.state);
  }

  private getMutationHooks(): EditorMutationHooks {
    return { state: this.state, audioManager: this.audioManager, syncUiAndInfo: () => this.syncUiAndInfo(), renderFrame: () => this.renderFrame(), showToast: (m) => showEditorToast(this.dom, this.state, m), setBrush: (b) => this.setBrush(b) };
  }

  private startLoop(): void {
    if (this.rafId !== null) return;
    const step = () => {
      if (!this.state.openState) {
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
    renderEditorFrame(this.dom.ctx, this.state);
  }
}
