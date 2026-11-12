/**
 * Mystery Emblem - Quiz Welcome Popup & 8-Question Typewriter Options View
 */

import type { QuizOptionKey } from '../../data/quizData';
import { bindPointerTap } from '../pointerControls';

export function escapeQuizHtml(raw: string): string {
  return raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export interface QuizQuestionDescriptor {
  prompt: string;
  options: ReadonlyArray<{ id: QuizOptionKey; text: string }>;
  onSelectOption: (optId: QuizOptionKey) => void;
}

export function renderQuizWelcomePopup(
  stageEl: HTMLElement,
  opts: {
    ngPlusUnlocked: boolean;
    onBeginQuiz: () => void;
    onOpenNgPlusSelector: () => void;
  }
): void {
  const popup = document.createElement('div');
  popup.className = 'pmd-window';
  popup.dataset.testid = 'quiz-welcome-popup';
  popup.setAttribute('role', 'dialog');
  popup.setAttribute('aria-label', 'Welcome to Mystery Emblem');
  popup.style.cssText =
    'padding:clamp(10px, 2.2vw, 16px); display:flex; flex-direction:column; gap:10px;';

  const ngPlusBtnHtml = opts.ngPlusUnlocked
    ? `<button type="button" class="pmd-btn" data-testid="quiz-open-ngplus-btn" style="min-height:46px; padding:8px 14px;">New Game+ Picker</button>`
    : '';

  popup.innerHTML = `
    <h2 data-testid="quiz-welcome-title" style="margin:0; font-size:clamp(15px, 2.3vw, 19px); line-height:1.35; color:#f8f800;">
      Welcome to Mystery Emblem, a Pokémon × Fire Emblem fan game!
    </h2>
    <div data-testid="quiz-welcome-body" style="display:flex; flex-direction:column; gap:8px; font-size:clamp(13px, 1.9vw, 15px); line-height:1.45; color:#f8f8f8;">
      <p style="margin:0;">This is a demo that takes about <strong>1 hour</strong> to finish.</p>
      <p style="margin:0;"><strong>Sign in with Google</strong> to save your progress and keep playing on any device.</p>
      <p style="margin:0;">
        Follow the game's progress on my blog:
        <a href="https://adam.kenawell.family/blog/" target="_blank" rel="noopener noreferrer" data-testid="quiz-welcome-blog-link" style="color:#88d8ff;">adam.kenawell.family/blog</a>
      </p>
      <p style="margin:0;">At the end of the demo there's a short Google Form for feedback. All feedback helps, and I want this game to be the best it can be!</p>
      <p style="margin:0;">
        Answer a few questions to meet your hero.
      </p>
    </div>
    <div style="display:flex; justify-content:flex-end; flex-wrap:wrap; gap:8px; margin-top:2px;">
      ${ngPlusBtnHtml}
      <button type="button" class="pmd-btn pmd-btn-primary" data-testid="quiz-welcome-continue-btn" style="min-height:46px; padding:8px 18px;">
        Begin ▶
      </button>
    </div>
  `;

  bindPointerTap(popup.querySelector('[data-testid="quiz-welcome-continue-btn"]'), opts.onBeginQuiz, {
    stopPropagation: true,
  });
  if (opts.ngPlusUnlocked) {
    bindPointerTap(
      popup.querySelector('[data-testid="quiz-open-ngplus-btn"]'),
      opts.onOpenNgPlusSelector,
      { stopPropagation: true }
    );
  }

  stageEl.appendChild(popup);
}

export function renderQuizQuestionWindow(
  stageEl: HTMLElement,
  descriptor: QuizQuestionDescriptor,
  opts: {
    optionsRevealed: boolean;
    onStartTypewriter: (targetEl: HTMLElement, promptEl: HTMLElement, text: string) => void;
    onOptionTapped: (optId: QuizOptionKey) => void;
  }
): { promptEl: HTMLElement; advanceRowEl: HTMLElement } {
  const questionWin = document.createElement('div');
  questionWin.className = 'pmd-window pmd-quiz-dialogue-window';
  questionWin.dataset.testid = 'quiz-question-box';

  const promptP = document.createElement('p');
  promptP.dataset.testid = 'quiz-question-prompt';
  promptP.style.cssText =
    'margin:0; color:#f8f8f8; font-size:clamp(14px, 2.1vw, 17px); line-height:1.42; min-height:1.5em;';

  const advanceRow = document.createElement('div');
  advanceRow.className = 'pmd-quiz-advance-row';
  advanceRow.dataset.testid = 'quiz-question-advance-prompt';
  advanceRow.innerHTML = `<span class="pmd-quiz-advance-arrow">▼</span>`;

  questionWin.append(promptP, advanceRow);
  stageEl.appendChild(questionWin);

  if (opts.optionsRevealed) {
    promptP.textContent = descriptor.prompt;
    advanceRow.classList.add('is-collapsed');
    appendQuizQuestionOptionsWindow(stageEl, descriptor, opts.onOptionTapped);
  } else {
    opts.onStartTypewriter(promptP, advanceRow, descriptor.prompt);
  }

  return { promptEl: promptP, advanceRowEl: advanceRow };
}

export function appendQuizQuestionOptionsWindow(
  stageEl: HTMLElement,
  descriptor: QuizQuestionDescriptor,
  onOptionTapped: (optId: QuizOptionKey) => void
): void {
  const advanceRow = stageEl.querySelector<HTMLElement>('[data-testid="quiz-question-advance-prompt"]');
  if (advanceRow) advanceRow.classList.add('is-collapsed');
  if (stageEl.querySelector('[data-testid="quiz-options-window"]')) return;

  const optionsWin = document.createElement('div');
  optionsWin.className = 'pmd-window pmd-quiz-options-window';
  optionsWin.dataset.testid = 'quiz-options-window';

  const optStack = document.createElement('div');
  optStack.className = 'pmd-menu-list';
  optStack.style.cssText = 'display:flex; flex-direction:column; gap:0;';

  for (const [idx, opt] of descriptor.options.entries()) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `pmd-btn pmd-menu-row pmd-quiz-opt-btn${idx === 0 ? ' pmd-btn-primary' : ''}`;
    btn.dataset.testid = `quiz-option-${opt.id}`;
    btn.innerHTML = `<span>${escapeQuizHtml(opt.text)}</span>`;
    bindPointerTap(
      btn,
      () => {
        descriptor.onSelectOption(opt.id);
        onOptionTapped(opt.id);
      },
      { stopPropagation: true }
    );
    optStack.appendChild(btn);
  }

  optionsWin.appendChild(optStack);
  stageEl.appendChild(optionsWin);
}
