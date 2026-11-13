/**
 * Mystery Emblem - Quiz Typewriter, Snapshot & Campaign Finalizer Helpers (`quizTypewriterController.ts`)
 */

import type { AudioManager } from '../../audio/AudioManager';
import { DEMO_INITIAL_CONVOY, DEMO_STARTING_LEVEL } from '../../data/campaignRegistry';
import { DEMO_OVERWORLD_GRAPH, type OverworldGraphDefinition } from '../../data/overworldMapData';
import {
  DEFAULT_QUIZ_BACKDROP_CSS,
  MYSTICAL_QUIZ_WAVE_PALETTE,
  getDragonLordTraitInfo,
  type DragonLordSpeciesId,
  type QuizOptionKey,
} from '../../data/quizData';
import type { SaveStateManager } from '../../state/SaveStateManager';
import type {
  CampaignMode,
  ConvoyEntry,
  FlabebeFlowerColor,
  QuizRecruitSeeds,
  SaveData,
} from '../../types/schemas';
import type { AuraWaveCanvas } from './AuraWaveCanvas';
import type { QuizRevealBeat } from './QuizRevealSequenceView';

export type QuizSceneStep = 'welcome' | 'questions' | 'lord_reveal' | 'ng_plus';
const DEFAULT_TYPEWRITER_MS_PER_CHAR = 20;

export interface OpenQuizSceneOptions {
  campaignMode?: CampaignMode;
  startingLevel?: number;
  scaleStatsToLevel?: boolean;
  initialConvoy?: ReadonlyArray<ConvoyEntry>;
  overworldGraph?: OverworldGraphDefinition;
  typewriterMsPerChar?: number;
  skipNicknamePrompts?: boolean;
  startInNgPlusSelector?: boolean;
  onComplete?: (save: SaveData) => void;
}

export interface QuizSceneSnapshot {
  isOpen: boolean;
  step: QuizSceneStep;
  revealBeat: QuizRevealBeat;
  isTyping: boolean;
  questionOptionsRevealed: boolean;
  displayedQuestionText: string;
  displayedRevealText: string;
  auraBackdropActive: boolean;
  waveFrameCount: number;
  waveTimeSec: number;
  colorTransitionProgress: number;
  currentBackdropOuterRgb: [number, number, number];
  targetBackdropOuterRgb: [number, number, number];
  questionIndex: number;
  totalQuestionCount: number;
  answers: QuizOptionKey[];
  tutorialsEnabled: boolean;
  selectedLordSpeciesId: DragonLordSpeciesId;
  selectedPartnerSpeciesId: 'quaxly';
  selectedHealerSpeciesId: 'flabebe';
  flabebeFlowerColor: FlabebeFlowerColor;
}

export function buildQuizSceneSnapshot(params: {
  isOpen: boolean;
  step: QuizSceneStep;
  revealBeat: QuizRevealBeat;
  isTyping: boolean;
  questionOptionsRevealed: boolean;
  displayedQuestionText: string;
  displayedRevealText: string;
  waveEngine: AuraWaveCanvas;
  questionIndex: number;
  totalQuestionCount: number;
  answers: QuizOptionKey[];
  selectedLordSpeciesId: DragonLordSpeciesId;
}): QuizSceneSnapshot {
  const lordMeta = getDragonLordTraitInfo(params.selectedLordSpeciesId);
  return {
    isOpen: params.isOpen,
    step: params.step,
    revealBeat: params.revealBeat,
    isTyping: params.isTyping,
    questionOptionsRevealed: params.questionOptionsRevealed,
    displayedQuestionText: params.displayedQuestionText,
    displayedRevealText: params.displayedRevealText,
    auraBackdropActive: (params.step === 'lord_reveal' && params.revealBeat >= 3) || params.step === 'ng_plus',
    ...params.waveEngine.getTelemetry(),
    questionIndex: params.questionIndex,
    totalQuestionCount: params.totalQuestionCount,
    answers: [...params.answers],
    tutorialsEnabled: true,
    selectedLordSpeciesId: params.selectedLordSpeciesId,
    selectedPartnerSpeciesId: 'quaxly',
    selectedHealerSpeciesId: 'flabebe',
    flabebeFlowerColor: lordMeta.flabebeFlowerColor,
  };
}

export function computeQuizBackTransition(params: {
  step: QuizSceneStep;
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
  const { step, questionIndex, totalQuestionCount, answers } = params;
  if (step === 'ng_plus') {
    return { action: 'rerender', nextStep: 'welcome', nextRevealBeat: 0, nextQuestionIndex: questionIndex, nextAnswers: answers };
  }
  if (step === 'lord_reveal') {
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

export function applyQuizBackdropForStep(
  rootEl: HTMLElement,
  waveEngine: AuraWaveCanvas,
  step: QuizSceneStep,
  revealBeat: QuizRevealBeat,
  selectedLordSpeciesId: DragonLordSpeciesId
): void {
  if ((step === 'lord_reveal' && revealBeat >= 3) || step === 'ng_plus') {
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

export class QuizTypewriterController {
  private timer: number | null = null;
  private prefix = '';
  private remaining = '';
  private charIndex = 0;
  private targetEl: HTMLElement | null = null;
  public activePromptEl: HTMLElement | null = null;

  public get isTyping(): boolean { return this.timer !== null; }

  public clear(): void {
    if (this.timer !== null) {
      window.clearInterval(this.timer);
      this.timer = null;
    }
  }

  public resetTargets(): void {
    this.clear();
    this.targetEl = null;
    this.activePromptEl = null;
  }

  public start(params: {
    targetEl: HTMLElement;
    promptEl: HTMLElement | null;
    prefixText: string;
    rollText: string;
    msPerCharOverride?: number;
    fastMode: boolean;
    expectedStep: QuizSceneStep;
    isStillOnExpectedStep: (expected: QuizSceneStep) => boolean;
  }): void {
    this.clear();
    this.targetEl = params.targetEl;
    this.activePromptEl = params.promptEl;
    this.prefix = params.prefixText;
    this.remaining = params.rollText;
    this.charIndex = 0;

    const msPerChar =
      typeof params.msPerCharOverride === 'number'
        ? Math.max(0, params.msPerCharOverride)
        : params.fastMode ? 0 : DEFAULT_TYPEWRITER_MS_PER_CHAR;

    if (msPerChar <= 0 || params.rollText.length === 0) {
      params.targetEl.textContent = `${params.prefixText}${params.rollText}`;
      if (params.promptEl) params.promptEl.hidden = false;
      return;
    }

    params.targetEl.textContent = params.prefixText;
    if (params.promptEl) params.promptEl.hidden = true;

    this.timer = window.setInterval(() => {
      if (!params.isStillOnExpectedStep(params.expectedStep)) {
        this.clear();
        return;
      }
      this.charIndex += 1;
      params.targetEl.textContent = `${this.prefix}${this.remaining.slice(0, this.charIndex)}`;
      if (this.charIndex >= this.remaining.length) {
        this.clear();
        if (this.activePromptEl) this.activePromptEl.hidden = false;
      }
    }, msPerChar);
  }

  public completeImmediately(): void {
    if (this.timer === null) return;
    this.clear();
    if (this.targetEl) this.targetEl.textContent = `${this.prefix}${this.remaining}`;
    if (this.activePromptEl) this.activePromptEl.hidden = false;
  }
}

export function finalizeQuizCampaignCreation(params: {
  saveManager: SaveStateManager;
  audioManager: AudioManager;
  activeOptions: OpenQuizSceneOptions;
  lordSpeciesId: DragonLordSpeciesId;
  preserveNgPlus?: boolean;
  skipConfirmSfx?: boolean;
  onCloseQuizScene: () => void;
}): void {
  const {
    saveManager,
    audioManager,
    activeOptions,
    lordSpeciesId,
    preserveNgPlus = false,
    skipConfirmSfx = false,
    onCloseQuizScene,
  } = params;
  if (!skipConfirmSfx) audioManager.playSfx('heal');
  const graph = activeOptions.overworldGraph ?? DEMO_OVERWORLD_GRAPH;
  let created = saveManager.createNewCampaignSave({
    lordSpeciesId,
    partnerSpeciesId: 'quaxly',
    healerSpeciesId: 'flabebe',
    tutorialsEnabled: true,
    newGamePlusUnlocked: preserveNgPlus || saveManager.isNewGamePlusUnlocked(),
    startingLevel: activeOptions.startingLevel ?? DEMO_STARTING_LEVEL,
    scaleStatsToLevel: activeOptions.scaleStatsToLevel ?? true,
    campaignMode: activeOptions.campaignMode ?? 'demo',
    initialConvoy: activeOptions.initialConvoy ?? DEMO_INITIAL_CONVOY,
  });
  created = saveManager.ensureOverworldInitialized(graph);
  const onComplete = activeOptions.onComplete;
  onCloseQuizScene();
  onComplete?.(saveManager.getSave() ?? created);
}
