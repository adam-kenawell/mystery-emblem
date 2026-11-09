/**
 * Credits `#075` -> `#076` Audio Sequence & Pointer Hold Controller (`creditsAudioAndHold.ts`)
 */

import type { AudioManager } from '../../audio/AudioManager';

export class CreditsAudioSequenceController {
  private audioUnsub: (() => void) | null = null;
  private introFallbackTimer: number | null = null;
  private previousTrackId: string | null = null;

  constructor(private readonly audioManager: AudioManager) {}

  public captureAndStart(isOpen: () => boolean): void {
    this.previousTrackId = this.audioManager.getCurrentTrackId();
    this.cleanup();
    const introTrack = this.audioManager.playBgm('ending_theme_intro', {
      fadeMs: 260,
      restart: true,
      loop: false,
    });
    if (!introTrack) {
      this.audioManager.playBgm('ending_theme', { fadeMs: 260, loop: true });
      return;
    }

    let sawIntroPlaying = false;
    this.audioUnsub = this.audioManager.subscribe((snap) => {
      if (!isOpen()) return;
      if (snap.currentTrack?.id === introTrack.id && snap.isPlaying) {
        sawIntroPlaying = true;
      } else if (
        sawIntroPlaying &&
        snap.currentTrack?.id === introTrack.id &&
        !snap.isPlaying &&
        !snap.settings.muted
      ) {
        this.cleanup();
        this.audioManager.playBgm('ending_theme', { fadeMs: 140, loop: true });
      }
    });

    this.introFallbackTimer = window.setTimeout(() => {
      this.introFallbackTimer = null;
      if (isOpen() && this.audioManager.getCurrentTrackId() === introTrack.id) {
        this.cleanup();
        this.audioManager.playBgm('ending_theme', { fadeMs: 220, loop: true });
      }
    }, 44_000);
  }

  public cleanup(): void {
    if (this.audioUnsub) {
      this.audioUnsub();
      this.audioUnsub = null;
    }
    if (this.introFallbackTimer !== null) {
      window.clearTimeout(this.introFallbackTimer);
      this.introFallbackTimer = null;
    }
  }

  public restorePreviousTrack(): void {
    this.cleanup();
    if (this.previousTrackId) {
      this.audioManager.playBgm(this.previousTrackId, { fadeMs: 320 });
      this.previousTrackId = null;
    }
  }
}

export class CreditsPointerHoldController {
  public fastHolding = false;
  private activePointerId: number | null = null;

  public bind(scrollViewportEl: HTMLElement, isOpen: () => boolean, signal: AbortSignal): void {
    scrollViewportEl.addEventListener(
      'pointerdown',
      (e: PointerEvent) => {
        if (!isOpen()) return;
        const target = e.target as HTMLElement | null;
        if (target?.closest('button')) return;
        this.activePointerId = e.pointerId;
        this.fastHolding = true;
      },
      { signal }
    );
    const clearHold = (e: PointerEvent) => {
      if (this.activePointerId === null || e.pointerId === this.activePointerId) {
        this.activePointerId = null;
        this.fastHolding = false;
      }
    };
    window.addEventListener('pointerup', clearHold, { signal });
    window.addEventListener('pointercancel', clearHold, { signal });
  }

  public reset(): void {
    this.activePointerId = null;
    this.fastHolding = false;
  }
}
