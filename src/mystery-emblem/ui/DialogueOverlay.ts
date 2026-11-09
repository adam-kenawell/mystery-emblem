/**
 * Portrait Dialogue Engine Coordinator (`DialogueOverlay.ts`)
 *
 * Delegates DOM construction to `DialogueDomView`, speaker/portrait/subform resolution
 * to `speakerResolver`, and typewriter text pacing to `TypewriterController`.
 */

import type { PmdPortraitEmotion } from '../assets/pmdAssetLoader';
import {
  getAudioManager,
  type AudioManager,
  type PmdUiSfxId,
} from '../audio/AudioManager';
import {
  interpolateCampaignText,
  resolveSpeakerIdentity,
  type DialogueSpeakerRef,
  type ResolvedSpeakerIdentity,
} from '../engine/speakerResolver';
import type { SaveStateManager } from '../state/SaveStateManager';
import type { SaveData } from '../types/schemas';
import { buildDialogueDomView, type DialogueDomElements } from './DialogueDomView';
import {
  prefersReducedMotionEnabled,
  TypewriterController,
} from './typewriterController';

export type { DialogueSpeakerRef, ResolvedSpeakerIdentity };

export type DialogueSide = 'left' | 'right';

export interface DialogueLine {
  speaker: DialogueSpeakerRef;
  side: DialogueSide;
  emotion: PmdPortraitEmotion;
  /** Supports `{lord}`, `{partner}`, `{healer}`, `{advisor}`, and `{speaker}` custom nickname placeholders */
  text: string;
  clearOppositePortrait?: boolean;
  bgm?: string | null;
  sfx?: PmdUiSfxId;
  stageCueId?: string;
}

export interface DialogueScript {
  id: string;
  title?: string;
  bgm?: string | null;
  restorePreviousBgmOnClose?: boolean;
  lines: DialogueLine[];
}

export type DialogueFinishReason = 'completed' | 'skipped' | 'cancelled';

export interface PlayDialogueOptions {
  typewriterMsPerChar?: number;
  inCutsceneStage?: boolean;
  onLineStart?: (lineIndex: number, line: DialogueLine) => void | Promise<void>;
  onAdvanceInterrupt?: () => void;
}

interface SideSlotState {
  speaker: DialogueSpeakerRef;
  emotion: PmdPortraitEmotion;
}

export class DialogueOverlay {
  public readonly rootEl: HTMLElement;
  private readonly dom: DialogueDomElements;
  private readonly saveManager: SaveStateManager;
  private readonly audioManager: AudioManager;
  private unsubscribeSave: (() => void) | null = null;
  private readonly uiAbort = new AbortController();
  private readonly typewriter = new TypewriterController();

  private activeScript: DialogueScript | null = null;
  private currentLineIndex = 0;
  private savedPreCutsceneBgmId: string | null = null;
  private cutsceneChangedBgm = false;
  private activeSides: Record<DialogueSide, SideSlotState | null> = {
    left: null,
    right: null,
  };

  private typewriterMsPerChar = 10;
  private finishResolver: ((reason: DialogueFinishReason) => void) | null = null;
  private activeOnLineStart?: (lineIndex: number, line: DialogueLine) => void | Promise<void>;
  private activeOnAdvanceInterrupt?: () => void;
  private onStateChange?: () => void;

  constructor(
    mountParent: HTMLElement,
    saveManager: SaveStateManager,
    options?: { onStateChange?: () => void; audioManager?: AudioManager }
  ) {
    this.saveManager = saveManager;
    this.audioManager = options?.audioManager ?? getAudioManager();
    this.onStateChange = options?.onStateChange;

    this.dom = buildDialogueDomView({
      mountParent,
      signal: this.uiAbort.signal,
      onAdvance: () => this.handleAdvanceTap(),
      onSkip: () => {
        this.audioManager.playSfx('cancel');
        this.close('skipped');
      },
      onCancel: () => {
        this.audioManager.playSfx('cancel');
        this.close('cancelled');
      },
    });
    this.rootEl = this.dom.rootEl;

    this.unsubscribeSave = this.saveManager.subscribe(() => {
      if (this.isOpen()) {
        void this.renderCurrentLine({ preserveTypewriterProgress: true });
      }
    });
  }

  public isOpen(): boolean {
    return !this.rootEl.hidden && this.activeScript !== null;
  }

  public async playScript(
    script: DialogueScript,
    options?: PlayDialogueOptions
  ): Promise<DialogueFinishReason> {
    if (script.lines.length === 0) return 'completed';

    if (this.finishResolver) {
      this.typewriter.stop();
      const prevResolve = this.finishResolver;
      this.finishResolver = null;
      prevResolve('cancelled');
    }

    this.typewriterMsPerChar =
      options?.typewriterMsPerChar ?? (prefersReducedMotionEnabled() ? 0 : 10);
    this.activeOnLineStart = options?.onLineStart;
    this.activeOnAdvanceInterrupt = options?.onAdvanceInterrupt;
    this.rootEl.classList.toggle('is-cutscene-stage', Boolean(options?.inCutsceneStage));

    this.savedPreCutsceneBgmId = this.audioManager.getCurrentTrackId();
    this.cutsceneChangedBgm = false;

    this.activeScript = script;
    this.currentLineIndex = 0;
    this.activeSides = { left: null, right: null };
    this.dom.leftSlotEl.hidden = true;
    this.dom.rightSlotEl.hidden = true;
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

    this.typewriter.stop();
    this.activeScript = null;
    this.activeOnLineStart = undefined;
    this.activeOnAdvanceInterrupt = undefined;
    this.rootEl.classList.remove('is-cutscene-stage');
    this.cutsceneChangedBgm = false;
    this.activeSides = { left: null, right: null };
    this.rootEl.hidden = true;
    this.onStateChange?.();

    if (shouldRestoreBgm) {
      if (restoreId) this.audioManager.playBgm(restoreId, { fadeMs: 320 });
      else this.audioManager.stopBgm({ fadeMs: 320 });
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
    this.unsubscribeSave?.();
    this.unsubscribeSave = null;
    this.rootEl.remove();
  }

  public resolveSpeaker(speaker: DialogueSpeakerRef, save: SaveData | null): ResolvedSpeakerIdentity {
    return resolveSpeakerIdentity(speaker, save);
  }

  private handleAdvanceTap(): void {
    if (!this.activeScript) return;
    if (this.typewriter.isAnimating()) {
      this.typewriter.completeImmediately();
      this.syncAdvanceButtonLabel();
      return;
    }

    this.audioManager.playSfx('dialogue_advance');
    this.activeOnAdvanceInterrupt?.();

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
    this.dom.advanceBtn.innerHTML = `<span>${label}</span><span class="pmd-dialogue-caret" aria-hidden="true">▼</span>`;
  }

  private async renderCurrentLine(opts: { preserveTypewriterProgress: boolean }): Promise<void> {
    const line = this.activeScript?.lines[this.currentLineIndex];
    if (!line) return;

    if (!opts.preserveTypewriterProgress) {
      if (line.bgm !== undefined) {
        this.cutsceneChangedBgm = true;
        this.audioManager.playBgm(line.bgm, { fadeMs: 320 });
      }
      if (line.sfx) this.audioManager.playSfx(line.sfx);
      void this.activeOnLineStart?.(this.currentLineIndex, line);
    }

    const save = this.saveManager.getSave();
    const oppositeSide: DialogueSide = line.side === 'left' ? 'right' : 'left';
    this.activeSides[line.side] = { speaker: line.speaker, emotion: line.emotion };
    if (line.clearOppositePortrait) this.activeSides[oppositeSide] = null;

    const activeIdentity = this.resolveSpeaker(line.speaker, save);
    this.dom.nicknameEl.textContent = activeIdentity.nickname;
    this.dom.speciesBadgeEl.textContent = activeIdentity.speciesName;
    this.dom.speciesBadgeEl.hidden =
      activeIdentity.nickname.trim().toLowerCase() ===
      activeIdentity.speciesName.trim().toLowerCase();

    const formattedText = interpolateCampaignText(line.text, save, activeIdentity.nickname);
    if (!opts.preserveTypewriterProgress) {
      this.typewriter.start({
        targetEl: this.dom.textEl,
        text: formattedText,
        msPerTick: this.typewriterMsPerChar,
        charsPerTick: 2,
        onTick: () => this.audioManager.playSfx('typewriter_blip'),
      });
    } else {
      this.typewriter.updateTextPreservingProgress(this.dom.textEl, formattedText);
    }

    this.syncAdvanceButtonLabel();

    const portraitTasks: Promise<unknown>[] = [];
    for (const side of ['left', 'right'] as const) {
      const slotEl = side === 'left' ? this.dom.leftSlotEl : this.dom.rightSlotEl;
      const view = side === 'left' ? this.dom.leftPortrait : this.dom.rightPortrait;
      const state = this.activeSides[side];
      if (!state) {
        slotEl.hidden = true;
        continue;
      }
      const id = this.resolveSpeaker(state.speaker, save);
      slotEl.hidden = false;
      slotEl.classList.toggle('is-speaking', line.side === side);
      slotEl.classList.toggle('is-listening', line.side !== side);
      portraitTasks.push(
        view.setPortrait({
          speciesIdOrAssetId: id.visualAssetId ?? id.speciesId ?? id.pmdAssetId,
          emotion: state.emotion,
          mirrorHorizontal: side === 'right',
        })
      );
    }
    await Promise.all(portraitTasks);
  }
}
