/**
 * Cutscene Stage Props, Overhead Pixel Emote Bubbles & Atmospheric Moods (`cutscenePropsAndMoods.ts`)
 */

import { PMD_TILE_NATIVE_PX } from '../../assets/tilesetLoader';
import type {
  AmbientMote,
  CutsceneEmoteKind,
  CutscenePropDef,
  StoryCutsceneDefinition,
} from './cutsceneTypes';

export function createAmbientMotes(count = 22): AmbientMote[] {
  const motes: AmbientMote[] = [];
  for (let i = 0; i < count; i++) {
    motes.push({
      seedX: ((i * 73 + 19) % 100) / 100,
      seedY: ((i * 41 + 11) % 100) / 100,
      speedX: ((i % 5) - 2) * 0.008,
      speedY: -0.012 - (i % 4) * 0.006,
      phase: i * 0.85,
      size: i % 3 === 0 ? 2 : 1,
    });
  }
  return motes;
}

export function drawStageProp(
  ctx: CanvasRenderingContext2D,
  prop: CutscenePropDef,
  camX: number,
  camY: number,
  animClockMs: number
): void {
  const px = Math.round(prop.x * PMD_TILE_NATIVE_PX - camX);
  const py = Math.round(prop.y * PMD_TILE_NATIVE_PX - camY);
  const frame = Math.floor(animClockMs / 150) % 3;

  ctx.save();
  ctx.imageSmoothingEnabled = false;

  switch (prop.kind) {
    case 'campfire': {
      const glowRadius = 26 + (frame === 1 ? 3 : frame === 2 ? -1 : 1);
      const grad = ctx.createRadialGradient(px + 12, py + 14, 3, px + 12, py + 14, glowRadius);
      grad.addColorStop(0, 'rgba(255, 200, 88, 0.42)');
      grad.addColorStop(0.55, 'rgba(255, 128, 40, 0.18)');
      grad.addColorStop(1, 'rgba(255, 96, 24, 0)');
      ctx.fillStyle = grad;
      ctx.fillRect(px + 12 - glowRadius, py + 14 - glowRadius, glowRadius * 2, glowRadius * 2);

      ctx.fillStyle = '#3b2416';
      ctx.fillRect(px + 6, py + 15, 12, 3);
      ctx.fillRect(px + 8, py + 13, 8, 5);
      ctx.fillStyle = '#684228';
      ctx.fillRect(px + 7, py + 15, 10, 2);
      ctx.fillStyle = '#5a6678';
      ctx.fillRect(px + 5, py + 16, 2, 2);
      ctx.fillRect(px + 17, py + 16, 2, 2);
      ctx.fillRect(px + 10, py + 18, 4, 2);

      ctx.fillStyle = '#ff5828';
      ctx.fillRect(px + 8, py + 9 + (frame === 2 ? 1 : 0), 8, 7);
      ctx.fillRect(px + 10, py + 6 + (frame === 0 ? 1 : 0), 4, 4);
      ctx.fillStyle = '#ffb838';
      ctx.fillRect(px + 9, py + 10, 6, 5);
      ctx.fillRect(px + 10 + (frame === 1 ? 1 : 0), py + 8, 3, 3);
      ctx.fillStyle = '#fff8a8';
      ctx.fillRect(px + 10, py + 12, 4, 3);
      const sparkOffset = Math.floor(animClockMs / 90) % 7;
      ctx.fillStyle = '#ffe078';
      ctx.fillRect(px + 11 + (sparkOffset % 2), py + 6 - sparkOffset, 1, 1);
      break;
    }
    case 'sanctuary_crystal': {
      const pulse = 0.5 + 0.5 * Math.sin(animClockMs / 360);
      const grad = ctx.createRadialGradient(px + 12, py + 12, 2, px + 12, py + 12, 24);
      grad.addColorStop(0, `rgba(120, 248, 255, ${(0.32 + pulse * 0.16).toFixed(2)})`);
      grad.addColorStop(1, 'rgba(64, 184, 248, 0)');
      ctx.fillStyle = grad;
      ctx.fillRect(px - 12, py - 12, 48, 48);

      ctx.fillStyle = '#324a68';
      ctx.fillRect(px + 7, py + 16, 10, 4);
      ctx.fillStyle = '#88b8d8';
      ctx.fillRect(px + 8, py + 15, 8, 2);
      const bob = frame === 1 ? -1 : 0;
      ctx.fillStyle = '#28a8e8';
      ctx.fillRect(px + 9, py + 6 + bob, 6, 8);
      ctx.fillStyle = '#98f8ff';
      ctx.fillRect(px + 10, py + 5 + bob, 4, 9);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(px + 11, py + 7 + bob, 2, 4);
      break;
    }
    case 'lantern': {
      const grad = ctx.createRadialGradient(px + 12, py + 8, 2, px + 12, py + 8, 18);
      grad.addColorStop(0, 'rgba(255, 216, 112, 0.34)');
      grad.addColorStop(1, 'rgba(255, 160, 48, 0)');
      ctx.fillStyle = grad;
      ctx.fillRect(px - 6, py - 10, 36, 36);

      ctx.fillStyle = '#4a3020';
      ctx.fillRect(px + 11, py + 10, 2, 10);
      ctx.fillRect(px + 9, py + 19, 6, 2);
      ctx.fillStyle = '#d84838';
      ctx.fillRect(px + 8, py + 4, 8, 7);
      ctx.fillStyle = '#ffe888';
      ctx.fillRect(px + 9, py + 5, 6, 5);
      break;
    }
    case 'ancient_rune': {
      const alpha = 0.35 + 0.25 * Math.sin(animClockMs / 320);
      ctx.strokeStyle = `rgba(184, 144, 255, ${alpha.toFixed(2)})`;
      ctx.lineWidth = 1;
      ctx.strokeRect(px + 4.5, py + 4.5, 15, 15);
      ctx.fillStyle = `rgba(224, 192, 255, ${alpha.toFixed(2)})`;
      ctx.fillRect(px + 10, py + 10, 4, 4);
      break;
    }
    case 'berry_basket': {
      ctx.fillStyle = '#784c28';
      ctx.fillRect(px + 6, py + 12, 12, 7);
      ctx.fillStyle = '#a8703c';
      ctx.fillRect(px + 7, py + 13, 10, 5);
      ctx.fillStyle = '#3898ff';
      ctx.fillRect(px + 8, py + 10, 3, 3);
      ctx.fillRect(px + 13, py + 11, 3, 3);
      ctx.fillStyle = '#f8d038';
      ctx.fillRect(px + 10, py + 9, 4, 3);
      break;
    }
  }

  ctx.restore();
}

export function drawPixelEmoteBubble(
  ctx: CanvasRenderingContext2D,
  kind: CutsceneEmoteKind,
  cx: number,
  cy: number,
  animClockMs: number
): void {
  const bob = Math.floor(animClockMs / 160) % 2 === 0 ? 0 : -1;
  const x = Math.round(cx - 6);
  const y = Math.round(cy - 6 + bob);

  ctx.fillStyle = '#081020';
  ctx.fillRect(x - 1, y - 1, 13, 13);
  ctx.fillStyle = '#f8fcff';
  ctx.fillRect(x, y, 11, 11);
  ctx.fillRect(cx - 1, y + 11, 2, 2);

  switch (kind) {
    case 'exclamation':
      ctx.fillStyle = '#e83038';
      ctx.fillRect(x + 4, y + 2, 3, 5);
      ctx.fillRect(x + 4, y + 8, 3, 2);
      break;
    case 'question':
      ctx.fillStyle = '#2878d8';
      ctx.fillRect(x + 3, y + 2, 5, 2);
      ctx.fillRect(x + 6, y + 4, 2, 2);
      ctx.fillRect(x + 4, y + 5, 3, 2);
      ctx.fillRect(x + 4, y + 8, 2, 2);
      break;
    case 'sweat':
      ctx.fillStyle = '#38a8ff';
      ctx.fillRect(x + 5, y + 2, 2, 2);
      ctx.fillRect(x + 4, y + 4, 4, 3);
      ctx.fillRect(x + 3, y + 6, 5, 3);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(x + 4, y + 6, 1, 2);
      break;
    case 'joy':
      ctx.fillStyle = '#f8a828';
      ctx.fillRect(x + 2, y + 3, 2, 2);
      ctx.fillRect(x + 7, y + 3, 2, 2);
      ctx.fillRect(x + 3, y + 7, 5, 2);
      break;
    case 'music':
      ctx.fillStyle = '#30b858';
      ctx.fillRect(x + 4, y + 2, 5, 2);
      ctx.fillRect(x + 4, y + 4, 2, 5);
      ctx.fillRect(x + 8, y + 4, 2, 4);
      ctx.fillRect(x + 2, y + 7, 3, 2);
      ctx.fillRect(x + 6, y + 6, 3, 2);
      break;
    case 'angry':
      ctx.fillStyle = '#d82838';
      ctx.fillRect(x + 2, y + 3, 3, 2);
      ctx.fillRect(x + 6, y + 3, 3, 2);
      ctx.fillRect(x + 3, y + 6, 5, 3);
      break;
    case 'heart':
      ctx.fillStyle = '#f04888';
      ctx.fillRect(x + 2, y + 3, 3, 3);
      ctx.fillRect(x + 6, y + 3, 3, 3);
      ctx.fillRect(x + 3, y + 5, 5, 3);
      ctx.fillRect(x + 4, y + 8, 3, 2);
      break;
  }
}

export function drawAtmosphericMood(
  ctx: CanvasRenderingContext2D,
  def: StoryCutsceneDefinition,
  camX: number,
  camY: number,
  nativeW: number,
  nativeH: number,
  animClockMs: number,
  ambientMotes: ReadonlyArray<AmbientMote>
): void {
  ctx.save();

  switch (def.lightingMood) {
    case 'morning_coast': {
      const grad = ctx.createLinearGradient(0, 0, nativeW * 0.7, nativeH);
      grad.addColorStop(0, 'rgba(255, 232, 164, 0.16)');
      grad.addColorStop(0.55, 'rgba(255, 210, 128, 0.04)');
      grad.addColorStop(1, 'rgba(24, 64, 112, 0.12)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, nativeW, nativeH);
      break;
    }
    case 'sanctuary_glow': {
      const grad = ctx.createRadialGradient(
        nativeW * 0.5,
        nativeH * 0.25,
        12,
        nativeW * 0.5,
        nativeH * 0.45,
        nativeW * 0.7
      );
      grad.addColorStop(0, 'rgba(168, 255, 224, 0.16)');
      grad.addColorStop(0.6, 'rgba(56, 168, 144, 0.05)');
      grad.addColorStop(1, 'rgba(8, 24, 36, 0.22)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, nativeW, nativeH);
      break;
    }
    case 'campfire_dusk': {
      ctx.fillStyle = 'rgba(14, 20, 48, 0.34)';
      ctx.fillRect(0, 0, nativeW, nativeH);
      const fireProp = def.props?.find((p) => p.kind === 'campfire');
      if (fireProp) {
        const fx = (fireProp.x + 0.5) * PMD_TILE_NATIVE_PX - camX;
        const fy = (fireProp.y + 0.5) * PMD_TILE_NATIVE_PX - camY;
        const grad = ctx.createRadialGradient(fx, fy, 8, fx, fy, 92);
        grad.addColorStop(0, 'rgba(255, 196, 96, 0.24)');
        grad.addColorStop(0.55, 'rgba(255, 128, 48, 0.08)');
        grad.addColorStop(1, 'rgba(10, 14, 34, 0)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, nativeW, nativeH);
      }
      break;
    }
    case 'mountain_mist': {
      const grad = ctx.createLinearGradient(0, 0, 0, nativeH);
      grad.addColorStop(0, 'rgba(188, 208, 255, 0.16)');
      grad.addColorStop(0.6, 'rgba(96, 72, 152, 0.08)');
      grad.addColorStop(1, 'rgba(12, 16, 34, 0.24)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, nativeW, nativeH);
      break;
    }
    case 'shrine_courtyard': {
      const grad = ctx.createLinearGradient(0, 0, 0, nativeH);
      grad.addColorStop(0, 'rgba(144, 228, 255, 0.12)');
      grad.addColorStop(1, 'rgba(12, 32, 56, 0.16)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, nativeW, nativeH);
      break;
    }
    case 'twilight_festival': {
      const grad = ctx.createLinearGradient(0, 0, 0, nativeH);
      grad.addColorStop(0, 'rgba(88, 64, 148, 0.22)');
      grad.addColorStop(0.5, 'rgba(224, 132, 76, 0.10)');
      grad.addColorStop(1, 'rgba(14, 22, 44, 0.24)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, nativeW, nativeH);
      break;
    }
  }

  ctx.fillStyle =
    def.lightingMood === 'campfire_dusk' || def.lightingMood === 'twilight_festival'
      ? 'rgba(255, 224, 120, 0.65)'
      : def.lightingMood === 'mountain_mist'
        ? 'rgba(208, 192, 255, 0.50)'
        : 'rgba(232, 255, 224, 0.52)';
  const sec = animClockMs / 1000;
  for (const m of ambientMotes) {
    const mx = Math.floor((((m.seedX + sec * m.speedX) % 1) + 1) % 1 * nativeW);
    const my = Math.floor((((m.seedY + sec * m.speedY) % 1) + 1) % 1 * nativeH);
    if (Math.sin(sec * 2.4 + m.phase) > -0.2) {
      ctx.fillRect(mx, my, m.size, m.size);
    }
  }

  ctx.restore();
}
