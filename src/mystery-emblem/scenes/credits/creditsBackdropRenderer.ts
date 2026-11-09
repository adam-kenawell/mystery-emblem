/**
 * Mystery Emblem — Pixel-Art Starry Twilight & Dragon Aura Backdrop (`creditsBackdropRenderer.ts`)
 *
 * Crisp `1x` low-resolution pixel sky canvas (`imageSmoothingEnabled = false` + CSS pixelated)
 * with twinkling pixel stars, forest/mountain ridge silhouette, and rising golden embers.
 */

interface StarParticle {
  xFrac: number;
  yFrac: number;
  phase: number;
  size: 1 | 2;
  warm: boolean;
}

interface EmberParticle {
  xFrac: number;
  yFrac: number;
  speedY: number;
  driftX: number;
  phase: number;
}

const TWILIGHT_SKY_BANDS = [
  '#050916',
  '#081126',
  '#0d1b38',
  '#14274c',
  '#1d3560',
  '#283e6c',
  '#364672',
] as const;

export class CreditsBackdropRenderer {
  public readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly stars: StarParticle[] = [];
  private readonly embers: EmberParticle[] = [];

  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'pmd-credits-backdrop-canvas pmd-pixelated';
    this.canvas.dataset.testid = 'credits-backdrop-canvas';
    const ctx = this.canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Could not initialize 2D context for CreditsScene.');
    }
    ctx.imageSmoothingEnabled = false;
    this.ctx = ctx;

    for (let i = 0; i < 48; i++) {
      this.stars.push({
        xFrac: ((i * 67 + 13) % 100) / 100,
        yFrac: ((i * 37 + 7) % 78) / 100,
        phase: i * 0.71,
        size: i % 5 === 0 ? 2 : 1,
        warm: i % 4 === 0,
      });
    }
    for (let i = 0; i < 20; i++) {
      this.embers.push({
        xFrac: ((i * 53 + 29) % 100) / 100,
        yFrac: ((i * 43 + 17) % 100) / 100,
        speedY: 0.025 + (i % 4) * 0.008,
        driftX: ((i % 5) - 2) * 0.007,
        phase: i * 1.1,
      });
    }
  }

  public syncBufferSize(viewW: number, viewH: number): void {
    const pixelScale = viewW >= 960 ? 3 : 2;
    const bufW = Math.max(160, Math.ceil(viewW / pixelScale));
    const bufH = Math.max(120, Math.ceil(viewH / pixelScale));
    if (this.canvas.width !== bufW || this.canvas.height !== bufH) {
      this.canvas.width = bufW;
      this.canvas.height = bufH;
      this.ctx.imageSmoothingEnabled = false;
    }
  }

  public render(animClockMs: number): void {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;
    ctx.imageSmoothingEnabled = false;

    const bandH = Math.ceil(h / TWILIGHT_SKY_BANDS.length);
    for (let i = 0; i < TWILIGHT_SKY_BANDS.length; i++) {
      ctx.fillStyle = TWILIGHT_SKY_BANDS[i]!;
      ctx.fillRect(0, i * bandH, w, bandH + 1);
    }

    const sec = animClockMs / 1000;

    for (const s of this.stars) {
      const twinkle = Math.sin(sec * 2.1 + s.phase);
      if (twinkle < -0.35) continue;
      const sx = Math.floor(s.xFrac * w);
      const sy = Math.floor(s.yFrac * h);
      ctx.fillStyle =
        twinkle > 0.55
          ? s.warm
            ? '#fff0a8'
            : '#ffffff'
          : s.warm
            ? '#d8b878'
            : '#88b4e8';
      ctx.fillRect(sx, sy, s.size, s.size);
    }

    ctx.fillStyle = '#070f20';
    for (let x = 0; x < w; x += 4) {
      const ridge = Math.floor(Math.sin(x * 0.045) * 6 + Math.cos(x * 0.11) * 3) + 12;
      ctx.fillRect(x, h - ridge, 4, ridge);
    }

    for (const e of this.embers) {
      const ex = Math.floor(((((e.xFrac + sec * e.driftX) % 1) + 1) % 1) * w);
      const ey = Math.floor(((((e.yFrac - sec * e.speedY) % 1) + 1) % 1) * h);
      const glow = Math.sin(sec * 3 + e.phase);
      ctx.fillStyle = glow > 0 ? '#f8d868' : '#e89838';
      ctx.fillRect(ex, ey, 1, 1);
    }
  }
}
