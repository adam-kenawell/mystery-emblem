/**
 * DOM Shell & Modal Dialog Builders for `BattleScene` (`battleDomShell.ts`)
 */

import { PmdPortraitView } from '../../ui/PmdSpriteCanvas';
import { createPmdZoomResetButton } from '../../ui/PmdWindow';
import { createBattleForecastDom } from './battleForecastView';

export interface BattleDomRefs {
  rootEl: HTMLElement;
  canvasStageEl: HTMLElement;
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  zoomResetBtnEl: HTMLButtonElement;
  tintScratchCanvas: HTMLCanvasElement;
  tintScratchCtx: CanvasRenderingContext2D;
  floatingCalloutLayerEl: HTMLElement;
  phaseBannerEl: HTMLElement;
  beginBattleBackdropEl: HTMLElement;
  beginBattleObjectiveEl: HTMLElement;
  phaseTransitionEl: HTMLElement;
  phaseTransitionTitleEl: HTMLElement;
  bottomLeftHudStackEl: HTMLElement;
  infoStripEl: HTMLElement;
  battleLogDockEl: HTMLElement;
  battleLogBoxEl: HTMLElement;
  battleLogEntriesEl: HTMLElement;
  battleLogToggleBtnEl: HTMLButtonElement;
  unitPopupEl: HTMLElement;
  unitPopupPortraitView: PmdPortraitView;
  actionMenuEl: HTMLElement;
  cmdTalkBtnEl: HTMLButtonElement;
  cmdAttackBtnEl: HTMLButtonElement;
  cmdHealBtnEl: HTMLButtonElement;
  cmdDanceBtnEl: HTMLButtonElement;
  cmdItemBtnEl: HTMLButtonElement;
  cmdWaitBtnEl: HTMLButtonElement;
  cmdCancelBtnEl: HTMLButtonElement;
  talkChoiceBackdropEl: HTMLElement;
  forecastModalBackdropEl: HTMLElement;
  levelUpModalBackdropEl: HTMLElement;
  levelUpPortraitView: PmdPortraitView;
  moveLearnedModalBackdropEl: HTMLElement;
  moveLearnedPortraitView: PmdPortraitView;
  systemMenuBackdropEl: HTMLElement;
  fieldMenuCardEl: HTMLElement;
  fieldEndPhaseBtnEl: HTMLButtonElement;
  fieldInfoBtnEl: HTMLButtonElement;
  fieldSettingsBtnEl: HTMLButtonElement;
  fieldBookmarkBtnEl: HTMLButtonElement;
  fieldSubmodalCardEl: HTMLElement;
  victoryModalBackdropEl: HTMLElement;
  defeatModalBackdropEl: HTMLElement;
}

function createBattleModalsDom() {
  const systemMenuBackdropEl = document.createElement('div');
  systemMenuBackdropEl.className = 'pmd-dungeon-field-backdrop';
  systemMenuBackdropEl.dataset.testid = 'dungeon-system-menu';
  systemMenuBackdropEl.hidden = true;
  systemMenuBackdropEl.innerHTML = `
    <div class="pmd-window pmd-dungeon-field-menu pmd-menu-list" data-testid="dungeon-field-menu" role="menu" aria-label="Dungeon Menu">
      <button type="button" class="pmd-btn pmd-btn-primary pmd-menu-row" data-testid="battle-field-end-phase">End Phase</button>
      <button type="button" class="pmd-btn pmd-menu-row" data-testid="battle-field-info">Battle Info</button>
      <button type="button" class="pmd-btn pmd-menu-row" data-testid="battle-field-settings">Settings</button>
      <button type="button" class="pmd-btn pmd-menu-row" data-testid="battle-field-bookmark">Bookmark</button>
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
      <h2 id="battle-victory-title" class="pmd-panel-title">Victory!</h2>
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
      <h2 id="battle-defeat-title" class="pmd-panel-title is-danger-title">Defeat</h2>
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
          <strong class="pmd-forecast-unit-name" data-testid="levelup-unit-title">-</strong>
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

  const moveLearnedPortraitView = new PmdPortraitView({
    pixelScale: 1,
    testId: 'move-learned-portrait',
  });
  const moveLearnedModalBackdropEl = document.createElement('div');
  moveLearnedModalBackdropEl.className = 'pmd-battle-modal-backdrop';
  moveLearnedModalBackdropEl.dataset.testid = 'battle-move-learned-modal';
  moveLearnedModalBackdropEl.hidden = true;
  moveLearnedModalBackdropEl.style.zIndex = '94';
  moveLearnedModalBackdropEl.innerHTML = `
    <div class="pmd-window pmd-window--gold pmd-battle-outcome-dialog pmd-move-learned-dialog" role="dialog" aria-modal="true" aria-label="New Move Learned" style="width:min(440px, 94vw);">
      <span class="pmd-battle-kicker is-victory">NEW MOVE LEARNED!</span>
      <div class="pmd-forecast-unit-head" style="justify-content:center; margin:0.35rem 0 0.25rem;">
        <div class="pmd-forecast-portrait-slot" data-move-learned-portrait-slot></div>
        <div class="pmd-forecast-unit-id" style="text-align:left;">
          <strong class="pmd-forecast-unit-name" data-testid="move-learned-headline">-</strong>
          <span class="pmd-forecast-unit-meta" data-testid="move-learned-subline">-</span>
        </div>
      </div>
      <div class="pmd-move-learned-separator" role="separator"></div>
      <div class="pmd-move-learned-card" data-testid="move-learned-card">
        <div class="pmd-prep-move-title-line pmd-move-learned-title-row">
          <span class="pmd-move-learned-name-line">
            <span class="pmd-move-learned-field-lbl">Move:</span>
            <strong data-testid="move-learned-name" style="color:#58f858;">-</strong>
          </span>
          <span class="pmd-prep-cat-tag" data-testid="move-learned-type-cat">-</span>
        </div>
        <div class="pmd-prep-stats-grid pmd-move-learned-stats-grid" data-testid="move-learned-stats-grid"></div>
        <div class="pmd-move-learned-desc-box">
          <span class="pmd-move-learned-field-lbl">Description:</span>
          <p class="pmd-subcard-text" data-testid="move-learned-description" style="margin:0; color:#e8f0f8;"></p>
        </div>
      </div>
      <p class="pmd-subcard-text" data-testid="move-learned-equip-note" style="color:#ffd878; margin:0.1rem 0 0.35rem;">
        Equip this move after the battle ends in the Units menu.
      </p>
      <div class="pmd-battle-outcome-actions">
        <button type="button" class="pmd-btn pmd-btn-primary" data-testid="move-learned-continue-btn" style="min-height:44px;">Continue</button>
      </div>
    </div>
  `;
  moveLearnedModalBackdropEl
    .querySelector('[data-move-learned-portrait-slot]')
    ?.appendChild(moveLearnedPortraitView.canvas);

  return {
    levelUpModalBackdropEl,
    levelUpPortraitView,
    moveLearnedModalBackdropEl,
    moveLearnedPortraitView,
    systemMenuBackdropEl,
    fieldMenuCardEl: systemMenuBackdropEl.querySelector<HTMLElement>(
      '[data-testid="dungeon-field-menu"]'
    )!,
    fieldEndPhaseBtnEl: systemMenuBackdropEl.querySelector<HTMLButtonElement>(
      '[data-testid="battle-field-end-phase"]'
    )!,
    fieldInfoBtnEl: systemMenuBackdropEl.querySelector<HTMLButtonElement>(
      '[data-testid="battle-field-info"]'
    )!,
    fieldSettingsBtnEl: systemMenuBackdropEl.querySelector<HTMLButtonElement>(
      '[data-testid="battle-field-settings"]'
    )!,
    fieldBookmarkBtnEl: systemMenuBackdropEl.querySelector<HTMLButtonElement>(
      '[data-testid="battle-field-bookmark"]'
    )!,
    fieldSubmodalCardEl: systemMenuBackdropEl.querySelector<HTMLElement>('[data-field-submodal]')!,
    victoryModalBackdropEl,
    defeatModalBackdropEl,
  };
}

export function createBattleDomShell(): BattleDomRefs {
  const tintScratchCanvas = document.createElement('canvas');
  tintScratchCanvas.width = 96;
  tintScratchCanvas.height = 96;
  const tintScratchCtx = tintScratchCanvas.getContext('2d')!;
  tintScratchCtx.imageSmoothingEnabled = false;

  const rootEl = document.createElement('section');
  rootEl.id = 'pmd-battle-scene';
  rootEl.className = 'pmd-battle-scene';
  rootEl.hidden = true;
  rootEl.dataset.testid = 'battle-scene';

  const canvasStageEl = document.createElement('div');
  canvasStageEl.className = 'pmd-battle-canvas-stage';
  canvasStageEl.dataset.noLongpress = 'true';

  const canvas = document.createElement('canvas');
  canvas.className = 'pmd-battle-canvas pmd-pixelated';
  canvas.dataset.testid = 'battle-canvas';
  canvas.style.imageRendering = 'pixelated';
  canvas.style.flexShrink = '0';
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  canvasStageEl.appendChild(canvas);

  const floatingCalloutLayerEl = document.createElement('div');
  floatingCalloutLayerEl.className = 'pmd-battle-floating-callouts';
  floatingCalloutLayerEl.dataset.testid = 'dungeon-floating-callouts';
  floatingCalloutLayerEl.setAttribute('aria-hidden', 'true');

  const phaseBannerEl = document.createElement('div');
  phaseBannerEl.className = 'pmd-window pmd-window--translucent pmd-battle-phase-banner';
  phaseBannerEl.dataset.testid = 'dungeon-phase-banner';
  phaseBannerEl.hidden = true;

  const beginBattleBackdropEl = document.createElement('div');
  beginBattleBackdropEl.className = 'pmd-begin-battle-backdrop';
  beginBattleBackdropEl.dataset.testid = 'dungeon-begin-battle-backdrop';
  beginBattleBackdropEl.hidden = true;
  beginBattleBackdropEl.innerHTML = `
    <div class="pmd-window pmd-window--gold pmd-begin-battle-card" data-testid="dungeon-begin-battle-card" role="status" aria-live="polite">
      <h2 class="pmd-begin-battle-title" data-testid="dungeon-begin-battle-title">Begin Battle!</h2>
      <div class="pmd-begin-battle-obj-box">
        <span class="pmd-begin-battle-obj-kicker">Victory Condition</span>
        <strong class="pmd-begin-battle-obj-text" data-testid="dungeon-begin-battle-objective">Rout All Enemies</strong>
        <span class="pmd-begin-battle-obj-kicker" style="margin-top:0.25rem; color:var(--pmd-text-danger);">Defeat Condition</span>
        <span class="pmd-begin-battle-obj-text" style="font-size:12px; color:#ffc8d0;" data-testid="dungeon-begin-battle-defeat"></span>
      </div>
    </div>
  `;
  const beginBattleObjectiveEl = beginBattleBackdropEl.querySelector<HTMLElement>(
    '[data-testid="dungeon-begin-battle-objective"]'
  )!;

  const phaseTransitionEl = document.createElement('div');
  phaseTransitionEl.className = 'pmd-phase-cine-overlay is-player';
  phaseTransitionEl.dataset.testid = 'dungeon-phase-transition';
  phaseTransitionEl.hidden = true;
  phaseTransitionEl.innerHTML = `
    <div class="pmd-phase-cine-veil pmd-phase-cine-veil--top"></div>
    <div class="pmd-phase-cine-band">
      <div class="pmd-phase-cine-mover">
        <span class="pmd-phase-cine-title" data-testid="dungeon-phase-transition-title">PLAYER PHASE</span>
      </div>
    </div>
    <div class="pmd-phase-cine-veil pmd-phase-cine-veil--bottom"></div>
  `;
  const phaseTransitionTitleEl = phaseTransitionEl.querySelector<HTMLElement>(
    '[data-testid="dungeon-phase-transition-title"]'
  )!;

  const bottomLeftHudStackEl = document.createElement('div');
  bottomLeftHudStackEl.className = 'pmd-dungeon-hud-bottom-left';
  bottomLeftHudStackEl.dataset.testid = 'dungeon-bottom-left-hud';

  const infoStripEl = document.createElement('div');
  infoStripEl.className = 'pmd-window pmd-dungeon-tile-box';
  infoStripEl.dataset.testid = 'dungeon-tile-display';

  const unitPopupPortraitView = new PmdPortraitView({
    pixelScale: 1,
    testId: 'unit-popup-portrait',
  });
  const unitPopupEl = document.createElement('div');
  unitPopupEl.className = 'pmd-window pmd-unit-hover-popup is-player';
  unitPopupEl.dataset.testid = 'dungeon-unit-popup';
  unitPopupEl.hidden = true;
  unitPopupEl.innerHTML = `
    <div class="pmd-unit-popup-header">
      <div class="pmd-unit-popup-header-main">
        <div class="pmd-unit-popup-title-line">
          <strong class="pmd-unit-popup-name" data-testid="unit-popup-name"></strong>
          <div class="pmd-unit-popup-item-slot" data-testid="unit-popup-item"></div>
        </div>
        <div class="pmd-unit-popup-subline">
          <div class="pmd-unit-popup-sub-left">
            <span class="pmd-unit-popup-types" data-testid="unit-popup-types"></span>
            <span class="pmd-unit-popup-allegiance" data-testid="unit-popup-allegiance"></span>
          </div>
          <span class="pmd-unit-popup-level-exp" data-testid="unit-popup-level-exp">
            <span data-popup-level>Lv 1</span>
            <span data-popup-exp>EXP --</span>
          </span>
        </div>
      </div>
    </div>
    <div class="pmd-unit-popup-top">
      <div class="pmd-forecast-portrait-slot pmd-unit-popup-portrait-slot" data-popup-portrait-slot>
        <span class="pmd-unit-popup-role-pip" data-popup-role-pip hidden></span>
      </div>
      <div class="pmd-unit-popup-vitals">
        <div class="pmd-unit-popup-hp-row">
          <span class="pmd-unit-popup-lbl">HP</span>
          <strong data-testid="unit-popup-hp">20/20</strong>
          <span class="pmd-unit-popup-status" data-popup-status hidden></span>
        </div>
        <div class="pmd-forecast-hp-bar-track pmd-unit-popup-hp-bar" data-testid="unit-popup-hp-bar">
          <div class="pmd-forecast-hp-bar-fill" data-popup-hp-fill></div>
        </div>
        <div class="pmd-unit-popup-exp-bar-track" data-testid="unit-popup-exp-bar" data-popup-exp-track>
          <div class="pmd-unit-popup-exp-bar-fill" data-testid="unit-popup-exp-fill" data-popup-exp-fill></div>
        </div>
      </div>
    </div>
    <div class="pmd-unit-popup-stats-row">
      <span class="pmd-unit-popup-stat"><em>MGT</em><strong data-testid="unit-popup-might">-</strong></span>
      <span class="pmd-unit-popup-stat"><em>PRT</em><strong data-testid="unit-popup-prt">0/0</strong></span>
      <span class="pmd-unit-popup-stat"><em>SPE</em><strong data-testid="unit-popup-spe">0</strong></span>
    </div>
    <div class="pmd-unit-popup-supports" data-testid="unit-popup-supports" hidden></div>
    <div class="pmd-unit-popup-moves" data-testid="unit-popup-moves"></div>
  `;
  const popupSlot = unitPopupEl.querySelector('[data-popup-portrait-slot]');
  popupSlot?.insertBefore(unitPopupPortraitView.canvas, popupSlot.firstChild);
  const bottomRowEl = document.createElement('div');
  bottomRowEl.className = 'pmd-dungeon-bottom-row';

  const battleLogDockEl = document.createElement('div');
  battleLogDockEl.className = 'pmd-battle-log-dock';
  battleLogDockEl.dataset.testid = 'dungeon-battle-log-dock';
  battleLogDockEl.hidden = true;
  battleLogDockEl.innerHTML = `
    <div class="pmd-battle-log-viewport">
      <div class="pmd-window pmd-battle-log-box" data-testid="dungeon-battle-log" role="log" aria-live="polite" aria-label="Battle Log">
        <div class="pmd-battle-log-entries" data-testid="dungeon-battle-log-entries"></div>
      </div>
    </div>
    <button type="button" class="pmd-window pmd-window--compact pmd-battle-log-toggle" data-testid="dungeon-battle-log-toggle" aria-expanded="true" aria-label="Hide Battle Log">
      <svg class="pmd-battle-log-arrow" viewBox="0 0 6 7" width="12" height="14" aria-hidden="true" shape-rendering="crispEdges"><path fill="#000000" d="M6,0H4V1H3V2H2V3H1V4H2V5H3V6H4V7H6Z"/><path fill="currentColor" d="M5,1H4V2H3V3H2V4H3V5H4V6H5Z"/></svg>
    </button>
  `;
  const battleLogBoxEl = battleLogDockEl.querySelector<HTMLElement>(
    '[data-testid="dungeon-battle-log"]'
  )!;
  const battleLogEntriesEl = battleLogDockEl.querySelector<HTMLElement>(
    '[data-testid="dungeon-battle-log-entries"]'
  )!;
  const battleLogToggleBtnEl = battleLogDockEl.querySelector<HTMLButtonElement>(
    '[data-testid="dungeon-battle-log-toggle"]'
  )!;

  bottomRowEl.append(infoStripEl, battleLogDockEl);
  bottomLeftHudStackEl.append(unitPopupEl, bottomRowEl);

  const actionMenuEl = document.createElement('div');
  actionMenuEl.className = 'pmd-window pmd-window--translucent pmd-battle-action-menu pmd-menu-list';
  actionMenuEl.dataset.testid = 'dungeon-cmd-menu';
  actionMenuEl.hidden = true;
  actionMenuEl.innerHTML = `
    <button type="button" class="pmd-btn pmd-btn-primary pmd-menu-row pmd-battle-cmd-btn is-talk" data-testid="dungeon-cmd-talk" hidden>Talk</button>
    <button type="button" class="pmd-btn pmd-btn-primary pmd-menu-row pmd-battle-cmd-btn" data-testid="dungeon-cmd-attack">Attack</button>
    <button type="button" class="pmd-btn pmd-btn-primary pmd-menu-row pmd-battle-cmd-btn" data-testid="dungeon-cmd-heal" hidden>Heal</button>
    <button type="button" class="pmd-btn pmd-btn-primary pmd-menu-row pmd-battle-cmd-btn is-dance" data-testid="dungeon-cmd-dance" hidden>Dance</button>
    <button type="button" class="pmd-btn pmd-btn-primary pmd-menu-row pmd-battle-cmd-btn" data-testid="dungeon-cmd-item" hidden>Item</button>
    <button type="button" class="pmd-btn pmd-menu-row pmd-battle-cmd-btn" data-testid="dungeon-cmd-wait">Wait</button>
    <button type="button" class="pmd-btn pmd-menu-row pmd-battle-cmd-btn" data-testid="dungeon-cmd-cancel">Cancel</button>
  `;

  const talkChoiceBackdropEl = document.createElement('div');
  talkChoiceBackdropEl.className = 'pmd-talk-choice-backdrop';
  talkChoiceBackdropEl.dataset.testid = 'battle-talk-choice-backdrop';
  talkChoiceBackdropEl.hidden = true;

  const zoomResetBtnEl = createPmdZoomResetButton({ testId: 'battle-zoom-reset-btn' });

  const forecastDom = createBattleForecastDom();
  const modalsDom = createBattleModalsDom();

  rootEl.append(
    canvasStageEl,
    floatingCalloutLayerEl,
    zoomResetBtnEl,
    phaseBannerEl,
    bottomLeftHudStackEl,
    actionMenuEl,
    beginBattleBackdropEl,
    phaseTransitionEl,
    talkChoiceBackdropEl,
    forecastDom.forecastModalBackdropEl,
    modalsDom.levelUpModalBackdropEl,
    modalsDom.moveLearnedModalBackdropEl,
    modalsDom.systemMenuBackdropEl,
    modalsDom.victoryModalBackdropEl,
    modalsDom.defeatModalBackdropEl
  );

  return {
    rootEl,
    canvasStageEl,
    canvas,
    ctx,
    zoomResetBtnEl,
    tintScratchCanvas,
    tintScratchCtx,
    floatingCalloutLayerEl,
    phaseBannerEl,
    beginBattleBackdropEl,
    beginBattleObjectiveEl,
    phaseTransitionEl,
    phaseTransitionTitleEl,
    bottomLeftHudStackEl,
    infoStripEl,
    battleLogDockEl,
    battleLogBoxEl,
    battleLogEntriesEl,
    battleLogToggleBtnEl,
    unitPopupEl,
    unitPopupPortraitView,
    actionMenuEl,
    cmdTalkBtnEl: actionMenuEl.querySelector('[data-testid="dungeon-cmd-talk"]')!,
    cmdAttackBtnEl: actionMenuEl.querySelector('[data-testid="dungeon-cmd-attack"]')!,
    cmdHealBtnEl: actionMenuEl.querySelector('[data-testid="dungeon-cmd-heal"]')!,
    cmdDanceBtnEl: actionMenuEl.querySelector('[data-testid="dungeon-cmd-dance"]')!,
    cmdItemBtnEl: actionMenuEl.querySelector('[data-testid="dungeon-cmd-item"]')!,
    cmdWaitBtnEl: actionMenuEl.querySelector('[data-testid="dungeon-cmd-wait"]')!,
    cmdCancelBtnEl: actionMenuEl.querySelector('[data-testid="dungeon-cmd-cancel"]')!,
    talkChoiceBackdropEl,
    ...forecastDom,
    ...modalsDom,
  };
}
