/**
 * Mystery Emblem - Quaquaval Coach Bar DOM Renderer (`TutorialCoachCardRenderer.ts`)
 *
 * Uses central `speakerResolver.ts` (`resolveSpeakerIdentity` & `interpolateCampaignText`)
 * so portraits and nicknames stay 100% synchronized.
 */

import type {
  AdvisorTutorialBeat,
  TutorialPresenter,
  TutorialTopicDefinition,
} from '../../data/tutorialRegistry';
import { interpolateCampaignText, resolveSpeakerIdentity } from '../../engine/speakerResolver';
import type { SaveData } from '../../types/schemas';
import type { PmdPortraitView } from '../PmdSpriteCanvas';
import { createPmdButton } from '../PmdWindow';
import { TypewriterController, prefersReducedMotionEnabled } from '../typewriterController';

export interface RenderCoachCardParams {
  cardWindowEl: HTMLElement;
  coachPortraitView: PmdPortraitView;
  topic: TutorialTopicDefinition;
  beat: AdvisorTutorialBeat;
  beatIndex: number;
  totalBeats: number;
  isInteractive: boolean;
  returnToCompendiumOnClose: boolean;
  save: SaveData | null;
  presenter?: TutorialPresenter;
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
  actionArea.className = 'pmd-advisor-actions';

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
  const isMentor = params.presenter === 'mentor';
  const emotion = (isMentor && beat.mentorEmotion) || beat.emotion;

  cardWindowEl.innerHTML = '';
  const advisor = resolveSpeakerIdentity({ kind: isMentor ? 'mentor' : 'advisor' }, save);

  cardWindowEl.dataset.topicId = topic.id;
  cardWindowEl.dataset.beatId = beat.id;
  cardWindowEl.dataset.presenter = isMentor ? 'mentor' : 'advisor';
  cardWindowEl.dataset.interactive = isInteractive ? 'true' : 'false';
  cardWindowEl.dataset.awaitAction = isInteractive ? beat.awaitAction ?? '' : '';
  cardWindowEl.dataset.advisorEmotion = emotion;

  const layoutRow = document.createElement('div');
  layoutRow.className = 'pmd-advisor-coach-row';

  const portraitSlot = document.createElement('div');
  portraitSlot.className = 'pmd-forecast-portrait-slot pmd-advisor-portrait-slot';
  portraitSlot.dataset.testid = 'tutorial-advisor-portrait-slot';
  portraitSlot.appendChild(coachPortraitView.canvas);
  void coachPortraitView.setPortrait({
    speciesIdOrAssetId: advisor.visualAssetId ?? advisor.pmdAssetId,
    emotion,
  });
  layoutRow.appendChild(portraitSlot);

  const contentCol = document.createElement('div');
  contentCol.className = 'pmd-advisor-coach-main';

  const speakerName = document.createElement('span');
  speakerName.className = 'pmd-dialogue-nickname pmd-advisor-speaker-name';
  speakerName.dataset.testid = 'tutorial-speaker-name';
  speakerName.textContent = advisor.nickname;
  contentCol.appendChild(speakerName);

  const formattedDialogue = interpolateCampaignText(
    (isMentor && beat.mentorDialogue) || beat.dialogue,
    save
  );
  const speechEl = document.createElement('p');
  speechEl.className = 'pmd-advisor-speech-text';
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
