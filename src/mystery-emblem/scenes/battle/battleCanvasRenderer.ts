/**
 * 1x Native Pixel Buffer Dungeon Tile & Tactical Overlay Renderer (`BattleScene`)
 */

import {
  PMD_TILE_NATIVE_PX,
  drawSpecialTerrainOverlay,
  drawTilesetChunk,
  normalizeTilesetId,
} from '../../assets/tilesetLoader';
import type { TutorialBattleTileFilter } from '../../data/tutorialRegistry';
import { coordKey } from '../../engine/terrainAndPathfinding';
import { syncFloatingCalloutDom } from './battleFloatingCallouts';
import {
  drawConnectedRangeZone,
  drawUnitRangeEnvelope,
  getDangerAreaPulse,
  getSelectionRangePulse,
  lerpRgba,
  splitDangerZoneLayers,
} from './battleRangeZonePainter';
import { resolveTutorialSpotlightTiles } from './battleTutorialIntegration';
import { RANGE_PULSE_PERIOD_MS, type BattleControllerContext } from './battleTypesAndState';
import { getActiveInspectedAllyRange, getSeizeObjectiveCoords } from './battleUnitQueries';
import { renderUnitsAndStrikeVfx } from './battleUnitSpriteRenderer';

export function renderBattleFrame(ctxObj: BattleControllerContext, now: number): void {
  const { state, dom, prepOverlay, tutorialOverlay } = ctxObj;
  const { ctx } = dom;
  const { cameraX, cameraY, bufferWidth, bufferHeight } = state.cam;

  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = '#080e1c';
  ctx.fillRect(0, 0, bufferWidth, bufferHeight);

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

  for (let y = startRow; y <= endRow; y++) {
    const row = state.map.tiles[y];
    if (!row) continue;
    const drawY = y * PMD_TILE_NATIVE_PX - cameraY;
    for (let x = startCol; x <= endCol; x++) {
      const cell = row[x];
      if (!cell) continue;
      const drawX = x * PMD_TILE_NATIVE_PX - cameraX;
      const sheet = state.tilesetSheets.get(normalizeTilesetId(cell.tilesetId));
      if (sheet) {
        drawTilesetChunk(ctx, sheet, cell.chunkIndex, drawX, drawY, PMD_TILE_NATIVE_PX);
      } else {
        ctx.fillStyle = '#1c2c44';
        ctx.fillRect(drawX, drawY, PMD_TILE_NATIVE_PX, PMD_TILE_NATIVE_PX);
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
  const activeRange =
    state.interactionState === 'unit_selected' || state.interactionState === 'walking'
      ? state.currentRange
      : canShowInspectedRange
        ? getActiveInspectedAllyRange(state)
        : null;
  if (activeRange) {
    drawUnitRangeEnvelope(
      ctx,
      cameraX,
      cameraY,
      activeRange,
      state.selectionPulseStartMs,
      now,
      visibleBounds
    );
  }

  const seizeTiles = getSeizeObjectiveCoords(state);
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

  const cursorX = state.inspectedTile.x * PMD_TILE_NATIVE_PX - cameraX;
  const cursorY = state.inspectedTile.y * PMD_TILE_NATIVE_PX - cameraY;
  ctx.fillStyle = '#f8d048';
  ctx.fillRect(cursorX, cursorY, 5, 2);
  ctx.fillRect(cursorX, cursorY, 2, 5);
  ctx.fillRect(cursorX + PMD_TILE_NATIVE_PX - 5, cursorY, 5, 2);
  ctx.fillRect(cursorX + PMD_TILE_NATIVE_PX - 2, cursorY, 2, 5);
  ctx.fillRect(cursorX, cursorY + PMD_TILE_NATIVE_PX - 2, 5, 2);
  ctx.fillRect(cursorX, cursorY + PMD_TILE_NATIVE_PX - 5, 2, 5);
  ctx.fillRect(cursorX + PMD_TILE_NATIVE_PX - 5, cursorY + PMD_TILE_NATIVE_PX - 2, 5, 2);
  ctx.fillRect(cursorX + PMD_TILE_NATIVE_PX - 2, cursorY + PMD_TILE_NATIVE_PX - 5, 2, 5);

  const activeFilter: TutorialBattleTileFilter | null =
    tutorialOverlay?.getActiveTileFilter() ?? null;
  if (activeFilter) {
    const spotTiles = resolveTutorialSpotlightTiles(state, prepOverlay, activeFilter);
    if (spotTiles.length > 0) {
      const spotPulse = 0.5 - 0.5 * Math.cos(((now % 900) / 900) * Math.PI * 2);
      ctx.save();
      for (const pt of spotTiles) {
        if (pt.x < startCol || pt.x > endCol || pt.y < startRow || pt.y > endRow) continue;
        const sx = pt.x * PMD_TILE_NATIVE_PX - cameraX;
        const sy = pt.y * PMD_TILE_NATIVE_PX - cameraY;
        ctx.fillStyle = lerpRgba([248, 248, 88, 0.14], [255, 255, 160, 0.36], spotPulse);
        ctx.fillRect(sx + 1, sy + 1, PMD_TILE_NATIVE_PX - 2, PMD_TILE_NATIVE_PX - 2);
        ctx.strokeStyle = '#050a14';
        ctx.lineWidth = 1;
        ctx.strokeRect(sx + 0.5, sy + 0.5, PMD_TILE_NATIVE_PX - 1, PMD_TILE_NATIVE_PX - 1);
        ctx.strokeStyle = spotPulse > 0.5 ? '#ffffff' : '#f8f858';
        ctx.strokeRect(sx + 1.5, sy + 1.5, PMD_TILE_NATIVE_PX - 3, PMD_TILE_NATIVE_PX - 3);
      }
      ctx.restore();
    }
  }

  renderUnitsAndStrikeVfx(ctx, state, dom, now);
  syncFloatingCalloutDom(state, dom, now);
}
