/**
 * Cutscene Stage Props & Overhead Pixel Emote Bubbles (`cutscenePropsAndMoods.ts`)
 */

import { PMD_TILE_NATIVE_PX } from '../../assets/tilesetLoader';
import type { EmoteKind } from '../../data/cutscenes/cutsceneDocTypes';
import type { AmbientMote, RuntimeCutsceneProp } from './cutsceneTypes';

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

function drawCampfire(ctx: CanvasRenderingContext2D, px: number, py: number, animClockMs: number): void {
  const frame = Math.floor(animClockMs / 150) % 3;
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
}

/** Image props sit with their bottom-centre on the bottom-centre of their tile. */
export function drawStageProp(
  ctx: CanvasRenderingContext2D,
  prop: RuntimeCutsceneProp,
  camX: number,
  camY: number,
  animClockMs: number
): void {
  if (!prop.visible) return;
  const px = Math.round(prop.x * PMD_TILE_NATIVE_PX - camX);
  const py = Math.round(prop.y * PMD_TILE_NATIVE_PX - camY);
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  if (prop.kind === 'campfire') {
    drawCampfire(ctx, px, py, animClockMs);
  } else if (prop.image) {
    const w = prop.image.naturalWidth;
    const h = prop.image.naturalHeight;
    ctx.drawImage(prop.image, Math.round(px + PMD_TILE_NATIVE_PX / 2 - w / 2), py + PMD_TILE_NATIVE_PX - h);
  } else {
    ctx.strokeStyle = '#f8d048';
    ctx.strokeRect(px + 3.5, py + 3.5, PMD_TILE_NATIVE_PX - 7, PMD_TILE_NATIVE_PX - 7);
  }
  ctx.restore();
}

type PixelRect = [number, number, number, number];

const EMOTE_GLYPHS: Readonly<Record<EmoteKind, Array<{ color: string; rects: PixelRect[] }>>> = {
  exclamation: [{ color: '#e83038', rects: [[4, 2, 3, 5], [4, 8, 3, 2]] }],
  question: [{ color: '#2878d8', rects: [[3, 2, 5, 2], [6, 4, 2, 2], [4, 5, 3, 2], [4, 8, 2, 2]] }],
  sweat: [
    { color: '#38a8ff', rects: [[5, 2, 2, 2], [4, 4, 4, 3], [3, 6, 5, 3]] },
    { color: '#ffffff', rects: [[4, 6, 1, 2]] },
  ],
  joy: [{ color: '#f8a828', rects: [[2, 3, 2, 2], [7, 3, 2, 2], [3, 7, 5, 2]] }],
  music: [{ color: '#30b858', rects: [[4, 2, 5, 2], [4, 4, 2, 5], [8, 4, 2, 4], [2, 7, 3, 2], [6, 6, 3, 2]] }],
  angry: [{ color: '#d82838', rects: [[2, 3, 3, 2], [6, 3, 3, 2], [3, 6, 5, 3]] }],
  heart: [{ color: '#f04888', rects: [[2, 3, 3, 3], [6, 3, 3, 3], [3, 5, 5, 3], [4, 8, 3, 2]] }],
  ellipsis: [{ color: '#304058', rects: [[1, 5, 2, 2], [4, 5, 2, 2], [7, 5, 2, 2]] }],
  shock: [
    { color: '#e83038', rects: [[2, 2, 2, 5], [2, 8, 2, 2]] },
    { color: '#2878d8', rects: [[5, 2, 4, 2], [7, 4, 2, 2], [6, 5, 2, 2], [6, 8, 2, 2]] },
  ],
  sleep: [{ color: '#4868c8', rects: [[1, 2, 4, 1], [3, 3, 1, 1], [2, 4, 1, 1], [1, 5, 4, 1], [6, 5, 3, 1], [7, 6, 1, 1], [6, 7, 3, 1]] }],
  idea: [
    { color: '#f8d020', rects: [[3, 1, 5, 1], [2, 2, 7, 4], [3, 6, 5, 1]] },
    { color: '#fff8c0', rects: [[3, 2, 2, 2]] },
    { color: '#788098', rects: [[4, 7, 3, 1], [4, 9, 3, 1]] },
    { color: '#a8b0c8', rects: [[4, 8, 3, 1]] },
  ],
  anger_vein: [{ color: '#e02838', rects: [[3, 2, 2, 3], [6, 2, 2, 3], [2, 3, 3, 2], [6, 3, 3, 2], [2, 6, 3, 2], [6, 6, 3, 2], [3, 6, 2, 3], [6, 6, 2, 3]] }],
  swirl: [{ color: '#9048c8', rects: [[3, 2, 5, 1], [2, 3, 1, 5], [8, 3, 1, 4], [3, 8, 4, 1], [4, 4, 3, 1], [4, 5, 1, 2], [5, 6, 2, 1]] }],
  sparkle: [
    { color: '#f8c820', rects: [[5, 1, 1, 9], [1, 5, 9, 1], [4, 4, 3, 3]] },
    { color: '#ffffff', rects: [[5, 5, 1, 1]] },
  ],
};

export function drawPixelEmoteBubble(
  ctx: CanvasRenderingContext2D,
  kind: EmoteKind,
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

  for (const layer of EMOTE_GLYPHS[kind] ?? []) {
    ctx.fillStyle = layer.color;
    for (const [rx, ry, rw, rh] of layer.rects) ctx.fillRect(x + rx, y + ry, rw, rh);
  }
}
