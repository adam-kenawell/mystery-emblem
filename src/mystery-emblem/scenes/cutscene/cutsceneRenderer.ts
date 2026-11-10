/**
 * Crisp `1x` Native Pixel Buffer + Integer CSS Scale Cutscene Stage Renderer (`cutsceneRenderer.ts`)
 */

import {
  computePmdTileSpritePlacement,
  normalizePmdDirection,
  type LoadedSpriteBundle,
} from '../../assets/pmdAssetLoader';
import {
  PMD_TILE_NATIVE_PX,
  drawSpecialTerrainOverlay,
  drawTilesetChunk,
  normalizeTilesetId,
  type LoadedTilesetSheet,
} from '../../assets/tilesetLoader';
import type { CutsceneChoreographer } from './cutsceneChoreographer';
import {
  drawAtmosphericMood,
  drawPixelEmoteBubble,
  drawStageProp,
} from './cutscenePropsAndMoods';
import type {
  AmbientMote,
  RuntimeCutsceneActor,
  StoryCutsceneDefinition,
} from './cutsceneTypes';

export interface RenderCutsceneFrameParams {
  ctx: CanvasRenderingContext2D;
  nativeW: number;
  nativeH: number;
  viewHeightCss: number;
  def: StoryCutsceneDefinition;
  actors: ReadonlyArray<RuntimeCutsceneActor>;
  choreo: CutsceneChoreographer;
  tilesetSheets: ReadonlyMap<string, LoadedTilesetSheet>;
  spriteBundles: ReadonlyMap<string, LoadedSpriteBundle>;
  ambientMotes: ReadonlyArray<AmbientMote>;
}

export function renderCutsceneStageFrame(params: RenderCutsceneFrameParams): void {
  const { ctx, nativeW, nativeH, viewHeightCss, def, actors, choreo } = params;
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = '#080e1c';
  ctx.fillRect(0, 0, nativeW, nativeH);

  const mapPixelW = def.width * PMD_TILE_NATIVE_PX;
  const mapPixelH = def.height * PMD_TILE_NATIVE_PX;

  const focalScreenX = Math.round(nativeW * 0.5);
  const focalScreenY = Math.round(nativeH * (viewHeightCss <= 460 ? 0.34 : 0.4));

  const targetWorldX = (choreo.cameraTileX + 0.5) * PMD_TILE_NATIVE_PX;
  const targetWorldY = (choreo.cameraTileY + 0.5) * PMD_TILE_NATIVE_PX;

  let camX = Math.round(targetWorldX - focalScreenX);
  let camY = Math.round(targetWorldY - focalScreenY);

  if (mapPixelW <= nativeW) {
    camX = -Math.round((nativeW - mapPixelW) * 0.5);
  } else {
    camX = Math.max(0, Math.min(mapPixelW - nativeW, camX));
  }
  if (mapPixelH <= nativeH) {
    camY = -Math.round((nativeH - mapPixelH) * 0.38);
  } else {
    const maxCamY = Math.max(0, mapPixelH - Math.round(nativeH * 0.68));
    camY = Math.max(0, Math.min(maxCamY, camY));
  }

  if (choreo.screenShakeRemainingMs > 0) {
    const phase = Math.floor(choreo.animClockMs / 40);
    camX += (phase % 2 === 0 ? 1 : -1) * choreo.screenShakeIntensityPx;
    camY += ((phase + 1) % 3 === 0 ? 1 : -1) * Math.max(1, choreo.screenShakeIntensityPx - 1);
  }

  for (let ty = 0; ty < def.height; ty++) {
    const row = def.tiles[ty];
    if (!row) continue;
    const drawY = ty * PMD_TILE_NATIVE_PX - camY;
    if (drawY + PMD_TILE_NATIVE_PX < 0 || drawY > nativeH) continue;

    for (let tx = 0; tx < def.width; tx++) {
      const cell = row[tx];
      if (!cell) continue;
      const drawX = tx * PMD_TILE_NATIVE_PX - camX;
      if (drawX + PMD_TILE_NATIVE_PX < 0 || drawX > nativeW) continue;

      const sheet = params.tilesetSheets.get(normalizeTilesetId(cell.tilesetId));
      if (sheet) {
        drawTilesetChunk(ctx, sheet, cell.chunkIndex, drawX, drawY, PMD_TILE_NATIVE_PX);
      }
      drawSpecialTerrainOverlay(
        ctx,
        cell.terrainType,
        cell.tilesetId,
        drawX,
        drawY,
        PMD_TILE_NATIVE_PX
      );
    }
  }

  if (def.props) {
    for (const prop of def.props) {
      if (prop.x < 0 || prop.y < 0 || prop.x >= def.width || prop.y >= def.height) continue;
      drawStageProp(ctx, prop, camX, camY, choreo.animClockMs);
    }
  }

  for (const pulse of choreo.auraPulses) {
    const actor = actors.find((a) => a.actorId === pulse.actorId && a.visible);
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

  const visibleActors = actors
    .filter((a) => a.available && a.visible)
    .slice()
    .sort((a, b) => a.y - b.y || a.x - b.x);

  for (const actor of visibleActors) {
    drawCutsceneActor(
      ctx,
      actor,
      camX,
      camY,
      choreo.animClockMs,
      params.spriteBundles.get(actor.visualAssetKey)
    );
  }

  ctx.save();
  ctx.beginPath();
  ctx.rect(-camX, -camY, mapPixelW, mapPixelH);
  ctx.clip();
  drawAtmosphericMood(
    ctx,
    def,
    camX,
    camY,
    nativeW,
    nativeH,
    choreo.animClockMs,
    params.ambientMotes
  );
  ctx.restore();
}

function drawCutsceneActor(
  ctx: CanvasRenderingContext2D,
  actor: RuntimeCutsceneActor,
  camX: number,
  camY: number,
  animClockMs: number,
  bundle: LoadedSpriteBundle | undefined
): void {
  const anim = bundle ? (bundle.actions[actor.action] ?? bundle.actions.Idle) : undefined;

  let hopOffsetY = 0;
  if (actor.hop) {
    const progress = Math.min(1, actor.hop.elapsedMs / actor.hop.totalDurationMs);
    const wave = Math.abs(Math.sin(progress * Math.PI * actor.hop.count));
    hopOffsetY = -Math.round(wave * actor.hop.heightPx);
  }

  const shakeOffsetX =
    actor.shakeRemainingMs > 0 ? (Math.floor(animClockMs / 38) % 2 === 0 ? -1 : 1) : 0;

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

  const shadowRadiusX =
    (bundle?.shadowSize ?? 1) >= 2 || actor.pmdAssetId === '0497' || actor.pmdAssetId === '0350'
      ? 9
      : 6;
  ctx.fillStyle = 'rgba(6, 10, 22, 0.48)';
  ctx.beginPath();
  ctx.ellipse(placement.shadowCenterX, placement.shadowCenterY, shadowRadiusX, 3, 0, 0, Math.PI * 2);
  ctx.fill();

  if (anim) {
    const safeFrameCount = Math.max(1, anim.frameCount);
    let totalMs = 0;
    for (let i = 0; i < safeFrameCount; i++) {
      totalMs += Math.max(16, anim.durationsMs[i] ?? 120);
    }
    totalMs = Math.max(80, totalMs);
    let rem = actor.animElapsedMs % totalMs;
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
    drawPixelEmoteBubble(
      ctx,
      actor.emote.kind,
      placement.shadowCenterX,
      placement.drawY + hopOffsetY - 11,
      animClockMs
    );
  }

  ctx.restore();
}
