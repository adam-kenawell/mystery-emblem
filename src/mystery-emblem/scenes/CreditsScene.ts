/**
 * Mystery Emblem — Ending Credits Scroll Coordinator (`CreditsScene.ts`)
 */

import { getAudioManager, type AudioManager } from '../audio/AudioManager';
import type { SaveStateManager } from '../state/SaveStateManager';
import type { PmdSpriteActor } from '../ui/PmdSpriteCanvas';
import { createPmdButton } from '../ui/PmdWindow';
import {
  CreditsAudioSequenceController,
  CreditsPointerHoldController,
} from './credits/creditsAudioAndHold';
import { CreditsBackdropRenderer } from './credits/creditsBackdropRenderer';
import { buildCreditsScrollDom } from './credits/creditsDomBuilder';

export type CreditsFinishReason = 'completed' | 'skipped' | 'cancelled';

export interface CreditsSceneOptions {
  viewportEl: HTMLElement;
  saveManager: SaveStateManager;
  audioManager?: AudioManager;
  onStateChange?: () => void;
}

export interface CreditsSceneSnapshot {
  isOpen: boolean;
  scrollY: number;
  maxScrollY: number;
  reachedEnd: boolean;
  fastScrolling: boolean;
  castCardCount: number;
  bgmTrackId: string | null;
}

const BASE_SCROLL_PX_PER_SEC = 46;
const FAST_SCROLL_MULTIPLIER = 3.8;

export class CreditsScene {
  public readonly rootEl: HTMLElement;
  private readonly backdropRenderer = new CreditsBackdropRenderer();
  private readonly scrollViewportEl: HTMLElement;
  private readonly scrollTrackEl: HTMLElement;
  private readonly holdHintEl: HTMLElement;
  private readonly audioSeq: CreditsAudioSequenceController;
  private readonly holdCtrl = new CreditsPointerHoldController();

  private readonly viewportEl: HTMLElement;
  private readonly saveManager: SaveStateManager;
  private readonly audioManager: AudioManager;
  private readonly onStateChange?: () => void;

  private activeSpriteActors: PmdSpriteActor[] = [];
  private openState = false;
  private fastMode = false;
  private scrollY = 0;
  private maxScrollY = 0;
  private reachedEnd = false;
  private animClockMs = 0;
  private lastRafMs = 0;
  private rafId: number | null = null;
  private finishResolver: ((reason: CreditsFinishReason) => void) | null = null;
  private readonly abortController = new AbortController();

  constructor(options: CreditsSceneOptions) {
    this.viewportEl = options.viewportEl;
    this.saveManager = options.saveManager;
    this.audioManager = options.audioManager ?? getAudioManager();
    this.onStateChange = options.onStateChange;
    this.audioSeq = new CreditsAudioSequenceController(this.audioManager);

    this.rootEl = document.createElement('section');
    this.rootEl.id = 'pmd-credits-scene';
    this.rootEl.className = 'pmd-credits-scene';
    this.rootEl.dataset.testid = 'credits-scene';
    this.rootEl.dataset.noLongpress = 'true';
    this.rootEl.hidden = true;

    this.scrollViewportEl = document.createElement('div');
    this.scrollViewportEl.className = 'pmd-credits-scroll-viewport';
    this.scrollViewportEl.dataset.testid = 'credits-scroll-viewport';

    this.scrollTrackEl = document.createElement('div');
    this.scrollTrackEl.className = 'pmd-credits-scroll-track';
    this.scrollTrackEl.dataset.testid = 'credits-scroll-track';
    this.scrollViewportEl.appendChild(this.scrollTrackEl);

    const topControls = document.createElement('div');
    topControls.className = 'pmd-credits-top-bar';
    this.holdHintEl = document.createElement('div');
    this.holdHintEl.className = 'pmd-credits-hold-hint';
    this.holdHintEl.textContent = 'Hold screen to fast-scroll';

    const skipBtn = createPmdButton({
      label: 'Skip ▶▶',
      variant: 'primary',
      className: 'pmd-credits-skip-btn',
      testId: 'credits-skip-btn',
      ariaLabel: 'Skip ending credits',
      onTap: () => {
        this.audioManager.playSfx('cancel');
        this.finish('skipped');
      },
      tapOptions: { signal: this.abortController.signal, stopPropagation: true },
    });

    topControls.append(this.holdHintEl, skipBtn);
    this.rootEl.append(this.backdropRenderer.canvas, this.scrollViewportEl, topControls);
    this.viewportEl.appendChild(this.rootEl);

    const sig = this.abortController.signal;
    this.holdCtrl.bind(this.scrollViewportEl, () => this.openState, sig);
    window.addEventListener(
      'resize',
      () => {
        if (this.openState) {
          this.syncLayoutMetrics();
          this.backdropRenderer.render(this.animClockMs);
        }
      },
      { signal: sig }
    );
  }

  public isOpen(): boolean {
    return this.openState;
  }

  public setFastMode(enabled: boolean): void {
    this.fastMode = Boolean(enabled);
  }

  public handleBack(): void {
    if (this.openState) this.finish('skipped');
  }

  public getSnapshot(): CreditsSceneSnapshot {
    return {
      isOpen: this.openState,
      scrollY: Math.round(this.scrollY),
      maxScrollY: Math.round(this.maxScrollY),
      reachedEnd: this.reachedEnd,
      fastScrolling: this.holdCtrl.fastHolding,
      castCardCount: this.activeSpriteActors.length,
      bgmTrackId: this.audioManager.getCurrentTrackId(),
    };
  }

  public advanceScrollForTest(deltaMs: number): void {
    if (!this.openState) return;
    this.stepSimulation(Math.max(0, deltaMs));
    this.backdropRenderer.render(this.animClockMs);
  }

  public scrollToEndForTest(): void {
    if (!this.openState) return;
    this.syncLayoutMetrics();
    this.scrollY = this.maxScrollY;
    this.reachedEnd = true;
    this.holdHintEl.hidden = true;
    this.applyScrollTransform();
    this.backdropRenderer.render(this.animClockMs);
  }

  public play(): Promise<CreditsFinishReason> {
    if (this.openState) this.finish('cancelled');

    this.openState = true;
    this.holdCtrl.reset();
    this.scrollY = 0;
    this.reachedEnd = false;
    this.animClockMs = 0;
    this.holdHintEl.hidden = false;

    this.destroyCastActors();
    this.activeSpriteActors = buildCreditsScrollDom({
      scrollTrackEl: this.scrollTrackEl,
      save: this.saveManager.getSave(),
      onFinishTap: () => {
        this.audioManager.playSfx('select');
        this.finish('completed');
      },
    });

    this.rootEl.hidden = false;
    this.viewportEl.classList.add('is-battle-active');
    this.onStateChange?.();

    this.syncLayoutMetrics();
    this.applyScrollTransform();
    this.backdropRenderer.render(this.animClockMs);
    this.audioSeq.captureAndStart(() => this.openState);
    this.startLoop();

    return new Promise<CreditsFinishReason>((resolve) => {
      this.finishResolver = resolve;
    });
  }

  private syncLayoutMetrics(): void {
    const viewW = Math.max(320, this.viewportEl.clientWidth || window.innerWidth || 960);
    const viewH = Math.max(240, this.viewportEl.clientHeight || window.innerHeight || 540);
    this.backdropRenderer.syncBufferSize(viewW, viewH);
    this.maxScrollY = Math.max(0, this.scrollTrackEl.scrollHeight - viewH);
    if (this.scrollY > this.maxScrollY) this.scrollY = this.maxScrollY;
  }

  private applyScrollTransform(): void {
    this.scrollTrackEl.style.transform = `translate3d(0, ${-Math.round(this.scrollY)}px, 0)`;
  }

  private startLoop(): void {
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
    this.lastRafMs = performance.now();
    const tick = (now: number) => {
      if (!this.openState) {
        this.rafId = null;
        return;
      }
      const dt = Math.min(80, Math.max(0, now - this.lastRafMs));
      this.lastRafMs = now;
      this.stepSimulation(dt);
      this.backdropRenderer.render(this.animClockMs);
      this.rafId = requestAnimationFrame(tick);
    };
    this.rafId = requestAnimationFrame(tick);
  }

  private stepSimulation(dtMs: number): void {
    this.animClockMs += dtMs;
    this.syncLayoutMetrics();
    if (!this.reachedEnd && this.maxScrollY > 0) {
      const mult = this.holdCtrl.fastHolding ? FAST_SCROLL_MULTIPLIER : this.fastMode ? 2.2 : 1;
      this.scrollY = Math.min(this.maxScrollY, this.scrollY + (BASE_SCROLL_PX_PER_SEC * mult * dtMs) / 1000);
      if (this.scrollY >= this.maxScrollY - 0.5) {
        this.scrollY = this.maxScrollY;
        this.reachedEnd = true;
        this.holdHintEl.hidden = true;
      }
      this.applyScrollTransform();
    }
  }

  private destroyCastActors(): void {
    for (const actor of this.activeSpriteActors) actor.destroy();
    this.activeSpriteActors = [];
  }

  private finish(reason: CreditsFinishReason): void {
    if (!this.openState) return;
    this.openState = false;
    this.holdCtrl.reset();
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.destroyCastActors();
    this.rootEl.hidden = true;
    this.audioSeq.restorePreviousTrack();
    this.onStateChange?.();
    if (this.finishResolver) {
      const resolve = this.finishResolver;
      this.finishResolver = null;
      resolve(reason);
    }
  }

  public destroy(): void {
    this.finish('cancelled');
    this.abortController.abort();
    this.rootEl.remove();
  }
}
