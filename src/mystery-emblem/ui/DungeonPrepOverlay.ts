/**
 * Mystery Emblem — Dungeon Prep Phase Overlay (`DungeonPrepOverlay`)
 *
 * Implements the Fire Emblem-inspired Pre-Battle Dungeon Prep sequence (Step 6):
 * 1. **Manage Units**: View all recruited Pokémon, toggle which units enter the dungeon (enforcing
 *    mandatory Dragon Lord deployment and the map's deployment cap), equip up to 4 active moves +
 *    designate the single `[E]` Enemy Phase counter move, edit nicknames, teach TMs, and inspect
 *    stats, growth rates, Personal Skill (ability), elemental typing, traversal class, and level/EXP.
 * 2. **Manage Items**: View all items acquired across the campaign (Convoy stock + items currently
 *    equipped on roster units) and equip/replace/transfer/unequip them. Enforces the strict
 *    **1 Item Slot per Unit** rule (1 Held Gear/Berry, OR 1 Healing/Status item, OR 1 X-Item, OR 1 Stone/Gem).
 * 3. **View Map**: Minimizes the Prep Hub to reveal the upcoming dungeon battlefield, enemy units,
 *    and blue starting tiles so the player can inspect terrain/foes and swap starting positions
 *    strictly among valid blue deployment tiles.
 * 4. **Enter Dungeon**: Opens a confirmation pop-up ("Are you ready to enter?") before ending Prep
 *    and transitioning into Turn 1 Player Phase.
 *
 * Strictly obeys Rule 2 (Unified Pointer Events ONLY — zero keyboard listeners, >= 44x44px targets)
 * and Rule 3 (Authentic PMD: Explorers of Sky window skin & pixelated sprites/portraits).
 */

import type { AudioManager } from '../audio/AudioManager';
import {
  ITEMS_LIST,
  getItemById,
  getMoveById,
  getPersonalSkillById,
  getSpeciesById,
} from '../data/index';
import type { PrepDeploymentSlot } from '../data/playableBattleMap';
import { getUnitEquippedItemId, type SaveStateManager } from '../state/SaveStateManager';
import type {
  DungeonMapDefinition,
  ItemCategory,
  ItemDefinition,
  MoveDefinition,
  OwnedPokemonInstance,
} from '../types/schemas';
import { PmdPortraitView, PmdSpriteActor } from './PmdSpriteCanvas';
import { bindPointerTap } from './pointerControls';

export type PrepSubMode =
  | 'hub'
  | 'manage_units'
  | 'manage_items'
  | 'view_map'
  | 'confirm_enter';

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
  onEnterViewMap: () => void;
  onExitViewMap: () => void;
  onToggleGlobalDanger: () => void;
  onConfirmEnterDungeon: () => void;
  onSubLayerChanged: () => void;
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
      return 'Held Berry';
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
  return `Heal/Sup · ${rText}`;
}

export class DungeonPrepOverlay {
  private readonly opts: DungeonPrepOverlayOptions;
  private readonly rootEl: HTMLElement;
  private readonly hubBackdropEl: HTMLElement;
  private readonly unitsBackdropEl: HTMLElement;
  private readonly itemsBackdropEl: HTMLElement;
  private readonly confirmBackdropEl: HTMLElement;
  private readonly renameBackdropEl: HTMLElement;
  private readonly mapHudEl: HTMLElement;
  private readonly mapReturnBtnEl: HTMLButtonElement;
  private readonly mapHintPillEl: HTMLElement;
  private readonly mapDangerBtnEl: HTMLButtonElement;

  private readonly unitPortraitView: PmdPortraitView;
  private unitSpriteActor: PmdSpriteActor | null = null;

  private readonly abortController = new AbortController();
  private visible = false;
  private subMode: PrepSubMode = 'hub';
  private renameOpen = false;

  private selectedUnitInstanceId: string | null = null;
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
      pixelScale: 1.25,
      testId: 'prep-unit-portrait',
    });

    // 1. Main Dungeon Prep Hub (4 Core Options)
    this.hubBackdropEl = document.createElement('div');
    this.hubBackdropEl.className = 'pmd-battle-modal-backdrop pmd-prep-backdrop';
    this.hubBackdropEl.dataset.testid = 'dungeon-prep-hub';
    this.hubBackdropEl.innerHTML = `
      <div class="pmd-window pmd-window--gold pmd-prep-hub-dialog" role="dialog" aria-modal="true" aria-labelledby="prep-hub-title">
        <div class="pmd-prep-hub-header">
          <span class="pmd-battle-kicker">PRE-BATTLE PREPARATIONS</span>
          <h2 id="prep-hub-title" class="pmd-panel-title" data-prep-map-name>DUNGEON PREP</h2>
          <p class="pmd-panel-sub" data-prep-objectives>Select your squad, equip moves &amp; items, or inspect the map before entering.</p>
        </div>

        <div class="pmd-prep-squad-strip" data-testid="prep-hub-squad-strip"></div>

        <div class="pmd-prep-menu-grid" role="group" aria-label="Dungeon Prep Options">
          <button type="button" class="pmd-btn pmd-prep-option-btn" data-testid="prep-btn-manage-units">
            <span class="pmd-prep-opt-title">Manage Units</span>
            <span class="pmd-prep-opt-sub" data-prep-units-sub>Squad, Moves, Stats &amp; Ability</span>
          </button>
          <button type="button" class="pmd-btn pmd-prep-option-btn" data-testid="prep-btn-manage-items">
            <span class="pmd-prep-opt-title">Manage Items</span>
            <span class="pmd-prep-opt-sub" data-prep-items-sub>1 Item Slot per Unit</span>
          </button>
          <button type="button" class="pmd-btn pmd-prep-option-btn" data-testid="prep-btn-view-map">
            <span class="pmd-prep-opt-title">View Map</span>
            <span class="pmd-prep-opt-sub">Inspect Foes &amp; Swap Start Tiles</span>
          </button>
          <button type="button" class="pmd-btn pmd-btn-primary pmd-prep-option-btn is-enter-cta" data-testid="prep-btn-enter-dungeon">
            <span class="pmd-prep-opt-title">Enter Dungeon</span>
            <span class="pmd-prep-opt-sub">Begin Battle Phase</span>
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
            <h3 class="pmd-panel-title">MANAGE UNITS</h3>
            <p class="pmd-panel-sub" data-testid="prep-deploy-counter">Entering Dungeon: 3 / 3</p>
          </div>
          <button type="button" class="pmd-btn pmd-chip-btn" data-testid="prep-units-close-btn">Done</button>
        </div>

        <div class="pmd-prep-units-body">
          <div class="pmd-prep-roster-pane">
            <span class="pmd-preset-label">Recruited Pokémon</span>
            <div class="pmd-prep-roster-list" data-testid="prep-roster-list"></div>
          </div>

          <div class="pmd-prep-inspector-pane" data-testid="prep-unit-detail">
            <div class="pmd-prep-unit-hero">
              <div class="pmd-prep-unit-avatars">
                <div class="pmd-forecast-portrait-slot pmd-prep-portrait-box" data-prep-portrait-slot></div>
                <div class="pmd-prep-sprite-box" data-prep-sprite-slot></div>
              </div>
              <div class="pmd-prep-unit-title-col">
                <div class="pmd-prep-name-row">
                  <strong class="pmd-prep-unit-big-name" data-testid="prep-detail-nickname">—</strong>
                  <button type="button" class="pmd-btn pmd-chip-btn" data-testid="prep-unit-rename-btn">Rename</button>
                </div>
                <span class="pmd-prep-unit-meta-line" data-testid="prep-detail-meta">—</span>
                <div class="pmd-prep-badges-row" data-testid="prep-unit-types"></div>
              </div>
            </div>

            <div class="pmd-prep-ability-card" data-testid="prep-unit-ability"></div>

            <div class="pmd-prep-item-shortcut-row">
              <div class="pmd-prep-item-shortcut-info" data-testid="prep-unit-item-summary">Item Slot: Empty</div>
              <button type="button" class="pmd-btn pmd-chip-btn" data-testid="prep-unit-open-items-btn">Equip Item</button>
            </div>

            <div class="pmd-prep-item-shortcut-row" data-prep-promo-wrap hidden></div>

            <div class="pmd-prep-stats-section">
              <span class="pmd-preset-label">Stats &amp; Growth Rates</span>
              <div class="pmd-prep-stats-grid" data-testid="prep-unit-stats"></div>
            </div>

            <div class="pmd-prep-moves-section">
              <div class="pmd-devtools-row-between">
                <span class="pmd-preset-label" data-prep-active-moves-heading>Active Moves (0 / 4) — Tap [E] for Enemy Phase Counter</span>
              </div>
              <div class="pmd-prep-move-list" data-testid="prep-active-moves"></div>

              <div data-prep-unlocked-wrap>
                <span class="pmd-preset-label" data-prep-unlocked-heading>Unlocked Move Pool</span>
                <div class="pmd-prep-move-list" data-testid="prep-unlocked-moves"></div>
              </div>

              <div data-prep-tm-wrap hidden>
                <span class="pmd-preset-label">Compatible TMs in Bag</span>
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
            <h3 class="pmd-panel-title">MANAGE ITEMS</h3>
            <p class="pmd-panel-sub">1 Item Slot per Pokémon — Held Gear, Berry, Healing, or X-Item</p>
          </div>
          <button type="button" class="pmd-btn pmd-chip-btn" data-testid="prep-items-close-btn">Done</button>
        </div>

        <div class="pmd-prep-items-unit-bar">
          <span class="pmd-preset-label">Select Unit to Equip:</span>
          <div class="pmd-prep-unit-pills" data-testid="prep-items-unit-list"></div>
        </div>

        <div class="pmd-prep-slot-banner" data-testid="prep-unit-item-slot-card"></div>

        <div class="pmd-prep-filter-bar" role="tablist" aria-label="Item Category Filter">
          <button type="button" class="pmd-btn pmd-chip-btn is-active" data-item-filter="all" data-testid="prep-item-filter-all">All</button>
          <button type="button" class="pmd-btn pmd-chip-btn" data-item-filter="held" data-testid="prep-item-filter-held">Held</button>
          <button type="button" class="pmd-btn pmd-chip-btn" data-item-filter="healing" data-testid="prep-item-filter-healing">Healing</button>
          <button type="button" class="pmd-btn pmd-chip-btn" data-item-filter="x_item" data-testid="prep-item-filter-x">X-Items</button>
          <button type="button" class="pmd-btn pmd-chip-btn" data-item-filter="special" data-testid="prep-item-filter-special">TMs / Other</button>
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
    this.mapReturnBtnEl.textContent = 'Return to Prep';

    this.mapHintPillEl = document.createElement('span');
    this.mapHintPillEl.className = 'pmd-window pmd-battle-pill pmd-prep-map-pill';
    this.mapHintPillEl.dataset.testid = 'prep-map-status-pill';
    this.mapHintPillEl.textContent = 'Tap 2 blue tiles to swap units';

    this.mapDangerBtnEl = document.createElement('button');
    this.mapDangerBtnEl.type = 'button';
    this.mapDangerBtnEl.className = 'pmd-btn pmd-battle-hud-btn';
    this.mapDangerBtnEl.dataset.testid = 'prep-map-danger-btn';
    this.mapDangerBtnEl.textContent = 'Danger: OFF';

    this.mapHudEl.append(this.mapReturnBtnEl, this.mapHintPillEl, this.mapDangerBtnEl);

    // 5. Enter Dungeon Confirmation Pop-up
    this.confirmBackdropEl = document.createElement('div');
    this.confirmBackdropEl.className = 'pmd-battle-modal-backdrop pmd-prep-backdrop';
    this.confirmBackdropEl.dataset.testid = 'prep-confirm-enter-modal';
    this.confirmBackdropEl.hidden = true;
    this.confirmBackdropEl.innerHTML = `
      <div class="pmd-window pmd-window--gold pmd-battle-outcome-dialog pmd-prep-confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="prep-confirm-title">
        <span class="pmd-battle-kicker">READY TO DEPART</span>
        <h3 id="prep-confirm-title" class="pmd-panel-title">ENTER DUNGEON?</h3>
        <p class="pmd-panel-sub" data-confirm-sub>Are you ready to end Dungeon Prep and begin the battle?</p>
        <p class="pmd-subcard-text" data-confirm-party></p>
        <div class="pmd-battle-outcome-actions">
          <button type="button" class="pmd-btn pmd-btn-primary" data-testid="prep-confirm-yes-btn">Enter Dungeon</button>
          <button type="button" class="pmd-btn" data-testid="prep-confirm-cancel-btn">Cancel</button>
        </div>
      </div>
    `;

    // 6. Inline PMD Nickname Modal (Pointer-driven, zero keyboard listeners!)
    this.renameBackdropEl = document.createElement('div');
    this.renameBackdropEl.className = 'pmd-battle-modal-backdrop pmd-prep-backdrop';
    this.renameBackdropEl.dataset.testid = 'prep-rename-modal';
    this.renameBackdropEl.hidden = true;
    this.renameBackdropEl.innerHTML = `
      <div class="pmd-window pmd-window--gold pmd-battle-outcome-dialog pmd-prep-confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="prep-rename-title">
        <h3 id="prep-rename-title" class="pmd-panel-title">RENAME POKÉMON</h3>
        <p class="pmd-panel-sub" data-prep-rename-sub></p>
        <input
          type="text"
          maxlength="16"
          class="pmd-select pmd-prep-text-input"
          data-testid="prep-rename-input"
          placeholder="Enter nickname (max 16 chars)"
          autocomplete="off"
        />
        <div class="pmd-battle-outcome-actions">
          <button type="button" class="pmd-btn pmd-btn-primary" data-testid="prep-rename-save-btn">Confirm</button>
          <button type="button" class="pmd-btn" data-testid="prep-rename-default-btn">Default</button>
          <button type="button" class="pmd-btn" data-testid="prep-rename-cancel-btn">Cancel</button>
        </div>
      </div>
    `;

    this.rootEl.append(
      this.hubBackdropEl,
      this.unitsBackdropEl,
      this.itemsBackdropEl,
      this.mapHudEl,
      this.confirmBackdropEl,
      this.renameBackdropEl
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
    return this.renameOpen || this.subMode !== 'hub';
  }

  public show(): void {
    this.visible = true;
    this.subMode = 'hub';
    this.renameOpen = false;
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
    this.renameOpen = false;
    this.pendingMoveToSwapIn = null;
    this.rootEl.hidden = true;
    this.hubBackdropEl.hidden = true;
    this.unitsBackdropEl.hidden = true;
    this.itemsBackdropEl.hidden = true;
    this.mapHudEl.hidden = true;
    this.confirmBackdropEl.hidden = true;
    this.renameBackdropEl.hidden = true;
  }

  public destroy(): void {
    this.abortController.abort();
    this.unitSpriteActor?.destroy();
    this.unitSpriteActor = null;
    this.rootEl.remove();
  }

  /**
   * Pops one sub-layer on Back / Right-Click / Long-Press; returns `true` if handled,
   * or `false` when already on the root Dungeon Prep Hub (so `BattleScene` can open `BATTLE MENU`).
   */
  public handleBack(): boolean {
    if (!this.visible) return false;

    if (this.renameOpen) {
      this.opts.audioManager.playSfx('cancel');
      this.renameOpen = false;
      this.renameBackdropEl.hidden = true;
      this.opts.onSubLayerChanged();
      return true;
    }

    if (this.pendingMoveToSwapIn) {
      this.opts.audioManager.playSfx('cancel');
      this.pendingMoveToSwapIn = null;
      this.unitsStatusMsg = 'Move swap cancelled.';
      this.renderManageUnits();
      return true;
    }

    if (this.subMode === 'confirm_enter') {
      this.opts.audioManager.playSfx('cancel');
      this.setSubMode('hub');
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
        : 'Tap blue starting tile';
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
    } else if (this.subMode === 'confirm_enter') {
      this.renderConfirmModal();
    } else if (this.subMode === 'view_map') {
      this.syncMapHudState();
    }
  }

  // ==========================================================================
  // Internal State & Event Wiring
  // ==========================================================================

  private setSubMode(next: PrepSubMode): void {
    this.subMode = next;
    this.pendingMoveToSwapIn = null;
    this.syncVisibility();
    this.refreshAll();
    this.opts.onSubLayerChanged();
  }

  private syncVisibility(): void {
    this.hubBackdropEl.hidden = this.subMode !== 'hub';
    this.unitsBackdropEl.hidden = this.subMode !== 'manage_units';
    this.itemsBackdropEl.hidden = this.subMode !== 'manage_items';
    this.mapHudEl.hidden = this.subMode !== 'view_map';
    this.confirmBackdropEl.hidden = this.subMode !== 'confirm_enter';
    this.renameBackdropEl.hidden = !this.renameOpen;
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
        this.setSubMode('confirm_enter');
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
        this.openRenameModal();
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

    // Enter Dungeon Confirmation Controls
    bindPointerTap(
      this.confirmBackdropEl.querySelector<HTMLElement>('[data-testid="prep-confirm-yes-btn"]'),
      () => {
        this.opts.onConfirmEnterDungeon();
      },
      { signal }
    );

    bindPointerTap(
      this.confirmBackdropEl.querySelector<HTMLElement>('[data-testid="prep-confirm-cancel-btn"]'),
      () => {
        this.opts.audioManager.playSfx('cancel');
        this.setSubMode('hub');
      },
      { signal }
    );

    // Rename Modal Controls
    bindPointerTap(
      this.renameBackdropEl.querySelector<HTMLElement>('[data-testid="prep-rename-save-btn"]'),
      () => this.commitRename(false),
      { signal }
    );
    bindPointerTap(
      this.renameBackdropEl.querySelector<HTMLElement>('[data-testid="prep-rename-default-btn"]'),
      () => this.commitRename(true),
      { signal }
    );
    bindPointerTap(
      this.renameBackdropEl.querySelector<HTMLElement>('[data-testid="prep-rename-cancel-btn"]'),
      () => {
        this.opts.audioManager.playSfx('cancel');
        this.renameOpen = false;
        this.renameBackdropEl.hidden = true;
        this.opts.onSubLayerChanged();
      },
      { signal }
    );
  }

  // ==========================================================================
  // Renderers: Hub, Manage Units, Manage Items, Confirm & Rename
  // ==========================================================================

  private renderHub(): void {
    const map = this.opts.getMap();
    const save = this.opts.getSaveManager().getSave();
    const roster = save?.roster ?? [];
    const deployed = this.getDeployedUnitsOrdered();
    const cap = this.opts.getDeploymentCap();
    const enemyCount = this.opts.getEnemyCount();
    const lord = roster.find((u) => u.isLord) ?? deployed[0]?.unit;

    const mapNameEl = this.hubBackdropEl.querySelector('[data-prep-map-name]');
    const objEl = this.hubBackdropEl.querySelector('[data-prep-objectives]');
    const unitsSubEl = this.hubBackdropEl.querySelector('[data-prep-units-sub]');
    const itemsSubEl = this.hubBackdropEl.querySelector('[data-prep-items-sub]');
    const stripEl = this.hubBackdropEl.querySelector<HTMLElement>(
      '[data-testid="prep-hub-squad-strip"]'
    );

    if (mapNameEl) mapNameEl.textContent = map.name;
    if (objEl) {
      const defeatCondition = lord ? `${lord.nickname} Faints` : 'Squad Wiped Out';
      const customObj = this.opts.getObjectiveLabel?.();
      const victoryLabel = customObj ?? `Defeat All Enemies (${enemyCount})`;
      objEl.textContent = `Squad: ${deployed.length}/${cap} · Victory: ${victoryLabel} · Defeat: ${defeatCondition}`;
    }
    if (unitsSubEl) {
      unitsSubEl.textContent = `${deployed.length}/${cap} Deployed (${roster.length} Recruited)`;
    }
    if (itemsSubEl && save) {
      const bagTotal = save.convoy.reduce((acc, c) => acc + c.quantity, 0);
      const equippedCount = save.roster.filter((u) => getUnitEquippedItemId(u) !== null).length;
      itemsSubEl.textContent = `${bagTotal} in Bag · ${equippedCount} Equipped`;
    }

    if (stripEl) {
      stripEl.innerHTML = deployed
        .map(({ slot, unit }) => {
          const sp = getSpeciesById(unit.speciesId);
          const eqMove = unit.equippedMoveId ? getMoveById(unit.equippedMoveId) : undefined;
          const eqItemId = getUnitEquippedItemId(unit);
          const eqItem = eqItemId ? getItemById(eqItemId) : undefined;
          return `
            <div class="pmd-prep-squad-chip">
              <strong class="pmd-prep-chip-name">${escapeHtml(unit.nickname)}${unit.isLord ? ' ★' : ''}</strong>
              <span class="pmd-prep-chip-meta">${escapeHtml(sp?.name ?? unit.speciesId)} Lv.${unit.level} · (${slot.x},${slot.y})</span>
              <span class="pmd-prep-chip-loadout">[E] ${escapeHtml(eqMove?.name ?? 'None')}${eqItem ? ` · ${escapeHtml(eqItem.name)}` : ''}</span>
            </div>
          `;
        })
        .join('');
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
      counterEl.textContent = `Entering Dungeon: ${deployedCount} / ${cap} Units (${save.roster.length} Recruited)`;
    }

    // 1. Roster List
    const listEl = this.unitsBackdropEl.querySelector<HTMLElement>(
      '[data-testid="prep-roster-list"]'
    );
    if (listEl) {
      listEl.innerHTML = '';
      for (const unit of save.roster) {
        const sp = getSpeciesById(unit.speciesId);
        const isSelected = unit.instanceId === this.selectedUnitInstanceId;
        const isDeployed = this.isUnitDeployed(unit.instanceId);
        const slot = this.opts
          .getDeploymentSlots()
          .find((s) => s.unitInstanceId === unit.instanceId);
        const itemId = getUnitEquippedItemId(unit);
        const item = itemId ? getItemById(itemId) : undefined;

        const row = document.createElement('div');
        row.className = `pmd-prep-roster-row${isSelected ? ' is-selected' : ''}${isDeployed ? ' is-deployed' : ''}`;

        const selectBtn = document.createElement('button');
        selectBtn.type = 'button';
        selectBtn.className = 'pmd-btn pmd-prep-roster-select-btn';
        selectBtn.dataset.testid = `prep-unit-row-${unit.instanceId}`;
        selectBtn.innerHTML = `
          <span class="pmd-prep-r-top">
            <strong>${escapeHtml(unit.nickname)}${unit.isLord ? ' ★' : ''}</strong>
            <span class="pmd-prep-r-lv">Lv.${unit.level}</span>
          </span>
          <span class="pmd-prep-r-sub">${escapeHtml(sp?.name ?? unit.speciesId)} · ${(sp?.types ?? []).join('/')}${slot ? ` · (${slot.x},${slot.y})` : ''}${item ? ` · ${escapeHtml(item.name)}` : ''}</span>
        `;
        bindPointerTap(selectBtn, () => {
          this.opts.audioManager.playSfx('select');
          this.selectedUnitInstanceId = unit.instanceId;
          this.pendingMoveToSwapIn = null;
          this.unitsStatusMsg = '';
          this.renderManageUnits();
        });

        const deployBtn = document.createElement('button');
        deployBtn.type = 'button';
        deployBtn.dataset.testid = `prep-unit-deploy-btn-${unit.instanceId}`;
        if (unit.isLord) {
          deployBtn.className = 'pmd-btn pmd-chip-btn is-active pmd-prep-deploy-btn';
          deployBtn.textContent = '★ Locked';
          deployBtn.disabled = true;
        } else if (isDeployed) {
          deployBtn.className = 'pmd-btn pmd-chip-btn is-active pmd-prep-deploy-btn';
          deployBtn.textContent = '✓ Entering';
          bindPointerTap(deployBtn, () => {
            const res = this.opts.onToggleDeployUnit(unit.instanceId);
            this.opts.audioManager.playSfx(res.ok ? 'select' : 'cancel');
            this.unitsStatusMsg = res.message;
            this.selectedUnitInstanceId = unit.instanceId;
            this.renderManageUnits();
            this.renderHub();
          });
        } else {
          const capFull = deployedCount >= cap;
          deployBtn.className = 'pmd-btn pmd-chip-btn pmd-prep-deploy-btn';
          deployBtn.textContent = capFull ? 'Cap Full' : '+ Deploy';
          deployBtn.disabled = capFull;
          bindPointerTap(deployBtn, () => {
            const res = this.opts.onToggleDeployUnit(unit.instanceId);
            this.opts.audioManager.playSfx(res.ok ? 'select' : 'cancel');
            this.unitsStatusMsg = res.message;
            this.selectedUnitInstanceId = unit.instanceId;
            this.renderManageUnits();
            this.renderHub();
          });
        }

        row.append(selectBtn, deployBtn);
        listEl.appendChild(row);
      }
    }

    // 2. Selected Unit Detail Inspector
    const selected = save.roster.find((u) => u.instanceId === this.selectedUnitInstanceId);
    if (!selected) return;
    const sp = getSpeciesById(selected.speciesId);
    if (!sp) return;

    void this.unitPortraitView.setPortrait({
      speciesIdOrAssetId: sp.id,
      emotion: selected.isLord ? 'Determined' : 'Normal',
      mirrorHorizontal: false,
    });

    const spriteSlotEl = this.unitsBackdropEl.querySelector<HTMLElement>('[data-prep-sprite-slot]');
    if (spriteSlotEl) {
      if (!this.unitSpriteActor) {
        this.unitSpriteActor = new PmdSpriteActor({
          speciesIdOrAssetId: sp.id,
          scale: 1.5,
          initialAction: 'Idle',
          initialDirection: 0,
          testId: 'prep-unit-sprite',
        });
        spriteSlotEl.appendChild(this.unitSpriteActor.canvas);
        void this.unitSpriteActor.ready();
      } else {
        void this.unitSpriteActor.setSpecies(sp.id);
      }
    }

    const nickEl = this.unitsBackdropEl.querySelector('[data-testid="prep-detail-nickname"]');
    if (nickEl) {
      nickEl.textContent = `${selected.nickname}${selected.isLord ? ' ★' : ''}`;
    }

    const metaEl = this.unitsBackdropEl.querySelector('[data-testid="prep-detail-meta"]');
    if (metaEl) {
      const deployState = selected.isLord
        ? 'Leader (Locked)'
        : this.isUnitDeployed(selected.instanceId)
          ? 'Entering Dungeon'
          : 'On Standby';
      metaEl.textContent = `${sp.name} · Stage ${sp.stage} · Lv. ${selected.level} (EXP ${selected.exp}/100) · ${deployState}`;
    }

    const badgesEl = this.unitsBackdropEl.querySelector<HTMLElement>(
      '[data-testid="prep-unit-types"]'
    );
    if (badgesEl) {
      const typeBadges = sp.types
        .map((t) => `<span class="pmd-prep-type-pill">${escapeHtml(t)}</span>`)
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
        <span class="pmd-prep-ability-title">Ability: <strong>${escapeHtml(skill?.name ?? sp.personalSkillId)}</strong></span>
        <span class="pmd-prep-ability-desc">${escapeHtml(skill?.description ?? '—')}</span>
      `;
    }

    // 1-Slot Item Summary
    const eqItemId = getUnitEquippedItemId(selected);
    const eqItem = eqItemId ? getItemById(eqItemId) : undefined;
    const itemSumEl = this.unitsBackdropEl.querySelector<HTMLElement>(
      '[data-testid="prep-unit-item-summary"]'
    );
    const itemBtnEl = this.unitsBackdropEl.querySelector<HTMLElement>(
      '[data-testid="prep-unit-open-items-btn"]'
    );
    if (itemSumEl) {
      itemSumEl.innerHTML = eqItem
        ? `Item Slot: <strong>${escapeHtml(eqItem.name)}</strong> <span class="pmd-prep-cat-tag">${escapeHtml(formatItemCategoryLabel(eqItem.category))}</span>`
        : 'Item Slot: <strong>Empty</strong> (1 item max)';
    }
    if (itemBtnEl) {
      itemBtnEl.textContent = eqItem ? 'Change Item' : 'Equip Item';
    }

    // Evolution Stone / Evolution Gem Promotion Row
    const promoWrapEl = this.unitsBackdropEl.querySelector<HTMLElement>('[data-prep-promo-wrap]');
    if (promoWrapEl) {
      promoWrapEl.innerHTML = '';
      const branches = sp.evolutions ?? [];
      if (branches.length === 0) {
        promoWrapEl.hidden = true;
      } else {
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
            const reqItem = getItemById(firstB.requiredItemId)?.name ?? firstB.requiredItemId;
            promoWrapEl.innerHTML = `<div class="pmd-prep-item-shortcut-info" style="color:#ffd878;">Promotion: Reach <strong>Lv. ${firstB.minLevel}</strong> to use ${escapeHtml(reqItem)}</div>`;
          } else {
            const infoSpan = document.createElement('div');
            infoSpan.className = 'pmd-prep-item-shortcut-info';
            infoSpan.innerHTML = `<strong style="color:#98f8b8;">★ Promotion Ready!</strong>`;
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
    }

    // 7 Stats + Growth Rates
    const statsEl = this.unitsBackdropEl.querySelector<HTMLElement>(
      '[data-testid="prep-unit-stats"]'
    );
    if (statsEl) {
      const st = selected.currentStats;
      const gr = sp.growthRates;
      const statCells: Array<{ label: string; val: number; growth?: number }> = [
        { label: 'HP', val: st.hp, growth: gr.hp },
        { label: 'ATK', val: st.atk, growth: gr.atk },
        { label: 'DEF', val: st.def, growth: gr.def },
        { label: 'SPA', val: st.spa, growth: gr.spa },
        { label: 'SPD', val: st.spd, growth: gr.spd },
        { label: 'SPE', val: st.spe, growth: gr.spe },
        { label: 'MOV', val: st.mov },
      ];
      statsEl.innerHTML = statCells
        .map(
          (c) => `
          <div class="pmd-prep-stat-box">
            <span class="pmd-prep-stat-lbl">${c.label}</span>
            <strong class="pmd-prep-stat-val">${c.val}</strong>
            <span class="pmd-prep-stat-gr">${c.growth !== undefined ? `${c.growth}% Grw` : sp.traversalClass}</span>
          </div>
        `
        )
        .join('');
    }

    // Active Moves (Up to 4 + Single [E] Counter)
    const activeHeading = this.unitsBackdropEl.querySelector('[data-prep-active-moves-heading]');
    if (activeHeading) {
      activeHeading.textContent = this.pendingMoveToSwapIn
        ? `Choose an Active Move to Replace with ${getMoveById(this.pendingMoveToSwapIn)?.name ?? this.pendingMoveToSwapIn}:`
        : `Active Moves (${selected.activeMoveIds.length} / 4) — Single [E] Counter`;
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
            <span class="pmd-prep-cat-tag">${escapeHtml(mv.type)} · ${escapeHtml(formatMoveCategoryBadge(mv))}</span>
          </div>
          <span class="pmd-prep-move-stats">${isOffensive ? `Mt ${mv.mt} · Hit ${mv.hit}% · Crit ${mv.crit}% · ` : ''}PP ${maxPp} — ${escapeHtml(mv.description)}</span>
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
            this.unitsStatusMsg = `Equipped ${getMoveById(swapTargetMoveId)?.name ?? swapTargetMoveId} in place of ${mv.name}.`;
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
            eqBtn.textContent = isEquipped ? '[E] Counter' : 'Set [E]';
            bindPointerTap(eqBtn, () => {
              if (isEquipped) return;
              mgr.setEquippedMove(selected.instanceId, mv.id);
              this.opts.audioManager.playSfx('select');
              this.unitsStatusMsg = `${selected.nickname} set [E] ${mv.name} (Range ${mv.range[0]}) for Enemy Phase counters.`;
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
                <span class="pmd-prep-cat-tag">${escapeHtml(mv.type)} · ${escapeHtml(formatMoveCategoryBadge(mv))}</span>
              </div>
              <span class="pmd-prep-move-stats">${isOffensive ? `Mt ${mv.mt} · Hit ${mv.hit}% · ` : ''}PP ${mv.pp}</span>
            </div>
          `;
          const addBtn = document.createElement('button');
          addBtn.type = 'button';
          addBtn.className = 'pmd-btn pmd-btn-primary pmd-chip-btn';
          addBtn.dataset.testid = `prep-move-add-${mv.id}`;
          addBtn.textContent = selected.activeMoveIds.length < 4 ? 'Equip' : 'Swap In';
          bindPointerTap(addBtn, () => {
            if (selected.activeMoveIds.length < 4) {
              mgr.setActiveMoves(selected.instanceId, [...selected.activeMoveIds, mv.id]);
              this.opts.audioManager.playSfx('select');
              this.unitsStatusMsg = `Equipped ${mv.name} onto ${selected.nickname}!`;
              this.opts.onRosterOrLoadoutMutated();
              this.renderManageUnits();
            } else {
              this.opts.audioManager.playSfx('select');
              this.pendingMoveToSwapIn = mv.id;
              this.unitsStatusMsg = `Select one of ${selected.nickname}'s 4 active moves above to replace with ${mv.name}.`;
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
        for (const entry of compatibleStockTms) {
          const item = getItemById(entry.itemId)!;
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'pmd-btn pmd-chip-btn';
          btn.dataset.testid = `prep-teach-tm-${item.id}`;
          btn.textContent = `Teach ${item.name} (×${entry.quantity})`;
          bindPointerTap(btn, () => {
            mgr.teachTmMove(selected.instanceId, item.id);
            this.opts.audioManager.playSfx('heal');
            this.unitsStatusMsg = `${selected.nickname} permanently learned ${getMoveById(item.effect.teachesMoveId!)?.name ?? item.name}!`;
            this.opts.onRosterOrLoadoutMutated();
            this.renderManageUnits();
          });
          tmListEl.appendChild(btn);
        }
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

    // 1. Unit Selector Strip
    const unitBarEl = this.itemsBackdropEl.querySelector<HTMLElement>(
      '[data-testid="prep-items-unit-list"]'
    );
    if (unitBarEl) {
      unitBarEl.innerHTML = '';
      for (const u of save.roster) {
        const uItemId = getUnitEquippedItemId(u);
        const uItem = uItemId ? getItemById(uItemId) : undefined;
        const isSel = u.instanceId === selectedUnit.instanceId;
        const isDep = this.isUnitDeployed(u.instanceId);
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `pmd-btn pmd-chip-btn pmd-prep-item-unit-pill${isSel ? ' is-active' : ''}`;
        btn.dataset.testid = `prep-items-unit-${u.instanceId}`;
        btn.textContent = `${u.nickname}${u.isLord ? ' ★' : isDep ? ' ✓' : ''} · ${uItem ? uItem.name : 'Empty'}`;
        bindPointerTap(btn, () => {
          this.opts.audioManager.playSfx('select');
          this.selectedUnitInstanceId = u.instanceId;
          this.itemsStatusMsg = '';
          this.renderManageItems();
        });
        unitBarEl.appendChild(btn);
      }
    }

    // 2. Selected Unit 1-Item-Slot Card
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
        infoDiv.innerHTML = `
          <div class="pmd-prep-move-title-line">
            <strong>${escapeHtml(selectedUnit.nickname)}'s Item Slot (1/1): ${escapeHtml(currentItem.name)}</strong>
            <span class="pmd-prep-cat-tag">${escapeHtml(formatItemCategoryLabel(currentItem.category))}</span>
          </div>
          <span class="pmd-prep-move-stats">${escapeHtml(currentItem.description)}</span>
        `;
        const unequipBtn = document.createElement('button');
        unequipBtn.type = 'button';
        unequipBtn.className = 'pmd-btn pmd-chip-btn';
        unequipBtn.dataset.testid = 'prep-item-unequip-btn';
        unequipBtn.textContent = 'Unequip';
        bindPointerTap(unequipBtn, () => {
          mgr.equipItemToUnit(selectedUnit.instanceId, null);
          this.opts.audioManager.playSfx('cancel');
          this.itemsStatusMsg = `Returned ${currentItem.name} from ${selectedUnit.nickname} to Bag.`;
          this.opts.onRosterOrLoadoutMutated();
          this.renderManageItems();
        });
        slotCardEl.append(infoDiv, unequipBtn);
      } else {
        infoDiv.innerHTML = `
          <div class="pmd-prep-move-title-line">
            <strong>${escapeHtml(selectedUnit.nickname)}'s Item Slot (0/1): Empty</strong>
          </div>
          <span class="pmd-prep-move-stats">Select any Held Item, Berry, Healing Item, or X-Item below to equip into ${escapeHtml(selectedUnit.nickname)}'s single item slot.</span>
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
        emptyEl.textContent = 'No acquired items in this category yet.';
        itemsListEl.appendChild(emptyEl);
      } else {
        for (const { item, bagQty, holders } of acquiredItems) {
          const row = document.createElement('div');
          row.className = `pmd-prep-item-row${currentItemId === item.id ? ' is-equipped' : ''}`;
          row.dataset.testid = `prep-item-row-${item.id}`;

          const holderSummary =
            holders.length > 0
              ? ` · Equipped: ${holders.map((h) => h.nickname).join(', ')}`
              : '';

          const infoDiv = document.createElement('div');
          infoDiv.className = 'pmd-prep-move-info';
          infoDiv.innerHTML = `
            <div class="pmd-prep-move-title-line">
              <strong>${escapeHtml(item.name)}</strong>
              <span class="pmd-prep-cat-tag">${escapeHtml(formatItemCategoryLabel(item.category))}</span>
              <span class="pmd-prep-stock-tag">Bag: ${bagQty}${escapeHtml(holderSummary)}</span>
            </div>
            <span class="pmd-prep-move-stats">${escapeHtml(item.description)}</span>
          `;

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
                this.itemsStatusMsg = `Unequipped ${item.name} from ${selectedUnit.nickname}.`;
                this.opts.onRosterOrLoadoutMutated();
                this.renderManageItems();
              });
            } else if (bagQty > 0) {
              actionBtn.className = 'pmd-btn pmd-btn-primary pmd-chip-btn';
              actionBtn.textContent = currentItem ? 'Replace' : 'Equip';
              bindPointerTap(actionBtn, () => {
                const prevName = currentItem?.name;
                mgr.equipItemToUnit(selectedUnit.instanceId, item.id);
                this.opts.audioManager.playSfx('select');
                this.itemsStatusMsg = prevName
                  ? `Equipped ${item.name} on ${selectedUnit.nickname} (returned ${prevName} to Bag).`
                  : `Equipped ${item.name} on ${selectedUnit.nickname}.`;
                this.opts.onRosterOrLoadoutMutated();
                this.renderManageItems();
              });
            } else {
              const otherHolder = holders.find((h) => h.instanceId !== selectedUnit.instanceId);
              actionBtn.className = 'pmd-btn pmd-chip-btn';
              actionBtn.textContent = otherHolder ? `Take (${otherHolder.nickname})` : 'Equip';
              actionBtn.disabled = !otherHolder;
              if (otherHolder) {
                bindPointerTap(actionBtn, () => {
                  const prevName = currentItem?.name;
                  mgr.equipItemToUnit(selectedUnit.instanceId, item.id, otherHolder.instanceId);
                  this.opts.audioManager.playSfx('select');
                  this.itemsStatusMsg = prevName
                    ? `Moved ${item.name} from ${otherHolder.nickname} to ${selectedUnit.nickname} (returned ${prevName} to Bag).`
                    : `Moved ${item.name} from ${otherHolder.nickname} to ${selectedUnit.nickname}.`;
                  this.opts.onRosterOrLoadoutMutated();
                  this.renderManageItems();
                });
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

          row.append(infoDiv, actionsWrap);
          itemsListEl.appendChild(row);
        }
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

  private renderConfirmModal(): void {
    const deployed = this.getDeployedUnitsOrdered();
    const cap = this.opts.getDeploymentCap();
    const subEl = this.confirmBackdropEl.querySelector('[data-confirm-sub]');
    const partyEl = this.confirmBackdropEl.querySelector('[data-confirm-party]');

    if (subEl) {
      subEl.textContent = `Are you ready to enter ${this.opts.getMap().name} with ${deployed.length}/${cap} Pokémon?`;
    }
    if (partyEl) {
      partyEl.textContent = deployed
        .map(({ slot, unit }) => {
          const eqItemId = getUnitEquippedItemId(unit);
          const eqItem = eqItemId ? getItemById(eqItemId) : undefined;
          return `${unit.nickname} (${slot.x},${slot.y})${eqItem ? ` [${eqItem.name}]` : ''}`;
        })
        .join(' · ');
    }
  }

  private openRenameModal(): void {
    const save = this.opts.getSaveManager().getSave();
    const unit = save?.roster.find((u) => u.instanceId === this.selectedUnitInstanceId);
    if (!unit) return;
    const sp = getSpeciesById(unit.speciesId);

    this.opts.audioManager.playSfx('select');
    const subEl = this.renameBackdropEl.querySelector('[data-prep-rename-sub]');
    const inputEl = this.renameBackdropEl.querySelector<HTMLInputElement>(
      '[data-testid="prep-rename-input"]'
    );
    if (subEl) {
      subEl.textContent = `${sp?.name ?? unit.speciesId} · Lv. ${unit.level}`;
    }
    if (inputEl) {
      inputEl.value = unit.nickname;
    }
    this.renameOpen = true;
    this.renameBackdropEl.hidden = false;
    this.opts.onSubLayerChanged();
  }

  private commitRename(useDefaultSpeciesName: boolean): void {
    const mgr = this.opts.getSaveManager();
    const save = mgr.getSave();
    const unit = save?.roster.find((u) => u.instanceId === this.selectedUnitInstanceId);
    if (!unit) return;
    const sp = getSpeciesById(unit.speciesId);
    const inputEl = this.renameBackdropEl.querySelector<HTMLInputElement>(
      '[data-testid="prep-rename-input"]'
    );
    const nextName = useDefaultSpeciesName
      ? (sp?.name ?? unit.speciesId)
      : (inputEl?.value ?? unit.nickname);

    const updated = mgr.renamePokemon(unit.instanceId, nextName);
    this.opts.audioManager.playSfx('select');
    this.renameOpen = false;
    this.renameBackdropEl.hidden = true;
    this.unitsStatusMsg = `Updated nickname to ${updated.nickname}.`;
    this.opts.onRosterOrLoadoutMutated();
    this.refreshAll();
    this.opts.onSubLayerChanged();
  }
}
