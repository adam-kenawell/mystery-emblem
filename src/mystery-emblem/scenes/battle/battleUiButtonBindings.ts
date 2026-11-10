/**
 * Unified Pointer Button Bindings for Command Menu, Forecast, Field Menu & Outcome Modals
 */

import { bindPointerTap } from '../../ui/pointerControls';
import { handleBattleMenuOrBack } from './battleBackAndCheats';
import { dismissBeginBattleCard, isPhaseTransitionPlaying } from './battleBannersAndTransitions';
import {
  confirmUnitWait,
  openForecastFromCommandMenu,
  openHealForecastFromCommandMenu,
  useEquippedBattleConsumable,
} from './battleCommandExecution';
import { executeDanceFromCommandMenu } from './battleDanceController';
import { toggleGlobalDangerArea } from './battleDangerAndViewportState';
import { executeTalkFromCommandMenu } from './battleEventRunner';
import {
  closeSystemMenu,
  setSystemMenuSubView,
} from './battleFieldMenuController';
import {
  cancelCombatForecast,
  confirmForecastAction,
} from './battleHealForecastAndConfirm';
import { dismissLevelUpModal } from './battleLevelUpModal';
import {
  closeBattleScene,
  restartBattleMatch,
} from './battleLifecycleController';
import { requestManualEndPhase } from './battlePhaseAndAiRunner';
import { cancelUncommittedMove } from './battleSelectionAndMenu';
import { getExpectedTutorialAction } from './battleTutorialIntegration';
import type { BattleControllerContext } from './battleTypesAndState';

export function bindBattleUiButtons(ctx: BattleControllerContext): void {
  const { state, dom, audioManager, tutorialOverlay, abortSignal: signal } = ctx;

  bindPointerTap(
    dom.beginBattleBackdropEl,
    () => {
      if (!dom.beginBattleBackdropEl.hidden) {
        audioManager.playSfx('select');
        dismissBeginBattleCard(state, dom);
      }
    },
    { signal }
  );

  bindPointerTap(
    dom.cmdTalkBtnEl,
    () => {
      if (getExpectedTutorialAction(tutorialOverlay)) {
        tutorialOverlay?.nudgeActiveStep();
        return;
      }
      state.forecastReturnMode = 'action_menu';
      void executeTalkFromCommandMenu(ctx);
    },
    { signal }
  );
  bindPointerTap(
    dom.cmdAttackBtnEl,
    () => {
      const expected = getExpectedTutorialAction(tutorialOverlay);
      if (expected && expected !== 'battle_open_attack_forecast') {
        tutorialOverlay?.nudgeActiveStep();
        return;
      }
      openForecastFromCommandMenu(ctx);
    },
    { signal }
  );
  bindPointerTap(
    dom.cmdHealBtnEl,
    () => {
      if (getExpectedTutorialAction(tutorialOverlay)) {
        tutorialOverlay?.nudgeActiveStep();
        return;
      }
      openHealForecastFromCommandMenu(ctx);
    },
    { signal }
  );
  bindPointerTap(
    dom.cmdDanceBtnEl,
    () => {
      if (getExpectedTutorialAction(tutorialOverlay)) {
        tutorialOverlay?.nudgeActiveStep();
        return;
      }
      void executeDanceFromCommandMenu(ctx);
    },
    { signal }
  );
  bindPointerTap(
    dom.cmdItemBtnEl,
    () => {
      if (getExpectedTutorialAction(tutorialOverlay)) {
        tutorialOverlay?.nudgeActiveStep();
        return;
      }
      void useEquippedBattleConsumable(ctx);
    },
    { signal }
  );
  bindPointerTap(
    dom.cmdWaitBtnEl,
    () => {
      const expected = getExpectedTutorialAction(tutorialOverlay);
      if (expected && expected !== 'battle_confirm_wait') {
        tutorialOverlay?.nudgeActiveStep();
        return;
      }
      void confirmUnitWait(ctx);
    },
    { signal }
  );
  bindPointerTap(
    dom.cmdCancelBtnEl,
    () => {
      if (getExpectedTutorialAction(tutorialOverlay)) {
        tutorialOverlay?.nudgeActiveStep();
        return;
      }
      cancelUncommittedMove(ctx);
    },
    { signal }
  );

  bindPointerTap(
    dom.forecastModalBackdropEl.querySelector<HTMLElement>('[data-testid="forecast-attack-btn"]'),
    () => void confirmForecastAction(ctx),
    { signal }
  );
  bindPointerTap(
    dom.forecastModalBackdropEl.querySelector<HTMLElement>('[data-testid="forecast-cancel-btn"]'),
    () => {
      if (getExpectedTutorialAction(tutorialOverlay) === 'battle_confirm_attack') {
        tutorialOverlay?.nudgeActiveStep();
        return;
      }
      cancelCombatForecast(ctx);
    },
    { signal }
  );

  dom.systemMenuBackdropEl.addEventListener(
    'pointerdown',
    (e: PointerEvent) => {
      if (e.target !== dom.systemMenuBackdropEl) return;
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      if (getExpectedTutorialAction(tutorialOverlay) === 'battle_toggle_danger_area') {
        tutorialOverlay?.nudgeActiveStep();
        return;
      }
      audioManager.playSfx('cancel');
      if (state.systemMenuSubView !== 'root') {
        setSystemMenuSubView(ctx, 'root');
      } else {
        closeSystemMenu(ctx);
      }
    },
    { signal }
  );
  dom.systemMenuBackdropEl.addEventListener(
    'contextmenu',
    (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (!isPhaseTransitionPlaying(state)) handleBattleMenuOrBack(ctx);
    },
    { signal }
  );

  bindPointerTap(
    dom.fieldDangerBtnEl,
    () => {
      const expected = getExpectedTutorialAction(tutorialOverlay);
      if (expected && expected !== 'battle_toggle_danger_area') {
        tutorialOverlay?.nudgeActiveStep();
        return;
      }
      toggleGlobalDangerArea(ctx);
      closeSystemMenu(ctx);
      tutorialOverlay?.notifyActionCompleted('battle_toggle_danger_area');
      ctx.renderNow();
    },
    { signal }
  );
  bindPointerTap(
    dom.fieldEndPhaseBtnEl,
    () => {
      if (getExpectedTutorialAction(tutorialOverlay)) {
        tutorialOverlay?.nudgeActiveStep();
        return;
      }
      closeSystemMenu(ctx);
      void requestManualEndPhase(ctx);
    },
    { signal }
  );
  const bindFieldSubViewBtn = (btn: HTMLElement, view: 'objective' | 'units' | 'settings' | 'confirm_overworld' | 'confirm_title') => {
    bindPointerTap(
      btn,
      () => {
        if (getExpectedTutorialAction(tutorialOverlay)) {
          tutorialOverlay?.nudgeActiveStep();
          return;
        }
        audioManager.playSfx('select');
        setSystemMenuSubView(ctx, view);
      },
      { signal }
    );
  };
  bindFieldSubViewBtn(dom.fieldObjectiveBtnEl, 'objective');
  bindFieldSubViewBtn(dom.fieldUnitsBtnEl, 'units');
  bindFieldSubViewBtn(dom.fieldSettingsBtnEl, 'settings');
  bindFieldSubViewBtn(dom.fieldOverworldBtnEl, 'confirm_overworld');
  bindFieldSubViewBtn(dom.fieldTitleBtnEl, 'confirm_title');

  bindPointerTap(
    dom.victoryModalBackdropEl.querySelector<HTMLElement>('[data-testid="victory-replay-btn"]'),
    () => void restartBattleMatch(ctx),
    { signal }
  );
  bindPointerTap(
    dom.victoryModalBackdropEl.querySelector<HTMLElement>('[data-testid="victory-exit-btn"]'),
    () => {
      audioManager.playSfx('select');
      closeBattleScene(ctx);
    },
    { signal }
  );
  bindPointerTap(
    dom.defeatModalBackdropEl.querySelector<HTMLElement>('[data-testid="defeat-restart-btn"]'),
    () => void restartBattleMatch(ctx),
    { signal }
  );
  bindPointerTap(
    dom.defeatModalBackdropEl.querySelector<HTMLElement>('[data-testid="defeat-exit-btn"]'),
    () => {
      audioManager.playSfx('select');
      closeBattleScene(ctx);
    },
    { signal }
  );
  bindPointerTap(
    dom.levelUpModalBackdropEl.querySelector<HTMLElement>(
      '[data-testid="levelup-continue-btn"]'
    ),
    () => {
      audioManager.playSfx('select');
      dismissLevelUpModal(ctx);
    },
    { signal }
  );
}
