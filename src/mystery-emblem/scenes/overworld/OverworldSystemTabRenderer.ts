/**
 * Mystery Emblem — Overworld System Menu `System` Tab Renderer (`OverworldSystemTabRenderer.ts`)
 */

import type { AudioManager } from '../../audio/AudioManager';
import type { SaveStateManager } from '../../state/SaveStateManager';
import type { SaveData } from '../../types/schemas';
import type { TutorialOverlay } from '../../ui/TutorialOverlay';
import { escapeUiHtml } from '../../ui/inspector/UnitDetailCard';
import { bindPointerTap } from '../../ui/pointerControls';
import { openSaveSlotOverlay } from '../../ui/SaveSlotOverlay';
import { buildStoryReplaySubbox } from './overworldStoryReplayBox';

export type PendingSystemConfirm = 'new_game' | 'delete_save' | null;

/** Overworld "Save Progress": no battle is running, so any stale mid-battle snapshot is dropped. */
export function openOverworldSaveProgressOverlay(
  saveManager: SaveStateManager,
  audioManager: AudioManager,
  onAfterClose?: () => void
): void {
  openSaveSlotOverlay({
    manager: saveManager,
    audioManager,
    mode: 'save',
    blockedReason: saveManager.getSave() ? null : 'No campaign file is loaded.',
    onSaveToSlot: (slot) => {
      saveManager.saveProgressToSlot(slot, { battleSuspendJson: null });
    },
    onClose: onAfterClose,
  });
}

export interface OverworldSystemTabParams {
  menuPanelBodyEl: HTMLElement;
  save: SaveData;
  saveManager: SaveStateManager;
  audioManager: AudioManager;
  tutorialOverlay?: TutorialOverlay;
  pendingSystemConfirm: PendingSystemConfirm;
  onSetPendingConfirm: (next: PendingSystemConfirm) => void;
  onFeedback: (msg: string) => void;
  onRefreshSystemMenu: () => void;
  onImportedSaveSnapLordAndCamera: () => void;
  onConfirmNewGame: () => void;
  onExitToTitle: () => void;
  onCloseSystemMenu: () => void;
  onReplayCutscene?: (cutsceneId: string) => void;
  onReplayCredits?: () => void;
}

export function renderOverworldSystemTab(params: OverworldSystemTabParams): void {
  const {
    menuPanelBodyEl,
    save,
    saveManager,
    audioManager,
    tutorialOverlay,
    pendingSystemConfirm,
    onSetPendingConfirm,
    onFeedback,
    onRefreshSystemMenu,
    onImportedSaveSnapLordAndCamera,
    onConfirmNewGame,
    onExitToTitle,
    onCloseSystemMenu,
    onReplayCutscene,
    onReplayCredits,
  } = params;

  const sync = saveManager.getSyncStatus();
  const audioSettings = audioManager.getSettings();

  const audioBox = document.createElement('div');
  audioBox.className = 'pmd-overworld-subbox';
  audioBox.innerHTML = `
    <p class="pmd-overworld-subbox-title">Audio</p>
    <div class="pmd-overworld-action-row">
      <button type="button" class="pmd-btn pmd-chip-btn${audioSettings.muted ? '' : ' is-active'}" data-testid="overworld-audio-mute-btn">
        ${audioSettings.muted ? 'Audio: Muted' : 'Audio: ON'}
      </button>
      <label style="display:flex;align-items:center;gap:0.4rem;font-size:0.75rem;">
        <span>BGM</span>
        <input type="range" min="0" max="100" value="${Math.round(audioSettings.bgmVolume * 100)}" data-testid="overworld-bgm-slider" />
      </label>
      <label style="display:flex;align-items:center;gap:0.4rem;font-size:0.75rem;">
        <span>SFX</span>
        <input type="range" min="0" max="100" value="${Math.round(audioSettings.sfxVolume * 100)}" data-testid="overworld-sfx-slider" />
      </label>
    </div>
  `;

  bindPointerTap(
    audioBox.querySelector<HTMLElement>('[data-testid="overworld-audio-mute-btn"]'),
    () => {
      const nowMuted = audioManager.toggleMute();
      if (!nowMuted) audioManager.playSfx('select');
      onRefreshSystemMenu();
    }
  );
  const bgmSlider = audioBox.querySelector<HTMLInputElement>('[data-testid="overworld-bgm-slider"]');
  bgmSlider?.addEventListener('input', () => {
    audioManager.setBgmVolume(Number(bgmSlider.value) / 100);
  });
  const sfxSlider = audioBox.querySelector<HTMLInputElement>('[data-testid="overworld-sfx-slider"]');
  sfxSlider?.addEventListener('input', () => {
    audioManager.setSfxVolume(Number(sfxSlider.value) / 100);
  });

  const saveBox = document.createElement('div');
  saveBox.className = 'pmd-overworld-subbox';
  saveBox.style.marginTop = '0.5rem';
  saveBox.innerHTML = `
    <p class="pmd-overworld-subbox-title">Save Data</p>
    <div class="pmd-overworld-action-row">
      <div class="pmd-overworld-action-meta">
        <strong>File ${saveManager.getActiveSlot()} · ${escapeUiHtml(sync.user?.email ?? 'Local Save')}</strong>
        <span>Saved ${escapeUiHtml(new Date(save.lastUpdated).toLocaleTimeString())}</span>
      </div>
      <div class="pmd-inline-btns">
        <button type="button" class="pmd-btn pmd-btn-primary pmd-chip-btn" data-testid="overworld-save-progress-btn">Save Progress</button>
        <button type="button" class="pmd-btn pmd-chip-btn" data-testid="overworld-export-save-btn">Export</button>
        <button type="button" class="pmd-btn pmd-chip-btn" data-testid="overworld-import-save-btn">Import</button>
        <input type="file" accept=".json,application/json" hidden data-ow-import-input />
      </div>
    </div>
  `;

  bindPointerTap(
    saveBox.querySelector<HTMLElement>('[data-testid="overworld-save-progress-btn"]'),
    () => {
      audioManager.playSfx('select');
      openOverworldSaveProgressOverlay(saveManager, audioManager, onRefreshSystemMenu);
    }
  );

  bindPointerTap(
    saveBox.querySelector<HTMLElement>('[data-testid="overworld-export-save-btn"]'),
    () => {
      try {
        const json = saveManager.exportSaveJson();
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `mystery-emblem-save.json`;
        a.click();
        URL.revokeObjectURL(url);
        audioManager.playSfx('select');
        onFeedback('Exported save backup.');
      } catch (err) {
        audioManager.playSfx('cancel');
        onFeedback(err instanceof Error ? err.message : 'Export failed.');
      }
    }
  );

  const fileInput = saveBox.querySelector<HTMLInputElement>('[data-ow-import-input]');
  bindPointerTap(
    saveBox.querySelector<HTMLElement>('[data-testid="overworld-import-save-btn"]'),
    () => fileInput?.click()
  );
  fileInput?.addEventListener('change', () => {
    const f = fileInput.files?.[0];
    if (!f) return;
    void f.text().then((raw) => {
      try {
        saveManager.importSaveJson(raw);
        onImportedSaveSnapLordAndCamera();
        audioManager.playSfx('heal');
        onFeedback('Imported save backup!');
        onRefreshSystemMenu();
      } catch (err) {
        audioManager.playSfx('cancel');
        onFeedback(err instanceof Error ? err.message : 'Invalid save JSON.');
      }
    });
  });

  const actionsBox = document.createElement('div');
  actionsBox.className = 'pmd-overworld-subbox';
  actionsBox.style.marginTop = '0.5rem';
  actionsBox.innerHTML = `
    <p class="pmd-overworld-subbox-title">Campaign</p>
    <div class="pmd-inline-btns">
      <button type="button" class="pmd-btn" data-testid="overworld-new-game-btn">New Game</button>
      <button type="button" class="pmd-btn pmd-btn-danger" data-testid="overworld-delete-save-btn">Delete Save</button>
      <button type="button" class="pmd-btn" data-testid="overworld-exit-btn">Title Screen</button>
    </div>
    <div data-ow-confirm-slot style="margin-top:0.45rem;" ${pendingSystemConfirm ? '' : 'hidden'}></div>
  `;

  bindPointerTap(
    actionsBox.querySelector<HTMLElement>('[data-testid="overworld-new-game-btn"]'),
    () => {
      audioManager.playSfx('select');
      onSetPendingConfirm('new_game');
    }
  );
  bindPointerTap(
    actionsBox.querySelector<HTMLElement>('[data-testid="overworld-delete-save-btn"]'),
    () => {
      audioManager.playSfx('select');
      onSetPendingConfirm('delete_save');
    }
  );
  bindPointerTap(actionsBox.querySelector<HTMLElement>('[data-testid="overworld-exit-btn"]'), () => {
    audioManager.playSfx('cancel');
    onExitToTitle();
  });

  const confirmSlot = actionsBox.querySelector<HTMLElement>('[data-ow-confirm-slot]');
  if (confirmSlot && pendingSystemConfirm) {
    if (pendingSystemConfirm === 'new_game') {
      confirmSlot.innerHTML = `
        <div class="pmd-overworld-action-row">
          <span style="color:#ffd878;font-size:0.78rem;">Start a new run? Current progress will be replaced.</span>
          <div class="pmd-inline-btns">
            <button type="button" class="pmd-btn pmd-btn-primary pmd-chip-btn" data-testid="overworld-confirm-new-game-btn">Start New Game</button>
            <button type="button" class="pmd-btn pmd-chip-btn" data-ow-cancel-confirm>Cancel</button>
          </div>
        </div>
      `;
      bindPointerTap(
        confirmSlot.querySelector<HTMLElement>('[data-testid="overworld-confirm-new-game-btn"]'),
        () => {
          audioManager.playSfx('select');
          onConfirmNewGame();
        }
      );
    } else {
      confirmSlot.innerHTML = `
        <div class="pmd-overworld-action-row">
          <span style="color:#ff9aa2;font-size:0.78rem;">Delete File ${saveManager.getActiveSlot()} permanently?</span>
          <div class="pmd-inline-btns">
            <button type="button" class="pmd-btn pmd-btn-danger pmd-chip-btn" data-testid="overworld-confirm-delete-save-btn">Confirm Delete</button>
            <button type="button" class="pmd-btn pmd-chip-btn" data-ow-cancel-confirm>Cancel</button>
          </div>
        </div>
      `;
      bindPointerTap(
        confirmSlot.querySelector<HTMLElement>(
          '[data-testid="overworld-confirm-delete-save-btn"]'
        ),
        () => {
          audioManager.playSfx('cancel');
          void saveManager.deleteSaveFromLinkedAccount().then(() => onExitToTitle());
        }
      );
    }
    bindPointerTap(confirmSlot.querySelector<HTMLElement>('[data-ow-cancel-confirm]'), () => {
      audioManager.playSfx('cancel');
      onSetPendingConfirm(null);
    });
  }

  const storyBox = buildStoryReplaySubbox({
    save,
    audioManager,
    onCloseSystemMenu,
    onReplayCutscene,
    onReplayCredits,
  });

  if (tutorialOverlay) {
    const tutorialsBox = document.createElement('div');
    tutorialsBox.className = 'pmd-overworld-subbox';
    tutorialsBox.style.marginTop = '0.5rem';
    const tutTitle = document.createElement('p');
    tutTitle.className = 'pmd-overworld-subbox-title';
    tutTitle.textContent = 'Tutorials & Guide';
    tutorialsBox.appendChild(tutTitle);
    tutorialsBox.appendChild(
      tutorialOverlay.renderTutorialSettingsControl({
        onAfterChange: () => onFeedback('Updated tutorial preferences.'),
      })
    );
    if (storyBox) menuPanelBodyEl.append(audioBox, storyBox, tutorialsBox, saveBox, actionsBox);
    else menuPanelBodyEl.append(audioBox, tutorialsBox, saveBox, actionsBox);
    return;
  }

  if (storyBox) menuPanelBodyEl.append(audioBox, storyBox, saveBox, actionsBox);
  else menuPanelBodyEl.append(audioBox, saveBox, actionsBox);
}
