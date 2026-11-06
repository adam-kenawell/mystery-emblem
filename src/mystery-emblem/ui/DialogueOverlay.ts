/**
 * Portrait Dialogue Engine (`DIALOGUE_OVERLAY`) — Step 2 + Audio Cues
 *
 * Authentic Pokémon Mystery Dungeon: Explorers of Sky cutscene & conversation engine:
 * - Left & Right double-bordered character portrait slots (`image-rendering: pixelated`)
 * - Dynamic custom nickname + species name resolution from `SaveStateManager`
 * - Per-line facial expression swapping across all 8 PMD emotions
 * - Per-script & per-line PMD BGM crossfading + subtle UI/typewriter chimes via `AudioManager`
 * - Automatic live portrait & species-name updates when a unit's evolution stage changes
 * - 100% Unified Pointer Event driven (click/tap to reveal/advance, Skip & Back controls; zero keyboard listeners)
 */

import { type PmdPortraitEmotion } from '../assets/pmdAssetLoader';
import {
  getAudioManager,
  type AudioManager,
  type PmdUiSfxId,
} from '../audio/AudioManager';
import { getSpeciesById } from '../data/index';
import type { SaveStateManager } from '../state/SaveStateManager';
import type { OwnedPokemonInstance, SaveData } from '../types/schemas';
import { PmdPortraitView } from './PmdSpriteCanvas';
import { createPmdButton, createPmdWindow } from './PmdWindow';
import { bindBackGestureSurface, bindPointerTap } from './pointerControls';

export type DialogueSide = 'left' | 'right';

export type DialogueSpeakerRef =
  | { kind: 'lord'; fallbackSpeciesId?: string }
  | { kind: 'partner'; fallbackSpeciesId?: string }
  | { kind: 'healer'; fallbackSpeciesId?: string }
  | { kind: 'unit'; instanceId: string; fallbackSpeciesId?: string }
  | { kind: 'species'; speciesId: string; nickname?: string }
  | { kind: 'npc'; pmdAssetId: string; speciesName: string; nickname: string };

export interface DialogueLine {
  speaker: DialogueSpeakerRef;
  side: DialogueSide;
  emotion: PmdPortraitEmotion;
  /** Supports `{lord}`, `{partner}`, `{healer}`, and `{speaker}` custom nickname placeholders */
  text: string;
  /** If true, hides the opposite portrait slot on this line instead of keeping the listener visible */
  clearOppositePortrait?: boolean;
  /** Optional BGM track ID or alias to crossfade to on this line (`null` = fade to silence) */
  bgm?: string | null;
  /** Optional UI/scene SFX cue triggered when this line begins */
  sfx?: PmdUiSfxId;
}

export interface DialogueScript {
  id: string;
  title?: string;
  /** Optional default BGM track ID or alias when the script opens */
  bgm?: string | null;
  /** Defaults to `true`: restores whatever BGM was playing prior to opening this script */
  restorePreviousBgmOnClose?: boolean;
  lines: DialogueLine[];
}

export interface ResolvedSpeakerIdentity {
  nickname: string;
  speciesName: string;
  speciesId?: string;
  pmdAssetId: string;
  instanceId?: string;
}

export type DialogueFinishReason = 'completed' | 'skipped' | 'cancelled';

export interface PlayDialogueOptions {
  /** Override typewriter speed in ms per character (`0` = instant full-line reveal) */
  typewriterMsPerChar?: number;
}

interface SideSlotState {
  speaker: DialogueSpeakerRef;
  emotion: PmdPortraitEmotion;
}

export class DialogueOverlay {
  public readonly rootEl: HTMLElement;
  private readonly stageEl: HTMLElement;
  private readonly leftSlotEl: HTMLElement;
  private readonly rightSlotEl: HTMLElement;
  private readonly leftEmotionEl: HTMLElement;
  private readonly rightEmotionEl: HTMLElement;
  private readonly leftPortrait: PmdPortraitView;
  private readonly rightPortrait: PmdPortraitView;
  private readonly boxEl: HTMLElement;
  private readonly nicknameEl: HTMLElement;
  private readonly speciesBadgeEl: HTMLElement;
  private readonly bgmBadgeEl: HTMLElement;
  private readonly progressEl: HTMLElement;
  private readonly skipBtn: HTMLButtonElement;
  private readonly textEl: HTMLElement;
  private readonly advanceBtn: HTMLButtonElement;

  private readonly saveManager: SaveStateManager;
  private readonly audioManager: AudioManager;
  private unsubscribeSave: (() => void) | null = null;
  private unsubscribeAudio: (() => void) | null = null;
  private readonly uiAbort = new AbortController();

  private activeScript: DialogueScript | null = null;
  private currentLineIndex = 0;
  private savedPreCutsceneBgmId: string | null = null;
  private cutsceneChangedBgm = false;
  private activeSides: Record<DialogueSide, SideSlotState | null> = {
    left: null,
    right: null,
  };

  private fullLineText = '';
  private revealedChars = 0;
  private typewriterTimer: number | null = null;
  private typewriterMsPerChar = 10;
  private finishResolver: ((reason: DialogueFinishReason) => void) | null = null;
  private onStateChange?: () => void;

  constructor(
    mountParent: HTMLElement,
    saveManager: SaveStateManager,
    options?: { onStateChange?: () => void; audioManager?: AudioManager }
  ) {
    this.saveManager = saveManager;
    this.audioManager = options?.audioManager ?? getAudioManager();
    this.onStateChange = options?.onStateChange;

    this.rootEl = document.createElement('div');
    this.rootEl.id = 'pmd-dialogue-overlay';
    this.rootEl.className = 'pmd-dialogue-overlay';
    this.rootEl.dataset.testid = 'dialogue-overlay';
    this.rootEl.hidden = true;
    this.rootEl.setAttribute('role', 'dialog');
    this.rootEl.setAttribute('aria-modal', 'true');
    this.rootEl.setAttribute('aria-label', 'Story Dialogue');

    this.stageEl = document.createElement('div');
    this.stageEl.className = 'pmd-dialogue-stage';

    // Left Portrait Frame
    this.leftSlotEl = createPmdWindow({
      variant: 'compact',
      className: 'pmd-dialogue-portrait-slot pmd-dialogue-portrait-slot--left',
      testId: 'dialogue-portrait-left',
    });
    this.leftSlotEl.hidden = true;
    this.leftPortrait = new PmdPortraitView({ testId: 'dialogue-portrait-left-canvas' });
    this.leftEmotionEl = document.createElement('span');
    this.leftEmotionEl.className = 'pmd-dialogue-emotion-pill';
    this.leftEmotionEl.dataset.testid = 'dialogue-emotion-left';
    this.leftSlotEl.append(this.leftPortrait.canvas, this.leftEmotionEl);

    // Right Portrait Frame (horizontally mirrored inward toward center)
    this.rightSlotEl = createPmdWindow({
      variant: 'compact',
      className: 'pmd-dialogue-portrait-slot pmd-dialogue-portrait-slot--right',
      testId: 'dialogue-portrait-right',
    });
    this.rightSlotEl.hidden = true;
    this.rightPortrait = new PmdPortraitView({ testId: 'dialogue-portrait-right-canvas' });
    this.rightEmotionEl = document.createElement('span');
    this.rightEmotionEl.className = 'pmd-dialogue-emotion-pill';
    this.rightEmotionEl.dataset.testid = 'dialogue-emotion-right';
    this.rightSlotEl.append(this.rightPortrait.canvas, this.rightEmotionEl);

    // Main PMD Dialogue Window
    this.boxEl = createPmdWindow({
      className: 'pmd-dialogue-box',
      testId: 'dialogue-box',
    });

    const headerEl = document.createElement('div');
    headerEl.className = 'pmd-dialogue-header';

    const speakerGroup = document.createElement('div');
    speakerGroup.className = 'pmd-dialogue-speaker-group';

    this.nicknameEl = document.createElement('span');
    this.nicknameEl.className = 'pmd-dialogue-nickname';
    this.nicknameEl.dataset.testid = 'dialogue-speaker-nickname';

    this.speciesBadgeEl = document.createElement('span');
    this.speciesBadgeEl.className = 'pmd-dialogue-species-badge';
    this.speciesBadgeEl.dataset.testid = 'dialogue-speaker-species';

    speakerGroup.append(this.nicknameEl, this.speciesBadgeEl);

    const controlsGroup = document.createElement('div');
    controlsGroup.className = 'pmd-dialogue-controls';

    this.bgmBadgeEl = document.createElement('span');
    this.bgmBadgeEl.className = 'pmd-dialogue-bgm-badge';
    this.bgmBadgeEl.dataset.testid = 'dialogue-bgm-badge';
    this.bgmBadgeEl.hidden = true;

    this.progressEl = document.createElement('span');
    this.progressEl.className = 'pmd-dialogue-progress';
    this.progressEl.dataset.testid = 'dialogue-progress';

    this.skipBtn = createPmdButton({
      label: 'Skip',
      className: 'pmd-dialogue-skip-btn',
      testId: 'dialogue-skip-btn',
      ariaLabel: 'Skip dialogue',
      onTap: () => {
        this.audioManager.playSfx('cancel');
        this.close('skipped');
      },
      tapOptions: { signal: this.uiAbort.signal, stopPropagation: true },
    });

    controlsGroup.append(this.bgmBadgeEl, this.progressEl, this.skipBtn);
    headerEl.append(speakerGroup, controlsGroup);

    const bodyEl = document.createElement('div');
    bodyEl.className = 'pmd-dialogue-body';

    this.textEl = document.createElement('p');
    this.textEl.className = 'pmd-dialogue-text';
    this.textEl.dataset.testid = 'dialogue-text';

    this.advanceBtn = createPmdButton({
      label: 'Next ▼',
      variant: 'primary',
      className: 'pmd-dialogue-advance-btn',
      testId: 'dialogue-advance-btn',
      ariaLabel: 'Advance dialogue',
      onTap: () => this.handleAdvanceTap(),
      tapOptions: { signal: this.uiAbort.signal, stopPropagation: true },
    });
    this.advanceBtn.innerHTML = '<span>Next</span><span class="pmd-dialogue-caret" aria-hidden="true">▼</span>';

    bodyEl.append(this.textEl, this.advanceBtn);
    this.boxEl.append(headerEl, bodyEl);

    this.stageEl.append(this.leftSlotEl, this.rightSlotEl, this.boxEl);
    this.rootEl.appendChild(this.stageEl);
    mountParent.appendChild(this.rootEl);

    // Tapping anywhere on the dialogue window or portrait frames advances the conversation
    bindPointerTap(this.boxEl, () => this.handleAdvanceTap(), {
      signal: this.uiAbort.signal,
      stopPropagation: true,
    });
    bindPointerTap(this.leftSlotEl, () => this.handleAdvanceTap(), {
      signal: this.uiAbort.signal,
      stopPropagation: true,
    });
    bindPointerTap(this.rightSlotEl, () => this.handleAdvanceTap(), {
      signal: this.uiAbort.signal,
      stopPropagation: true,
    });

    // Tapping backdrop outside the stage also advances cleanly on touch/mouse
    bindPointerTap(
      this.rootEl,
      (ev) => {
        if (ev.target === this.rootEl || ev.target === this.stageEl) {
          this.handleAdvanceTap();
        }
      },
      { signal: this.uiAbort.signal }
    );

    // PC Right-Click or Mobile Long-Press on overlay closes/cancels back cleanly
    bindBackGestureSurface(
      this.rootEl,
      () => {
        this.audioManager.playSfx('cancel');
        this.close('cancelled');
      },
      { signal: this.uiAbort.signal }
    );

    // Reactively stay in sync whenever SaveStateManager updates nicknames or evolution stages!
    this.unsubscribeSave = this.saveManager.subscribe(() => {
      if (this.isOpen()) {
        void this.renderCurrentLine({ preserveTypewriterProgress: true });
      }
    });

    this.unsubscribeAudio = this.audioManager.subscribe((snap) => {
      if (snap.currentTrack && !snap.settings.muted) {
        this.bgmBadgeEl.textContent = `♪ ${snap.currentTrack.title}`;
        this.bgmBadgeEl.dataset.trackId = snap.currentTrack.id;
        this.bgmBadgeEl.hidden = false;
      } else {
        this.bgmBadgeEl.textContent = '';
        this.bgmBadgeEl.dataset.trackId = '';
        this.bgmBadgeEl.hidden = true;
      }
    });
  }

  public isOpen(): boolean {
    return !this.rootEl.hidden && this.activeScript !== null;
  }

  public getCurrentLineIndex(): number {
    return this.currentLineIndex;
  }

  public async playScript(
    script: DialogueScript,
    options?: PlayDialogueOptions
  ): Promise<DialogueFinishReason> {
    if (script.lines.length === 0) {
      return 'completed';
    }

    // Cancel any prior script cleanly before starting the new one
    if (this.finishResolver) {
      this.clearTypewriter();
      const prevResolve = this.finishResolver;
      this.finishResolver = null;
      prevResolve('cancelled');
    }

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    this.typewriterMsPerChar =
      options?.typewriterMsPerChar ?? (prefersReducedMotion ? 0 : 10);

    this.savedPreCutsceneBgmId = this.audioManager.getCurrentTrackId();
    this.cutsceneChangedBgm = false;

    this.activeScript = script;
    this.currentLineIndex = 0;
    this.activeSides = { left: null, right: null };
    this.leftSlotEl.hidden = true;
    this.rightSlotEl.hidden = true;
    this.rootEl.hidden = false;
    this.onStateChange?.();

    if (script.bgm !== undefined && script.lines[0]?.bgm === undefined) {
      this.cutsceneChangedBgm = true;
      this.audioManager.playBgm(script.bgm, { fadeMs: 320 });
    }

    await this.renderCurrentLine({ preserveTypewriterProgress: false });

    return new Promise<DialogueFinishReason>((resolve) => {
      this.finishResolver = resolve;
    });
  }

  public close(reason: DialogueFinishReason = 'cancelled'): void {
    const closingScript = this.activeScript;
    const shouldRestoreBgm =
      closingScript !== null &&
      this.cutsceneChangedBgm &&
      closingScript.restorePreviousBgmOnClose !== false;
    const restoreId = this.savedPreCutsceneBgmId;

    this.clearTypewriter();
    this.activeScript = null;
    this.cutsceneChangedBgm = false;
    this.activeSides = { left: null, right: null };
    this.rootEl.hidden = true;
    this.onStateChange?.();

    if (shouldRestoreBgm) {
      if (restoreId) {
        this.audioManager.playBgm(restoreId, { fadeMs: 320 });
      } else {
        this.audioManager.stopBgm({ fadeMs: 320 });
      }
    }

    if (this.finishResolver) {
      const resolve = this.finishResolver;
      this.finishResolver = null;
      resolve(reason);
    }
  }

  public destroy(): void {
    this.close('cancelled');
    this.uiAbort.abort();
    if (this.unsubscribeSave) {
      this.unsubscribeSave();
      this.unsubscribeSave = null;
    }
    if (this.unsubscribeAudio) {
      this.unsubscribeAudio();
      this.unsubscribeAudio = null;
    }
    this.rootEl.remove();
  }

  public resolveSpeaker(speaker: DialogueSpeakerRef, save: SaveData | null): ResolvedSpeakerIdentity {
    const findRosterUnit = (): { unit?: OwnedPokemonInstance; fallbackSpeciesId: string } => {
      if (speaker.kind === 'lord') {
        const unit =
          save?.roster.find((u) => u.instanceId === save.campaign.lordInstanceId) ??
          save?.roster.find((u) => u.isLord) ??
          save?.roster[0];
        return { unit, fallbackSpeciesId: speaker.fallbackSpeciesId ?? 'dratini' };
      }
      if (speaker.kind === 'partner') {
        const unit =
          save?.roster.find((u) => u.instanceId === save.campaign.partnerInstanceId) ??
          save?.roster.find((_, idx) => idx === 1);
        return { unit, fallbackSpeciesId: speaker.fallbackSpeciesId ?? 'bulbasaur' };
      }
      if (speaker.kind === 'healer') {
        const seededHealer = save?.campaign.quizSeeds.q1Healer[0];
        const unit = save?.roster[2];
        return { unit, fallbackSpeciesId: speaker.fallbackSpeciesId ?? seededHealer ?? 'happiny' };
      }
      if (speaker.kind === 'unit') {
        const unit = save?.roster.find((u) => u.instanceId === speaker.instanceId);
        return { unit, fallbackSpeciesId: speaker.fallbackSpeciesId ?? 'dratini' };
      }
      return { fallbackSpeciesId: 'dratini' };
    };

    if (speaker.kind === 'npc') {
      return {
        nickname: speaker.nickname,
        speciesName: speaker.speciesName,
        pmdAssetId: speaker.pmdAssetId,
      };
    }

    if (speaker.kind === 'species') {
      const sp = getSpeciesById(speaker.speciesId);
      const speciesName = sp?.name ?? speaker.speciesId;
      return {
        nickname: speaker.nickname?.trim() || speciesName,
        speciesName,
        speciesId: sp?.id ?? speaker.speciesId,
        pmdAssetId: sp?.pmdAssetId ?? '0147',
      };
    }

    const { unit, fallbackSpeciesId } = findRosterUnit();
    if (unit) {
      const sp = getSpeciesById(unit.speciesId);
      const speciesName = sp?.name ?? unit.speciesId;
      return {
        nickname: unit.nickname,
        speciesName,
        speciesId: unit.speciesId,
        pmdAssetId: sp?.pmdAssetId ?? '0147',
        instanceId: unit.instanceId,
      };
    }

    const fallbackSp = getSpeciesById(fallbackSpeciesId);
    const fallbackName = fallbackSp?.name ?? fallbackSpeciesId;
    return {
      nickname: fallbackName,
      speciesName: fallbackName,
      speciesId: fallbackSp?.id ?? fallbackSpeciesId,
      pmdAssetId: fallbackSp?.pmdAssetId ?? '0147',
    };
  }

  private interpolateDialogueText(
    rawText: string,
    activeIdentity: ResolvedSpeakerIdentity,
    save: SaveData | null
  ): string {
    const lordName = this.resolveSpeaker({ kind: 'lord' }, save).nickname;
    const partnerName = this.resolveSpeaker({ kind: 'partner' }, save).nickname;
    const healerName = this.resolveSpeaker({ kind: 'healer' }, save).nickname;

    return rawText
      .replace(/\{speaker\}/g, activeIdentity.nickname)
      .replace(/\{lord\}/g, lordName)
      .replace(/\{partner\}/g, partnerName)
      .replace(/\{healer\}/g, healerName);
  }

  private handleAdvanceTap(): void {
    if (!this.activeScript) return;

    // First tap during active typewriter instantly finishes revealing the current line
    if (this.typewriterTimer !== null && this.revealedChars < this.fullLineText.length) {
      this.clearTypewriter();
      this.revealedChars = this.fullLineText.length;
      this.textEl.textContent = this.fullLineText;
      this.syncAdvanceButtonLabel();
      return;
    }

    this.audioManager.playSfx('dialogue_advance');

    const nextIdx = this.currentLineIndex + 1;
    if (nextIdx >= this.activeScript.lines.length) {
      this.close('completed');
      return;
    }

    this.currentLineIndex = nextIdx;
    void this.renderCurrentLine({ preserveTypewriterProgress: false });
  }

  private syncAdvanceButtonLabel(): void {
    if (!this.activeScript) return;
    const isLast = this.currentLineIndex >= this.activeScript.lines.length - 1;
    const label = isLast ? 'Done' : 'Next';
    this.advanceBtn.innerHTML = `<span>${label}</span><span class="pmd-dialogue-caret" aria-hidden="true">▼</span>`;
  }

  private clearTypewriter(): void {
    if (this.typewriterTimer !== null) {
      window.clearInterval(this.typewriterTimer);
      this.typewriterTimer = null;
    }
  }

  private async renderCurrentLine(opts: { preserveTypewriterProgress: boolean }): Promise<void> {
    if (!this.activeScript) return;
    const line = this.activeScript.lines[this.currentLineIndex];
    if (!line) return;

    if (!opts.preserveTypewriterProgress) {
      if (line.bgm !== undefined) {
        this.cutsceneChangedBgm = true;
        this.audioManager.playBgm(line.bgm, { fadeMs: 320 });
      }
      if (line.sfx) {
        this.audioManager.playSfx(line.sfx);
      }
    }

    const save = this.saveManager.getSave();
    const oppositeSide: DialogueSide = line.side === 'left' ? 'right' : 'left';

    this.activeSides[line.side] = {
      speaker: line.speaker,
      emotion: line.emotion,
    };
    if (line.clearOppositePortrait) {
      this.activeSides[oppositeSide] = null;
    }

    const activeIdentity = this.resolveSpeaker(line.speaker, save);

    // Update Speaker Nameplate (both Custom Nickname and Current Species Name)
    this.nicknameEl.textContent = activeIdentity.nickname;
    this.speciesBadgeEl.textContent = activeIdentity.speciesName;
    this.progressEl.textContent = `${this.currentLineIndex + 1} / ${this.activeScript.lines.length}`;

    const formattedText = this.interpolateDialogueText(line.text, activeIdentity, save);

    if (!opts.preserveTypewriterProgress) {
      this.clearTypewriter();
      this.fullLineText = formattedText;
      if (this.typewriterMsPerChar <= 0) {
        this.revealedChars = formattedText.length;
        this.textEl.textContent = formattedText;
      } else {
        this.revealedChars = 0;
        this.textEl.textContent = '';
        this.typewriterTimer = window.setInterval(() => {
          this.revealedChars = Math.min(this.fullLineText.length, this.revealedChars + 2);
          this.textEl.textContent = this.fullLineText.slice(0, this.revealedChars);
          this.audioManager.playSfx('typewriter_blip');
          if (this.revealedChars >= this.fullLineText.length) {
            this.clearTypewriter();
          }
        }, this.typewriterMsPerChar);
      }
    } else {
      // Live reactive update (e.g., unit renamed or evolved while line is displayed)
      const wasComplete = this.typewriterTimer === null || this.revealedChars >= this.fullLineText.length;
      this.fullLineText = formattedText;
      if (wasComplete) {
        this.revealedChars = formattedText.length;
        this.textEl.textContent = formattedText;
      }
    }

    this.syncAdvanceButtonLabel();

    // Update Left & Right Portrait Frames concurrently
    const portraitTasks: Promise<unknown>[] = [];

    if (this.activeSides.left) {
      const leftState = this.activeSides.left;
      const leftId = this.resolveSpeaker(leftState.speaker, save);
      this.leftSlotEl.hidden = false;
      this.leftSlotEl.classList.toggle('is-speaking', line.side === 'left');
      this.leftSlotEl.classList.toggle('is-listening', line.side !== 'left');
      this.leftEmotionEl.textContent = leftState.emotion;
      portraitTasks.push(
        this.leftPortrait.setPortrait({
          speciesIdOrAssetId: leftId.speciesId ?? leftId.pmdAssetId,
          emotion: leftState.emotion,
          mirrorHorizontal: false,
        })
      );
    } else {
      this.leftSlotEl.hidden = true;
    }

    if (this.activeSides.right) {
      const rightState = this.activeSides.right;
      const rightId = this.resolveSpeaker(rightState.speaker, save);
      this.rightSlotEl.hidden = false;
      this.rightSlotEl.classList.toggle('is-speaking', line.side === 'right');
      this.rightSlotEl.classList.toggle('is-listening', line.side !== 'right');
      this.rightEmotionEl.textContent = rightState.emotion;
      portraitTasks.push(
        this.rightPortrait.setPortrait({
          speciesIdOrAssetId: rightId.speciesId ?? rightId.pmdAssetId,
          emotion: rightState.emotion,
          mirrorHorizontal: true,
        })
      );
    } else {
      this.rightSlotEl.hidden = true;
    }

    await Promise.all(portraitTasks);
  }
}
