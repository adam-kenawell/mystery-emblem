/**
 * Mystery Emblem - Overworld Kecleon Shop, 3-Tab System Menu & Tutorial Coordinator (`OverworldModalCoordinator.ts`)
 */

import type { AudioManager } from '../../audio/AudioManager';
import { KECLEON_PMD_ASSET_ID, type OverworldGraphDefinition } from '../../data/overworldMapData';
import { ensureOverworldGraphState } from '../../engine/overworldEngine';
import type { SaveStateManager } from '../../state/SaveStateManager';
import type { PmdPortraitView } from '../../ui/PmdSpriteCanvas';
import type { TutorialOverlay } from '../../ui/TutorialOverlay';
import { bindPointerTap } from '../../ui/pointerControls';
import { renderOverworldConvoyTab } from './OverworldItemsTabRenderer';
import { renderOverworldKecleonShop } from './OverworldKecleonShopRenderer';
import { openOverworldSaveProgressOverlay, renderOverworldSystemTab, type PendingSystemConfirm } from './OverworldSystemTabRenderer';
import { renderOverworldUnitsTab } from './OverworldUnitsTabRenderer';
import type { OverworldDomElements, OverworldMenuTab } from './overworldDomTemplates';
import { getOverworldArrivalTutorialTopicIds } from './overworldSnapshot';

export class OverworldModalCoordinator {
  public kecleonShopOpen = false;
  public systemMenuOpen = false;
  public activeMenuTab: OverworldMenuTab = 'units';

  private unitDetailPortraitView: PmdPortraitView | null = null;
  private selectedUnitInstanceId: string | null = null;
  private selectedShopItemId: string | null = null;
  private selectedConvoyItemId: string | null = null;
  private selectedUnitVitaminId: string | null = null;
  private selectedUnitTmId: string | null = null;
  private pendingSystemConfirm: PendingSystemConfirm = null;
  private menuFeedbackMessage = '';
  private kecleonStatusMessage = '';

  constructor(
    private readonly deps: {
      dom: OverworldDomElements;
      kecleonPortraitView: PmdPortraitView;
      saveManager: SaveStateManager;
      audioManager: AudioManager;
      tutorialOverlay?: TutorialOverlay;
      getGraph: () => OverworldGraphDefinition;
      isOpen: () => boolean;
      isFastMode: () => boolean;
      onLayerStateChanged: () => void;
      onPreloadActiveSprites: () => void;
      onShowToast: (msg: string) => void;
      onImportedSaveSnapLordAndCamera: () => void;
      onConfirmNewGame: () => void;
      onExitToTitle: () => void;
      onReplayCutscene?: (cutsceneId: string) => void;
      onReplayCredits?: () => void;
    },
    signal: AbortSignal
  ) {
    this.bindModalButtons(signal);
  }

  public resetModals(): void {
    this.kecleonShopOpen = false;
    this.systemMenuOpen = false;
    this.pendingSystemConfirm = null;
    this.deps.dom.kecleonBackdropEl.hidden = true;
    this.deps.dom.systemMenuBackdropEl.hidden = true;
  }

  public openKecleonShop(): void {
    const save = this.deps.saveManager.getSave();
    if (!save) return;
    const reconciled = ensureOverworldGraphState(save, this.deps.getGraph());
    if (!reconciled.nodes[reconciled.currentNodeId]?.activeKecleonShop) {
      this.deps.audioManager.playSfx('cancel');
      this.deps.onShowToast('No shop here.');
      return;
    }
    this.kecleonShopOpen = true;
    this.kecleonStatusMessage = '';
    this.deps.dom.kecleonBackdropEl.hidden = false;
    void this.deps.kecleonPortraitView.setPortrait({ speciesIdOrAssetId: KECLEON_PMD_ASSET_ID, emotion: 'Happy' });
    this.renderKecleonShopContents();
    this.deps.audioManager.playSfx('select');
    this.deps.audioManager.playBgm('kecleon_shop', { fadeMs: 220 });
    this.deps.onLayerStateChanged();
    void this.triggerTutorial('kecleon_shops_and_tms');
  }

  public closeKecleonShop(): void {
    if (!this.kecleonShopOpen) return;
    this.kecleonShopOpen = false;
    this.deps.dom.kecleonBackdropEl.hidden = true;
    this.deps.audioManager.playSfx('cancel');
    if (this.deps.isOpen()) this.deps.audioManager.playBgm('exploration_theme', { fadeMs: 220 });
    this.deps.onLayerStateChanged();
  }

  public renderKecleonShopContents(): void {
    const save = this.deps.saveManager.getSave();
    if (!save) return;
    this.selectedShopItemId = renderOverworldKecleonShop({
      dom: this.deps.dom,
      save,
      graph: this.deps.getGraph(),
      saveManager: this.deps.saveManager,
      audioManager: this.deps.audioManager,
      selectedShopItemId: this.selectedShopItemId,
      statusMessage: this.kecleonStatusMessage,
      onSelectShopItem: (id) => { this.selectedShopItemId = id; this.renderKecleonShopContents(); },
      onStatusAndRefresh: (msg) => { this.kecleonStatusMessage = msg; this.renderKecleonShopContents(); },
    });
  }

  public openSystemMenu(tab: OverworldMenuTab = 'units'): void {
    this.activeMenuTab = tab;
    this.pendingSystemConfirm = null;
    this.menuFeedbackMessage = '';
    this.systemMenuOpen = true;
    this.deps.dom.systemMenuBackdropEl.hidden = false;
    this.deps.audioManager.playSfx('select');
    this.renderSystemMenuBody();
    this.deps.onLayerStateChanged();
    this.deps.tutorialOverlay?.notifyActionCompleted('overworld_open_menu');
  }

  public closeSystemMenu(): void {
    if (!this.systemMenuOpen) return;
    this.systemMenuOpen = false;
    this.pendingSystemConfirm = null;
    this.deps.dom.systemMenuBackdropEl.hidden = true;
    this.deps.audioManager.playSfx('cancel');
    this.deps.onLayerStateChanged();
  }

  public renderSystemMenuBody(): void {
    this.deps.dom.systemMenuBackdropEl.querySelectorAll<HTMLElement>('[data-ow-tab]').forEach((btn) => {
      btn.classList.toggle('is-active', btn.dataset.owTab === this.activeMenuTab);
    });
    this.setMenuFeedback(this.menuFeedbackMessage);
    this.deps.dom.menuPanelBodyEl.innerHTML = '';
    const save = this.deps.saveManager.getSave();
    if (!save) return;

    if (this.activeMenuTab === 'units') {
      const res = renderOverworldUnitsTab({
        menuPanelBodyEl: this.deps.dom.menuPanelBodyEl,
        save,
        saveManager: this.deps.saveManager,
        audioManager: this.deps.audioManager,
        unitDetailPortraitView: this.unitDetailPortraitView,
        selectedUnitInstanceId: this.selectedUnitInstanceId,
        selectedUnitVitaminId: this.selectedUnitVitaminId,
        selectedUnitTmId: this.selectedUnitTmId,
        onSelectUnit: (id) => { this.selectedUnitInstanceId = id; this.menuFeedbackMessage = ''; this.renderSystemMenuBody(); },
        onSelectVitamin: (id) => { this.selectedUnitVitaminId = id; this.renderSystemMenuBody(); },
        onSelectTm: (id) => { this.selectedUnitTmId = id; this.renderSystemMenuBody(); },
        onEvolvedPreloadSprites: () => this.deps.onPreloadActiveSprites(),
        onFeedbackAndRefresh: (msg) => { if (msg) this.setMenuFeedback(msg); this.renderSystemMenuBody(); },
        isSystemMenuOpen: () => this.systemMenuOpen,
      });
      this.unitDetailPortraitView = res.unitDetailPortraitView;
      this.selectedUnitInstanceId = res.selectedUnitInstanceId;
      this.selectedUnitVitaminId = res.selectedUnitVitaminId;
      this.selectedUnitTmId = res.selectedUnitTmId;
    } else if (this.activeMenuTab === 'convoy') {
      const res = renderOverworldConvoyTab({
        menuPanelBodyEl: this.deps.dom.menuPanelBodyEl,
        save,
        saveManager: this.deps.saveManager,
        audioManager: this.deps.audioManager,
        selectedUnitInstanceId: this.selectedUnitInstanceId,
        selectedConvoyItemId: this.selectedConvoyItemId,
        onSelectUnit: (id) => { this.selectedUnitInstanceId = id; this.renderSystemMenuBody(); },
        onSelectConvoyItem: (id) => { this.selectedConvoyItemId = id; this.renderSystemMenuBody(); },
        onEvolvedPreloadSprites: () => this.deps.onPreloadActiveSprites(),
        onFeedbackAndRefresh: (msg) => { this.setMenuFeedback(msg); this.renderSystemMenuBody(); },
      });
      this.selectedUnitInstanceId = res.selectedUnitInstanceId;
      this.selectedConvoyItemId = res.selectedConvoyItemId;
      void this.triggerTutorial('prep_items_and_convoy');
    } else {
      renderOverworldSystemTab({
        menuPanelBodyEl: this.deps.dom.menuPanelBodyEl,
        save,
        saveManager: this.deps.saveManager,
        audioManager: this.deps.audioManager,
        tutorialOverlay: this.deps.tutorialOverlay,
        pendingSystemConfirm: this.pendingSystemConfirm,
        onSetPendingConfirm: (next) => { this.pendingSystemConfirm = next; this.renderSystemMenuBody(); },
        onFeedback: (msg) => this.setMenuFeedback(msg),
        onRefreshSystemMenu: () => this.renderSystemMenuBody(),
        onImportedSaveSnapLordAndCamera: () => this.deps.onImportedSaveSnapLordAndCamera(),
        onConfirmNewGame: () => this.deps.onConfirmNewGame(),
        onExitToTitle: () => this.deps.onExitToTitle(),
        onCloseSystemMenu: () => this.closeSystemMenu(),
        onReplayCutscene: this.deps.onReplayCutscene,
        onReplayCredits: this.deps.onReplayCredits,
      });
    }
  }

  public triggerTutorial(topicId: string): Promise<boolean> {
    if (!this.deps.tutorialOverlay || !this.deps.isOpen()) return Promise.resolve(false);
    return this.deps.tutorialOverlay.presentTopicIfNeeded(topicId, { sceneFastMode: this.deps.isFastMode() });
  }

  public triggerOverworldArrivalTutorials(): void {
    const save = this.deps.saveManager.getSave();
    if (!this.deps.tutorialOverlay || !this.deps.isOpen() || !save) return;
    for (const topicId of getOverworldArrivalTutorialTopicIds(save)) void this.triggerTutorial(topicId);
  }

  private setMenuFeedback(msg: string): void {
    this.menuFeedbackMessage = msg.trim();
    this.deps.dom.menuFeedbackEl.textContent = this.menuFeedbackMessage;
    this.deps.dom.menuFeedbackEl.hidden = this.menuFeedbackMessage.length === 0;
  }

  private bindModalButtons(signal: AbortSignal): void {
    bindPointerTap(this.deps.dom.kecleonBackdropEl.querySelector<HTMLElement>('[data-testid="kecleon-shop-close-btn"]'), () => this.closeKecleonShop(), { signal });
    bindPointerTap(this.deps.dom.kecleonBackdropEl.querySelector<HTMLElement>('[data-testid="kecleon-open-units-btn"]'), () => { this.closeKecleonShop(); this.openSystemMenu('units'); }, { signal });
    bindPointerTap(this.deps.dom.systemMenuBackdropEl.querySelector<HTMLElement>('[data-testid="overworld-menu-close-btn"]'), () => this.closeSystemMenu(), { signal });
    bindPointerTap(this.deps.dom.systemMenuBackdropEl.querySelector<HTMLElement>('[data-testid="overworld-menu-save-btn"]'), () => {
      this.deps.audioManager.playSfx('select');
      openOverworldSaveProgressOverlay(this.deps.saveManager, this.deps.audioManager, () => this.renderSystemMenuBody());
    }, { signal });
    this.deps.dom.systemMenuBackdropEl.querySelectorAll<HTMLElement>('[data-ow-tab]').forEach((tabBtn) => {
      bindPointerTap(tabBtn, () => {
        const tab = tabBtn.dataset.owTab as OverworldMenuTab | undefined;
        if (!tab) return;
        this.deps.audioManager.playSfx('select');
        this.activeMenuTab = tab;
        this.pendingSystemConfirm = null;
        this.menuFeedbackMessage = '';
        this.renderSystemMenuBody();
      }, { signal });
    });
  }
}
