/**
 * Mystery Emblem — Lean Admin Dev Tools Overlay Coordinator (`DevToolsHarness`)
 */

import { getAudioManager, type AudioManager } from '../audio/AudioManager';
import { subscribeChapterMapChanges } from '../data/chapterMapRegistry';
import type { SaveStateManager } from '../state/SaveStateManager';
import { DevToolsCheatsController } from './devtools/DevToolsCheatsController';
import { DevToolsMapsController } from './devtools/DevToolsMapsController';
import { buildDevToolsModalHtml } from './devtools/devToolsModalTemplate';
import { bindPointerTap } from './pointerControls';

export type DevToolsSubTab = 'cheats' | 'maps';

export interface DevToolsHarnessOptions {
  modalEl: HTMLElement;
  saveManager: SaveStateManager;
  audioManager?: AudioManager;
  isBattleOpen: () => boolean;
  onCheatFullHealSquad: () => void;
  onCheatInstantWin: () => void;
  onLiveStateMutated: (opts?: { snapOverworld?: boolean }) => void;
  onLaunchMapEditor: (levelId: string) => void;
  onPlayMapBattle: (levelId: string) => void;
  onRequestRenameUnit: (instanceId: string) => void;
  onClose: () => void;
  signal?: AbortSignal;
}

export class DevToolsHarness {
  private readonly modalEl: HTMLElement;
  private readonly audioManager: AudioManager;
  private readonly onClose: () => void;
  private readonly abortController = new AbortController();

  private readonly cheatsController: DevToolsCheatsController;
  private readonly mapsController: DevToolsMapsController;
  private activeSubTab: DevToolsSubTab = 'cheats';
  private unsubscribeMapStore: (() => void) | null = null;

  constructor(options: DevToolsHarnessOptions) {
    this.modalEl = options.modalEl;
    this.audioManager = options.audioManager ?? getAudioManager();
    this.onClose = options.onClose;

    if (options.signal) {
      options.signal.addEventListener('abort', () => this.destroy(), { once: true });
    }

    this.modalEl.innerHTML = buildDevToolsModalHtml();

    const signal = this.abortController.signal;
    this.cheatsController = new DevToolsCheatsController({
      modalEl: this.modalEl,
      saveManager: options.saveManager,
      audioManager: this.audioManager,
      isBattleOpen: options.isBattleOpen,
      onCheatFullHealSquad: options.onCheatFullHealSquad,
      onCheatInstantWin: options.onCheatInstantWin,
      onLiveStateMutated: options.onLiveStateMutated,
      onRequestRenameUnit: options.onRequestRenameUnit,
      onClose: options.onClose,
      signal,
    });
    this.mapsController = new DevToolsMapsController({
      modalEl: this.modalEl,
      saveManager: options.saveManager,
      audioManager: this.audioManager,
      onLaunchMapEditor: options.onLaunchMapEditor,
      onPlayMapBattle: options.onPlayMapBattle,
      signal,
    });

    bindPointerTap(
      this.modalEl.querySelector('[data-testid="devtools-close-btn"]'),
      () => {
        this.audioManager.playSfx('cancel');
        this.onClose();
      },
      { signal }
    );

    this.modalEl.querySelectorAll<HTMLButtonElement>('[data-devtab-btn]').forEach((btn) => {
      bindPointerTap(
        btn,
        () => {
          const tab = btn.dataset.devtabBtn as DevToolsSubTab | undefined;
          if (!tab) return;
          this.audioManager.playSfx('select');
          this.switchSubTab(tab);
        },
        { signal }
      );
    });

    this.unsubscribeMapStore = subscribeChapterMapChanges(() => {
      this.refreshMapPreviewTab();
    });

    this.refreshCheatsTab();
    this.refreshMapPreviewTab();
  }

  public getActiveSubTab(): DevToolsSubTab {
    return this.activeSubTab;
  }

  public switchSubTab(tab: DevToolsSubTab): void {
    this.activeSubTab = tab;
    this.modalEl.querySelectorAll<HTMLButtonElement>('[data-devtab-btn]').forEach((btn) => {
      btn.classList.toggle('is-active', btn.dataset.devtabBtn === tab);
    });
    this.modalEl.querySelectorAll<HTMLElement>('[data-devtab-panel]').forEach((panel) => {
      panel.hidden = panel.dataset.devtabPanel !== tab;
    });

    if (tab === 'cheats') this.refreshCheatsTab();
    else this.refreshMapPreviewTab();
  }

  public onSaveChanged(): void {
    this.refreshCheatsTab();
    if (this.activeSubTab === 'maps') this.refreshMapPreviewTab();
  }

  public refreshCheatsTab(): void {
    this.cheatsController.refresh();
  }

  public refreshMapPreviewTab(): void {
    this.mapsController.refresh();
  }

  public destroy(): void {
    this.unsubscribeMapStore?.();
    this.unsubscribeMapStore = null;
    this.abortController.abort();
  }
}
