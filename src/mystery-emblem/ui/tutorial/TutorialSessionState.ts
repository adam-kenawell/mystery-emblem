/**
 * Tutorial Active Session & Beat State Machine (`TutorialSessionState.ts`)
 */

import {
  getTutorialTopicById,
  type AdvisorTutorialBeat,
  type TutorialActionTriggerId,
  type TutorialBattleTileFilter,
  type TutorialTopicDefinition,
} from '../../data/tutorialRegistry';
import type { SaveStateManager } from '../../state/SaveStateManager';
import type { TutorialShellElements } from './TutorialShellView';

export interface TutorialActionAvailabilityContext {
  isActionAlreadyDone?: (action: TutorialActionTriggerId) => boolean;
  canPerformActionNow?: (action: TutorialActionTriggerId) => boolean;
}

export type ActiveTutorialModalMode = 'closed' | 'card' | 'compendium';

export class TutorialSessionState {
  public mode: ActiveTutorialModalMode = 'closed';
  public activeTopic: TutorialTopicDefinition | null = null;
  public activeBeats: ReadonlyArray<AdvisorTutorialBeat> = [];
  public activeBeatIndex = 0;
  /** Furthest beat reached this session; beats behind it are review beats (already satisfied). */
  public furthestBeatIndex = 0;
  public activeBeatInteractive = false;
  public returnToCompendiumOnClose = false;
  public activeCardResolver: ((shown: boolean) => void) | null = null;
  public availabilityProvider: TutorialActionAvailabilityContext | null = null;
  private nudgeTimer: number | null = null;

  public getCurrentBeat(): AdvisorTutorialBeat | null {
    return this.mode === 'card' ? this.activeBeats[this.activeBeatIndex] ?? null : null;
  }

  public syncInteractivity(): void {
    const beat =
      this.mode === 'card' && !this.returnToCompendiumOnClose
        ? this.activeBeats[this.activeBeatIndex] ?? null
        : null;
    if (!beat?.awaitAction || this.activeBeatIndex < this.furthestBeatIndex) {
      this.activeBeatInteractive = false;
      return;
    }
    this.activeBeatInteractive = this.availabilityProvider?.canPerformActionNow
      ? this.availabilityProvider.canPerformActionNow(beat.awaitAction)
      : true;
  }

  public getExpectedAction(isOpen: boolean): TutorialActionTriggerId | null {
    return isOpen && this.mode === 'card' && this.activeBeatInteractive
      ? this.getCurrentBeat()?.awaitAction ?? null
      : null;
  }

  public getActiveTileFilter(isOpen: boolean): TutorialBattleTileFilter | null {
    if (!this.getExpectedAction(isOpen)) return null;
    const spot = this.getCurrentBeat()?.spotlight;
    return spot?.kind === 'battle_tiles' ? spot.tileFilter : null;
  }

  public findFirstPendingBeat(beats: ReadonlyArray<AdvisorTutorialBeat>, fromIdx: number): number {
    let idx = fromIdx;
    while (idx < beats.length) {
      const candidate = beats[idx]!;
      if (
        candidate.awaitAction &&
        this.availabilityProvider?.isActionAlreadyDone?.(candidate.awaitAction)
      ) {
        idx += 1;
      } else {
        break;
      }
    }
    return idx;
  }

  public evaluateTopicEligibility(
    saveManager: SaveStateManager,
    topicId: string,
    skipForFastMode: boolean
  ): TutorialTopicDefinition | null {
    const save = saveManager.getSave();
    const topic = getTutorialTopicById(topicId);
    if (!save || !topic || topic.beats.length === 0) return null;
    saveManager.unlockTutorial(topic.id);
    if (!saveManager.areTutorialsEnabled()) return null;
    if (saveManager.hasSeenTutorial(topic.id)) return null;
    if (skipForFastMode) {
      saveManager.markTutorialSeen(topic.id);
      return null;
    }
    return topic;
  }

  public startTopic(
    topic: TutorialTopicDefinition,
    startIdx: number,
    returnToCompendium: boolean,
    resolver: ((shown: boolean) => void) | null
  ): void {
    this.activeTopic = topic;
    this.activeBeats = topic.beats;
    this.activeBeatIndex = startIdx;
    this.furthestBeatIndex = startIdx;
    this.returnToCompendiumOnClose = returnToCompendium;
    this.activeCardResolver = resolver;
  }

  public goToBeat(idx: number): void {
    this.activeBeatIndex = idx;
    if (idx > this.furthestBeatIndex) this.furthestBeatIndex = idx;
    this.syncInteractivity();
  }

  public applyModalDomVisibility(shell: TutorialShellElements, nextMode: ActiveTutorialModalMode): void {
    this.mode = nextMode;
    shell.backdropEl.classList.toggle('is-compendium-mode', nextMode === 'compendium');
    if (nextMode !== 'card') shell.backdropEl.classList.remove('is-interactive-passthrough');
    shell.cardWindowEl.hidden = nextMode !== 'card';
    shell.compendiumWindowEl.hidden = nextMode !== 'compendium';
    shell.backdropEl.hidden = nextMode === 'closed';
  }

  public triggerNudgeAnimation(cardWindowEl: HTMLElement): void {
    cardWindowEl.classList.remove('is-nudged');
    void cardWindowEl.offsetWidth;
    cardWindowEl.classList.add('is-nudged');
    if (this.nudgeTimer !== null) window.clearTimeout(this.nudgeTimer);
    this.nudgeTimer = window.setTimeout(() => {
      cardWindowEl.classList.remove('is-nudged');
      this.nudgeTimer = null;
    }, 420);
  }

  public clearNudgeTimer(): void {
    if (this.nudgeTimer !== null) {
      window.clearTimeout(this.nudgeTimer);
      this.nudgeTimer = null;
    }
  }

  public clearCardFields(): ((shown: boolean) => void) | null {
    const resolver = this.activeCardResolver;
    this.activeCardResolver = null;
    this.activeTopic = null;
    this.activeBeats = [];
    this.activeBeatIndex = 0;
    this.furthestBeatIndex = 0;
    this.activeBeatInteractive = false;
    this.returnToCompendiumOnClose = false;
    return resolver;
  }
}
