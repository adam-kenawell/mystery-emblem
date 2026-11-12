/**
 * Mystery Emblem - Modular New Game+ Dragon Lord Selector (`NG_PLUS_SELECT_SCENE`)
 *
 * Allows players with `newGamePlusUnlocked` to directly choose any of the 5 Dragon Lords
 * (paired with fixed hometown sibling Quaxly and flower-matched Flabebe) without retaking
 * the 8-question personality quiz.
 */

import { getSpeciesById } from '../../data/index';
import {
  DRAGON_LORD_OPTIONS,
  getDragonLordTraitInfo,
  type DragonLordSpeciesId,
} from '../../data/quizData';
import { bindPointerTap } from '../pointerControls';
import { escapeQuizHtml } from './QuizWelcomeAndQuestionsView';

export function renderNgPlusRosterSelectorView(
  stageEl: HTMLElement,
  opts: {
    initialLordSpeciesId: DragonLordSpeciesId;
    onSelectLordChange: (lordId: DragonLordSpeciesId) => void;
    onTakeAuraQuizInstead: () => void;
    onConfirmNgPlus: (lordId: DragonLordSpeciesId) => void;
  }
): void {
  let chosenLord: DragonLordSpeciesId = opts.initialLordSpeciesId;

  const win = document.createElement('div');
  win.className = 'pmd-window pmd-ngplus-window';
  win.dataset.testid = 'ng-plus-select-scene';
  win.setAttribute('role', 'dialog');
  win.setAttribute('aria-label', 'New Game Plus Dragon Lord Selector');

  const lordOptionsHtml = DRAGON_LORD_OPTIONS.map((lord) => {
    const sp = getSpeciesById(lord.speciesId);
    const sel = lord.speciesId === chosenLord ? ' selected' : '';
    return `<option value="${escapeQuizHtml(lord.speciesId)}"${sel}>${escapeQuizHtml(sp?.name ?? lord.name)} - ${escapeQuizHtml(lord.traitLabel)}</option>`;
  }).join('');

  const initialMeta = getDragonLordTraitInfo(chosenLord);

  win.innerHTML = `
    <div class="pmd-devtools-row-between">
      <h2 style="margin:0; font-size:17px; color:#f8f800;">NEW GAME+ DRAGON PICKER</h2>
      <button type="button" class="pmd-btn pmd-chip-btn" data-testid="ngplus-take-quiz-btn" style="min-height:44px;">
        Aura Quiz
      </button>
    </div>
    <div class="pmd-ngplus-slot-row">
      <label class="pmd-ngplus-slot-label" for="ngplus-lord-select">Dragon Lord</label>
      <select id="ngplus-lord-select" class="pmd-select" data-testid="ngplus-lord-select">
        ${lordOptionsHtml}
      </select>
    </div>
    <p data-testid="ngplus-party-summary" style="margin:6px 0; font-size:13px; color:#d8e8f8; line-height:1.45;">
      Hometown Trio: <strong>Quaxly</strong> (Sibling Partner) &amp; <strong>Flabebe</strong> (<span data-testid="ngplus-flower-label">${escapeQuizHtml(initialMeta.flabebeFlowerLabel)}</span>).
    </p>
    <div style="display:flex; justify-content:flex-end; margin-top:4px;">
      <button type="button" class="pmd-btn pmd-btn-primary" data-testid="ngplus-confirm-btn" style="min-height:46px; padding:8px 18px;">
        Begin New Game+ ▶
      </button>
    </div>
  `;

  const lordSelect = win.querySelector<HTMLSelectElement>('[data-testid="ngplus-lord-select"]');
  const flowerSpan = win.querySelector<HTMLElement>('[data-testid="ngplus-flower-label"]');
  lordSelect?.addEventListener('change', () => {
    chosenLord = (lordSelect.value as DragonLordSpeciesId) || 'axew';
    if (flowerSpan) {
      flowerSpan.textContent = getDragonLordTraitInfo(chosenLord).flabebeFlowerLabel;
    }
    opts.onSelectLordChange(chosenLord);
  });

  bindPointerTap(win.querySelector('[data-testid="ngplus-take-quiz-btn"]'), opts.onTakeAuraQuizInstead, {
    stopPropagation: true,
  });
  bindPointerTap(
    win.querySelector('[data-testid="ngplus-confirm-btn"]'),
    () => opts.onConfirmNgPlus(chosenLord),
    { stopPropagation: true }
  );

  stageEl.appendChild(win);
}
