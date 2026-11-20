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
import {
  interpolateCampaignText,
  resolveSpeakerIdentity,
  type ResolvedSpeakerIdentity,
} from '../../engine/speakerResolver';
import type { SaveData } from '../../types/schemas';
import type { PmdPortraitView } from '../PmdSpriteCanvas';
import { createPmdWindow } from '../PmdWindow';
import { bindPointerTap } from '../pointerControls';
import { TypewriterController, prefersReducedMotionEnabled } from '../typewriterController';

export interface RenderCoachCardParams {
  cardWindowEl: HTMLElement;
  coachPortraitView: PmdPortraitView;
  topic: TutorialTopicDefinition;
  beat: AdvisorTutorialBeat;
  beatIndex: number;
  totalBeats: number;
  save: SaveData | null;
  presenter?: TutorialPresenter;
  tokens?: Readonly<Record<string, string>>;
  signal: AbortSignal;
  onNext: () => void;
}

function buildNavActionsRow(params: RenderCoachCardParams): HTMLElement {
  const { beatIndex, totalBeats, signal } = params;
  const actionArea = document.createElement('div');
  actionArea.className = 'pmd-advisor-actions';

  const isLastBeat = beatIndex >= totalBeats - 1;
  const nextBtn = document.createElement('button');
  nextBtn.type = 'button';
  nextBtn.className = 'pmd-dialogue-advance-btn pmd-tutorial-next-btn';
  nextBtn.dataset.testid = 'tutorial-next-btn';
  nextBtn.setAttribute('aria-label', isLastBeat ? 'Finish tip' : 'Next tip');
  nextBtn.innerHTML = '<span class="pmd-dialogue-caret" aria-hidden="true">▼</span>';
  bindPointerTap(nextBtn, () => params.onNext(), { signal, stopPropagation: true });
  actionArea.appendChild(nextBtn);
  return actionArea;
}

export function renderCoachCardDom(
  params: RenderCoachCardParams,
  resolvedAdvisor?: ResolvedSpeakerIdentity
): {
  speechEl: HTMLElement;
  formattedDialogue: string;
} {
  const { cardWindowEl, coachPortraitView, topic, beat, save } = params;
  const isMentor = params.presenter === 'mentor';
  const emotion = beat.emotion;
  const advisor =
    resolvedAdvisor ?? resolveSpeakerIdentity({ kind: isMentor ? 'mentor' : 'advisor' }, save);

  cardWindowEl.innerHTML = '';
  cardWindowEl.dataset.topicId = topic.id;
  cardWindowEl.dataset.beatId = beat.id;
  cardWindowEl.dataset.presenter = isMentor ? 'mentor' : 'advisor';
  cardWindowEl.dataset.advisorEmotion = emotion;

  const actorRow = createPmdWindow({
    variant: 'translucent',
    className: 'pmd-dialogue-actor-row pmd-dialogue-actor-row--left',
  });

  const portraitSlot = document.createElement('div');
  portraitSlot.className =
    'pmd-dialogue-portrait-slot pmd-dialogue-portrait-slot--left pmd-advisor-portrait-slot is-speaking';
  portraitSlot.dataset.testid = 'tutorial-advisor-portrait-slot';
  portraitSlot.appendChild(coachPortraitView.canvas);
  if (!resolvedAdvisor) {
    void coachPortraitView.setPortrait({
      speciesIdOrAssetId: advisor.visualAssetId ?? advisor.pmdAssetId,
      emotion,
    });
  }

  const speakerName = document.createElement('span');
  speakerName.className = 'pmd-dialogue-nickname pmd-advisor-speaker-name';
  speakerName.dataset.testid = 'tutorial-speaker-name';
  speakerName.textContent = `${advisor.nickname}: `;

  actorRow.append(portraitSlot);

  const boxEl = createPmdWindow({
    variant: 'translucent',
    className: 'pmd-dialogue-box pmd-tutorial-dialogue-box',
    testId: 'tutorial-dialogue-box',
  });

  const formattedDialogue = interpolateCampaignText(beat.dialogue, save, undefined, params.tokens);
  const bodyEl = document.createElement('div');
  bodyEl.className = 'pmd-dialogue-body';
  const textEl = document.createElement('p');
  textEl.className = 'pmd-dialogue-text pmd-advisor-speech-text';
  const speechEl = document.createElement('span');
  speechEl.className = 'pmd-dialogue-text-body';
  speechEl.dataset.testid = 'tutorial-dialogue-text';
  textEl.append(speakerName, speechEl);
  bodyEl.appendChild(textEl);
  bodyEl.appendChild(buildNavActionsRow(params));

  boxEl.appendChild(bodyEl);
  cardWindowEl.append(actorRow, boxEl);

  return { speechEl, formattedDialogue };
}

export async function renderCoachCardWithTypewriter(
  params: RenderCoachCardParams,
  typewriter: TypewriterController,
  onTickSfx: () => void,
  isStale?: () => boolean
): Promise<boolean> {
  const isMentor = params.presenter === 'mentor';
  const advisor = resolveSpeakerIdentity({ kind: isMentor ? 'mentor' : 'advisor' }, params.save);
  await params.coachPortraitView.setPortrait({
    speciesIdOrAssetId: advisor.visualAssetId ?? advisor.pmdAssetId,
    emotion: params.beat.emotion,
  });
  if (isStale?.()) return false;

  const { speechEl, formattedDialogue } = renderCoachCardDom(params, advisor);
  typewriter.start({
    targetEl: speechEl,
    text: formattedDialogue,
    msPerTick: 16,
    charsPerTick: 2,
    instant: prefersReducedMotionEnabled(),
    onTick: onTickSfx,
  });
  return true;
}
