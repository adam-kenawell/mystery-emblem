/**
 * Mystery Emblem — Mystical Aura Wave Personality Quiz, Familiarity Survey & Rename Modal (`QuizScene.ts`)
 *
 * Implements:
 * 1. `RecruitNicknameOverlay`: Reusable PMD modal for manually renaming existing squad members
 *    from Overworld (`Units`), Dungeon Prep (`Manage Units`), or Admin `Dev Tools`
 *    (zero automatic `"NEW ALLY"` popups on recruitment).
 * 2. `QuizScene`:
 *    - Animated GBA/NDS-style mystical aura wave canvas (`quiz-aura-wave-canvas`) with overlapping
 *      dithered wave arches that flow continuously and smoothly transition RGB palette into the
 *      revealed Pokémon's aura color (`red` / `orange` / `yellow` / `blue` / `white`) on Beat 3.
 *    - Pre-quiz Welcome Popup (`"Welcome to Mystery Emblem, a Pokémon / Fire Emblem fan game!"`,
 *      ~30–45 minute demo playtime estimate, and work-in-progress update notice).
 *    - Headerless, counterless 6-question sequence (4 Dragon Aura personality questions + Pokémon
 *      familiarity + Fire Emblem familiarity): each question rolls in like a typewriter first, and
 *      pressing the screen presents the multiple-choice options.
 *    - 4-beat sequential pointer-driven Dragon Lord reveal launching straight into Chapter 1
 *      (`Western Beach`) while persisting `tutorialPreferences` for future tutorial menus.
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
  MYSTICAL_QUIZ_WAVE_PALETTE,
  PERSONALITY_QUIZ_QUESTIONS,
  evaluatePersonalityQuiz,
  getDragonLordTraitInfo,
  type AuraWavePalette,
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
// Mystical Moving PMD Aura Wave Backdrop Renderer
// ============================================================================

const BAYER_4X4: readonly number[] = [
  0, 8, 2, 10,
  12, 4, 14, 6,
  3, 11, 1, 9,
  15, 7, 13, 5,
];

const COLOR_TRANSITION_DURATION_MS = 1150;
const PALETTE_STEPS = 14;

interface MutableWavePalette {
  outerRgb: [number, number, number];
  midRgb: [number, number, number];
  coreRgb: [number, number, number];
}

function clonePalette(p: AuraWavePalette): MutableWavePalette {
  return {
    outerRgb: [p.outerRgb[0], p.outerRgb[1], p.outerRgb[2]],
    midRgb: [p.midRgb[0], p.midRgb[1], p.midRgb[2]],
    coreRgb: [p.coreRgb[0], p.coreRgb[1], p.coreRgb[2]],
  };
}

function palettesEqual(a: AuraWavePalette, b: AuraWavePalette): boolean {
  return (
    a.outerRgb[0] === b.outerRgb[0] &&
    a.outerRgb[1] === b.outerRgb[1] &&
    a.outerRgb[2] === b.outerRgb[2] &&
    a.midRgb[0] === b.midRgb[0] &&
    a.midRgb[1] === b.midRgb[1] &&
    a.midRgb[2] === b.midRgb[2] &&
    a.coreRgb[0] === b.coreRgb[0] &&
    a.coreRgb[1] === b.coreRgb[1] &&
    a.coreRgb[2] === b.coreRgb[2]
  );
}

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function lerpChannel(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

// ============================================================================
// Personality Quiz, Welcome Popup, Familiarity Survey & Aura Reveal (`QuizScene`)
// ============================================================================

export type QuizSceneStep = 'welcome' | 'questions' | 'lord_reveal';
export type QuizRevealBeat = 0 | 1 | 2 | 3 | 4;

const DEFAULT_TYPEWRITER_MS_PER_CHAR = 20;
const TOTAL_QUIZ_QUESTION_COUNT = PERSONALITY_QUIZ_QUESTIONS.length;

export interface OpenQuizSceneOptions {
  campaignMode?: CampaignMode;
  startingLevel?: number;
  scaleStatsToLevel?: boolean;
  initialConvoy?: ReadonlyArray<ConvoyEntry>;
  overworldGraph?: OverworldGraphDefinition;
  typewriterMsPerChar?: number;
  skipNicknamePrompts?: boolean;
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
  selectedPartnerSpeciesId: 'piplup';
  selectedHealerSpeciesId: 'flabebe';
  selectedAdvisorSpeciesId: 'wimpod';
  flabebeFlowerColor: FlabebeFlowerColor;
}

export class QuizScene {
  public readonly rootEl: HTMLElement;
  private readonly waveCanvasEl: HTMLCanvasElement;
  private readonly waveCtx: CanvasRenderingContext2D | null;
  private readonly stageEl: HTMLElement;

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
  private computedQuizSeeds: QuizRecruitSeeds | null = null;

  private typewriterTimer: number | null = null;
  private typewriterPrefix = '';
  private typewriterRemaining = '';
  private typewriterCharIndex = 0;
  private activeTypingTargetEl: HTMLElement | null = null;
  private activeTypingPromptEl: HTMLElement | null = null;

  private activeQuestionTextEl: HTMLElement | null = null;
  private activeRevealTextEl: HTMLElement | null = null;

  private activeOptions: OpenQuizSceneOptions = {};
  private lordPortraitView: PmdPortraitView | null = null;
  private suppressTapUntilMs = 0;

  // Animated Mystical Wave State
  private waveRafId: number | null = null;
  private waveLastTickMs: number | null = null;
  private waveTimeSec = 0;
  private waveFrameCount = 0;
  private waveImageData: ImageData | null = null;
  private wavePixelU32: Uint32Array | null = null;
  private readonly paletteLutU32 = new Uint32Array(PALETTE_STEPS + 1);
  private colCy = new Float32Array(0);
  private colInvH1Top = new Float32Array(0);
  private colInvH1Bot = new Float32Array(0);
  private colInvH2Top = new Float32Array(0);
  private colInvH2Bot = new Float32Array(0);
  private colInvH3Top = new Float32Array(0);
  private colInvH3Bot = new Float32Array(0);

  private fromPalette: MutableWavePalette = clonePalette(MYSTICAL_QUIZ_WAVE_PALETTE);
  private currentPalette: MutableWavePalette = clonePalette(MYSTICAL_QUIZ_WAVE_PALETTE);
  private targetPalette: MutableWavePalette = clonePalette(MYSTICAL_QUIZ_WAVE_PALETTE);
  private colorTransitionProgress = 1;
  private colorTransitionElapsedMs = COLOR_TRANSITION_DURATION_MS;
  private mysticalShimmerActive = true;

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
      'overflow:hidden',
      `background:${DEFAULT_QUIZ_BACKDROP_CSS}`,
      'box-sizing:border-box',
    ].join(';');

    this.waveCanvasEl = document.createElement('canvas');
    this.waveCanvasEl.className = 'pmd-quiz-wave-canvas pmd-pixelated';
    this.waveCanvasEl.dataset.testid = 'quiz-aura-wave-canvas';
    this.waveCanvasEl.setAttribute('aria-hidden', 'true');
    this.waveCtx = this.waveCanvasEl.getContext('2d', { alpha: false });

    this.stageEl = document.createElement('div');
    this.stageEl.className = 'pmd-quiz-stage';
    this.stageEl.dataset.testid = 'quiz-panel-body';

    this.rootEl.append(this.waveCanvasEl, this.stageEl);
    mountParent.appendChild(this.rootEl);

    const styleEl = document.createElement('style');
    styleEl.textContent = `
      .pmd-quiz-scene[hidden] { display: none !important; }
      .pmd-quiz-wave-canvas {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        z-index: 0;
        pointer-events: none;
        image-rendering: -moz-crisp-edges;
        image-rendering: crisp-edges;
        image-rendering: pixelated;
      }
      .pmd-quiz-stage {
        position: relative;
        z-index: 1;
        width: min(620px, 94vw);
        max-height: calc(100dvh - 3.6rem);
        margin-top: clamp(2.2rem, 5vh, 2.8rem);
        display: flex;
        flex-direction: column;
        gap: 8px;
        box-sizing: border-box;
      }
      @media (max-height: 460px) and (min-width: 600px) {
        .pmd-quiz-stage {
          width: min(580px, calc(100vw - 170px));
          max-height: calc(100dvh - 14px);
          margin-top: 0;
          gap: 6px;
        }
      }
      .pmd-quiz-dialogue-window {
        padding: clamp(6px, 1.5vw, 10px) clamp(8px, 1.8vw, 12px);
        cursor: var(--pmd-cursor-glove, pointer);
        user-select: none;
        display: flex;
        flex-direction: column;
        gap: 6px;
        flex-shrink: 0;
        font-family: 'Fusion Pixel 12px Proportional KR', 'Segoe UI Emoji', 'Apple Color Emoji', 'Noto Color Emoji', sans-serif;
      }
      .pmd-quiz-options-window {
        padding: 2px 4px;
        overflow-y: auto;
        min-height: 0;
        font-family: 'Fusion Pixel 12px Proportional KR', 'Segoe UI Emoji', 'Apple Color Emoji', 'Noto Color Emoji', sans-serif;
      }
      .pmd-quiz-opt-btn {
        width: 100%;
        min-height: 46px;
        text-align: left;
        justify-content: flex-start;
        padding: 7px 10px 7px 26px;
        line-height: 1.3;
        font-size: 14px;
        font-family: 'Fusion Pixel 12px Proportional KR', 'Segoe UI Emoji', 'Apple Color Emoji', 'Noto Color Emoji', sans-serif;
      }
      @media (max-height: 460px) {
        .pmd-quiz-opt-btn {
          min-height: 44px;
          padding: 5px 8px 5px 24px;
          font-size: 13px;
        }
      }
      @keyframes pmdQuizPromptBlink {
        0%, 100% { opacity: 1; transform: translateY(0); }
        50% { opacity: 0.32; transform: translateY(2px); }
      }
      .pmd-quiz-advance-row {
        display: flex;
        align-items: center;
        justify-content: flex-end;
        gap: 6px;
        min-height: 16px;
        font-size: 12px;
        color: #f8f800;
      }
      .pmd-quiz-advance-row[hidden] {
        display: flex !important;
        visibility: hidden;
      }
      .pmd-quiz-advance-row.is-collapsed {
        display: none !important;
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
        if (performance.now() < this.suppressTapUntilMs) {
          return;
        }
        if (this.step === 'questions') {
          this.handleQuestionScreenTap();
        } else if (this.step === 'lord_reveal') {
          this.handleRevealAdvanceTap();
        }
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
    this.step = 'welcome';
    this.revealBeat = 0;
    this.questionIndex = 0;
    this.questionOptionsRevealed = false;
    this.answers = [];
    this.selectedLordSpeciesId = DRAGON_LORD_OPTIONS[0]?.speciesId ?? 'axew';
    this.computedQuizSeeds = null;

    this.waveTimeSec = 0;
    this.waveFrameCount = 0;
    this.setTargetWavePalette(MYSTICAL_QUIZ_WAVE_PALETTE, true, true);
    delete this.rootEl.dataset.auraFlowerColor;

    this.rootEl.hidden = false;
    this.audioManager.playBgm('personality_quiz', { fadeMs: 260 });
    this.render();
    this.renderWaveFrame(0);
    this.startWaveLoop();
    this.onStateChange?.();
  }

  public close(): void {
    if (!this.openState) return;
    this.clearTypewriterTimer();
    this.stopWaveLoop();
    this.openState = false;
    this.rootEl.hidden = true;
    this.setTargetWavePalette(MYSTICAL_QUIZ_WAVE_PALETTE, true, true);
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
      this.questionIndex = TOTAL_QUIZ_QUESTION_COUNT - 1;
      this.questionOptionsRevealed = false;
      this.render();
      return;
    }

    if (this.step === 'questions') {
      if (this.questionIndex > 0) {
        this.questionIndex -= 1;
        if (this.questionIndex < PERSONALITY_QUIZ_QUESTIONS.length) {
          this.answers = this.answers.slice(0, this.questionIndex);
        }
        this.questionOptionsRevealed = false;
        this.render();
        return;
      }

      this.step = 'welcome';
      this.questionOptionsRevealed = false;
      this.render();
      return;
    }

    this.close();
    this.onCancelCallback();
  }

  /**
   * Deterministic time-step helper for automated tests verifying wave motion & smooth RGB transitions.
   */
  public advanceWaveAnimationForTest(deltaMs: number): void {
    if (!this.openState) return;
    this.renderWaveFrame(Math.max(0, deltaMs));
  }

  public getSnapshot(): QuizSceneSnapshot {
    const lordMeta = getDragonLordTraitInfo(this.selectedLordSpeciesId);
    const auraBackdropActive = this.step === 'lord_reveal' && this.revealBeat >= 3;
    return {
      isOpen: this.isOpen(),
      step: this.step,
      revealBeat: this.revealBeat,
      isTyping: this.typewriterTimer !== null,
      questionOptionsRevealed: this.questionOptionsRevealed,
      displayedQuestionText: this.activeQuestionTextEl?.textContent ?? '',
      displayedRevealText: this.activeRevealTextEl?.textContent ?? '',
      auraBackdropActive,
      waveFrameCount: this.waveFrameCount,
      waveTimeSec: this.waveTimeSec,
      colorTransitionProgress: this.colorTransitionProgress,
      currentBackdropOuterRgb: [
        Math.round(this.currentPalette.outerRgb[0]),
        Math.round(this.currentPalette.outerRgb[1]),
        Math.round(this.currentPalette.outerRgb[2]),
      ],
      targetBackdropOuterRgb: [
        Math.round(this.targetPalette.outerRgb[0]),
        Math.round(this.targetPalette.outerRgb[1]),
        Math.round(this.targetPalette.outerRgb[2]),
      ],
      questionIndex: this.questionIndex,
      totalQuestionCount: TOTAL_QUIZ_QUESTION_COUNT,
      answers: [...this.answers],
      tutorialsEnabled: true,
      selectedLordSpeciesId: this.selectedLordSpeciesId,
      selectedPartnerSpeciesId: 'piplup',
      selectedHealerSpeciesId: 'flabebe',
      selectedAdvisorSpeciesId: 'wimpod',
      flabebeFlowerColor: lordMeta.flabebeFlowerColor,
    };
  }

  // ==========================================================================
  // Animated Mystical Wave Engine & Smooth Color Transition
  // ==========================================================================

  private setTargetWavePalette(
    nextTarget: AuraWavePalette,
    immediate: boolean,
    mysticalShimmer: boolean
  ): void {
    this.mysticalShimmerActive = mysticalShimmer;
    if (immediate) {
      this.fromPalette = clonePalette(nextTarget);
      this.currentPalette = clonePalette(nextTarget);
      this.targetPalette = clonePalette(nextTarget);
      this.colorTransitionProgress = 1;
      this.colorTransitionElapsedMs = COLOR_TRANSITION_DURATION_MS;
      return;
    }

    if (palettesEqual(this.targetPalette, nextTarget)) {
      return;
    }

    this.fromPalette = clonePalette(this.currentPalette);
    this.targetPalette = clonePalette(nextTarget);
    this.colorTransitionProgress = 0;
    this.colorTransitionElapsedMs = 0;
  }

  private applySceneBackdropForStep(): void {
    if (this.step === 'lord_reveal' && this.revealBeat >= 3) {
      const lordMeta = getDragonLordTraitInfo(this.selectedLordSpeciesId);
      this.rootEl.style.background = lordMeta.revealBackdropCss;
      this.rootEl.dataset.auraFlowerColor = lordMeta.flabebeFlowerColor;
      this.setTargetWavePalette(lordMeta.auraWavePalette, false, false);
    } else {
      this.rootEl.style.background = DEFAULT_QUIZ_BACKDROP_CSS;
      delete this.rootEl.dataset.auraFlowerColor;
      this.setTargetWavePalette(MYSTICAL_QUIZ_WAVE_PALETTE, false, true);
    }
  }

  private startWaveLoop(): void {
    if (this.waveRafId !== null) return;
    this.waveLastTickMs = null;
    const tick = (nowMs: number) => {
      if (!this.openState) {
        this.waveRafId = null;
        this.waveLastTickMs = null;
        return;
      }
      const rawDt = this.waveLastTickMs === null ? 16.67 : nowMs - this.waveLastTickMs;
      this.waveLastTickMs = nowMs;
      const clampedDt = Math.max(0, Math.min(80, rawDt));
      this.renderWaveFrame(clampedDt);
      this.waveRafId = window.requestAnimationFrame(tick);
    };
    this.waveRafId = window.requestAnimationFrame(tick);
  }

  private stopWaveLoop(): void {
    if (this.waveRafId !== null) {
      window.cancelAnimationFrame(this.waveRafId);
      this.waveRafId = null;
    }
    this.waveLastTickMs = null;
  }

  private ensureWaveBuffers(bufW: number, bufH: number): void {
    if (
      this.waveImageData &&
      this.waveCanvasEl.width === bufW &&
      this.waveCanvasEl.height === bufH
    ) {
      return;
    }
    this.waveCanvasEl.width = bufW;
    this.waveCanvasEl.height = bufH;
    if (this.waveCtx) {
      this.waveCtx.imageSmoothingEnabled = false;
      this.waveImageData = this.waveCtx.createImageData(bufW, bufH);
      this.wavePixelU32 = new Uint32Array(this.waveImageData.data.buffer);
    }
    if (this.colCy.length !== bufW) {
      this.colCy = new Float32Array(bufW);
      this.colInvH1Top = new Float32Array(bufW);
      this.colInvH1Bot = new Float32Array(bufW);
      this.colInvH2Top = new Float32Array(bufW);
      this.colInvH2Bot = new Float32Array(bufW);
      this.colInvH3Top = new Float32Array(bufW);
      this.colInvH3Bot = new Float32Array(bufW);
    }
  }

  private updateInterpolatedPalette(deltaMs: number): void {
    if (this.colorTransitionProgress < 1) {
      this.colorTransitionElapsedMs += deltaMs;
      const rawT = Math.min(1, this.colorTransitionElapsedMs / COLOR_TRANSITION_DURATION_MS);
      this.colorTransitionProgress = rawT;
      const e = easeInOutCubic(rawT);
      for (let i = 0; i < 3; i++) {
        this.currentPalette.outerRgb[i] = lerpChannel(
          this.fromPalette.outerRgb[i]!,
          this.targetPalette.outerRgb[i]!,
          e
        );
        this.currentPalette.midRgb[i] = lerpChannel(
          this.fromPalette.midRgb[i]!,
          this.targetPalette.midRgb[i]!,
          e
        );
        this.currentPalette.coreRgb[i] = lerpChannel(
          this.fromPalette.coreRgb[i]!,
          this.targetPalette.coreRgb[i]!,
          e
        );
      }
    }

    // Subtle mystical breathing hue drift while in the pre-reveal mystical state
    const shimmer =
      this.mysticalShimmerActive && this.colorTransitionProgress >= 1
        ? Math.sin(this.waveTimeSec * 0.9)
        : 0;
    const outR = Math.max(0, Math.min(255, this.currentPalette.outerRgb[0] - shimmer * 12));
    const outG = Math.max(0, Math.min(255, this.currentPalette.outerRgb[1] + shimmer * 10));
    const outB = Math.max(0, Math.min(255, this.currentPalette.outerRgb[2] + shimmer * 14));

    const midR = Math.max(0, Math.min(255, this.currentPalette.midRgb[0] - shimmer * 10));
    const midG = Math.max(0, Math.min(255, this.currentPalette.midRgb[1] + shimmer * 12));
    const midB = Math.max(0, Math.min(255, this.currentPalette.midRgb[2] + shimmer * 8));

    const coreR = this.currentPalette.coreRgb[0];
    const coreG = this.currentPalette.coreRgb[1];
    const coreB = this.currentPalette.coreRgb[2];

    // Precompute quantized 15-bit GBA/DS palette lookup table (ABGR little-endian Uint32)
    for (let s = 0; s <= PALETTE_STEPS; s++) {
      const level = s / PALETTE_STEPS;
      let r: number;
      let g: number;
      let b: number;
      if (level <= 0.52) {
        const u = level / 0.52;
        r = lerpChannel(outR, midR, u);
        g = lerpChannel(outG, midG, u);
        b = lerpChannel(outB, midB, u);
      } else {
        const u = (level - 0.52) / 0.48;
        r = lerpChannel(midR, coreR, u);
        g = lerpChannel(midG, coreG, u);
        b = lerpChannel(midB, coreB, u);
      }
      // Quantize to authentic 5-bit-per-channel GBA/DS color steps (`0, 8, 16, ..., 248, 255`)
      const qr = Math.min(255, Math.round(r / 8) * 8);
      const qg = Math.min(255, Math.round(g / 8) * 8);
      const qb = Math.min(255, Math.round(b / 8) * 8);
      this.paletteLutU32[s] = (255 << 24) | (qb << 16) | (qg << 8) | qr;
    }
  }

  private renderWaveFrame(deltaMs: number): void {
    this.waveTimeSec += deltaMs * 0.001;
    this.waveFrameCount += 1;
    this.updateInterpolatedPalette(deltaMs);

    if (!this.waveCtx) return;

    const cssW = this.rootEl.clientWidth || window.innerWidth || 640;
    const cssH = this.rootEl.clientHeight || window.innerHeight || 360;
    const bufW = Math.max(96, Math.min(360, Math.round(cssW / 4)));
    const bufH = Math.max(96, Math.min(270, Math.round(cssH / 4)));

    this.ensureWaveBuffers(bufW, bufH);
    const pixels = this.wavePixelU32;
    const imgData = this.waveImageData;
    if (!pixels || !imgData) return;

    const t = this.waveTimeSec;
    const halfH = bufH * 0.5;

    // Precompute column arch boundaries for 3 counter-scrolling scalloped wave ribbons
    for (let x = 0; x < bufW; x++) {
      this.colCy[x] =
        halfH +
        bufH *
          (0.022 * Math.sin(x * 0.041 + t * 0.85) +
            0.015 * Math.cos(x * 0.067 - t * 0.68));

      const h1Top =
        bufH *
        (0.20 +
          0.19 * Math.abs(Math.sin(x * 0.056 - t * 0.92)) +
          0.035 * Math.sin(x * 0.024 + t * 0.45));
      const h1Bot =
        bufH *
        (0.20 +
          0.19 * Math.abs(Math.sin(x * 0.056 - t * 0.92 + 0.52)) +
          0.035 * Math.cos(x * 0.024 - t * 0.41));

      const h2Top =
        bufH *
        (0.18 +
          0.18 * Math.abs(Math.sin(x * 0.073 + t * 0.74 + 1.18)) +
          0.03 * Math.cos(x * 0.031 - t * 0.54));
      const h2Bot =
        bufH *
        (0.18 +
          0.18 * Math.abs(Math.sin(x * 0.073 + t * 0.74 + 1.76)) +
          0.03 * Math.sin(x * 0.031 + t * 0.50));

      const h3Top =
        bufH * (0.13 + 0.13 * Math.abs(Math.sin(x * 0.091 - t * 0.58 + 2.4)));
      const h3Bot =
        bufH * (0.13 + 0.13 * Math.abs(Math.sin(x * 0.091 + t * 0.53 + 0.95)));

      this.colInvH1Top[x] = 1 / Math.max(1, h1Top);
      this.colInvH1Bot[x] = 1 / Math.max(1, h1Bot);
      this.colInvH2Top[x] = 1 / Math.max(1, h2Top);
      this.colInvH2Bot[x] = 1 / Math.max(1, h2Bot);
      this.colInvH3Top[x] = 1 / Math.max(1, h3Top);
      this.colInvH3Bot[x] = 1 / Math.max(1, h3Bot);
    }

    const lut = this.paletteLutU32;
    let rowOffset = 0;

    for (let y = 0; y < bufH; y++) {
      const bayerRow = (y & 3) << 2;
      for (let x = 0; x < bufW; x++) {
        const dy = y - this.colCy[x]!;
        let dist: number;
        let inv1: number;
        let inv2: number;
        let inv3: number;
        if (dy < 0) {
          dist = -dy;
          inv1 = this.colInvH1Top[x]!;
          inv2 = this.colInvH2Top[x]!;
          inv3 = this.colInvH3Top[x]!;
        } else {
          dist = dy;
          inv1 = this.colInvH1Bot[x]!;
          inv2 = this.colInvH2Bot[x]!;
          inv3 = this.colInvH3Bot[x]!;
        }

        const u1 = 1 - dist * inv1;
        const u2 = 1 - dist * inv2;
        const u3 = 1 - dist * inv3;

        const r1 = u1 > 0 ? 0.16 + 0.84 * u1 : 0;
        const r2 = u2 > 0 ? 0.16 + 0.84 * u2 : 0;
        const r3 = u3 > 0 ? 0.14 + 0.86 * u3 : 0;

        const combined = 0.37 * r1 + 0.37 * r2 + 0.34 * r3;
        if (combined <= 0) {
          pixels[rowOffset + x] = lut[0]!;
        } else {
          const dither = (BAYER_4X4[bayerRow + (x & 3)]! * 0.0625 - 0.5) * 0.065;
          const idx = Math.max(
            0,
            Math.min(PALETTE_STEPS, Math.round((combined + dither) * PALETTE_STEPS))
          );
          pixels[rowOffset + x] = lut[idx]!;
        }
      }
      rowOffset += bufW;
    }

    this.waveCtx.putImageData(imgData, 0, 0);
  }

  // ==========================================================================
  // Typewriter & Step Progression
  // ==========================================================================

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
    this.activeTypingTargetEl = targetEl;
    this.activeTypingPromptEl = promptEl;
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

    const expectedStep = this.step;
    this.typewriterTimer = window.setInterval(() => {
      if (!this.openState || this.step !== expectedStep) {
        this.clearTypewriterTimer();
        return;
      }
      this.typewriterCharIndex += 1;
      targetEl.textContent = `${this.typewriterPrefix}${this.typewriterRemaining.slice(0, this.typewriterCharIndex)}`;
      if (this.typewriterCharIndex >= this.typewriterRemaining.length) {
        this.clearTypewriterTimer();
        if (this.activeTypingPromptEl) {
          this.activeTypingPromptEl.hidden = false;
        }
      }
    }, msPerChar);
  }

  private completeCurrentTypewriterImmediately(): void {
    if (this.typewriterTimer === null) return;
    this.clearTypewriterTimer();
    if (this.activeTypingTargetEl) {
      this.activeTypingTargetEl.textContent = `${this.typewriterPrefix}${this.typewriterRemaining}`;
    }
    if (this.activeTypingPromptEl) {
      this.activeTypingPromptEl.hidden = false;
    }
  }

  private handleQuestionScreenTap(): void {
    if (!this.isOpen() || this.step !== 'questions') return;

    if (this.typewriterTimer !== null) {
      this.audioManager.playSfx('select');
      this.completeCurrentTypewriterImmediately();
      return;
    }

    if (!this.questionOptionsRevealed) {
      this.audioManager.playSfx('select');
      this.questionOptionsRevealed = true;
      this.revealCurrentQuestionOptions();
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
      const boxEl = this.stageEl.querySelector<HTMLElement>('[data-testid="quiz-reveal-box"]');
      if (boxEl) boxEl.dataset.revealBeat = '1';
      if (this.activeRevealTextEl) {
        this.startTypewriter(
          this.activeRevealTextEl,
          this.activeTypingPromptEl,
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
    this.activeTypingTargetEl = null;
    this.activeTypingPromptEl = null;
    this.activeQuestionTextEl = null;
    this.activeRevealTextEl = null;
    this.stageEl.innerHTML = '';
    this.applySceneBackdropForStep();

    if (this.step === 'welcome') {
      this.renderWelcomeStep();
    } else if (this.step === 'questions') {
      this.renderQuestionStep();
    } else {
      this.renderLordRevealStep();
    }
  }

  private renderWelcomeStep(): void {
    const popup = document.createElement('div');
    popup.className = 'pmd-window';
    popup.dataset.testid = 'quiz-welcome-popup';
    popup.setAttribute('role', 'dialog');
    popup.setAttribute('aria-label', 'Welcome to Mystery Emblem');
    popup.style.cssText =
      'padding:clamp(10px, 2.2vw, 16px); display:flex; flex-direction:column; gap:10px;';

    popup.innerHTML = `
      <h2 data-testid="quiz-welcome-title" style="margin:0; font-size:clamp(15px, 2.3vw, 19px); line-height:1.35; color:#f8f800;">
        Welcome to Mystery Emblem, a Pokémon / Fire Emblem fan game!
      </h2>
      <div data-testid="quiz-welcome-body" style="display:flex; flex-direction:column; gap:8px; font-size:clamp(13px, 1.9vw, 15px); line-height:1.45; color:#f8f8f8;">
        <p style="margin:0;">
          This 5-chapter demo takes roughly <strong style="color:#58f858;">30–45 minutes</strong> to play.
        </p>
        <p style="margin:0; color:#a8e0f8;">
          The final project is still a work in progress—please visit the page frequently for updates!
        </p>
      </div>
      <div style="display:flex; justify-content:flex-end; margin-top:2px;">
        <button type="button" class="pmd-btn pmd-btn-primary" data-testid="quiz-welcome-continue-btn" style="min-height:46px; padding:8px 18px;">
          Begin ▶
        </button>
      </div>
    `;

    bindPointerTap(
      popup.querySelector('[data-testid="quiz-welcome-continue-btn"]'),
      () => {
        this.audioManager.playSfx('select');
        this.step = 'questions';
        this.questionIndex = 0;
        this.questionOptionsRevealed = false;
        this.render();
      },
      { stopPropagation: true }
    );

    this.stageEl.appendChild(popup);
  }

  private getCurrentQuestionDescriptor(): {
    prompt: string;
    options: ReadonlyArray<{ id: QuizOptionKey; text: string }>;
    onSelectOption: (optId: QuizOptionKey) => void;
  } {
    const q =
      PERSONALITY_QUIZ_QUESTIONS[this.questionIndex] ?? PERSONALITY_QUIZ_QUESTIONS[0]!;
    return {
      prompt: q.prompt,
      options: q.options.map((o) => ({ id: o.id, text: o.text })),
      onSelectOption: (optId) => {
        this.answers[this.questionIndex] = optId;
      },
    };
  }

  private renderQuestionStep(): void {
    const descriptor = this.getCurrentQuestionDescriptor();

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
    this.stageEl.appendChild(questionWin);
    this.activeQuestionTextEl = promptP;

    if (this.questionOptionsRevealed) {
      promptP.textContent = descriptor.prompt;
      advanceRow.classList.add('is-collapsed');
      this.appendQuestionOptionsWindow(descriptor);
    } else {
      this.startTypewriter(promptP, advanceRow, '', descriptor.prompt);
    }
  }

  private revealCurrentQuestionOptions(): void {
    const advanceRow = this.stageEl.querySelector<HTMLElement>(
      '[data-testid="quiz-question-advance-prompt"]'
    );
    if (advanceRow) {
      advanceRow.classList.add('is-collapsed');
    }
    if (this.stageEl.querySelector('[data-testid="quiz-options-window"]')) {
      return;
    }
    const descriptor = this.getCurrentQuestionDescriptor();
    this.appendQuestionOptionsWindow(descriptor);
  }

  private appendQuestionOptionsWindow(descriptor: {
    options: ReadonlyArray<{ id: QuizOptionKey; text: string }>;
    onSelectOption: (optId: QuizOptionKey) => void;
  }): void {
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
          this.audioManager.playSfx('select');
          descriptor.onSelectOption(opt.id);
          if (this.questionIndex + 1 < TOTAL_QUIZ_QUESTION_COUNT) {
            this.questionIndex += 1;
            this.questionOptionsRevealed = false;
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

    optionsWin.appendChild(optStack);
    this.stageEl.appendChild(optionsWin);
  }

  private renderLordRevealStep(): void {
    const lordMeta = getDragonLordTraitInfo(this.selectedLordSpeciesId);
    const sp = getSpeciesById(lordMeta.speciesId);
    const skill = sp ? getPersonalSkillById(sp.personalSkillId) : undefined;
    const isLordRevealed = this.revealBeat >= 3;

    // Beats 3 & 4: Happy Pokémon Portrait Card + Colored Typing + Dragon Aura Skill
    if (isLordRevealed) {
      const heroCard = document.createElement('div');
      heroCard.className = 'pmd-window';
      heroCard.dataset.testid = 'quiz-lord-hero-card';
      heroCard.style.cssText =
        'display:flex; gap:10px; align-items:center; flex-wrap:wrap; padding:6px 10px; flex-shrink:0;';
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
      this.stageEl.appendChild(heroCard);
    }

    // Sequential Typewriter Dialogue Window
    const dialogueBox = document.createElement('div');
    dialogueBox.className = 'pmd-window pmd-quiz-dialogue-window';
    dialogueBox.dataset.testid = 'quiz-reveal-box';
    dialogueBox.dataset.revealBeat = String(this.revealBeat);

    const textEl = document.createElement('div');
    const promptRowEl = document.createElement('div');
    promptRowEl.className = 'pmd-quiz-advance-row';
    promptRowEl.dataset.testid = 'quiz-reveal-advance-prompt';
    promptRowEl.innerHTML = `<span class="pmd-quiz-advance-arrow">▼</span>`;

    this.activeRevealTextEl = textEl;

    if (this.revealBeat === 0 || this.revealBeat === 1) {
      textEl.dataset.testid = 'quiz-personality-headline';
      textEl.style.cssText =
        'font-size:clamp(15px, 2.3vw, 18px); font-weight:700; color:#f8f800; line-height:1.42; min-height:1.5em;';
      dialogueBox.append(textEl, promptRowEl);
      this.stageEl.appendChild(dialogueBox);

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
      this.stageEl.appendChild(dialogueBox);

      this.startTypewriter(textEl, promptRowEl, '', lordMeta.personalityDescription);
    } else if (this.revealBeat === 3) {
      const speciesName = sp?.name ?? lordMeta.name;
      textEl.dataset.testid = 'quiz-revealed-lord-name';
      textEl.style.cssText =
        'font-size:clamp(15px, 2.3vw, 18px); font-weight:700; color:#f8f800; line-height:1.42; min-height:1.5em;';
      dialogueBox.append(textEl, promptRowEl);
      this.stageEl.appendChild(dialogueBox);

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
      promptRowEl.innerHTML = `<span class="pmd-quiz-advance-arrow">▶</span>`;
      dialogueBox.append(textEl, promptRowEl);
      this.stageEl.appendChild(dialogueBox);

      const actionRow = document.createElement('div');
      actionRow.style.cssText = 'display:flex; justify-content:flex-end; flex-shrink:0;';
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
      this.stageEl.appendChild(actionRow);

      this.startTypewriter(
        textEl,
        promptRowEl,
        '',
        'Now go forth and help save the world from certain destruction!'
      );
    }
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
      tutorialsEnabled: true,
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
