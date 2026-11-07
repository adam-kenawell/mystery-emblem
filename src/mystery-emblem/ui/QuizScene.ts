/**
 * Mystery Emblem — Starting Personality Quiz, Partner Select, Reusable Nickname Wizard & NG+ Picker (Step 3)
 *
 * Implements:
 * 1. `RecruitNicknameOverlay`: Reusable PMD modal prompting custom nicknames whenever new Pokémon
 *    join the squad (both the initial Prologue trio after the Quiz and chapter recruits across maps).
 * 2. `QuizScene`:
 *    - 9-question PMD Personality Quiz tallying Dragon Lord trait points + seeding Q1–Q9 chapter recruits
 *    - Dragon Lord Aura Reveal (with optional manual Dragon Lord override)
 *    - Stage-1 Starter Partner Selection screen with live PMD portrait & Personal Skill preview
 *    - `NG_PLUS_SELECT_SCENE` manual roster selector (unlocked when `newGamePlusUnlocked === true`)
 *
 * Strictly obeys Rule 2 (100% Unified Pointer Events via `bindPointerTap` — ZERO keyboard listeners,
 * `>= 44x44px` touch targets, and zero viewport overflow across `1920x1080`, `390x844`, and `844x390`).
 */

import { getAudioManager, type AudioManager } from '../audio/AudioManager';
import { DEMO_INITIAL_CONVOY, DEMO_STARTING_LEVEL } from '../data/campaignRegistry';
import { getPersonalSkillById, getSpeciesById } from '../data/index';
import {
  DEFAULT_OVERWORLD_GRAPH,
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
// Reusable Multi-Unit Nickname Prompt Modal (`RecruitNicknameOverlay`)
// ============================================================================

export interface PromptRecruitsOptions {
  bannerText?: string;
}

export class RecruitNicknameOverlay {
  public readonly rootEl: HTMLElement;
  private readonly bannerEl: HTMLElement;
  private readonly stepBadgeEl: HTMLElement;
  private readonly speciesTitleEl: HTMLElement;
  private readonly speciesMetaEl: HTMLElement;
  private readonly skillDescEl: HTMLElement;
  private readonly inputEl: HTMLInputElement;
  private readonly portraitView: PmdPortraitView;
  private readonly confirmBtn: HTMLButtonElement;
  private readonly skipAllBtn: HTMLButtonElement;

  private readonly saveManager: SaveStateManager;
  private readonly audioManager: AudioManager;
  private readonly onStateChange?: () => void;
  private readonly abortController = new AbortController();

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
      <div class="pmd-window pmd-modal-card" role="dialog" aria-modal="true" aria-label="Name Recruited Pokémon" style="width:min(460px, 95vw); max-height:min(90dvh, 540px); overflow-y:auto;">
        <div class="pmd-devtools-row-between">
          <h2 class="pmd-modal-title" style="margin:0;">NEW ALLY JOINED!</h2>
          <span class="pmd-chapter-badge" data-recruit-step-badge>1 / 1</span>
        </div>
        <p class="pmd-modal-sub" data-recruit-banner style="margin:0.35rem 0 0.55rem; color:#bfe8ff;"></p>
        <div class="pmd-forecast-unit-head" style="background:rgba(6, 14, 32, 0.72); border:1px solid #3c78b4; border-radius:4px; padding:0.5rem; margin-bottom:0.55rem;">
          <div class="pmd-forecast-portrait-slot" data-recruit-portrait></div>
          <div class="pmd-forecast-unit-id">
            <strong class="pmd-forecast-unit-name" data-testid="recruit-species-title">Dratini</strong>
            <span class="pmd-forecast-unit-meta" data-recruit-species-meta>Dragon · Lv. 9</span>
            <span class="pmd-forecast-unit-meta" data-recruit-skill-desc style="color:#98f8b8; margin-top:0.15rem;"></span>
          </div>
        </div>
        <label class="pmd-field-label" for="pmd-recruit-nickname-input">Custom Nickname (1–16 chars)</label>
        <input
          id="pmd-recruit-nickname-input"
          data-testid="recruit-nickname-input"
          class="pmd-text-input"
          type="text"
          maxlength="16"
          autocomplete="off"
        />
        <div class="pmd-modal-actions" style="margin-top:0.65rem; display:flex; flex-wrap:wrap; gap:0.45rem; justify-content:space-between;">
          <button type="button" class="pmd-btn" data-testid="recruit-nickname-skip-all-btn" style="min-height:44px;">
            Keep Default Names
          </button>
          <button type="button" class="pmd-btn pmd-btn-primary" data-testid="recruit-nickname-confirm-btn" style="min-height:44px;">
            Confirm Name
          </button>
        </div>
      </div>
    `;

    this.bannerEl = this.rootEl.querySelector('[data-recruit-banner]')!;
    this.stepBadgeEl = this.rootEl.querySelector('[data-recruit-step-badge]')!;
    this.speciesTitleEl = this.rootEl.querySelector('[data-testid="recruit-species-title"]')!;
    this.speciesMetaEl = this.rootEl.querySelector('[data-recruit-species-meta]')!;
    this.skillDescEl = this.rootEl.querySelector('[data-recruit-skill-desc]')!;
    this.inputEl = this.rootEl.querySelector('[data-testid="recruit-nickname-input"]')!;
    this.confirmBtn = this.rootEl.querySelector('[data-testid="recruit-nickname-confirm-btn"]')!;
    this.skipAllBtn = this.rootEl.querySelector('[data-testid="recruit-nickname-skip-all-btn"]')!;

    this.portraitView = new PmdPortraitView({ testId: 'recruit-nickname-portrait' });
    this.rootEl.querySelector('[data-recruit-portrait]')!.appendChild(this.portraitView.canvas);

    mountParent.appendChild(this.rootEl);

    const signal = this.abortController.signal;
    bindPointerTap(this.confirmBtn, () => this.confirmCurrentAndAdvance(), {
      signal,
      stopPropagation: true,
    });
    bindPointerTap(this.skipAllBtn, () => this.finishAll(), {
      signal,
      stopPropagation: true,
    });
    bindBackGestureSurface(this.rootEl, () => this.confirmCurrentAndAdvance(), { signal });
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

    this.queue = [...units];
    this.queueIndex = 0;
    this.bannerEl.textContent =
      options?.bannerText ?? 'Give your newly recruited Pokémon a custom nickname (or keep their species name)!';
    this.skipAllBtn.hidden = units.length <= 1;
    this.rootEl.hidden = false;
    this.audioManager.playSfx('heal');
    this.renderCurrentUnit();
    this.onStateChange?.();

    return new Promise<void>((resolve) => {
      this.resolver = resolve;
    });
  }

  public handleBack(): void {
    if (!this.isOpen()) return;
    this.confirmCurrentAndAdvance();
  }

  private renderCurrentUnit(): void {
    const current = this.queue[this.queueIndex];
    if (!current) {
      this.finishAll();
      return;
    }

    const sp = getSpeciesById(current.speciesId);
    const skill = sp ? getPersonalSkillById(sp.personalSkillId) : undefined;
    const roleTag = current.isLord ? ' ★ [Dragon Lord]' : '';

    this.stepBadgeEl.textContent = `${this.queueIndex + 1} / ${this.queue.length}`;
    this.speciesTitleEl.textContent = `${sp?.name ?? current.speciesId}${roleTag}`;
    this.speciesMetaEl.textContent = `Lv. ${current.level} · ${sp?.types.join(' / ') ?? 'Normal'} · ${sp?.traversalClass ?? 'Grounded'}`;
    this.skillDescEl.textContent = skill ? `Skill: ${skill.name} — ${skill.description}` : '';
    this.inputEl.value = current.nickname || sp?.name || current.speciesId;
    this.confirmBtn.textContent =
      this.queueIndex + 1 < this.queue.length ? 'Save & Next ▶' : 'Confirm & Continue';

    void this.portraitView.setPortrait({
      speciesIdOrAssetId: current.speciesId,
      emotion: 'Happy',
    });
  }

  private confirmCurrentAndAdvance(): void {
    const current = this.queue[this.queueIndex];
    if (current) {
      const sp = getSpeciesById(current.speciesId);
      const trimmed = this.inputEl.value.trim() || current.nickname || sp?.name || 'Ally';
      try {
        this.saveManager.renamePokemon(current.instanceId, trimmed);
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

  // NG+ Custom Picker Selections (`Q1`..`Q9` option indices)
  private ngPlusSeedChoices: Record<string, QuizOptionKey> = {
    q1: 'A',
    q2: 'A',
    q3: 'A',
    q4: 'A',
    q5: 'A',
    q6: 'A',
    q7: 'A',
    q8: 'A',
    q9: 'A',
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
      'width:min(760px, 96vw)',
      'max-height:calc(100dvh - 3.6rem)',
      'display:flex',
      'flex-direction:column',
      'padding:clamp(0.65rem, 2vw, 1.1rem)',
      'box-sizing:border-box',
      'overflow:hidden',
    ].join(';');

    const header = document.createElement('div');
    header.className = 'pmd-devtools-row-between';
    header.style.cssText =
      'padding-bottom:0.45rem; margin-bottom:0.5rem; border-bottom:1px solid rgba(112, 200, 248, 0.35); flex-shrink:0;';
    header.innerHTML = `
      <strong data-quiz-header-title style="font-size:clamp(0.88rem, 2.2vw, 1.08rem); color:#f8d860; letter-spacing:0.04em;">
        AURA PERSONALITY QUIZ
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

    // Ensure `[hidden]` always hides flex container
    const styleEl = document.createElement('style');
    styleEl.textContent = `
      .pmd-quiz-scene[hidden] { display: none !important; }
      .pmd-quiz-opt-btn {
        width: 100%;
        min-height: 45px;
        text-align: left;
        justify-content: flex-start;
        padding: 0.5rem 0.7rem;
        line-height: 1.3;
        font-size: 0.82rem;
      }
      .pmd-quiz-partner-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(112px, 1fr));
        gap: 0.38rem;
        margin-top: 0.45rem;
      }
      .pmd-quiz-partner-chip {
        min-height: 45px;
        padding: 0.35rem 0.45rem;
        font-size: 0.75rem;
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        justify-content: center;
      }
      .pmd-quiz-partner-chip.is-active {
        border-color: #f8d048 !important;
        background: rgba(58, 96, 168, 0.88) !important;
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
    this.headerTitleEl.textContent = 'NEW CAMPAIGN — SELECT MODE';
    this.headerStepBadgeEl.textContent = 'NG+ UNLOCKED';

    const wrap = document.createElement('div');
    wrap.style.cssText = 'display:flex; flex-direction:column; gap:0.65rem;';
    wrap.innerHTML = `
      <p style="margin:0; color:#d8eeff; font-size:0.86rem; line-height:1.45;">
        A mysterious voice echoes from across the Five Kingdoms... Because New Game+ is unlocked,
        you may either answer the 9-question Aura Quiz or hand-pick your Dragon Lord, Partner, and chapter recruits!
      </p>
      <button type="button" class="pmd-btn pmd-btn-primary pmd-quiz-opt-btn" data-testid="quiz-mode-standard-btn">
        <span><strong>Standard Personality Quiz</strong><br/><small style="color:#cfe8ff;">Answer 9 questions to discover your Dragon Lord &amp; chapter allies</small></span>
      </button>
      <button type="button" class="pmd-btn pmd-quiz-opt-btn" data-testid="quiz-mode-ngplus-btn">
        <span><strong>New Game+ Custom Roster Selector</strong><br/><small style="color:#ffe888;">Directly choose your Dragon Lord, Partner, Healer &amp; Q2–Q9 recruits</small></span>
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
    this.headerTitleEl.textContent = 'AURA PERSONALITY QUIZ';
    this.headerStepBadgeEl.textContent = `Q${this.questionIndex + 1} / ${PERSONALITY_QUIZ_QUESTIONS.length}`;

    const wrap = document.createElement('div');
    wrap.style.cssText = 'display:flex; flex-direction:column; gap:0.5rem;';

    const promptP = document.createElement('p');
    promptP.dataset.testid = 'quiz-question-prompt';
    promptP.style.cssText =
      'margin:0 0 0.25rem; color:#ffffff; font-size:clamp(0.86rem, 2.1vw, 0.98rem); line-height:1.45; background:rgba(8, 20, 46, 0.65); border:1px solid rgba(100, 184, 240, 0.35); border-radius:4px; padding:0.55rem 0.7rem;';
    promptP.textContent = q.prompt;
    wrap.appendChild(promptP);

    const optStack = document.createElement('div');
    optStack.style.cssText = 'display:flex; flex-direction:column; gap:0.4rem;';

    for (const opt of q.options) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'pmd-btn pmd-quiz-opt-btn';
      btn.dataset.testid = `quiz-option-${opt.id}`;
      btn.innerHTML = `<span style="color:#ffd860; font-weight:700; margin-right:0.45rem;">${opt.id}.</span><span>${opt.text}</span>`;
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
    this.headerTitleEl.textContent = 'YOUR DRAGON AURA AWAKENS!';
    this.headerStepBadgeEl.textContent = 'LORD REVEAL';

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
      'display:flex; gap:0.75rem; align-items:center; flex-wrap:wrap; background:rgba(8, 20, 48, 0.78); border:1px solid #f8d048; border-radius:4px; padding:0.65rem;';
    heroCard.innerHTML = `
      <div class="pmd-forecast-portrait-slot" data-quiz-lord-portrait></div>
      <div style="flex:1; min-width:190px;">
        <div style="font-size:1rem; font-weight:700; color:#ffe878;" data-testid="quiz-revealed-lord-name">
          ${sp?.name ?? lordMeta.speciesId} — ${lordMeta.traitLabel}
        </div>
        <div style="font-size:0.78rem; color:#98dcff; margin-top:0.15rem;">
          Type: ${sp?.types.join(' / ') ?? 'Dragon'} · Prologue Healer Friend: <strong>${healerSp?.name ?? healerId}</strong>
        </div>
        <p style="margin:0.3rem 0 0; font-size:0.8rem; color:#e6f4ff; line-height:1.38;">
          ${lordMeta.auraSummary}
        </p>
        <p style="margin:0.25rem 0 0; font-size:0.76rem; color:#98f8b8;">
          Personal Skill: <strong>${skill?.name ?? 'Dragon Aura'}</strong> — ${skill?.description ?? 'Grants +2 Atk/SpA/+10 Hit to allies within 2 tiles.'}
        </p>
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
        ${this.overrideLordDrawerOpen ? 'Hide Dragon Lord List' : 'Choose Another Dragon Lord'}
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
    this.headerTitleEl.textContent = 'CHOOSE YOUR PARTNER STARTER';
    this.headerStepBadgeEl.textContent = 'PARTNER SELECT';

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
      'display:flex; gap:0.65rem; align-items:center; justify-content:space-between; flex-wrap:wrap; background:rgba(8, 20, 48, 0.78); border:1px solid #56b4f8; border-radius:4px; padding:0.55rem;';
    previewCard.innerHTML = `
      <div style="display:flex; gap:0.6rem; align-items:center; flex:1; min-width:200px;">
        <div class="pmd-forecast-portrait-slot" data-quiz-partner-portrait></div>
        <div>
          <strong style="color:#ffe878; font-size:0.95rem;" data-testid="quiz-selected-partner-name">${activeSp.name}</strong>
          <div style="font-size:0.75rem; color:#98dcff;">${activeSp.types.join(' / ')} · Mov ${activeSp.baseStats.mov} · Skill: ${activeSkill?.name ?? activeSp.personalSkillId}</div>
          <div style="font-size:0.73rem; color:#cfe8ff; margin-top:0.12rem;">${activeSkill?.description ?? ''}</div>
        </div>
      </div>
      <button type="button" class="pmd-btn pmd-btn-primary" data-testid="quiz-confirm-partner-btn" style="min-height:44px;">
        Begin Campaign with ${activeSp.name} ▶
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

    // Elemental Filter Bar
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
    this.headerTitleEl.textContent = 'NEW GAME+ CUSTOM ROSTER PICKER';
    this.headerStepBadgeEl.textContent = 'NG+ SELECTOR';

    const starters = getStarterPartnerOptions();
    const wrap = document.createElement('div');
    wrap.dataset.testid = 'ngplus-selector-panel';
    wrap.style.cssText = 'display:flex; flex-direction:column; gap:0.55rem;';

    const buildChoiceGroup = (
      title: string,
      choices: Array<{ id: string; label: string; active: boolean; testId: string; onPick: () => void }>
    ): HTMLElement => {
      const sec = document.createElement('div');
      sec.style.cssText =
        'background:rgba(8, 20, 48, 0.65); border:1px solid rgba(90, 168, 232, 0.35); border-radius:4px; padding:0.45rem 0.55rem;';
      const h = document.createElement('div');
      h.style.cssText = 'font-size:0.78rem; font-weight:700; color:#ffd860; margin-bottom:0.35rem;';
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
        '1. Dragon Lord (Stage 1)',
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
        '2. Partner Starter (Stage 1)',
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

    const slotLabels: ReadonlyArray<{ qIndex: number; key: string; title: string }> = [
      { qIndex: 0, key: 'q1', title: '3. Prologue Healer Friend (Q1)' },
      { qIndex: 1, key: 'q2', title: '4. Ch. 1 / Dungeon 2 Bug & Flying Duo (Q2)' },
      { qIndex: 2, key: 'q3', title: '5. Ch. 2 / Dungeon 3 Ghost & Psychic Duo (Q3)' },
      { qIndex: 3, key: 'q4', title: '6. Ch. 4 / Dungeon 5 Electric Tracker (Q4)' },
      { qIndex: 4, key: 'q5', title: '7. Ch. 5 Frontline Trio (Q5)' },
      { qIndex: 5, key: 'q6', title: '8. Ch. 7 Elemental Duo (Q6)' },
      { qIndex: 6, key: 'q7', title: '9. Ch. 8 Fire Vanguard (Q7)' },
      { qIndex: 7, key: 'q8', title: '10. Ch. 10 Steel & Fairy Duo (Q8)' },
      { qIndex: 8, key: 'q9', title: '11. Ch. 12 Ice & Armored Duo (Q9)' },
    ];

    for (const slot of slotLabels) {
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
    confirmBtn.textContent = 'Start New Game+ Campaign with Custom Roster ▶';
    bindPointerTap(confirmBtn, () => {
      const answerArray: QuizOptionKey[] = [
        this.ngPlusSeedChoices.q1 ?? 'A',
        this.ngPlusSeedChoices.q2 ?? 'A',
        this.ngPlusSeedChoices.q3 ?? 'A',
        this.ngPlusSeedChoices.q4 ?? 'A',
        this.ngPlusSeedChoices.q5 ?? 'A',
        this.ngPlusSeedChoices.q6 ?? 'A',
        this.ngPlusSeedChoices.q7 ?? 'A',
        this.ngPlusSeedChoices.q8 ?? 'A',
        this.ngPlusSeedChoices.q9 ?? 'A',
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
    const isDemo = campaignMode === 'demo';
    const startingLevel =
      this.activeOptions.startingLevel ?? (isDemo ? DEMO_STARTING_LEVEL : 1);
    const scaleStatsToLevel =
      this.activeOptions.scaleStatsToLevel ?? isDemo;
    const initialConvoy =
      this.activeOptions.initialConvoy ?? (isDemo ? DEMO_INITIAL_CONVOY : undefined);
    const graph =
      this.activeOptions.overworldGraph ??
      (isDemo ? DEMO_OVERWORLD_GRAPH : DEFAULT_OVERWORLD_GRAPH);

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
      await this.nicknameOverlay.promptRecruits(created.roster, {
        bannerText:
          'Name your awakened Dragon Lord, Partner Starter, and Prologue Healer Friend!',
      });
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
