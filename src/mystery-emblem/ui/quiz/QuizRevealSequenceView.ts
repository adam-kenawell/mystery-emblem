/**
 * Mystery Emblem - 4-Beat Sequential Dragon Lord Aura Reveal View
 */

import { getSpeciesById } from '../../data/index';
import { getDragonLordTraitInfo, type DragonLordSpeciesId } from '../../data/quizData';
import { PmdPortraitView } from '../PmdSpriteCanvas';
import { bindPointerTap } from '../pointerControls';

export type QuizRevealBeat = 0 | 1 | 2 | 3 | 4;

export function renderQuizLordRevealView(
  stageEl: HTMLElement,
  opts: {
    selectedLordSpeciesId: DragonLordSpeciesId;
    revealBeat: QuizRevealBeat;
    portraitView: PmdPortraitView;
    onStartTypewriter: (
      targetEl: HTMLElement,
      promptEl: HTMLElement,
      prefixText: string,
      rollText: string
    ) => void;
    onAcceptAdventure: () => void;
  }
): { revealTextEl: HTMLElement; promptRowEl: HTMLElement } {
  const lordMeta = getDragonLordTraitInfo(opts.selectedLordSpeciesId);
  const sp = getSpeciesById(lordMeta.speciesId);
  const isLordRevealed = opts.revealBeat >= 3;

  if (isLordRevealed) {
    const heroPortrait = document.createElement('div');
    heroPortrait.dataset.testid = 'quiz-lord-hero-card';
    heroPortrait.style.cssText = 'display:flex; justify-content:center; flex-shrink:0;';
    heroPortrait.innerHTML = `<div class="pmd-forecast-portrait-slot pmd-quiz-lord-portrait-slot" data-quiz-lord-portrait data-testid="quiz-lord-portrait"></div>`;

    heroPortrait.querySelector('[data-quiz-lord-portrait]')!.appendChild(opts.portraitView.canvas);
    void opts.portraitView.setPortrait({
      speciesIdOrAssetId: lordMeta.speciesId,
      emotion: 'Happy',
    });
    stageEl.appendChild(heroPortrait);
  }

  const dialogueBox = document.createElement('div');
  dialogueBox.className = 'pmd-window pmd-quiz-dialogue-window';
  dialogueBox.dataset.testid = 'quiz-reveal-box';
  dialogueBox.dataset.revealBeat = String(opts.revealBeat);

  const textEl = document.createElement('div');
  const promptRowEl = document.createElement('div');
  promptRowEl.className = 'pmd-quiz-advance-row';
  promptRowEl.dataset.testid = 'quiz-reveal-advance-prompt';
  promptRowEl.innerHTML = `<span class="pmd-quiz-advance-arrow">▼</span>`;

  if (opts.revealBeat === 0 || opts.revealBeat === 1) {
    textEl.dataset.testid = 'quiz-personality-headline';
    textEl.style.cssText =
      'font-size:clamp(15px, 2.3vw, 18px); font-weight:700; color:#f8f800; line-height:1.42; min-height:1.5em;';
    dialogueBox.append(textEl, promptRowEl);
    stageEl.appendChild(dialogueBox);

    if (opts.revealBeat === 0) {
      opts.onStartTypewriter(textEl, promptRowEl, '', 'You appear to be...');
    } else {
      opts.onStartTypewriter(
        textEl,
        promptRowEl,
        'You appear to be...',
        ` the ${lordMeta.personalityTitle} type!`
      );
    }
  } else if (opts.revealBeat === 2) {
    textEl.dataset.testid = 'quiz-personality-description';
    textEl.style.cssText =
      'margin:0; font-size:clamp(13px, 2vw, 15px); line-height:1.48; color:#f8f8f8; min-height:3em;';
    dialogueBox.append(textEl, promptRowEl);
    stageEl.appendChild(dialogueBox);
    opts.onStartTypewriter(textEl, promptRowEl, '', lordMeta.personalityDescription);
  } else if (opts.revealBeat === 3) {
    const speciesName = sp?.name ?? lordMeta.name;
    textEl.dataset.testid = 'quiz-revealed-lord-name';
    textEl.style.cssText =
      'font-size:clamp(15px, 2.3vw, 18px); font-weight:700; color:#f8f800; line-height:1.42; min-height:1.5em;';
    dialogueBox.append(textEl, promptRowEl);
    stageEl.appendChild(dialogueBox);
    opts.onStartTypewriter(
      textEl,
      promptRowEl,
      '',
      `So you must be... ${lordMeta.indefiniteArticle} ${speciesName}!`
    );
  } else {
    textEl.dataset.testid = 'quiz-reveal-farewell';
    textEl.style.cssText =
      'font-size:clamp(14px, 2.1vw, 17px); font-weight:700; color:#f8f8f8; line-height:1.42; min-height:1.5em;';
    promptRowEl.innerHTML = `<span class="pmd-quiz-advance-arrow">▶</span>`;
    dialogueBox.append(textEl, promptRowEl);
    stageEl.appendChild(dialogueBox);

    const actionRow = document.createElement('div');
    actionRow.style.cssText = 'display:flex; justify-content:flex-end; flex-shrink:0;';
    actionRow.innerHTML = `
      <button type="button" class="pmd-btn pmd-btn-primary" data-testid="quiz-accept-lord-btn" style="min-height:46px; padding:8px 16px;">
        Begin Adventure ▶
      </button>
    `;
    bindPointerTap(
      actionRow.querySelector('[data-testid="quiz-accept-lord-btn"]'),
      opts.onAcceptAdventure,
      { stopPropagation: true }
    );
    stageEl.appendChild(actionRow);

    opts.onStartTypewriter(
      textEl,
      promptRowEl,
      '',
      'Now go. A world on the brink is waiting for you.'
    );
  }

  return { revealTextEl: textEl, promptRowEl };
}
