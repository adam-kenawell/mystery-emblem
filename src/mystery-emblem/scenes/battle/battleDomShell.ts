/**
 * DOM Shell Construction & Element References for `BattleScene`
 */

import { PmdPortraitView } from '../../ui/PmdSpriteCanvas';
import { createBattleForecastDom } from './battleForecastDom';
import { createBattleModalsDom, type BattleModalsDomRefs } from './battleModalsDom';

export interface BattleDomRefs extends BattleModalsDomRefs {
  rootEl: HTMLElement;
  canvasStageEl: HTMLElement;
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
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
  fieldUnitsBtnEl: HTMLButtonElement;
  forecastModalBackdropEl: HTMLElement;
  attackerPortraitView: PmdPortraitView;
  defenderPortraitView: PmdPortraitView;
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
        <div class="pmd-forecast-hp-bar-track pmd-unit-popup-hp-bar">
          <div class="pmd-forecast-hp-bar-fill" data-popup-hp-fill></div>
        </div>
      </div>
    </div>
    <div class="pmd-unit-popup-stats-row">
      <span class="pmd-unit-popup-stat"><em>MGT</em><strong data-testid="unit-popup-might">—</strong></span>
      <span class="pmd-unit-popup-stat"><em>DEF</em><strong data-testid="unit-popup-def">0</strong></span>
      <span class="pmd-unit-popup-stat"><em>SPDEF</em><strong data-testid="unit-popup-spdef"><span data-testid="unit-popup-spd">0</span></strong></span>
      <span class="pmd-unit-popup-stat"><em>SPE</em><strong data-testid="unit-popup-spe">0</strong></span>
    </div>
    <div class="pmd-unit-popup-moves" data-testid="unit-popup-moves"></div>
  `;
  const popupSlot = unitPopupEl.querySelector('[data-popup-portrait-slot]');
  popupSlot?.insertBefore(unitPopupPortraitView.canvas, popupSlot.firstChild);
  bottomLeftHudStackEl.append(unitPopupEl, infoStripEl);

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

  const forecastDom = createBattleForecastDom();
  const modalsDom = createBattleModalsDom();

  // 7th Field Menu option (`Units`) docked between `Objective` and `Settings`
  const fieldUnitsBtnEl = document.createElement('button');
  fieldUnitsBtnEl.type = 'button';
  fieldUnitsBtnEl.className = 'pmd-btn pmd-menu-row';
  fieldUnitsBtnEl.dataset.testid = 'battle-field-units';
  fieldUnitsBtnEl.textContent = 'Units';
  modalsDom.fieldMenuCardEl.insertBefore(fieldUnitsBtnEl, modalsDom.fieldSettingsBtnEl);

  rootEl.append(
    canvasStageEl,
    floatingCalloutLayerEl,
    phaseBannerEl,
    bottomLeftHudStackEl,
    actionMenuEl,
    beginBattleBackdropEl,
    phaseTransitionEl,
    talkChoiceBackdropEl,
    forecastDom.forecastModalBackdropEl,
    modalsDom.levelUpModalBackdropEl,
    modalsDom.systemMenuBackdropEl,
    modalsDom.victoryModalBackdropEl,
    modalsDom.defeatModalBackdropEl
  );

  return {
    rootEl,
    canvasStageEl,
    canvas,
    ctx,
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
    fieldUnitsBtnEl,
    ...forecastDom,
    ...modalsDom,
  };
}
