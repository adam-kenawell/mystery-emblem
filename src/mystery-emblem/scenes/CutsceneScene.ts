/**
 * Out-of-Dungeon Choreographed PMD Sprite Cutscene Coordinator (`CutsceneScene.ts`)
 *
 * 100% Unified Pointer Event driven (`pointerdown` / `pointerup` ONLY; ZERO keyboard listeners).
 */

import type { LoadedSpriteBundle } from '../assets/pmdAssetLoader';
import type { LoadedTilesetSheet } from '../assets/tilesetLoader';
import { getAudioManager, type AudioManager } from '../audio/AudioManager';
import type { SaveStateManager } from '../state/SaveStateManager';
import type {
  DialogueFinishReason,
  DialogueOverlay,
  DialogueScript,
} from '../ui/DialogueOverlay';
import { prefersReducedMotionEnabled } from '../ui/typewriterController';
import {
  buildCutsceneSceneSnapshot,
  instantiateCutsceneActor,
  preloadCutsceneStageAssets,
} from './cutscene/cutsceneActorResolver';
import { CutsceneChoreographer } from './cutscene/cutsceneChoreographer';
import { buildCutsceneDomShell, type CutsceneDomShell } from './cutscene/cutsceneDomShell';
import { createAmbientMotes } from './cutscene/cutscenePropsAndMoods';
import { renderCutsceneStageFrame } from './cutscene/cutsceneRenderer';
import type {
  AmbientMote,
  CutsceneSceneOptions,
  CutsceneSceneSnapshot,
  RuntimeCutsceneActor,
  StoryCutsceneDefinition,
} from './cutscene/cutsceneTypes';

export * from './cutscene/cutsceneTypes';

export class CutsceneScene {
  public readonly rootEl: HTMLElement;
  private readonly shell: CutsceneDomShell;
  private readonly viewportEl: HTMLElement;
  private readonly saveManager: SaveStateManager;
  private readonly dialogueOverlay: DialogueOverlay;
  private readonly audioManager: AudioManager;
  private readonly onStateChange?: () => void;

  private readonly tilesetSheets = new Map<string, LoadedTilesetSheet>();
  private readonly spriteBundles = new Map<string, LoadedSpriteBundle>();
  private readonly ambientMotes: AmbientMote[] = createAmbientMotes(22);
  private readonly choreo = new CutsceneChoreographer();
  private readonly abortController = new AbortController();

  private openState = false;
  private fastMode = false;
  private activeDef: StoryCutsceneDefinition | null = null;
  private actors: RuntimeCutsceneActor[] = [];
  private viewHeightCss = 540;
  private displayScale = 2;
  private lastRafMs = 0;
  private rafId: number | null = null;
  private currentLineIndex = -1;
  private skippedEarly = false;
  private introResolve: (() => void) | null = null;
  private runToken = 0;

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
        if (!this.openState || !this.introResolve) return;
        this.choreo.snapAllInFlight(this.actors);
        const done = this.introResolve;
        this.introResolve = null;
        done();
      },
    });
    this.rootEl = this.shell.rootEl;
  }

  public isOpen(): boolean {
    return this.openState;
  }

  public setFastMode(enabled: boolean): void {
    this.fastMode = Boolean(enabled);
  }

  public skipActiveCutscene(): void {
    if (!this.openState) return;
    this.skippedEarly = true;
    this.choreo.snapAllInFlight(this.actors);
    if (this.introResolve) {
      const done = this.introResolve;
      this.introResolve = null;
      done();
    }
    if (this.dialogueOverlay.isOpen()) this.dialogueOverlay.close('skipped');
  }

  public handleBack(): void {
    this.skipActiveCutscene();
  }

  public async play(def: StoryCutsceneDefinition): Promise<DialogueFinishReason> {
    const token = ++this.runToken;
    this.choreo.clearPendingTimers();
    if (this.dialogueOverlay.isOpen()) this.dialogueOverlay.close('cancelled');

    this.activeDef = def;
    this.openState = true;
    this.skippedEarly = false;
    this.currentLineIndex = -1;
    this.choreo.reset(def.initialCamera);

    const save = this.saveManager.getSave();
    this.actors = def.actors.map((spawn) => instantiateCutsceneActor(spawn, save));

    this.shell.locationBannerEl.textContent = def.locationLabel;
    this.rootEl.dataset.cutsceneId = def.id;
    this.rootEl.hidden = false;
    this.viewportEl.classList.add('is-battle-active');
    this.onStateChange?.();

    await preloadCutsceneStageAssets({
      def,
      actors: this.actors,
      tilesetSheets: this.tilesetSheets,
      spriteBundles: this.spriteBundles,
    });
    if (!this.openState || token !== this.runToken) return 'cancelled';

    this.refreshSize();
    this.startLoop();
    this.renderFrame();

    const script = def.buildScript(this.saveManager.getSave());
    if (script.bgm) this.audioManager.playBgm(script.bgm, { fadeMs: 320 });

    const reducedMotion = prefersReducedMotionEnabled();
    if (def.openingActions && def.openingActions.length > 0 && !this.skippedEarly) {
      this.choreo.applyCueActions(def.openingActions, this.actors, this.fastMode, () => this.openState);
      const waitMs =
        this.fastMode || reducedMotion ? 0 : Math.max(0, def.openingDurationMs ?? 650);
      if (waitMs > 0) {
        this.shell.introSkipBtn.hidden = false;
        await new Promise<void>((resolve) => {
          this.introResolve = resolve;
          this.choreo.scheduleTimeout(() => {
            if (this.introResolve === resolve) {
              this.introResolve = null;
              resolve();
            }
          }, waitMs);
        });
        this.shell.introSkipBtn.hidden = true;
      } else {
        this.choreo.snapAllInFlight(this.actors);
      }
    }

    if (!this.openState || token !== this.runToken) return 'cancelled';
    if (this.skippedEarly) {
      this.closeInternal();
      return 'skipped';
    }

    const scriptWithRestoredFlag: DialogueScript = {
      ...script,
      restorePreviousBgmOnClose: false,
    };

    const reason = await this.dialogueOverlay.playScript(scriptWithRestoredFlag, {
      inCutsceneStage: true,
      typewriterMsPerChar: this.fastMode || reducedMotion ? 0 : 10,
      onLineStart: (lineIdx, line) => {
        if (!this.openState || token !== this.runToken) return;
        this.currentLineIndex = lineIdx;
        const combined = [
          ...(def.lineCues?.[lineIdx] ?? []),
          ...(line.stageCueId ? (def.stageCues?.[line.stageCueId] ?? []) : []),
        ];
        if (combined.length > 0) {
          this.choreo.applyCueActions(combined, this.actors, this.fastMode, () => this.openState);
          if (this.fastMode) this.choreo.snapAllInFlight(this.actors);
        }
        this.renderFrame();
      },
      onAdvanceInterrupt: () => {
        if (!this.openState || token !== this.runToken) return;
        this.choreo.snapAllInFlight(this.actors);
        this.renderFrame();
      },
    });

    if (token === this.runToken) this.closeInternal();
    return this.skippedEarly ? 'skipped' : reason;
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
    this.introResolve = null;
    this.choreo.clearPendingTimers();
    this.stopLoop();
    this.rootEl.hidden = true;
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
    while (rem > 0) {
      const dt = Math.min(16, rem);
      this.choreo.stepSimulation(dt, this.actors);
      rem -= dt;
    }
    this.renderFrame();
  }

  public getSnapshot(): CutsceneSceneSnapshot {
    return buildCutsceneSceneSnapshot({
      isOpen: this.openState,
      activeDef: this.activeDef,
      currentLineIndex: this.currentLineIndex,
      choreo: this.choreo,
      displayScale: this.displayScale,
      actors: this.actors,
    });
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
      this.choreo.stepSimulation(dt, this.actors);
      this.renderFrame();
      this.rafId = window.requestAnimationFrame(tick);
    };
    this.rafId = window.requestAnimationFrame(tick);
  }

  private stopLoop(): void {
    if (this.rafId !== null) {
      window.cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  private renderFrame(): void {
    if (!this.openState || !this.activeDef) return;
    renderCutsceneStageFrame({
      ctx: this.shell.ctx,
      nativeW: this.shell.canvas.width,
      nativeH: this.shell.canvas.height,
      viewHeightCss: this.viewHeightCss,
      def: this.activeDef,
      actors: this.actors,
      choreo: this.choreo,
      tilesetSheets: this.tilesetSheets,
      spriteBundles: this.spriteBundles,
      ambientMotes: this.ambientMotes,
    });
  }
}
