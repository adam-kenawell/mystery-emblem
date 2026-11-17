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
  isInteractive: boolean;
  returnToCompendiumOnClose: boolean;
  save: SaveData | null;
  presenter?: TutorialPresenter;
  signal: AbortSignal;
  onPrev: () => void;
  onNext: () => void;
}

const ACTION_PROMPT_LABELS: Partial<Record<string, string>> = {
  battle_confirm_item: 'Tap Item',
  battle_open_heal_forecast: 'Tap Heal',
  battle_open_attack_forecast: 'Tap Attack',
  battle_confirm_wait: 'Tap Wait',
  battle_toggle_danger_area: 'Tap Danger Area',
  overworld_open_menu: 'Tap Menu',
};

function resolveActionPromptLabel(awaitAction: string | undefined): string {
  return (awaitAction && ACTION_PROMPT_LABELS[awaitAction]) || 'Your Move!';
}

function buildActionPromptBadge(beat: AdvisorTutorialBeat): HTMLElement {
  const badge = document.createElement('span');
  badge.className = 'pmd-tutorial-action-badge';
  badge.dataset.testid = 'tutorial-action-badge';
  badge.innerHTML = '<span></span><span class="pmd-dialogue-caret" aria-hidden="true">▼</span>';
  badge.firstElementChild!.textContent = resolveActionPromptLabel(beat.awaitAction);
  return badge;
}

function buildNavActionsRow(params: RenderCoachCardParams): HTMLElement {
  const { beatIndex, totalBeats, signal } = params;
  const actionArea = document.createElement('div');
  actionArea.className = 'pmd-advisor-actions';

  if (beatIndex > 0) {
    const prevBtn = document.createElement('button');
    prevBtn.type = 'button';
    prevBtn.className = 'pmd-dialogue-advance-btn pmd-tutorial-prev-btn';
    prevBtn.dataset.testid = 'tutorial-prev-btn';
    prevBtn.setAttribute('aria-label', 'Previous tip');
    prevBtn.innerHTML = '<span class="pmd-dialogue-caret" aria-hidden="true">◀</span>';
    bindPointerTap(prevBtn, () => params.onPrev(), { signal, stopPropagation: true });
    actionArea.appendChild(prevBtn);
  }

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

  const actorRow = createPmdWindow({
    variant: 'translucent',
    className: 'pmd-dialogue-actor-row pmd-dialogue-actor-row--left',
  });

  const portraitSlot = document.createElement('div');
  portraitSlot.className =
    'pmd-dialogue-portrait-slot pmd-dialogue-portrait-slot--left pmd-advisor-portrait-slot is-speaking';
  portraitSlot.dataset.testid = 'tutorial-advisor-portrait-slot';
  portraitSlot.appendChild(coachPortraitView.canvas);
  void coachPortraitView.setPortrait({
    speciesIdOrAssetId: advisor.visualAssetId ?? advisor.pmdAssetId,
    emotion,
  });

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

  const formattedDialogue = interpolateCampaignText(
    (isMentor && beat.mentorDialogue) || beat.dialogue,
    save
  );
  const bodyEl = document.createElement('div');
  bodyEl.className = 'pmd-dialogue-body';
  const textEl = document.createElement('p');
  textEl.className = 'pmd-dialogue-text pmd-advisor-speech-text';
  const speechEl = document.createElement('span');
  speechEl.className = 'pmd-dialogue-text-body';
  speechEl.dataset.testid = 'tutorial-dialogue-text';
  textEl.append(speakerName, speechEl);
  bodyEl.appendChild(textEl);
  bodyEl.appendChild(isInteractive ? buildActionPromptBadge(beat) : buildNavActionsRow(params));

  boxEl.appendChild(bodyEl);
  cardWindowEl.append(actorRow, boxEl);

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
    msPerTick: 16,
    charsPerTick: 2,
    instant: fastMode || prefersReducedMotionEnabled(),
    onTick: onTickSfx,
  });
}
