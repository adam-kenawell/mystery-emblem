/**
 * Mystery Emblem - Mystical Aura Wave Personality Quiz & NG+ Coordinator (`QuizScene.ts`)
 */

import { getAudioManager, type AudioManager } from '../audio/AudioManager';
import { DEMO_INITIAL_CONVOY, DEMO_STARTING_LEVEL } from '../data/campaignRegistry';
import { DEMO_OVERWORLD_GRAPH, type OverworldGraphDefinition } from '../data/overworldMapData';
import {
  DEFAULT_QUIZ_BACKDROP_CSS, DRAGON_LORD_OPTIONS, MYSTICAL_QUIZ_WAVE_PALETTE,
  PERSONALITY_QUIZ_QUESTIONS, evaluatePersonalityQuiz, getDragonLordTraitInfo,
  type DragonLordSpeciesId, type QuizOptionKey,
} from '../data/quizData';
import type { SaveStateManager } from '../state/SaveStateManager';
import type { CampaignMode, ConvoyEntry, SaveData, StatKeySix } from '../types/schemas';
import { PmdPortraitView } from './PmdSpriteCanvas';
import { bindPointerTap } from './pointerControls';
import { TypewriterController, prefersReducedMotionEnabled } from './typewriterController';
import { AuraWaveCanvas } from './quiz/AuraWaveCanvas';
import { renderNgPlusRosterSelectorView } from './quiz/NgPlusRosterSelectorView';
import {
  renderQuizHeroCustomizeView,
  type HeroCustomizationDraft,
} from './quiz/QuizHeroCustomizeView';
import { renderQuizLordRevealView, type QuizRevealBeat } from './quiz/QuizRevealSequenceView';
import {
  appendQuizQuestionOptionsWindow, renderQuizQuestionWindow, renderQuizWelcomePopup, showFirstVisitAudioNotice,
  type QuizQuestionDescriptor,
} from './quiz/QuizWelcomeAndQuestionsView';

export type QuizSceneStep = 'welcome' | 'questions' | 'lord_reveal' | 'customize' | 'ng_plus';

export interface OpenQuizSceneOptions {
  campaignMode?: CampaignMode;
  startingLevel?: number;
  scaleStatsToLevel?: boolean;
  initialConvoy?: ReadonlyArray<ConvoyEntry>;
  overworldGraph?: OverworldGraphDefinition;
  typewriterMsPerChar?: number;
  startInNgPlusSelector?: boolean;
  onComplete?: (save: SaveData) => void;
}

export type { QuizRevealBeat };

const TOTAL_QUIZ_QUESTION_COUNT = PERSONALITY_QUIZ_QUESTIONS.length;
const DEFAULT_TYPEWRITER_MS_PER_CHAR = 20;

function computeQuizBackTransition(params: {
  step: QuizSceneStep;
  revealBeat: QuizRevealBeat;
  enteredCustomizeFromNgPlus: boolean;
  questionIndex: number;
  totalQuestionCount: number;
  answers: QuizOptionKey[];
}): {
  action: 'rerender' | 'cancel_scene';
  nextStep: QuizSceneStep;
  nextRevealBeat: QuizRevealBeat;
  nextQuestionIndex: number;
  nextAnswers: QuizOptionKey[];
} {
  const { step, revealBeat, enteredCustomizeFromNgPlus, questionIndex, totalQuestionCount, answers } = params;
  if (step === 'ng_plus') {
    return { action: 'rerender', nextStep: 'welcome', nextRevealBeat: 0, nextQuestionIndex: questionIndex, nextAnswers: answers };
  }
  if (step === 'customize') {
    if (enteredCustomizeFromNgPlus) {
      return { action: 'rerender', nextStep: 'ng_plus', nextRevealBeat: 0, nextQuestionIndex: questionIndex, nextAnswers: answers };
    }
    return { action: 'rerender', nextStep: 'lord_reveal', nextRevealBeat: 3, nextQuestionIndex: questionIndex, nextAnswers: answers };
  }
  if (step === 'lord_reveal') {
    if (revealBeat === 4) {
      return { action: 'rerender', nextStep: 'customize', nextRevealBeat: 3, nextQuestionIndex: questionIndex, nextAnswers: answers };
    }
    return { action: 'rerender', nextStep: 'questions', nextRevealBeat: 0, nextQuestionIndex: totalQuestionCount - 1, nextAnswers: answers };
  }
  if (step === 'questions') {
    if (questionIndex > 0) {
      return {
        action: 'rerender',
        nextStep: 'questions',
        nextRevealBeat: 0,
        nextQuestionIndex: questionIndex - 1,
        nextAnswers: answers.slice(0, questionIndex - 1),
      };
    }
    return { action: 'rerender', nextStep: 'welcome', nextRevealBeat: 0, nextQuestionIndex: 0, nextAnswers: answers };
  }
  return { action: 'cancel_scene', nextStep: step, nextRevealBeat: 0, nextQuestionIndex: questionIndex, nextAnswers: answers };
}

function applyQuizBackdropForStep(
  rootEl: HTMLElement,
  waveEngine: AuraWaveCanvas,
  step: QuizSceneStep,
  revealBeat: QuizRevealBeat,
  selectedLordSpeciesId: DragonLordSpeciesId
): void {
  if ((step === 'lord_reveal' && revealBeat >= 3) || step === 'customize' || step === 'ng_plus') {
    const lordMeta = getDragonLordTraitInfo(selectedLordSpeciesId);
    rootEl.style.background = lordMeta.revealBackdropCss;
    rootEl.dataset.auraFlowerColor = lordMeta.flabebeFlowerColor;
    waveEngine.setTargetPalette(lordMeta.auraWavePalette, false, false);
  } else {
    rootEl.style.background = DEFAULT_QUIZ_BACKDROP_CSS;
    delete rootEl.dataset.auraFlowerColor;
    waveEngine.setTargetPalette(MYSTICAL_QUIZ_WAVE_PALETTE, false, true);
  }
}

export class QuizScene {
  public readonly rootEl: HTMLElement;
  private readonly waveEngine: AuraWaveCanvas;
  private readonly stageEl: HTMLElement;
  private readonly fadeOverlayEl: HTMLElement;
  private readonly typewriter = new TypewriterController();
  private activePromptEl: HTMLElement | null = null;
  private audioNoticeEl: HTMLElement | null = null;

  private readonly saveManager: SaveStateManager;
  private readonly audioManager: AudioManager;
  private readonly onCancelCallback: () => void;
  private readonly onStateChange?: () => void;
  private readonly abortController = new AbortController();

  private openState = false;
  private finalizing = false;
  private finalizeTimer: number | null = null;
  private step: QuizSceneStep = 'welcome';
  private revealBeat: QuizRevealBeat = 0;
  private questionIndex = 0;
  private questionOptionsRevealed = false;
  private answers: QuizOptionKey[] = [];
  private selectedLordSpeciesId: DragonLordSpeciesId = 'axew';
  private enteredCustomizeFromNgPlus = false;
  private heroDraft: HeroCustomizationDraft = {
    nickname: '',
    birthMonth: 1,
    birthDay: 1,
    boonStat: 'atk' as StatKeySix,
    baneStat: 'def' as StatKeySix,
  };
  private activeRevealTextEl: HTMLElement | null = null;

  private activeOptions: OpenQuizSceneOptions = {};
  private lordPortraitView: PmdPortraitView | null = null;
  private suppressTapUntilMs = 0;

  constructor(
    mountParent: HTMLElement,
    saveManager: SaveStateManager,
    options: { audioManager?: AudioManager; onCancel: () => void; onStateChange?: () => void }
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
    this.rootEl.style.cssText = `position:absolute;inset:0;z-index:72;display:flex;align-items:center;justify-content:center;overflow:hidden;background:${DEFAULT_QUIZ_BACKDROP_CSS};box-sizing:border-box`;

    this.waveEngine = new AuraWaveCanvas(this.rootEl);
    this.stageEl = document.createElement('div');
    this.stageEl.className = 'pmd-quiz-stage';
    this.stageEl.dataset.testid = 'quiz-panel-body';
    this.fadeOverlayEl = document.createElement('div');
    this.fadeOverlayEl.style.cssText = 'position:absolute;inset:0;z-index:5;background:#000000;opacity:0;pointer-events:none;';
    this.rootEl.append(this.waveEngine.canvasEl, this.stageEl, this.fadeOverlayEl);
    mountParent.appendChild(this.rootEl);

    bindPointerTap(
      this.rootEl,
      () => {
        if (this.finalizing || performance.now() < this.suppressTapUntilMs) return;
        if (this.step === 'questions') this.handleQuestionScreenTap();
        else if (this.step === 'lord_reveal') this.handleRevealAdvanceTap();
      },
      { signal: this.abortController.signal }
    );
  }

  public isOpen(): boolean { return this.openState && !this.rootEl.hidden; }

  public open(options?: OpenQuizSceneOptions): void {
    this.resetFinalizeFade();
    this.typewriter.stop();
    this.activeOptions = options ?? {};
    this.openState = true;
    this.step = options?.startInNgPlusSelector ? 'ng_plus' : 'welcome';
    this.revealBeat = 0;
    this.questionIndex = 0;
    this.questionOptionsRevealed = false;
    this.answers = [];
    this.selectedLordSpeciesId = DRAGON_LORD_OPTIONS[0]?.speciesId ?? 'axew';
    this.enteredCustomizeFromNgPlus = false;
    this.heroDraft = {
      nickname: '',
      birthMonth: 1,
      birthDay: 1,
      boonStat: 'atk',
      baneStat: 'def',
    };

    this.waveEngine.reset();
    delete this.rootEl.dataset.auraFlowerColor;
    this.rootEl.hidden = false;
    this.audioManager.playBgm('personality_quiz', { fadeMs: 260 });
    this.render();
    if (this.step === 'welcome') this.audioNoticeEl = showFirstVisitAudioNotice(this.rootEl);
    this.waveEngine.syncHostDimensions();
    this.waveEngine.renderFrame(0);
    this.waveEngine.startLoop();
    this.onStateChange?.();
  }

  public close(): void {
    this.resetFinalizeFade();
    if (!this.openState) return;
    this.typewriter.stop();
    this.waveEngine.stopLoop();
    this.openState = false;
    this.rootEl.hidden = true;
    this.audioNoticeEl?.remove();
    this.audioNoticeEl = null;
    this.waveEngine.setTargetPalette(MYSTICAL_QUIZ_WAVE_PALETTE, true, true);
    delete this.rootEl.dataset.auraFlowerColor;
    this.onStateChange?.();
  }

  public handleBack(): void {
    if (!this.isOpen() || this.finalizing) return;
    this.audioManager.playSfx('cancel');
    this.typewriter.stop();
    const t = computeQuizBackTransition({
      step: this.step,
      revealBeat: this.revealBeat,
      enteredCustomizeFromNgPlus: this.enteredCustomizeFromNgPlus,
      questionIndex: this.questionIndex,
      totalQuestionCount: TOTAL_QUIZ_QUESTION_COUNT,
      answers: this.answers,
    });
    if (t.action === 'cancel_scene') {
      this.close();
      this.onCancelCallback();
      return;
    }
    this.step = t.nextStep;
    this.revealBeat = t.nextRevealBeat;
    this.questionIndex = t.nextQuestionIndex;
    this.answers = t.nextAnswers;
    this.questionOptionsRevealed = false;
    this.render();
  }

  private startTypewriter(targetEl: HTMLElement, promptEl: HTMLElement | null, prefix: string, roll: string): void {
    this.activePromptEl = promptEl;
    const msPerChar =
      typeof this.activeOptions.typewriterMsPerChar === 'number'
        ? Math.max(0, this.activeOptions.typewriterMsPerChar)
        : DEFAULT_TYPEWRITER_MS_PER_CHAR;
    const instant = msPerChar <= 0 || prefersReducedMotionEnabled();
    if (promptEl && !instant && roll.length > 0) promptEl.hidden = true;
    const expectedStep = this.step;
    this.typewriter.start({
      targetEl,
      prefixText: prefix,
      text: roll,
      msPerTick: msPerChar,
      charsPerTick: 1,
      instant,
      onComplete: () => {
        if (this.openState && this.step === expectedStep && this.activePromptEl) {
          this.activePromptEl.hidden = false;
        }
      },
    });
  }

  private getCurrentQuestionDescriptor(): QuizQuestionDescriptor {
    const q = PERSONALITY_QUIZ_QUESTIONS[this.questionIndex] ?? PERSONALITY_QUIZ_QUESTIONS[0]!;
    return { prompt: q.prompt, options: q.options.map((o) => ({ id: o.id, text: o.text })), onSelectOption: (optId) => { this.answers[this.questionIndex] = optId; } };
  }

  private handleQuestionScreenTap(): void {
    if (!this.isOpen() || this.step !== 'questions') return;
    if (this.typewriter.isAnimating()) {
      this.audioManager.playSfx('select');
      this.typewriter.completeImmediately();
      return;
    }
    if (!this.questionOptionsRevealed) {
      this.audioManager.playSfx('select');
      this.questionOptionsRevealed = true;
      appendQuizQuestionOptionsWindow(this.stageEl, this.getCurrentQuestionDescriptor(), () => this.advanceAfterOptionPicked());
    }
  }

  private advanceAfterOptionPicked(): void {
    this.audioManager.playSfx('select');
    if (this.questionIndex + 1 < TOTAL_QUIZ_QUESTION_COUNT) {
      this.questionIndex += 1;
      this.questionOptionsRevealed = false;
    } else {
      const result = evaluatePersonalityQuiz(this.answers);
      this.selectedLordSpeciesId = result.assignedLordSpeciesId;
      this.step = 'lord_reveal';
      this.revealBeat = 0;
    }
    this.render();
  }

  private handleRevealAdvanceTap(): void {
    if (!this.isOpen() || this.step !== 'lord_reveal') return;
    if (this.typewriter.isAnimating()) {
      this.audioManager.playSfx('select');
      this.typewriter.completeImmediately();
      return;
    }
    const lordMeta = getDragonLordTraitInfo(this.selectedLordSpeciesId);
    if (this.revealBeat === 0) {
      this.audioManager.playSfx('select');
      this.revealBeat = 1;
      const boxEl = this.stageEl.querySelector<HTMLElement>('[data-testid="quiz-reveal-box"]');
      if (boxEl) boxEl.dataset.revealBeat = '1';
      if (this.activeRevealTextEl) {
        this.startTypewriter(this.activeRevealTextEl, this.activePromptEl, 'You appear to be...', ` the ${lordMeta.personalityTitle} type!`);
      } else this.render();
      return;
    }
    if (this.revealBeat < 3) {
      this.audioManager.playSfx(this.revealBeat === 2 ? 'heal' : 'select');
      this.revealBeat = (this.revealBeat + 1) as QuizRevealBeat;
      this.render();
      return;
    }
    if (this.revealBeat === 3) {
      this.audioManager.playSfx('select');
      this.enteredCustomizeFromNgPlus = false;
      this.step = 'customize';
      this.render();
      return;
    }
    this.finalize(this.selectedLordSpeciesId, this.enteredCustomizeFromNgPlus);
  }

  private render(): void {
    this.typewriter.stop();
    this.activePromptEl = null;
    this.activeRevealTextEl = null;
    this.stageEl.innerHTML = '';
    applyQuizBackdropForStep(this.rootEl, this.waveEngine, this.step, this.revealBeat, this.selectedLordSpeciesId);

    if (this.step === 'welcome') {
      renderQuizWelcomePopup(this.stageEl, {
        ngPlusUnlocked: this.saveManager.isNewGamePlusUnlocked(),
        onBeginQuiz: () => { this.audioManager.playSfx('select'); this.step = 'questions'; this.questionIndex = 0; this.questionOptionsRevealed = false; this.render(); },
        onOpenNgPlusSelector: () => { this.audioManager.playSfx('select'); this.step = 'ng_plus'; this.render(); },
      });
    } else if (this.step === 'ng_plus') {
      renderNgPlusRosterSelectorView(this.stageEl, {
        initialLordSpeciesId: this.selectedLordSpeciesId,
        onSelectLordChange: (lordId) => {
          this.selectedLordSpeciesId = lordId;
          applyQuizBackdropForStep(this.rootEl, this.waveEngine, this.step, this.revealBeat, this.selectedLordSpeciesId);
        },
        onTakeAuraQuizInstead: () => { this.audioManager.playSfx('select'); this.step = 'questions'; this.questionIndex = 0; this.questionOptionsRevealed = false; this.render(); },
        onConfirmNgPlus: (lordId) => {
          this.audioManager.playSfx('select');
          this.selectedLordSpeciesId = lordId;
          this.enteredCustomizeFromNgPlus = true;
          this.step = 'customize';
          this.render();
        },
      });
    } else if (this.step === 'customize') {
      if (!this.lordPortraitView) this.lordPortraitView = new PmdPortraitView({ testId: 'quiz-lord-portrait-canvas' });
      renderQuizHeroCustomizeView(this.stageEl, {
        selectedLordSpeciesId: this.selectedLordSpeciesId,
        initialDraft: this.heroDraft,
        startingLevel: this.activeOptions.startingLevel ?? DEMO_STARTING_LEVEL,
        scaleStatsToLevel: this.activeOptions.scaleStatsToLevel ?? true,
        portraitView: this.lordPortraitView,
        backLabel: this.enteredCustomizeFromNgPlus ? 'Picker' : 'Back',
        onOptionChangeSfx: () => this.audioManager.playSfx('select'),
        onBack: (draft) => {
          this.heroDraft = draft;
          this.audioManager.playSfx('cancel');
          if (this.enteredCustomizeFromNgPlus) {
            this.step = 'ng_plus';
          } else {
            this.step = 'lord_reveal';
            this.revealBeat = 3;
          }
          this.render();
        },
        onConfirm: (draft) => {
          this.heroDraft = draft;
          this.audioManager.playSfx('select');
          this.step = 'lord_reveal';
          this.revealBeat = 4;
          this.render();
        },
      });
    } else if (this.step === 'questions') {
      renderQuizQuestionWindow(this.stageEl, this.getCurrentQuestionDescriptor(), {
        optionsRevealed: this.questionOptionsRevealed,
        onStartTypewriter: (target, prompt, text) => this.startTypewriter(target, prompt, '', text),
        onOptionTapped: () => this.advanceAfterOptionPicked(),
      });
    } else {
      if (!this.lordPortraitView) this.lordPortraitView = new PmdPortraitView({ testId: 'quiz-lord-portrait-canvas' });
      const { revealTextEl } = renderQuizLordRevealView(this.stageEl, {
        selectedLordSpeciesId: this.selectedLordSpeciesId,
        revealBeat: this.revealBeat,
        portraitView: this.lordPortraitView,
        onStartTypewriter: (target, prompt, prefix, roll) => this.startTypewriter(target, prompt, prefix, roll),
        onAcceptAdventure: () => {
          this.typewriter.stop();
          this.finalize(this.selectedLordSpeciesId, this.enteredCustomizeFromNgPlus);
        },
      });
      this.activeRevealTextEl = revealTextEl;
    }
  }

  private resetFinalizeFade(): void {
    if (this.finalizeTimer !== null) {
      window.clearTimeout(this.finalizeTimer);
      this.finalizeTimer = null;
    }
    this.finalizing = false;
    this.fadeOverlayEl.style.transition = 'none';
    this.fadeOverlayEl.style.opacity = '0';
    this.fadeOverlayEl.style.pointerEvents = 'none';
  }

  private finalize(lordId: DragonLordSpeciesId, preserveNgPlus = false): void {
    if (this.finalizing) return;
    this.finalizing = true;
    this.audioManager.playSfx('heal');
    this.audioManager.playBgm(null, { fadeMs: 480 });
    const commit = () => {
      const graph = this.activeOptions.overworldGraph ?? DEMO_OVERWORLD_GRAPH;
      let created = this.saveManager.createNewCampaignSave({
        lordSpeciesId: lordId,
        lordNickname: this.heroDraft.nickname.trim() || undefined,
        lordBoonStat: this.heroDraft.boonStat,
        lordBaneStat: this.heroDraft.baneStat,
        heroBirthMonth: this.heroDraft.birthMonth,
        heroBirthDay: this.heroDraft.birthDay,
        partnerSpeciesId: 'quaxly',
        healerSpeciesId: 'flabebe',
        tutorialsEnabled: true,
        newGamePlusUnlocked: preserveNgPlus || this.saveManager.isNewGamePlusUnlocked(),
        startingLevel: this.activeOptions.startingLevel ?? DEMO_STARTING_LEVEL,
        scaleStatsToLevel: this.activeOptions.scaleStatsToLevel ?? true,
        campaignMode: this.activeOptions.campaignMode ?? 'demo',
        initialConvoy: this.activeOptions.initialConvoy ?? DEMO_INITIAL_CONVOY,
      });
      created = this.saveManager.ensureOverworldInitialized(graph);
      const onComplete = this.activeOptions.onComplete;
      this.close();
      onComplete?.(this.saveManager.getSave() ?? created);
    };
    if (prefersReducedMotionEnabled()) {
      commit();
      return;
    }
    this.fadeOverlayEl.style.pointerEvents = 'auto';
    this.fadeOverlayEl.style.transition = 'opacity 480ms ease';
    void this.fadeOverlayEl.offsetWidth;
    this.fadeOverlayEl.style.opacity = '1';
    this.finalizeTimer = window.setTimeout(() => {
      this.finalizeTimer = null;
      if (this.openState) commit();
    }, 480);
  }

  public destroy(): void {
    this.close();
    this.waveEngine.destroy();
    this.abortController.abort();
    this.rootEl.remove();
  }
}
