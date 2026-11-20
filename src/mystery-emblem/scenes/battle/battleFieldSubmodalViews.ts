/**
 * Dungeon Field Menu Submodal Views (`Objective`, `Settings` w/ Audio & Quaquaval's Field Notes, Exit Confirm)
 */

import { renderSharedAudioSettingsControls } from '../../ui/inspector/UnitDetailCard';
import { buildPmdCloseXButtonHtml, createPmdCloseXButton } from '../../ui/PmdWindow';
import { bindPointerTap } from '../../ui/pointerControls';
import { closeBattleScene } from './battleLifecycleController';
import { buildBattleSuspendJson, getBattleSaveBlockReason } from './battleSuspend';
import { isQuaquavalSilentInBattle } from './battleTutorialIntegration';
import type { BattleFieldMenuSubView } from './battlePublicTypes';
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
    const lordLabel = lord ? lord.nickname : 'Dragon Lord';
    const protectedNames = [
      ...new Set(
        state.units
          .filter((u) => u.mustSurvive || state.defeatIfUnitIdsFall.includes(u.id))
          .map((u) => u.nickname)
          .filter((n): n is string => Boolean(n && n !== lordLabel))
      ),
    ];
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
    cardEl.innerHTML = `<h3 class="pmd-panel-title">Settings</h3>`;
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

    if (tutorialOverlay && !isQuaquavalSilentInBattle(ctx)) {
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

    cardEl.appendChild(
      createPmdCloseXButton({
        testId: 'battle-settings-done-btn',
        ariaLabel: 'Close Settings',
        corner: true,
        onTap: () => {
          audioManager.playSfx('cancel');
          hooks.closeSystemMenu();
        },
      })
    );
    return;
  }

  if (!state.suspendSource) {
    cardEl.dataset.testid = 'dungeon-exit-confirm-modal';
    cardEl.setAttribute('aria-label', 'Exit Battle');
    cardEl.innerHTML = `
      ${buildPmdCloseXButtonHtml({ testId: 'battle-cancel-exit-btn', ariaLabel: 'Cancel', corner: true })}
      <h3 class="pmd-panel-title">Exit Battle?</h3>
      <p class="pmd-subcard-text">Leave this test battle and return to the menu.</p>
      <div class="pmd-battle-outcome-actions">
        <button type="button" class="pmd-btn pmd-btn-danger" data-testid="battle-confirm-exit-btn">Exit Battle</button>
      </div>
    `;
    bindPointerTap(cardEl.querySelector<HTMLElement>('[data-testid="battle-confirm-exit-btn"]'), () => {
      audioManager.playSfx('select');
      hooks.closeSystemMenu();
      closeBattleScene(ctx, 'default');
    });
    bindPointerTap(cardEl.querySelector<HTMLElement>('[data-testid="battle-cancel-exit-btn"]'), () => {
      audioManager.playSfx('cancel');
      hooks.setSubView('root');
    });
    return;
  }

  const blockReason = !ctx.saveManager.getSave()
    ? 'No campaign file is loaded.'
    : getBattleSaveBlockReason(state, {
        dialogueOpen: Boolean(ctx.dialogueOverlay?.isOpen()),
        tutorialActive: Boolean(tutorialOverlay?.isBlockingSceneInput()),
      });

  cardEl.dataset.testid = 'dungeon-bookmark-modal';
  cardEl.setAttribute('aria-label', 'Bookmark Battle');
  cardEl.innerHTML = `
    ${buildPmdCloseXButtonHtml({ testId: 'battle-cancel-bookmark-btn', ariaLabel: 'Cancel', corner: true })}
    <h3 class="pmd-panel-title">Bookmark Battle?</h3>
    <p class="pmd-subcard-text" data-bookmark-message>${
      blockReason
        ? escapeHudHtml(blockReason)
        : 'Save your current battle progress to this save file and return to the Title Screen. This bookmark will be deleted once you resume.'
    }</p>
    <div class="pmd-battle-outcome-actions">
      <button type="button" class="pmd-btn pmd-btn-primary" data-testid="battle-confirm-bookmark-btn"${blockReason ? ' disabled' : ''}>Bookmark</button>
    </div>
  `;

  const confirmBtn = cardEl.querySelector<HTMLButtonElement>('[data-testid="battle-confirm-bookmark-btn"]');
  const cancelBtn = cardEl.querySelector<HTMLButtonElement>('[data-testid="battle-cancel-bookmark-btn"]');
  const msgEl = cardEl.querySelector<HTMLElement>('[data-bookmark-message]');
  let bookmarking = false;

  bindPointerTap(confirmBtn, () => {
    if (bookmarking || !confirmBtn || confirmBtn.disabled) return;
    const snapJson = buildBattleSuspendJson(state);
    if (!snapJson) {
      audioManager.playSfx('cancel');
      if (msgEl) msgEl.textContent = 'Unable to create a bookmark right now.';
      return;
    }
    bookmarking = true;
    audioManager.playSfx('select');
    confirmBtn.disabled = true;
    confirmBtn.textContent = 'Bookmarking...';
    if (cancelBtn) cancelBtn.disabled = true;
    void Promise.race([
      ctx.saveManager.saveBattleBookmark(snapJson),
      new Promise<void>((resolve) => window.setTimeout(resolve, 4000)),
    ]).finally(() => {
      hooks.closeSystemMenu();
      closeBattleScene(ctx, 'title');
    });
  });
  bindPointerTap(cancelBtn, () => {
    if (bookmarking) return;
    audioManager.playSfx('cancel');
    hooks.setSubView('root');
  });
}
