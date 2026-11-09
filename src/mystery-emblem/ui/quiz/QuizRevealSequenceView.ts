/**
 * Mystery Emblem — 4-Beat Sequential Dragon Lord Aura Reveal View
 */

import { getPersonalSkillById, getSpeciesById } from '../../data/index';
import { getDragonLordTraitInfo, type DragonLordSpeciesId } from '../../data/quizData';
import { PmdPortraitView } from '../PmdSpriteCanvas';
import { bindPointerTap } from '../pointerControls';
import { renderColoredTypesHtml } from '../typeColors';
import { escapeQuizHtml } from './QuizWelcomeAndQuestionsView';

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
  const skill = sp ? getPersonalSkillById(sp.personalSkillId) : undefined;
  const isLordRevealed = opts.revealBeat >= 3;

  if (isLordRevealed) {
    const heroCard = document.createElement('div');
    heroCard.className = 'pmd-window';
    heroCard.dataset.testid = 'quiz-lord-hero-card';
    heroCard.style.cssText =
      'display:flex; gap:10px; align-items:center; flex-wrap:wrap; padding:6px 10px; flex-shrink:0;';
    heroCard.innerHTML = `
      <div class="pmd-forecast-portrait-slot" data-quiz-lord-portrait data-testid="quiz-lord-portrait"></div>
      <div style="flex:1; min-width:180px;">
        <div style="font-size:15px; font-weight:700; color:#f8f800;">
          ${escapeQuizHtml(sp?.name ?? lordMeta.name)}
        </div>
        <div style="font-size:12px; color:#a8e0f8; margin-top:2px;" data-testid="quiz-lord-types">
          ${renderColoredTypesHtml(sp?.types ?? ['Dragon'], ' / ')} · ${escapeQuizHtml(lordMeta.traitLabel)}
        </div>
        <div style="margin-top:3px; font-size:12px; color:#58f858;">
          <strong>${escapeQuizHtml(skill?.name ?? 'Dragon Aura')}</strong>: ${escapeQuizHtml(skill?.description ?? '+2 Atk/SpA, +10 Hit within 2 tiles.')}
        </div>
      </div>
    `;

    heroCard.querySelector('[data-quiz-lord-portrait]')!.appendChild(opts.portraitView.canvas);
    void opts.portraitView.setPortrait({
      speciesIdOrAssetId: lordMeta.speciesId,
      emotion: 'Happy',
    });
    stageEl.appendChild(heroCard);
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
      `With that said, you must be... ${lordMeta.indefiniteArticle} ${speciesName}!`
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
      'Now go forth and help save the world from certain destruction!'
    );
  }

  return { revealTextEl: textEl, promptRowEl };
}
