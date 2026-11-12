/**
 * Mystery Emblem - Lightweight PMD Audio Engine (`AudioManager`)
 *
 * Strictly obeys Rule 2 (`pointerdown` / `click` unlock ONLY; zero keyboard listeners).
 */

import {
  AUDIO_SETTINGS_STORAGE_KEY,
  DEFAULT_BGM_VOLUME,
  DEFAULT_SFX_VOLUME,
  bindAudioBrowserHooks,
  clampAudio01,
  loadPersistedAudioSettings,
  retireFadingAudioElement,
  savePersistedAudioSettings,
  startAudioFadeInTimer,
  type AudioSettings,
} from './audioFadeAndSettings';
import { PMD_BGM_TRACKS, resolveBgmTrack, type PmdBgmTrack } from './audioTracks';
import { WebAudioSfxSynthesizer, type PmdUiSfxId } from './webAudioSfxSynth';

export { AUDIO_SETTINGS_STORAGE_KEY, DEFAULT_BGM_VOLUME, DEFAULT_SFX_VOLUME };
export type { AudioSettings, PmdUiSfxId };

export interface PlayBgmOptions {
  fadeMs?: number;
  restart?: boolean;
  loop?: boolean;
}

export interface AudioSnapshot {
  settings: AudioSettings;
  currentTrack: PmdBgmTrack | null;
  isPlaying: boolean;
  awaitingUserUnlock: boolean;
  discoveredTrackCount: number;
}

type AudioListener = (snapshot: AudioSnapshot) => void;

export class AudioManager {
  private settings: AudioSettings;
  private currentTrack: PmdBgmTrack | null = null;
  private currentLoopOverride: boolean | undefined = undefined;
  private activeAudio: HTMLAudioElement | null = null;
  private activeFadeTimer: number | null = null;
  private readonly fadingOutElements = new Map<HTMLAudioElement, number>();

  private awaitingUserUnlock = false;
  private pausedByVisibility = false;
  private unlocked = false;

  private readonly sfxSynth = new WebAudioSfxSynthesizer();
  private readonly listeners = new Set<AudioListener>();
  private globalHooksBound = false;

  constructor() {
    this.settings = loadPersistedAudioSettings();
    if (!this.globalHooksBound) {
      this.globalHooksBound = true;
      bindAudioBrowserHooks({
        onUserGesture: () => {
          this.sfxSynth.resumeOnUserGesture();
          if (this.currentTrack && this.activeAudio && this.activeAudio.paused && !this.pausedByVisibility) {
            this.tryStartActiveAudio(220);
          } else this.unlocked = true;
        },
        onVisibilityHidden: () => {
          if (this.activeAudio && !this.activeAudio.paused) {
            this.pausedByVisibility = true;
            this.activeAudio.pause();
          }
        },
        onVisibilityShown: () => {
          if (!this.pausedByVisibility) return;
          this.pausedByVisibility = false;
          if (this.activeAudio && this.currentTrack && !this.settings.muted) {
            this.activeAudio.loop = this.currentLoopOverride ?? this.currentTrack.loop;
            this.tryStartActiveAudio(200);
          }
        },
      });
    }
  }

  public getAvailableTracks(): ReadonlyArray<PmdBgmTrack> { return PMD_BGM_TRACKS; }
  public getSettings(): AudioSettings { return { ...this.settings }; }
  public getCurrentTrackId(): string | null { return this.currentTrack?.id ?? null; }
  public getCurrentTrack(): PmdBgmTrack | null { return this.currentTrack; }

  public getSnapshot(): AudioSnapshot {
    const isPlaying = Boolean(
      this.activeAudio && !this.activeAudio.paused && !this.settings.muted && this.currentTrack !== null
    );
    return {
      settings: { ...this.settings },
      currentTrack: this.currentTrack,
      isPlaying,
      awaitingUserUnlock: this.awaitingUserUnlock && !this.settings.muted,
      discoveredTrackCount: PMD_BGM_TRACKS.length,
    };
  }

  public subscribe(listener: AudioListener): () => void {
    this.listeners.add(listener);
    listener(this.getSnapshot());
    return () => { this.listeners.delete(listener); };
  }

  public setMuted(muted: boolean): void {
    const next = Boolean(muted);
    if (this.settings.muted === next) return;
    this.settings.muted = next;
    savePersistedAudioSettings(this.settings);

    if (this.activeAudio) {
      this.activeAudio.muted = next;
      if (!next && this.currentTrack && this.activeAudio.paused && !this.pausedByVisibility) {
        this.tryStartActiveAudio(0);
      } else this.applyTargetVolumeImmediate();
    } else if (!next && this.currentTrack) {
      this.playBgm(this.currentTrack.id, { fadeMs: 220 });
      return;
    }
    this.emit();
  }

  public toggleMute(): boolean {
    this.setMuted(!this.settings.muted);
    return this.settings.muted;
  }

  public setBgmVolume(volume: number): void {
    const next = clampAudio01(volume, this.settings.bgmVolume);
    if (this.settings.bgmVolume === next) return;
    this.settings.bgmVolume = next;
    savePersistedAudioSettings(this.settings);
    this.applyTargetVolumeImmediate();
    this.emit();
  }

  public setSfxVolume(volume: number): void {
    const next = clampAudio01(volume, this.settings.sfxVolume);
    if (this.settings.sfxVolume === next) return;
    this.settings.sfxVolume = next;
    savePersistedAudioSettings(this.settings);
    this.emit();
  }

  public playBgm(trackIdOrAlias: string | null | undefined, opts?: PlayBgmOptions): PmdBgmTrack | null {
    if (!trackIdOrAlias) {
      this.stopBgm({ fadeMs: opts?.fadeMs ?? 280 });
      return null;
    }
    const track = resolveBgmTrack(trackIdOrAlias);
    if (!track) return null;

    const fadeMs = Math.max(0, opts?.fadeMs ?? 320);
    const shouldLoop = opts?.loop ?? track.loop;

    if (this.currentTrack?.id === track.id && this.activeAudio && !opts?.restart) {
      this.activeAudio.loop = shouldLoop;
      this.currentLoopOverride = opts?.loop;
      if (this.activeAudio.paused && !this.settings.muted && !this.pausedByVisibility) {
        this.tryStartActiveAudio(fadeMs);
      }
      this.emit();
      return track;
    }

    if (this.activeAudio) {
      retireFadingAudioElement(this.activeAudio, fadeMs, this.fadingOutElements);
      this.activeAudio = null;
    }
    this.clearActiveFadeTimer();
    this.currentTrack = track;
    this.currentLoopOverride = opts?.loop;

    if (typeof window === 'undefined' || typeof Audio === 'undefined') {
      this.emit();
      return track;
    }

    const audio = new Audio(track.url);
    audio.preload = 'auto';
    audio.loop = shouldLoop;
    audio.muted = this.settings.muted;
    audio.volume = fadeMs > 0 ? 0 : this.getEffectiveBgmVolume();
    audio.addEventListener('play', () => this.emit());
    audio.addEventListener('pause', () => this.emit());
    audio.addEventListener('ended', () => this.emit());

    this.activeAudio = audio;
    this.tryStartActiveAudio(fadeMs);
    this.emit();
    return track;
  }

  public stopBgm(opts?: { fadeMs?: number }): void {
    const fadeMs = Math.max(0, opts?.fadeMs ?? 280);
    this.clearActiveFadeTimer();
    this.currentTrack = null;
    this.currentLoopOverride = undefined;
    this.awaitingUserUnlock = false;
    if (this.activeAudio) {
      retireFadingAudioElement(this.activeAudio, fadeMs, this.fadingOutElements);
      this.activeAudio = null;
    }
    this.emit();
  }

  public playSfx(sfxId: PmdUiSfxId): void {
    this.sfxSynth.playSfx(sfxId, this.settings.sfxVolume, this.settings.muted);
  }

  public playSfxUrl(url: string, volumeScale = 1): void {
    if (this.settings.muted || this.settings.sfxVolume <= 0.01) return;
    if (typeof window === 'undefined' || typeof Audio === 'undefined') return;
    try {
      const sfx = new Audio(url);
      sfx.volume = Math.max(0, Math.min(1, this.settings.sfxVolume * volumeScale));
      void sfx.play().catch(() => {});
    } catch {
      // Ignore unavailable audio device
    }
  }

  private getEffectiveBgmVolume(): number {
    return this.settings.muted ? 0 : this.settings.bgmVolume;
  }

  private applyTargetVolumeImmediate(): void {
    this.clearActiveFadeTimer();
    if (this.activeAudio) {
      this.activeAudio.muted = this.settings.muted;
      this.activeAudio.volume = this.getEffectiveBgmVolume();
    }
  }

  private tryStartActiveAudio(fadeMs: number): void {
    const audio = this.activeAudio;
    if (!audio || !this.currentTrack || this.pausedByVisibility) return;
    const targetVol = this.getEffectiveBgmVolume();
    audio.volume = fadeMs <= 0 || targetVol <= 0 ? targetVol : 0;

    const playPromise = audio.play();
    if (playPromise && typeof playPromise.then === 'function') {
      playPromise
        .then(() => {
          if (this.activeAudio !== audio) return;
          this.unlocked = true;
          this.awaitingUserUnlock = false;
          this.fadeInActiveAudio(audio, fadeMs);
          this.emit();
        })
        .catch((err: unknown) => {
          if (this.activeAudio !== audio) return;
          const errName = err instanceof DOMException ? err.name : '';
          if (errName === 'NotAllowedError' || !this.unlocked) {
            this.awaitingUserUnlock = true;
            this.emit();
          }
        });
    } else this.fadeInActiveAudio(audio, fadeMs);
  }

  private fadeInActiveAudio(audio: HTMLAudioElement, fadeMs: number): void {
    this.clearActiveFadeTimer();
    this.activeFadeTimer = startAudioFadeInTimer({
      audio, fadeMs,
      getEffectiveTargetVolume: () => this.getEffectiveBgmVolume(),
      isStillActive: () => this.activeAudio === audio,
      onComplete: () => this.clearActiveFadeTimer(),
    });
  }

  private clearActiveFadeTimer(): void {
    if (this.activeFadeTimer !== null && typeof window !== 'undefined') {
      window.clearInterval(this.activeFadeTimer);
      this.activeFadeTimer = null;
    }
  }

  private emit(): void {
    const snap = this.getSnapshot();
    for (const listener of this.listeners) listener(snap);
  }
}

let sharedAudioManager: AudioManager | null = null;
export function getAudioManager(): AudioManager {
  if (!sharedAudioManager) sharedAudioManager = new AudioManager();
  return sharedAudioManager;
}
