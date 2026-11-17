/**
 * Mystery Emblem - Quaquaval's Field Notes Coordinator (`TutorialOverlay.ts`)
 */

import { getAudioManager, type AudioManager } from '../audio/AudioManager';
import {
  getTutorialTopicById,
  type AdvisorTutorialBeat,
  type TutorialActionTriggerId,
  type TutorialBattleTileFilter,
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
import {
  TutorialSessionState,
  type TutorialActionAvailabilityContext,
} from './tutorial/TutorialSessionState';
import { buildTutorialShellView, type TutorialShellElements } from './tutorial/TutorialShellView';
import { TypewriterController } from './typewriterController';

export type { RenderTutorialSettingsControlOptions, TutorialActionAvailabilityContext };

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
  private fastMode = false;
  private pauseInFastMode = false;
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
      isInteractiveStep: () => this.hasActiveInteractiveStep(),
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

  public setActionAvailabilityProvider(provider: TutorialActionAvailabilityContext | null): void {
    this.session.availabilityProvider = provider;
    if (this.isOpen() && this.session.mode === 'card') this.session.syncInteractivity();
  }

  public isOpen(): boolean {
    return this.session.mode !== 'closed' && !this.shell.backdropEl.hidden;
  }

  public isBlockingSceneInput(): boolean {
    return this.isOpen() && !this.hasActiveInteractiveStep();
  }

  public setFastMode(enabled: boolean): void {
    this.fastMode = enabled;
  }

  public setPauseInFastMode(enabled: boolean): void {
    this.pauseInFastMode = enabled;
  }

  public getCurrentBeat(): AdvisorTutorialBeat | null {
    return this.session.getCurrentBeat();
  }

  public getExpectedAction(): TutorialActionTriggerId | null {
    return this.session.getExpectedAction(this.isOpen());
  }

  public hasActiveInteractiveStep(): boolean {
    return this.getExpectedAction() !== null;
  }

  public getActiveTileFilter(): TutorialBattleTileFilter | null {
    return this.session.getActiveTileFilter(this.isOpen());
  }

  public notifyActionCompleted(action: TutorialActionTriggerId): boolean {
    if (this.getExpectedAction() !== action) return false;
    this.advanceFromCurrentBeat('select');
    return true;
  }

  public nudgeActiveStep(): void {
    if (!this.isOpen() || this.session.mode !== 'card') return;
    if (this.typewriter.isAnimating()) this.typewriter.completeImmediately();
    this.audioManager.playSfx('cancel');
    this.session.triggerNudgeAnimation(this.shell.cardWindowEl);
  }

  public presentTopicIfNeeded(
    topicId: string,
    opts?: {
      sceneFastMode?: boolean;
      presenter?: TutorialPresenter;
      forceIfAlreadySeen?: boolean;
      tokens?: Readonly<Record<string, string>>;
    }
  ): Promise<boolean> {
    const next = this.presentationQueue.then(() =>
      this.runTopicPresentation(
        topicId,
        Boolean(opts?.sceneFastMode),
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
    sceneFastMode: boolean,
    presenter: TutorialPresenter,
    forceIfAlreadySeen = false,
    tokens?: Readonly<Record<string, string>>
  ): Promise<boolean> {
    const skipFast = (this.fastMode || sceneFastMode) && !this.pauseInFastMode;
    const topic = this.session.evaluateTopicEligibility(
      this.saveManager,
      topicId,
      skipFast,
      forceIfAlreadySeen
    );
    if (!topic) return false;
    this.hideTooltipPill();
    const startIdx = Math.min(
      topic.beats.length - 1,
      this.session.findFirstPendingBeat(topic.beats, 0)
    );
    return new Promise<boolean>((resolve) => {
      this.activePresenter = presenter;
      this.activeTokens = tokens;
      this.session.startTopic(topic, startIdx, false, resolve);
      this.session.applyModalDomVisibility(this.shell, 'card');
      this.session.syncInteractivity();
      this.renderActiveCard();
      this.shell.spotlight.startLoop(() => ({
        isCardOpen: this.isOpen() && this.session.mode === 'card',
        beat: this.getCurrentBeat(),
        isInteractive: this.hasActiveInteractiveStep(),
      }));
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
      this.saveManager.getSave()
    ) {
      this.saveManager.markTutorialSeen(this.session.activeTopic.id);
    }
    this.shell.spotlight.hide();
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
    if (this.saveManager.getSave()) this.saveManager.markTutorialSeen(topic.id);
    const prevResolve = this.resetCardState(false);
    this.activePresenter = 'advisor';
    this.session.startTopic(topic, 0, returnToCompendium, null);
    this.session.applyModalDomVisibility(this.shell, 'note');
    this.session.syncInteractivity();
    renderFieldNoteModalDom({
      noteWindowEl: this.shell.noteWindowEl,
      notePortraitView: this.shell.notePortraitView,
      topic,
      save: this.saveManager.getSave(),
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

  private stepBeatBackward(): void {
    if (this.session.mode !== 'card' || this.session.activeBeatIndex <= 0) return;
    if (this.hasActiveInteractiveStep()) return;
    this.typewriter.stop();
    this.session.goToBeat(this.session.activeBeatIndex - 1);
    this.audioManager.playSfx('dialogue_advance');
    this.renderActiveCard();
    this.onLayerStateChanged?.();
  }

  private handleCoachAdvanceTap(): void {
    if (this.session.mode !== 'card') return;
    if (this.typewriter.isAnimating()) {
      this.typewriter.completeImmediately();
      this.audioManager.playSfx('select');
      return;
    }
    if (this.hasActiveInteractiveStep()) return;

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

    this.advanceFromCurrentBeat('select');
  }

  private advanceFromCurrentBeat(finishSfx: 'cancel' | 'select'): void {
    this.typewriter.stop();
    const rawNext = this.session.activeBeatIndex + 1;
    const nextIdx =
      this.session.returnToCompendiumOnClose || rawNext <= this.session.furthestBeatIndex
        ? rawNext
        : this.session.findFirstPendingBeat(this.session.activeBeats, rawNext);
    if (nextIdx < this.session.activeBeats.length) {
      this.session.goToBeat(nextIdx);
      this.audioManager.playSfx('select');
      this.renderActiveCard();
      this.onLayerStateChanged?.();
      return;
    }
    this.dismissActiveCard(finishSfx);
  }

  private dismissActiveCard(sfx: 'cancel' | 'select'): void {
    const dismissedTopic = this.session.activeTopic;
    if (dismissedTopic && this.saveManager.getSave()) {
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

  private renderActiveCard(): void {
    const topic = this.session.activeTopic;
    const beat = this.session.activeBeats[this.session.activeBeatIndex];
    if (!topic || !beat) return;
    const interactive = this.hasActiveInteractiveStep();
    renderCoachCardWithTypewriter(
      {
        cardWindowEl: this.shell.cardWindowEl,
        coachPortraitView: this.shell.coachPortraitView,
        topic,
        beat,
        beatIndex: this.session.activeBeatIndex,
        totalBeats: this.session.activeBeats.length,
        isInteractive: interactive,
        returnToCompendiumOnClose: this.session.returnToCompendiumOnClose,
        save: this.saveManager.getSave(),
        presenter: this.activePresenter,
        tokens: this.activeTokens,
        signal: this.abortController.signal,
        onPrev: () => this.stepBeatBackward(),
        onNext: () => this.handleCoachAdvanceTap(),
      },
      this.typewriter,
      this.fastMode,
      () => this.audioManager.playSfx('typewriter_blip')
    );
    this.shell.spotlight.sync(beat, interactive);
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
    this.session.clearNudgeTimer();
    this.abortController.abort();
    this.shell.backdropEl.remove();
    this.shell.tooltipPillEl.remove();
  }
}
