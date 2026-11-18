/**
 * 1x Native Pixel Buffer Dungeon Tile & Tactical Overlay Renderer (`BattleScene`)
 */

import {
  PMD_TILE_NATIVE_PX,
  drawSpecialTerrainOverlay,
  drawTilesetChunk,
  normalizeTilesetId,
} from '../../assets/tilesetLoader';
import { coordKey } from '../../engine/terrainAndPathfinding';
import type { DungeonMapDefinition } from '../../types/schemas';
import { drawMapEdgeVignette } from '../../ui/gridViewportMath';
import { syncFloatingCalloutDom } from './battleFloatingCallouts';
import { computeForecastStageBounds } from './battleForecastLog';
import {
  drawConnectedRangeZone,
  drawUnitRangeEnvelope,
  getDangerAreaPulse,
  getSelectionRangePulse,
  lerpRgba,
  splitDangerZoneLayers,
} from './battleRangeZonePainter';
import {
  RANGE_PULSE_PERIOD_MS,
  type BattleControllerContext,
  type BattleRuntimeState,
} from './battleTypesAndState';
import {
  getActiveInspectedAllyRange,
  getSeizeObjectiveCoords,
  getSelectedUnit,
} from './battleUnitQueries';
import { renderUnitsAndStrikeVfx } from './battleUnitSpriteRenderer';

const staticTileCanvasCache = new WeakMap<
  DungeonMapDefinition,
  { tileCacheVersion: number; tilesetCount: number; canvas: HTMLCanvasElement }
>();

const seizeCoordsCache = new WeakMap<
  DungeonMapDefinition,
  { tileCacheVersion: number; coords: Set<string> }
>();

function getOrBuildStaticTileCanvas(state: BattleRuntimeState): HTMLCanvasElement {
  const { map, tilesetSheets, tileCacheVersion } = state;
  const cached = staticTileCanvasCache.get(map);
  if (
    cached &&
    cached.tileCacheVersion === tileCacheVersion &&
    cached.tilesetCount === tilesetSheets.size
  ) {
    return cached.canvas;
  }

  const canvas = cached?.canvas ?? document.createElement('canvas');
  canvas.width = map.width * PMD_TILE_NATIVE_PX;
  canvas.height = map.height * PMD_TILE_NATIVE_PX;
  const tctx = canvas.getContext('2d')!;
  tctx.imageSmoothingEnabled = false;
  tctx.clearRect(0, 0, canvas.width, canvas.height);

  for (let y = 0; y < map.height; y++) {
    const row = map.tiles[y];
    if (!row) continue;
    const drawY = y * PMD_TILE_NATIVE_PX;
    for (let x = 0; x < map.width; x++) {
      const cell = row[x];
      if (!cell) continue;
      const drawX = x * PMD_TILE_NATIVE_PX;
      const sheet = tilesetSheets.get(normalizeTilesetId(cell.tilesetId));
      if (sheet) {
        drawTilesetChunk(tctx, sheet, cell.chunkIndex, drawX, drawY, PMD_TILE_NATIVE_PX);
      } else {
        tctx.fillStyle = '#1c2c44';
        tctx.fillRect(drawX, drawY, PMD_TILE_NATIVE_PX, PMD_TILE_NATIVE_PX);
      }
      drawSpecialTerrainOverlay(
        tctx,
        cell.terrainType,
        cell.tilesetId,
        drawX,
        drawY,
        PMD_TILE_NATIVE_PX
      );
    }
  }

  staticTileCanvasCache.set(map, {
    tileCacheVersion,
    tilesetCount: tilesetSheets.size,
    canvas,
  });
  return canvas;
}

function getCachedSeizeCoords(state: BattleRuntimeState): ReadonlySet<string> {
  const cached = seizeCoordsCache.get(state.map);
  if (cached && cached.tileCacheVersion === state.tileCacheVersion) {
    return cached.coords;
  }
  const coords = getSeizeObjectiveCoords(state);
  seizeCoordsCache.set(state.map, { tileCacheVersion: state.tileCacheVersion, coords });
  return coords;
}

export function renderBattleFrame(ctxObj: BattleControllerContext, now: number): void {
  const { state, dom, prepOverlay } = ctxObj;
  const { ctx } = dom;
  const { cameraX, cameraY, bufferWidth, bufferHeight } = state.cam;

  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = '#080e1c';
  ctx.fillRect(0, 0, bufferWidth, bufferHeight);

  const tileCanvas = getOrBuildStaticTileCanvas(state);
  const mapPxW = tileCanvas.width;
  const mapPxH = tileCanvas.height;
  const srcX = Math.max(0, cameraX);
  const srcY = Math.max(0, cameraY);
  const srcW = Math.min(mapPxW, cameraX + bufferWidth) - srcX;
  const srcH = Math.min(mapPxH, cameraY + bufferHeight) - srcY;
  if (srcW > 0 && srcH > 0) {
    ctx.drawImage(
      tileCanvas,
      srcX,
      srcY,
      srcW,
      srcH,
      srcX - cameraX,
      srcY - cameraY,
      srcW,
      srcH
    );
  }

  const startCol = Math.max(0, Math.floor(cameraX / PMD_TILE_NATIVE_PX) - 1);
  const endCol = Math.min(
    state.map.width - 1,
    Math.ceil((cameraX + bufferWidth) / PMD_TILE_NATIVE_PX) + 1
  );
  const startRow = Math.max(0, Math.floor(cameraY / PMD_TILE_NATIVE_PX) - 1);
  const endRow = Math.min(
    state.map.height - 1,
    Math.ceil((cameraY + bufferHeight) / PMD_TILE_NATIVE_PX) + 1
  );
  const visibleBounds = { startCol, endCol, startRow, endRow };

  if (state.currentDanger.combinedDangerTiles.size > 0) {
    const dangerPulse = getDangerAreaPulse(state, now);
    const { globalOnlyTiles, individualTiles, combinedBoundaryMask } = splitDangerZoneLayers(
      state.currentDanger
    );
    if (globalOnlyTiles.size > 0) {
      drawConnectedRangeZone(
        ctx,
        cameraX,
        cameraY,
        globalOnlyTiles,
        combinedBoundaryMask,
        {
          fillRgba: lerpRgba([176, 36, 148, 0.1], [220, 88, 188, 0.16], dangerPulse),
          outerBorderRgba: lerpRgba([216, 76, 180, 0.48], [244, 156, 218, 0.66], dangerPulse),
          innerGlowRgba: lerpRgba([196, 56, 164, 0.14], [236, 120, 204, 0.24], dangerPulse),
        },
        visibleBounds
      );
    }
    if (individualTiles.size > 0) {
      drawConnectedRangeZone(
        ctx,
        cameraX,
        cameraY,
        individualTiles,
        individualTiles,
        {
          fillRgba: lerpRgba([198, 40, 140, 0.14], [240, 100, 188, 0.22], dangerPulse),
          outerBorderRgba: lerpRgba([236, 84, 174, 0.62], [252, 176, 224, 0.8], dangerPulse),
          innerGlowRgba: lerpRgba([216, 60, 158, 0.2], [248, 136, 204, 0.32], dangerPulse),
        },
        visibleBounds
      );
    }
  }

  if (
    state.phase === 'dungeon_prep' &&
    !state.cutsceneInProgress &&
    state.deploymentSlots.length > 0
  ) {
    const pulse = getSelectionRangePulse(state, now);
    const deployTileSet = new Set<string>(
      state.deploymentSlots.map((slot) => coordKey(slot.x, slot.y))
    );
    drawConnectedRangeZone(
      ctx,
      cameraX,
      cameraY,
      deployTileSet,
      deployTileSet,
      {
        fillRgba: lerpRgba([24, 132, 240, 0.22], [116, 224, 255, 0.42], pulse),
        outerBorderRgba: lerpRgba([72, 192, 255, 0.92], [220, 252, 255, 1.0], pulse),
        innerGlowRgba: lerpRgba([48, 164, 248, 0.34], [164, 240, 255, 0.64], pulse),
      },
      visibleBounds
    );
    if (state.prepSwapSlotIndex !== null) {
      const selectedSlot = state.deploymentSlots.find(
        (s) => s.slotIndex === state.prepSwapSlotIndex
      );
      if (selectedSlot) {
        const sx = selectedSlot.x * PMD_TILE_NATIVE_PX - cameraX;
        const sy = selectedSlot.y * PMD_TILE_NATIVE_PX - cameraY;
        ctx.save();
        ctx.fillStyle = 'rgba(248, 208, 72, 0.26)';
        ctx.fillRect(sx + 1, sy + 1, PMD_TILE_NATIVE_PX - 2, PMD_TILE_NATIVE_PX - 2);
        ctx.strokeStyle = '#f8d048';
        ctx.lineWidth = 2;
        ctx.strokeRect(sx + 1, sy + 1, PMD_TILE_NATIVE_PX - 2, PMD_TILE_NATIVE_PX - 2);
        ctx.restore();
      }
    }
  }

  const canShowInspectedRange =
    !state.cutsceneInProgress &&
    state.interactionState === 'idle' &&
    (state.phase === 'player_phase' ||
      (state.phase === 'dungeon_prep' &&
        prepOverlay.isOpen() &&
        prepOverlay.getSubMode() === 'view_map' &&
        state.prepSwapSlotIndex === null));

  if (state.interactionState === 'unit_selected' || state.interactionState === 'walking') {
    if (state.currentRange) {
      drawUnitRangeEnvelope(
        ctx,
        cameraX,
        cameraY,
        state.currentRange,
        state.selectionPulseStartMs,
        now,
        visibleBounds,
        1
      );
    }
  } else if (canShowInspectedRange) {
    const inspectedRange = getActiveInspectedAllyRange(state);
    if (inspectedRange) {
      drawUnitRangeEnvelope(
        ctx,
        cameraX,
        cameraY,
        inspectedRange,
        state.selectionPulseStartMs,
        now,
        visibleBounds,
        1
      );
    } else if (state.hoveredPlayerRange) {
      drawUnitRangeEnvelope(
        ctx,
        cameraX,
        cameraY,
        state.hoveredPlayerRange,
        state.selectionPulseStartMs,
        now,
        visibleBounds,
        0.62
      );
    }
  }

  const seizeTiles = getCachedSeizeCoords(state);
  if (seizeTiles.size > 0) {
    const seizePulse =
      0.5 - 0.5 * Math.cos(((now % RANGE_PULSE_PERIOD_MS) / RANGE_PULSE_PERIOD_MS) * Math.PI * 2);
    drawConnectedRangeZone(
      ctx,
      cameraX,
      cameraY,
      seizeTiles,
      seizeTiles,
      {
        fillRgba: lerpRgba([28, 184, 96, 0.15], [132, 255, 188, 0.36], seizePulse),
        outerBorderRgba: lerpRgba([72, 228, 140, 0.88], [212, 255, 232, 1.0], seizePulse),
        innerGlowRgba: lerpRgba([48, 212, 120, 0.28], [168, 255, 208, 0.6], seizePulse),
      },
      visibleBounds
    );
  }

  if (
    state.previewPath &&
    state.previewPath.length > 1 &&
    state.interactionState === 'unit_selected'
  ) {
    ctx.save();
    ctx.strokeStyle = '#f8d048';
    ctx.lineWidth = 2;
    ctx.beginPath();
    state.previewPath.forEach((step, idx) => {
      const cx = step.x * PMD_TILE_NATIVE_PX - cameraX + PMD_TILE_NATIVE_PX / 2;
      const cy = step.y * PMD_TILE_NATIVE_PX - cameraY + PMD_TILE_NATIVE_PX / 2;
      if (idx === 0) ctx.moveTo(cx, cy);
      else ctx.lineTo(cx, cy);
    });
    ctx.stroke();

    const dest = state.previewPath[state.previewPath.length - 1]!;
    ctx.fillStyle = '#f8d048';
    ctx.fillRect(
      dest.x * PMD_TILE_NATIVE_PX - cameraX + 9,
      dest.y * PMD_TILE_NATIVE_PX - cameraY + 9,
      6,
      6
    );
    ctx.restore();
  }

  // At most one tile bracket on screen: hover if present, else the last-tapped tile on touch.
  // Bounces harder when that tile is an active selection (selected unit, inspected range,
  // or prep swap slot).
  const cursor = state.hoveredTile ?? (state.touchInspectedUnitId ? state.inspectedTile : null);
  if (cursor) {
    const selUnit = getSelectedUnit(state);
    const rngUnit = state.inspectedAllyRangeUnitId
      ? state.units.find((u) => u.id === state.inspectedAllyRangeUnitId)
      : null;
    const swapSlot =
      state.prepSwapSlotIndex !== null
        ? state.deploymentSlots.find((s) => s.slotIndex === state.prepSwapSlotIndex)
        : null;
    const isSelected = Boolean(
      (selUnit && selUnit.x === cursor.x && selUnit.y === cursor.y) ||
        (rngUnit && rngUnit.x === cursor.x && rngUnit.y === cursor.y) ||
        (swapSlot && swapSlot.x === cursor.x && swapSlot.y === cursor.y) ||
        state.touchInspectedUnitId
    );
    drawTileCursorBrackets(
      ctx,
      cursor.x * PMD_TILE_NATIVE_PX - cameraX,
      cursor.y * PMD_TILE_NATIVE_PX - cameraY,
      now,
      isSelected ? 'selected' : 'hover'
    );
  }

  renderUnitsAndStrikeVfx(ctx, state, dom, now);
  drawMapEdgeVignette(ctx, cameraX, cameraY, mapPxW, mapPxH);
  if (state.interactionState === 'combat_forecast') {
    drawForecastSpotlightDim(ctxObj, cameraX, cameraY, bufferWidth, bufferHeight);
  }
  syncFloatingCalloutDom(state, dom, now);
}

/** Dims the whole map except the forecast "stage" (participants' tiles plus a 1-tile border). */
function drawForecastSpotlightDim(
  ctxObj: BattleControllerContext,
  cameraX: number,
  cameraY: number,
  width: number,
  height: number
): void {
  const { state, dom } = ctxObj;
  const actor = getSelectedUnit(state);
  const target = state.units.find((u) => u.id === state.forecastTargetId);
  const participants = [actor, target].filter((u) => u !== undefined && u !== null);
  if (participants.length === 0) return;
  const stage = computeForecastStageBounds(participants);
  const T = PMD_TILE_NATIVE_PX;
  const { ctx } = dom;
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, width, height);
  ctx.rect(
    stage.minX * T - cameraX,
    stage.minY * T - cameraY,
    (stage.maxX - stage.minX + 1) * T,
    (stage.maxY - stage.minY + 1) * T
  );
  ctx.fillStyle = 'rgba(4, 10, 20, 0.65)';
  ctx.fill('evenodd');
  ctx.restore();
}

/**
 * Yellow corner brackets for the hovered tile (small, slow bounce) and the selected tile
 * (larger, faster bounce). Kept to integer native px so the pixel art stays crisp.
 */
function drawTileCursorBrackets(
  ctx: CanvasRenderingContext2D,
  tileX: number,
  tileY: number,
  now: number,
  mode: 'hover' | 'selected'
): void {
  const period = mode === 'selected' ? 480 : 900;
  const maxInset = mode === 'selected' ? 3 : 1;
  const wave = 0.5 - 0.5 * Math.cos(((now % period) / period) * Math.PI * 2);
  const inset = Math.round(wave * maxInset);
  const L = tileX + inset;
  const T = tileY + inset;
  const R = tileX + PMD_TILE_NATIVE_PX - inset;
  const B = tileY + PMD_TILE_NATIVE_PX - inset;
  ctx.save();
  ctx.globalAlpha = mode === 'selected' ? 1 : 0.78;
  ctx.fillStyle = '#f8d048';
  ctx.fillRect(L, T, 5, 2);
  ctx.fillRect(L, T, 2, 5);
  ctx.fillRect(R - 5, T, 5, 2);
  ctx.fillRect(R - 2, T, 2, 5);
  ctx.fillRect(L, B - 2, 5, 2);
  ctx.fillRect(L, B - 5, 2, 5);
  ctx.fillRect(R - 5, B - 2, 5, 2);
  ctx.fillRect(R - 2, B - 5, 2, 5);
  ctx.restore();
}
