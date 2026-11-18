/**
 * Connected Range-Zone Borders, Pulsing Alpha Interpolation & Ground Shadow Painter
 */

import { PMD_TILE_NATIVE_PX } from '../../assets/tilesetLoader';
import type { BattleUnitState } from '../../engine/combatEngine';
import {
  parseCoordKey,
  type DangerAreaResult,
  type MovementRangeResult,
} from '../../engine/terrainAndPathfinding';
import { RANGE_PULSE_PERIOD_MS, type BattleRuntimeState } from './battleTypesAndState';

export const ALTERNATING_RANGE_HALF_PERIOD_MS = RANGE_PULSE_PERIOD_MS;

type RgbaTuple = readonly [number, number, number, number];

function scaleRgbaTuple(tuple: RgbaTuple, alphaScale: number): RgbaTuple {
  return [tuple[0], tuple[1], tuple[2], tuple[3] * alphaScale];
}

function lerpChannel(a: number, b: number, t: number): number {
  return Math.round(a + (b - a) * t);
}

export function lerpRgba(from: RgbaTuple, to: RgbaTuple, t: number): string {
  const alpha = (from[3] + (to[3] - from[3]) * t).toFixed(3);
  return `rgba(${lerpChannel(from[0], to[0], t)}, ${lerpChannel(from[1], to[1], t)}, ${lerpChannel(from[2], to[2], t)}, ${alpha})`;
}

export function getSelectionRangePulse(
  state: Pick<BattleRuntimeState, 'selectionPulseStartMs'>,
  now: number
): number {
  const elapsed = Math.max(0, now - state.selectionPulseStartMs);
  const phase = ((elapsed % RANGE_PULSE_PERIOD_MS) / RANGE_PULSE_PERIOD_MS) * Math.PI * 2;
  return 0.5 - 0.5 * Math.cos(phase);
}

export function getDangerAreaPulse(
  state: Pick<BattleRuntimeState, 'selectionPulseStartMs'>,
  now: number
): number {
  return 1 - getSelectionRangePulse(state, now);
}

export function resolveAlternatingSupportAttackBeat(
  pulseStartMs: number,
  now: number
): { activeKind: 'attack' | 'support'; pulse: number } {
  const elapsed = Math.max(0, now - pulseStartMs);
  const fullPeriod = ALTERNATING_RANGE_HALF_PERIOD_MS * 2;
  const activeKind = elapsed % fullPeriod < ALTERNATING_RANGE_HALF_PERIOD_MS ? 'attack' : 'support';
  const pulse = getSelectionRangePulse({ selectionPulseStartMs: pulseStartMs }, now);
  return { activeKind, pulse };
}

export function splitDangerZoneLayers(danger: DangerAreaResult): {
  globalOnlyTiles: Set<string>;
  individualTiles: ReadonlySet<string>;
  combinedBoundaryMask: ReadonlySet<string>;
} {
  const globalOnlyTiles = new Set<string>();
  for (const key of danger.globalDangerTiles) {
    if (!danger.individualDangerTiles.has(key)) {
      globalOnlyTiles.add(key);
    }
  }
  return {
    globalOnlyTiles,
    individualTiles: danger.individualDangerTiles,
    combinedBoundaryMask: danger.combinedDangerTiles,
  };
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
  const { startCol, endCol, startRow, endRow } = bounds;
  if (endCol < startCol || endRow < startRow) return;

  const S = PMD_TILE_NATIVE_PX;
  const ox = startCol - 1;
  const oy = startRow - 1;
  const maxX = endCol + 1;
  const maxY = endRow + 1;
  const maskW = maxX - ox + 1;
  const maskH = maxY - oy + 1;
  const grid = new Uint8Array(maskW * maskH);

  for (const key of boundaryMask) {
    const { x, y } = parseCoordKey(key);
    if (x >= ox && x <= maxX && y >= oy && y <= maxY) {
      grid[(y - oy) * maskW + (x - ox)] = 1;
    }
  }

  const visX: number[] = [];
  const visY: number[] = [];
  const visNb: number[] = [];

  for (const key of zoneTiles) {
    const { x, y } = parseCoordKey(key);
    if (x < startCol || x > endCol || y < startRow || y > endRow) continue;
    const gx = x - ox;
    const gy = y - oy;
    const rowCur = gy * maskW;
    const rowN = rowCur - maskW;
    const rowS = rowCur + maskW;
    let nb = 0;
    if (grid[rowN + gx]) nb |= 1; // N
    if (grid[rowS + gx]) nb |= 2; // S
    if (grid[rowCur + gx - 1]) nb |= 4; // W
    if (grid[rowCur + gx + 1]) nb |= 8; // E
    if (grid[rowN + gx - 1]) nb |= 16; // NW
    if (grid[rowN + gx + 1]) nb |= 32; // NE
    if (grid[rowS + gx - 1]) nb |= 64; // SW
    if (grid[rowS + gx + 1]) nb |= 128; // SE
    visX.push(x);
    visY.push(y);
    visNb.push(nb);
  }

  const count = visX.length;
  if (count === 0) return;

  ctx.fillStyle = style.fillRgba;
  for (let i = 0; i < count; i++) {
    ctx.fillRect(visX[i]! * S - cameraX, visY[i]! * S - cameraY, S, S);
  }

  ctx.fillStyle = style.innerGlowRgba;
  for (let i = 0; i < count; i++) {
    const drawX = visX[i]! * S - cameraX;
    const drawY = visY[i]! * S - cameraY;
    const nb = visNb[i]!;
    const hasN = (nb & 1) !== 0;
    const hasS = (nb & 2) !== 0;
    const hasW = (nb & 4) !== 0;
    const hasE = (nb & 8) !== 0;

    const x0 = !hasW ? 1 : 0;
    const x1 = !hasE ? S - 1 : S;
    if (!hasN && x1 > x0) ctx.fillRect(drawX + x0, drawY + 1, x1 - x0, 1);
    if (!hasS && x1 > x0) ctx.fillRect(drawX + x0, drawY + S - 2, x1 - x0, 1);

    const y0 = !hasN ? 2 : 0;
    const y1 = !hasS ? S - 2 : S;
    if (!hasW && y1 > y0) ctx.fillRect(drawX + 1, drawY + y0, 1, y1 - y0);
    if (!hasE && y1 > y0) ctx.fillRect(drawX + S - 2, drawY + y0, 1, y1 - y0);

    if (hasN && hasW && (nb & 16) === 0) {
      ctx.fillRect(drawX + 1, drawY, 1, 2);
      ctx.fillRect(drawX, drawY + 1, 1, 1);
    }
    if (hasN && hasE && (nb & 32) === 0) {
      ctx.fillRect(drawX + S - 2, drawY, 1, 2);
      ctx.fillRect(drawX + S - 1, drawY + 1, 1, 1);
    }
    if (hasS && hasW && (nb & 64) === 0) {
      ctx.fillRect(drawX + 1, drawY + S - 2, 1, 2);
      ctx.fillRect(drawX, drawY + S - 2, 1, 1);
    }
    if (hasS && hasE && (nb & 128) === 0) {
      ctx.fillRect(drawX + S - 2, drawY + S - 2, 1, 2);
      ctx.fillRect(drawX + S - 1, drawY + S - 2, 1, 1);
    }
  }

  ctx.fillStyle = style.outerBorderRgba;
  for (let i = 0; i < count; i++) {
    const drawX = visX[i]! * S - cameraX;
    const drawY = visY[i]! * S - cameraY;
    const nb = visNb[i]!;
    const hasN = (nb & 1) !== 0;
    const hasS = (nb & 2) !== 0;
    const hasW = (nb & 4) !== 0;
    const hasE = (nb & 8) !== 0;

    if (!hasN) ctx.fillRect(drawX, drawY, S, 1);
    if (!hasS) ctx.fillRect(drawX, drawY + S - 1, S, 1);

    const oy0 = !hasN ? 1 : 0;
    const oy1 = !hasS ? S - 1 : S;
    if (!hasW && oy1 > oy0) ctx.fillRect(drawX, drawY + oy0, 1, oy1 - oy0);
    if (!hasE && oy1 > oy0) ctx.fillRect(drawX + S - 1, drawY + oy0, 1, oy1 - oy0);

    if (hasN && hasW && (nb & 16) === 0) ctx.fillRect(drawX, drawY, 1, 1);
    if (hasN && hasE && (nb & 32) === 0) ctx.fillRect(drawX + S - 1, drawY, 1, 1);
    if (hasS && hasW && (nb & 64) === 0) ctx.fillRect(drawX, drawY + S - 1, 1, 1);
    if (hasS && hasE && (nb & 128) === 0) ctx.fillRect(drawX + S - 1, drawY + S - 1, 1, 1);
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

const rangeZoneSetsCache = new WeakMap<
  MovementRangeResult,
  {
    blueMoveSet: Set<string>;
    attackUnion: Set<string>;
    supportUnion: Set<string>;
  }
>();

function getRangeZoneSets(range: MovementRangeResult) {
  let cached = rangeZoneSetsCache.get(range);
  if (cached) return cached;
  const blueMoveSet = new Set<string>(range.traversedCosts.keys());
  const attackUnion = new Set<string>(blueMoveSet);
  for (const key of range.attackBorderTiles) attackUnion.add(key);
  const supportUnion = new Set<string>(blueMoveSet);
  for (const key of range.supportBorderTiles) supportUnion.add(key);
  cached = { blueMoveSet, attackUnion, supportUnion };
  rangeZoneSetsCache.set(range, cached);
  return cached;
}

export function drawUnitRangeEnvelope(
  ctx: CanvasRenderingContext2D,
  cameraX: number,
  cameraY: number,
  range: MovementRangeResult,
  pulseStartMs: number,
  now: number,
  bounds: {
    startCol: number;
    endCol: number;
    startRow: number;
    endRow: number;
  },
  alphaScale = 1
): void {
  const { blueMoveSet, attackUnion, supportUnion } = getRangeZoneSets(range);
  const movePulse = getSelectionRangePulse({ selectionPulseStartMs: pulseStartMs }, now);
  const hasAttack = range.attackBorderTiles.size > 0;
  const hasSupport = range.supportBorderTiles.size > 0;

  let activeBorderKind: 'attack' | 'support' | null = null;
  if (hasAttack && hasSupport) {
    activeBorderKind = resolveAlternatingSupportAttackBeat(pulseStartMs, now).activeKind;
  } else if (hasSupport) {
    activeBorderKind = 'support';
  } else if (hasAttack) {
    activeBorderKind = 'attack';
  }

  if (activeBorderKind === 'support') {
    drawConnectedRangeZone(
      ctx,
      cameraX,
      cameraY,
      range.supportBorderTiles,
      supportUnion,
      {
        fillRgba: lerpRgba(
          scaleRgbaTuple([28, 184, 96, 0.15], alphaScale),
          scaleRgbaTuple([132, 255, 188, 0.36], alphaScale),
          movePulse
        ),
        outerBorderRgba: lerpRgba(
          scaleRgbaTuple([72, 228, 140, 0.88], alphaScale),
          scaleRgbaTuple([212, 255, 232, 1.0], alphaScale),
          movePulse
        ),
        innerGlowRgba: lerpRgba(
          scaleRgbaTuple([48, 212, 120, 0.28], alphaScale),
          scaleRgbaTuple([168, 255, 208, 0.6], alphaScale),
          movePulse
        ),
      },
      bounds
    );
  } else if (activeBorderKind === 'attack') {
    drawConnectedRangeZone(
      ctx,
      cameraX,
      cameraY,
      range.attackBorderTiles,
      attackUnion,
      {
        fillRgba: lerpRgba(
          scaleRgbaTuple([212, 36, 56, 0.16], alphaScale),
          scaleRgbaTuple([255, 132, 144, 0.38], alphaScale),
          movePulse
        ),
        outerBorderRgba: lerpRgba(
          scaleRgbaTuple([244, 80, 96, 0.88], alphaScale),
          scaleRgbaTuple([255, 208, 214, 1.0], alphaScale),
          movePulse
        ),
        innerGlowRgba: lerpRgba(
          scaleRgbaTuple([232, 56, 76, 0.3], alphaScale),
          scaleRgbaTuple([255, 168, 178, 0.62], alphaScale),
          movePulse
        ),
      },
      bounds
    );
  }

  drawConnectedRangeZone(
    ctx,
    cameraX,
    cameraY,
    blueMoveSet,
    blueMoveSet,
    {
      fillRgba: lerpRgba(
        scaleRgbaTuple([24, 128, 236, 0.16], alphaScale),
        scaleRgbaTuple([132, 232, 255, 0.38], alphaScale),
        movePulse
      ),
      outerBorderRgba: lerpRgba(
        scaleRgbaTuple([64, 184, 252, 0.88], alphaScale),
        scaleRgbaTuple([216, 252, 255, 1.0], alphaScale),
        movePulse
      ),
      innerGlowRgba: lerpRgba(
        scaleRgbaTuple([44, 156, 248, 0.3], alphaScale),
        scaleRgbaTuple([164, 242, 255, 0.62], alphaScale),
        movePulse
      ),
    },
    bounds
  );
}
