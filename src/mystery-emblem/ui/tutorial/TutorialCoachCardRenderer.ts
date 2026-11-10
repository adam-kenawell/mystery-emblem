/**
 * Mystery Emblem — Wimpod / Advisor Coach Bar DOM Renderer (`TutorialCoachCardRenderer.ts`)
 *
 * Uses central `speakerResolver.ts` (`resolveSpeakerIdentity` & `interpolateCampaignText`)
 * so portraits, flower colors, and advisor identity stay 100% synchronized.
 *
 * Minimal coach card: `[portrait] [name / typewriter text / ◀ Back · Next ▶]`.
 * Interactive (`awaitAction`) beats render zero buttons — the dialogue itself tells the
 * player what to tap. Topic titles, step badges, chips and action-hint pills are
 * intentionally NOT rendered here (the Ask-Wimpod compendium list still shows titles).
 */

import type { TutorialTopicDefinition, WimpodTutorialBeat } from '../../data/tutorialRegistry';
import { interpolateCampaignText, resolveSpeakerIdentity } from '../../engine/speakerResolver';
import type { SaveData } from '../../types/schemas';
import type { PmdPortraitView } from '../PmdSpriteCanvas';
import { createPmdButton } from '../PmdWindow';
import { TypewriterController, prefersReducedMotionEnabled } from '../typewriterController';

export interface RenderCoachCardParams {
  cardWindowEl: HTMLElement;
  coachPortraitView: PmdPortraitView;
  topic: TutorialTopicDefinition;
  beat: WimpodTutorialBeat;
  beatIndex: number;
  totalBeats: number;
  isInteractive: boolean;
  returnToCompendiumOnClose: boolean;
  save: SaveData | null;
  signal: AbortSignal;
  onPrev: () => void;
  onNext: () => void;
}

function resolvePrimaryNavLabel(isLastBeat: boolean, returnToCompendiumOnClose: boolean): string {
  if (!isLastBeat) return 'Next ▶';
  return returnToCompendiumOnClose ? 'Done' : 'Got It!';
}

function buildNavActionsRow(params: RenderCoachCardParams): HTMLElement {
  const { beatIndex, totalBeats, returnToCompendiumOnClose, signal } = params;
  const actionArea = document.createElement('div');
  actionArea.className = 'pmd-wimpod-actions';

  if (beatIndex > 0) {
    actionArea.appendChild(
      createPmdButton({
        label: '◀ Back',
        className: 'pmd-tutorial-nav-btn is-compact',
        testId: 'tutorial-prev-btn',
        ariaLabel: 'Previous tip',
        onTap: () => params.onPrev(),
        tapOptions: { signal, stopPropagation: true },
      })
    );
  }

  actionArea.appendChild(
    createPmdButton({
      label: resolvePrimaryNavLabel(beatIndex >= totalBeats - 1, returnToCompendiumOnClose),
      variant: 'primary',
      className: 'pmd-tutorial-nav-btn is-primary is-compact',
      testId: 'tutorial-next-btn',
      onTap: () => params.onNext(),
      tapOptions: { signal, stopPropagation: true },
    })
  );
  return actionArea;
}

export function renderCoachCardDom(params: RenderCoachCardParams): {
  speechEl: HTMLElement;
  formattedDialogue: string;
} {
  const { cardWindowEl, coachPortraitView, topic, beat, isInteractive, save } = params;

  cardWindowEl.innerHTML = '';
  const advisor = resolveSpeakerIdentity({ kind: 'advisor' }, save);

  cardWindowEl.dataset.topicId = topic.id;
  cardWindowEl.dataset.beatId = beat.id;
  cardWindowEl.dataset.interactive = isInteractive ? 'true' : 'false';
  cardWindowEl.dataset.awaitAction = isInteractive ? beat.awaitAction ?? '' : '';
  cardWindowEl.dataset.wimpodEmotion = beat.emotion;

  const layoutRow = document.createElement('div');
  layoutRow.className = 'pmd-wimpod-coach-row';

  const portraitSlot = document.createElement('div');
  portraitSlot.className = 'pmd-forecast-portrait-slot pmd-wimpod-portrait-slot';
  portraitSlot.dataset.testid = 'tutorial-wimpod-portrait-slot';
  portraitSlot.appendChild(coachPortraitView.canvas);
  void coachPortraitView.setPortrait({
    speciesIdOrAssetId: advisor.visualAssetId ?? advisor.pmdAssetId,
    emotion: beat.emotion,
  });
  layoutRow.appendChild(portraitSlot);

  const contentCol = document.createElement('div');
  contentCol.className = 'pmd-wimpod-coach-main';

  const speakerName = document.createElement('span');
  speakerName.className = 'pmd-dialogue-nickname pmd-wimpod-speaker-name';
  speakerName.dataset.testid = 'tutorial-speaker-name';
  speakerName.textContent = advisor.nickname;
  contentCol.appendChild(speakerName);

  const formattedDialogue = interpolateCampaignText(beat.dialogue, save);
  const speechEl = document.createElement('p');
  speechEl.className = 'pmd-wimpod-speech-text';
  speechEl.dataset.testid = 'tutorial-dialogue-text';
  contentCol.appendChild(speechEl);

  if (!isInteractive) contentCol.appendChild(buildNavActionsRow(params));

  layoutRow.appendChild(contentCol);
  cardWindowEl.appendChild(layoutRow);

  return { speechEl, formattedDialogue };
}

export function renderCoachCardWithTypewriter(
  params: RenderCoachCardParams,
  typewriter: TypewriterController,
  fastMode: boolean,
  onTickSfx: () => void
): void {
  const { speechEl, formattedDialogue } = renderCoachCardDom(params);
  typewriter.start({
    targetEl: speechEl,
    text: formattedDialogue,
    msPerTick: 12,
    charsPerTick: 2,
    instant: fastMode || prefersReducedMotionEnabled(),
    onTick: onTickSfx,
  });
}
