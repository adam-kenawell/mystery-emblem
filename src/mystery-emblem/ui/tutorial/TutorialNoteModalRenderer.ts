/**
 * Mystery Emblem - Single-Screen Field Note Reference Modal Renderer (`TutorialNoteModalRenderer.ts`)
 */

import { getItemById, getSpeciesById } from '../../data/index';
import {
  TUTORIAL_CATEGORY_LABELS,
  type TutorialTopicDefinition,
  type TutorialVisualChip,
} from '../../data/tutorialRegistry';
import { interpolateCampaignText, resolveSpeakerIdentity } from '../../engine/speakerResolver';
import type { SaveData } from '../../types/schemas';
import { createMiniItemIcon } from '../PmdItemIconGrid';
import type { PmdPortraitView } from '../PmdSpriteCanvas';
import { createPmdButton } from '../PmdWindow';
import { createColoredTypeSpan } from '../typeColors';

export interface RenderFieldNoteModalParams {
  noteWindowEl: HTMLElement;
  notePortraitView: PmdPortraitView;
  topic: TutorialTopicDefinition;
  save: SaveData | null;
  returnToCompendium: boolean;
  tokens?: Readonly<Record<string, string>>;
  signal: AbortSignal;
  onClose: () => void;
}

function buildVisualChipElement(chip: TutorialVisualChip): HTMLElement | null {
  if (chip.kind === 'type' && chip.pokemonType) {
    return createColoredTypeSpan(chip.pokemonType, 'pmd-tutorial-chip-type');
  }
  if (chip.kind === 'item' && chip.itemId) {
    const badge = document.createElement('span');
    badge.className = 'pmd-tutorial-chip-badge';
    badge.dataset.tone = chip.tone ?? 'cyan';
    const iconEl = createMiniItemIcon(chip.itemId, { sizePx: 18, decorative: true });
    const textEl = document.createElement('span');
    textEl.textContent = chip.label ?? getItemById(chip.itemId)?.name ?? chip.itemId;
    badge.append(iconEl, textEl);
    return badge;
  }
  if (chip.kind === 'species' && chip.speciesId) {
    const badge = document.createElement('span');
    badge.className = 'pmd-tutorial-chip-badge';
    badge.dataset.tone = chip.tone ?? 'green';
    badge.textContent = chip.label ?? getSpeciesById(chip.speciesId)?.name ?? chip.speciesId;
    return badge;
  }
  if (chip.kind === 'badge' && chip.label) {
    const badge = document.createElement('span');
    badge.className = 'pmd-tutorial-chip-badge';
    badge.dataset.tone = chip.tone ?? 'gold';
    badge.textContent = chip.label;
    return badge;
  }
  return null;
}

export function renderFieldNoteModalDom(params: RenderFieldNoteModalParams): void {
  const { noteWindowEl, notePortraitView, topic, save, returnToCompendium, signal, onClose } = params;
  noteWindowEl.innerHTML = '';
  noteWindowEl.dataset.topicId = topic.id;

  const advisor = resolveSpeakerIdentity({ kind: 'advisor' }, save);
  const emotion = topic.beats[0]?.emotion ?? 'Happy';

  const headerEl = document.createElement('div');
  headerEl.className = 'pmd-tutorial-header';

  const heroLeft = document.createElement('div');
  heroLeft.className = 'pmd-advisor-compendium-hero';

  const portraitBox = document.createElement('div');
  portraitBox.className = 'pmd-forecast-portrait-slot pmd-advisor-compendium-portrait';
  portraitBox.appendChild(notePortraitView.canvas);
  void notePortraitView.setPortrait({
    speciesIdOrAssetId: advisor.visualAssetId ?? advisor.pmdAssetId,
    emotion,
  });

  const titleCol = document.createElement('div');
  titleCol.className = 'pmd-tutorial-title-col';

  const metaRow = document.createElement('div');
  metaRow.className = 'pmd-tutorial-meta-row';

  const catBadge = document.createElement('span');
  catBadge.className = 'pmd-tutorial-step-badge';
  catBadge.textContent = TUTORIAL_CATEGORY_LABELS[topic.category];
  metaRow.appendChild(catBadge);

  const titleEl = document.createElement('h3');
  titleEl.className = 'pmd-tutorial-title';
  titleEl.dataset.testid = 'tutorial-note-title';
  titleEl.textContent = topic.title;

  titleCol.append(metaRow, titleEl);
  heroLeft.append(portraitBox, titleCol);

  const closeBtn = createPmdButton({
    label: returnToCompendium ? 'Back' : 'Close',
    className: 'pmd-tutorial-skip-btn',
    testId: 'tutorial-note-close-btn',
    onTap: onClose,
    tapOptions: { signal },
  });

  headerEl.append(heroLeft, closeBtn);
  noteWindowEl.appendChild(headerEl);

  const chips = topic.chips;
  if (chips && chips.length > 0) {
    const chipsRow = document.createElement('div');
    chipsRow.className = 'pmd-tutorial-note-chips';
    chipsRow.dataset.testid = 'tutorial-note-chips';
    for (const chip of chips) {
      const chipEl = buildVisualChipElement(chip);
      if (chipEl) chipsRow.appendChild(chipEl);
    }
    if (chipsRow.childElementCount > 0) {
      noteWindowEl.appendChild(chipsRow);
    }
  }

  const bulletsList = document.createElement('ul');
  bulletsList.className = 'pmd-tutorial-note-bullets';
  bulletsList.dataset.testid = 'tutorial-note-bullets';
  const bulletLines =
    topic.bullets && topic.bullets.length > 0 ? topic.bullets : [topic.summary];
  for (const rawLine of bulletLines) {
    const li = document.createElement('li');
    li.textContent = interpolateCampaignText(rawLine, save, undefined, params.tokens);
    bulletsList.appendChild(li);
  }
  noteWindowEl.appendChild(bulletsList);

  const quoteEl = document.createElement('p');
  quoteEl.className = 'pmd-tutorial-note-quote';
  quoteEl.dataset.testid = 'tutorial-note-quote';
  quoteEl.textContent = interpolateCampaignText(
    topic.beats[0]?.dialogue ?? topic.summary,
    save,
    undefined,
    params.tokens
  );
  noteWindowEl.appendChild(quoteEl);
}
