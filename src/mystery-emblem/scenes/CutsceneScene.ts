/**
 * Out-of-Dungeon Choreographed PMD Sprite Cutscene Player (`CutsceneScene.ts`)
 *
 * Plays a `CutsceneDoc` beat by beat: consecutive dialogue beats share one dialogue-box run,
 * while silent beats (and "wait for actions" beats) hide the box until their actions finish.
 * 100% Unified Pointer Event driven (`pointerdown` / `pointerup` ONLY; ZERO keyboard listeners).
 */

import { getAudioManager, type AudioManager } from '../audio/AudioManager';
import type { Beat, CutsceneDoc, LocationDoc } from '../data/cutscenes/cutsceneDocTypes';
import {
  buildBeatDialogueLine,
  musicChangeToBgm,
  resolveBeatSides,
  showIfPasses,
} from '../data/cutscenes/dialogueCompiler';
import { resolveMediaUrl } from '../data/cutscenes/mediaLibrary';
import type { SaveStateManager } from '../state/SaveStateManager';
import type { DungeonMapTileCell, SaveData } from '../types/schemas';
import type { DialogueFinishReason, DialogueLine, DialogueOverlay } from '../ui/DialogueOverlay';
import { prefersReducedMotionEnabled } from '../ui/typewriterController';
import {
  createCutsceneAssetCaches,
  preloadCutsceneAssets,
} from './cutscene/cutsceneActorResolver';
import { CutsceneStageRuntime } from './cutscene/cutsceneChoreographer';
import { buildCutsceneDomShell, type CutsceneDomShell } from './cutscene/cutsceneDomShell';
import { createAmbientMotes } from './cutscene/cutscenePropsAndMoods';
import { renderCutsceneStageFrame } from './cutscene/cutsceneRenderer';
import type { AmbientMote, CutsceneSceneOptions, CutsceneSceneSnapshot } from './cutscene/cutsceneTypes';

export * from './cutscene/cutsceneTypes';

export interface PlayCutsceneOptions {
  /** Play against this save instead of the live one (editor preview party) */
  saveOverride?: SaveData;
  /** Start partway through (editor "play from here"); earlier beats are applied instantly */
  startBeat?: number;
  /** Unsaved location edits to use instead of the registry copies */
  locationOverrides?: ReadonlyMap<string, LocationDoc>;
}

export class CutsceneScene {
  public readonly rootEl: HTMLElement;
  private readonly shell: CutsceneDomShell;
  private readonly viewportEl: HTMLElement;
  private readonly saveManager: SaveStateManager;
  private readonly dialogueOverlay: DialogueOverlay;
  private readonly audioManager: AudioManager;
  private readonly onStateChange?: () => void;

  private readonly caches = createCutsceneAssetCaches();
  private readonly ambientMotes: AmbientMote[] = createAmbientMotes(22);
  private readonly abortController = new AbortController();

  private openState = false;
  private fastMode = false;
  private activeDoc: CutsceneDoc | null = null;
  private runtime: CutsceneStageRuntime | null = null;
  private viewHeightCss = 540;
  private displayScale = 2;
  private lastRafMs = 0;
  private rafId: number | null = null;
  private currentBeatIndex = -1;
  private currentLineIndex = -1;
  private skippedEarly = false;
  private silentResolve: (() => void) | null = null;
  private silentTimer: number | null = null;
  private runToken = 0;
  private usingSaveOverride = false;

  constructor(options: CutsceneSceneOptions) {
    this.viewportEl = options.viewportEl;
    this.saveManager = options.saveManager;
    this.dialogueOverlay = options.dialogueOverlay;
    this.audioManager = options.audioManager ?? getAudioManager();
    this.onStateChange = options.onStateChange;

    this.shell = buildCutsceneDomShell({
      viewportEl: this.viewportEl,
      signal: this.abortController.signal,
      onIntroSkipTap: () => {
        this.audioManager.playSfx('cancel');
        this.skipActiveCutscene();
      },
      onStageTapInterrupt: () => {
        if (!this.openState || !this.silentResolve) return;
        this.runtime?.flush();
        this.finishSilentWait();
      },
    });
    this.rootEl = this.shell.rootEl;
  }

  public isOpen(): boolean { return this.openState; }
  public setFastMode(enabled: boolean): void { this.fastMode = Boolean(enabled); }
  public handleBack(): void { this.skipActiveCutscene(); }

  public skipActiveCutscene(): void {
    if (!this.openState) return;
    this.skippedEarly = true;
    this.runtime?.flush();
    this.finishSilentWait();
    if (this.dialogueOverlay.isOpen()) this.dialogueOverlay.close('skipped');
  }

  private finishSilentWait(): void {
    if (this.silentTimer !== null) window.clearTimeout(this.silentTimer);
    this.silentTimer = null;
    const done = this.silentResolve;
    this.silentResolve = null;
    done?.();
  }

  public async play(doc: CutsceneDoc, opts: PlayCutsceneOptions = {}): Promise<DialogueFinishReason> {
    const token = ++this.runToken;
    this.finishSilentWait();
    if (this.dialogueOverlay.isOpen()) this.dialogueOverlay.close('cancelled');

    const save = opts.saveOverride ?? this.saveManager.getSave();
    this.usingSaveOverride = Boolean(opts.saveOverride);
    const runtime = new CutsceneStageRuntime(doc, save, this.caches);
    runtime.onSound = (url) => this.audioManager.playSfxUrl(url);
    runtime.onBannerChange = (text) => {
      this.shell.locationBannerEl.textContent = text;
    };
    this.activeDoc = doc;
    this.runtime = runtime;
    this.openState = true;
    this.skippedEarly = false;
    this.currentBeatIndex = -1;
    this.currentLineIndex = -1;

    this.shell.locationBannerEl.hidden = true;
    this.shell.ctx.fillStyle = '#000000';
    this.shell.ctx.fillRect(0, 0, this.shell.canvas.width, this.shell.canvas.height);
    this.rootEl.dataset.cutsceneId = doc.id;
    this.rootEl.hidden = false;
    this.viewportEl.classList.add('is-battle-active');
    this.onStateChange?.();

    await preloadCutsceneAssets({ doc, actors: runtime.actors, caches: this.caches, locationOverrides: opts.locationOverrides });
    if (!this.isCurrent(token)) return 'cancelled';

    const startBeat = Math.max(0, Math.min(doc.beats.length, opts.startBeat ?? 0));
    if (startBeat > 0) runtime.fastForwardTo(startBeat);
    else runtime.resetToStart();

    const initialBeat = doc.beats[startBeat];
    if (initialBeat && showIfPasses(initialBeat.showIf, doc.cast, save)) {
      for (const act of initialBeat.actions ?? []) {
        if (act.type === 'fade' && (act.duration ?? 0.5) <= 0 && !act.delay && act.start !== 'after') {
          runtime.executeAction(act, true);
        }
      }
    }

    this.refreshSize();
    this.startLoop();
    this.renderFrame();

    let music: string | null = doc.music;
    for (let i = 0; i <= startBeat && i < doc.beats.length; i++) {
      const beat = doc.beats[i]!;
      if (!showIfPasses(beat.showIf, doc.cast, save)) continue;
      const next = musicChangeToBgm(beat.music, doc.music);
      if (next !== undefined) music = next;
    }
    this.audioManager.playBgm(music, { fadeMs: 320 });

    const reason = await this.runBeats(doc, runtime, save, startBeat, token);
    if (this.isCurrent(token)) this.closeInternal();
    return this.skippedEarly ? 'skipped' : reason;
  }

  private isCurrent(token: number): boolean {
    return this.openState && token === this.runToken;
  }

  private async runBeats(
    doc: CutsceneDoc,
    runtime: CutsceneStageRuntime,
    save: SaveData | null,
    startBeat: number,
    token: number
  ): Promise<DialogueFinishReason> {
    const sides = resolveBeatSides(doc.beats);
    const reducedMotion = prefersReducedMotionEnabled();
    let i = startBeat;
    while (i < doc.beats.length) {
      if (!this.isCurrent(token)) return 'cancelled';
      if (this.skippedEarly) return 'skipped';
      const beat = doc.beats[i]!;
      if (!showIfPasses(beat.showIf, doc.cast, save)) {
        i++;
        continue;
      }

      let actionsAlreadyRun = false;
      if (!beat.say || beat.waitForActions) {
        this.currentBeatIndex = i;
        this.applyBeatAudio(beat, doc);
        await this.runSilentBeat(beat, runtime, reducedMotion);
        actionsAlreadyRun = true;
        if (!beat.say) {
          i++;
          continue;
        }
      }

      const segment: Array<{ beat: Beat; index: number; runActions: boolean }> = [];
      let j = i;
      while (j < doc.beats.length) {
        const b = doc.beats[j]!;
        if (!showIfPasses(b.showIf, doc.cast, save)) {
          j++;
          continue;
        }
        if (!b.say || (b.waitForActions && j !== i)) break;
        segment.push({ beat: b, index: j, runActions: !(j === i && actionsAlreadyRun) });
        j++;
      }

      const lines: DialogueLine[] = [];
      const lineBeats: typeof segment = [];
      for (const entry of segment) {
        const line = buildBeatDialogueLine({
          beat: entry.beat,
          side: sides.get(entry.beat.id) ?? 'left',
          cast: doc.cast,
          save,
          mainSong: doc.music,
          includeMusicAndSound: entry.runActions,
        });
        if (!line) continue;
        lines.push(line);
        lineBeats.push(entry);
      }

      if (lines.length > 0) {
        const reason = await this.dialogueOverlay.playScript(
          { id: `${doc.id}_beats_${i}`, lines, restorePreviousBgmOnClose: false },
          {
            inCutsceneStage: true,
            typewriterMsPerChar: this.fastMode || reducedMotion ? 0 : 10,
            ...(this.usingSaveOverride ? { saveOverride: save } : {}),
            onLineStart: (lineIdx) => {
              if (!this.isCurrent(token)) return;
              if (this.skippedEarly) {
                this.dialogueOverlay.close('skipped');
                return;
              }
              const entry = lineBeats[lineIdx];
              if (!entry) return;
              this.currentBeatIndex = entry.index;
              this.currentLineIndex += 1;
              if (entry.runActions) runtime.runBeatActions(entry.beat, this.fastMode);
              this.renderFrame();
            },
            onAdvanceInterrupt: () => {
              if (!this.isCurrent(token)) return;
              runtime.flush();
              this.renderFrame();
            },
          }
        );
        if (reason !== 'completed') return reason;
      }
      i = Math.max(j, i + 1);
    }
    return 'completed';
  }

  private applyBeatAudio(beat: Beat, doc: CutsceneDoc): void {
    const bgm = musicChangeToBgm(beat.music, doc.music);
    if (bgm !== undefined) this.audioManager.playBgm(bgm, { fadeMs: 320 });
    const sfx = resolveMediaUrl('sfx', beat.sound);
    if (sfx) this.audioManager.playSfxUrl(sfx);
  }

  private async runSilentBeat(beat: Beat, runtime: CutsceneStageRuntime, reducedMotion: boolean): Promise<void> {
    const instant = this.fastMode || reducedMotion;
    const actionsMs = runtime.runBeatActions(beat, instant);
    const waitMs = instant
      ? 0
      : beat.advance?.kind === 'seconds'
        ? Math.max(0, beat.advance.seconds * 1000)
        : actionsMs;
    if (waitMs <= 0) {
      this.renderFrame();
      return;
    }
    this.shell.introSkipBtn.hidden = false;
    await new Promise<void>((resolve) => {
      this.silentResolve = resolve;
      this.silentTimer = window.setTimeout(() => this.finishSilentWait(), waitMs);
    });
    this.shell.introSkipBtn.hidden = true;
  }

  public close(): void {
    this.runToken++;
    if (this.dialogueOverlay.isOpen()) this.dialogueOverlay.close('cancelled');
    this.closeInternal();
  }

  private closeInternal(): void {
    if (!this.openState) return;
    this.openState = false;
    this.shell.introSkipBtn.hidden = true;
    this.finishSilentWait();
    this.stopLoop();
    this.rootEl.hidden = true;
    this.shell.canvas.style.filter = '';
    delete this.rootEl.dataset.cutsceneId;
    this.viewportEl.classList.remove('is-battle-active');
    this.onStateChange?.();
  }

  public destroy(): void {
    this.close();
    this.shell.disconnectResize();
    this.abortController.abort();
    this.rootEl.remove();
  }

  public advanceClockForTest(ms: number): void {
    let rem = Math.max(0, ms);
    while (rem > 0 && this.runtime) {
      const dt = Math.min(16, rem);
      this.runtime.step(dt);
      rem -= dt;
    }
    this.renderFrame();
  }

  public getTileAt(tx: number, ty: number): DungeonMapTileCell | null {
    const layer = this.runtime?.location.layers.find((l) => l.kind === 'tiles' && l.grid);
    const cell = layer?.grid?.[ty]?.[tx];
    return cell ? { ...cell } : null;
  }

  public getSnapshot(): CutsceneSceneSnapshot {
    const rt = this.runtime;
    return {
      isOpen: this.openState,
      cutsceneId: this.activeDoc?.id ?? null,
      locationId: rt?.location.doc.id ?? null,
      stageWidth: rt?.location.width ?? 0,
      stageHeight: rt?.location.height ?? 0,
      title: this.activeDoc?.title ?? null,
      locationLabel: rt?.banner ?? null,
      lightingMood: rt?.lighting.mood ?? null,
      weather: rt?.weather ?? 'none',
      currentBeatIndex: this.currentBeatIndex,
      currentLineIndex: this.currentLineIndex,
      cameraTile: {
        x: Math.round((rt?.cameraTileX ?? 0) * 100) / 100,
        y: Math.round((rt?.cameraTileY ?? 0) * 100) / 100,
      },
      displayScale: this.displayScale,
      actors: (rt?.actors ?? [])
        .filter((a) => a.available && !a.offStage)
        .map((a) => ({
          actorId: a.actorId,
          roleKind: a.roleKind,
          nickname: a.nickname,
          speciesId: a.speciesId,
          pmdAssetId: a.pmdAssetId,
          visualAssetKey: a.visualAssetKey,
          visible: a.visible,
          x: Math.round(a.x * 100) / 100,
          y: Math.round(a.y * 100) / 100,
          direction: a.direction,
          action: a.action,
          pose: a.poseName,
          activeEmote: a.emote?.kind ?? null,
        })),
      propCount: rt?.props.length ?? 0,
    };
  }

  private refreshSize(): void {
    const metrics = this.shell.syncViewportSize(
      () => this.openState,
      () => {
        const next = this.shell.syncViewportSize(() => this.openState, () => {});
        this.viewHeightCss = next.viewHeightCss;
        this.displayScale = next.displayScale;
        this.renderFrame();
      }
    );
    this.viewHeightCss = metrics.viewHeightCss;
    this.displayScale = metrics.displayScale;
  }

  private startLoop(): void {
    if (this.rafId !== null) return;
    this.lastRafMs = performance.now();
    const tick = (now: number) => {
      if (!this.openState) {
        this.rafId = null;
        return;
      }
      const dt = Math.min(64, Math.max(0, now - this.lastRafMs));
      this.lastRafMs = now;
      this.runtime?.step(dt);
      this.renderFrame();
      this.rafId = window.requestAnimationFrame(tick);
    };
    this.rafId = window.requestAnimationFrame(tick);
  }

  private stopLoop(): void {
    if (this.rafId !== null) window.cancelAnimationFrame(this.rafId);
    this.rafId = null;
  }

  private renderFrame(): void {
    if (!this.openState || !this.runtime) return;
    this.shell.locationBannerEl.hidden =
      !this.runtime.banner || Boolean(this.runtime.fade && this.runtime.fade.alpha >= 0.99);
    const { cssFilter } = renderCutsceneStageFrame({
      ctx: this.shell.ctx,
      nativeW: this.shell.canvas.width,
      nativeH: this.shell.canvas.height,
      viewHeightCss: this.viewHeightCss,
      runtime: this.runtime,
      ambientMotes: this.ambientMotes,
    });
    if (this.shell.canvas.style.filter !== cssFilter) this.shell.canvas.style.filter = cssFilter;
  }
}
