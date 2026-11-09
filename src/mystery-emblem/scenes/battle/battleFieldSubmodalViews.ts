/**
 * Dungeon Field Menu Submodal Views (`Objective`, `Settings` w/ Audio & `Ask Wimpod`, Exit Confirm)
 */

import { bindPointerTap } from '../../ui/pointerControls';
import { closeBattleScene } from './battleLifecycleController';
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
  cardEl.innerHTML = '';

  if (subView === 'objective') {
    cardEl.dataset.testid = 'dungeon-objective-modal';
    cardEl.setAttribute('aria-label', 'Battle Objective');
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

    cardEl.innerHTML = `
      <h3 class="pmd-panel-title">OBJECTIVE</h3>
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
      <div class="pmd-battle-outcome-actions">
        <button type="button" class="pmd-btn pmd-btn-primary" data-testid="battle-objective-close-btn">Close</button>
      </div>
    `;

    bindPointerTap(
      cardEl.querySelector<HTMLElement>('[data-testid="battle-objective-close-btn"]'),
      () => {
        audioManager.playSfx('cancel');
        hooks.closeSystemMenu();
      }
    );
    return;
  }

  if (subView === 'settings') {
    cardEl.dataset.testid = 'dungeon-settings-modal';
    cardEl.setAttribute('aria-label', 'Audio Settings');
    const settings = audioManager.getSettings();
    const bgmPct = Math.round(settings.bgmVolume * 100);
    const sfxPct = Math.round(settings.sfxVolume * 100);

    cardEl.innerHTML = `
      <h3 class="pmd-panel-title">SETTINGS</h3>
      <div class="pmd-dungeon-settings-list">
        <button type="button" class="pmd-btn${settings.muted ? '' : ' is-active'}" data-testid="battle-settings-mute-btn">
          ${settings.muted ? 'Audio: Muted' : 'Audio: ON'}
        </button>
        <div class="pmd-dungeon-slider-row">
          <label for="battle-settings-bgm">Music</label>
          <input id="battle-settings-bgm" type="range" min="0" max="100" value="${bgmPct}" data-testid="battle-settings-bgm-slider" />
          <span class="pmd-dungeon-slider-val" data-testid="battle-settings-bgm-val">${bgmPct}%</span>
        </div>
        <div class="pmd-dungeon-slider-row">
          <label for="battle-settings-sfx">SFX</label>
          <input id="battle-settings-sfx" type="range" min="0" max="100" value="${sfxPct}" data-testid="battle-settings-sfx-slider" />
          <span class="pmd-dungeon-slider-val" data-testid="battle-settings-sfx-val">${sfxPct}%</span>
        </div>
      </div>
      <div class="pmd-battle-outcome-actions">
        <button type="button" class="pmd-btn pmd-btn-primary" data-testid="battle-settings-done-btn">Done</button>
      </div>
    `;

    const muteBtn = cardEl.querySelector<HTMLButtonElement>(
      '[data-testid="battle-settings-mute-btn"]'
    );
    const bgmSlider = cardEl.querySelector<HTMLInputElement>(
      '[data-testid="battle-settings-bgm-slider"]'
    );
    const bgmValEl = cardEl.querySelector<HTMLElement>(
      '[data-testid="battle-settings-bgm-val"]'
    );
    const sfxSlider = cardEl.querySelector<HTMLInputElement>(
      '[data-testid="battle-settings-sfx-slider"]'
    );
    const sfxValEl = cardEl.querySelector<HTMLElement>(
      '[data-testid="battle-settings-sfx-val"]'
    );

    bindPointerTap(muteBtn, () => {
      const nowMuted = audioManager.toggleMute();
      if (!nowMuted) {
        audioManager.playSfx('select');
      }
      if (muteBtn) {
        muteBtn.textContent = nowMuted ? 'Audio: Muted' : 'Audio: ON';
        muteBtn.classList.toggle('is-active', !nowMuted);
      }
    });

    bgmSlider?.addEventListener('input', () => {
      const pct = Math.max(0, Math.min(100, Math.round(Number(bgmSlider.value))));
      audioManager.setBgmVolume(pct / 100);
      if (bgmValEl) bgmValEl.textContent = `${pct}%`;
    });

    sfxSlider?.addEventListener('input', () => {
      const pct = Math.max(0, Math.min(100, Math.round(Number(sfxSlider.value))));
      audioManager.setSfxVolume(pct / 100);
      if (sfxValEl) sfxValEl.textContent = `${pct}%`;
    });
    sfxSlider?.addEventListener('change', () => {
      audioManager.playSfx('select');
    });

    if (tutorialOverlay) {
      const settingsListEl = cardEl.querySelector<HTMLElement>('.pmd-dungeon-settings-list');
      if (settingsListEl) {
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
    }

    bindPointerTap(
      cardEl.querySelector<HTMLElement>('[data-testid="battle-settings-done-btn"]'),
      () => {
        audioManager.playSfx('select');
        hooks.closeSystemMenu();
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
      hooks.setSubView('root');
    }
  );
}
