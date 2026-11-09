/**
 * Mystery Emblem — "Ask Wimpod" Survival Notes & Settings Control (`TutorialCompendiumRenderer.ts`)
 */

import type { AudioManager } from '../../audio/AudioManager';
import {
  TUTORIAL_CATEGORY_LABELS,
  TUTORIAL_CATEGORY_ORDER,
  TUTORIAL_TOPICS,
} from '../../data/tutorialRegistry';
import { resolveSpeakerIdentity } from '../../engine/speakerResolver';
import type { SaveStateManager } from '../../state/SaveStateManager';
import type { PmdPortraitView } from '../PmdSpriteCanvas';
import { createPmdButton } from '../PmdWindow';

export interface RenderTutorialSettingsControlOptions {
  signal?: AbortSignal;
  onAfterChange?: () => void;
  onOpenCompendium?: () => void;
}

export function renderTutorialCompendiumDom(params: {
  compendiumWindowEl: HTMLElement;
  compendiumPortraitView: PmdPortraitView;
  saveManager: SaveStateManager;
  signal: AbortSignal;
  onClose: () => void;
  onOpenTopic: (topicId: string) => void;
}): void {
  const { compendiumWindowEl, compendiumPortraitView, saveManager, signal } = params;
  compendiumWindowEl.innerHTML = '';

  const save = saveManager.getSave();
  const advisor = resolveSpeakerIdentity({ kind: 'advisor' }, save);
  const unlockedSet = new Set(saveManager.getUnlockedTutorialIds());
  const unlockedTopics = TUTORIAL_TOPICS.filter((t) => unlockedSet.has(t.id));

  const headerEl = document.createElement('div');
  headerEl.className = 'pmd-tutorial-header pmd-wimpod-compendium-header';

  const heroLeft = document.createElement('div');
  heroLeft.className = 'pmd-wimpod-compendium-hero';

  const portraitBox = document.createElement('div');
  portraitBox.className = 'pmd-forecast-portrait-slot pmd-wimpod-compendium-portrait';
  portraitBox.appendChild(compendiumPortraitView.canvas);
  void compendiumPortraitView.setPortrait({
    speciesIdOrAssetId: advisor.visualAssetId ?? advisor.pmdAssetId,
    emotion: unlockedTopics.length > 0 ? 'Happy' : 'Worried',
  });

  const titleCol = document.createElement('div');
  titleCol.className = 'pmd-tutorial-title-col';

  const metaRow = document.createElement('div');
  metaRow.className = 'pmd-tutorial-meta-row';

  const countBadge = document.createElement('span');
  countBadge.className = 'pmd-tutorial-step-badge';
  countBadge.dataset.testid = 'tutorial-compendium-count';
  countBadge.textContent = `${unlockedTopics.length} Notes`;
  metaRow.appendChild(countBadge);

  const titleEl = document.createElement('h3');
  titleEl.className = 'pmd-tutorial-title';
  titleEl.textContent = 'Ask Wimpod — Survival Notes';

  const subQuote = document.createElement('span');
  subQuote.className = 'pmd-wimpod-compendium-quote';
  subQuote.textContent =
    '“Psst! Forget how something works? Read my cowardly notes before an enemy spots us!”';

  titleCol.append(metaRow, titleEl, subQuote);
  heroLeft.append(portraitBox, titleCol);
  headerEl.appendChild(heroLeft);

  headerEl.appendChild(
    createPmdButton({
      label: 'Close',
      className: 'pmd-tutorial-skip-btn',
      testId: 'tutorial-compendium-close-btn',
      onTap: () => params.onClose(),
      tapOptions: { signal },
    })
  );
  compendiumWindowEl.appendChild(headerEl);

  const bodyEl = document.createElement('div');
  bodyEl.className = 'pmd-tutorial-compendium-body';

  if (unlockedTopics.length === 0) {
    const emptyEl = document.createElement('p');
    emptyEl.className = 'pmd-tutorial-empty-note';
    emptyEl.dataset.testid = 'tutorial-compendium-empty';
    emptyEl.textContent =
      'Wimpod hasn’t scribbled any survival notes yet—new notes unlock automatically as you encounter each mechanic!';
    bodyEl.appendChild(emptyEl);
  } else {
    for (const category of TUTORIAL_CATEGORY_ORDER) {
      const catTopics = unlockedTopics.filter((t) => t.category === category);
      if (catTopics.length === 0) continue;

      const sectionEl = document.createElement('div');
      sectionEl.className = 'pmd-tutorial-cat-section';

      const catTitle = document.createElement('div');
      catTitle.className = 'pmd-tutorial-cat-heading';
      catTitle.textContent = TUTORIAL_CATEGORY_LABELS[category];
      sectionEl.appendChild(catTitle);

      const listEl = document.createElement('div');
      listEl.className = 'pmd-menu-list pmd-tutorial-topic-list';

      for (const topic of catTopics) {
        const rowBtn = createPmdButton({
          label: '',
          menuRow: true,
          className: 'pmd-tutorial-topic-row',
          testId: `tutorial-guide-topic-${topic.id}`,
          ariaLabel: `Ask Wimpod about ${topic.title}`,
          onTap: () => params.onOpenTopic(topic.id),
          tapOptions: { signal },
        });

        const rowName = document.createElement('span');
        rowName.className = 'pmd-tutorial-topic-row-title';
        rowName.textContent = topic.title;

        const rowSummary = document.createElement('span');
        rowSummary.className = 'pmd-tutorial-topic-row-sub';
        rowSummary.textContent = topic.summary;

        rowBtn.append(rowName, rowSummary);
        listEl.appendChild(rowBtn);
      }

      sectionEl.appendChild(listEl);
      bodyEl.appendChild(sectionEl);
    }
  }

  compendiumWindowEl.appendChild(bodyEl);
}

export function renderTutorialSettingsControlDom(params: {
  saveManager: SaveStateManager;
  audioManager: AudioManager;
  defaultSignal: AbortSignal;
  options?: RenderTutorialSettingsControlOptions;
  onOpenCompendiumModal: () => void;
}): HTMLElement {
  const { saveManager, audioManager, options } = params;
  const signal = options?.signal ?? params.defaultSignal;
  const hasSave = Boolean(saveManager.getSave());
  const enabled = hasSave ? saveManager.areTutorialsEnabled() : true;
  const unlockedCount = saveManager.getUnlockedTutorialIds().length;

  const wrap = document.createElement('div');
  wrap.className = 'pmd-tutorial-settings-block';
  wrap.dataset.testid = 'tutorial-settings-panel';

  const prefRow = document.createElement('div');
  prefRow.className = 'pmd-tutorial-pref-row';

  const lbl = document.createElement('span');
  lbl.className = 'pmd-tutorial-pref-label';
  lbl.textContent = "Wimpod's Tutorials";

  const chipGroup = document.createElement('div');
  chipGroup.className = 'pmd-tutorial-pref-chips';

  const onBtn = createPmdButton({
    label: 'On',
    variant: enabled ? 'primary' : 'default',
    className: `pmd-tutorial-pref-chip${enabled ? ' is-active' : ''}`,
    testId: 'tutorial-toggle-on',
    ariaLabel: "Wimpod's Tutorials: On",
    onTap: () => {
      if (!saveManager.getSave()) return;
      audioManager.playSfx('select');
      saveManager.setTutorialsEnabled(true);
      syncToggleUi(true);
      options?.onAfterChange?.();
    },
    tapOptions: { signal },
  });

  const offBtn = createPmdButton({
    label: 'Off',
    variant: !enabled ? 'primary' : 'default',
    className: `pmd-tutorial-pref-chip${!enabled ? ' is-active' : ''}`,
    testId: 'tutorial-toggle-off',
    ariaLabel: "Wimpod's Tutorials: Off",
    onTap: () => {
      if (!saveManager.getSave()) return;
      audioManager.playSfx('select');
      saveManager.setTutorialsEnabled(false);
      syncToggleUi(false);
      options?.onAfterChange?.();
    },
    tapOptions: { signal },
  });

  const syncToggleUi = (isOn: boolean) => {
    onBtn.classList.toggle('is-active', isOn);
    onBtn.classList.toggle('pmd-btn-primary', isOn);
    onBtn.setAttribute('aria-pressed', isOn ? 'true' : 'false');

    offBtn.classList.toggle('is-active', !isOn);
    offBtn.classList.toggle('pmd-btn-primary', !isOn);
    offBtn.setAttribute('aria-pressed', !isOn ? 'true' : 'false');
  };

  onBtn.disabled = !hasSave;
  offBtn.disabled = !hasSave;
  syncToggleUi(enabled);

  chipGroup.append(onBtn, offBtn);
  prefRow.append(lbl, chipGroup);
  wrap.appendChild(prefRow);

  const footerRow = document.createElement('div');
  footerRow.className = 'pmd-tutorial-settings-actions';

  const noteEl = document.createElement('span');
  noteEl.className = 'pmd-tutorial-settings-note';
  noteEl.textContent = hasSave
    ? 'Wimpod coaches new mechanics from cover.'
    : 'Start a campaign save to customize tutorials.';

  const guideBtn = createPmdButton({
    label: `Ask Wimpod (${unlockedCount})`,
    className: 'pmd-tutorial-open-guide-btn',
    testId: 'btn-open-tutorial-guide',
    onTap: () => {
      options?.onOpenCompendium?.();
      params.onOpenCompendiumModal();
    },
    tapOptions: { signal },
  });
  guideBtn.disabled = !hasSave;

  footerRow.append(noteEl, guideBtn);
  wrap.appendChild(footerRow);
  return wrap;
}
