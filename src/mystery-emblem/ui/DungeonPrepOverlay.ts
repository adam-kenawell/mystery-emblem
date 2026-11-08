/**
 * Mystery Emblem — Dungeon Prep Phase Overlay (`DungeonPrepOverlay`)
 *
 * Implements the streamlined Pre-Battle Dungeon Prep sequence (Step 6):
 * 1. **Manage Units**: Toggle deployed Pokémon (enforcing mandatory Dragon Lord deployment and map cap),
 *    equip up to 4 active moves + designate the single `[E]` Enemy Phase counter move, rename, teach TMs,
 *    evolve, and inspect stats, Personal Skill, typing, and traversal class.
 * 2. **Manage Items**: Equip/replace/transfer/unequip items enforcing **1 Item Slot per Unit**.
 * 3. **View Map**: Inspect terrain/foes, toggle Danger Area, and swap starting positions on blue tiles.
 * 4. **Fight!**: Immediately transitions into Turn 1 Player Phase.
 *
 * Strictly obeys Rule 2 (Unified Pointer Events ONLY — zero keyboard listeners, >= 44x44px targets)
 * and Rule 3 (Authentic PMD: Explorers of Sky window skin & pixelated portraits).
 */

import { resolveUnitVisualAssetId } from '../assets/pmdAssetLoader';
import type { AudioManager } from '../audio/AudioManager';
import {
  ITEMS_LIST,
  getItemById,
  getMoveById,
  getPersonalSkillById,
  getSpeciesById,
} from '../data/index';
import { getUnitEquippedItemId, type SaveStateManager } from '../state/SaveStateManager';
import type {
  DungeonMapDefinition,
  ItemCategory,
  ItemDefinition,
  MoveDefinition,
  OwnedPokemonInstance,
  PrepDeploymentSlot,
} from '../types/schemas';
import { createItemIconCell, createMiniItemIcon } from './PmdItemIconGrid';
import { PmdPortraitView } from './PmdSpriteCanvas';
import { createMiniSpeciesPortrait, createUnitPortraitCell } from './PmdUnitPortraitGrid';
import { bindPointerTap } from './pointerControls';
import { getElementalTypeColor, renderColoredTypeHtml } from './typeColors';

export type PrepSubMode = 'hub' | 'manage_units' | 'manage_items' | 'view_map';

export type ItemFilterTab = 'all' | 'held' | 'healing' | 'x_item' | 'special';

export interface DungeonPrepOverlayOptions {
  parentEl: HTMLElement;
  audioManager: AudioManager;
  getSaveManager: () => SaveStateManager;
  getMap: () => DungeonMapDefinition;
  getEnemyCount: () => number;
  getObjectiveLabel?: () => string;
  getDeploymentSlots: () => ReadonlyArray<PrepDeploymentSlot>;
  getDeploymentCap: () => number;
  getGlobalDangerEnabled: () => boolean;
  getSelectedSwapSlotIndex: () => number | null;
  onToggleDeployUnit: (instanceId: string) => { ok: boolean; message: string };
  onRosterOrLoadoutMutated: () => void;
  onRequestRenameUnit?: (instanceId: string) => Promise<void> | void;
  onEnterViewMap: () => void;
  onExitViewMap: () => void;
  onToggleGlobalDanger: () => void;
  onConfirmEnterDungeon: () => void;
  onSubLayerChanged: () => void;
  onSubModeEntered?: (subMode: PrepSubMode) => void;
}

function escapeHtml(raw: string): string {
  return raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatItemCategoryLabel(category: ItemCategory): string {
  switch (category) {
    case 'held_gear':
      return 'Held Gear';
    case 'held_berry':
      return 'Berry';
    case 'consumable':
      return 'Healing';
    case 'promotion':
      return 'Evolution';
    case 'x_item':
      return 'X-Item';
    case 'vitamin':
      return 'Vitamin';
    case 'tm':
      return 'TM';
  }
}

function formatMoveCategoryBadge(mv: MoveDefinition): string {
  if (mv.category === 'Physical') return 'Phys · R1';
  if (mv.category === 'Special') return 'Spec · R2';
  const rText = mv.range[0] === mv.range[1] ? `R${mv.range[0]}` : `R${mv.range[0]}-${mv.range[1]}`;
  return `Support · ${rText}`;
}

export class DungeonPrepOverlay {
  private readonly opts: DungeonPrepOverlayOptions;
  private readonly rootEl: HTMLElement;
  private readonly hubBackdropEl: HTMLElement;
  private readonly unitsBackdropEl: HTMLElement;
  private readonly itemsBackdropEl: HTMLElement;
  private readonly mapHudEl: HTMLElement;
  private readonly mapReturnBtnEl: HTMLButtonElement;
  private readonly mapHintPillEl: HTMLElement;
  private readonly mapDangerBtnEl: HTMLButtonElement;

  private readonly unitPortraitView: PmdPortraitView;

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

    this.rootEl = document.createElement('div');
    this.rootEl.className = 'pmd-prep-layer';
    this.rootEl.dataset.testid = 'dungeon-prep-layer';
    this.rootEl.hidden = true;

    this.unitPortraitView = new PmdPortraitView({
      pixelScale: 1.5,
      testId: 'prep-unit-portrait',
    });

    // 1. Clean 4-Row Dungeon Prep Hub
    this.hubBackdropEl = document.createElement('div');
    this.hubBackdropEl.className = 'pmd-battle-modal-backdrop pmd-prep-backdrop';
    this.hubBackdropEl.dataset.testid = 'dungeon-prep-hub';
    this.hubBackdropEl.innerHTML = `
      <div class="pmd-window pmd-window--gold pmd-prep-hub-dialog" role="dialog" aria-modal="true" aria-labelledby="prep-hub-title">
        <div class="pmd-prep-hub-header">
          <h2 id="prep-hub-title" class="pmd-panel-title" data-prep-map-name>CHAPTER PREP</h2>
          <p class="pmd-panel-sub" data-prep-objectives></p>
        </div>

        <div class="pmd-prep-menu-grid pmd-menu-list" role="group" aria-label="Chapter Prep Options">
          <button type="button" class="pmd-btn pmd-menu-row pmd-prep-option-btn" data-testid="prep-btn-manage-units">
            <span class="pmd-prep-opt-title">Manage Units</span>
          </button>
          <button type="button" class="pmd-btn pmd-menu-row pmd-prep-option-btn" data-testid="prep-btn-manage-items">
            <span class="pmd-prep-opt-title">Manage Items</span>
          </button>
          <button type="button" class="pmd-btn pmd-menu-row pmd-prep-option-btn" data-testid="prep-btn-view-map">
            <span class="pmd-prep-opt-title">View Map</span>
          </button>
          <button type="button" class="pmd-btn pmd-btn-primary pmd-menu-row pmd-prep-option-btn is-enter-cta" data-testid="prep-btn-enter-dungeon">
            <span class="pmd-prep-opt-title">Fight!</span>
          </button>
        </div>
      </div>
    `;

    // 2. Manage Units Modal
    this.unitsBackdropEl = document.createElement('div');
    this.unitsBackdropEl.className = 'pmd-battle-modal-backdrop pmd-prep-backdrop';
    this.unitsBackdropEl.dataset.testid = 'prep-manage-units-modal';
    this.unitsBackdropEl.hidden = true;
    this.unitsBackdropEl.innerHTML = `
      <div class="pmd-window pmd-prep-modal-dialog pmd-prep-units-dialog" role="dialog" aria-modal="true" aria-label="Manage Units">
        <div class="pmd-prep-modal-topbar">
          <div>
            <h3 class="pmd-panel-title">UNITS</h3>
            <p class="pmd-panel-sub" data-testid="prep-deploy-counter">Deployed: 3 / 3</p>
          </div>
          <button type="button" class="pmd-btn pmd-chip-btn" data-testid="prep-units-close-btn">Done</button>
        </div>

        <div class="pmd-prep-units-body">
          <div class="pmd-prep-roster-pane">
            <span class="pmd-preset-label">Roster</span>
            <div class="pmd-unit-portrait-grid pmd-prep-portrait-grid" data-testid="prep-roster-list"></div>
          </div>

          <div class="pmd-prep-inspector-pane" data-testid="prep-unit-detail">
            <div class="pmd-prep-unit-hero">
              <div class="pmd-prep-unit-avatars">
                <div class="pmd-forecast-portrait-slot pmd-prep-portrait-box" data-prep-portrait-slot></div>
              </div>
              <div class="pmd-prep-unit-title-col">
                <div class="pmd-prep-name-row">
                  <strong class="pmd-prep-unit-big-name" data-testid="prep-detail-nickname">—</strong>
                  <div class="pmd-inline-btns">
                    <span data-prep-deploy-slot></span>
                    <button type="button" class="pmd-btn pmd-chip-btn" data-testid="prep-unit-rename-btn">Rename</button>
                  </div>
                </div>
                <span class="pmd-prep-unit-meta-line" data-testid="prep-detail-meta">—</span>
                <div class="pmd-prep-badges-row" data-testid="prep-unit-types"></div>
              </div>
            </div>

            <div class="pmd-prep-ability-card" data-testid="prep-unit-ability"></div>

            <div class="pmd-prep-item-shortcut-row">
              <div class="pmd-prep-item-shortcut-info" data-testid="prep-unit-item-summary">Item: Empty</div>
              <button type="button" class="pmd-btn pmd-chip-btn" data-testid="prep-unit-open-items-btn">Equip Item</button>
            </div>

            <div class="pmd-prep-item-shortcut-row" data-prep-promo-wrap hidden></div>

            <div class="pmd-prep-stats-section">
              <span class="pmd-preset-label">Stats</span>
              <div class="pmd-prep-stats-grid" data-testid="prep-unit-stats"></div>
            </div>

            <div class="pmd-prep-moves-section">
              <div class="pmd-devtools-row-between">
                <span class="pmd-preset-label" data-prep-active-moves-heading>Moves (0 / 4)</span>
              </div>
              <div class="pmd-prep-move-list" data-testid="prep-active-moves"></div>

              <div data-prep-unlocked-wrap>
                <span class="pmd-preset-label" data-prep-unlocked-heading>Learned Moves</span>
                <div class="pmd-prep-move-list" data-testid="prep-unlocked-moves"></div>
              </div>

              <div data-prep-tm-wrap hidden>
                <span class="pmd-preset-label">TMs</span>
                <div class="pmd-inline-btns" data-testid="prep-compatible-tms"></div>
              </div>
            </div>

            <p class="pmd-prep-status-line" data-testid="prep-units-status" hidden></p>
          </div>
        </div>
      </div>
    `;
    this.unitsBackdropEl
      .querySelector('[data-prep-portrait-slot]')
      ?.appendChild(this.unitPortraitView.canvas);

    // 3. Manage Items Modal (1 Item Slot per Unit)
    this.itemsBackdropEl = document.createElement('div');
    this.itemsBackdropEl.className = 'pmd-battle-modal-backdrop pmd-prep-backdrop';
    this.itemsBackdropEl.dataset.testid = 'prep-manage-items-modal';
    this.itemsBackdropEl.hidden = true;
    this.itemsBackdropEl.innerHTML = `
      <div class="pmd-window pmd-prep-modal-dialog pmd-prep-items-dialog" role="dialog" aria-modal="true" aria-label="Manage Items">
        <div class="pmd-prep-modal-topbar">
          <div>
            <h3 class="pmd-panel-title">ITEMS</h3>
            <p class="pmd-panel-sub">1 Item per Unit</p>
          </div>
          <button type="button" class="pmd-btn pmd-chip-btn" data-testid="prep-items-close-btn">Done</button>
        </div>

        <div class="pmd-prep-items-unit-bar">
          <div class="pmd-unit-portrait-grid pmd-prep-items-portrait-grid" data-testid="prep-items-unit-list"></div>
        </div>

        <div class="pmd-prep-slot-banner" data-testid="prep-unit-item-slot-card"></div>

        <div class="pmd-prep-filter-bar" role="tablist" aria-label="Item Category Filter">
          <button type="button" class="pmd-btn pmd-chip-btn is-active" data-item-filter="all" data-testid="prep-item-filter-all">All</button>
          <button type="button" class="pmd-btn pmd-chip-btn" data-item-filter="held" data-testid="prep-item-filter-held">Held</button>
          <button type="button" class="pmd-btn pmd-chip-btn" data-item-filter="healing" data-testid="prep-item-filter-healing">Healing</button>
          <button type="button" class="pmd-btn pmd-chip-btn" data-item-filter="x_item" data-testid="prep-item-filter-x">X-Items</button>
          <button type="button" class="pmd-btn pmd-chip-btn" data-item-filter="special" data-testid="prep-item-filter-special">TMs / Vitamins</button>
        </div>

        <div class="pmd-prep-items-list" data-testid="prep-acquired-items-list"></div>

        <p class="pmd-prep-status-line" data-testid="prep-items-status" hidden></p>
      </div>
    `;

    // 4. View Map Minimized Top HUD Bar
    this.mapHudEl = document.createElement('div');
    this.mapHudEl.className = 'pmd-battle-hud-top pmd-prep-map-hud';
    this.mapHudEl.dataset.testid = 'prep-map-hud';
    this.mapHudEl.hidden = true;

    this.mapReturnBtnEl = document.createElement('button');
    this.mapReturnBtnEl.type = 'button';
    this.mapReturnBtnEl.className = 'pmd-btn pmd-btn-primary pmd-battle-hud-btn';
    this.mapReturnBtnEl.dataset.testid = 'prep-return-btn';
    this.mapReturnBtnEl.textContent = 'Prep';

    this.mapHintPillEl = document.createElement('span');
    this.mapHintPillEl.className =
      'pmd-window pmd-window--compact pmd-window--translucent pmd-battle-pill pmd-prep-map-pill';
    this.mapHintPillEl.dataset.testid = 'prep-map-status-pill';
    this.mapHintPillEl.textContent = 'Tap 2 blue tiles to swap';

    this.mapDangerBtnEl = document.createElement('button');
    this.mapDangerBtnEl.type = 'button';
    this.mapDangerBtnEl.className = 'pmd-btn pmd-battle-hud-btn';
    this.mapDangerBtnEl.dataset.testid = 'prep-map-danger-btn';
    this.mapDangerBtnEl.textContent = 'Danger: OFF';

    this.mapHudEl.append(this.mapReturnBtnEl, this.mapHintPillEl, this.mapDangerBtnEl);

    this.rootEl.append(
      this.hubBackdropEl,
      this.unitsBackdropEl,
      this.itemsBackdropEl,
      this.mapHudEl
    );
    this.opts.parentEl.appendChild(this.rootEl);

    this.bindStaticButtons();
  }

  public isOpen(): boolean {
    return this.visible;
  }

  public getSubMode(): PrepSubMode {
    return this.subMode;
  }

  public hasActiveSubLayer(): boolean {
    if (!this.visible) return false;
    return this.subMode !== 'hub';
  }

  public show(): void {
    this.visible = true;
    this.subMode = 'hub';
    this.pendingMoveToSwapIn = null;
    this.unitsStatusMsg = '';
    this.itemsStatusMsg = '';
    this.ensureSelectedUnit();
    this.rootEl.hidden = false;
    this.syncVisibility();
    this.refreshAll();
  }

  public hide(): void {
    this.visible = false;
    this.pendingMoveToSwapIn = null;
    this.rootEl.hidden = true;
    this.hubBackdropEl.hidden = true;
    this.unitsBackdropEl.hidden = true;
    this.itemsBackdropEl.hidden = true;
    this.mapHudEl.hidden = true;
  }

  public destroy(): void {
    this.abortController.abort();
    this.rootEl.remove();
  }

  /**
   * Pops one sub-layer on Back / Right-Click / Long-Press; returns `true` if handled,
   * or `false` when already on the root Dungeon Prep Hub (so `BattleScene` can open `BATTLE MENU`).
   */
  public handleBack(): boolean {
    if (!this.visible) return false;

    if (this.pendingMoveToSwapIn) {
      this.opts.audioManager.playSfx('cancel');
      this.pendingMoveToSwapIn = null;
      this.unitsStatusMsg = 'Move swap cancelled.';
      this.renderManageUnits();
      return true;
    }

    if (this.subMode === 'manage_units' || this.subMode === 'manage_items') {
      this.opts.audioManager.playSfx('cancel');
      this.setSubMode('hub');
      return true;
    }

    if (this.subMode === 'view_map') {
      this.opts.audioManager.playSfx('cancel');
      this.opts.onExitViewMap();
      this.setSubMode('hub');
      return true;
    }

    return false;
  }

  public syncMapHudState(): void {
    if (!this.visible) return;
    const dangerOn = this.opts.getGlobalDangerEnabled();
    this.mapDangerBtnEl.textContent = dangerOn ? 'Danger: ON' : 'Danger: OFF';
    this.mapDangerBtnEl.classList.toggle('is-active', dangerOn);

    const swapIdx = this.opts.getSelectedSwapSlotIndex();
    if (swapIdx !== null) {
      const slot = this.opts.getDeploymentSlots().find((s) => s.slotIndex === swapIdx);
      const save = this.opts.getSaveManager().getSave();
      const unit = save?.roster.find((u) => u.instanceId === slot?.unitInstanceId);
      this.mapHintPillEl.textContent = unit
        ? `Swap ${unit.nickname}: tap blue tile`
        : 'Tap blue tile';
    } else {
      this.mapHintPillEl.textContent = 'Tap 2 blue tiles to swap';
    }
  }

  public refreshAll(): void {
    if (!this.visible) return;
    this.ensureSelectedUnit();
    this.renderHub();
    if (this.subMode === 'manage_units') {
      this.renderManageUnits();
    } else if (this.subMode === 'manage_items') {
      this.renderManageItems();
    } else if (this.subMode === 'view_map') {
      this.syncMapHudState();
    }
  }

  private setSubMode(next: PrepSubMode): void {
    this.subMode = next;
    this.pendingMoveToSwapIn = null;
    this.syncVisibility();
    this.refreshAll();
    this.opts.onSubLayerChanged();
    this.opts.onSubModeEntered?.(next);
  }

  private syncVisibility(): void {
    this.hubBackdropEl.hidden = this.subMode !== 'hub';
    this.unitsBackdropEl.hidden = this.subMode !== 'manage_units';
    this.itemsBackdropEl.hidden = this.subMode !== 'manage_items';
    this.mapHudEl.hidden = this.subMode !== 'view_map';
  }

  private ensureSelectedUnit(): void {
    const save = this.opts.getSaveManager().getSave();
    const roster = save?.roster ?? [];
    if (roster.length === 0) {
      this.selectedUnitInstanceId = null;
      return;
    }
    if (!this.selectedUnitInstanceId || !roster.some((u) => u.instanceId === this.selectedUnitInstanceId)) {
      const lord = roster.find((u) => u.isLord) ?? roster[0]!;
      this.selectedUnitInstanceId = lord.instanceId;
    }
  }

  private isUnitDeployed(instanceId: string): boolean {
    return this.opts
      .getDeploymentSlots()
      .some((slot) => slot.unitInstanceId === instanceId);
  }

  private getDeployedUnitsOrdered(): Array<{
    slot: PrepDeploymentSlot;
    unit: OwnedPokemonInstance;
  }> {
    const save = this.opts.getSaveManager().getSave();
    if (!save) return [];
    const byId = new Map(save.roster.map((u) => [u.instanceId, u]));
    const out: Array<{ slot: PrepDeploymentSlot; unit: OwnedPokemonInstance }> = [];
    for (const slot of this.opts.getDeploymentSlots()) {
      if (!slot.unitInstanceId) continue;
      const unit = byId.get(slot.unitInstanceId);
      if (unit) out.push({ slot, unit });
    }
    return out;
  }

  private bindStaticButtons(): void {
    const signal = this.abortController.signal;

    // Hub 4 Core Buttons
    bindPointerTap(
      this.hubBackdropEl.querySelector<HTMLElement>('[data-testid="prep-btn-manage-units"]'),
      () => {
        this.opts.audioManager.playSfx('select');
        this.unitsStatusMsg = '';
        this.setSubMode('manage_units');
      },
      { signal }
    );

    bindPointerTap(
      this.hubBackdropEl.querySelector<HTMLElement>('[data-testid="prep-btn-manage-items"]'),
      () => {
        this.opts.audioManager.playSfx('select');
        this.itemsStatusMsg = '';
        this.setSubMode('manage_items');
      },
      { signal }
    );

    bindPointerTap(
      this.hubBackdropEl.querySelector<HTMLElement>('[data-testid="prep-btn-view-map"]'),
      () => {
        this.opts.audioManager.playSfx('select');
        this.opts.onEnterViewMap();
        this.setSubMode('view_map');
      },
      { signal }
    );

    bindPointerTap(
      this.hubBackdropEl.querySelector<HTMLElement>('[data-testid="prep-btn-enter-dungeon"]'),
      () => {
        this.opts.audioManager.playSfx('select');
        this.opts.onConfirmEnterDungeon();
      },
      { signal }
    );

    // Manage Units Header & Detail Controls
    bindPointerTap(
      this.unitsBackdropEl.querySelector<HTMLElement>('[data-testid="prep-units-close-btn"]'),
      () => {
        this.opts.audioManager.playSfx('cancel');
        this.setSubMode('hub');
      },
      { signal }
    );

    bindPointerTap(
      this.unitsBackdropEl.querySelector<HTMLElement>('[data-testid="prep-unit-rename-btn"]'),
      () => {
        if (!this.selectedUnitInstanceId || !this.opts.onRequestRenameUnit) return;
        this.opts.audioManager.playSfx('select');
        const targetId = this.selectedUnitInstanceId;
        void Promise.resolve(this.opts.onRequestRenameUnit(targetId)).then(() => {
          this.opts.onRosterOrLoadoutMutated();
          this.refreshAll();
        });
      },
      { signal }
    );

    bindPointerTap(
      this.unitsBackdropEl.querySelector<HTMLElement>('[data-testid="prep-unit-open-items-btn"]'),
      () => {
        this.opts.audioManager.playSfx('select');
        this.itemsStatusMsg = '';
        this.setSubMode('manage_items');
      },
      { signal }
    );

    // Manage Items Header & Category Filter Controls
    bindPointerTap(
      this.itemsBackdropEl.querySelector<HTMLElement>('[data-testid="prep-items-close-btn"]'),
      () => {
        this.opts.audioManager.playSfx('cancel');
        this.setSubMode('hub');
      },
      { signal }
    );

    const filterBtns = this.itemsBackdropEl.querySelectorAll<HTMLButtonElement>('[data-item-filter]');
    filterBtns.forEach((btn) => {
      bindPointerTap(
        btn,
        () => {
          const next = (btn.dataset.itemFilter as ItemFilterTab) || 'all';
          this.opts.audioManager.playSfx('select');
          this.itemFilter = next;
          filterBtns.forEach((b) => b.classList.toggle('is-active', b === btn));
          this.renderManageItems();
        },
        { signal }
      );
    });

    // View Map Top HUD Controls
    bindPointerTap(
      this.mapReturnBtnEl,
      () => {
        this.opts.audioManager.playSfx('select');
        this.opts.onExitViewMap();
        this.setSubMode('hub');
      },
      { signal }
    );

    bindPointerTap(
      this.mapDangerBtnEl,
      () => {
        this.opts.onToggleGlobalDanger();
        this.syncMapHudState();
      },
      { signal }
    );
  }

  // ==========================================================================
  // Renderers: Hub, Manage Units, Manage Items
  // ==========================================================================

  private renderHub(): void {
    const map = this.opts.getMap();
    const deployed = this.getDeployedUnitsOrdered();
    const cap = this.opts.getDeploymentCap();
    const enemyCount = this.opts.getEnemyCount();

    const mapNameEl = this.hubBackdropEl.querySelector('[data-prep-map-name]');
    const objEl = this.hubBackdropEl.querySelector('[data-prep-objectives]');

    if (mapNameEl) mapNameEl.textContent = map.name;
    if (objEl) {
      const customObj = this.opts.getObjectiveLabel?.();
      const victoryLabel = customObj ?? `Rout All Enemies (${enemyCount})`;
      objEl.textContent = `${victoryLabel} · ${deployed.length}/${cap} Deployed`;
    }
  }

  private renderManageUnits(): void {
    const mgr = this.opts.getSaveManager();
    const save = mgr.getSave();
    if (!save) return;

    this.ensureSelectedUnit();
    const cap = this.opts.getDeploymentCap();
    const deployedCount = this.getDeployedUnitsOrdered().length;

    const counterEl = this.unitsBackdropEl.querySelector('[data-testid="prep-deploy-counter"]');
    if (counterEl) {
      counterEl.textContent = `${deployedCount} / ${cap} Deployed`;
    }

    // 1. Portrait-Only Roster Grid (zero unit names or levels in grid)
    const listEl = this.unitsBackdropEl.querySelector<HTMLElement>(
      '[data-testid="prep-roster-list"]'
    );
    if (listEl) {
      listEl.innerHTML = '';
      for (const unit of save.roster) {
        const isSelected = unit.instanceId === this.selectedUnitInstanceId;
        const isDeployed = this.isUnitDeployed(unit.instanceId);
        const itemId = getUnitEquippedItemId(unit);

        const buttonEl = createUnitPortraitCell({
          speciesIdOrAssetId: resolveUnitVisualAssetId(unit.speciesId, unit.cosmeticForm),
          ariaLabel: unit.nickname,
          isSelected,
          isLord: unit.isLord,
          isDeployed,
          isBenched: !isDeployed,
          hasItem: Boolean(itemId),
          equippedItemId: itemId,
          testId: `prep-unit-row-${unit.instanceId}`,
          portraitTestId: `prep-unit-portrait-cell-${unit.instanceId}`,
          signal: this.abortController.signal,
          onSelect: () => {
            this.opts.audioManager.playSfx('select');
            this.selectedUnitInstanceId = unit.instanceId;
            this.pendingMoveToSwapIn = null;
            this.unitsStatusMsg = '';
            this.renderManageUnits();
          },
        });
        listEl.appendChild(buttonEl);
      }
    }

    // 2. Selected Unit Detail Inspector
    const selected = save.roster.find((u) => u.instanceId === this.selectedUnitInstanceId);
    if (!selected) return;
    const sp = getSpeciesById(selected.speciesId);
    if (!sp) return;

    void this.unitPortraitView.setPortrait({
      speciesIdOrAssetId: resolveUnitVisualAssetId(selected.speciesId, selected.cosmeticForm),
      emotion: selected.isLord ? 'Determined' : 'Normal',
      mirrorHorizontal: false,
    });

    const nickEl = this.unitsBackdropEl.querySelector('[data-testid="prep-detail-nickname"]');
    if (nickEl) {
      nickEl.textContent = `${selected.nickname}${selected.isLord ? ' ★' : ''}`;
    }

    // Selected Unit Header Deploy / Standby Toggle Button
    const deploySlotEl = this.unitsBackdropEl.querySelector<HTMLElement>('[data-prep-deploy-slot]');
    if (deploySlotEl) {
      deploySlotEl.innerHTML = '';
      const isSelectedDeployed = this.isUnitDeployed(selected.instanceId);
      const deployBtn = document.createElement('button');
      deployBtn.type = 'button';
      deployBtn.dataset.testid = `prep-unit-deploy-btn-${selected.instanceId}`;
      if (selected.isLord) {
        deployBtn.className = 'pmd-btn pmd-chip-btn is-active pmd-prep-deploy-btn';
        deployBtn.textContent = '★ Locked';
        deployBtn.disabled = true;
      } else if (isSelectedDeployed) {
        deployBtn.className = 'pmd-btn pmd-chip-btn is-active pmd-prep-deploy-btn';
        deployBtn.textContent = 'Standby';
        bindPointerTap(
          deployBtn,
          () => {
            const res = this.opts.onToggleDeployUnit(selected.instanceId);
            this.opts.audioManager.playSfx(res.ok ? 'select' : 'cancel');
            this.unitsStatusMsg = res.message;
            this.renderManageUnits();
            this.renderHub();
          },
          { signal: this.abortController.signal }
        );
      } else {
        const capFull = deployedCount >= cap;
        deployBtn.className = `pmd-btn pmd-chip-btn pmd-prep-deploy-btn${capFull ? '' : ' pmd-btn-primary'}`;
        deployBtn.textContent = capFull ? 'Full' : '+ Deploy';
        deployBtn.disabled = capFull;
        bindPointerTap(
          deployBtn,
          () => {
            const res = this.opts.onToggleDeployUnit(selected.instanceId);
            this.opts.audioManager.playSfx(res.ok ? 'select' : 'cancel');
            this.unitsStatusMsg = res.message;
            this.renderManageUnits();
            this.renderHub();
          },
          { signal: this.abortController.signal }
        );
      }
      deploySlotEl.appendChild(deployBtn);
    }

    const metaEl = this.unitsBackdropEl.querySelector('[data-testid="prep-detail-meta"]');
    if (metaEl) {
      const speciesPrefix =
        selected.nickname.trim().toLowerCase() !== sp.name.trim().toLowerCase()
          ? `${sp.name} · `
          : '';
      metaEl.textContent = `${speciesPrefix}Lv. ${selected.level} (EXP ${selected.exp}/100)`;
    }

    const badgesEl = this.unitsBackdropEl.querySelector<HTMLElement>(
      '[data-testid="prep-unit-types"]'
    );
    if (badgesEl) {
      const typeBadges = sp.types
        .map((t) => {
          const color = getElementalTypeColor(t);
          return `<span class="pmd-prep-type-pill pmd-type-text" data-el-type="${escapeHtml(t)}" style="color:${color}; border-color:${color};">${escapeHtml(t)}</span>`;
        })
        .join('');
      badgesEl.innerHTML = `${typeBadges}<span class="pmd-prep-traversal-pill" data-testid="prep-unit-traversal">${escapeHtml(sp.traversalClass)}</span>`;
    }

    // Personal Skill / Ability
    const skill = getPersonalSkillById(sp.personalSkillId);
    const abilityEl = this.unitsBackdropEl.querySelector<HTMLElement>(
      '[data-testid="prep-unit-ability"]'
    );
    if (abilityEl) {
      abilityEl.innerHTML = `
        <span class="pmd-prep-ability-title"><strong>${escapeHtml(skill?.name ?? sp.personalSkillId)}</strong> — ${escapeHtml(skill?.description ?? '—')}</span>
      `;
    }

    // 1-Slot Item Summary (icon-only when equipped)
    const eqItemId = getUnitEquippedItemId(selected);
    const eqItem = eqItemId ? getItemById(eqItemId) : undefined;
    const itemSumEl = this.unitsBackdropEl.querySelector<HTMLElement>(
      '[data-testid="prep-unit-item-summary"]'
    );
    const itemBtnEl = this.unitsBackdropEl.querySelector<HTMLElement>(
      '[data-testid="prep-unit-open-items-btn"]'
    );
    if (itemSumEl) {
      itemSumEl.innerHTML = '';
      if (eqItem) {
        const wrap = document.createElement('span');
        wrap.className = 'pmd-inline-item-row';
        const lbl = document.createElement('span');
        lbl.textContent = 'Item:';
        wrap.append(lbl, createMiniItemIcon(eqItem.id, { sizePx: 20 }));
        itemSumEl.appendChild(wrap);
      } else {
        itemSumEl.innerHTML = 'Item: <strong>Empty</strong>';
      }
    }
    if (itemBtnEl) {
      itemBtnEl.textContent = eqItem ? 'Change' : 'Equip';
    }

    // Evolution Stone / Evolution Gem Promotion Row (hidden unless stone/gem exists)
    const promoWrapEl = this.unitsBackdropEl.querySelector<HTMLElement>('[data-prep-promo-wrap]');
    if (promoWrapEl) {
      promoWrapEl.innerHTML = '';
      const branches = sp.evolutions ?? [];
      const availableBranches = branches.filter((b) => {
        const inBag = save.convoy.some((c) => c.itemId === b.requiredItemId && c.quantity > 0);
        const onUnit = selected.consumableItemId === b.requiredItemId;
        return inBag || onUnit;
      });
      if (availableBranches.length === 0) {
        promoWrapEl.hidden = true;
      } else {
        promoWrapEl.hidden = false;
        const eligibleNow = availableBranches.filter((b) => selected.level >= b.minLevel);
        if (eligibleNow.length === 0) {
          const firstB = availableBranches[0]!;
          const noticeDiv = document.createElement('div');
          noticeDiv.className = 'pmd-prep-item-shortcut-info pmd-inline-item-row';
          noticeDiv.style.color = '#ffd878';
          noticeDiv.appendChild(createMiniItemIcon(firstB.requiredItemId, { sizePx: 20 }));
          const lvlTxt = document.createElement('span');
          lvlTxt.innerHTML = `Evolve at <strong>Lv. ${firstB.minLevel}</strong>`;
          noticeDiv.appendChild(lvlTxt);
          promoWrapEl.appendChild(noticeDiv);
        } else {
          const infoSpan = document.createElement('div');
          infoSpan.className = 'pmd-prep-item-shortcut-info';
          infoSpan.innerHTML = `<strong style="color:#98f8b8;">★ Ready to Evolve</strong>`;
          const btnsWrap = document.createElement('div');
          btnsWrap.className = 'pmd-inline-btns';
          for (const branch of eligibleNow) {
            const targetSp = getSpeciesById(branch.targetSpeciesId);
            const evoBtn = document.createElement('button');
            evoBtn.type = 'button';
            evoBtn.className = 'pmd-btn pmd-btn-primary pmd-chip-btn';
            evoBtn.dataset.testid = `prep-evolve-btn-${branch.targetSpeciesId}`;
            evoBtn.textContent = `Evolve → ${targetSp?.name ?? branch.targetSpeciesId}`;
            bindPointerTap(evoBtn, () => {
              try {
                const promoted = mgr.useEvolutionItemOnUnit(
                  selected.instanceId,
                  branch.requiredItemId,
                  branch.targetSpeciesId
                );
                this.opts.audioManager.playSfx('heal');
                this.unitsStatusMsg = `★ ${promoted.nickname} evolved into ${getSpeciesById(promoted.speciesId)?.name ?? promoted.speciesId}!`;
                this.opts.onRosterOrLoadoutMutated();
                this.renderManageUnits();
                this.renderHub();
              } catch (err) {
                this.opts.audioManager.playSfx('cancel');
                this.unitsStatusMsg = err instanceof Error ? err.message : 'Promotion failed.';
                this.renderManageUnits();
              }
            });
            btnsWrap.appendChild(evoBtn);
          }
          promoWrapEl.append(infoSpan, btnsWrap);
        }
      }
    }

    // 7 Stats (Clean numbers — no % Grw clutter)
    const statsEl = this.unitsBackdropEl.querySelector<HTMLElement>(
      '[data-testid="prep-unit-stats"]'
    );
    if (statsEl) {
      const st = selected.currentStats;
      const statCells: Array<{ label: string; val: number }> = [
        { label: 'HP', val: st.hp },
        { label: 'ATK', val: st.atk },
        { label: 'DEF', val: st.def },
        { label: 'SPA', val: st.spa },
        { label: 'SPD', val: st.spd },
        { label: 'SPE', val: st.spe },
        { label: 'MOV', val: st.mov },
      ];
      statsEl.innerHTML = statCells
        .map(
          (c) => `
          <div class="pmd-prep-stat-box">
            <span class="pmd-prep-stat-lbl">${c.label}</span>
            <strong class="pmd-prep-stat-val">${c.val}</strong>
          </div>
        `
        )
        .join('');
    }

    // Active Moves (Up to 4 + Single [E] Counter)
    const activeHeading = this.unitsBackdropEl.querySelector('[data-prep-active-moves-heading]');
    if (activeHeading) {
      activeHeading.textContent = this.pendingMoveToSwapIn
        ? `Replace a move with ${getMoveById(this.pendingMoveToSwapIn)?.name ?? this.pendingMoveToSwapIn}:`
        : `Moves (${selected.activeMoveIds.length} / 4) · [E] Counter`;
    }

    const activeListEl = this.unitsBackdropEl.querySelector<HTMLElement>(
      '[data-testid="prep-active-moves"]'
    );
    if (activeListEl) {
      activeListEl.innerHTML = '';
      for (const moveId of selected.activeMoveIds) {
        const mv = getMoveById(moveId);
        if (!mv) continue;
        const maxPp = mv.pp + (selected.bonusPpByMoveId[mv.id] ?? 0);
        const isOffensive = mv.category === 'Physical' || mv.category === 'Special';
        const isEquipped = selected.equippedMoveId === mv.id;

        const card = document.createElement('div');
        card.className = `pmd-prep-move-card${isEquipped ? ' is-equipped' : ''}`;
        card.dataset.testid = `prep-active-move-card-${mv.id}`;

        const infoDiv = document.createElement('div');
        infoDiv.className = 'pmd-prep-move-info';
        infoDiv.innerHTML = `
          <div class="pmd-prep-move-title-line">
            <strong>${isEquipped ? '[E] ' : ''}${escapeHtml(mv.name)}</strong>
            <span class="pmd-prep-cat-tag">${renderColoredTypeHtml(mv.type)} · ${escapeHtml(formatMoveCategoryBadge(mv))}</span>
          </div>
          <span class="pmd-prep-move-stats">${isOffensive ? `Mt ${mv.mt} · Hit ${mv.hit}% · Crit ${mv.crit}% · ` : ''}PP ${maxPp}</span>
        `;

        const btnsDiv = document.createElement('div');
        btnsDiv.className = 'pmd-prep-move-actions';

        if (this.pendingMoveToSwapIn) {
          const swapTargetMoveId = this.pendingMoveToSwapIn;
          const replaceBtn = document.createElement('button');
          replaceBtn.type = 'button';
          replaceBtn.className = 'pmd-btn pmd-btn-primary pmd-chip-btn';
          replaceBtn.dataset.testid = `prep-move-replace-${mv.id}`;
          replaceBtn.textContent = 'Replace';
          bindPointerTap(replaceBtn, () => {
            const nextActive = selected.activeMoveIds.map((id) =>
              id === mv.id ? swapTargetMoveId : id
            );
            mgr.setActiveMoves(selected.instanceId, nextActive);
            this.pendingMoveToSwapIn = null;
            this.opts.audioManager.playSfx('select');
            this.unitsStatusMsg = `Equipped ${getMoveById(swapTargetMoveId)?.name ?? swapTargetMoveId}.`;
            this.opts.onRosterOrLoadoutMutated();
            this.renderManageUnits();
          });
          btnsDiv.appendChild(replaceBtn);
        } else {
          if (isOffensive) {
            const eqBtn = document.createElement('button');
            eqBtn.type = 'button';
            eqBtn.className = `pmd-btn pmd-chip-btn${isEquipped ? ' is-active' : ''}`;
            eqBtn.dataset.testid = `prep-move-equip-counter-${mv.id}`;
            eqBtn.textContent = isEquipped ? '[E]' : 'Set [E]';
            bindPointerTap(eqBtn, () => {
              if (isEquipped) return;
              mgr.setEquippedMove(selected.instanceId, mv.id);
              this.opts.audioManager.playSfx('select');
              this.unitsStatusMsg = `[E] ${mv.name} set for Enemy Phase.`;
              this.opts.onRosterOrLoadoutMutated();
              this.renderManageUnits();
            });
            btnsDiv.appendChild(eqBtn);
          }

          if (selected.activeMoveIds.length > 1) {
            const remBtn = document.createElement('button');
            remBtn.type = 'button';
            remBtn.className = 'pmd-btn pmd-chip-btn';
            remBtn.dataset.testid = `prep-move-remove-${mv.id}`;
            remBtn.textContent = 'Unequip';
            bindPointerTap(remBtn, () => {
              const nextActive = selected.activeMoveIds.filter((id) => id !== mv.id);
              mgr.setActiveMoves(selected.instanceId, nextActive);
              this.opts.audioManager.playSfx('cancel');
              this.unitsStatusMsg = `Unequipped ${mv.name}.`;
              this.opts.onRosterOrLoadoutMutated();
              this.renderManageUnits();
            });
            btnsDiv.appendChild(remBtn);
          }
        }

        card.append(infoDiv, btnsDiv);
        activeListEl.appendChild(card);
      }
    }

    // Unlocked Bench Moves
    const benchMoveIds = selected.unlockedMoveIds.filter(
      (id) => !selected.activeMoveIds.includes(id)
    );
    const unlockedWrap = this.unitsBackdropEl.querySelector<HTMLElement>('[data-prep-unlocked-wrap]');
    const unlockedListEl = this.unitsBackdropEl.querySelector<HTMLElement>(
      '[data-testid="prep-unlocked-moves"]'
    );
    if (unlockedWrap && unlockedListEl) {
      unlockedListEl.innerHTML = '';
      if (benchMoveIds.length === 0) {
        unlockedWrap.hidden = true;
      } else {
        unlockedWrap.hidden = false;
        for (const moveId of benchMoveIds) {
          const mv = getMoveById(moveId);
          if (!mv) continue;
          const isOffensive = mv.category === 'Physical' || mv.category === 'Special';
          const card = document.createElement('div');
          card.className = 'pmd-prep-move-card is-bench';
          card.innerHTML = `
            <div class="pmd-prep-move-info">
              <div class="pmd-prep-move-title-line">
                <strong>${escapeHtml(mv.name)}</strong>
                <span class="pmd-prep-cat-tag">${renderColoredTypeHtml(mv.type)} · ${escapeHtml(formatMoveCategoryBadge(mv))}</span>
              </div>
              <span class="pmd-prep-move-stats">${isOffensive ? `Mt ${mv.mt} · Hit ${mv.hit}% · ` : ''}PP ${mv.pp}</span>
            </div>
          `;
          const addBtn = document.createElement('button');
          addBtn.type = 'button';
          addBtn.className = 'pmd-btn pmd-btn-primary pmd-chip-btn';
          addBtn.dataset.testid = `prep-move-add-${mv.id}`;
          addBtn.textContent = selected.activeMoveIds.length < 4 ? 'Equip' : 'Swap';
          bindPointerTap(addBtn, () => {
            if (selected.activeMoveIds.length < 4) {
              mgr.setActiveMoves(selected.instanceId, [...selected.activeMoveIds, mv.id]);
              this.opts.audioManager.playSfx('select');
              this.unitsStatusMsg = `Equipped ${mv.name}.`;
              this.opts.onRosterOrLoadoutMutated();
              this.renderManageUnits();
            } else {
              this.opts.audioManager.playSfx('select');
              this.pendingMoveToSwapIn = mv.id;
              this.unitsStatusMsg = `Tap an active move above to replace with ${mv.name}.`;
              this.renderManageUnits();
            }
          });
          card.appendChild(addBtn);
          unlockedListEl.appendChild(card);
        }
      }
    }

    // Compatible TMs in Convoy
    const tmWrap = this.unitsBackdropEl.querySelector<HTMLElement>('[data-prep-tm-wrap]');
    const tmListEl = this.unitsBackdropEl.querySelector<HTMLElement>(
      '[data-testid="prep-compatible-tms"]'
    );
    if (tmWrap && tmListEl) {
      tmListEl.innerHTML = '';
      const compatibleStockTms = save.convoy.filter((entry) => {
        if (entry.quantity < 1) return false;
        const item = getItemById(entry.itemId);
        if (!item || item.category !== 'tm' || !item.effect.teachesMoveId) return false;
        return (
          sp.compatibleTmIds.includes(item.id) &&
          !selected.unlockedMoveIds.includes(item.effect.teachesMoveId)
        );
      });

      if (compatibleStockTms.length === 0) {
        tmWrap.hidden = true;
      } else {
        tmWrap.hidden = false;
        tmListEl.className = 'pmd-prep-items-list';
        if (
          !this.selectedPrepUnitTmId ||
          !compatibleStockTms.some((e) => e.itemId === this.selectedPrepUnitTmId)
        ) {
          this.selectedPrepUnitTmId = compatibleStockTms[0]!.itemId;
        }
        const selTmEntry =
          compatibleStockTms.find((e) => e.itemId === this.selectedPrepUnitTmId) ??
          compatibleStockTms[0]!;
        const selTmItem = getItemById(selTmEntry.itemId)!;
        const selMove = getMoveById(selTmItem.effect.teachesMoveId ?? '');

        const tmStrip = document.createElement('div');
        tmStrip.className = 'pmd-item-icon-grid is-strip';
        for (const entry of compatibleStockTms) {
          tmStrip.appendChild(
            createItemIconCell({
              itemId: entry.itemId,
              testId: `prep-tm-cell-${entry.itemId}`,
              quantity: entry.quantity,
              isSelected: entry.itemId === selTmItem.id,
              signal: this.abortController.signal,
              onSelect: () => {
                this.opts.audioManager.playSfx('select');
                this.selectedPrepUnitTmId = entry.itemId;
                this.renderManageUnits();
              },
            })
          );
        }

        const tmBanner = document.createElement('div');
        tmBanner.className = 'pmd-item-inspector-banner';
        const tmMain = document.createElement('div');
        tmMain.className = 'pmd-item-inspector-main';
        tmMain.appendChild(createMiniItemIcon(selTmItem.id, { sizePx: 24, decorative: true }));
        const tmCopy = document.createElement('div');
        tmCopy.className = 'pmd-item-inspector-copy';
        const tmDescHtml = selMove
          ? `Teaches ${escapeHtml(selMove.name)} (${renderColoredTypeHtml(selMove.type)} · ${escapeHtml(formatMoveCategoryBadge(selMove))})`
          : escapeHtml(selTmItem.description);
        tmCopy.innerHTML = `
          <div class="pmd-item-inspector-head"><strong class="pmd-item-inspector-name">${escapeHtml(selTmItem.name)} ×${selTmEntry.quantity}</strong></div>
          <span class="pmd-item-inspector-desc">${tmDescHtml}</span>
        `;
        tmMain.appendChild(tmCopy);

        const teachBtn = document.createElement('button');
        teachBtn.type = 'button';
        teachBtn.className = 'pmd-btn pmd-btn-primary pmd-chip-btn';
        teachBtn.dataset.testid = `prep-teach-tm-${selTmItem.id}`;
        teachBtn.textContent = 'Teach';
        bindPointerTap(teachBtn, () => {
          mgr.teachTmMove(selected.instanceId, selTmItem.id);
          this.opts.audioManager.playSfx('heal');
          this.unitsStatusMsg = `${selected.nickname} learned ${selMove?.name ?? selTmItem.name}!`;
          this.opts.onRosterOrLoadoutMutated();
          this.renderManageUnits();
        });

        tmBanner.append(tmMain, teachBtn);
        tmListEl.append(tmStrip, tmBanner);
      }
    }

    const statusEl = this.unitsBackdropEl.querySelector<HTMLElement>(
      '[data-testid="prep-units-status"]'
    );
    if (statusEl) {
      statusEl.hidden = !this.unitsStatusMsg;
      statusEl.textContent = this.unitsStatusMsg;
    }
  }

  private renderManageItems(): void {
    const mgr = this.opts.getSaveManager();
    const save = mgr.getSave();
    if (!save) return;

    this.ensureSelectedUnit();
    const selectedUnit = save.roster.find((u) => u.instanceId === this.selectedUnitInstanceId);
    if (!selectedUnit) return;
    const selectedSp = getSpeciesById(selectedUnit.speciesId);

    // 1. Portrait-Only Unit Selector Grid
    const unitBarEl = this.itemsBackdropEl.querySelector<HTMLElement>(
      '[data-testid="prep-items-unit-list"]'
    );
    if (unitBarEl) {
      unitBarEl.innerHTML = '';
      for (const u of save.roster) {
        const uItemId = getUnitEquippedItemId(u);
        const isSel = u.instanceId === selectedUnit.instanceId;
        const isDep = this.isUnitDeployed(u.instanceId);
        const buttonEl = createUnitPortraitCell({
          speciesIdOrAssetId: resolveUnitVisualAssetId(u.speciesId, u.cosmeticForm),
          ariaLabel: u.nickname,
          isSelected: isSel,
          isLord: u.isLord,
          isDeployed: isDep,
          isBenched: !isDep,
          hasItem: Boolean(uItemId),
          equippedItemId: uItemId,
          testId: `prep-items-unit-${u.instanceId}`,
          portraitTestId: `prep-items-portrait-${u.instanceId}`,
          signal: this.abortController.signal,
          onSelect: () => {
            this.opts.audioManager.playSfx('select');
            this.selectedUnitInstanceId = u.instanceId;
            this.itemsStatusMsg = '';
            this.renderManageItems();
          },
        });
        unitBarEl.appendChild(buttonEl);
      }
    }

    // 2. Selected Unit 1-Item-Slot Card (icon-only badge + effect, zero item text name)
    const slotCardEl = this.itemsBackdropEl.querySelector<HTMLElement>(
      '[data-testid="prep-unit-item-slot-card"]'
    );
    const currentItemId = getUnitEquippedItemId(selectedUnit);
    const currentItem = currentItemId ? getItemById(currentItemId) : undefined;
    if (slotCardEl) {
      slotCardEl.innerHTML = '';
      const infoDiv = document.createElement('div');
      infoDiv.className = 'pmd-prep-slot-info';
      if (currentItem) {
        const titleLine = document.createElement('div');
        titleLine.className = 'pmd-inline-item-row';
        const nickStrong = document.createElement('strong');
        nickStrong.textContent = `${selectedUnit.nickname}:`;
        const iconBadge = createMiniItemIcon(currentItem.id, {
          sizePx: 22,
          testId: 'prep-unit-slot-item-icon',
        });
        const catTag = document.createElement('span');
        catTag.className = 'pmd-prep-cat-tag';
        catTag.textContent = formatItemCategoryLabel(currentItem.category);
        titleLine.append(nickStrong, iconBadge, catTag);

        const descSpan = document.createElement('span');
        descSpan.className = 'pmd-prep-move-stats';
        descSpan.textContent = currentItem.description;
        infoDiv.append(titleLine, descSpan);

        const unequipBtn = document.createElement('button');
        unequipBtn.type = 'button';
        unequipBtn.className = 'pmd-btn pmd-chip-btn';
        unequipBtn.dataset.testid = 'prep-item-unequip-btn';
        unequipBtn.textContent = 'Unequip';
        bindPointerTap(unequipBtn, () => {
          mgr.equipItemToUnit(selectedUnit.instanceId, null);
          this.opts.audioManager.playSfx('cancel');
          this.itemsStatusMsg = `Returned ${currentItem.name} to Bag.`;
          this.opts.onRosterOrLoadoutMutated();
          this.renderManageItems();
        });
        slotCardEl.append(infoDiv, unequipBtn);
      } else {
        infoDiv.innerHTML = `
          <div class="pmd-prep-move-title-line">
            <strong>${escapeHtml(selectedUnit.nickname)}: Empty</strong>
          </div>
        `;
        slotCardEl.appendChild(infoDiv);
      }
    }

    // 3. Aggregate ALL Acquired Items (Convoy Stock + Currently Equipped on Any Roster Unit)
    const convoyQtyByItemId = new Map<string, number>();
    for (const c of save.convoy) {
      if (c.quantity > 0) {
        convoyQtyByItemId.set(c.itemId, (convoyQtyByItemId.get(c.itemId) ?? 0) + c.quantity);
      }
    }
    const holdersByItemId = new Map<string, OwnedPokemonInstance[]>();
    for (const u of save.roster) {
      const id = getUnitEquippedItemId(u);
      if (id) {
        const arr = holdersByItemId.get(id) ?? [];
        arr.push(u);
        holdersByItemId.set(id, arr);
      }
    }

    const acquiredItems: Array<{
      item: ItemDefinition;
      bagQty: number;
      holders: OwnedPokemonInstance[];
    }> = [];

    for (const itemDef of ITEMS_LIST) {
      const bagQty = convoyQtyByItemId.get(itemDef.id) ?? 0;
      const holders = holdersByItemId.get(itemDef.id) ?? [];
      if (bagQty <= 0 && holders.length === 0) continue;

      if (this.itemFilter === 'held' && itemDef.category !== 'held_gear' && itemDef.category !== 'held_berry') {
        continue;
      }
      if (
        this.itemFilter === 'healing' &&
        itemDef.category !== 'consumable' &&
        itemDef.category !== 'promotion'
      ) {
        continue;
      }
      if (this.itemFilter === 'x_item' && itemDef.category !== 'x_item') {
        continue;
      }
      if (
        this.itemFilter === 'special' &&
        itemDef.category !== 'tm' &&
        itemDef.category !== 'vitamin'
      ) {
        continue;
      }

      acquiredItems.push({ item: itemDef, bagQty, holders });
    }

    const itemsListEl = this.itemsBackdropEl.querySelector<HTMLElement>(
      '[data-testid="prep-acquired-items-list"]'
    );
    if (itemsListEl) {
      itemsListEl.innerHTML = '';

      if (acquiredItems.length === 0) {
        const emptyEl = document.createElement('p');
        emptyEl.className = 'pmd-subcard-text';
        emptyEl.textContent = 'No items in this category.';
        itemsListEl.appendChild(emptyEl);
      } else {
        if (
          !this.selectedPrepItemId ||
          !acquiredItems.some((e) => e.item.id === this.selectedPrepItemId)
        ) {
          this.selectedPrepItemId =
            currentItemId && acquiredItems.some((e) => e.item.id === currentItemId)
              ? currentItemId
              : acquiredItems[0]!.item.id;
        }
        const selectedEntry =
          acquiredItems.find((e) => e.item.id === this.selectedPrepItemId) ?? acquiredItems[0]!;

        const gridEl = document.createElement('div');
        gridEl.className = 'pmd-item-icon-grid';
        gridEl.dataset.testid = 'prep-acquired-items-grid';
        for (const entry of acquiredItems) {
          const isEqOnSel = currentItemId === entry.item.id;
          const isHeldOther = entry.holders.some((h) => h.instanceId !== selectedUnit.instanceId);
          gridEl.appendChild(
            createItemIconCell({
              itemId: entry.item.id,
              testId: `prep-item-cell-${entry.item.id}`,
              quantity: entry.bagQty,
              showZeroQuantity: true,
              isSelected: entry.item.id === selectedEntry.item.id,
              isEquippedOnSelected: isEqOnSel,
              isHeldByOther: !isEqOnSel && isHeldOther,
              isDepleted: entry.bagQty === 0 && !isEqOnSel,
              signal: this.abortController.signal,
              onSelect: () => {
                this.opts.audioManager.playSfx('select');
                this.selectedPrepItemId = entry.item.id;
                this.renderManageItems();
              },
            })
          );
        }

        const { item, bagQty, holders } = selectedEntry;
        const inspectorEl = document.createElement('div');
        inspectorEl.className = 'pmd-item-inspector-banner';
        inspectorEl.dataset.testid = 'prep-item-inspector';

        const mainEl = document.createElement('div');
        mainEl.className = 'pmd-item-inspector-main';
        mainEl.appendChild(createMiniItemIcon(item.id, { sizePx: 28, decorative: true }));

        const tmMove =
          item.category === 'tm' && item.effect.teachesMoveId
            ? getMoveById(item.effect.teachesMoveId)
            : undefined;
        const infoDiv = document.createElement('div');
        infoDiv.className = 'pmd-item-inspector-copy';
        infoDiv.innerHTML = `
          <div class="pmd-item-inspector-head">
            <strong class="pmd-item-inspector-name">${escapeHtml(item.name)}</strong>
            <span class="pmd-prep-cat-tag">${escapeHtml(formatItemCategoryLabel(item.category))}</span>
            ${tmMove ? `<span class="pmd-prep-cat-tag">${renderColoredTypeHtml(tmMove.type)}</span>` : ''}
            <span class="pmd-prep-stock-tag">×${bagQty}</span>
            <span class="pmd-item-holders-inline" data-item-holders></span>
          </div>
          <span class="pmd-item-inspector-desc">${escapeHtml(item.description)}</span>
        `;
        const holdersContainer = infoDiv.querySelector<HTMLElement>('[data-item-holders]');
        if (holdersContainer) {
          if (holders.length === 0) {
            holdersContainer.hidden = true;
          } else {
            for (const h of holders) {
              holdersContainer.appendChild(
                createMiniSpeciesPortrait(
                  resolveUnitVisualAssetId(h.speciesId, h.cosmeticForm),
                  {
                    title: h.nickname,
                    sizePx: 22,
                    testId: `prep-item-holder-${item.id}-${h.instanceId}`,
                  }
                )
              );
            }
          }
        }
        mainEl.appendChild(infoDiv);

        const actionBtn = document.createElement('button');
        actionBtn.type = 'button';
        actionBtn.dataset.testid = `prep-item-equip-btn-${item.id}`;

        if (item.equipSlot === 'held' || item.equipSlot === 'consumable') {
          if (currentItemId === item.id) {
            actionBtn.className = 'pmd-btn pmd-chip-btn is-active';
            actionBtn.textContent = 'Unequip';
            bindPointerTap(actionBtn, () => {
              mgr.equipItemToUnit(selectedUnit.instanceId, null);
              this.opts.audioManager.playSfx('cancel');
              this.itemsStatusMsg = `Unequipped ${item.name}.`;
              this.opts.onRosterOrLoadoutMutated();
              this.renderManageItems();
            });
          } else if (bagQty > 0) {
            actionBtn.className = 'pmd-btn pmd-btn-primary pmd-chip-btn';
            actionBtn.textContent = currentItem ? 'Replace' : 'Equip';
            bindPointerTap(actionBtn, () => {
              mgr.equipItemToUnit(selectedUnit.instanceId, item.id);
              this.opts.audioManager.playSfx('select');
              this.itemsStatusMsg = `Equipped ${item.name} on ${selectedUnit.nickname}.`;
              this.opts.onRosterOrLoadoutMutated();
              this.renderManageItems();
            });
          } else {
            const otherHolder = holders.find((h) => h.instanceId !== selectedUnit.instanceId);
            actionBtn.className = 'pmd-btn pmd-chip-btn pmd-portrait-action-btn';
            actionBtn.disabled = !otherHolder;
            if (otherHolder) {
              actionBtn.appendChild(
                createMiniSpeciesPortrait(
                  resolveUnitVisualAssetId(otherHolder.speciesId, otherHolder.cosmeticForm),
                  {
                    title: otherHolder.nickname,
                    sizePx: 20,
                  }
                )
              );
              const takeLbl = document.createElement('span');
              takeLbl.textContent = 'Take';
              actionBtn.appendChild(takeLbl);
              bindPointerTap(actionBtn, () => {
                mgr.equipItemToUnit(selectedUnit.instanceId, item.id, otherHolder.instanceId);
                this.opts.audioManager.playSfx('select');
                this.itemsStatusMsg = `Moved ${item.name} to ${selectedUnit.nickname}.`;
                this.opts.onRosterOrLoadoutMutated();
                this.renderManageItems();
              });
            } else {
              actionBtn.textContent = 'Equip';
            }
          }
        } else if (item.category === 'tm' && item.effect.teachesMoveId) {
          const alreadyKnows = selectedUnit.unlockedMoveIds.includes(item.effect.teachesMoveId);
          const compatible = Boolean(selectedSp?.compatibleTmIds.includes(item.id));
          actionBtn.className = 'pmd-btn pmd-chip-btn';
          actionBtn.textContent = alreadyKnows
            ? 'Known'
            : compatible
              ? 'Teach'
              : 'Incompatible';
          actionBtn.disabled = alreadyKnows || !compatible || bagQty < 1;
          if (!actionBtn.disabled) {
            bindPointerTap(actionBtn, () => {
              mgr.teachTmMove(selectedUnit.instanceId, item.id);
              this.opts.audioManager.playSfx('heal');
              this.itemsStatusMsg = `Taught ${item.name} to ${selectedUnit.nickname}!`;
              this.opts.onRosterOrLoadoutMutated();
              this.renderManageItems();
            });
          }
        } else if (item.category === 'vitamin') {
          actionBtn.className = 'pmd-btn pmd-btn-primary pmd-chip-btn';
          actionBtn.textContent = 'Use';
          actionBtn.disabled = bagQty < 1;
          if (!actionBtn.disabled) {
            bindPointerTap(actionBtn, () => {
              mgr.useVitaminOnUnit(selectedUnit.instanceId, item.id);
              this.opts.audioManager.playSfx('heal');
              this.itemsStatusMsg = `Used ${item.name} on ${selectedUnit.nickname}!`;
              this.opts.onRosterOrLoadoutMutated();
              this.renderManageItems();
            });
          }
        }

        const actionsWrap = document.createElement('div');
        actionsWrap.className = 'pmd-prep-move-actions';
        actionsWrap.appendChild(actionBtn);

        if (
          (item.id === 'evolution_stone' || item.id === 'evolution_gem') &&
          (bagQty > 0 || currentItemId === item.id) &&
          selectedSp
        ) {
          const eligibleBranches = selectedSp.evolutions.filter(
            (b) => b.requiredItemId === item.id && selectedUnit.level >= b.minLevel
          );
          for (const branch of eligibleBranches) {
            const targetSp = getSpeciesById(branch.targetSpeciesId);
            const usePromoBtn = document.createElement('button');
            usePromoBtn.type = 'button';
            usePromoBtn.className = 'pmd-btn pmd-btn-primary pmd-chip-btn';
            usePromoBtn.dataset.testid = `prep-item-use-promo-${branch.targetSpeciesId}`;
            usePromoBtn.textContent = `Evolve → ${targetSp?.name ?? branch.targetSpeciesId}`;
            bindPointerTap(usePromoBtn, () => {
              try {
                const promoted = mgr.useEvolutionItemOnUnit(
                  selectedUnit.instanceId,
                  branch.requiredItemId,
                  branch.targetSpeciesId
                );
                this.opts.audioManager.playSfx('heal');
                this.itemsStatusMsg = `★ ${promoted.nickname} evolved into ${getSpeciesById(promoted.speciesId)?.name ?? promoted.speciesId}!`;
                this.opts.onRosterOrLoadoutMutated();
                this.renderManageItems();
                this.renderHub();
              } catch (err) {
                this.opts.audioManager.playSfx('cancel');
                this.itemsStatusMsg = err instanceof Error ? err.message : 'Promotion failed.';
                this.renderManageItems();
              }
            });
            actionsWrap.appendChild(usePromoBtn);
          }
        }

        inspectorEl.append(mainEl, actionsWrap);
        itemsListEl.append(gridEl, inspectorEl);
      }
    }

    const statusEl = this.itemsBackdropEl.querySelector<HTMLElement>(
      '[data-testid="prep-items-status"]'
    );
    if (statusEl) {
      statusEl.hidden = !this.itemsStatusMsg;
      statusEl.textContent = this.itemsStatusMsg;
    }
  }
}
