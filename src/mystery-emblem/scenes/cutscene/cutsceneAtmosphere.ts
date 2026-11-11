/**
 * Cutscene Lighting Moods, Weather & Screen Fades (`cutsceneAtmosphere.ts`)
 */

import { PMD_TILE_NATIVE_PX } from '../../assets/tilesetLoader';
import type { LightingMood, WeatherKind } from '../../data/cutscenes/cutsceneDocTypes';
import type {
  AmbientMote,
  LightingState,
  RuntimeCutsceneProp,
  ScreenFadeState,
  ScreenFlashState,
} from './cutsceneTypes';

export const LIGHTING_MOOD_LABELS: Readonly<Record<LightingMood, string>> = {
  clear: 'Clear (no tint)',
  morning_coast: 'Morning coast',
  sanctuary_glow: 'Sanctuary glow',
  campfire_dusk: 'Campfire dusk',
  mountain_mist: 'Mountain mist',
  shrine_courtyard: 'Shrine courtyard',
  twilight_festival: 'Twilight festival',
  sunset: 'Sunset',
  night: 'Night',
  flashback: 'Flashback (sepia)',
  underwater: 'Underwater',
};

export const WEATHER_LABELS: Readonly<Record<WeatherKind, string>> = {
  none: 'None',
  rain: 'Rain',
  snow: 'Snow',
  fog: 'Fog',
  leaves: 'Falling leaves',
  embers: 'Drifting embers',
};

function fillGradient(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  stops: ReadonlyArray<[number, string]>,
  diagonal = false
): void {
  const grad = ctx.createLinearGradient(0, 0, diagonal ? w * 0.7 : 0, h);
  for (const [at, color] of stops) grad.addColorStop(at, color);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
}

function drawMoodOverlay(
  ctx: CanvasRenderingContext2D,
  mood: LightingMood,
  w: number,
  h: number,
  camX: number,
  camY: number,
  props: ReadonlyArray<RuntimeCutsceneProp>,
  animClockMs: number
): void {
  switch (mood) {
    case 'clear':
      break;
    case 'morning_coast':
      fillGradient(ctx, w, h, [[0, 'rgba(255, 232, 164, 0.16)'], [0.55, 'rgba(255, 210, 128, 0.04)'], [1, 'rgba(24, 64, 112, 0.12)']], true);
      break;
    case 'sanctuary_glow': {
      const grad = ctx.createRadialGradient(w * 0.5, h * 0.25, 12, w * 0.5, h * 0.45, w * 0.7);
      grad.addColorStop(0, 'rgba(168, 255, 224, 0.16)');
      grad.addColorStop(0.6, 'rgba(56, 168, 144, 0.05)');
      grad.addColorStop(1, 'rgba(8, 24, 36, 0.22)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
      break;
    }
    case 'campfire_dusk':
    case 'night': {
      ctx.fillStyle = mood === 'night' ? 'rgba(8, 14, 44, 0.52)' : 'rgba(14, 20, 48, 0.34)';
      ctx.fillRect(0, 0, w, h);
      for (const fire of props) {
        if (fire.kind !== 'campfire' || !fire.visible) continue;
        const fx = (fire.x + 0.5) * PMD_TILE_NATIVE_PX - camX;
        const fy = (fire.y + 0.5) * PMD_TILE_NATIVE_PX - camY;
        const grad = ctx.createRadialGradient(fx, fy, 8, fx, fy, 92);
        grad.addColorStop(0, 'rgba(255, 196, 96, 0.24)');
        grad.addColorStop(0.55, 'rgba(255, 128, 48, 0.08)');
        grad.addColorStop(1, 'rgba(10, 14, 34, 0)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, w, h);
        if (mood === 'campfire_dusk') break;
      }
      break;
    }
    case 'mountain_mist':
      fillGradient(ctx, w, h, [[0, 'rgba(188, 208, 255, 0.16)'], [0.6, 'rgba(96, 72, 152, 0.08)'], [1, 'rgba(12, 16, 34, 0.24)']]);
      break;
    case 'shrine_courtyard':
      fillGradient(ctx, w, h, [[0, 'rgba(144, 228, 255, 0.12)'], [1, 'rgba(12, 32, 56, 0.16)']]);
      break;
    case 'twilight_festival':
      fillGradient(ctx, w, h, [[0, 'rgba(88, 64, 148, 0.22)'], [0.5, 'rgba(224, 132, 76, 0.10)'], [1, 'rgba(14, 22, 44, 0.24)']]);
      break;
    case 'sunset':
      fillGradient(ctx, w, h, [[0, 'rgba(255, 120, 72, 0.26)'], [0.55, 'rgba(255, 168, 96, 0.14)'], [1, 'rgba(72, 32, 88, 0.26)']]);
      break;
    case 'flashback':
      fillGradient(ctx, w, h, [[0, 'rgba(255, 236, 196, 0.12)'], [1, 'rgba(96, 64, 32, 0.18)']]);
      break;
    case 'underwater': {
      fillGradient(ctx, w, h, [[0, 'rgba(64, 200, 232, 0.22)'], [1, 'rgba(8, 40, 96, 0.38)']]);
      const t = animClockMs / 1000;
      ctx.fillStyle = 'rgba(200, 248, 255, 0.07)';
      for (let i = 0; i < 4; i++) {
        const bandX = ((i * 0.31 + t * 0.04) % 1) * w * 1.4 - w * 0.2;
        ctx.beginPath();
        ctx.moveTo(bandX, 0);
        ctx.lineTo(bandX + 18, 0);
        ctx.lineTo(bandX - 30, h);
        ctx.lineTo(bandX - 52, h);
        ctx.closePath();
        ctx.fill();
      }
      break;
    }
  }
}

function moteColorFor(mood: LightingMood): string | null {
  switch (mood) {
    case 'clear':
    case 'night':
      return null;
    case 'campfire_dusk':
    case 'twilight_festival':
    case 'sunset':
      return 'rgba(255, 224, 120, 0.65)';
    case 'mountain_mist':
      return 'rgba(208, 192, 255, 0.50)';
    case 'underwater':
      return 'rgba(220, 250, 255, 0.55)';
    case 'flashback':
      return 'rgba(255, 240, 210, 0.45)';
    default:
      return 'rgba(232, 255, 224, 0.52)';
  }
}

export function drawLightingAndMotes(
  ctx: CanvasRenderingContext2D,
  lighting: LightingState,
  w: number,
  h: number,
  camX: number,
  camY: number,
  props: ReadonlyArray<RuntimeCutsceneProp>,
  animClockMs: number,
  motes: ReadonlyArray<AmbientMote>
): void {
  const t = lighting.durationMs > 0 ? Math.min(1, lighting.elapsedMs / lighting.durationMs) : 1;
  ctx.save();
  if (lighting.previous && t < 1) {
    ctx.globalAlpha = 1 - t;
    drawMoodOverlay(ctx, lighting.previous, w, h, camX, camY, props, animClockMs);
  }
  ctx.globalAlpha = lighting.previous && t < 1 ? t : 1;
  drawMoodOverlay(ctx, lighting.mood, w, h, camX, camY, props, animClockMs);

  const moteColor = moteColorFor(lighting.mood);
  if (moteColor) {
    ctx.fillStyle = moteColor;
    const sec = animClockMs / 1000;
    for (const m of motes) {
      const mx = Math.floor(((((m.seedX + sec * m.speedX) % 1) + 1) % 1) * w);
      const my = Math.floor(((((m.seedY + sec * m.speedY) % 1) + 1) % 1) * h);
      if (Math.sin(sec * 2.4 + m.phase) > -0.2) ctx.fillRect(mx, my, m.size, m.size);
    }
  }
  ctx.restore();
}

/** CSS filter for the stage canvas (only the flashback mood uses one). */
export function lightingCssFilter(lighting: LightingState): string {
  const t = lighting.durationMs > 0 ? Math.min(1, lighting.elapsedMs / lighting.durationMs) : 1;
  const amountOf = (m: LightingMood | null) => (m === 'flashback' ? 1 : 0);
  const amount = amountOf(lighting.previous) * (1 - t) + amountOf(lighting.mood) * (lighting.previous ? t : 1);
  return amount > 0.01 ? `sepia(${(0.85 * amount).toFixed(2)}) saturate(${(1 - 0.25 * amount).toFixed(2)})` : '';
}

const hash = (n: number) => {
  const s = Math.sin(n * 127.1) * 43758.5453;
  return s - Math.floor(s);
};

export function drawWeather(
  ctx: CanvasRenderingContext2D,
  weather: WeatherKind,
  w: number,
  h: number,
  animClockMs: number
): void {
  if (weather === 'none') return;
  const t = animClockMs / 1000;
  ctx.save();
  switch (weather) {
    case 'rain': {
      ctx.fillStyle = 'rgba(16, 24, 48, 0.12)';
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = 'rgba(176, 208, 255, 0.55)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      const count = Math.ceil((w * h) / 1400);
      for (let i = 0; i < count; i++) {
        const x = (hash(i) * (w + 40) - t * 60 * (0.8 + hash(i + 7) * 0.4)) % (w + 40);
        const y = (hash(i + 3) * h + t * 360 * (0.8 + hash(i + 9) * 0.4)) % (h + 20);
        const px = Math.round(x < 0 ? x + w + 40 : x);
        ctx.moveTo(px + 0.5, Math.round(y) - 6);
        ctx.lineTo(px - 1.5, Math.round(y));
      }
      ctx.stroke();
      break;
    }
    case 'snow': {
      ctx.fillStyle = 'rgba(248, 252, 255, 0.9)';
      const count = Math.ceil((w * h) / 2200);
      for (let i = 0; i < count; i++) {
        const fall = 18 + hash(i + 5) * 22;
        const y = (hash(i + 1) * h + t * fall) % h;
        const x = (hash(i) * w + Math.sin(t * 1.3 + i) * 6 + w) % w;
        const size = hash(i + 2) > 0.7 ? 2 : 1;
        ctx.fillRect(Math.round(x), Math.round(y), size, size);
      }
      break;
    }
    case 'fog': {
      for (let i = 0; i < 4; i++) {
        const bandY = h * (0.2 + i * 0.22);
        const shift = Math.sin(t * 0.15 + i * 1.7) * w * 0.15;
        const grad = ctx.createLinearGradient(0, bandY - 30, 0, bandY + 30);
        grad.addColorStop(0, 'rgba(220, 228, 240, 0)');
        grad.addColorStop(0.5, 'rgba(220, 228, 240, 0.22)');
        grad.addColorStop(1, 'rgba(220, 228, 240, 0)');
        ctx.fillStyle = grad;
        ctx.fillRect(shift - w * 0.2, bandY - 30, w * 1.4, 60);
      }
      break;
    }
    case 'leaves':
    case 'embers': {
      const isLeaves = weather === 'leaves';
      const palette = isLeaves ? ['#e89838', '#c86828', '#88b838'] : ['#ffb838', '#ff7828', '#ffe078'];
      const count = Math.ceil((w * h) / (isLeaves ? 5200 : 3600));
      for (let i = 0; i < count; i++) {
        const speed = 10 + hash(i + 4) * 18;
        const travel = (hash(i + 1) * h + t * speed) % h;
        const y = isLeaves ? travel : h - travel;
        const x = (hash(i) * w + Math.sin(t * 0.9 + i * 2.1) * 10 + t * (isLeaves ? 8 : 2) + w) % w;
        ctx.fillStyle = palette[i % palette.length]!;
        const flick = isLeaves || Math.sin(t * 6 + i) > -0.3;
        if (!flick) continue;
        ctx.fillRect(Math.round(x), Math.round(y), isLeaves ? 2 : 1, isLeaves && i % 2 === 0 ? 1 : 2);
      }
      break;
    }
  }
  ctx.restore();
}

export function drawScreenFadeAndFlash(
  ctx: CanvasRenderingContext2D,
  fade: ScreenFadeState | null,
  flash: ScreenFlashState | null,
  w: number,
  h: number
): void {
  if (fade && fade.alpha > 0.001) {
    ctx.save();
    ctx.globalAlpha = Math.min(1, fade.alpha);
    ctx.fillStyle = fade.color === 'white' ? '#f8f8f8' : '#000000';
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }
  if (flash) {
    const p = Math.min(1, flash.elapsedMs / Math.max(1, flash.durationMs));
    const alpha = p < 0.2 ? p / 0.2 : 1 - (p - 0.2) / 0.8;
    if (alpha > 0.001) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, alpha) * 0.9;
      ctx.fillStyle = flash.color === 'black' ? '#000000' : '#ffffff';
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
    }
  }
}
