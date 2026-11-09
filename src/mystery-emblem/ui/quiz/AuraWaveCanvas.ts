/**
 * Mystery Emblem — GBA/DS-Styled Bayer-Dithered Mystical Aura Wave Canvas Engine
 */

import { MYSTICAL_QUIZ_WAVE_PALETTE, type AuraWavePalette } from '../../data/quizData';

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

export class AuraWaveCanvas {
  public readonly canvasEl: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D | null;
  private readonly measureHostEl: HTMLElement;

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
  private active = false;

  constructor(measureHostEl: HTMLElement) {
    this.measureHostEl = measureHostEl;
    this.canvasEl = document.createElement('canvas');
    this.canvasEl.className = 'pmd-quiz-wave-canvas pmd-pixelated';
    this.canvasEl.dataset.testid = 'quiz-aura-wave-canvas';
    this.canvasEl.setAttribute('aria-hidden', 'true');
    this.ctx = this.canvasEl.getContext('2d', { alpha: false });
  }

  public reset(): void {
    this.waveTimeSec = 0;
    this.waveFrameCount = 0;
    this.setTargetPalette(MYSTICAL_QUIZ_WAVE_PALETTE, true, true);
  }

  public getTelemetry(): {
    waveFrameCount: number;
    waveTimeSec: number;
    colorTransitionProgress: number;
    currentBackdropOuterRgb: [number, number, number];
    targetBackdropOuterRgb: [number, number, number];
  } {
    return {
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
    };
  }

  public setTargetPalette(
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
    if (palettesEqual(this.targetPalette, nextTarget)) return;

    this.fromPalette = clonePalette(this.currentPalette);
    this.targetPalette = clonePalette(nextTarget);
    this.colorTransitionProgress = 0;
    this.colorTransitionElapsedMs = 0;
  }

  public startLoop(): void {
    this.active = true;
    if (this.waveRafId !== null) return;
    this.waveLastTickMs = null;
    const tick = (nowMs: number) => {
      if (!this.active) {
        this.waveRafId = null;
        this.waveLastTickMs = null;
        return;
      }
      const rawDt = this.waveLastTickMs === null ? 16.67 : nowMs - this.waveLastTickMs;
      this.waveLastTickMs = nowMs;
      this.renderFrame(Math.max(0, Math.min(80, rawDt)));
      this.waveRafId = window.requestAnimationFrame(tick);
    };
    this.waveRafId = window.requestAnimationFrame(tick);
  }

  public stopLoop(): void {
    this.active = false;
    if (this.waveRafId !== null) {
      window.cancelAnimationFrame(this.waveRafId);
      this.waveRafId = null;
    }
    this.waveLastTickMs = null;
  }

  public renderFrame(deltaMs: number): void {
    this.waveTimeSec += deltaMs * 0.001;
    this.waveFrameCount += 1;
    this.updateInterpolatedPalette(deltaMs);
    if (!this.ctx) return;

    const cssW = this.measureHostEl.clientWidth || window.innerWidth || 640;
    const cssH = this.measureHostEl.clientHeight || window.innerHeight || 360;
    const bufW = Math.max(96, Math.min(360, Math.round(cssW / 4)));
    const bufH = Math.max(96, Math.min(270, Math.round(cssH / 4)));

    this.ensureBuffers(bufW, bufH);
    const pixels = this.wavePixelU32;
    const imgData = this.waveImageData;
    if (!pixels || !imgData) return;

    const t = this.waveTimeSec;
    const halfH = bufH * 0.5;

    for (let x = 0; x < bufW; x++) {
      this.colCy[x] =
        halfH +
        bufH * (0.022 * Math.sin(x * 0.041 + t * 0.85) + 0.015 * Math.cos(x * 0.067 - t * 0.68));

      const h1Top = bufH * (0.2 + 0.19 * Math.abs(Math.sin(x * 0.056 - t * 0.92)) + 0.035 * Math.sin(x * 0.024 + t * 0.45));
      const h1Bot = bufH * (0.2 + 0.19 * Math.abs(Math.sin(x * 0.056 - t * 0.92 + 0.52)) + 0.035 * Math.cos(x * 0.024 - t * 0.41));
      const h2Top = bufH * (0.18 + 0.18 * Math.abs(Math.sin(x * 0.073 + t * 0.74 + 1.18)) + 0.03 * Math.cos(x * 0.031 - t * 0.54));
      const h2Bot = bufH * (0.18 + 0.18 * Math.abs(Math.sin(x * 0.073 + t * 0.74 + 1.76)) + 0.03 * Math.sin(x * 0.031 + t * 0.5));
      const h3Top = bufH * (0.13 + 0.13 * Math.abs(Math.sin(x * 0.091 - t * 0.58 + 2.4)));
      const h3Bot = bufH * (0.13 + 0.13 * Math.abs(Math.sin(x * 0.091 + t * 0.53 + 0.95)));

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
        const dist = dy < 0 ? -dy : dy;
        const inv1 = dy < 0 ? this.colInvH1Top[x]! : this.colInvH1Bot[x]!;
        const inv2 = dy < 0 ? this.colInvH2Top[x]! : this.colInvH2Bot[x]!;
        const inv3 = dy < 0 ? this.colInvH3Top[x]! : this.colInvH3Bot[x]!;

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
          const idx = Math.max(0, Math.min(PALETTE_STEPS, Math.round((combined + dither) * PALETTE_STEPS)));
          pixels[rowOffset + x] = lut[idx]!;
        }
      }
      rowOffset += bufW;
    }

    this.ctx.putImageData(imgData, 0, 0);
  }

  private ensureBuffers(bufW: number, bufH: number): void {
    if (this.waveImageData && this.canvasEl.width === bufW && this.canvasEl.height === bufH) {
      return;
    }
    this.canvasEl.width = bufW;
    this.canvasEl.height = bufH;
    if (this.ctx) {
      this.ctx.imageSmoothingEnabled = false;
      this.waveImageData = this.ctx.createImageData(bufW, bufH);
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
        this.currentPalette.outerRgb[i] = lerpChannel(this.fromPalette.outerRgb[i]!, this.targetPalette.outerRgb[i]!, e);
        this.currentPalette.midRgb[i] = lerpChannel(this.fromPalette.midRgb[i]!, this.targetPalette.midRgb[i]!, e);
        this.currentPalette.coreRgb[i] = lerpChannel(this.fromPalette.coreRgb[i]!, this.targetPalette.coreRgb[i]!, e);
      }
    }

    const shimmer = this.mysticalShimmerActive && this.colorTransitionProgress >= 1 ? Math.sin(this.waveTimeSec * 0.9) : 0;
    const outR = Math.max(0, Math.min(255, this.currentPalette.outerRgb[0] - shimmer * 12));
    const outG = Math.max(0, Math.min(255, this.currentPalette.outerRgb[1] + shimmer * 10));
    const outB = Math.max(0, Math.min(255, this.currentPalette.outerRgb[2] + shimmer * 14));
    const midR = Math.max(0, Math.min(255, this.currentPalette.midRgb[0] - shimmer * 10));
    const midG = Math.max(0, Math.min(255, this.currentPalette.midRgb[1] + shimmer * 12));
    const midB = Math.max(0, Math.min(255, this.currentPalette.midRgb[2] + shimmer * 8));
    const coreR = this.currentPalette.coreRgb[0];
    const coreG = this.currentPalette.coreRgb[1];
    const coreB = this.currentPalette.coreRgb[2];

    for (let s = 0; s <= PALETTE_STEPS; s++) {
      const level = s / PALETTE_STEPS;
      let r: number, g: number, b: number;
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
      const qr = Math.min(255, Math.round(r / 8) * 8);
      const qg = Math.min(255, Math.round(g / 8) * 8);
      const qb = Math.min(255, Math.round(b / 8) * 8);
      this.paletteLutU32[s] = (255 << 24) | (qb << 16) | (qg << 8) | qr;
    }
  }
}
