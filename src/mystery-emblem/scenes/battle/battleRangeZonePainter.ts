/**
 * Connected Range-Zone Borders, Pulsing Alpha Interpolation & Ground Shadow Painter
 */

import { PMD_TILE_NATIVE_PX } from '../../assets/tilesetLoader';
import type { BattleUnitState } from '../../engine/combatEngine';
import { coordKey, parseCoordKey } from '../../engine/terrainAndPathfinding';
import { RANGE_PULSE_PERIOD_MS, type BattleRuntimeState } from './battleTypesAndState';

type RgbaTuple = readonly [number, number, number, number];

function lerpChannel(a: number, b: number, t: number): number {
  return Math.round(a + (b - a) * t);
}

export function lerpRgba(from: RgbaTuple, to: RgbaTuple, t: number): string {
  const alpha = (from[3] + (to[3] - from[3]) * t).toFixed(3);
  return `rgba(${lerpChannel(from[0], to[0], t)}, ${lerpChannel(from[1], to[1], t)}, ${lerpChannel(from[2], to[2], t)}, ${alpha})`;
}

export function getSelectionRangePulse(state: BattleRuntimeState, now: number): number {
  const elapsed = Math.max(0, now - state.selectionPulseStartMs);
  const phase = ((elapsed % RANGE_PULSE_PERIOD_MS) / RANGE_PULSE_PERIOD_MS) * Math.PI * 2;
  return 0.5 - 0.5 * Math.cos(phase);
}

export function drawConnectedRangeZone(
  ctx: CanvasRenderingContext2D,
  cameraX: number,
  cameraY: number,
  zoneTiles: ReadonlySet<string>,
  boundaryMask: ReadonlySet<string>,
  style: {
    fillRgba: string;
    outerBorderRgba: string;
    innerGlowRgba: string;
  },
  bounds: {
    startCol: number;
    endCol: number;
    startRow: number;
    endRow: number;
  }
): void {
  if (zoneTiles.size === 0) return;
  const S = PMD_TILE_NATIVE_PX;
  const { startCol, endCol, startRow, endRow } = bounds;

  ctx.fillStyle = style.fillRgba;
  for (const key of zoneTiles) {
    const { x, y } = parseCoordKey(key);
    if (x < startCol || x > endCol || y < startRow || y > endRow) continue;
    ctx.fillRect(x * S - cameraX, y * S - cameraY, S, S);
  }

  ctx.fillStyle = style.innerGlowRgba;
  for (const key of zoneTiles) {
    const { x, y } = parseCoordKey(key);
    if (x < startCol || x > endCol || y < startRow || y > endRow) continue;
    const drawX = x * S - cameraX;
    const drawY = y * S - cameraY;

    const hasN = boundaryMask.has(coordKey(x, y - 1));
    const hasS = boundaryMask.has(coordKey(x, y + 1));
    const hasW = boundaryMask.has(coordKey(x - 1, y));
    const hasE = boundaryMask.has(coordKey(x + 1, y));

    const x0 = !hasW ? 1 : 0;
    const x1 = !hasE ? S - 1 : S;
    if (!hasN && x1 > x0) ctx.fillRect(drawX + x0, drawY + 1, x1 - x0, 1);
    if (!hasS && x1 > x0) ctx.fillRect(drawX + x0, drawY + S - 2, x1 - x0, 1);

    const y0 = !hasN ? 2 : 0;
    const y1 = !hasS ? S - 2 : S;
    if (!hasW && y1 > y0) ctx.fillRect(drawX + 1, drawY + y0, 1, y1 - y0);
    if (!hasE && y1 > y0) ctx.fillRect(drawX + S - 2, drawY + y0, 1, y1 - y0);

    if (hasN && hasW && !boundaryMask.has(coordKey(x - 1, y - 1))) {
      ctx.fillRect(drawX + 1, drawY, 1, 2);
      ctx.fillRect(drawX, drawY + 1, 1, 1);
    }
    if (hasN && hasE && !boundaryMask.has(coordKey(x + 1, y - 1))) {
      ctx.fillRect(drawX + S - 2, drawY, 1, 2);
      ctx.fillRect(drawX + S - 1, drawY + 1, 1, 1);
    }
    if (hasS && hasW && !boundaryMask.has(coordKey(x - 1, y + 1))) {
      ctx.fillRect(drawX + 1, drawY + S - 2, 1, 2);
      ctx.fillRect(drawX, drawY + S - 2, 1, 1);
    }
    if (hasS && hasE && !boundaryMask.has(coordKey(x + 1, y + 1))) {
      ctx.fillRect(drawX + S - 2, drawY + S - 2, 1, 2);
      ctx.fillRect(drawX + S - 1, drawY + S - 2, 1, 1);
    }
  }

  ctx.fillStyle = style.outerBorderRgba;
  for (const key of zoneTiles) {
    const { x, y } = parseCoordKey(key);
    if (x < startCol || x > endCol || y < startRow || y > endRow) continue;
    const drawX = x * S - cameraX;
    const drawY = y * S - cameraY;

    const hasN = boundaryMask.has(coordKey(x, y - 1));
    const hasS = boundaryMask.has(coordKey(x, y + 1));
    const hasW = boundaryMask.has(coordKey(x - 1, y));
    const hasE = boundaryMask.has(coordKey(x + 1, y));

    if (!hasN) ctx.fillRect(drawX, drawY, S, 1);
    if (!hasS) ctx.fillRect(drawX, drawY + S - 1, S, 1);

    const oy0 = !hasN ? 1 : 0;
    const oy1 = !hasS ? S - 1 : S;
    if (!hasW && oy1 > oy0) ctx.fillRect(drawX, drawY + oy0, 1, oy1 - oy0);
    if (!hasE && oy1 > oy0) ctx.fillRect(drawX + S - 1, drawY + oy0, 1, oy1 - oy0);

    if (hasN && hasW && !boundaryMask.has(coordKey(x - 1, y - 1))) {
      ctx.fillRect(drawX, drawY, 1, 1);
    }
    if (hasN && hasE && !boundaryMask.has(coordKey(x + 1, y - 1))) {
      ctx.fillRect(drawX + S - 1, drawY, 1, 1);
    }
    if (hasS && hasW && !boundaryMask.has(coordKey(x - 1, y + 1))) {
      ctx.fillRect(drawX, drawY + S - 1, 1, 1);
    }
    if (hasS && hasE && !boundaryMask.has(coordKey(x + 1, y + 1))) {
      ctx.fillRect(drawX + S - 1, drawY + S - 1, 1, 1);
    }
  }
}

export function drawUnitGroundShadow(
  ctx: CanvasRenderingContext2D,
  state: BattleRuntimeState,
  cx: number,
  cy: number,
  shadowSize: number,
  unit: BattleUnitState
): void {
  const halfW = shadowSize <= 0 ? 5 : shadowSize === 1 ? 6 : 8;
  const innerSpan = (halfW - 2) * 2;

  ctx.fillStyle = 'rgba(6, 12, 24, 0.42)';
  ctx.fillRect(cx - halfW + 2, cy - 1, innerSpan, 3);

  ctx.fillStyle =
    unit.faction === 'player'
      ? unit.waited
        ? 'rgba(136, 152, 176, 0.50)'
        : 'rgba(72, 204, 255, 0.85)'
      : unit.faction === 'npc'
        ? unit.waited
          ? 'rgba(116, 168, 140, 0.52)'
          : 'rgba(88, 240, 152, 0.88)'
        : state.trackedEnemyIds.has(unit.id) || state.lastComputedHoverEnemyId === unit.id
          ? 'rgba(255, 112, 196, 0.90)'
          : 'rgba(248, 84, 92, 0.85)';

  ctx.fillRect(cx - halfW + 2, cy - 2, innerSpan, 1);
  ctx.fillRect(cx - halfW + 2, cy + 2, innerSpan, 1);
  ctx.fillRect(cx - halfW, cy - 1, 2, 3);
  ctx.fillRect(cx + halfW - 2, cy - 1, 2, 3);
}
