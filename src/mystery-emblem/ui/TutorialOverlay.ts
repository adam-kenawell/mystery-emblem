/**
 * Mystery Emblem - Quaquaval's Field Notes Coordinator (`TutorialOverlay.ts`)
 */

import { getAudioManager, type AudioManager } from '../audio/AudioManager';
import {
  getTutorialTopicById,
  type AdvisorTutorialBeat,
  type TutorialPresenter,
  type TutorialTopicDefinition,
} from '../data/tutorialRegistry';
import type { SaveStateManager } from '../state/SaveStateManager';
import { renderCoachCardWithTypewriter } from './tutorial/TutorialCoachCardRenderer';
import {
  renderTutorialCompendiumDom,
  renderTutorialSettingsControlDom,
  type RenderTutorialSettingsControlOptions,
} from './tutorial/TutorialCompendiumRenderer';
import { renderFieldNoteModalDom } from './tutorial/TutorialNoteModalRenderer';
import { TutorialSessionState } from './tutorial/TutorialSessionState';
import { buildTutorialShellView, type TutorialShellElements } from './tutorial/TutorialShellView';
import { TypewriterController } from './typewriterController';

export type { RenderTutorialSettingsControlOptions };

export interface TutorialOverlayOptions {
  parent: HTMLElement;
  saveManager: SaveStateManager;
  audioManager?: AudioManager;
  onLayerStateChanged?: () => void;
}

export class TutorialOverlay {
  private readonly saveManager: SaveStateManager;
  private readonly audioManager: AudioManager;
  private readonly onLayerStateChanged?: () => void;
  private readonly abortController = new AbortController();
  private readonly shell: TutorialShellElements;
  private readonly session = new TutorialSessionState();
  private readonly typewriter = new TypewriterController();
  private presentationQueue: Promise<unknown> = Promise.resolve();
  private activePresenter: TutorialPresenter = 'advisor';
  private activeTokens: Readonly<Record<string, string>> | undefined;
  private tooltipTopicId: string | null = null;
  private tooltipTimer: number | null = null;

  constructor(options: TutorialOverlayOptions) {
    this.saveManager = options.saveManager;
    this.audioManager = options.audioManager ?? getAudioManager();
    this.onLayerStateChanged = options.onLayerStateChanged;
    this.shell = buildTutorialShellView({
      parent: options.parent,
      signal: this.abortController.signal,
      onBackdropTap: () => {
        if (this.session.mode === 'card') this.handleCoachAdvanceTap();
        else if (this.session.mode === 'note' || this.session.mode === 'compendium') {
          this.handleBack();
        }
      },
      onCardBodyTap: () => this.handleCoachAdvanceTap(),
      onBackGesture: () => this.handleBack(),
      onTooltipPillTap: () => this.handleTooltipPillTap(),
    });
  }

  public isOpen(): boolean {
    return this.session.mode !== 'closed' && !this.shell.backdropEl.hidden;
  }

  public isBlockingSceneInput(): boolean {
    return this.isOpen();
  }

  public getCurrentBeat(): AdvisorTutorialBeat | null {
    return this.session.getCurrentBeat();
  }

  public presentTopicIfNeeded(
    topicId: string,
    opts?: {
      presenter?: TutorialPresenter;
      forceIfAlreadySeen?: boolean;
      tokens?: Readonly<Record<string, string>>;
    }
  ): Promise<boolean> {
    const next = this.presentationQueue.then(() =>
      this.runTopicPresentation(
        topicId,
        opts?.presenter ?? 'advisor',
        Boolean(opts?.forceIfAlreadySeen),
        opts?.tokens
      )
    );
    this.presentationQueue = next.catch(() => false);
    return next;
  }

  private async runTopicPresentation(
    topicId: string,
    presenter: TutorialPresenter,
    forceIfAlreadySeen = false,
    tokens?: Readonly<Record<string, string>>
  ): Promise<boolean> {
    const topic = this.session.evaluateTopicEligibility(
      this.saveManager,
      topicId,
      forceIfAlreadySeen
    );
    if (!topic) return false;

    this.hideTooltipPill();
    return new Promise<boolean>((resolve) => {
      this.activePresenter = presenter;
      this.activeTokens = tokens;
      this.session.startTopic(topic, false, resolve);
      this.session.applyModalDomVisibility(this.shell, 'card');
      this.renderActiveCard();
      this.audioManager.playSfx('select');
      this.onLayerStateChanged?.();
    });
  }

  private showTooltipPill(topic: TutorialTopicDefinition): void {
    this.hideTooltipPill();
    this.tooltipTopicId = topic.id;
    const pill = this.shell.tooltipPillEl;
    pill.innerHTML = '';
    pill.dataset.topicId = topic.id;
    pill.setAttribute('aria-label', `Field Note: ${topic.title} - Tap to Read`);

    const kickerEl = document.createElement('span');
    kickerEl.className = 'pmd-tutorial-pill-kicker';
    kickerEl.textContent = 'Field Note';

    const titleEl = document.createElement('span');
    titleEl.className = 'pmd-tutorial-pill-title';
    titleEl.textContent = topic.title;

    const ctaEl = document.createElement('span');
    ctaEl.className = 'pmd-tutorial-pill-cta';
    ctaEl.textContent = 'Tap to Read';

    pill.append(kickerEl, titleEl, ctaEl);
    pill.hidden = false;
    this.tooltipTimer = window.setTimeout(() => {
      this.hideTooltipPill();
    }, 6000);
  }

  public hideTooltipPill(): void {
    if (this.tooltipTimer !== null) {
      window.clearTimeout(this.tooltipTimer);
      this.tooltipTimer = null;
    }
    this.tooltipTopicId = null;
    this.shell.tooltipPillEl.hidden = true;
    this.shell.tooltipPillEl.removeAttribute('data-topic-id');
  }

  private handleTooltipPillTap(): void {
    const id = this.tooltipTopicId;
    this.hideTooltipPill();
    if (!id) return;
    this.openFieldNoteModal(id, false);
  }

  private resetCardState(markLiveSeen: boolean): ((shown: boolean) => void) | null {
    if (
      markLiveSeen &&
      this.session.activeTopic &&
      !this.session.returnToCompendiumOnClose &&
      this.saveManager.getReadOnlySave()
    ) {
      this.saveManager.markTutorialSeen(this.session.activeTopic.id);
    }
    this.typewriter.stop();
    return this.session.clearCardFields();
  }

  public openCompendiumModal(): void {
    this.hideTooltipPill();
    const prevResolve = this.resetCardState(Boolean(this.session.activeCardResolver));
    this.session.applyModalDomVisibility(this.shell, 'compendium');
    this.renderCompendium();
    this.audioManager.playSfx('select');
    this.onLayerStateChanged?.();
    prevResolve?.(true);
  }

  public openTopicFromCompendium(topicId: string): void {
    this.openFieldNoteModal(topicId, true);
  }

  public openFieldNoteModal(topicId: string, returnToCompendium = false): void {
    const topic = getTutorialTopicById(topicId);
    if (!topic) return;
    this.hideTooltipPill();
    if (this.saveManager.getReadOnlySave()) this.saveManager.markTutorialSeen(topic.id);
    const prevResolve = this.resetCardState(false);
    this.activePresenter = 'advisor';
    this.session.startTopic(topic, returnToCompendium, null);
    this.session.applyModalDomVisibility(this.shell, 'note');
    renderFieldNoteModalDom({
      noteWindowEl: this.shell.noteWindowEl,
      notePortraitView: this.shell.notePortraitView,
      topic,
      save: this.saveManager.getReadOnlySave(),
      returnToCompendium,
      tokens: this.activeTokens,
      signal: this.abortController.signal,
      onClose: () => this.dismissNoteModal(),
    });
    this.audioManager.playSfx('select');
    this.onLayerStateChanged?.();
    prevResolve?.(true);
  }

  private dismissNoteModal(): void {
    const reopen = this.session.returnToCompendiumOnClose;
    const resolver = this.resetCardState(false);
    this.session.applyModalDomVisibility(this.shell, reopen ? 'compendium' : 'closed');
    if (reopen) this.renderCompendium();
    this.audioManager.playSfx('cancel');
    this.onLayerStateChanged?.();
    resolver?.(true);
  }

  public handleBack(): boolean {
    if (!this.isOpen()) return false;
    if (this.session.mode === 'card') {
      this.dismissActiveCard('cancel');
      return true;
    }
    if (this.session.mode === 'note') {
      this.dismissNoteModal();
      return true;
    }
    this.closeAll('cancel');
    return true;
  }

  public closeAll(sfx: 'cancel' | 'select' | null = null): void {
    this.hideTooltipPill();
    const resolver = this.resetCardState(true);
    this.session.applyModalDomVisibility(this.shell, 'closed');
    if (sfx) this.audioManager.playSfx(sfx);
    this.onLayerStateChanged?.();
    resolver?.(true);
  }

  private handleCoachAdvanceTap(): void {
    if (this.session.mode !== 'card') return;
    if (this.typewriter.isAnimating()) {
      this.typewriter.completeImmediately();
      this.audioManager.playSfx('select');
      return;
    }

    const speechEl = this.shell.cardWindowEl.querySelector<HTMLElement>(
      '[data-testid="tutorial-dialogue-text"]'
    );
    if (speechEl && speechEl.scrollHeight - speechEl.scrollTop - speechEl.clientHeight > 4) {
      const parsedLineHeight = parseFloat(getComputedStyle(speechEl).lineHeight) || 22;
      const scrollStep = Math.max(1, Math.round(parsedLineHeight * 3));
      speechEl.scrollTop += scrollStep;
      this.audioManager.playSfx('dialogue_advance');
      return;
    }

    const nextIdx = this.session.activeBeatIndex + 1;
    if (nextIdx < this.session.activeBeats.length) {
      this.typewriter.stop();
      this.session.activeBeatIndex = nextIdx;
      this.audioManager.playSfx('select');
      this.renderActiveCard();
      this.onLayerStateChanged?.();
      return;
    }
    this.dismissActiveCard('select');
  }

  private dismissActiveCard(sfx: 'cancel' | 'select'): void {
    const dismissedTopic = this.session.activeTopic;
    if (dismissedTopic && this.saveManager.getReadOnlySave()) {
      this.saveManager.markTutorialSeen(dismissedTopic.id);
    }
    const reopen = this.session.returnToCompendiumOnClose;
    const resolver = this.resetCardState(false);
    this.session.applyModalDomVisibility(this.shell, reopen ? 'compendium' : 'closed');
    if (reopen) {
      this.renderCompendium();
    } else if (dismissedTopic) {
      this.showTooltipPill(dismissedTopic);
    }
    this.audioManager.playSfx(sfx);
    this.onLayerStateChanged?.();
    resolver?.(true);
  }

  private syncCoachDock(): void {
    const overworldEl = document.querySelector<HTMLElement>('#pmd-overworld-scene:not([hidden])');
    const preferredDock = overworldEl ? 'top' : 'bottom';
    this.shell.backdropEl.classList.remove('is-compendium-mode');
    this.shell.backdropEl.dataset.overworldOpen = overworldEl ? 'true' : 'false';
    this.shell.backdropEl.dataset.coachDock = preferredDock;
    this.shell.cardWindowEl.dataset.coachDock = preferredDock;
  }

  private renderActiveCard(): void {
    const topic = this.session.activeTopic;
    const beat = this.session.activeBeats[this.session.activeBeatIndex];
    if (!topic || !beat) return;
    renderCoachCardWithTypewriter(
      {
        cardWindowEl: this.shell.cardWindowEl,
        coachPortraitView: this.shell.coachPortraitView,
        topic,
        beat,
        beatIndex: this.session.activeBeatIndex,
        totalBeats: this.session.activeBeats.length,
        save: this.saveManager.getReadOnlySave(),
        presenter: this.activePresenter,
        tokens: this.activeTokens,
        signal: this.abortController.signal,
        onNext: () => this.handleCoachAdvanceTap(),
      },
      this.typewriter,
      () => this.audioManager.playSfx('typewriter_blip')
    );
    this.syncCoachDock();
  }

  private renderCompendium(): void {
    renderTutorialCompendiumDom({
      compendiumWindowEl: this.shell.compendiumWindowEl,
      compendiumPortraitView: this.shell.compendiumPortraitView,
      saveManager: this.saveManager,
      signal: this.abortController.signal,
      onClose: () => this.closeAll('cancel'),
      onOpenTopic: (id) => this.openTopicFromCompendium(id),
    });
  }

  public renderTutorialSettingsControl(options?: RenderTutorialSettingsControlOptions): HTMLElement {
    return renderTutorialSettingsControlDom({
      saveManager: this.saveManager,
      audioManager: this.audioManager,
      defaultSignal: this.abortController.signal,
      options,
      onOpenCompendiumModal: () => this.openCompendiumModal(),
    });
  }

  public destroy(): void {
    this.closeAll(null);
    this.hideTooltipPill();
    this.abortController.abort();
    this.shell.backdropEl.remove();
    this.shell.tooltipPillEl.remove();
  }
}
