/**
 * Mystery Emblem — Modular New Game+ Manual Roster & Seed Selector (`NG_PLUS_SELECT_SCENE`)
 *
 * Allows players with `newGamePlusUnlocked` to manually choose any of the 5 Dragon Lords
 * and customize each of the 8 `slot1Flying`..`slot8Ice` recruitment slots without retaking
 * the personality quiz.
 */

import { createDefaultQuizSeeds } from '../../data/campaignConfig';
import { getSpeciesById } from '../../data/index';
import {
  DRAGON_LORD_OPTIONS,
  PERSONALITY_QUIZ_QUESTIONS,
  type DragonLordSpeciesId,
} from '../../data/quizData';
import type { QuizRecruitSeeds, QuizSeedSlotKey } from '../../types/schemas';
import { bindPointerTap } from '../pointerControls';
import { escapeQuizHtml } from './QuizWelcomeAndQuestionsView';

const NG_PLUS_SLOT_LABELS: Readonly<Record<QuizSeedSlotKey, string>> = {
  slot1Flying: 'Ch. 1 Flying Scout',
  slot2Psychic: 'Ch. 2 Psychic Seer',
  slot3Electric: 'Ch. 4 Electric Striker',
  slot4Rock: 'Ch. 6 Rock Vanguard',
  slot5Fire: 'Ch. 7 Fire Vanguard',
  slot6Grass: 'Ch. 8 Grass Warden',
  slot7Fairy: 'Ch. 10 Fairy Mystic',
  slot8Ice: 'Ch. 12 Ice Sentinel',
};

export function collectSlotCandidateSpeciesIds(slotKey: QuizSeedSlotKey): string[] {
  const seen = new Set<string>();
  for (const q of PERSONALITY_QUIZ_QUESTIONS) {
    if (q.seedKey !== slotKey) continue;
    for (const opt of q.options) {
      for (const spId of opt.recruitSpeciesIds) {
        if (getSpeciesById(spId)) seen.add(spId);
      }
    }
  }
  return [...seen];
}

export function renderNgPlusRosterSelectorView(
  stageEl: HTMLElement,
  opts: {
    initialLordSpeciesId: DragonLordSpeciesId;
    initialSeeds?: QuizRecruitSeeds | null;
    onSelectLordChange: (lordId: DragonLordSpeciesId) => void;
    onTakeAuraQuizInstead: () => void;
    onConfirmNgPlus: (lordId: DragonLordSpeciesId, seeds: QuizRecruitSeeds) => void;
  }
): void {
  let chosenLord: DragonLordSpeciesId = opts.initialLordSpeciesId;
  const seeds: QuizRecruitSeeds = createDefaultQuizSeeds(opts.initialSeeds ?? undefined);

  const win = document.createElement('div');
  win.className = 'pmd-window pmd-ngplus-window';
  win.dataset.testid = 'ng-plus-select-scene';
  win.setAttribute('role', 'dialog');
  win.setAttribute('aria-label', 'New Game Plus Roster Selector');

  const lordOptionsHtml = DRAGON_LORD_OPTIONS.map((lord) => {
    const sp = getSpeciesById(lord.speciesId);
    const sel = lord.speciesId === chosenLord ? ' selected' : '';
    return `<option value="${escapeQuizHtml(lord.speciesId)}"${sel}>${escapeQuizHtml(sp?.name ?? lord.name)} — ${escapeQuizHtml(lord.traitLabel)}</option>`;
  }).join('');

  const slotKeys = Object.keys(NG_PLUS_SLOT_LABELS) as QuizSeedSlotKey[];
  const slotsHtml = slotKeys
    .map((slotKey) => {
      const candidates = collectSlotCandidateSpeciesIds(slotKey);
      const currentPick = seeds[slotKey][0] ?? candidates[0] ?? '';
      const optsHtml = candidates
        .map((spId) => {
          const sp = getSpeciesById(spId);
          const sel = spId === currentPick ? ' selected' : '';
          return `<option value="${escapeQuizHtml(spId)}"${sel}>${escapeQuizHtml(sp?.name ?? spId)}</option>`;
        })
        .join('');
      return `
        <div class="pmd-ngplus-slot-row">
          <label class="pmd-ngplus-slot-label" for="ngplus-${slotKey}">${escapeQuizHtml(NG_PLUS_SLOT_LABELS[slotKey])}</label>
          <select id="ngplus-${slotKey}" class="pmd-select" data-ngplus-slot="${slotKey}" data-testid="ngplus-select-${slotKey}">
            ${optsHtml}
          </select>
        </div>
      `;
    })
    .join('');

  win.innerHTML = `
    <div class="pmd-devtools-row-between">
      <h2 style="margin:0; font-size:17px; color:#f8f800;">NEW GAME+ ROSTER PICKER</h2>
      <button type="button" class="pmd-btn pmd-chip-btn" data-testid="ngplus-take-quiz-btn" style="min-height:44px;">
        Aura Quiz
      </button>
    </div>
    <div class="pmd-ngplus-slot-row">
      <label class="pmd-ngplus-slot-label" for="ngplus-lord-select">Protagonist Dragon Lord (Piplup &amp; Flabébé join automatically)</label>
      <select id="ngplus-lord-select" class="pmd-select" data-testid="ngplus-lord-select">
        ${lordOptionsHtml}
      </select>
    </div>
    <div class="pmd-ngplus-slot-grid">
      ${slotsHtml}
    </div>
    <div style="display:flex; justify-content:flex-end; margin-top:4px;">
      <button type="button" class="pmd-btn pmd-btn-primary" data-testid="ngplus-confirm-btn" style="min-height:46px; padding:8px 18px;">
        Begin New Game+ ▶
      </button>
    </div>
  `;

  const lordSelect = win.querySelector<HTMLSelectElement>('[data-testid="ngplus-lord-select"]');
  lordSelect?.addEventListener('change', () => {
    chosenLord = (lordSelect.value as DragonLordSpeciesId) || 'axew';
    opts.onSelectLordChange(chosenLord);
  });

  win.querySelectorAll<HTMLSelectElement>('[data-ngplus-slot]').forEach((selectEl) => {
    selectEl.addEventListener('change', () => {
      const key = selectEl.dataset.ngplusSlot as QuizSeedSlotKey | undefined;
      if (key && selectEl.value) {
        seeds[key] = [selectEl.value];
      }
    });
  });

  bindPointerTap(win.querySelector('[data-testid="ngplus-take-quiz-btn"]'), opts.onTakeAuraQuizInstead, {
    stopPropagation: true,
  });
  bindPointerTap(
    win.querySelector('[data-testid="ngplus-confirm-btn"]'),
    () => opts.onConfirmNgPlus(chosenLord, createDefaultQuizSeeds(seeds)),
    { stopPropagation: true }
  );

  stageEl.appendChild(win);
}
