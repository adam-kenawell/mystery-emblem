/**
 * Mystery Emblem - Playable Tactical Dungeon Battle Scene (`BattleScene`)
 * Thin public orchestrator delegating to modular controllers in `scenes/battle/*`.
 */

import { getAudioManager } from '../audio/AudioManager';
import { cloneDungeonMap } from '../data/chapterMapRegistry';
import type { BattleUnitState, CombatForecast, HealForecast } from '../engine/combatEngine';
import { isInMapBounds } from '../engine/terrainAndPathfinding';
import type { SaveStateManager } from '../state/SaveStateManager';
import type { DungeonMapDefinition } from '../types/schemas';
import type { DungeonPrepOverlay } from '../ui/DungeonPrepOverlay';
import {
  centerDungeonCameraOnTile,
  clampDungeonCameraPosition,
  clientPointToDungeonWorld,
  syncDungeonCanvasBuffer,
  tileCenterToClientPoint,
} from '../ui/gridViewportMath';
import { clampMapScale } from '../ui/mapZoomController';
import {
  cheatFullHealSquad,
  cheatInstantWin,
  forceUnitHpForTest,
  forceUnitPositionForTest,
  handleBattleMenuOrBack,
} from './battle/battleBackAndCheats';
import { clearOpeningAndPhaseAnimations } from './battle/battleBannersAndTransitions';
import { renderBattleFrame } from './battle/battleCanvasRenderer';
import { createBattleDomShell, type BattleDomRefs } from './battle/battleDomShell';
import { advanceBattleAnimations, clearFloatingTexts } from './battle/battleFloatingCallouts';
import {
  closeBattleScene,
  hasBattleActiveSubLayer,
  openBattleScene,
  restartBattleMatch,
} from './battle/battleLifecycleController';
import { requestManualEndPhase } from './battle/battlePhaseAndAiRunner';
import { getActivePrepSaveManager } from './battle/battlePrepAndAssets';
import {
  createBattlePrepOverlay,
  subscribeBattlePrepMapChanges,
} from './battle/battlePrepOverlayWiring';
import { refreshFromExternalSaveCheat } from './battle/battlePrepSlotActions';
import {
  BATTLE_TILE_DISPLAY_PX,
  BATTLE_TILE_SCALE,
  type BattleExitDestination,
  type BattleFieldMenuSubView,
  type BattleInteractionState,
  type BattleOpenOptions,
  type BattlePhase,
  type BattleSceneOptions,
  type BattleSceneSnapshot,
} from './battle/battlePublicTypes';
import { applyBattleAnchoredZoom, bindBattleCanvasStagePointers } from './battle/battleStagePointers';
import { resolveTutorialSpotlightTiles } from './battle/battleTutorialSpotlights';
import {
  createInitialBattleRuntimeState,
  type BattleControllerContext,
  type BattleRuntimeState,
} from './battle/battleTypesAndState';
import { bindBattleUiButtons } from './battle/battleUiButtonBindings';
import { buildBattleSceneSnapshot } from './battle/battleUnitQueries';

export {
  BATTLE_TILE_DISPLAY_PX,
  BATTLE_TILE_SCALE,
  type BattleExitDestination,
  type BattleFieldMenuSubView,
  type BattleInteractionState,
  type BattlePhase,
  type BattleSceneOptions,
  type BattleSceneSnapshot,
};

export class BattleScene {
  private readonly dom: BattleDomRefs;
  private readonly state: BattleRuntimeState;
  private readonly prepOverlay: DungeonPrepOverlay;
  private readonly ctx: BattleControllerContext;
  private readonly abortController = new AbortController();
  private unsubscribeMapChanges: (() => void) | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private rafId: number | null = null;

  constructor(options: BattleSceneOptions) {
    const audioManager = options.audioManager ?? getAudioManager();
    this.dom = createBattleDomShell();
    this.state = createInitialBattleRuntimeState();
    this.prepOverlay = createBattlePrepOverlay(
      options,
      audioManager,
      this.state,
      this.dom,
      () => this.ctx
    );

    this.ctx = {
      viewportEl: options.viewportEl,
      state: this.state,
      dom: this.dom,
      prepOverlay: this.prepOverlay,
      saveManager: options.saveManager,
      audioManager,
      dialogueOverlay: options.dialogueOverlay,
      tutorialOverlay: options.tutorialOverlay,
      abortSignal: this.abortController.signal,
      onExitCallback: options.onExit,
      onLayerStateChanged: options.onLayerStateChanged,
      startLoop: () => this.startLoop(),
      stopLoop: () => this.stopLoop(),
      renderNow: () => this.renderNow(),
      syncViewportDimensions: () => this.syncViewportDimensions(),
      centerCameraOnTile: (tx, ty) => this.centerCameraOnTile(tx, ty),
    };

    options.viewportEl.appendChild(this.dom.rootEl);
    this.unsubscribeMapChanges = subscribeBattlePrepMapChanges(() => this.ctx);
    bindBattleUiButtons(this.ctx);
    this.resizeObserver = bindBattleCanvasStagePointers(this.ctx);
  }

  public isOpen(): boolean {
    return this.state.openState;
  }

  public hasActiveSubLayer(): boolean {
    return hasBattleActiveSubLayer(this.ctx);
  }

  public open(options?: BattleOpenOptions): Promise<void> {
    return openBattleScene(this.ctx, options);
  }

  public close(destination: BattleExitDestination = 'default'): void {
    closeBattleScene(this.ctx, destination);
  }

  public destroy(): void {
    this.state.battleRunGen += 1;
    this.stopLoop();
    if (this.state.phaseBannerTimer !== null) {
      window.clearTimeout(this.state.phaseBannerTimer);
      this.state.phaseBannerTimer = null;
    }
    clearOpeningAndPhaseAnimations(this.state, this.dom);
    clearFloatingTexts(this.state, this.dom);
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    this.unsubscribeMapChanges?.();
    this.unsubscribeMapChanges = null;
    this.state.guestPrepManager?.dispose();
    this.state.guestPrepManager = null;
    this.prepOverlay.destroy();
    this.abortController.abort();
    this.ctx.viewportEl.classList.remove('is-battle-active');
    this.dom.rootEl.remove();
  }

  public handleMenuOrBack(clientX?: number, clientY?: number): void {
    handleBattleMenuOrBack(this.ctx, clientX, clientY);
  }

  public restartMatch(): Promise<void> {
    return restartBattleMatch(this.ctx);
  }

  public requestManualEndPhase(): Promise<void> {
    return requestManualEndPhase(this.ctx);
  }

  public setFastMode(enabled: boolean): void {
    this.state.fastMode = Boolean(enabled);
  }

  public setPauseOnLevelUpInFastMode(enabled: boolean): void {
    this.state.pauseOnLevelUpInFastMode = Boolean(enabled);
  }

  public setRng(rngFn: (() => number) | null): void {
    this.state.customRng = rngFn;
  }

  public forceUnitHpForTest(unitId: string, nextHp: number): void {
    forceUnitHpForTest(this.ctx, unitId, nextHp);
  }

  public forceUnitPositionForTest(unitId: string, x: number, y: number): void {
    forceUnitPositionForTest(this.ctx, unitId, x, y);
  }

  public cheatFullHealSquad(): void {
    cheatFullHealSquad(this.ctx);
  }

  public cheatInstantWin(): void {
    cheatInstantWin(this.ctx);
  }

  public refreshFromExternalSaveCheat(): void {
    refreshFromExternalSaveCheat(this.ctx);
  }

  public centerCameraOnTile(tx: number, ty: number): void {
    centerDungeonCameraOnTile(this.state.cam, this.state.map.width, this.state.map.height, tx, ty);
    this.renderNow();
  }

  public setZoomScale(nextScale: number, anchorClientX?: number, anchorClientY?: number): void {
    const rect = this.dom.canvasStageEl.getBoundingClientRect();
    const cx = anchorClientX ?? rect.left + rect.width / 2;
    const cy = anchorClientY ?? rect.top + rect.height / 2;
    const anchor = clientPointToDungeonWorld(this.dom.canvas, this.state.cam, cx, cy);
    applyBattleAnchoredZoom(this.ctx, clampMapScale(nextScale), cx, cy, anchor.worldX, anchor.worldY);
    this.renderNow();
  }

  public getTileClientCenter(tx: number, ty: number): { clientX: number; clientY: number } {
    return tileCenterToClientPoint(this.dom.canvas, this.state.cam, tx, ty);
  }

  public getTutorialSpotlightTileCoords(): Array<{ x: number; y: number }> {
    const filter = this.ctx.tutorialOverlay?.getActiveTileFilter() ?? null;
    if (!filter || !this.state.openState) return [];
    return resolveTutorialSpotlightTiles(this.state, this.prepOverlay, filter);
  }

  public getUnits(): ReadonlyArray<BattleUnitState> {
    return this.state.units;
  }

  public get map(): DungeonMapDefinition {
    return this.state.map;
  }

  public getMap(): DungeonMapDefinition {
    return cloneDungeonMap(this.state.map);
  }

  public getTileAt(x: number, y: number) {
    if (!isInMapBounds(this.state.map, x, y)) return null;
    const cell = this.state.map.tiles[y]?.[x];
    return cell ? { ...cell } : null;
  }

  public getCurrentForecast(): CombatForecast | null {
    return this.state.currentForecast;
  }

  public getCurrentHealForecast(): HealForecast | null {
    return this.state.currentHealForecast;
  }

  public getPrepSaveManager(): SaveStateManager {
    return getActivePrepSaveManager(this.state, this.ctx.saveManager);
  }

  public getSnapshot(): BattleSceneSnapshot {
    return buildBattleSceneSnapshot(this.state, this.dom, this.prepOverlay);
  }

  private syncViewportDimensions(): void {
    syncDungeonCanvasBuffer(this.dom.canvasStageEl, this.dom.canvas, this.dom.ctx, this.state.cam);
    clampDungeonCameraPosition(
      this.state.cam,
      this.state.map.width,
      this.state.map.height,
      this.state.cam.cameraX,
      this.state.cam.cameraY
    );
  }

  public renderFrame(now: number = performance.now()): void {
    renderBattleFrame(this.ctx, now);
  }

  private renderNow(): void {
    this.renderFrame(performance.now());
  }

  private startLoop(): void {
    if (this.rafId !== null) return;
    const tick = (now: number) => {
      if (!this.state.openState) {
        this.rafId = null;
        return;
      }
      advanceBattleAnimations(this.state, now);
      renderBattleFrame(this.ctx, now);
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
}
