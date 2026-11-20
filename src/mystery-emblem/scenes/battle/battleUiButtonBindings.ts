/**
 * Unified Pointer Button Bindings for Command Menu, Forecast, Field Menu & Outcome Modals
 */

import { bindPointerTap } from '../../ui/pointerControls';
import { setBattleLogCollapsed } from './battleActionLog';
import { handleBattleMenuOrBack } from './battleBackAndCheats';
import { dismissBeginBattleCard, isPhaseTransitionPlaying } from './battleBannersAndTransitions';
import {
  confirmUnitWait,
  openForecastFromCommandMenu,
  openHealForecastFromCommandMenu,
  useEquippedBattleConsumable,
} from './battleCommandExecution';
import { executeDanceFromCommandMenu } from './battleDanceController';
import { executeTalkFromCommandMenu } from './battleEventRunner';
import {
  closeSystemMenu,
  setSystemMenuSubView,
} from './battleFieldMenuController';
import { isForecastMovePickerOpen, setForecastMovePickerOpen } from './battleForecastView';
import {
  cancelCombatForecast,
  confirmForecastAction,
} from './battleHealForecastAndConfirm';
import { dismissLevelUpModal, dismissMoveLearnedModal } from './battleLevelUpModal';
import {
  closeBattleScene,
  restartBattleMatch,
} from './battleLifecycleController';
import { requestManualEndPhase } from './battlePhaseAndAiRunner';
import { cancelUncommittedMove } from './battleSelectionAndMenu';
import type { BattleControllerContext } from './battleTypesAndState';

export function bindBattleUiButtons(ctx: BattleControllerContext): void {
  const { state, dom, audioManager, abortSignal: signal } = ctx;

  bindPointerTap(
    dom.battleLogToggleBtnEl,
    () => {
      audioManager.playSfx('select');
      setBattleLogCollapsed(state, dom, !state.battleLogCollapsed);
    },
    { signal, stopPropagation: true }
  );

  for (const el of [dom.battleLogBoxEl, dom.battleLogToggleBtnEl]) {
    el.addEventListener('pointerdown', (e) => e.stopPropagation(), { signal });
    el.addEventListener('wheel', (e) => e.stopPropagation(), { signal, passive: true });
    el.addEventListener('touchmove', (e) => e.stopPropagation(), { signal, passive: true });
  }

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
      state.forecastReturnMode = 'action_menu';
      void executeTalkFromCommandMenu(ctx);
    },
    { signal }
  );
  bindPointerTap(
    dom.cmdAttackBtnEl,
    () => {
      openForecastFromCommandMenu(ctx);
    },
    { signal }
  );
  bindPointerTap(
    dom.cmdHealBtnEl,
    () => {
      openHealForecastFromCommandMenu(ctx);
    },
    { signal }
  );
  bindPointerTap(
    dom.cmdDanceBtnEl,
    () => {
      void executeDanceFromCommandMenu(ctx);
    },
    { signal }
  );
  bindPointerTap(
    dom.cmdItemBtnEl,
    () => {
      void useEquippedBattleConsumable(ctx);
    },
    { signal }
  );
  bindPointerTap(
    dom.cmdWaitBtnEl,
    () => {
      void confirmUnitWait(ctx);
    },
    { signal }
  );
  bindPointerTap(
    dom.cmdCancelBtnEl,
    () => {
      cancelUncommittedMove(ctx);
    },
    { signal }
  );

  const forecastEl = dom.forecastModalBackdropEl;
  bindPointerTap(
    forecastEl.querySelector<HTMLElement>('[data-testid="forecast-attack-btn"]'),
    () => void confirmForecastAction(ctx),
    { signal }
  );
  // Back button and taps outside the box peel one layer: picker first, then the forecast.
  const exitForecastLayer = () => {
    if (isForecastMovePickerOpen(forecastEl)) {
      audioManager.playSfx('cancel');
      setForecastMovePickerOpen(forecastEl, false);
      return;
    }
    cancelCombatForecast(ctx);
  };
  bindPointerTap(
    forecastEl.querySelector<HTMLElement>('[data-testid="forecast-back-btn"]'),
    exitForecastLayer,
    { signal }
  );
  forecastEl.addEventListener(
    'pointerdown',
    (e: PointerEvent) => {
      if (e.target !== forecastEl) return;
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      exitForecastLayer();
    },
    { signal }
  );
  bindPointerTap(
    forecastEl.querySelector<HTMLElement>('[data-testid="forecast-move-switch-btn"]'),
    () => {
      audioManager.playSfx('select');
      setForecastMovePickerOpen(forecastEl, !isForecastMovePickerOpen(forecastEl));
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
    dom.fieldEndPhaseBtnEl,
    () => {
      closeSystemMenu(ctx);
      void requestManualEndPhase(ctx);
    },
    { signal }
  );
  const bindFieldSubViewBtn = (btn: HTMLElement, view: 'info' | 'settings' | 'bookmark') => {
    bindPointerTap(
      btn,
      () => {
        audioManager.playSfx('select');
        setSystemMenuSubView(ctx, view);
      },
      { signal }
    );
  };
  bindFieldSubViewBtn(dom.fieldInfoBtnEl, 'info');
  bindFieldSubViewBtn(dom.fieldSettingsBtnEl, 'settings');
  bindFieldSubViewBtn(dom.fieldBookmarkBtnEl, 'bookmark');

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
  bindPointerTap(
    dom.moveLearnedModalBackdropEl.querySelector<HTMLElement>(
      '[data-testid="move-learned-continue-btn"]'
    ),
    () => {
      audioManager.playSfx('select');
      dismissMoveLearnedModal(ctx);
    },
    { signal }
  );
}
