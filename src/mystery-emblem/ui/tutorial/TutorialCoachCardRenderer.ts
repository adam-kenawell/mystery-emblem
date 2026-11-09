/**
 * Mystery Emblem — Wimpod / Advisor Coach Bar DOM Renderer (`TutorialCoachCardRenderer.ts`)
 *
 * Uses central `speakerResolver.ts` (`resolveSpeakerIdentity` & `interpolateCampaignText`)
 * so portraits, flower colors, and advisor identity stay 100% synchronized.
 */

import { getSpeciesById } from '../../data/index';
import type {
  TutorialTopicDefinition,
  TutorialVisualChip,
  WimpodTutorialBeat,
} from '../../data/tutorialRegistry';
import { interpolateCampaignText, resolveSpeakerIdentity } from '../../engine/speakerResolver';
import type { SaveData } from '../../types/schemas';
import { createMiniItemIcon } from '../PmdItemIconGrid';
import type { PmdPortraitView } from '../PmdSpriteCanvas';
import { createMiniSpeciesPortrait } from '../PmdUnitPortraitGrid';
import { createPmdButton } from '../PmdWindow';
import { createColoredTypeSpan } from '../typeColors';
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
  onDismiss: () => void;
  onPrev: () => void;
  onNext: () => void;
}

export function renderTutorialVisualChip(
  chip: TutorialVisualChip,
  save: SaveData | null
): HTMLElement {
  if (chip.kind === 'type' && chip.pokemonType) {
    const pill = document.createElement('span');
    pill.className = 'pmd-tutorial-chip is-type';
    pill.appendChild(createColoredTypeSpan(chip.pokemonType));
    return pill;
  }

  if (chip.kind === 'item' && chip.itemId) {
    const pill = document.createElement('span');
    pill.className = 'pmd-tutorial-chip is-item';
    pill.appendChild(
      createMiniItemIcon(chip.itemId, {
        sizePx: 18,
        cropped: true,
        decorative: true,
      })
    );
    if (chip.label) {
      const txt = document.createElement('span');
      txt.textContent = chip.label;
      pill.appendChild(txt);
    }
    return pill;
  }

  if (chip.kind === 'species' && chip.speciesId) {
    const pill = document.createElement('span');
    pill.className = 'pmd-tutorial-chip is-species';
    const sp = getSpeciesById(chip.speciesId);
    const resolvedSpeaker = sp
      ? resolveSpeakerIdentity({ kind: 'species', speciesId: chip.speciesId }, save)
      : null;
    const resolvedPortraitId = resolvedSpeaker
      ? resolvedSpeaker.visualAssetId ?? resolvedSpeaker.pmdAssetId
      : chip.speciesId;
    pill.appendChild(
      createMiniSpeciesPortrait(resolvedPortraitId, {
        sizePx: 20,
        emotion: 'Happy',
        title: chip.label ?? sp?.name ?? chip.speciesId,
      })
    );
    const txt = document.createElement('span');
    txt.textContent = chip.label ?? sp?.name ?? chip.speciesId;
    pill.appendChild(txt);
    return pill;
  }

  const badge = document.createElement('span');
  const toneClass = chip.tone ? ` is-${chip.tone}` : ' is-cyan';
  badge.className = `pmd-tutorial-chip is-badge${toneClass}`;
  badge.textContent = chip.label ?? '';
  return badge;
}

export function renderCoachCardDom(params: RenderCoachCardParams): {
  speechEl: HTMLElement;
  formattedDialogue: string;
} {
  const {
    cardWindowEl,
    coachPortraitView,
    topic,
    beat,
    beatIndex,
    totalBeats,
    isInteractive,
    returnToCompendiumOnClose,
    save,
    signal,
  } = params;

  cardWindowEl.innerHTML = '';
  const isLastBeat = beatIndex >= totalBeats - 1;
  const advisor = resolveSpeakerIdentity({ kind: 'advisor' }, save);

  cardWindowEl.dataset.topicId = topic.id;
  cardWindowEl.dataset.beatId = beat.id;
  cardWindowEl.dataset.interactive = isInteractive ? 'true' : 'false';
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

  const topBar = document.createElement('div');
  topBar.className = 'pmd-wimpod-coach-topbar';

  const speakerMeta = document.createElement('div');
  speakerMeta.className = 'pmd-wimpod-speaker-meta';

  const speakerName = document.createElement('span');
  speakerName.className = 'pmd-dialogue-nickname pmd-wimpod-speaker-name';
  speakerName.dataset.testid = 'tutorial-speaker-name';
  speakerName.textContent = advisor.nickname;
  speakerMeta.appendChild(speakerName);

  const topicPill = document.createElement('span');
  topicPill.className = 'pmd-tutorial-domain-pill is-fusion';
  topicPill.dataset.testid = 'tutorial-card-title';
  topicPill.textContent = topic.title;
  speakerMeta.appendChild(topicPill);

  if (totalBeats > 1) {
    const stepBadge = document.createElement('span');
    stepBadge.className = 'pmd-tutorial-step-badge';
    stepBadge.dataset.testid = 'tutorial-step-indicator';
    stepBadge.textContent = `${beatIndex + 1} / ${totalBeats}`;
    speakerMeta.appendChild(stepBadge);
  }

  const skipBtn = createPmdButton({
    label: returnToCompendiumOnClose ? 'Back' : 'Skip',
    className: 'pmd-tutorial-skip-btn',
    testId: 'tutorial-skip-btn',
    ariaLabel: returnToCompendiumOnClose ? 'Back to Ask Wimpod' : 'Skip Tutorial',
    onTap: () => params.onDismiss(),
    tapOptions: { signal, stopPropagation: true },
  });

  topBar.append(speakerMeta, skipBtn);
  contentCol.appendChild(topBar);

  const formattedDialogue = interpolateCampaignText(beat.dialogue, save);
  const speechEl = document.createElement('p');
  speechEl.className = 'pmd-wimpod-speech-text';
  speechEl.dataset.testid = 'tutorial-dialogue-text';
  contentCol.appendChild(speechEl);

  const bottomStrip = document.createElement('div');
  bottomStrip.className = 'pmd-wimpod-bottom-strip';

  const chipsWrap = document.createElement('div');
  chipsWrap.className = 'pmd-tutorial-chips';
  chipsWrap.dataset.testid = 'tutorial-chips-row';
  if (beat.chips && beat.chips.length > 0) {
    for (const chip of beat.chips) {
      chipsWrap.appendChild(renderTutorialVisualChip(chip, save));
    }
  }
  bottomStrip.appendChild(chipsWrap);

  const actionArea = document.createElement('div');
  actionArea.className = 'pmd-wimpod-actions';

  if (isInteractive) {
    const hintPill = document.createElement('div');
    hintPill.className = 'pmd-wimpod-action-prompt';
    hintPill.dataset.testid = 'tutorial-action-prompt';
    hintPill.dataset.awaitAction = beat.awaitAction ?? '';
    const rawHint = beat.actionHint ?? 'Try it now!';
    hintPill.textContent = `▶ ${interpolateCampaignText(rawHint, save)}`;
    actionArea.appendChild(hintPill);
  } else {
    if (returnToCompendiumOnClose && totalBeats > 1 && beatIndex > 0) {
      actionArea.appendChild(
        createPmdButton({
          label: '◀ Prev',
          className: 'pmd-tutorial-nav-btn is-compact',
          testId: 'tutorial-prev-btn',
          onTap: () => params.onPrev(),
          tapOptions: { signal, stopPropagation: true },
        })
      );
    }

    const primaryLabel = isLastBeat
      ? returnToCompendiumOnClose
        ? 'Done'
        : 'Got It!'
      : 'Next ▼';
    actionArea.appendChild(
      createPmdButton({
        label: primaryLabel,
        variant: 'primary',
        className: 'pmd-tutorial-nav-btn is-primary is-compact',
        testId: 'tutorial-next-btn',
        onTap: () => params.onNext(),
        tapOptions: { signal, stopPropagation: true },
      })
    );
  }

  bottomStrip.appendChild(actionArea);
  contentCol.appendChild(bottomStrip);
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
