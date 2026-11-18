/**
 * Tutorial Active Session & Modal State (`TutorialSessionState.ts`)
 */

import {
  getTutorialTopicById,
  type AdvisorTutorialBeat,
  type TutorialTopicDefinition,
} from '../../data/tutorialRegistry';
import type { SaveStateManager } from '../../state/SaveStateManager';
import type { TutorialShellElements } from './TutorialShellView';

export type ActiveTutorialModalMode = 'closed' | 'card' | 'note' | 'compendium';

export class TutorialSessionState {
  public mode: ActiveTutorialModalMode = 'closed';
  public activeTopic: TutorialTopicDefinition | null = null;
  public activeBeats: ReadonlyArray<AdvisorTutorialBeat> = [];
  public activeBeatIndex = 0;
  public returnToCompendiumOnClose = false;
  public activeCardResolver: ((shown: boolean) => void) | null = null;

  public getCurrentBeat(): AdvisorTutorialBeat | null {
    return this.mode === 'card' ? this.activeBeats[this.activeBeatIndex] ?? null : null;
  }

  public evaluateTopicEligibility(
    saveManager: SaveStateManager,
    topicId: string,
    forceIfAlreadySeen = false
  ): TutorialTopicDefinition | null {
    const save = saveManager.getReadOnlySave();
    const topic = getTutorialTopicById(topicId);
    if (!save || !topic || topic.beats.length === 0) return null;
    saveManager.unlockTutorial(topic.id);
    if (!saveManager.areTutorialsEnabled()) return null;
    if (!forceIfAlreadySeen && saveManager.hasSeenTutorial(topic.id)) return null;
    return topic;
  }

  public startTopic(
    topic: TutorialTopicDefinition,
    returnToCompendium: boolean,
    resolver: ((shown: boolean) => void) | null
  ): void {
    this.activeTopic = topic;
    this.activeBeats = topic.beats;
    this.activeBeatIndex = 0;
    this.returnToCompendiumOnClose = returnToCompendium;
    this.activeCardResolver = resolver;
  }

  public applyModalDomVisibility(shell: TutorialShellElements, nextMode: ActiveTutorialModalMode): void {
    this.mode = nextMode;
    shell.backdropEl.classList.toggle(
      'is-compendium-mode',
      nextMode === 'compendium' || nextMode === 'note'
    );
    shell.cardWindowEl.hidden = nextMode !== 'card';
    shell.noteWindowEl.hidden = nextMode !== 'note';
    shell.compendiumWindowEl.hidden = nextMode !== 'compendium';
    shell.backdropEl.hidden = nextMode === 'closed';
  }

  public clearCardFields(): ((shown: boolean) => void) | null {
    const resolver = this.activeCardResolver;
    this.activeCardResolver = null;
    this.activeTopic = null;
    this.activeBeats = [];
    this.activeBeatIndex = 0;
    this.returnToCompendiumOnClose = false;
    return resolver;
  }
}
