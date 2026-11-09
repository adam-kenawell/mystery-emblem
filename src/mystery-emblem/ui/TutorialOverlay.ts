/**
 * Mystery Emblem — Wimpod Interactive Advisor Coordinator (`TutorialOverlay.ts`)
 */

import { getAudioManager, type AudioManager } from '../audio/AudioManager';
import {
  getTutorialTopicById,
  type TutorialActionTriggerId,
  type TutorialBattleTileFilter,
  type WimpodTutorialBeat,
} from '../data/tutorialRegistry';
import type { SaveStateManager } from '../state/SaveStateManager';
import { renderCoachCardWithTypewriter } from './tutorial/TutorialCoachCardRenderer';
import {
  renderTutorialCompendiumDom,
  renderTutorialSettingsControlDom,
  type RenderTutorialSettingsControlOptions,
} from './tutorial/TutorialCompendiumRenderer';
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
        else if (this.session.mode === 'compendium') this.handleBack();
      },
      onCardBodyTap: () => this.handleCoachAdvanceTap(),
      onBackGesture: () => this.handleBack(),
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

  public getCurrentBeat(): WimpodTutorialBeat | null {
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

  public presentTopicIfNeeded(topicId: string, opts?: { sceneFastMode?: boolean }): Promise<boolean> {
    const next = this.presentationQueue.then(() =>
      this.runTopicPresentation(topicId, Boolean(opts?.sceneFastMode))
    );
    this.presentationQueue = next.catch(() => false);
    return next;
  }

  private async runTopicPresentation(topicId: string, sceneFastMode: boolean): Promise<boolean> {
    const skipFast = (this.fastMode || sceneFastMode) && !this.pauseInFastMode;
    const topic = this.session.evaluateTopicEligibility(this.saveManager, topicId, skipFast);
    if (!topic) return false;
    const startIdx = Math.min(
      topic.beats.length - 1,
      this.session.findFirstPendingBeat(topic.beats, 0)
    );
    return new Promise<boolean>((resolve) => {
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
    const prevResolve = this.resetCardState(Boolean(this.session.activeCardResolver));
    this.session.applyModalDomVisibility(this.shell, 'compendium');
    this.renderCompendium();
    this.audioManager.playSfx('select');
    this.onLayerStateChanged?.();
    prevResolve?.(true);
  }

  public openTopicFromCompendium(topicId: string): void {
    const topic = getTutorialTopicById(topicId);
    if (!topic || topic.beats.length === 0) return;
    if (this.saveManager.getSave()) this.saveManager.markTutorialSeen(topic.id);
    this.session.startTopic(topic, 0, true, null);
    this.session.applyModalDomVisibility(this.shell, 'card');
    this.session.syncInteractivity();
    this.renderActiveCard();
    this.audioManager.playSfx('select');
    this.onLayerStateChanged?.();
  }

  public handleBack(): boolean {
    if (!this.isOpen()) return false;
    if (this.session.mode === 'card') {
      if (this.session.returnToCompendiumOnClose && this.session.activeBeatIndex > 0) {
        this.stepBeatBackward();
        return true;
      }
      this.dismissActiveCard('cancel');
      return true;
    }
    this.closeAll('cancel');
    return true;
  }

  public closeAll(sfx: 'cancel' | 'select' | null = null): void {
    const resolver = this.resetCardState(true);
    this.session.applyModalDomVisibility(this.shell, 'closed');
    if (sfx) this.audioManager.playSfx(sfx);
    this.onLayerStateChanged?.();
    resolver?.(true);
  }

  private stepBeatBackward(): void {
    if (this.session.activeBeatIndex <= 0) return;
    this.session.activeBeatIndex -= 1;
    this.session.syncInteractivity();
    this.audioManager.playSfx('dialogue_advance');
    this.renderActiveCard();
  }

  private handleCoachAdvanceTap(): void {
    if (this.session.mode !== 'card') return;
    if (this.typewriter.isAnimating()) {
      this.typewriter.completeImmediately();
      this.audioManager.playSfx('select');
    } else if (!this.hasActiveInteractiveStep()) {
      this.advanceFromCurrentBeat('select');
    }
  }

  private advanceFromCurrentBeat(finishSfx: 'cancel' | 'select'): void {
    this.typewriter.stop();
    const rawNext = this.session.activeBeatIndex + 1;
    const nextIdx = this.session.returnToCompendiumOnClose
      ? rawNext
      : this.session.findFirstPendingBeat(this.session.activeBeats, rawNext);
    if (nextIdx < this.session.activeBeats.length) {
      this.session.activeBeatIndex = nextIdx;
      this.session.syncInteractivity();
      this.audioManager.playSfx('select');
      this.renderActiveCard();
      this.onLayerStateChanged?.();
      return;
    }
    this.dismissActiveCard(finishSfx);
  }

  private dismissActiveCard(sfx: 'cancel' | 'select'): void {
    if (this.session.activeTopic && this.saveManager.getSave()) {
      this.saveManager.markTutorialSeen(this.session.activeTopic.id);
    }
    const reopen = this.session.returnToCompendiumOnClose;
    const resolver = this.resetCardState(false);
    this.session.applyModalDomVisibility(this.shell, reopen ? 'compendium' : 'closed');
    if (reopen) this.renderCompendium();
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
        signal: this.abortController.signal,
        onDismiss: () => this.dismissActiveCard('cancel'),
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
    this.session.clearNudgeTimer();
    this.abortController.abort();
    this.shell.backdropEl.remove();
  }
}
