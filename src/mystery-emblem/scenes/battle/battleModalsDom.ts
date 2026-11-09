/**
 * Field Menu, Level-Up, Victory & Defeat Modal DOM Builders for `BattleScene`
 */

import { PmdPortraitView } from '../../ui/PmdSpriteCanvas';

export interface BattleModalsDomRefs {
  levelUpModalBackdropEl: HTMLElement;
  levelUpPortraitView: PmdPortraitView;
  systemMenuBackdropEl: HTMLElement;
  fieldMenuCardEl: HTMLElement;
  fieldDangerBtnEl: HTMLButtonElement;
  fieldEndPhaseBtnEl: HTMLButtonElement;
  fieldObjectiveBtnEl: HTMLButtonElement;
  fieldSettingsBtnEl: HTMLButtonElement;
  fieldOverworldBtnEl: HTMLButtonElement;
  fieldTitleBtnEl: HTMLButtonElement;
  fieldSubmodalCardEl: HTMLElement;
  victoryModalBackdropEl: HTMLElement;
  defeatModalBackdropEl: HTMLElement;
}

export function createBattleModalsDom(): BattleModalsDomRefs {
  const systemMenuBackdropEl = document.createElement('div');
  systemMenuBackdropEl.className = 'pmd-dungeon-field-backdrop';
  systemMenuBackdropEl.dataset.testid = 'dungeon-system-menu';
  systemMenuBackdropEl.hidden = true;
  systemMenuBackdropEl.innerHTML = `
    <div class="pmd-window pmd-dungeon-field-menu pmd-menu-list" data-testid="dungeon-field-menu" role="menu" aria-label="Dungeon Menu">
      <button type="button" class="pmd-btn pmd-menu-row" data-testid="battle-field-danger">Danger Area: OFF</button>
      <button type="button" class="pmd-btn pmd-btn-primary pmd-menu-row" data-testid="battle-field-end-phase">End Phase</button>
      <button type="button" class="pmd-btn pmd-menu-row" data-testid="battle-field-objective">Objective</button>
      <button type="button" class="pmd-btn pmd-menu-row" data-testid="battle-field-settings">Settings</button>
      <button type="button" class="pmd-btn pmd-menu-row" data-testid="battle-field-overworld">Return to Overworld</button>
      <button type="button" class="pmd-btn pmd-btn-danger pmd-menu-row" data-testid="battle-field-title">Return to Title Screen</button>
    </div>
    <div class="pmd-window pmd-dungeon-submodal" data-field-submodal role="dialog" aria-modal="true" hidden></div>
  `;

  const victoryModalBackdropEl = document.createElement('div');
  victoryModalBackdropEl.className = 'pmd-battle-modal-backdrop';
  victoryModalBackdropEl.dataset.testid = 'battle-victory-modal';
  victoryModalBackdropEl.hidden = true;
  victoryModalBackdropEl.innerHTML = `
    <div class="pmd-window pmd-window--gold pmd-battle-outcome-dialog" role="dialog" aria-modal="true" aria-labelledby="battle-victory-title">
      <span class="pmd-battle-kicker is-victory">STAGE CLEAR</span>
      <h2 id="battle-victory-title" class="pmd-panel-title">VICTORY!</h2>
      <p class="pmd-panel-sub" data-victory-sub>All enemy forces have been routed!</p>
      <p class="pmd-subcard-text" data-victory-summary></p>
      <div class="pmd-battle-outcome-actions">
        <button type="button" class="pmd-btn pmd-btn-primary" data-testid="victory-replay-btn">Play Again</button>
        <button type="button" class="pmd-btn" data-testid="victory-exit-btn">Return to Menu</button>
      </div>
    </div>
  `;

  const defeatModalBackdropEl = document.createElement('div');
  defeatModalBackdropEl.className = 'pmd-battle-modal-backdrop';
  defeatModalBackdropEl.dataset.testid = 'battle-defeat-modal';
  defeatModalBackdropEl.hidden = true;
  defeatModalBackdropEl.innerHTML = `
    <div class="pmd-window pmd-battle-outcome-dialog is-defeat-window" role="dialog" aria-modal="true" aria-labelledby="battle-defeat-title">
      <span class="pmd-battle-kicker is-defeat">DEFEATED</span>
      <h2 id="battle-defeat-title" class="pmd-panel-title is-danger-title">DEFEAT</h2>
      <p class="pmd-panel-sub" data-defeat-sub>Your Dragon Lord fell in battle.</p>
      <p class="pmd-subcard-text" data-defeat-summary>Regroup and challenge the chapter again from Turn 1.</p>
      <div class="pmd-battle-outcome-actions">
        <button type="button" class="pmd-btn pmd-btn-primary" data-testid="defeat-restart-btn">Restart Match</button>
        <button type="button" class="pmd-btn" data-testid="defeat-exit-btn">Return to Menu</button>
      </div>
    </div>
  `;

  const levelUpPortraitView = new PmdPortraitView({
    pixelScale: 1,
    testId: 'levelup-portrait',
  });
  const levelUpModalBackdropEl = document.createElement('div');
  levelUpModalBackdropEl.className = 'pmd-battle-modal-backdrop';
  levelUpModalBackdropEl.dataset.testid = 'battle-levelup-modal';
  levelUpModalBackdropEl.hidden = true;
  levelUpModalBackdropEl.style.zIndex = '94';
  levelUpModalBackdropEl.innerHTML = `
    <div class="pmd-window pmd-window--gold pmd-battle-outcome-dialog" role="dialog" aria-modal="true" aria-label="Level Up" style="width:min(420px, 94vw);">
      <span class="pmd-battle-kicker is-victory">LEVEL UP!</span>
      <div class="pmd-forecast-unit-head" style="justify-content:center; margin:0.35rem 0 0.5rem;">
        <div class="pmd-forecast-portrait-slot" data-levelup-portrait-slot></div>
        <div class="pmd-forecast-unit-id" style="text-align:left;">
          <strong class="pmd-forecast-unit-name" data-testid="levelup-unit-title">—</strong>
          <span class="pmd-forecast-unit-meta" data-testid="levelup-level-line">Lv. 9 → Lv. 10</span>
        </div>
      </div>
      <div class="pmd-prep-stats-grid" data-testid="levelup-stats-grid" style="margin-bottom:0.5rem;"></div>
      <p class="pmd-subcard-text" data-testid="levelup-extra-notes" style="color:#98f8b8; margin:0.25rem 0 0.5rem;" hidden></p>
      <div class="pmd-battle-outcome-actions">
        <button type="button" class="pmd-btn pmd-btn-primary" data-testid="levelup-continue-btn" style="min-height:44px;">Continue</button>
      </div>
    </div>
  `;
  levelUpModalBackdropEl
    .querySelector('[data-levelup-portrait-slot]')
    ?.appendChild(levelUpPortraitView.canvas);

  return {
    levelUpModalBackdropEl,
    levelUpPortraitView,
    systemMenuBackdropEl,
    fieldMenuCardEl: systemMenuBackdropEl.querySelector('[data-testid="dungeon-field-menu"]')!,
    fieldDangerBtnEl: systemMenuBackdropEl.querySelector('[data-testid="battle-field-danger"]')!,
    fieldEndPhaseBtnEl: systemMenuBackdropEl.querySelector(
      '[data-testid="battle-field-end-phase"]'
    )!,
    fieldObjectiveBtnEl: systemMenuBackdropEl.querySelector(
      '[data-testid="battle-field-objective"]'
    )!,
    fieldSettingsBtnEl: systemMenuBackdropEl.querySelector(
      '[data-testid="battle-field-settings"]'
    )!,
    fieldOverworldBtnEl: systemMenuBackdropEl.querySelector(
      '[data-testid="battle-field-overworld"]'
    )!,
    fieldTitleBtnEl: systemMenuBackdropEl.querySelector('[data-testid="battle-field-title"]')!,
    fieldSubmodalCardEl: systemMenuBackdropEl.querySelector('[data-field-submodal]')!,
    victoryModalBackdropEl,
    defeatModalBackdropEl,
  };
}
