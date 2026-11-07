/**
 * Mystery Emblem — Personality Quiz, Partner Select, Unified Nickname Modal & NG+ Picker
 *
 * Implements:
 * 1. `RecruitNicknameOverlay`: Single unified PMD modal for naming newly recruited Pokémon
 *    AND renaming existing squad members from Overworld or Dungeon Prep.
 * 2. `QuizScene`:
 *    - 9-question PMD Personality Quiz tallying Dragon Lord trait points + seeding recruits
 *    - Dragon Lord Aura Reveal (with optional manual Dragon Lord override)
 *    - Stage-1 Starter Partner Selection screen
 *    - `NG_PLUS_SELECT_SCENE` manual roster selector (trimmed cleanly to the 6 Demo slots)
 */

import { getAudioManager, type AudioManager } from '../audio/AudioManager';
import { DEMO_INITIAL_CONVOY, DEMO_STARTING_LEVEL } from '../data/campaignRegistry';
import { getPersonalSkillById, getSpeciesById } from '../data/index';
import {
  DEMO_OVERWORLD_GRAPH,
  type OverworldGraphDefinition,
} from '../data/overworldMapData';
import {
  DRAGON_LORD_OPTIONS,
  PERSONALITY_QUIZ_QUESTIONS,
  evaluatePersonalityQuiz,
  getStarterPartnerOptions,
  type QuizOptionKey,
} from '../data/quizData';
import type { SaveStateManager } from '../state/SaveStateManager';
import type {
  CampaignMode,
  ConvoyEntry,
  OwnedPokemonInstance,
  QuizRecruitSeeds,
  SaveData,
} from '../types/schemas';
import { PmdPortraitView } from './PmdSpriteCanvas';
import { bindBackGestureSurface, bindPointerTap } from './pointerControls';

// ============================================================================
// Unified Nickname / Rename Modal (`RecruitNicknameOverlay`)
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

  private mode: 'recruit' | 'rename' = 'recruit';
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
          <h2 class="pmd-modal-title" data-nickname-modal-title style="margin:0; color:#f8f800;">NEW ALLY</h2>
          <span class="pmd-chapter-badge" data-recruit-step-badge>1 / 1</span>
        </div>
        <p class="pmd-modal-sub" data-recruit-banner style="margin:0 0 8px; color:#a8e0f8; font-size:13px;" hidden></p>
        <div class="pmd-forecast-unit-head" style="background:#16344c; border:2px solid #a8c0e0; padding:8px; margin-bottom:8px;">
          <div class="pmd-forecast-portrait-slot" data-recruit-portrait></div>
          <div class="pmd-forecast-unit-id">
            <strong class="pmd-forecast-unit-name" data-testid="recruit-species-title">Dratini</strong>
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
            Skip
          </button>
          <button type="button" class="pmd-btn pmd-btn-primary" data-testid="recruit-nickname-confirm-btn" style="min-height:44px;">
            Confirm
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

  public async promptRecruits(
    units: ReadonlyArray<OwnedPokemonInstance>,
    options?: PromptRecruitsOptions
  ): Promise<void> {
    if (units.length === 0) return;

    if (this.resolver) {
      const prev = this.resolver;
      this.resolver = null;
      prev();
    }

    this.mode = 'recruit';
    this.activeSaveManagerOverride = null;
    this.queue = [...units];
    this.queueIndex = 0;

    const banner = options?.bannerText?.trim() ?? '';
    this.bannerEl.textContent = banner;
    this.bannerEl.hidden = banner.length === 0;

    this.modalTitleEl.textContent = 'NEW ALLY';
    this.cancelBtn.hidden = true;
    this.secondaryBtn.textContent = 'Skip';
    this.secondaryBtn.hidden = units.length <= 1;
    this.stepBadgeEl.hidden = units.length <= 1;

    this.rootEl.hidden = false;
    this.audioManager.playSfx('heal');
    this.renderCurrentUnit();
    this.onStateChange?.();

    return new Promise<void>((resolve) => {
      this.resolver = resolve;
    });
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
    this.speciesMetaEl.textContent = `Lv. ${current.level} · ${sp?.types.join(' / ') ?? 'Normal'} · ${sp?.traversalClass ?? 'Grounded'}`;
    this.skillDescEl.textContent = skill && this.mode === 'recruit' ? `${skill.name}` : '';
    this.inputEl.value = current.nickname || sp?.name || current.speciesId;

    if (this.mode === 'rename') {
      this.confirmBtn.textContent = 'Save';
    } else {
      this.confirmBtn.textContent =
        this.queueIndex + 1 < this.queue.length ? 'Next ▶' : 'Confirm';
    }

    void this.portraitView.setPortrait({
      speciesIdOrAssetId: current.speciesId,
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
// Personality Quiz, Partner Select & NG+ Custom Roster Scene (`QuizScene`)
// ============================================================================

export type QuizSceneStep =
  | 'mode_select'
  | 'questions'
  | 'lord_reveal'
  | 'partner_select'
  | 'ng_plus';

export interface OpenQuizSceneOptions {
  campaignMode?: CampaignMode;
  startingLevel?: number;
  scaleStatsToLevel?: boolean;
  initialConvoy?: ReadonlyArray<ConvoyEntry>;
  overworldGraph?: OverworldGraphDefinition;
  forceNgPlus?: boolean;
  skipNicknamePrompts?: boolean;
  onComplete?: (save: SaveData) => void;
}

export interface QuizSceneSnapshot {
  isOpen: boolean;
  step: QuizSceneStep;
  questionIndex: number;
  answers: QuizOptionKey[];
  selectedLordSpeciesId: string;
  selectedPartnerSpeciesId: string;
  overrideLordDrawerOpen: boolean;
  newGamePlusAvailable: boolean;
}

export class QuizScene {
  public readonly rootEl: HTMLElement;
  private readonly panelBodyEl: HTMLElement;
  private readonly headerStepBadgeEl: HTMLElement;
  private readonly headerTitleEl: HTMLElement;

  private readonly saveManager: SaveStateManager;
  private readonly nicknameOverlay: RecruitNicknameOverlay;
  private readonly audioManager: AudioManager;
  private readonly onCancelCallback: () => void;
  private readonly onStateChange?: () => void;
  private readonly abortController = new AbortController();

  private openState = false;
  private step: QuizSceneStep = 'questions';
  private questionIndex = 0;
  private answers: QuizOptionKey[] = [];
  private selectedLordSpeciesId = 'dratini';
  private overrideLordDrawerOpen = false;
  private selectedPartnerSpeciesId = 'bulbasaur';
  private partnerTypeFilter: 'All' | 'Grass' | 'Fire' | 'Water' = 'All';
  private computedQuizSeeds: QuizRecruitSeeds | null = null;

  private ngPlusSeedChoices: Record<string, QuizOptionKey> = {
    q1: 'A',
    q2: 'A',
    q3: 'A',
    q4: 'A',
  };

  private activeOptions: OpenQuizSceneOptions = {};
  private lordPortraitView: PmdPortraitView | null = null;
  private partnerPortraitView: PmdPortraitView | null = null;

  constructor(
    mountParent: HTMLElement,
    saveManager: SaveStateManager,
    nicknameOverlay: RecruitNicknameOverlay,
    options: {
      audioManager?: AudioManager;
      onCancel: () => void;
      onStateChange?: () => void;
    }
  ) {
    this.saveManager = saveManager;
    this.nicknameOverlay = nicknameOverlay;
    this.audioManager = options.audioManager ?? getAudioManager();
    this.onCancelCallback = options.onCancel;
    this.onStateChange = options.onStateChange;

    this.rootEl = document.createElement('section');
    this.rootEl.className = 'pmd-quiz-scene';
    this.rootEl.dataset.testid = 'quiz-scene';
    this.rootEl.hidden = true;
    this.rootEl.setAttribute('aria-label', 'Personality Quiz and Squad Creation');
    this.rootEl.style.cssText = [
      'position:absolute',
      'inset:0',
      'z-index:72',
      'display:flex',
      'align-items:center',
      'justify-content:center',
      'padding:clamp(0.45rem, 2vw, 1rem)',
      'padding-top:clamp(2.9rem, 7vh, 3.6rem)',
      'background:radial-gradient(circle at 50% 25%, rgba(28, 68, 128, 0.92), rgba(4, 10, 24, 0.97))',
      'box-sizing:border-box',
    ].join(';');
    this.rootEl.hidden = true;

    const card = document.createElement('div');
    card.className = 'pmd-window';
    card.style.cssText = [
      'width:min(720px, 96vw)',
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
      <span class="pmd-chapter-badge" data-quiz-step-badge>Q1 / 9</span>
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
      .pmd-quiz-partner-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(114px, 1fr));
        gap: 6px;
        margin-top: 8px;
      }
      .pmd-quiz-partner-chip {
        min-height: 46px;
        padding: 6px 8px;
        font-size: 12px;
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        justify-content: center;
      }
    `;
    this.rootEl.appendChild(styleEl);

    bindBackGestureSurface(this.rootEl, () => this.handleBack(), {
      signal: this.abortController.signal,
    });
  }

  public isOpen(): boolean {
    return this.openState && !this.rootEl.hidden;
  }

  public open(options?: OpenQuizSceneOptions): void {
    this.activeOptions = options ?? {};
    this.openState = true;
    this.questionIndex = 0;
    this.answers = [];
    this.overrideLordDrawerOpen = false;
    this.partnerTypeFilter = 'All';

    const starters = getStarterPartnerOptions();
    this.selectedPartnerSpeciesId = starters[0]?.id ?? 'bulbasaur';
    this.selectedLordSpeciesId = DRAGON_LORD_OPTIONS[0]?.speciesId ?? 'dratini';

    const ngPlusUnlocked = this.saveManager.isNewGamePlusUnlocked();
    if (options?.forceNgPlus) {
      this.step = 'ng_plus';
    } else if (ngPlusUnlocked) {
      this.step = 'mode_select';
    } else {
      this.step = 'questions';
    }

    this.rootEl.hidden = false;
    this.audioManager.playBgm('personality_quiz', { fadeMs: 260 });
    this.render();
    this.onStateChange?.();
  }

  public close(): void {
    if (!this.openState) return;
    this.openState = false;
    this.rootEl.hidden = true;
    this.onStateChange?.();
  }

  public handleBack(): void {
    if (!this.isOpen()) return;
    this.audioManager.playSfx('cancel');

    if (this.step === 'partner_select') {
      this.step = 'lord_reveal';
      this.render();
      return;
    }
    if (this.step === 'lord_reveal') {
      this.step = 'questions';
      this.questionIndex = PERSONALITY_QUIZ_QUESTIONS.length - 1;
      this.answers = this.answers.slice(0, this.questionIndex);
      this.render();
      return;
    }
    if (this.step === 'questions') {
      if (this.questionIndex > 0) {
        this.questionIndex -= 1;
        this.answers = this.answers.slice(0, this.questionIndex);
        this.render();
        return;
      }
      if (this.saveManager.isNewGamePlusUnlocked()) {
        this.step = 'mode_select';
        this.render();
        return;
      }
    }
    if (this.step === 'ng_plus' && this.saveManager.isNewGamePlusUnlocked() && !this.activeOptions.forceNgPlus) {
      this.step = 'mode_select';
      this.render();
      return;
    }

    this.close();
    this.onCancelCallback();
  }

  public getSnapshot(): QuizSceneSnapshot {
    return {
      isOpen: this.isOpen(),
      step: this.step,
      questionIndex: this.questionIndex,
      answers: [...this.answers],
      selectedLordSpeciesId: this.selectedLordSpeciesId,
      selectedPartnerSpeciesId: this.selectedPartnerSpeciesId,
      overrideLordDrawerOpen: this.overrideLordDrawerOpen,
      newGamePlusAvailable: this.saveManager.isNewGamePlusUnlocked(),
    };
  }

  private render(): void {
    this.panelBodyEl.innerHTML = '';

    if (this.step === 'mode_select') {
      this.renderModeSelect();
    } else if (this.step === 'questions') {
      this.renderQuestionStep();
    } else if (this.step === 'lord_reveal') {
      this.renderLordRevealStep();
    } else if (this.step === 'partner_select') {
      this.renderPartnerSelectStep();
    } else {
      this.renderNgPlusPicker();
    }
  }

  private renderModeSelect(): void {
    this.headerTitleEl.textContent = 'NEW GAME';
    this.headerStepBadgeEl.textContent = 'NG+';

    const wrap = document.createElement('div');
    wrap.className = 'pmd-menu-list';
    wrap.style.cssText = 'display:flex; flex-direction:column; gap:0;';
    wrap.innerHTML = `
      <button type="button" class="pmd-btn pmd-btn-primary pmd-menu-row pmd-quiz-opt-btn" data-testid="quiz-mode-standard-btn">
        <span><strong>Personality Quiz</strong> — <small style="color:#a8e0f8;">9 questions</small></span>
      </button>
      <button type="button" class="pmd-btn pmd-menu-row pmd-quiz-opt-btn" data-testid="quiz-mode-ngplus-btn">
        <span><strong>Custom Roster (NG+)</strong> — <small style="color:#58f858;">Pick every unit</small></span>
      </button>
    `;

    bindPointerTap(wrap.querySelector('[data-testid="quiz-mode-standard-btn"]'), () => {
      this.audioManager.playSfx('select');
      this.step = 'questions';
      this.questionIndex = 0;
      this.answers = [];
      this.render();
    });
    bindPointerTap(wrap.querySelector('[data-testid="quiz-mode-ngplus-btn"]'), () => {
      this.audioManager.playSfx('select');
      this.step = 'ng_plus';
      this.render();
    });

    this.panelBodyEl.appendChild(wrap);
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
      bindPointerTap(btn, () => {
        this.audioManager.playSfx('select');
        this.answers[this.questionIndex] = opt.id;
        if (this.questionIndex + 1 < PERSONALITY_QUIZ_QUESTIONS.length) {
          this.questionIndex += 1;
          this.render();
        } else {
          const result = evaluatePersonalityQuiz(this.answers);
          this.selectedLordSpeciesId = result.assignedLordSpeciesId;
          this.computedQuizSeeds = result.quizSeeds;
          this.overrideLordDrawerOpen = false;
          this.step = 'lord_reveal';
          this.audioManager.playSfx('heal');
          this.render();
        }
      });
      optStack.appendChild(btn);
    }

    wrap.appendChild(optStack);
    this.panelBodyEl.appendChild(wrap);
  }

  private renderLordRevealStep(): void {
    this.headerTitleEl.textContent = 'YOUR DRAGON AURA';
    this.headerStepBadgeEl.textContent = 'LORD';

    const lordMeta =
      DRAGON_LORD_OPTIONS.find((d) => d.speciesId === this.selectedLordSpeciesId) ??
      DRAGON_LORD_OPTIONS[0]!;
    const sp = getSpeciesById(lordMeta.speciesId);
    const skill = sp ? getPersonalSkillById(sp.personalSkillId) : undefined;
    const healerId = this.computedQuizSeeds?.q1Healer[0] ?? 'happiny';
    const healerSp = getSpeciesById(healerId);

    const wrap = document.createElement('div');
    wrap.style.cssText = 'display:flex; flex-direction:column; gap:0.55rem;';

    const heroCard = document.createElement('div');
    heroCard.style.cssText =
      'display:flex; gap:10px; align-items:center; flex-wrap:wrap; background:#16344c; border:2px solid #f8d838; padding:10px;';
    heroCard.innerHTML = `
      <div class="pmd-forecast-portrait-slot" data-quiz-lord-portrait></div>
      <div style="flex:1; min-width:190px;">
        <div style="font-size:16px; font-weight:700; color:#f8f800;" data-testid="quiz-revealed-lord-name">
          ${sp?.name ?? lordMeta.speciesId} · ${lordMeta.traitLabel}
        </div>
        <div style="font-size:12px; color:#a8e0f8; margin-top:2px;">
          ${sp?.types.join(' / ') ?? 'Dragon'} · Healer: <strong style="color:#f8f800;">${healerSp?.name ?? healerId}</strong>
        </div>
        <div style="margin-top:4px; font-size:13px; color:#f8f8f8;">
          ${lordMeta.auraSummary}
        </div>
        <div style="margin-top:3px; font-size:12px; color:#58f858;">
          <strong>${skill?.name ?? 'Dragon Aura'}</strong>: ${skill?.description ?? '+2 Atk/SpA, +10 Hit within 2 tiles.'}
        </div>
      </div>
    `;

    if (!this.lordPortraitView) {
      this.lordPortraitView = new PmdPortraitView({ testId: 'quiz-lord-portrait-canvas' });
    }
    heroCard.querySelector('[data-quiz-lord-portrait]')!.appendChild(this.lordPortraitView.canvas);
    void this.lordPortraitView.setPortrait({
      speciesIdOrAssetId: lordMeta.speciesId,
      emotion: 'Determined',
    });

    wrap.appendChild(heroCard);

    const actionRow = document.createElement('div');
    actionRow.style.cssText = 'display:flex; flex-wrap:wrap; gap:0.45rem; justify-content:space-between;';
    actionRow.innerHTML = `
      <button type="button" class="pmd-btn" data-testid="quiz-toggle-override-lord-btn" style="min-height:44px;">
        ${this.overrideLordDrawerOpen ? 'Hide List' : 'Change Lord'}
      </button>
      <button type="button" class="pmd-btn pmd-btn-primary" data-testid="quiz-accept-lord-btn" style="min-height:44px;">
        Continue as ${sp?.name ?? lordMeta.speciesId} ▶
      </button>
    `;

    bindPointerTap(actionRow.querySelector('[data-testid="quiz-toggle-override-lord-btn"]'), () => {
      this.audioManager.playSfx('select');
      this.overrideLordDrawerOpen = !this.overrideLordDrawerOpen;
      this.render();
    });
    bindPointerTap(actionRow.querySelector('[data-testid="quiz-accept-lord-btn"]'), () => {
      this.audioManager.playSfx('select');
      this.step = 'partner_select';
      this.render();
    });
    wrap.appendChild(actionRow);

    if (this.overrideLordDrawerOpen) {
      const grid = document.createElement('div');
      grid.className = 'pmd-quiz-partner-grid';
      for (const opt of DRAGON_LORD_OPTIONS) {
        const optSp = getSpeciesById(opt.speciesId);
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `pmd-btn pmd-quiz-partner-chip${opt.speciesId === this.selectedLordSpeciesId ? ' is-active' : ''}`;
        btn.dataset.testid = `quiz-override-lord-${opt.speciesId}`;
        btn.innerHTML = `
          <strong>${optSp?.name ?? opt.speciesId}</strong>
          <small style="color:#98dcff;">${optSp?.types.join('/') ?? 'Dragon'}</small>
        `;
        bindPointerTap(btn, () => {
          this.audioManager.playSfx('select');
          this.selectedLordSpeciesId = opt.speciesId;
          this.render();
        });
        grid.appendChild(btn);
      }
      wrap.appendChild(grid);
    }

    this.panelBodyEl.appendChild(wrap);
  }

  private renderPartnerSelectStep(): void {
    this.headerTitleEl.textContent = 'CHOOSE PARTNER';
    this.headerStepBadgeEl.textContent = 'PARTNER';

    const allStarters = getStarterPartnerOptions();
    const filtered =
      this.partnerTypeFilter === 'All'
        ? allStarters
        : allStarters.filter((sp) => sp.types.includes(this.partnerTypeFilter as 'Grass' | 'Fire' | 'Water'));

    if (!allStarters.some((s) => s.id === this.selectedPartnerSpeciesId) && allStarters[0]) {
      this.selectedPartnerSpeciesId = allStarters[0].id;
    }

    const activeSp = getSpeciesById(this.selectedPartnerSpeciesId) ?? allStarters[0]!;
    const activeSkill = getPersonalSkillById(activeSp.personalSkillId);

    const wrap = document.createElement('div');
    wrap.style.cssText = 'display:flex; flex-direction:column; gap:0.5rem;';

    const previewCard = document.createElement('div');
    previewCard.style.cssText =
      'display:flex; gap:10px; align-items:center; justify-content:space-between; flex-wrap:wrap; background:#16344c; border:2px solid #a8c0e0; padding:8px 10px;';
    previewCard.innerHTML = `
      <div style="display:flex; gap:10px; align-items:center; flex:1; min-width:200px;">
        <div class="pmd-forecast-portrait-slot" data-quiz-partner-portrait></div>
        <div>
          <strong style="color:#f8f800; font-size:16px;" data-testid="quiz-selected-partner-name">${activeSp.name}</strong>
          <div style="font-size:12px; color:#a8e0f8;">${activeSp.types.join(' / ')} · Mov ${activeSp.baseStats.mov}</div>
          <div style="font-size:12px; color:#58f858; margin-top:2px;"><strong>${activeSkill?.name ?? activeSp.personalSkillId}</strong>: ${activeSkill?.description ?? ''}</div>
        </div>
      </div>
      <button type="button" class="pmd-btn pmd-btn-primary" data-testid="quiz-confirm-partner-btn" style="min-height:44px;">
        Start with ${activeSp.name} ▶
      </button>
    `;

    if (!this.partnerPortraitView) {
      this.partnerPortraitView = new PmdPortraitView({ testId: 'quiz-partner-portrait-canvas' });
    }
    previewCard
      .querySelector('[data-quiz-partner-portrait]')!
      .appendChild(this.partnerPortraitView.canvas);
    void this.partnerPortraitView.setPortrait({
      speciesIdOrAssetId: activeSp.id,
      emotion: 'Happy',
    });

    bindPointerTap(previewCard.querySelector('[data-testid="quiz-confirm-partner-btn"]'), () => {
      void this.finalizeCampaignCreation(
        this.selectedLordSpeciesId,
        this.selectedPartnerSpeciesId,
        this.computedQuizSeeds ?? evaluatePersonalityQuiz(this.answers).quizSeeds
      );
    });
    wrap.appendChild(previewCard);

    const filterRow = document.createElement('div');
    filterRow.style.cssText = 'display:flex; flex-wrap:wrap; gap:0.35rem;';
    for (const f of ['All', 'Grass', 'Fire', 'Water'] as const) {
      const fBtn = document.createElement('button');
      fBtn.type = 'button';
      fBtn.className = `pmd-btn pmd-chip-btn${this.partnerTypeFilter === f ? ' is-active' : ''}`;
      fBtn.dataset.testid = `quiz-partner-filter-${f.toLowerCase()}`;
      fBtn.style.minHeight = '44px';
      fBtn.textContent = f;
      bindPointerTap(fBtn, () => {
        this.audioManager.playSfx('select');
        this.partnerTypeFilter = f;
        this.render();
      });
      filterRow.appendChild(fBtn);
    }
    wrap.appendChild(filterRow);

    const grid = document.createElement('div');
    grid.className = 'pmd-quiz-partner-grid';
    for (const sp of filtered) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `pmd-btn pmd-quiz-partner-chip${sp.id === this.selectedPartnerSpeciesId ? ' is-active' : ''}`;
      btn.dataset.testid = `quiz-partner-${sp.id}`;
      btn.innerHTML = `
        <strong>${sp.name}</strong>
        <small style="color:#98dcff;">${sp.types.join('/')}</small>
      `;
      bindPointerTap(btn, () => {
        this.audioManager.playSfx('select');
        this.selectedPartnerSpeciesId = sp.id;
        this.render();
      });
      grid.appendChild(btn);
    }
    wrap.appendChild(grid);

    this.panelBodyEl.appendChild(wrap);
  }

  private renderNgPlusPicker(): void {
    this.headerTitleEl.textContent = 'CUSTOM ROSTER';
    this.headerStepBadgeEl.textContent = 'NG+';

    const starters = getStarterPartnerOptions();
    const wrap = document.createElement('div');
    wrap.dataset.testid = 'ngplus-selector-panel';
    wrap.style.cssText = 'display:flex; flex-direction:column; gap:0.5rem;';

    const buildChoiceGroup = (
      title: string,
      choices: Array<{ id: string; label: string; active: boolean; testId: string; onPick: () => void }>
    ): HTMLElement => {
      const sec = document.createElement('div');
      sec.style.cssText =
        'background:#16344c; border:2px solid rgba(168, 192, 224, 0.45); padding:8px 10px;';
      const h = document.createElement('div');
      h.style.cssText = 'font-size:13px; font-weight:700; color:#f8f800; margin-bottom:6px;';
      h.textContent = title;
      sec.appendChild(h);

      const row = document.createElement('div');
      row.style.cssText = 'display:flex; flex-wrap:wrap; gap:0.35rem;';
      for (const ch of choices) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = `pmd-btn pmd-chip-btn${ch.active ? ' is-active' : ''}`;
        b.dataset.testid = ch.testId;
        b.style.minHeight = '44px';
        b.textContent = ch.label;
        bindPointerTap(b, () => {
          this.audioManager.playSfx('select');
          ch.onPick();
          this.render();
        });
        row.appendChild(b);
      }
      sec.appendChild(row);
      return sec;
    };

    wrap.appendChild(
      buildChoiceGroup(
        '1. Dragon Lord',
        DRAGON_LORD_OPTIONS.map((d) => ({
          id: d.speciesId,
          label: getSpeciesById(d.speciesId)?.name ?? d.speciesId,
          active: this.selectedLordSpeciesId === d.speciesId,
          testId: `ngplus-lord-${d.speciesId}`,
          onPick: () => {
            this.selectedLordSpeciesId = d.speciesId;
          },
        }))
      )
    );

    wrap.appendChild(
      buildChoiceGroup(
        '2. Partner',
        starters.map((s) => ({
          id: s.id,
          label: s.name,
          active: this.selectedPartnerSpeciesId === s.id,
          testId: `ngplus-partner-${s.id}`,
          onPick: () => {
            this.selectedPartnerSpeciesId = s.id;
          },
        }))
      )
    );

    const demoSlots: ReadonlyArray<{ qIndex: number; key: string; title: string }> = [
      { qIndex: 0, key: 'q1', title: '3. Beach Cave Healer' },
      { qIndex: 1, key: 'q2', title: '4. Drenched Bluff Duo' },
      { qIndex: 2, key: 'q3', title: '5. Mt. Bristle Duo' },
      { qIndex: 3, key: 'q4', title: '6. Apple Woods Tracker' },
    ];

    for (const slot of demoSlots) {
      const qDef = PERSONALITY_QUIZ_QUESTIONS[slot.qIndex]!;
      wrap.appendChild(
        buildChoiceGroup(
          slot.title,
          qDef.options.map((opt) => ({
            id: opt.id,
            label: opt.recruitSpeciesIds
              .map((sid) => getSpeciesById(sid)?.name ?? sid)
              .join(' + '),
            active: (this.ngPlusSeedChoices[slot.key] ?? 'A') === opt.id,
            testId: `ngplus-${slot.key}-${opt.id}`,
            onPick: () => {
              this.ngPlusSeedChoices[slot.key] = opt.id;
            },
          }))
        )
      );
    }

    const confirmBtn = document.createElement('button');
    confirmBtn.type = 'button';
    confirmBtn.className = 'pmd-btn pmd-btn-primary';
    confirmBtn.dataset.testid = 'ngplus-confirm-roster-btn';
    confirmBtn.style.minHeight = '46px';
    confirmBtn.textContent = 'Start Campaign ▶';
    bindPointerTap(confirmBtn, () => {
      const answerArray: QuizOptionKey[] = [
        this.ngPlusSeedChoices.q1 ?? 'A',
        this.ngPlusSeedChoices.q2 ?? 'A',
        this.ngPlusSeedChoices.q3 ?? 'A',
        this.ngPlusSeedChoices.q4 ?? 'A',
        'A',
        'A',
        'A',
        'A',
        'A',
      ];
      const evaluated = evaluatePersonalityQuiz(answerArray);
      void this.finalizeCampaignCreation(
        this.selectedLordSpeciesId,
        this.selectedPartnerSpeciesId,
        evaluated.quizSeeds
      );
    });
    wrap.appendChild(confirmBtn);

    this.panelBodyEl.appendChild(wrap);
  }

  private async finalizeCampaignCreation(
    lordSpeciesId: string,
    partnerSpeciesId: string,
    quizSeeds: QuizRecruitSeeds
  ): Promise<void> {
    this.audioManager.playSfx('heal');
    const campaignMode: CampaignMode = this.activeOptions.campaignMode ?? 'demo';
    const startingLevel = this.activeOptions.startingLevel ?? DEMO_STARTING_LEVEL;
    const scaleStatsToLevel = this.activeOptions.scaleStatsToLevel ?? true;
    const initialConvoy = this.activeOptions.initialConvoy ?? DEMO_INITIAL_CONVOY;
    const graph = this.activeOptions.overworldGraph ?? DEMO_OVERWORLD_GRAPH;

    const healerSpeciesId = quizSeeds.q1Healer[0] ?? 'happiny';
    const preserveNgPlus = this.saveManager.isNewGamePlusUnlocked();

    let created = this.saveManager.createNewCampaignSave({
      lordSpeciesId,
      partnerSpeciesId,
      healerSpeciesId,
      quizSeeds,
      newGamePlusUnlocked: preserveNgPlus,
      startingLevel,
      scaleStatsToLevel,
      campaignMode,
      initialConvoy,
    });

    created = this.saveManager.ensureOverworldInitialized(graph);
    const skipPrompts = Boolean(this.activeOptions.skipNicknamePrompts);
    const onComplete = this.activeOptions.onComplete;

    this.close();

    if (!skipPrompts && created.roster.length > 0) {
      await this.nicknameOverlay.promptRecruits(created.roster);
    }

    const latest = this.saveManager.getSave() ?? created;
    onComplete?.(latest);
  }

  public destroy(): void {
    this.close();
    this.abortController.abort();
    this.rootEl.remove();
  }
}
