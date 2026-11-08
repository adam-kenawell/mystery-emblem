/**
 * Mystery Emblem — Demo Personality Quiz, Flower-Aura Lord Reveal & Rename Modal (`QuizScene.ts`)
 *
 * Implements:
 * 1. `RecruitNicknameOverlay`: Reusable PMD modal for manually renaming existing squad members
 *    from Overworld (`Units`), Dungeon Prep (`Manage Units`), or Admin `Dev Tools`
 *    (zero automatic `"NEW ALLY"` popups on recruitment).
 * 2. `QuizScene`:
 *    - 4-question PMD Personality Quiz tallying trait points for the 5 Lore Bible Dragon Lords
 *      (`Axew`, `Bagon`, `Gible`, `Dratini`, `Goomy`) and seeding the 3 Demo recruit slots.
 *    - Flower-Color Aura Reveal (`"You seem to be the [Personality] type!"` + personality
 *      description + background shift matching Flabébé's Red / Orange / Yellow / Blue / White flower).
 *    - Fixed starting trio (`Revealed Dragon Lord` + `Piplup` + color-matched `Flabébé`), with zero
 *      manual Lord override, Partner picker, NG+ picker, or nickname popups, launching straight
 *      into Dungeon 1 (`Western Beach`).
 */

import { resolveUnitVisualAssetId } from '../assets/pmdAssetLoader';
import { getAudioManager, type AudioManager } from '../audio/AudioManager';
import { DEMO_INITIAL_CONVOY, DEMO_STARTING_LEVEL } from '../data/campaignRegistry';
import { getPersonalSkillById, getSpeciesById } from '../data/index';
import {
  DEMO_OVERWORLD_GRAPH,
  type OverworldGraphDefinition,
} from '../data/overworldMapData';
import {
  DEFAULT_QUIZ_BACKDROP_CSS,
  DRAGON_LORD_OPTIONS,
  PERSONALITY_QUIZ_QUESTIONS,
  evaluatePersonalityQuiz,
  getDragonLordTraitInfo,
  type DragonLordSpeciesId,
  type QuizOptionKey,
} from '../data/quizData';
import type { SaveStateManager } from '../state/SaveStateManager';
import type {
  CampaignMode,
  ConvoyEntry,
  FlabebeFlowerColor,
  OwnedPokemonInstance,
  QuizRecruitSeeds,
  SaveData,
} from '../types/schemas';
import { PmdPortraitView } from './PmdSpriteCanvas';
import { bindBackGestureSurface, bindPointerTap } from './pointerControls';
import { renderColoredTypesHtml } from './typeColors';

function escapeQuizHtml(raw: string): string {
  return raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ============================================================================
// Manual Rename Modal (`RecruitNicknameOverlay`)
// ============================================================================

export interface PromptRecruitsOptions {
  bannerText?: string;
}

export class RecruitNicknameOverlay {
  public readonly rootEl: HTMLElement;
  private readonly modalTitleEl: HTMLElement;
  private readonly bannerEl: HTMLElement;
  private readonly stepBadgeEl: HTMLElement;
  private readonly speciesTitleEl: HTMLElement;
  private readonly speciesMetaEl: HTMLElement;
  private readonly skillDescEl: HTMLElement;
  private readonly inputEl: HTMLInputElement;
  private readonly portraitView: PmdPortraitView;
  private readonly confirmBtn: HTMLButtonElement;
  private readonly secondaryBtn: HTMLButtonElement;
  private readonly cancelBtn: HTMLButtonElement;

  private readonly saveManager: SaveStateManager;
  private readonly audioManager: AudioManager;
  private readonly onStateChange?: () => void;
  private readonly abortController = new AbortController();

  private mode: 'recruit' | 'rename' = 'rename';
  private activeSaveManagerOverride: SaveStateManager | null = null;
  private queue: OwnedPokemonInstance[] = [];
  private queueIndex = 0;
  private resolver: (() => void) | null = null;

  constructor(
    mountParent: HTMLElement,
    saveManager: SaveStateManager,
    options?: { audioManager?: AudioManager; onStateChange?: () => void }
  ) {
    this.saveManager = saveManager;
    this.audioManager = options?.audioManager ?? getAudioManager();
    this.onStateChange = options?.onStateChange;

    this.rootEl = document.createElement('div');
    this.rootEl.className = 'pmd-modal-backdrop';
    this.rootEl.dataset.testid = 'recruit-nickname-modal';
    this.rootEl.hidden = true;
    this.rootEl.style.zIndex = '96';

    this.rootEl.innerHTML = `
      <div class="pmd-window pmd-modal-card" role="dialog" aria-modal="true" aria-label="Pokémon Nickname" style="width:min(420px, 94vw); max-height:min(90dvh, 480px); overflow-y:auto;">
        <div class="pmd-devtools-row-between" style="margin-bottom:6px;">
          <h2 class="pmd-modal-title" data-nickname-modal-title style="margin:0; color:#f8f800;">RENAME</h2>
          <span class="pmd-chapter-badge" data-recruit-step-badge hidden>1 / 1</span>
        </div>
        <p class="pmd-modal-sub" data-recruit-banner style="margin:0 0 8px; color:#a8e0f8; font-size:13px;" hidden></p>
        <div class="pmd-forecast-unit-head" style="background:#16344c; border:2px solid #a8c0e0; padding:8px; margin-bottom:8px;">
          <div class="pmd-forecast-portrait-slot" data-recruit-portrait></div>
          <div class="pmd-forecast-unit-id">
            <strong class="pmd-forecast-unit-name" data-testid="recruit-species-title">Axew</strong>
            <span class="pmd-forecast-unit-meta" data-recruit-species-meta>Dragon · Lv. 9</span>
            <span class="pmd-forecast-unit-meta" data-recruit-skill-desc style="color:#58f858; margin-top:2px;"></span>
          </div>
        </div>
        <label class="pmd-field-label" for="pmd-recruit-nickname-input">Nickname</label>
        <input
          id="pmd-recruit-nickname-input"
          data-testid="recruit-nickname-input"
          class="pmd-text-input"
          type="text"
          maxlength="16"
          autocomplete="off"
        />
        <div class="pmd-modal-actions" style="margin-top:0.65rem; display:flex; flex-wrap:wrap; gap:0.4rem; justify-content:flex-end;">
          <button type="button" class="pmd-btn" data-testid="rename-cancel-btn" style="min-height:44px;" hidden>
            Cancel
          </button>
          <button type="button" class="pmd-btn" data-testid="recruit-nickname-skip-all-btn" style="min-height:44px;">
            Default
          </button>
          <button type="button" class="pmd-btn pmd-btn-primary" data-testid="recruit-nickname-confirm-btn" style="min-height:44px;">
            Save
          </button>
        </div>
      </div>
    `;

    this.modalTitleEl = this.rootEl.querySelector('[data-nickname-modal-title]')!;
    this.bannerEl = this.rootEl.querySelector('[data-recruit-banner]')!;
    this.stepBadgeEl = this.rootEl.querySelector('[data-recruit-step-badge]')!;
    this.speciesTitleEl = this.rootEl.querySelector('[data-testid="recruit-species-title"]')!;
    this.speciesMetaEl = this.rootEl.querySelector('[data-recruit-species-meta]')!;
    this.skillDescEl = this.rootEl.querySelector('[data-recruit-skill-desc]')!;
    this.inputEl = this.rootEl.querySelector('[data-testid="recruit-nickname-input"]')!;
    this.confirmBtn = this.rootEl.querySelector('[data-testid="recruit-nickname-confirm-btn"]')!;
    this.secondaryBtn = this.rootEl.querySelector('[data-testid="recruit-nickname-skip-all-btn"]')!;
    this.cancelBtn = this.rootEl.querySelector('[data-testid="rename-cancel-btn"]')!;

    this.portraitView = new PmdPortraitView({ testId: 'recruit-nickname-portrait' });
    this.rootEl.querySelector('[data-recruit-portrait]')!.appendChild(this.portraitView.canvas);

    mountParent.appendChild(this.rootEl);

    const signal = this.abortController.signal;
    bindPointerTap(this.confirmBtn, () => this.confirmCurrentAndAdvance(), {
      signal,
      stopPropagation: true,
    });
    bindPointerTap(
      this.secondaryBtn,
      () => {
        if (this.mode === 'rename') {
          const current = this.queue[0];
          if (current) {
            const sp = getSpeciesById(current.speciesId);
            this.inputEl.value = sp?.name ?? current.speciesId;
            this.confirmCurrentAndAdvance();
          }
        } else {
          this.finishAll();
        }
      },
      {
        signal,
        stopPropagation: true,
      }
    );
    bindPointerTap(
      this.cancelBtn,
      () => {
        this.audioManager.playSfx('cancel');
        this.finishAll();
      },
      {
        signal,
        stopPropagation: true,
      }
    );
    bindPointerTap(
      this.rootEl,
      (ev) => {
        if (ev.target === this.rootEl && this.mode === 'rename') {
          this.audioManager.playSfx('cancel');
          this.finishAll();
        }
      },
      { signal }
    );
    bindBackGestureSurface(
      this.rootEl,
      () => {
        if (this.mode === 'rename') {
          this.audioManager.playSfx('cancel');
          this.finishAll();
        } else {
          this.confirmCurrentAndAdvance();
        }
      },
      { signal }
    );
  }

  public isOpen(): boolean {
    return !this.rootEl.hidden;
  }

  public async promptRenameUnit(
    instanceId: string,
    overrideManager?: SaveStateManager
  ): Promise<void> {
    const mgr = overrideManager ?? this.saveManager;
    const save = mgr.getSave();
    const unit = save?.roster.find((u) => u.instanceId === instanceId);
    if (!unit) return;

    if (this.resolver) {
      const prev = this.resolver;
      this.resolver = null;
      prev();
    }

    this.mode = 'rename';
    this.activeSaveManagerOverride = mgr;
    this.queue = [unit];
    this.queueIndex = 0;

    this.modalTitleEl.textContent = 'RENAME';
    this.bannerEl.hidden = true;
    this.stepBadgeEl.hidden = true;
    this.cancelBtn.hidden = false;
    this.secondaryBtn.textContent = 'Default';
    this.secondaryBtn.hidden = false;

    this.rootEl.hidden = false;
    this.audioManager.playSfx('select');
    this.renderCurrentUnit();
    this.onStateChange?.();

    return new Promise<void>((resolve) => {
      this.resolver = resolve;
    });
  }

  public handleBack(): void {
    if (!this.isOpen()) return;
    if (this.mode === 'rename') {
      this.audioManager.playSfx('cancel');
      this.finishAll();
    } else {
      this.confirmCurrentAndAdvance();
    }
  }

  private renderCurrentUnit(): void {
    const current = this.queue[this.queueIndex];
    if (!current) {
      this.finishAll();
      return;
    }

    const sp = getSpeciesById(current.speciesId);
    const skill = sp ? getPersonalSkillById(sp.personalSkillId) : undefined;
    const roleTag = current.isLord ? ' ★' : '';

    this.stepBadgeEl.textContent = `${this.queueIndex + 1} / ${this.queue.length}`;
    this.speciesTitleEl.textContent = `${sp?.name ?? current.speciesId}${roleTag}`;
    this.speciesMetaEl.innerHTML = `Lv. ${current.level} · ${renderColoredTypesHtml(sp?.types ?? ['Normal'], ' / ')} · ${escapeQuizHtml(sp?.traversalClass ?? 'Grounded')}`;
    this.skillDescEl.textContent = skill && this.mode === 'recruit' ? `${skill.name}` : '';
    this.inputEl.value = current.nickname || sp?.name || current.speciesId;

    if (this.mode === 'rename') {
      this.confirmBtn.textContent = 'Save';
    } else {
      this.confirmBtn.textContent =
        this.queueIndex + 1 < this.queue.length ? 'Next ▶' : 'Confirm';
    }

    void this.portraitView.setPortrait({
      speciesIdOrAssetId: resolveUnitVisualAssetId(current.speciesId, current.cosmeticForm),
      emotion: 'Happy',
    });
  }

  private confirmCurrentAndAdvance(): void {
    const current = this.queue[this.queueIndex];
    const mgr = this.activeSaveManagerOverride ?? this.saveManager;
    if (current) {
      const sp = getSpeciesById(current.speciesId);
      const trimmed = this.inputEl.value.trim() || sp?.name || current.nickname || 'Ally';
      try {
        mgr.renamePokemon(current.instanceId, trimmed);
      } catch {
        // Ignore if save was reset externally
      }
    }

    this.audioManager.playSfx('select');
    this.queueIndex += 1;
    if (this.queueIndex >= this.queue.length) {
      this.finishAll();
    } else {
      this.renderCurrentUnit();
    }
  }

  private finishAll(): void {
    this.rootEl.hidden = true;
    this.queue = [];
    this.queueIndex = 0;
    this.activeSaveManagerOverride = null;
    this.onStateChange?.();
    if (this.resolver) {
      const done = this.resolver;
      this.resolver = null;
      done();
    }
  }

  public destroy(): void {
    this.finishAll();
    this.abortController.abort();
    this.rootEl.remove();
  }
}

// ============================================================================
// 4-Question Demo Personality Quiz & Flower-Aura Reveal (`QuizScene`)
// ============================================================================

export type QuizSceneStep = 'questions' | 'lord_reveal';
export type QuizRevealBeat = 0 | 1 | 2 | 3 | 4;

const DEFAULT_TYPEWRITER_MS_PER_CHAR = 20;

export interface OpenQuizSceneOptions {
  campaignMode?: CampaignMode;
  startingLevel?: number;
  scaleStatsToLevel?: boolean;
  initialConvoy?: ReadonlyArray<ConvoyEntry>;
  overworldGraph?: OverworldGraphDefinition;
  typewriterMsPerChar?: number;
  onComplete?: (save: SaveData) => void;
}

export interface QuizSceneSnapshot {
  isOpen: boolean;
  step: QuizSceneStep;
  revealBeat: QuizRevealBeat;
  isTyping: boolean;
  displayedRevealText: string;
  auraBackdropActive: boolean;
  questionIndex: number;
  answers: QuizOptionKey[];
  selectedLordSpeciesId: DragonLordSpeciesId;
  selectedPartnerSpeciesId: 'piplup';
  selectedHealerSpeciesId: 'flabebe';
  flabebeFlowerColor: FlabebeFlowerColor;
}

export class QuizScene {
  public readonly rootEl: HTMLElement;
  private readonly panelBodyEl: HTMLElement;
  private readonly headerStepBadgeEl: HTMLElement;
  private readonly headerTitleEl: HTMLElement;

  private readonly saveManager: SaveStateManager;
  private readonly audioManager: AudioManager;
  private readonly onCancelCallback: () => void;
  private readonly onStateChange?: () => void;
  private readonly abortController = new AbortController();

  private openState = false;
  private fastMode = false;
  private step: QuizSceneStep = 'questions';
  private revealBeat: QuizRevealBeat = 0;
  private questionIndex = 0;
  private answers: QuizOptionKey[] = [];
  private selectedLordSpeciesId: DragonLordSpeciesId = 'axew';
  private computedQuizSeeds: QuizRecruitSeeds | null = null;

  private typewriterTimer: number | null = null;
  private typewriterPrefix = '';
  private typewriterRemaining = '';
  private typewriterCharIndex = 0;
  private activeRevealTextEl: HTMLElement | null = null;
  private activeRevealPromptEl: HTMLElement | null = null;

  private activeOptions: OpenQuizSceneOptions = {};
  private lordPortraitView: PmdPortraitView | null = null;

  constructor(
    mountParent: HTMLElement,
    saveManager: SaveStateManager,
    _nicknameOverlay: RecruitNicknameOverlay,
    options: {
      audioManager?: AudioManager;
      onCancel: () => void;
      onStateChange?: () => void;
    }
  ) {
    this.saveManager = saveManager;
    this.audioManager = options.audioManager ?? getAudioManager();
    this.onCancelCallback = options.onCancel;
    this.onStateChange = options.onStateChange;

    this.rootEl = document.createElement('section');
    this.rootEl.className = 'pmd-quiz-scene';
    this.rootEl.dataset.testid = 'quiz-scene';
    this.rootEl.hidden = true;
    this.rootEl.setAttribute('aria-label', 'Personality Quiz and Dragon Aura Reveal');
    this.rootEl.style.cssText = [
      'position:absolute',
      'inset:0',
      'z-index:72',
      'display:flex',
      'align-items:center',
      'justify-content:center',
      'padding:clamp(0.45rem, 2vw, 1rem)',
      'padding-top:clamp(2.9rem, 7vh, 3.6rem)',
      `background:${DEFAULT_QUIZ_BACKDROP_CSS}`,
      'transition:background 360ms ease',
      'box-sizing:border-box',
    ].join(';');

    const card = document.createElement('div');
    card.className = 'pmd-window';
    card.style.cssText = [
      'width:min(700px, 96vw)',
      'max-height:calc(100dvh - 3.6rem)',
      'display:flex',
      'flex-direction:column',
      'padding:clamp(0.6rem, 2vw, 1rem)',
      'box-sizing:border-box',
      'overflow:hidden',
    ].join(';');

    const header = document.createElement('div');
    header.className = 'pmd-devtools-row-between';
    header.style.cssText =
      'padding-bottom:6px; margin-bottom:8px; border-bottom:2px solid rgba(248, 248, 248, 0.85); flex-shrink:0;';
    header.innerHTML = `
      <strong data-quiz-header-title style="font-size:clamp(14px, 2.2vw, 18px); color:#f8f800; letter-spacing:0.04em;">
        AURA QUIZ
      </strong>
      <span class="pmd-chapter-badge" data-quiz-step-badge>1 / 4</span>
    `;

    this.headerTitleEl = header.querySelector('[data-quiz-header-title]')!;
    this.headerStepBadgeEl = header.querySelector('[data-quiz-step-badge]')!;

    this.panelBodyEl = document.createElement('div');
    this.panelBodyEl.dataset.testid = 'quiz-panel-body';
    this.panelBodyEl.style.cssText = 'overflow-y:auto; flex:1; min-height:0; padding-right:0.15rem;';

    card.append(header, this.panelBodyEl);
    this.rootEl.appendChild(card);
    mountParent.appendChild(this.rootEl);

    const styleEl = document.createElement('style');
    styleEl.textContent = `
      .pmd-quiz-scene[hidden] { display: none !important; }
      .pmd-quiz-opt-btn {
        width: 100%;
        min-height: 46px;
        text-align: left;
        justify-content: flex-start;
        padding: 8px 10px 8px 26px;
        line-height: 1.35;
        font-size: 14px;
      }
      @keyframes pmdQuizPromptBlink {
        0%, 100% { opacity: 1; transform: translateY(0); }
        50% { opacity: 0.32; transform: translateY(2px); }
      }
      .pmd-quiz-dialogue-box {
        background: #16344c;
        border: 2px solid #a8c0e0;
        padding: 12px 14px 10px;
        cursor: var(--pmd-cursor-glove, pointer);
        user-select: none;
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .pmd-quiz-advance-row {
        display: flex;
        align-items: center;
        justify-content: flex-end;
        gap: 6px;
        min-height: 18px;
        font-size: 12px;
        color: #f8f800;
      }
      .pmd-quiz-advance-row[hidden] {
        display: flex !important;
        visibility: hidden;
      }
      .pmd-quiz-advance-arrow {
        display: inline-block;
        animation: pmdQuizPromptBlink 900ms ease-in-out infinite;
      }
    `;
    this.rootEl.appendChild(styleEl);

    bindPointerTap(
      this.rootEl,
      () => {
        if (this.step === 'lord_reveal') {
          this.handleRevealAdvanceTap();
        }
      },
      { signal: this.abortController.signal }
    );

    bindBackGestureSurface(this.rootEl, () => this.handleBack(), {
      signal: this.abortController.signal,
    });
  }

  public setFastMode(enabled: boolean): void {
    this.fastMode = Boolean(enabled);
  }

  public isOpen(): boolean {
    return this.openState && !this.rootEl.hidden;
  }

  public open(options?: OpenQuizSceneOptions): void {
    this.clearTypewriterTimer();
    this.activeOptions = options ?? {};
    this.openState = true;
    this.step = 'questions';
    this.revealBeat = 0;
    this.questionIndex = 0;
    this.answers = [];
    this.selectedLordSpeciesId = DRAGON_LORD_OPTIONS[0]?.speciesId ?? 'axew';
    this.computedQuizSeeds = null;

    this.applySceneBackdropForStep();
    this.rootEl.hidden = false;
    this.audioManager.playBgm('personality_quiz', { fadeMs: 260 });
    this.render();
    this.onStateChange?.();
  }

  public close(): void {
    if (!this.openState) return;
    this.clearTypewriterTimer();
    this.openState = false;
    this.rootEl.hidden = true;
    this.rootEl.style.background = DEFAULT_QUIZ_BACKDROP_CSS;
    delete this.rootEl.dataset.auraFlowerColor;
    this.onStateChange?.();
  }

  public handleBack(): void {
    if (!this.isOpen()) return;
    this.audioManager.playSfx('cancel');
    this.clearTypewriterTimer();

    if (this.step === 'lord_reveal') {
      this.step = 'questions';
      this.revealBeat = 0;
      this.questionIndex = PERSONALITY_QUIZ_QUESTIONS.length - 1;
      this.answers = this.answers.slice(0, this.questionIndex);
      this.render();
      return;
    }

    if (this.step === 'questions' && this.questionIndex > 0) {
      this.questionIndex -= 1;
      this.answers = this.answers.slice(0, this.questionIndex);
      this.render();
      return;
    }

    this.close();
    this.onCancelCallback();
  }

  public getSnapshot(): QuizSceneSnapshot {
    const lordMeta = getDragonLordTraitInfo(this.selectedLordSpeciesId);
    const auraBackdropActive = this.step === 'lord_reveal' && this.revealBeat >= 3;
    return {
      isOpen: this.isOpen(),
      step: this.step,
      revealBeat: this.revealBeat,
      isTyping: this.typewriterTimer !== null,
      displayedRevealText: this.activeRevealTextEl?.textContent ?? '',
      auraBackdropActive,
      questionIndex: this.questionIndex,
      answers: [...this.answers],
      selectedLordSpeciesId: this.selectedLordSpeciesId,
      selectedPartnerSpeciesId: 'piplup',
      selectedHealerSpeciesId: 'flabebe',
      flabebeFlowerColor: lordMeta.flabebeFlowerColor,
    };
  }

  private applySceneBackdropForStep(): void {
    if (this.step === 'lord_reveal' && this.revealBeat >= 3) {
      const lordMeta = getDragonLordTraitInfo(this.selectedLordSpeciesId);
      this.rootEl.style.background = lordMeta.revealBackdropCss;
      this.rootEl.dataset.auraFlowerColor = lordMeta.flabebeFlowerColor;
    } else {
      this.rootEl.style.background = DEFAULT_QUIZ_BACKDROP_CSS;
      delete this.rootEl.dataset.auraFlowerColor;
    }
  }

  private clearTypewriterTimer(): void {
    if (this.typewriterTimer !== null) {
      window.clearInterval(this.typewriterTimer);
      this.typewriterTimer = null;
    }
  }

  private getEffectiveTypewriterMs(): number {
    if (typeof this.activeOptions.typewriterMsPerChar === 'number') {
      return Math.max(0, this.activeOptions.typewriterMsPerChar);
    }
    if (this.fastMode) {
      return 0;
    }
    return DEFAULT_TYPEWRITER_MS_PER_CHAR;
  }

  private startTypewriter(
    targetEl: HTMLElement,
    promptEl: HTMLElement | null,
    prefixText: string,
    rollText: string
  ): void {
    this.clearTypewriterTimer();
    this.activeRevealTextEl = targetEl;
    this.activeRevealPromptEl = promptEl;
    this.typewriterPrefix = prefixText;
    this.typewriterRemaining = rollText;
    this.typewriterCharIndex = 0;

    const msPerChar = this.getEffectiveTypewriterMs();
    if (msPerChar <= 0 || rollText.length === 0) {
      targetEl.textContent = `${prefixText}${rollText}`;
      if (promptEl) promptEl.hidden = false;
      return;
    }

    targetEl.textContent = prefixText;
    if (promptEl) promptEl.hidden = true;

    this.typewriterTimer = window.setInterval(() => {
      if (!this.openState || this.step !== 'lord_reveal') {
        this.clearTypewriterTimer();
        return;
      }
      this.typewriterCharIndex += 1;
      targetEl.textContent = `${this.typewriterPrefix}${this.typewriterRemaining.slice(0, this.typewriterCharIndex)}`;
      if (this.typewriterCharIndex >= this.typewriterRemaining.length) {
        this.clearTypewriterTimer();
        if (this.activeRevealPromptEl) {
          this.activeRevealPromptEl.hidden = false;
        }
      }
    }, msPerChar);
  }

  private completeCurrentTypewriterImmediately(): void {
    if (this.typewriterTimer === null) return;
    this.clearTypewriterTimer();
    if (this.activeRevealTextEl) {
      this.activeRevealTextEl.textContent = `${this.typewriterPrefix}${this.typewriterRemaining}`;
    }
    if (this.activeRevealPromptEl) {
      this.activeRevealPromptEl.hidden = false;
    }
  }

  private handleRevealAdvanceTap(): void {
    if (!this.isOpen() || this.step !== 'lord_reveal') return;

    if (this.typewriterTimer !== null) {
      this.audioManager.playSfx('select');
      this.completeCurrentTypewriterImmediately();
      return;
    }

    const lordMeta = getDragonLordTraitInfo(this.selectedLordSpeciesId);

    if (this.revealBeat === 0) {
      this.audioManager.playSfx('select');
      this.revealBeat = 1;
      const boxEl = this.panelBodyEl.querySelector<HTMLElement>('[data-testid="quiz-reveal-box"]');
      if (boxEl) boxEl.dataset.revealBeat = '1';
      if (this.activeRevealTextEl) {
        this.startTypewriter(
          this.activeRevealTextEl,
          this.activeRevealPromptEl,
          'You appear to be...',
          ` the ${lordMeta.personalityTitle} type!`
        );
      } else {
        this.render();
      }
      return;
    }

    if (this.revealBeat === 1) {
      this.audioManager.playSfx('select');
      this.revealBeat = 2;
      this.render();
      return;
    }

    if (this.revealBeat === 2) {
      this.audioManager.playSfx('heal');
      this.revealBeat = 3;
      this.render();
      return;
    }

    if (this.revealBeat === 3) {
      this.audioManager.playSfx('select');
      this.revealBeat = 4;
      this.render();
      return;
    }

    this.finalizeCampaignCreation(
      this.selectedLordSpeciesId,
      this.computedQuizSeeds ?? evaluatePersonalityQuiz(this.answers).quizSeeds
    );
  }

  private render(): void {
    this.clearTypewriterTimer();
    this.activeRevealTextEl = null;
    this.activeRevealPromptEl = null;
    this.panelBodyEl.innerHTML = '';
    this.applySceneBackdropForStep();

    if (this.step === 'questions') {
      this.renderQuestionStep();
    } else {
      this.renderLordRevealStep();
    }
  }

  private renderQuestionStep(): void {
    const q = PERSONALITY_QUIZ_QUESTIONS[this.questionIndex] ?? PERSONALITY_QUIZ_QUESTIONS[0]!;
    this.headerTitleEl.textContent = 'AURA QUIZ';
    this.headerStepBadgeEl.textContent = `${this.questionIndex + 1} / ${PERSONALITY_QUIZ_QUESTIONS.length}`;

    const wrap = document.createElement('div');
    wrap.style.cssText = 'display:flex; flex-direction:column; gap:8px;';

    const promptP = document.createElement('p');
    promptP.dataset.testid = 'quiz-question-prompt';
    promptP.style.cssText =
      'margin:0; color:#f8f8f8; font-size:clamp(14px, 2.1vw, 16px); line-height:1.4; background:#16344c; border:2px solid #a8c0e0; padding:8px 10px;';
    promptP.textContent = q.prompt;
    wrap.appendChild(promptP);

    const optStack = document.createElement('div');
    optStack.className = 'pmd-menu-list';
    optStack.style.cssText = 'display:flex; flex-direction:column; gap:0;';

    for (const [idx, opt] of q.options.entries()) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `pmd-btn pmd-menu-row pmd-quiz-opt-btn${idx === 0 ? ' pmd-btn-primary' : ''}`;
      btn.dataset.testid = `quiz-option-${opt.id}`;
      btn.innerHTML = `<span style="color:#f8f800; font-weight:700; margin-right:8px;">${opt.id}.</span><span>${opt.text}</span>`;
      bindPointerTap(
        btn,
        () => {
          this.audioManager.playSfx('select');
          this.answers[this.questionIndex] = opt.id;
          if (this.questionIndex + 1 < PERSONALITY_QUIZ_QUESTIONS.length) {
            this.questionIndex += 1;
            this.render();
          } else {
            const result = evaluatePersonalityQuiz(this.answers);
            this.selectedLordSpeciesId = result.assignedLordSpeciesId;
            this.computedQuizSeeds = result.quizSeeds;
            this.step = 'lord_reveal';
            this.revealBeat = 0;
            this.render();
          }
        },
        { stopPropagation: true }
      );
      optStack.appendChild(btn);
    }

    wrap.appendChild(optStack);
    this.panelBodyEl.appendChild(wrap);
  }

  private renderLordRevealStep(): void {
    const lordMeta = getDragonLordTraitInfo(this.selectedLordSpeciesId);
    const sp = getSpeciesById(lordMeta.speciesId);
    const skill = sp ? getPersonalSkillById(sp.personalSkillId) : undefined;
    const isLordRevealed = this.revealBeat >= 3;

    this.headerTitleEl.textContent = 'YOUR AURA';
    this.headerStepBadgeEl.textContent = isLordRevealed
      ? lordMeta.flabebeFlowerLabel.toUpperCase()
      : '...';

    const wrap = document.createElement('div');
    wrap.style.cssText = 'display:flex; flex-direction:column; gap:0.55rem;';

    // Beats 3 & 4: Happy Pokémon Portrait Card + Colored Typing + Dragon Aura Skill
    if (isLordRevealed) {
      const heroCard = document.createElement('div');
      heroCard.dataset.testid = 'quiz-lord-hero-card';
      heroCard.style.cssText = `display:flex; gap:10px; align-items:center; flex-wrap:wrap; background:#16344c; border:2px solid ${lordMeta.accentBorderColor}; padding:8px 10px;`;
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

      if (!this.lordPortraitView) {
        this.lordPortraitView = new PmdPortraitView({ testId: 'quiz-lord-portrait-canvas' });
      }
      heroCard.querySelector('[data-quiz-lord-portrait]')!.appendChild(this.lordPortraitView.canvas);
      void this.lordPortraitView.setPortrait({
        speciesIdOrAssetId: lordMeta.speciesId,
        emotion: 'Happy',
      });
      wrap.appendChild(heroCard);
    }

    // Sequential Typewriter Dialogue Box
    const dialogueBox = document.createElement('div');
    dialogueBox.className = 'pmd-quiz-dialogue-box';
    dialogueBox.dataset.testid = 'quiz-reveal-box';
    dialogueBox.dataset.revealBeat = String(this.revealBeat);
    if (isLordRevealed) {
      dialogueBox.style.borderColor = '#f8d838';
    }

    const textEl = document.createElement('div');
    const promptRowEl = document.createElement('div');
    promptRowEl.className = 'pmd-quiz-advance-row';
    promptRowEl.dataset.testid = 'quiz-reveal-advance-prompt';
    promptRowEl.innerHTML = `<span>Tap to continue</span><span class="pmd-quiz-advance-arrow">▼</span>`;

    if (this.revealBeat === 0 || this.revealBeat === 1) {
      textEl.dataset.testid = 'quiz-personality-headline';
      textEl.style.cssText =
        'font-size:clamp(15px, 2.3vw, 18px); font-weight:700; color:#f8f800; line-height:1.42; min-height:1.5em;';
      dialogueBox.append(textEl, promptRowEl);
      wrap.appendChild(dialogueBox);

      if (this.revealBeat === 0) {
        this.startTypewriter(textEl, promptRowEl, '', 'You appear to be...');
      } else {
        this.startTypewriter(
          textEl,
          promptRowEl,
          'You appear to be...',
          ` the ${lordMeta.personalityTitle} type!`
        );
      }
    } else if (this.revealBeat === 2) {
      textEl.dataset.testid = 'quiz-personality-description';
      textEl.style.cssText =
        'margin:0; font-size:clamp(13px, 2vw, 15px); line-height:1.48; color:#f8f8f8; min-height:3em;';
      dialogueBox.append(textEl, promptRowEl);
      wrap.appendChild(dialogueBox);

      this.startTypewriter(textEl, promptRowEl, '', lordMeta.personalityDescription);
    } else if (this.revealBeat === 3) {
      const speciesName = sp?.name ?? lordMeta.name;
      textEl.dataset.testid = 'quiz-revealed-lord-name';
      textEl.style.cssText =
        'font-size:clamp(15px, 2.3vw, 18px); font-weight:700; color:#f8f800; line-height:1.42; min-height:1.5em;';
      dialogueBox.append(textEl, promptRowEl);
      wrap.appendChild(dialogueBox);

      this.startTypewriter(
        textEl,
        promptRowEl,
        '',
        `With that said, you must be... ${lordMeta.indefiniteArticle} ${speciesName}!`
      );
    } else {
      textEl.dataset.testid = 'quiz-reveal-farewell';
      textEl.style.cssText =
        'font-size:clamp(14px, 2.1vw, 17px); font-weight:700; color:#f8f8f8; line-height:1.42; min-height:1.5em;';
      promptRowEl.innerHTML = `<span>Tap or press Begin Adventure</span><span class="pmd-quiz-advance-arrow">▶</span>`;
      dialogueBox.append(textEl, promptRowEl);
      wrap.appendChild(dialogueBox);

      const actionRow = document.createElement('div');
      actionRow.style.cssText = 'display:flex; justify-content:flex-end;';
      actionRow.innerHTML = `
        <button type="button" class="pmd-btn pmd-btn-primary" data-testid="quiz-accept-lord-btn" style="min-height:46px; padding:8px 16px;">
          Begin Adventure ▶
        </button>
      `;

      bindPointerTap(
        actionRow.querySelector('[data-testid="quiz-accept-lord-btn"]'),
        () => {
          this.clearTypewriterTimer();
          this.finalizeCampaignCreation(
            this.selectedLordSpeciesId,
            this.computedQuizSeeds ?? evaluatePersonalityQuiz(this.answers).quizSeeds
          );
        },
        { stopPropagation: true }
      );
      wrap.appendChild(actionRow);

      this.startTypewriter(
        textEl,
        promptRowEl,
        '',
        'Now go forth and help save the world from certain destruction!'
      );
    }

    this.panelBodyEl.appendChild(wrap);
  }

  private finalizeCampaignCreation(
    lordSpeciesId: DragonLordSpeciesId,
    quizSeeds: QuizRecruitSeeds
  ): void {
    this.audioManager.playSfx('heal');
    const campaignMode: CampaignMode = this.activeOptions.campaignMode ?? 'demo';
    const startingLevel = this.activeOptions.startingLevel ?? DEMO_STARTING_LEVEL;
    const scaleStatsToLevel = this.activeOptions.scaleStatsToLevel ?? true;
    const initialConvoy = this.activeOptions.initialConvoy ?? DEMO_INITIAL_CONVOY;
    const graph = this.activeOptions.overworldGraph ?? DEMO_OVERWORLD_GRAPH;

    let created = this.saveManager.createNewCampaignSave({
      lordSpeciesId,
      partnerSpeciesId: 'piplup',
      healerSpeciesId: 'flabebe',
      quizSeeds,
      newGamePlusUnlocked: false,
      startingLevel,
      scaleStatsToLevel,
      campaignMode,
      initialConvoy,
    });

    created = this.saveManager.ensureOverworldInitialized(graph);
    const onComplete = this.activeOptions.onComplete;

    this.close();
    const latest = this.saveManager.getSave() ?? created;
    onComplete?.(latest);
  }

  public destroy(): void {
    this.close();
    this.abortController.abort();
    this.rootEl.remove();
  }
}
