/**
 * Mystery Emblem - Hero Customization Screen (`QuizHeroCustomizeView.ts`)
 *
 * Fire Emblem Awakening style character customization shown after the personality
 * quiz species reveal (and after picking a Dragon Lord in New Game+) before Beat 4
 * ("Begin Adventure"). Lets the player pick a hero name, birth month/day, Asset stat,
 * and Flaw stat with a live base stat and growth rate preview.
 */

import {
  BIRTH_MONTH_OPTIONS,
  HERO_BANE_GROWTH_PENALTY,
  HERO_BOON_GROWTH_BONUS,
  HERO_NAME_MAX_LENGTH,
  HERO_STAT_OPTIONS,
  applyBoonBaneToBaseStats,
  getDaysInBirthMonth,
} from '../../data/heroCustomization';
import { getSpeciesById } from '../../data/index';
import { getDragonLordTraitInfo, type DragonLordSpeciesId } from '../../data/quizData';
import {
  computeManualScaledStatsForJoinLevel,
  getEffectiveGrowthRates,
} from '../../engine/progressionEngine';
import type { StatKeySix } from '../../types/schemas';
import type { PmdPortraitView } from '../PmdSpriteCanvas';
import { bindPointerTap } from '../pointerControls';
import { escapeQuizHtml } from './QuizWelcomeAndQuestionsView';

export interface HeroCustomizationDraft {
  nickname: string;
  birthMonth: number;
  birthDay: number;
  boonStat: StatKeySix;
  baneStat: StatKeySix;
}

export function renderQuizHeroCustomizeView(
  stageEl: HTMLElement,
  opts: {
    selectedLordSpeciesId: DragonLordSpeciesId;
    initialDraft: HeroCustomizationDraft;
    startingLevel: number;
    scaleStatsToLevel: boolean;
    portraitView: PmdPortraitView;
    backLabel: string;
    onBack: (draft: HeroCustomizationDraft) => void;
    onConfirm: (draft: HeroCustomizationDraft) => void;
    onOptionChangeSfx?: () => void;
  }
): void {
  const lordMeta = getDragonLordTraitInfo(opts.selectedLordSpeciesId);
  const sp = getSpeciesById(lordMeta.speciesId);
  const speciesName = sp?.name ?? lordMeta.name;

  const draft: HeroCustomizationDraft = {
    nickname: opts.initialDraft.nickname,
    birthMonth: opts.initialDraft.birthMonth,
    birthDay: Math.min(
      opts.initialDraft.birthDay,
      getDaysInBirthMonth(opts.initialDraft.birthMonth)
    ),
    boonStat: opts.initialDraft.boonStat,
    baneStat:
      opts.initialDraft.baneStat === opts.initialDraft.boonStat
        ? opts.initialDraft.boonStat === 'def'
          ? 'spd'
          : 'def'
        : opts.initialDraft.baneStat,
  };

  const win = document.createElement('div');
  win.className = 'pmd-window pmd-hero-customize-window';
  win.dataset.testid = 'quiz-customize-scene';
  win.setAttribute('role', 'dialog');
  win.setAttribute('aria-label', 'Customize Your Hero');

  const monthOptionsHtml = BIRTH_MONTH_OPTIONS.map(
    (m) =>
      `<option value="${m.value}"${m.value === draft.birthMonth ? ' selected' : ''}>${escapeQuizHtml(m.name)}</option>`
  ).join('');

  const buildStatOptionsHtml = (selectedKey: StatKeySix): string =>
    HERO_STAT_OPTIONS.map(
      (st) =>
        `<option value="${st.key}"${st.key === selectedKey ? ' selected' : ''}>${escapeQuizHtml(st.fullLabel)}</option>`
    ).join('');

  win.innerHTML = `
    <div class="pmd-hero-cust-header">
      <div class="pmd-forecast-portrait-slot pmd-hero-cust-portrait" data-cust-portrait></div>
      <div class="pmd-hero-cust-title-col">
        <h2 class="pmd-hero-cust-title">CUSTOMIZE YOUR HERO</h2>
        <p class="pmd-hero-cust-subtitle">${escapeQuizHtml(speciesName)} · ${escapeQuizHtml(lordMeta.personalityTitle)}</p>
      </div>
    </div>

    <div class="pmd-hero-cust-form">
      <div class="pmd-hero-cust-field">
        <label class="pmd-hero-cust-label" for="hero-cust-name">Hero Name</label>
        <input
          id="hero-cust-name"
          type="text"
          class="pmd-hero-cust-input"
          data-testid="hero-cust-name-input"
          maxlength="${HERO_NAME_MAX_LENGTH}"
          autocomplete="off"
          spellcheck="false"
          placeholder="${escapeQuizHtml(speciesName)}"
          value="${escapeQuizHtml(draft.nickname)}"
        />
      </div>

      <div class="pmd-hero-cust-field">
        <span class="pmd-hero-cust-label">Birthday</span>
        <div class="pmd-hero-cust-pair">
          <select id="hero-cust-month" class="pmd-select pmd-hero-cust-select" data-testid="hero-cust-month-select" aria-label="Birth Month">
            ${monthOptionsHtml}
          </select>
          <select id="hero-cust-day" class="pmd-select pmd-hero-cust-select pmd-hero-cust-day-select" data-testid="hero-cust-day-select" aria-label="Birth Day">
          </select>
        </div>
      </div>

      <div class="pmd-hero-cust-pair">
        <div class="pmd-hero-cust-field">
          <label class="pmd-hero-cust-label is-boon" for="hero-cust-boon">Excels In (Asset ▲)</label>
          <select id="hero-cust-boon" class="pmd-select pmd-hero-cust-select" data-testid="hero-cust-boon-select">
            ${buildStatOptionsHtml(draft.boonStat)}
          </select>
        </div>
        <div class="pmd-hero-cust-field">
          <label class="pmd-hero-cust-label is-bane" for="hero-cust-bane">Weak In (Flaw ▼)</label>
          <select id="hero-cust-bane" class="pmd-select pmd-hero-cust-select" data-testid="hero-cust-bane-select">
            ${buildStatOptionsHtml(draft.baneStat)}
          </select>
        </div>
      </div>
    </div>

    <div class="pmd-hero-cust-preview-wrap">
      <div class="pmd-hero-cust-preview-head">
        <span>Starting Stats &amp; Growths</span>
        <span class="pmd-hero-cust-legend">
          <span class="is-boon">▲ +${HERO_BOON_GROWTH_BONUS}%</span>
          <span class="is-bane">▼ -${HERO_BANE_GROWTH_PENALTY}%</span>
        </span>
      </div>
      <div class="pmd-hero-cust-stats-grid" data-testid="hero-cust-stats-preview"></div>
    </div>

    <div class="pmd-hero-cust-actions">
      <button type="button" class="pmd-btn pmd-chip-btn" data-testid="hero-cust-back-btn" style="min-height:44px; padding:6px 14px;">
        ◀ ${escapeQuizHtml(opts.backLabel)}
      </button>
      <button type="button" class="pmd-btn pmd-btn-primary" data-testid="quiz-customize-continue-btn" style="min-height:46px; padding:8px 18px;">
        Continue ▶
      </button>
    </div>
  `;

  win.querySelector('[data-cust-portrait]')?.appendChild(opts.portraitView.canvas);
  void opts.portraitView.setPortrait({
    speciesIdOrAssetId: lordMeta.speciesId,
    emotion: 'Happy',
  });

  const nameInput = win.querySelector<HTMLInputElement>('[data-testid="hero-cust-name-input"]')!;
  const monthSelect = win.querySelector<HTMLSelectElement>('[data-testid="hero-cust-month-select"]')!;
  const daySelect = win.querySelector<HTMLSelectElement>('[data-testid="hero-cust-day-select"]')!;
  const boonSelect = win.querySelector<HTMLSelectElement>('[data-testid="hero-cust-boon-select"]')!;
  const baneSelect = win.querySelector<HTMLSelectElement>('[data-testid="hero-cust-bane-select"]')!;
  const previewGrid = win.querySelector<HTMLElement>('[data-testid="hero-cust-stats-preview"]')!;

  const populateDays = () => {
    const maxDays = getDaysInBirthMonth(draft.birthMonth);
    if (draft.birthDay > maxDays) draft.birthDay = maxDays;
    let html = '';
    for (let d = 1; d <= maxDays; d += 1) {
      html += `<option value="${d}"${d === draft.birthDay ? ' selected' : ''}>${d}</option>`;
    }
    daySelect.innerHTML = html;
  };

  const renderStatPreview = () => {
    if (!sp) return;
    const stats = opts.scaleStatsToLevel
      ? computeManualScaledStatsForJoinLevel(sp, opts.startingLevel, draft.boonStat, draft.baneStat)
      : applyBoonBaneToBaseStats(sp.baseStats, draft.boonStat, draft.baneStat);
    const growths = getEffectiveGrowthRates(sp, draft.boonStat, draft.baneStat);

    previewGrid.innerHTML = HERO_STAT_OPTIONS.map((meta) => {
      const isBoon = meta.key === draft.boonStat;
      const isBane = meta.key === draft.baneStat;
      const cls = isBoon ? ' is-boon' : isBane ? ' is-bane' : '';
      const arrow = isBoon ? ' ▲' : isBane ? ' ▼' : '';
      const deltaText = isBoon
        ? `+${meta.boonBaseDelta}`
        : isBane
          ? `${meta.baneBaseDelta}`
          : '';
      return `
        <div class="pmd-hero-cust-stat-cell${cls}" data-testid="hero-cust-preview-${meta.key}">
          <span class="pmd-hero-cust-stat-lbl">${meta.shortLabel}${arrow}</span>
          <strong class="pmd-hero-cust-stat-val">${stats[meta.key]}${deltaText ? `<small>${deltaText}</small>` : ''}</strong>
          <span class="pmd-hero-cust-stat-growth">${growths[meta.key]}%</span>
        </div>
      `;
    }).join('');
  };

  populateDays();
  renderStatPreview();

  nameInput.addEventListener('input', () => {
    draft.nickname = nameInput.value.slice(0, HERO_NAME_MAX_LENGTH);
  });

  monthSelect.addEventListener('change', () => {
    draft.birthMonth = Number(monthSelect.value) || 1;
    populateDays();
    opts.onOptionChangeSfx?.();
  });

  daySelect.addEventListener('change', () => {
    draft.birthDay = Number(daySelect.value) || 1;
    opts.onOptionChangeSfx?.();
  });

  boonSelect.addEventListener('change', () => {
    const nextBoon = boonSelect.value as StatKeySix;
    if (nextBoon === draft.baneStat) {
      draft.baneStat = draft.boonStat;
      baneSelect.value = draft.baneStat;
    }
    draft.boonStat = nextBoon;
    renderStatPreview();
    opts.onOptionChangeSfx?.();
  });

  baneSelect.addEventListener('change', () => {
    const nextBane = baneSelect.value as StatKeySix;
    if (nextBane === draft.boonStat) {
      draft.boonStat = draft.baneStat;
      boonSelect.value = draft.boonStat;
    }
    draft.baneStat = nextBane;
    renderStatPreview();
    opts.onOptionChangeSfx?.();
  });

  bindPointerTap(
    win.querySelector('[data-testid="hero-cust-back-btn"]'),
    () => {
      draft.nickname = nameInput.value.slice(0, HERO_NAME_MAX_LENGTH);
      opts.onBack({ ...draft });
    },
    { stopPropagation: true }
  );

  bindPointerTap(
    win.querySelector('[data-testid="quiz-customize-continue-btn"]'),
    () => {
      draft.nickname = nameInput.value.slice(0, HERO_NAME_MAX_LENGTH);
      opts.onConfirm({ ...draft });
    },
    { stopPropagation: true }
  );

  stageEl.appendChild(win);
}
