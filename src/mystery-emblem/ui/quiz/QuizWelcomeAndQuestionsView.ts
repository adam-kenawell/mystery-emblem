/**
 * Mystery Emblem - Quiz Welcome Popup & 8-Question Typewriter Options View
 */

import type { QuizOptionKey } from '../../data/quizData';
import { bindPointerTap } from '../pointerControls';
import { escapeHtml as escapeQuizHtml } from '../typeColors';
export { escapeQuizHtml };

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
  popup.className = 'pmd-window pmd-quiz-welcome-popup';
  popup.dataset.testid = 'quiz-welcome-popup';
  popup.setAttribute('role', 'dialog');
  popup.setAttribute('aria-label', 'Welcome to Pokémon: Mystery Emblem!');

  const ngPlusBtnHtml = opts.ngPlusUnlocked
    ? `<button type="button" class="pmd-btn" data-testid="quiz-open-ngplus-btn" style="min-height:46px; padding:8px 14px;">New Game+ Picker</button>`
    : '';

  popup.innerHTML = `
    <header class="pmd-quiz-welcome-header">
      <h2 data-testid="quiz-welcome-title" class="pmd-quiz-welcome-title">
        Welcome to Pokémon: Mystery Emblem!
      </h2>
      <p data-testid="quiz-welcome-disclaimer" class="pmd-quiz-welcome-disclaimer">
        This is a <span class="pmd-quiz-hl-white">free fan game</span>. I will not make any money on this game, and I am not affiliated with Nintendo.
      </p>
    </header>
    <div data-testid="quiz-welcome-body" class="pmd-quiz-welcome-body">
      <p class="pmd-quiz-welcome-section">
        This is a demo that takes about <strong class="pmd-quiz-hl-yellow">1 hour</strong> to finish.
      </p>
      <p class="pmd-quiz-welcome-section">
        <strong class="pmd-quiz-hl-green">Sign in with Google</strong> to save your progress and keep playing on any device.
      </p>
      <p class="pmd-quiz-welcome-section">
        At the end of the demo, you'll gain access to an <strong class="pmd-quiz-hl-cyan">exclusive Discord community</strong> that only players who have completed the demo can join to share your feedback. All feedback helps, and I want this game to be the best it can be!
      </p>
      <p class="pmd-quiz-welcome-section">
        With that out of the way, complete a <strong class="pmd-quiz-hl-cyan">personality quiz</strong> to meet your <strong class="pmd-quiz-hl-yellow">Hero</strong>!
      </p>
    </div>
    <div class="pmd-quiz-welcome-actions">
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

const AUDIO_NOTICE_SEEN_KEY = 'mystery_emblem_audio_notice_seen_v1';
const SPEAKER_ICON_SVG =
  '<svg class="pmd-audio-notice-icon" viewBox="0 0 16 16" width="20" height="20" aria-hidden="true" shape-rendering="crispEdges" fill="currentColor">' +
  '<path d="M1 5h3l4-3v12l-4-3H1z"/><rect x="10" y="6" width="1" height="4"/>' +
  '<rect x="12" y="4" width="1" height="8"/><rect x="14" y="2" width="1" height="12"/>' +
  '</svg>';

/** Shows the top-left music notice only on the player's first ever visit; fades out after ~8s. */
export function showFirstVisitAudioNotice(hostEl: HTMLElement): HTMLElement | null {
  if (localStorage.getItem(AUDIO_NOTICE_SEEN_KEY)) return null;
  localStorage.setItem(AUDIO_NOTICE_SEEN_KEY, '1');

  const notice = document.createElement('aside');
  notice.className = 'pmd-window pmd-window--compact pmd-window--translucent pmd-audio-notice';
  notice.dataset.testid = 'quiz-audio-notice';
  notice.setAttribute('role', 'status');
  notice.setAttribute('aria-live', 'polite');
  notice.innerHTML = `<div class="pmd-audio-notice-text">This game has music and sound effects.</div>${SPEAKER_ICON_SVG}`;
  hostEl.appendChild(notice);

  setTimeout(() => {
    notice.classList.add('is-fading-out');
    setTimeout(() => notice.remove(), 400);
  }, 8000);
  return notice;
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
