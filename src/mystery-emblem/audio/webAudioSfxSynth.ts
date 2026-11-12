/**
 * Mystery Emblem - WebAudio PMD UI & Combat SFX Synthesizer
 *
 * Synthesizes Explorers-of-Sky-styled crisp triangle/sine/square/sawtooth UI & combat
 * chimes through a 3x compressor-boosted WebAudio chain.
 */

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

export class WebAudioSfxSynthesizer {
  private audioCtx: AudioContext | null = null;
  private sfxCompressor: DynamicsCompressorNode | null = null;
  private lastBlipAt = 0;

  public resumeOnUserGesture(): void {
    const ctx = this.ensureAudioContext();
    if (ctx && ctx.state === 'suspended') {
      void ctx.resume().catch(() => {});
    }
  }

  public playSfx(sfxId: PmdUiSfxId, sfxVolume: number, muted: boolean): void {
    if (muted || sfxVolume <= 0.01) return;
    if (typeof window === 'undefined') return;

    if (sfxId === 'typewriter_blip') {
      const nowMs = performance.now();
      if (nowMs - this.lastBlipAt < 58) return;
      this.lastBlipAt = nowMs;
    }

    const ctx = this.ensureAudioContext();
    if (!ctx || ctx.state !== 'running') return;

    const now = ctx.currentTime;
    const masterGain = sfxVolume * 0.48;

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
        this.scheduleTone(ctx, 'triangle', 540, 560, now, 0.022, masterGain * 0.24);
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

  private ensureAudioContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.audioCtx) {
      const Ctor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      try {
        this.audioCtx = new Ctor();
        if (typeof this.audioCtx.createDynamicsCompressor === 'function') {
          const comp = this.audioCtx.createDynamicsCompressor();
          comp.threshold.setValueAtTime(-6, this.audioCtx.currentTime);
          comp.knee.setValueAtTime(8, this.audioCtx.currentTime);
          comp.ratio.setValueAtTime(6, this.audioCtx.currentTime);
          comp.attack.setValueAtTime(0.002, this.audioCtx.currentTime);
          comp.release.setValueAtTime(0.08, this.audioCtx.currentTime);
          comp.connect(this.audioCtx.destination);
          this.sfxCompressor = comp;
        }
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
    const safePeak = Math.max(0.0002, Math.min(0.92, peakGain));
    osc.type = type;
    osc.frequency.setValueAtTime(startFreq, startTime);
    if (endFreq !== startFreq) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), startTime + durationSec);
    }

    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.linearRampToValueAtTime(safePeak, startTime + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + durationSec);

    osc.connect(gain);
    gain.connect(this.sfxCompressor ?? ctx.destination);
    osc.start(startTime);
    osc.stop(startTime + durationSec + 0.01);
  }
}
