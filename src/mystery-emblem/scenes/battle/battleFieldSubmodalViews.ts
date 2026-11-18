/**
 * Dungeon Field Menu Submodal Views (`Objective`, `Settings` w/ Audio & Quaquaval's Field Notes, Exit Confirm)
 */

import { renderSharedAudioSettingsControls } from '../../ui/inspector/UnitDetailCard';
import { bindPointerTap } from '../../ui/pointerControls';
import { closeBattleScene } from './battleLifecycleController';
import { getBattleSaveBlockReason, openBattleSaveProgressOverlay } from './battleSuspend';
import type {
  BattleExitDestination,
  BattleFieldMenuSubView,
} from './battlePublicTypes';
import type { BattleControllerContext } from './battleTypesAndState';
import {
  escapeHudHtml,
  getLivingEnemies,
  getLivingPlayers,
  getLordUnit,
} from './battleUnitQueries';
import { renderBattleUnitsRosterPanel } from './battleUnitsRosterPanel';

export function renderFieldSubmodalContents(
  ctx: BattleControllerContext,
  subView: Exclude<BattleFieldMenuSubView, 'root'>,
  hooks: {
    closeSystemMenu: () => void;
    setSubView: (next: BattleFieldMenuSubView) => void;
  }
): void {
  const { state, dom, audioManager, tutorialOverlay } = ctx;
  const cardEl = dom.fieldSubmodalCardEl;
  cardEl.classList.remove('is-units-panel');
  cardEl.innerHTML = '';

  if (subView === 'info') {
    const lord = getLordUnit(state);
    const livingAllies = getLivingPlayers(state);
    const readyAllies = livingAllies.filter((u) => !u.waited).length;
    const livingEnemies = getLivingEnemies(state);
    const protectedNames = state.defeatIfUnitIdsFall
      .map((id) => state.units.find((u) => u.id === id)?.nickname)
      .filter((n): n is string => Boolean(n && n !== lord?.nickname));
    const lordLabel = lord ? lord.nickname : 'Dragon Lord';
    const defeatText =
      protectedNames.length > 0
        ? `${[lordLabel, ...protectedNames].join(' or ')} falls in battle`
        : `${lordLabel} falls in battle`;
    const turnDisplay = state.surviveTurns
      ? `Turn ${state.turnNumber} / ${state.surviveTurns}`
      : `Turn ${state.turnNumber}`;

    const headerHtml = `
      <p class="pmd-panel-sub" data-testid="dungeon-objective-turn">${escapeHudHtml(state.map.name)} · ${escapeHudHtml(turnDisplay)}</p>
      <div class="pmd-dungeon-obj-grid">
        <div class="pmd-dungeon-obj-cell is-wide">
          <span>Victory Condition</span>
          <strong data-testid="dungeon-objective-victory">${escapeHudHtml(state.objectiveLabel)}</strong>
        </div>
        <div class="pmd-dungeon-obj-cell is-wide">
          <span>Defeat Condition</span>
          <strong class="is-danger" data-testid="dungeon-objective-defeat">${escapeHudHtml(defeatText)}</strong>
        </div>
        <div class="pmd-dungeon-obj-cell">
          <span>Allies Ready</span>
          <strong>${readyAllies} / ${livingAllies.length}</strong>
        </div>
        <div class="pmd-dungeon-obj-cell">
          <span>Enemies Left</span>
          <strong>${livingEnemies.length}</strong>
        </div>
      </div>
    `;
    renderBattleUnitsRosterPanel(ctx, cardEl, hooks.closeSystemMenu, { headerHtml });
    return;
  }

  if (subView === 'settings') {
    cardEl.dataset.testid = 'dungeon-settings-modal';
    cardEl.setAttribute('aria-label', 'Audio Settings');
    cardEl.innerHTML = `<h3 class="pmd-panel-title">SETTINGS</h3>`;
    const settingsListEl = renderSharedAudioSettingsControls({
      audioManager,
      layout: 'battle',
      muteTestId: 'battle-settings-mute-btn',
      bgmSliderTestId: 'battle-settings-bgm-slider',
      bgmValTestId: 'battle-settings-bgm-val',
      sfxSliderTestId: 'battle-settings-sfx-slider',
      sfxValTestId: 'battle-settings-sfx-val',
    });
    cardEl.appendChild(settingsListEl);

    if (tutorialOverlay) {
      const dividerEl = document.createElement('div');
      dividerEl.style.borderTop = '1px solid rgba(168, 192, 224, 0.35)';
      dividerEl.style.paddingTop = '6px';
      dividerEl.appendChild(
        tutorialOverlay.renderTutorialSettingsControl({
          onOpenCompendium: () => {
            hooks.closeSystemMenu();
          },
        })
      );
      settingsListEl.appendChild(dividerEl);
    }

    const actionsEl = document.createElement('div');
    actionsEl.className = 'pmd-battle-outcome-actions';
    actionsEl.innerHTML = `<button type="button" class="pmd-btn pmd-btn-primary" data-testid="battle-settings-done-btn">Done</button>`;
    cardEl.appendChild(actionsEl);

    bindPointerTap(
      cardEl.querySelector<HTMLElement>('[data-testid="battle-settings-done-btn"]'),
      () => {
        audioManager.playSfx('select');
        hooks.closeSystemMenu();
      }
    );
    return;
  }

  if (subView === 'save_exit') {
    cardEl.dataset.testid = 'dungeon-save-exit-modal';
    cardEl.setAttribute('aria-label', 'Save and Exit');
    const saveBlock = getBattleSaveBlockReason(state);
    cardEl.innerHTML = `
      <h3 class="pmd-panel-title">SAVE &amp; EXIT</h3>
      <div class="pmd-menu-list">
        ${state.suspendSource ? `<button type="button" class="pmd-btn pmd-menu-row" data-testid="battle-field-save"${saveBlock ? ` disabled title="${escapeHudHtml(saveBlock)}"` : ''}>Save Progress</button>` : ''}
        <button type="button" class="pmd-btn pmd-menu-row" data-testid="battle-field-overworld">Return to Overworld</button>
        <button type="button" class="pmd-btn pmd-btn-danger pmd-menu-row" data-testid="battle-field-title">Return to Title Screen</button>
      </div>
      <div class="pmd-battle-outcome-actions">
        <button type="button" class="pmd-btn" data-testid="battle-save-exit-back-btn">Back</button>
      </div>
    `;
    bindPointerTap(cardEl.querySelector<HTMLElement>('[data-testid="battle-field-save"]'), () => {
      audioManager.playSfx('select');
      hooks.closeSystemMenu();
      openBattleSaveProgressOverlay(ctx);
    });
    bindPointerTap(
      cardEl.querySelector<HTMLElement>('[data-testid="battle-field-overworld"]'),
      () => {
        audioManager.playSfx('select');
        hooks.setSubView('confirm_overworld');
      }
    );
    bindPointerTap(cardEl.querySelector<HTMLElement>('[data-testid="battle-field-title"]'), () => {
      audioManager.playSfx('select');
      hooks.setSubView('confirm_title');
    });
    bindPointerTap(
      cardEl.querySelector<HTMLElement>('[data-testid="battle-save-exit-back-btn"]'),
      () => {
        audioManager.playSfx('cancel');
        hooks.setSubView('save_exit');
      }
    );
    return;
  }

  const isOverworld = subView === 'confirm_overworld';
  const destination: BattleExitDestination = isOverworld ? 'overworld' : 'title';
  const titleText = isOverworld ? 'RETURN TO OVERWORLD?' : 'RETURN TO TITLE SCREEN?';
  const confirmLabel = isOverworld ? 'Return to Overworld' : 'Return to Title Screen';

  cardEl.dataset.testid = 'dungeon-exit-confirm-modal';
  cardEl.setAttribute('aria-label', titleText);
  cardEl.innerHTML = `
    <h3 class="pmd-panel-title">${titleText}</h3>
    <p class="pmd-subcard-text">Unsaved progress in this dungeon battle will be lost.</p>
    <div class="pmd-battle-outcome-actions">
      <button type="button" class="pmd-btn pmd-btn-danger" data-testid="battle-confirm-exit-btn">${confirmLabel}</button>
      <button type="button" class="pmd-btn" data-testid="battle-cancel-exit-btn">Cancel</button>
    </div>
  `;

  bindPointerTap(
    cardEl.querySelector<HTMLElement>('[data-testid="battle-confirm-exit-btn"]'),
    () => {
      audioManager.playSfx('select');
      hooks.closeSystemMenu();
      closeBattleScene(ctx, destination);
    }
  );
  bindPointerTap(
    cardEl.querySelector<HTMLElement>('[data-testid="battle-cancel-exit-btn"]'),
    () => {
      audioManager.playSfx('cancel');
      hooks.setSubView('save_exit');
    }
  );
}
