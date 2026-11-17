/**
 * Mystery Emblem - Dungeon Prep Phase Overlay Coordinator (`DungeonPrepOverlay.ts`)
 */

import type { AudioManager } from '../audio/AudioManager';
import { areSupportsEnabledForBattlePrep } from '../data/supports/supportMatrix';
import { hasAnyAvailableSupportConversation } from '../engine/supportEngine';
import type { SaveStateManager } from '../state/SaveStateManager';
import type { DungeonMapDefinition, PrepDeploymentSlot } from '../types/schemas';
import type { DialogueOverlay } from './DialogueOverlay';
import { PmdPortraitView } from './PmdSpriteCanvas';
import { SupportsMenuController } from './SupportsMenuView';
import type { TutorialOverlay } from './TutorialOverlay';
import type { ItemFilterTab } from './inspector/ItemActionInspector';
import { renderPrepManageItems } from './prep/PrepItemsRenderer';
import { renderPrepManageUnits } from './prep/PrepUnitsRenderer';
import { bindPrepStaticButtons } from './prep/prepButtonBindings';
import {
  createPrepDomElements,
  renderPrepHubSummary,
  syncPrepMapHudElements,
  type PrepDomElements,
} from './prep/prepTemplates';

export type PrepSubMode = 'hub' | 'manage_units' | 'manage_items' | 'supports' | 'view_map';
export type { ItemFilterTab };

export interface DungeonPrepOverlayOptions {
  parentEl: HTMLElement;
  audioManager: AudioManager;
  getDialogueOverlay?: () => DialogueOverlay | undefined;
  getTutorialOverlay?: () => TutorialOverlay | undefined;
  getSaveManager: () => SaveStateManager;
  getLevelId?: () => string;
  getMap: () => DungeonMapDefinition;
  getEnemyCount: () => number;
  getObjectiveLabel?: () => string;
  getDeploymentSlots: () => ReadonlyArray<PrepDeploymentSlot>;
  getDeploymentCap: () => number;
  getGlobalDangerEnabled: () => boolean;
  getSelectedSwapSlotIndex: () => number | null;
  onToggleDeployUnit: (instanceId: string) => { ok: boolean; message: string };
  onRosterOrLoadoutMutated: () => void;
  onSupportsMutated?: () => void;
  onEnterViewMap: () => void;
  onExitViewMap: () => void;
  onToggleGlobalDanger: () => void;
  onConfirmEnterDungeon: () => void;
  onSaveProgress?: () => void;
  onSubLayerChanged: () => void;
  onSubModeEntered?: (subMode: PrepSubMode) => void;
}

export class DungeonPrepOverlay {
  private readonly opts: DungeonPrepOverlayOptions;
  private readonly dom: PrepDomElements;
  private readonly unitPortraitView: PmdPortraitView;
  private readonly supportsController: SupportsMenuController;
  private readonly abortController = new AbortController();

  private visible = false;
  private subMode: PrepSubMode = 'hub';
  private selectedUnitInstanceId: string | null = null;
  private selectedPrepItemId: string | null = null;
  private selectedPrepUnitTmId: string | null = null;
  private pendingMoveToSwapIn: string | null = null;
  private itemFilter: ItemFilterTab = 'all';
  private unitsStatusMsg = '';
  private itemsStatusMsg = '';

  constructor(options: DungeonPrepOverlayOptions) {
    this.opts = options;
    this.unitPortraitView = new PmdPortraitView({ pixelScale: 1.5, testId: 'prep-unit-portrait' });
    this.dom = createPrepDomElements(this.opts.parentEl, this.unitPortraitView);
    this.supportsController = new SupportsMenuController({
      saveManager: () => this.opts.getSaveManager(),
      audioManager: this.opts.audioManager,
      dialogueOverlay: this.opts.getDialogueOverlay?.(),
      signal: this.abortController.signal,
      onSupportsMutated: () => {
        this.opts.onSupportsMutated?.();
        this.refreshAll();
      },
      onLayerStateChanged: () => this.opts.onSubLayerChanged(),
    });
    bindPrepStaticButtons({
      dom: this.dom,
      audioManager: this.opts.audioManager,
      signal: this.abortController.signal,
      getTutorialOverlay: this.opts.getTutorialOverlay,
      getSelectedUnitInstanceId: () => this.selectedUnitInstanceId,
      onRosterOrLoadoutMutated: () => this.opts.onRosterOrLoadoutMutated(),
      onRefreshAll: () => this.refreshAll(),
      onSetSubMode: (mode, clearStatus) => {
        if (clearStatus === 'units') this.unitsStatusMsg = '';
        if (clearStatus === 'items') this.itemsStatusMsg = '';
        this.setSubMode(mode);
      },
      onEnterViewMap: () => this.opts.onEnterViewMap(),
      onExitViewMap: () => this.opts.onExitViewMap(),
      onConfirmEnterDungeon: () => this.opts.onConfirmEnterDungeon(),
      onSaveProgress: () => this.opts.onSaveProgress?.(),
      onToggleGlobalDanger: () => this.opts.onToggleGlobalDanger(),
      onSyncMapHudState: () => this.syncMapHudState(),
      onSelectItemFilter: (filter) => { this.itemFilter = filter; this.renderManageItems(); },
    });
  }

  public isOpen(): boolean { return this.visible; }
  public getSubMode(): PrepSubMode { return this.subMode; }
  public hasActiveSubLayer(): boolean { return this.visible && this.subMode !== 'hub'; }

  public show(): void {
    this.visible = true;
    this.subMode = 'hub';
    this.pendingMoveToSwapIn = null;
    this.unitsStatusMsg = '';
    this.itemsStatusMsg = '';
    this.ensureSelectedUnit();
    this.dom.rootEl.hidden = false;
    this.syncVisibility();
    this.refreshAll();
  }

  public hide(): void {
    this.visible = false;
    this.pendingMoveToSwapIn = null;
    this.supportsController.reset();
    this.dom.rootEl.hidden = true;
    this.dom.hubBackdropEl.hidden = true;
    this.dom.unitsBackdropEl.hidden = true;
    this.dom.itemsBackdropEl.hidden = true;
    this.dom.supportsBackdropEl.hidden = true;
    this.dom.mapHudEl.hidden = true;
  }

  public destroy(): void {
    this.supportsController.destroy();
    this.abortController.abort();
    this.dom.rootEl.remove();
  }

  public handleBack(): boolean {
    if (!this.visible) return false;
    if (this.pendingMoveToSwapIn) {
      this.opts.audioManager.playSfx('cancel');
      this.pendingMoveToSwapIn = null;
      this.unitsStatusMsg = 'Move swap cancelled.';
      this.renderManageUnits();
      return true;
    }
    if (this.subMode === 'manage_units') {
      const tutorial = this.opts.getTutorialOverlay?.();
      const expected = tutorial?.getExpectedAction() ?? null;
      if (expected && expected !== 'prep_close_manage_units') {
        tutorial?.nudgeActiveStep();
        return true;
      }
      this.opts.audioManager.playSfx('cancel');
      this.setSubMode('hub');
      tutorial?.notifyActionCompleted('prep_close_manage_units');
      return true;
    }
    if (this.subMode === 'manage_items') {
      this.opts.audioManager.playSfx('cancel');
      this.setSubMode('hub');
      return true;
    }
    if (this.subMode === 'supports') {
      if (this.supportsController.handleBack()) {
        return true;
      }
      this.opts.audioManager.playSfx('cancel');
      this.setSubMode('hub');
      return true;
    }
    if (this.subMode === 'view_map') {
      const tutorial = this.opts.getTutorialOverlay?.();
      this.opts.audioManager.playSfx('cancel');
      this.opts.onExitViewMap();
      this.setSubMode('hub');
      tutorial?.notifyActionCompleted('prep_swap_or_finish_view_map');
      return true;
    }
    return false;
  }

  public syncMapHudState(): void {
    if (!this.visible) return;
    syncPrepMapHudElements({
      dom: this.dom,
      dangerOn: this.opts.getGlobalDangerEnabled(),
      swapIdx: this.opts.getSelectedSwapSlotIndex(),
      slots: this.opts.getDeploymentSlots(),
      roster: this.opts.getSaveManager().getSave()?.roster ?? [],
    });
  }

  public refreshAll(): void {
    if (!this.visible) return;
    this.ensureSelectedUnit();
    this.renderHub();
    if (this.subMode === 'manage_units') this.renderManageUnits();
    else if (this.subMode === 'manage_items') this.renderManageItems();
    else if (this.subMode === 'supports') this.supportsController.renderInto(this.dom.supportsBodyEl);
    else if (this.subMode === 'view_map') this.syncMapHudState();
  }

  private setSubMode(next: PrepSubMode): void {
    if (next !== 'supports') this.supportsController.reset();
    this.subMode = next;
    this.pendingMoveToSwapIn = null;
    this.syncVisibility();
    this.refreshAll();
    this.opts.onSubLayerChanged();
    this.opts.onSubModeEntered?.(next);
  }

  private syncVisibility(): void {
    this.dom.hubBackdropEl.hidden = this.subMode !== 'hub';
    this.dom.unitsBackdropEl.hidden = this.subMode !== 'manage_units';
    this.dom.itemsBackdropEl.hidden = this.subMode !== 'manage_items';
    this.dom.supportsBackdropEl.hidden = this.subMode !== 'supports';
    this.dom.mapHudEl.hidden = this.subMode !== 'view_map';
  }

  private ensureSelectedUnit(): void {
    const roster = this.opts.getSaveManager().getSave()?.roster ?? [];
    if (roster.length === 0) { this.selectedUnitInstanceId = null; return; }
    if (!this.selectedUnitInstanceId || !roster.some((u) => u.instanceId === this.selectedUnitInstanceId)) {
      this.selectedUnitInstanceId = (roster.find((u) => u.isLord) ?? roster[0]!).instanceId;
    }
  }

  private isUnitDeployed(instanceId: string): boolean {
    return this.opts.getDeploymentSlots().some((slot) => slot.unitInstanceId === instanceId);
  }

  private getDeployedCount(): number {
    const save = this.opts.getSaveManager().getSave();
    if (!save) return 0;
    const ids = new Set(save.roster.map((u) => u.instanceId));
    return this.opts.getDeploymentSlots().filter((s) => s.unitInstanceId && ids.has(s.unitInstanceId)).length;
  }

  private renderHub(): void {
    const save = this.opts.getSaveManager().getSave();
    const levelId = this.opts.getLevelId?.() ?? '';
    renderPrepHubSummary({
      hubBackdropEl: this.dom.hubBackdropEl,
      supportsBtnEl: this.dom.supportsBtnEl,
      supportsEnabled: areSupportsEnabledForBattlePrep(save, levelId),
      hasReadySupport: hasAnyAvailableSupportConversation(save),
      map: this.opts.getMap(),
      deployedCount: this.getDeployedCount(),
      cap: this.opts.getDeploymentCap(),
      enemyCount: this.opts.getEnemyCount(),
      objectiveLabel: this.opts.getObjectiveLabel?.(),
    });
  }

  private renderManageUnits(): void {
    const mgr = this.opts.getSaveManager();
    const save = mgr.getSave();
    if (!save) return;
    this.ensureSelectedUnit();
    this.selectedPrepUnitTmId = renderPrepManageUnits({
      unitsBackdropEl: this.dom.unitsBackdropEl,
      unitPortraitView: this.unitPortraitView,
      saveManager: mgr,
      save,
      audioManager: this.opts.audioManager,
      signal: this.abortController.signal,
      selectedUnitInstanceId: this.selectedUnitInstanceId,
      selectedPrepUnitTmId: this.selectedPrepUnitTmId,
      pendingMoveToSwapIn: this.pendingMoveToSwapIn,
      unitsStatusMsg: this.unitsStatusMsg,
      deployedCount: this.getDeployedCount(),
      deploymentCap: this.opts.getDeploymentCap(),
      isUnitDeployed: (id) => this.isUnitDeployed(id),
      onSelectUnit: (id) => { this.selectedUnitInstanceId = id; this.pendingMoveToSwapIn = null; this.unitsStatusMsg = ''; this.renderManageUnits(); },
      onToggleDeployUnit: (id) => this.opts.onToggleDeployUnit(id),
      onSetStatusAndRefresh: (msg, opts) => {
        this.pendingMoveToSwapIn = null;
        this.unitsStatusMsg = msg;
        if (opts?.mutated) this.opts.onRosterOrLoadoutMutated();
        this.renderManageUnits();
        if (opts?.refreshHub) this.renderHub();
      },
      onSetPendingMoveSwap: (moveId, msg) => { this.pendingMoveToSwapIn = moveId; this.unitsStatusMsg = msg; this.renderManageUnits(); },
      onSelectUnitTm: (tmId) => { this.selectedPrepUnitTmId = tmId; this.renderManageUnits(); },
    });
  }

  private renderManageItems(): void {
    const mgr = this.opts.getSaveManager();
    const save = mgr.getSave();
    if (!save) return;
    this.ensureSelectedUnit();
    this.selectedPrepItemId = renderPrepManageItems({
      itemsBackdropEl: this.dom.itemsBackdropEl,
      saveManager: mgr,
      save,
      audioManager: this.opts.audioManager,
      signal: this.abortController.signal,
      selectedUnitInstanceId: this.selectedUnitInstanceId,
      selectedPrepItemId: this.selectedPrepItemId,
      itemFilter: this.itemFilter,
      itemsStatusMsg: this.itemsStatusMsg,
      isUnitDeployed: (id) => this.isUnitDeployed(id),
      onSelectUnit: (id) => { this.selectedUnitInstanceId = id; this.itemsStatusMsg = ''; this.renderManageItems(); },
      onSelectItem: (itemId) => { this.selectedPrepItemId = itemId; this.renderManageItems(); },
      onMutated: (msg, alsoRefreshHub) => {
        this.itemsStatusMsg = msg;
        this.opts.onRosterOrLoadoutMutated();
        this.renderManageItems();
        if (alsoRefreshHub) this.renderHub();
      },
      onError: (msg) => { this.itemsStatusMsg = msg; this.renderManageItems(); },
    });
  }
}
