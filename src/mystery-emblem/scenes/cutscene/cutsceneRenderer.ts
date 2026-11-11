/**
 * Crisp `1x` Native Pixel Buffer + Integer CSS Scale Cutscene Stage Renderer (`cutsceneRenderer.ts`)
 *
 * Draw order: behind layers → behind props → aura pulses → characters & auto props (sorted by
 * row) → front props → front layers → lighting → weather → screen fade/flash.
 */

import {
  computePmdTileSpritePlacement,
  normalizePmdDirection,
  type LoadedActionAnimation,
  type LoadedSpriteBundle,
} from '../../assets/pmdAssetLoader';
import {
  PMD_TILE_NATIVE_PX,
  drawSpecialTerrainOverlay,
  drawTilesetChunk,
  normalizeTilesetId,
  type LoadedTilesetSheet,
} from '../../assets/tilesetLoader';
import {
  drawLightingAndMotes,
  drawScreenFadeAndFlash,
  drawWeather,
  lightingCssFilter,
} from './cutsceneAtmosphere';
import type { CutsceneStageRuntime } from './cutsceneChoreographer';
import { drawPixelEmoteBubble, drawStageProp } from './cutscenePropsAndMoods';
import type {
  AmbientMote,
  ResolvedLocationLayer,
  RuntimeCutsceneActor,
  RuntimeCutsceneProp,
} from './cutsceneTypes';

export interface RenderCutsceneFrameParams {
  ctx: CanvasRenderingContext2D;
  nativeW: number;
  nativeH: number;
  viewHeightCss: number;
  runtime: CutsceneStageRuntime;
  ambientMotes: ReadonlyArray<AmbientMote>;
}

export interface CutsceneFrameCamera {
  camX: number;
  camY: number;
}

/** Native-pixel camera offset for the runtime's camera tile (shared by renderer & editor). */
export function computeCutsceneCamera(
  runtime: CutsceneStageRuntime,
  nativeW: number,
  nativeH: number,
  viewHeightCss: number
): CutsceneFrameCamera {
  const mapPixelW = runtime.location.width * PMD_TILE_NATIVE_PX;
  const mapPixelH = runtime.location.height * PMD_TILE_NATIVE_PX;
  const focalScreenX = Math.round(nativeW * 0.5);
  const focalScreenY = Math.round(nativeH * (viewHeightCss <= 460 ? 0.34 : 0.4));
  let camX = Math.round((runtime.cameraTileX + 0.5) * PMD_TILE_NATIVE_PX - focalScreenX);
  let camY = Math.round((runtime.cameraTileY + 0.5) * PMD_TILE_NATIVE_PX - focalScreenY);
  if (mapPixelW <= nativeW) camX = -Math.round((nativeW - mapPixelW) * 0.5);
  else camX = Math.max(0, Math.min(mapPixelW - nativeW, camX));
  if (mapPixelH <= nativeH) camY = -Math.round((nativeH - mapPixelH) * 0.38);
  else camY = Math.max(0, Math.min(Math.max(0, mapPixelH - Math.round(nativeH * 0.68)), camY));
  return { camX, camY };
}

const positiveMod = (v: number, m: number) => ((v % m) + m) % m;

function drawLocationLayer(
  ctx: CanvasRenderingContext2D,
  layer: ResolvedLocationLayer,
  camX: number,
  camY: number,
  nativeW: number,
  nativeH: number,
  animClockMs: number,
  sheets: ReadonlyMap<string, LoadedTilesetSheet>
): void {
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  if (layer.opacity !== undefined && layer.opacity < 1) ctx.globalAlpha = Math.max(0, layer.opacity);
  const t = animClockMs / 1000;
  if (layer.kind === 'tiles' && layer.grid) {
    for (let ty = 0; ty < layer.grid.length; ty++) {
      const row = layer.grid[ty]!;
      const drawY = ty * PMD_TILE_NATIVE_PX - camY;
      if (drawY + PMD_TILE_NATIVE_PX < 0 || drawY > nativeH) continue;
      for (let tx = 0; tx < row.length; tx++) {
        const cell = row[tx];
        if (!cell) continue;
        const drawX = tx * PMD_TILE_NATIVE_PX - camX;
        if (drawX + PMD_TILE_NATIVE_PX < 0 || drawX > nativeW) continue;
        const sheet = sheets.get(normalizeTilesetId(cell.tilesetId));
        if (sheet) drawTilesetChunk(ctx, sheet, cell.chunkIndex, drawX, drawY, PMD_TILE_NATIVE_PX);
        drawSpecialTerrainOverlay(ctx, cell.terrainType, cell.tilesetId, drawX, drawY, PMD_TILE_NATIVE_PX);
      }
    }
  } else if (layer.kind === 'picture' && layer.img) {
    ctx.drawImage(layer.img, Math.round((layer.x ?? 0) - camX), Math.round((layer.y ?? 0) - camY));
  } else if (layer.kind === 'texture' && layer.img) {
    const frames = Math.max(1, Math.floor(layer.frames ?? 1));
    const fw = Math.max(1, Math.floor(layer.img.naturalWidth / frames));
    const fh = layer.img.naturalHeight;
    const frame = frames > 1 ? Math.floor(t * Math.max(0.1, layer.fps ?? 6)) % frames : 0;
    const ox = positiveMod(Math.round(-camX + (layer.driftX ?? 0) * t), fw);
    const oy = positiveMod(Math.round(-camY + (layer.driftY ?? 0) * t), fh);
    for (let y = oy - fh; y < nativeH; y += fh) {
      for (let x = ox - fw; x < nativeW; x += fw) {
        ctx.drawImage(layer.img, frame * fw, 0, fw, fh, x, y, fw, fh);
      }
    }
  } else if (layer.kind === 'parallax' && layer.img) {
    const w = layer.img.naturalWidth;
    const baseX = Math.round(-camX * layer.scroll + (layer.driftX ?? 0) * t);
    const y = Math.round((layer.y ?? 0) - camY * layer.scroll);
    if (layer.repeatX) {
      for (let x = positiveMod(baseX, w) - w; x < nativeW; x += w) ctx.drawImage(layer.img, x, y);
    } else {
      ctx.drawImage(layer.img, baseX, y);
    }
  }
  ctx.restore();
}

function drawAuraPulses(ctx: CanvasRenderingContext2D, runtime: CutsceneStageRuntime, camX: number, camY: number): void {
  for (const pulse of runtime.auraPulses) {
    const actor = runtime.actors.find((a) => a.actorId === pulse.actorId && a.visible);
    if (!actor) continue;
    const t = pulse.elapsedMs / pulse.durationMs;
    const cx = Math.round((actor.x + 0.5) * PMD_TILE_NATIVE_PX - camX);
    const cy = Math.round((actor.y + 0.72) * PMD_TILE_NATIVE_PX - camY);
    const radius = 6 + t * 22;
    ctx.save();
    ctx.globalAlpha = Math.max(0, (1 - t) * 0.85);
    ctx.strokeStyle = pulse.color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx, cy, radius * 0.62, 0, Math.PI * 2);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
  }
}

/** Renders one stage frame and returns the CSS filter the canvas should use. */
export function renderCutsceneStageFrame(params: RenderCutsceneFrameParams): { cssFilter: string } {
  const { ctx, nativeW, nativeH, viewHeightCss, runtime } = params;
  const { caches } = runtime;
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = '#080e1c';
  ctx.fillRect(0, 0, nativeW, nativeH);

  let { camX, camY } = computeCutsceneCamera(runtime, nativeW, nativeH, viewHeightCss);
  if (runtime.screenShakeRemainingMs > 0) {
    const phase = Math.floor(runtime.animClockMs / 40);
    camX += (phase % 2 === 0 ? 1 : -1) * runtime.screenShakeIntensityPx;
    camY += ((phase + 1) % 3 === 0 ? 1 : -1) * Math.max(1, runtime.screenShakeIntensityPx - 1);
  }

  const layers = runtime.location.layers;
  for (const layer of layers) {
    if (!layer.front) drawLocationLayer(ctx, layer, camX, camY, nativeW, nativeH, runtime.animClockMs, caches.tilesetSheets);
  }

  const inBounds = (p: RuntimeCutsceneProp) =>
    p.x >= 0 && p.y >= 0 && p.x < runtime.location.width && p.y < runtime.location.height;
  for (const prop of runtime.props) {
    if (prop.layer === 'behind' && inBounds(prop)) drawStageProp(ctx, prop, camX, camY, runtime.animClockMs);
  }

  drawAuraPulses(ctx, runtime, camX, camY);

  type Drawable = { y: number; x: number; order: number; draw: () => void };
  const drawables: Drawable[] = [];
  for (const prop of runtime.props) {
    if (prop.layer !== 'auto' || !inBounds(prop)) continue;
    drawables.push({ y: prop.y, x: prop.x, order: 0, draw: () => drawStageProp(ctx, prop, camX, camY, runtime.animClockMs) });
  }
  for (const actor of runtime.actors) {
    if (!actor.available || !actor.visible || actor.offStage) continue;
    drawables.push({
      y: actor.y,
      x: actor.x,
      order: 1,
      draw: () => drawCutsceneActor(ctx, actor, camX, camY, runtime.animClockMs, caches.spriteBundles.get(actor.visualAssetKey)),
    });
  }
  drawables.sort((a, b) => a.y - b.y || a.order - b.order || a.x - b.x);
  for (const d of drawables) d.draw();

  for (const prop of runtime.props) {
    if (prop.layer === 'front' && inBounds(prop)) drawStageProp(ctx, prop, camX, camY, runtime.animClockMs);
  }
  for (const layer of layers) {
    if (layer.front) drawLocationLayer(ctx, layer, camX, camY, nativeW, nativeH, runtime.animClockMs, caches.tilesetSheets);
  }

  ctx.save();
  if (!runtime.location.fillsScreen) {
    ctx.beginPath();
    ctx.rect(-camX, -camY, runtime.location.width * PMD_TILE_NATIVE_PX, runtime.location.height * PMD_TILE_NATIVE_PX);
    ctx.clip();
  }
  drawLightingAndMotes(ctx, runtime.lighting, nativeW, nativeH, camX, camY, runtime.props, runtime.animClockMs, params.ambientMotes);
  ctx.restore();

  drawWeather(ctx, runtime.weather, nativeW, nativeH, runtime.animClockMs);
  drawScreenFadeAndFlash(ctx, runtime.fade, runtime.flash, nativeW, nativeH);
  return { cssFilter: lightingCssFilter(runtime.lighting) };
}

function resolveActorAnimation(
  actor: RuntimeCutsceneActor,
  bundle: LoadedSpriteBundle | undefined
): LoadedActionAnimation | undefined {
  if (actor.poseAnim) return actor.poseAnim;
  return bundle ? (bundle.actions[actor.action] ?? bundle.actions.Idle) : undefined;
}

export function drawCutsceneActor(
  ctx: CanvasRenderingContext2D,
  actor: RuntimeCutsceneActor,
  camX: number,
  camY: number,
  animClockMs: number,
  bundle: LoadedSpriteBundle | undefined
): void {
  const anim = resolveActorAnimation(actor, bundle);

  let hopOffsetY = 0;
  if (actor.hop) {
    const progress = Math.min(1, actor.hop.elapsedMs / actor.hop.totalDurationMs);
    const wave = Math.abs(Math.sin(progress * Math.PI * actor.hop.count));
    hopOffsetY = -Math.round(wave * actor.hop.heightPx);
  }
  const shakeOffsetX = actor.shakeRemainingMs > 0 ? (Math.floor(animClockMs / 38) % 2 === 0 ? -1 : 1) : 0;
  const tileScreenX = Math.round(actor.x * PMD_TILE_NATIVE_PX - camX) + shakeOffsetX;
  const tileScreenY = Math.round(actor.y * PMD_TILE_NATIVE_PX - camY);
  const placement = computePmdTileSpritePlacement(
    tileScreenX,
    tileScreenY,
    anim?.frameWidth ?? PMD_TILE_NATIVE_PX,
    anim?.frameHeight ?? PMD_TILE_NATIVE_PX,
    PMD_TILE_NATIVE_PX
  );

  ctx.save();
  ctx.imageSmoothingEnabled = false;
  if (actor.alpha < 1) ctx.globalAlpha = Math.max(0, actor.alpha);

  const shadowRadiusX =
    (bundle?.shadowSize ?? 1) >= 2 || actor.pmdAssetId === '0497' || actor.pmdAssetId === '0350' ? 9 : 6;
  ctx.fillStyle = 'rgba(6, 10, 22, 0.48)';
  ctx.beginPath();
  ctx.ellipse(placement.shadowCenterX, placement.shadowCenterY, shadowRadiusX, 3, 0, 0, Math.PI * 2);
  ctx.fill();

  if (anim) {
    const safeFrameCount = Math.max(1, anim.frameCount);
    let totalMs = 0;
    for (let i = 0; i < safeFrameCount; i++) totalMs += Math.max(16, anim.durationsMs[i] ?? 120);
    totalMs = Math.max(80, totalMs);
    const holdLastFrame = actor.poseAnim !== null && actor.poseRemainingMs !== Infinity;
    let rem = holdLastFrame ? Math.min(actor.animElapsedMs, totalMs - 1) : actor.animElapsedMs % totalMs;
    let frameIdx = 0;
    for (let i = 0; i < safeFrameCount; i++) {
      const dur = Math.max(16, anim.durationsMs[i] ?? 120);
      if (rem < dur) {
        frameIdx = i;
        break;
      }
      rem -= dur;
    }
    const safeDir = normalizePmdDirection(actor.direction, 0);
    const rowIdx = anim.rowCount > 1 ? safeDir % anim.rowCount : 0;
    ctx.drawImage(
      anim.source,
      frameIdx * anim.frameWidth,
      rowIdx * anim.frameHeight,
      anim.frameWidth,
      anim.frameHeight,
      placement.drawX,
      placement.drawY + hopOffsetY,
      anim.frameWidth,
      anim.frameHeight
    );
  } else {
    ctx.fillStyle = '#58c8f8';
    ctx.fillRect(tileScreenX + 6, tileScreenY + 6 + hopOffsetY, 12, 12);
  }

  if (actor.emote) {
    drawPixelEmoteBubble(ctx, actor.emote.kind, placement.shadowCenterX, placement.drawY + hopOffsetY - 11, animClockMs);
  }
  ctx.restore();
}
