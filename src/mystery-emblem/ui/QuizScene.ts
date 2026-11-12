/**
 * Mystery Emblem - Mystical Aura Wave Personality Quiz & NG+ Coordinator (`QuizScene.ts`)
 */

import { getAudioManager, type AudioManager } from '../audio/AudioManager';
import {
  DEFAULT_QUIZ_BACKDROP_CSS, DRAGON_LORD_OPTIONS, MYSTICAL_QUIZ_WAVE_PALETTE,
  PERSONALITY_QUIZ_QUESTIONS, evaluatePersonalityQuiz, getDragonLordTraitInfo,
  type DragonLordSpeciesId, type QuizOptionKey,
} from '../data/quizData';
import type { SaveStateManager } from '../state/SaveStateManager';
import { PmdPortraitView } from './PmdSpriteCanvas';
import { RecruitNicknameOverlay, type PromptRecruitsOptions } from './RecruitNicknameOverlay';
import { bindBackGestureSurface, bindPointerTap } from './pointerControls';
import { AuraWaveCanvas } from './quiz/AuraWaveCanvas';
import { renderNgPlusRosterSelectorView } from './quiz/NgPlusRosterSelectorView';
import { renderQuizLordRevealView, type QuizRevealBeat } from './quiz/QuizRevealSequenceView';
import {
  appendQuizQuestionOptionsWindow, renderQuizQuestionWindow, renderQuizWelcomePopup,
  type QuizQuestionDescriptor,
} from './quiz/QuizWelcomeAndQuestionsView';
import {
  QuizTypewriterController, applyQuizBackdropForStep, buildQuizSceneSnapshot,
  computeQuizBackTransition, finalizeQuizCampaignCreation,
  type OpenQuizSceneOptions, type QuizSceneSnapshot, type QuizSceneStep,
} from './quiz/quizTypewriterController';

export { RecruitNicknameOverlay };
export type { OpenQuizSceneOptions, PromptRecruitsOptions, QuizRevealBeat, QuizSceneSnapshot, QuizSceneStep };

const TOTAL_QUIZ_QUESTION_COUNT = PERSONALITY_QUIZ_QUESTIONS.length;

export class QuizScene {
  public readonly rootEl: HTMLElement;
  private readonly waveEngine: AuraWaveCanvas;
  private readonly stageEl: HTMLElement;
  private readonly typewriter = new QuizTypewriterController();

  private readonly saveManager: SaveStateManager;
  private readonly audioManager: AudioManager;
  private readonly onCancelCallback: () => void;
  private readonly onStateChange?: () => void;
  private readonly abortController = new AbortController();

  private openState = false;
  private fastMode = false;
  private step: QuizSceneStep = 'welcome';
  private revealBeat: QuizRevealBeat = 0;
  private questionIndex = 0;
  private questionOptionsRevealed = false;
  private answers: QuizOptionKey[] = [];
  private selectedLordSpeciesId: DragonLordSpeciesId = 'axew';
  private activeQuestionTextEl: HTMLElement | null = null;
  private activeRevealTextEl: HTMLElement | null = null;

  private activeOptions: OpenQuizSceneOptions = {};
  private lordPortraitView: PmdPortraitView | null = null;
  private suppressTapUntilMs = 0;

  constructor(
    mountParent: HTMLElement,
    saveManager: SaveStateManager,
    _nicknameOverlay: RecruitNicknameOverlay,
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
    this.rootEl.append(this.waveEngine.canvasEl, this.stageEl);
    mountParent.appendChild(this.rootEl);

    bindPointerTap(
      this.rootEl,
      () => {
        if (performance.now() < this.suppressTapUntilMs) return;
        if (this.step === 'questions') this.handleQuestionScreenTap();
        else if (this.step === 'lord_reveal') this.handleRevealAdvanceTap();
      },
      { signal: this.abortController.signal }
    );
    bindBackGestureSurface(
      this.rootEl,
      () => {
        this.suppressTapUntilMs = performance.now() + 360;
        this.handleBack();
      },
      { signal: this.abortController.signal }
    );
  }

  public setFastMode(enabled: boolean): void { this.fastMode = Boolean(enabled); }
  public isOpen(): boolean { return this.openState && !this.rootEl.hidden; }
  public advanceWaveAnimationForTest(deltaMs: number): void {
    if (this.openState) this.waveEngine.renderFrame(Math.max(0, deltaMs));
  }

  public open(options?: OpenQuizSceneOptions): void {
    this.typewriter.clear();
    this.activeOptions = options ?? {};
    this.openState = true;
    this.step = options?.startInNgPlusSelector ? 'ng_plus' : 'welcome';
    this.revealBeat = 0;
    this.questionIndex = 0;
    this.questionOptionsRevealed = false;
    this.answers = [];
    this.selectedLordSpeciesId = DRAGON_LORD_OPTIONS[0]?.speciesId ?? 'axew';

    this.waveEngine.reset();
    delete this.rootEl.dataset.auraFlowerColor;
    this.rootEl.hidden = false;
    this.audioManager.playBgm('personality_quiz', { fadeMs: 260 });
    this.render();
    this.waveEngine.renderFrame(0);
    this.waveEngine.startLoop();
    this.onStateChange?.();
  }

  public close(): void {
    if (!this.openState) return;
    this.typewriter.clear();
    this.waveEngine.stopLoop();
    this.openState = false;
    this.rootEl.hidden = true;
    this.waveEngine.setTargetPalette(MYSTICAL_QUIZ_WAVE_PALETTE, true, true);
    delete this.rootEl.dataset.auraFlowerColor;
    this.onStateChange?.();
  }

  public handleBack(): void {
    if (!this.isOpen()) return;
    this.audioManager.playSfx('cancel');
    this.typewriter.clear();
    const t = computeQuizBackTransition({
      step: this.step,
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

  public getSnapshot(): QuizSceneSnapshot {
    return buildQuizSceneSnapshot({
      isOpen: this.isOpen(), step: this.step, revealBeat: this.revealBeat, isTyping: this.typewriter.isTyping,
      questionOptionsRevealed: this.questionOptionsRevealed,
      displayedQuestionText: this.activeQuestionTextEl?.textContent ?? '',
      displayedRevealText: this.activeRevealTextEl?.textContent ?? '',
      waveEngine: this.waveEngine, questionIndex: this.questionIndex,
      totalQuestionCount: TOTAL_QUIZ_QUESTION_COUNT, answers: this.answers,
      selectedLordSpeciesId: this.selectedLordSpeciesId,
    });
  }

  private startTypewriter(targetEl: HTMLElement, promptEl: HTMLElement | null, prefix: string, roll: string): void {
    this.typewriter.start({
      targetEl, promptEl, prefixText: prefix, rollText: roll, msPerCharOverride: this.activeOptions.typewriterMsPerChar,
      fastMode: this.fastMode, expectedStep: this.step, isStillOnExpectedStep: (expected) => this.openState && this.step === expected,
    });
  }

  private getCurrentQuestionDescriptor(): QuizQuestionDescriptor {
    const q = PERSONALITY_QUIZ_QUESTIONS[this.questionIndex] ?? PERSONALITY_QUIZ_QUESTIONS[0]!;
    return { prompt: q.prompt, options: q.options.map((o) => ({ id: o.id, text: o.text })), onSelectOption: (optId) => { this.answers[this.questionIndex] = optId; } };
  }

  private handleQuestionScreenTap(): void {
    if (!this.isOpen() || this.step !== 'questions') return;
    if (this.typewriter.isTyping) {
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
    if (this.typewriter.isTyping) {
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
        this.startTypewriter(this.activeRevealTextEl, this.typewriter.activePromptEl, 'You appear to be...', ` the ${lordMeta.personalityTitle} type!`);
      } else this.render();
      return;
    }
    if (this.revealBeat < 4) {
      this.audioManager.playSfx(this.revealBeat === 2 ? 'heal' : 'select');
      this.revealBeat = (this.revealBeat + 1) as QuizRevealBeat;
      this.render();
      return;
    }
    this.finalize(this.selectedLordSpeciesId);
  }

  private render(): void {
    this.typewriter.resetTargets();
    this.activeQuestionTextEl = null;
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
        onConfirmNgPlus: (lordId) => { this.selectedLordSpeciesId = lordId; this.finalize(lordId, true); },
      });
    } else if (this.step === 'questions') {
      const { promptEl } = renderQuizQuestionWindow(this.stageEl, this.getCurrentQuestionDescriptor(), {
        optionsRevealed: this.questionOptionsRevealed,
        onStartTypewriter: (target, prompt, text) => this.startTypewriter(target, prompt, '', text),
        onOptionTapped: () => this.advanceAfterOptionPicked(),
      });
      this.activeQuestionTextEl = promptEl;
    } else {
      if (!this.lordPortraitView) this.lordPortraitView = new PmdPortraitView({ testId: 'quiz-lord-portrait-canvas' });
      const { revealTextEl } = renderQuizLordRevealView(this.stageEl, {
        selectedLordSpeciesId: this.selectedLordSpeciesId,
        revealBeat: this.revealBeat,
        portraitView: this.lordPortraitView,
        onStartTypewriter: (target, prompt, prefix, roll) => this.startTypewriter(target, prompt, prefix, roll),
        onAcceptAdventure: () => {
          this.typewriter.clear();
          this.finalize(this.selectedLordSpeciesId);
        },
      });
      this.activeRevealTextEl = revealTextEl;
    }
  }

  private finalize(lordId: DragonLordSpeciesId, preserveNgPlus = false): void {
    finalizeQuizCampaignCreation({
      saveManager: this.saveManager, audioManager: this.audioManager, activeOptions: this.activeOptions,
      lordSpeciesId: lordId, preserveNgPlus, onCloseQuizScene: () => this.close(),
    });
  }

  public destroy(): void {
    this.close();
    this.abortController.abort();
    this.rootEl.remove();
  }
}
