/**
 * Mystery Emblem — Lightweight PMD Audio Engine (`AudioManager`)
 *
 * Features:
 * - Streaming `HTMLAudioElement` BGM playback with smooth crossfade/fade-out transitions
 * - Browser autoplay-policy unlock via unified Pointer Events (`pointerdown` / `click` ONLY; zero keyboard listeners)
 * - Automatic background-tab / mobile lock-screen pause & resume (`visibilitychange`)
 * - Built-in PMD: Explorers of Sky UI chime synthesizer (`select`, `cancel`, `dialogue_advance`, `typewriter_blip`)
 *   plus external SFX file playback support
 * - Persistent volume & mute preferences (`localStorage`: `mystery_emblem_audio_v1`)
 */

import { PMD_BGM_TRACKS, resolveBgmTrack, type PmdBgmTrack } from './audioTracks';

export const AUDIO_SETTINGS_STORAGE_KEY = 'mystery_emblem_audio_v1';

export type PmdUiSfxId =
  | 'select'
  | 'cancel'
  | 'dialogue_advance'
  | 'typewriter_blip'
  | 'attack_hit'
  | 'critical_hit'
  | 'attack_miss'
  | 'unit_ko'
  | 'phase_change'
  | 'victory_fanfare'
  | 'game_over'
  | 'heal';

export interface AudioSettings {
  muted: boolean;
  bgmVolume: number;
  sfxVolume: number;
}

export interface PlayBgmOptions {
  fadeMs?: number;
  restart?: boolean;
  loop?: boolean;
}

export interface AudioSnapshot {
  settings: AudioSettings;
  currentTrack: PmdBgmTrack | null;
  isPlaying: boolean;
  /** True when a track was requested before the browser's first user gesture unlocked audio */
  awaitingUserUnlock: boolean;
  discoveredTrackCount: number;
}

type AudioListener = (snapshot: AudioSnapshot) => void;

function clamp01(val: number, fallback: number): number {
  if (!Number.isFinite(val)) return fallback;
  return Math.max(0, Math.min(1, Math.round(val * 100) / 100));
}

export class AudioManager {
  private settings: AudioSettings = {
    muted: false,
    bgmVolume: 0.65,
    sfxVolume: 0.7,
  };

  private currentTrack: PmdBgmTrack | null = null;
  private currentLoopOverride: boolean | undefined = undefined;
  private activeAudio: HTMLAudioElement | null = null;
  private activeFadeTimer: number | null = null;
  private readonly fadingOutElements = new Map<HTMLAudioElement, number>();

  private awaitingUserUnlock = false;
  private pausedByVisibility = false;
  private unlocked = false;

  private audioCtx: AudioContext | null = null;
  private lastBlipAt = 0;

  private readonly listeners = new Set<AudioListener>();
  private globalHooksBound = false;

  constructor() {
    this.loadSettings();
    this.bindGlobalBrowserHooks();
  }

  public getAvailableTracks(): ReadonlyArray<PmdBgmTrack> {
    return PMD_BGM_TRACKS;
  }

  public getSettings(): AudioSettings {
    return { ...this.settings };
  }

  public getCurrentTrackId(): string | null {
    return this.currentTrack?.id ?? null;
  }

  public getCurrentTrack(): PmdBgmTrack | null {
    return this.currentTrack;
  }

  public getSnapshot(): AudioSnapshot {
    const isPlaying = Boolean(
      this.activeAudio &&
        !this.activeAudio.paused &&
        !this.settings.muted &&
        this.currentTrack !== null
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
    return () => {
      this.listeners.delete(listener);
    };
  }

  public setMuted(muted: boolean): void {
    const next = Boolean(muted);
    if (this.settings.muted === next) return;
    this.settings.muted = next;
    this.saveSettings();

    if (this.activeAudio) {
      this.activeAudio.muted = next;
      if (!next && this.currentTrack && this.activeAudio.paused && !this.pausedByVisibility) {
        this.tryStartActiveAudio(0);
      } else {
        this.applyTargetVolumeImmediate();
      }
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
    const next = clamp01(volume, this.settings.bgmVolume);
    if (this.settings.bgmVolume === next) return;
    this.settings.bgmVolume = next;
    this.saveSettings();
    this.applyTargetVolumeImmediate();
    this.emit();
  }

  public setSfxVolume(volume: number): void {
    const next = clamp01(volume, this.settings.sfxVolume);
    if (this.settings.sfxVolume === next) return;
    this.settings.sfxVolume = next;
    this.saveSettings();
    this.emit();
  }

  public playBgm(trackIdOrAlias: string | null | undefined, opts?: PlayBgmOptions): PmdBgmTrack | null {
    if (!trackIdOrAlias) {
      this.stopBgm({ fadeMs: opts?.fadeMs ?? 280 });
      return null;
    }

    const track = resolveBgmTrack(trackIdOrAlias);
    if (!track) {
      return null;
    }

    const fadeMs = Math.max(0, opts?.fadeMs ?? 320);
    const shouldLoop = opts?.loop ?? track.loop;

    // Already playing or armed on the exact same track
    if (this.currentTrack?.id === track.id && this.activeAudio && !opts?.restart) {
      this.activeAudio.loop = shouldLoop;
      this.currentLoopOverride = opts?.loop;
      if (this.activeAudio.paused && !this.settings.muted && !this.pausedByVisibility) {
        this.tryStartActiveAudio(fadeMs);
      }
      this.emit();
      return track;
    }

    // Crossfade out any currently playing element
    if (this.activeAudio) {
      this.retireAudioElement(this.activeAudio, fadeMs);
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
      this.retireAudioElement(this.activeAudio, fadeMs);
      this.activeAudio = null;
    }
    this.emit();
  }

  /**
   * Plays a crisp PMD-styled UI sound effect via Web Audio API.
   */
  public playSfx(sfxId: PmdUiSfxId): void {
    if (this.settings.muted || this.settings.sfxVolume <= 0.01) return;
    if (typeof window === 'undefined') return;

    if (sfxId === 'typewriter_blip') {
      const nowMs = performance.now();
      if (nowMs - this.lastBlipAt < 58) return;
      this.lastBlipAt = nowMs;
    }

    const ctx = this.ensureAudioContext();
    if (!ctx || ctx.state !== 'running') return;

    const now = ctx.currentTime;
    const masterGain = this.settings.sfxVolume * 0.16;

    try {
      if (sfxId === 'select') {
        this.scheduleTone(ctx, 'triangle', 660, 660, now, 0.045, masterGain);
        this.scheduleTone(ctx, 'triangle', 990, 990, now + 0.042, 0.075, masterGain * 0.95);
      } else if (sfxId === 'cancel') {
        this.scheduleTone(ctx, 'triangle', 587, 520, now, 0.05, masterGain * 0.9);
        this.scheduleTone(ctx, 'triangle', 440, 392, now + 0.045, 0.075, masterGain * 0.85);
      } else if (sfxId === 'dialogue_advance') {
        this.scheduleTone(ctx, 'sine', 784, 1046, now, 0.055, masterGain * 0.72);
      } else if (sfxId === 'typewriter_blip') {
        this.scheduleTone(ctx, 'triangle', 540, 560, now, 0.022, masterGain * 0.32);
      } else if (sfxId === 'attack_hit') {
        this.scheduleTone(ctx, 'square', 220, 95, now, 0.085, masterGain * 1.15);
        this.scheduleTone(ctx, 'triangle', 420, 140, now, 0.06, masterGain * 0.9);
      } else if (sfxId === 'critical_hit') {
        this.scheduleTone(ctx, 'sawtooth', 880, 320, now, 0.075, masterGain * 1.1);
        this.scheduleTone(ctx, 'square', 1175, 180, now + 0.045, 0.11, masterGain * 1.25);
        this.scheduleTone(ctx, 'triangle', 523, 1046, now + 0.085, 0.12, masterGain * 0.95);
      } else if (sfxId === 'attack_miss') {
        this.scheduleTone(ctx, 'sine', 620, 290, now, 0.11, masterGain * 0.7);
      } else if (sfxId === 'unit_ko') {
        this.scheduleTone(ctx, 'triangle', 440, 330, now, 0.09, masterGain * 1.0);
        this.scheduleTone(ctx, 'triangle', 330, 220, now + 0.08, 0.11, masterGain * 0.95);
        this.scheduleTone(ctx, 'sawtooth', 220, 110, now + 0.17, 0.18, masterGain * 0.85);
      } else if (sfxId === 'phase_change') {
        this.scheduleTone(ctx, 'triangle', 523, 523, now, 0.06, masterGain * 0.85);
        this.scheduleTone(ctx, 'triangle', 659, 659, now + 0.055, 0.06, masterGain * 0.9);
        this.scheduleTone(ctx, 'triangle', 784, 784, now + 0.11, 0.11, masterGain * 0.95);
      } else if (sfxId === 'victory_fanfare') {
        this.scheduleTone(ctx, 'triangle', 523, 523, now, 0.09, masterGain);
        this.scheduleTone(ctx, 'triangle', 659, 659, now + 0.09, 0.09, masterGain);
        this.scheduleTone(ctx, 'triangle', 784, 784, now + 0.18, 0.09, masterGain);
        this.scheduleTone(ctx, 'triangle', 1046, 1046, now + 0.27, 0.28, masterGain * 1.15);
      } else if (sfxId === 'game_over') {
        this.scheduleTone(ctx, 'triangle', 392, 370, now, 0.14, masterGain * 0.95);
        this.scheduleTone(ctx, 'triangle', 349, 311, now + 0.14, 0.16, masterGain * 0.95);
        this.scheduleTone(ctx, 'sawtooth', 294, 196, now + 0.3, 0.32, masterGain * 0.85);
      } else if (sfxId === 'heal') {
        this.scheduleTone(ctx, 'sine', 523, 659, now, 0.08, masterGain * 0.9);
        this.scheduleTone(ctx, 'sine', 659, 880, now + 0.075, 0.09, masterGain * 0.95);
        this.scheduleTone(ctx, 'triangle', 880, 1046, now + 0.155, 0.16, masterGain * 1.0);
      }
    } catch {
      // Safely ignore Web Audio scheduling edge cases in restricted headless contexts
    }
  }

  /**
   * Plays an external SFX audio file URL (ready for ripped dungeon/combat SFX files).
   */
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
    if (!audio || !this.currentTrack) return;

    if (this.pausedByVisibility) {
      return;
    }

    const targetVol = this.getEffectiveBgmVolume();
    if (fadeMs <= 0 || targetVol <= 0) {
      audio.volume = targetVol;
    } else {
      audio.volume = 0;
    }

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
            // Browser blocked autoplay prior to first user pointer tap—stay armed!
            this.awaitingUserUnlock = true;
            this.emit();
          }
        });
    } else {
      this.fadeInActiveAudio(audio, fadeMs);
    }
  }

  private fadeInActiveAudio(audio: HTMLAudioElement, fadeMs: number): void {
    this.clearActiveFadeTimer();
    const target = this.getEffectiveBgmVolume();
    if (fadeMs <= 0 || target <= 0) {
      audio.volume = target;
      return;
    }

    const stepMs = 25;
    const steps = Math.max(1, Math.round(fadeMs / stepMs));
    let currentStep = 0;

    this.activeFadeTimer = window.setInterval(() => {
      if (this.activeAudio !== audio) {
        this.clearActiveFadeTimer();
        return;
      }
      currentStep++;
      const liveTarget = this.getEffectiveBgmVolume();
      const ratio = Math.min(1, currentStep / steps);
      audio.volume = Math.max(0, Math.min(1, liveTarget * ratio));
      if (ratio >= 1) {
        this.clearActiveFadeTimer();
      }
    }, stepMs);
  }

  private retireAudioElement(audio: HTMLAudioElement, fadeMs: number): void {
    const startVol = audio.volume;
    if (fadeMs <= 0 || audio.paused || startVol <= 0.01) {
      this.disposeAudioElement(audio);
      return;
    }

    const stepMs = 25;
    const steps = Math.max(1, Math.round(fadeMs / stepMs));
    let currentStep = 0;

    const timer = window.setInterval(() => {
      currentStep++;
      const ratio = Math.max(0, 1 - currentStep / steps);
      audio.volume = Math.max(0, Math.min(1, startVol * ratio));
      if (ratio <= 0.01) {
        this.disposeAudioElement(audio);
      }
    }, stepMs);

    this.fadingOutElements.set(audio, timer);
  }

  private disposeAudioElement(audio: HTMLAudioElement): void {
    const timer = this.fadingOutElements.get(audio);
    if (timer !== undefined) {
      window.clearInterval(timer);
      this.fadingOutElements.delete(audio);
    }
    try {
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
    } catch {
      // Ignore cleanup errors
    }
  }

  private clearActiveFadeTimer(): void {
    if (this.activeFadeTimer !== null && typeof window !== 'undefined') {
      window.clearInterval(this.activeFadeTimer);
      this.activeFadeTimer = null;
    }
  }

  private ensureAudioContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.audioCtx) {
      const Ctor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      try {
        this.audioCtx = new Ctor();
      } catch {
        return null;
      }
    }
    if (this.audioCtx.state === 'suspended') {
      void this.audioCtx.resume().catch(() => {});
    }
    return this.audioCtx;
  }

  private scheduleTone(
    ctx: AudioContext,
    type: OscillatorType,
    startFreq: number,
    endFreq: number,
    startTime: number,
    durationSec: number,
    peakGain: number
  ): void {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(startFreq, startTime);
    if (endFreq !== startFreq) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), startTime + durationSec);
    }

    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.linearRampToValueAtTime(peakGain, startTime + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + durationSec);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(startTime);
    osc.stop(startTime + durationSec + 0.01);
  }

  private bindGlobalBrowserHooks(): void {
    if (this.globalHooksBound || typeof window === 'undefined') return;
    this.globalHooksBound = true;

    // Rule 2: Unified Pointer Events ONLY (`pointerdown` + `click` — ZERO keyboard listeners!)
    const handleUnlockGesture = () => {
      const ctx = this.ensureAudioContext();
      if (ctx && ctx.state === 'suspended') {
        void ctx.resume().catch(() => {});
      }
      if (this.currentTrack && this.activeAudio && this.activeAudio.paused && !this.pausedByVisibility) {
        this.tryStartActiveAudio(220);
      } else {
        this.unlocked = true;
      }
    };

    window.addEventListener('pointerdown', handleUnlockGesture, { capture: true, passive: true });
    window.addEventListener('click', handleUnlockGesture, { capture: true, passive: true });

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        if (this.activeAudio && !this.activeAudio.paused) {
          this.pausedByVisibility = true;
          this.activeAudio.pause();
        }
      } else if (this.pausedByVisibility) {
        this.pausedByVisibility = false;
        if (this.activeAudio && this.currentTrack && !this.settings.muted) {
          const loopVal = this.currentLoopOverride ?? this.currentTrack.loop;
          this.activeAudio.loop = loopVal;
          this.tryStartActiveAudio(200);
        }
      }
    });
  }

  private loadSettings(): void {
    if (typeof window === 'undefined') return;
    try {
      const raw = window.localStorage.getItem(AUDIO_SETTINGS_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<AudioSettings>;
      if (typeof parsed.muted === 'boolean') {
        this.settings.muted = parsed.muted;
      }
      if (typeof parsed.bgmVolume === 'number') {
        this.settings.bgmVolume = clamp01(parsed.bgmVolume, 0.65);
      }
      if (typeof parsed.sfxVolume === 'number') {
        this.settings.sfxVolume = clamp01(parsed.sfxVolume, 0.7);
      }
    } catch {
      // Ignore corrupt or unavailable localStorage
    }
  }

  private saveSettings(): void {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(AUDIO_SETTINGS_STORAGE_KEY, JSON.stringify(this.settings));
    } catch {
      // Ignore storage quota errors
    }
  }

  private emit(): void {
    const snap = this.getSnapshot();
    for (const listener of this.listeners) {
      listener(snap);
    }
  }
}

let sharedAudioManager: AudioManager | null = null;

export function getAudioManager(): AudioManager {
  if (!sharedAudioManager) {
    sharedAudioManager = new AudioManager();
  }
  return sharedAudioManager;
}
