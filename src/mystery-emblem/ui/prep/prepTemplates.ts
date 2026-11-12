/**
 * Mystery Emblem — Dungeon Prep DOM Templates & Hub/Map HUD Sync (`prepTemplates.ts`)
 */

import type { DungeonMapDefinition, OwnedPokemonInstance, PrepDeploymentSlot } from '../../types/schemas';
import type { PmdPortraitView } from '../PmdSpriteCanvas';

export interface PrepDomElements {
  rootEl: HTMLElement;
  hubBackdropEl: HTMLElement;
  unitsBackdropEl: HTMLElement;
  itemsBackdropEl: HTMLElement;
  mapHudEl: HTMLElement;
  mapReturnBtnEl: HTMLButtonElement;
  mapHintPillEl: HTMLElement;
  mapDangerBtnEl: HTMLButtonElement;
}

export function renderPrepHubSummary(params: {
  hubBackdropEl: HTMLElement;
  map: DungeonMapDefinition;
  deployedCount: number;
  cap: number;
  enemyCount: number;
  objectiveLabel?: string;
}): void {
  const mapNameEl = params.hubBackdropEl.querySelector('[data-prep-map-name]');
  const objEl = params.hubBackdropEl.querySelector('[data-prep-objectives]');
  if (mapNameEl) mapNameEl.textContent = params.map.name;
  if (objEl) {
    const victoryLabel = params.objectiveLabel ?? `Rout All Enemies (${params.enemyCount})`;
    objEl.textContent = `${victoryLabel} · ${params.deployedCount}/${params.cap} Deployed`;
  }
}

export function syncPrepMapHudElements(params: {
  dom: PrepDomElements;
  dangerOn: boolean;
  swapIdx: number | null;
  slots: ReadonlyArray<PrepDeploymentSlot>;
  roster: ReadonlyArray<OwnedPokemonInstance>;
}): void {
  const { dom, dangerOn, swapIdx, slots, roster } = params;
  dom.mapDangerBtnEl.textContent = dangerOn ? 'Danger: ON' : 'Danger: OFF';
  dom.mapDangerBtnEl.classList.toggle('is-active', dangerOn);
  if (swapIdx !== null) {
    const slot = slots.find((s) => s.slotIndex === swapIdx);
    const unit = roster.find((u) => u.instanceId === slot?.unitInstanceId);
    dom.mapHintPillEl.textContent = unit ? `Swap ${unit.nickname}: tap blue tile` : 'Tap blue tile';
  } else {
    dom.mapHintPillEl.textContent = 'Tap 2 blue tiles to swap';
  }
}

export function createPrepDomElements(
  parentEl: HTMLElement,
  unitPortraitView: PmdPortraitView
): PrepDomElements {
  const rootEl = document.createElement('div');
  rootEl.className = 'pmd-prep-layer';
  rootEl.dataset.testid = 'dungeon-prep-layer';
  rootEl.hidden = true;

  const hubBackdropEl = document.createElement('div');
  hubBackdropEl.className = 'pmd-battle-modal-backdrop pmd-prep-backdrop';
  hubBackdropEl.dataset.testid = 'dungeon-prep-hub';
  hubBackdropEl.innerHTML = `
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
        <button type="button" class="pmd-btn pmd-menu-row pmd-prep-option-btn" data-testid="prep-btn-save-progress">
          <span class="pmd-prep-opt-title">Save Progress</span>
        </button>
        <button type="button" class="pmd-btn pmd-btn-primary pmd-menu-row pmd-prep-option-btn is-enter-cta" data-testid="prep-btn-enter-dungeon">
          <span class="pmd-prep-opt-title">Fight!</span>
        </button>
      </div>
    </div>
  `;

  const unitsBackdropEl = document.createElement('div');
  unitsBackdropEl.className = 'pmd-battle-modal-backdrop pmd-prep-backdrop';
  unitsBackdropEl.dataset.testid = 'prep-manage-units-modal';
  unitsBackdropEl.hidden = true;
  unitsBackdropEl.innerHTML = `
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
  unitsBackdropEl.querySelector('[data-prep-portrait-slot]')?.appendChild(unitPortraitView.canvas);

  const itemsBackdropEl = document.createElement('div');
  itemsBackdropEl.className = 'pmd-battle-modal-backdrop pmd-prep-backdrop';
  itemsBackdropEl.dataset.testid = 'prep-manage-items-modal';
  itemsBackdropEl.hidden = true;
  itemsBackdropEl.innerHTML = `
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

  const mapHudEl = document.createElement('div');
  mapHudEl.className = 'pmd-battle-hud-top pmd-prep-map-hud';
  mapHudEl.dataset.testid = 'prep-map-hud';
  mapHudEl.hidden = true;

  const mapReturnBtnEl = document.createElement('button');
  mapReturnBtnEl.type = 'button';
  mapReturnBtnEl.className = 'pmd-btn pmd-btn-primary pmd-battle-hud-btn';
  mapReturnBtnEl.dataset.testid = 'prep-return-btn';
  mapReturnBtnEl.textContent = 'Prep';

  const mapHintPillEl = document.createElement('span');
  mapHintPillEl.className = 'pmd-window pmd-window--compact pmd-window--translucent pmd-battle-pill pmd-prep-map-pill';
  mapHintPillEl.dataset.testid = 'prep-map-status-pill';
  mapHintPillEl.textContent = 'Tap 2 blue tiles to swap';

  const mapDangerBtnEl = document.createElement('button');
  mapDangerBtnEl.type = 'button';
  mapDangerBtnEl.className = 'pmd-btn pmd-battle-hud-btn';
  mapDangerBtnEl.dataset.testid = 'prep-map-danger-btn';
  mapDangerBtnEl.textContent = 'Danger: OFF';

  mapHudEl.append(mapReturnBtnEl, mapHintPillEl, mapDangerBtnEl);
  rootEl.append(hubBackdropEl, unitsBackdropEl, itemsBackdropEl, mapHudEl);
  parentEl.appendChild(rootEl);

  return {
    rootEl, hubBackdropEl, unitsBackdropEl, itemsBackdropEl, mapHudEl,
    mapReturnBtnEl, mapHintPillEl, mapDangerBtnEl,
  };
}
