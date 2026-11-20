/**
 * Support Conversation 7x5 Lush Prairie Camp Mini-Stage (`SupportMiniStage.ts`)
 *
 * Displays both speakers facing each other on a 7x5 tile (`168x120` native px)
 * grassy clearing from tileset `142` while a support conversation plays.
 */

import {
  computePmdTileSpritePlacement,
  directionFromDelta,
  drawSpriteAnimFrame,
  loadSpeciesSpriteBundle,
  resolveAnimFrameIndex,
  resolveUnitVisualAssetId,
  type LoadedSpriteBundle,
  type PmdDirection,
} from '../assets/pmdAssetLoader';
import {
  drawTilesetChunk,
  loadTilesetSheet,
  PMD_TILE_NATIVE_PX,
  type LoadedTilesetSheet,
} from '../assets/tilesetLoader';
import { getSpeciesById } from '../data/index';
import { resolveSpeakerIdentity } from '../engine/speakerResolver';
import type { OwnedPokemonInstance, SaveData } from '../types/schemas';
import type { DialogueScript, DialogueSide } from './DialogueOverlay';
import { createPmdWindow } from './PmdWindow';

const STAGE_COLS = 7;
const STAGE_ROWS = 5;
const NATIVE_WIDTH = STAGE_COLS * PMD_TILE_NATIVE_PX;
const NATIVE_HEIGHT = STAGE_ROWS * PMD_TILE_NATIVE_PX;
const HOP_DURATION_MS = 180;
const HOP_HEIGHT_PX = 4;

/** Validated Lush Prairie (`142`) chunks matching `paralogue_01` and `chapter_02`. */
const CAMP_CLEARING_CHUNKS: readonly (readonly number[])[] = [
  [2, 15, 2, 2, 2, 15, 2],
  [30, 74, 27, 60, 27, 74, 30],
  [30, 27, 27, 27, 27, 27, 30],
  [30, 97, 27, 74, 27, 60, 30],
  [12, 5, 5, 12, 5, 5, 12],
];

const SIDE_TILE_POS: Readonly<Record<DialogueSide, { x: number; y: number }>> = {
  left: { x: 2, y: 2 },
  right: { x: 4, y: 2 },
};

const SIDE_DIRECTIONS: Readonly<Record<DialogueSide, PmdDirection>> = {
  left: directionFromDelta(1, 0),
  right: directionFromDelta(-1, 0),
};

export interface SupportMiniStageOptions {
  subjectUnit: OwnedPokemonInstance;
  partnerUnit: OwnedPokemonInstance;
  script: DialogueScript;
  save: SaveData | null;
}

function doesIdentityMatchUnit(
  identity: ReturnType<typeof resolveSpeakerIdentity>,
  unit: OwnedPokemonInstance
): boolean {
  if (identity.instanceId && identity.instanceId === unit.instanceId) return true;
  const unitLineId = getSpeciesById(unit.speciesId)?.lineId;
  const idLineId = identity.speciesId ? getSpeciesById(identity.speciesId)?.lineId : undefined;
  if (unitLineId && idLineId && unitLineId === idLineId) return true;
  const unitVisual = resolveUnitVisualAssetId(unit.speciesId, unit.cosmeticForm);
  return identity.visualAssetId === unitVisual;
}

function resolveStageSideUnits(
  options: SupportMiniStageOptions
): Record<DialogueSide, OwnedPokemonInstance> {
  const { subjectUnit, partnerUnit, script, save } = options;
  for (const line of script.lines) {
    if (line.narrator) continue;
    const identity = resolveSpeakerIdentity(line.speaker, save);
    const matchesSubject = doesIdentityMatchUnit(identity, subjectUnit);
    const matchesPartner = doesIdentityMatchUnit(identity, partnerUnit);
    if (matchesSubject && !matchesPartner) {
      return line.side === 'left'
        ? { left: subjectUnit, right: partnerUnit }
        : { left: partnerUnit, right: subjectUnit };
    }
    if (matchesPartner && !matchesSubject) {
      return line.side === 'left'
        ? { left: partnerUnit, right: subjectUnit }
        : { left: subjectUnit, right: partnerUnit };
    }
  }
  return { left: subjectUnit, right: partnerUnit };
}

function buildStageBackgroundCanvas(sheet: LoadedTilesetSheet): HTMLCanvasElement {
  const offscreen = document.createElement('canvas');
  offscreen.width = NATIVE_WIDTH;
  offscreen.height = NATIVE_HEIGHT;
  const oCtx = offscreen.getContext('2d')!;
  oCtx.imageSmoothingEnabled = false;

  for (let ty = 0; ty < STAGE_ROWS; ty++) {
    const row = CAMP_CLEARING_CHUNKS[ty]!;
    const drawY = ty * PMD_TILE_NATIVE_PX;
    for (let tx = 0; tx < STAGE_COLS; tx++) {
      const chunkIdx = row[tx] ?? 27;
      drawTilesetChunk(oCtx, sheet, chunkIdx, tx * PMD_TILE_NATIVE_PX, drawY, PMD_TILE_NATIVE_PX);
    }
  }
  return offscreen;
}

export class SupportMiniStage {
  public readonly rootEl: HTMLElement;
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly sideAssetIds: Record<DialogueSide, string>;

  private bgCanvas: HTMLCanvasElement | null = null;
  private bundles: Record<DialogueSide, LoadedSpriteBundle | null> = {
    left: null,
    right: null,
  };
  private hopStartMs: Record<DialogueSide, number | null> = {
    left: null,
    right: null,
  };
  private rafId: number | null = null;
  private startTimeMs = 0;
  private destroyed = false;

  constructor(options: SupportMiniStageOptions) {
    const sideUnits = resolveStageSideUnits(options);
    this.sideAssetIds = {
      left: resolveUnitVisualAssetId(sideUnits.left.speciesId, sideUnits.left.cosmeticForm),
      right: resolveUnitVisualAssetId(sideUnits.right.speciesId, sideUnits.right.cosmeticForm),
    };

    this.rootEl = createPmdWindow({
      className: 'pmd-support-mini-stage',
      testId: 'support-mini-stage',
    });

    this.canvas = document.createElement('canvas');
    this.canvas.width = NATIVE_WIDTH;
    this.canvas.height = NATIVE_HEIGHT;
    this.canvas.className = 'pmd-support-mini-stage-canvas pmd-pixelated';
    this.canvas.dataset.testid = 'support-mini-stage-canvas';
    this.canvas.style.imageRendering = 'pixelated';

    const ctx = this.canvas.getContext('2d');
    if (!ctx) throw new Error('Could not initialize 2D context for SupportMiniStage.');
    this.ctx = ctx;
    this.ctx.imageSmoothingEnabled = false;
    this.rootEl.appendChild(this.canvas);
  }

  public start(): void {
    if (this.destroyed || this.rafId !== null) return;
    this.startTimeMs = performance.now();
    void this.preloadAssets();
    this.renderFrame(this.startTimeMs);
    this.scheduleNextFrame();
  }

  public hopSide(side: DialogueSide): void {
    if (this.destroyed) return;
    this.hopStartMs[side] = performance.now();
  }

  public destroy(): void {
    this.destroyed = true;
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.rootEl.remove();
  }

  private async preloadAssets(): Promise<void> {
    const [sheet, leftBundle, rightBundle] = await Promise.all([
      loadTilesetSheet('142'),
      loadSpeciesSpriteBundle(this.sideAssetIds.left),
      loadSpeciesSpriteBundle(this.sideAssetIds.right),
    ]);
    if (this.destroyed) return;
    this.bgCanvas = buildStageBackgroundCanvas(sheet);
    this.bundles.left = leftBundle;
    this.bundles.right = rightBundle;
  }

  private scheduleNextFrame(): void {
    if (this.destroyed) return;
    this.rafId = requestAnimationFrame((nowMs) => {
      this.rafId = null;
      if (this.destroyed) return;
      this.renderFrame(nowMs);
      this.scheduleNextFrame();
    });
  }

  private resolveHopOffsetY(side: DialogueSide, nowMs: number): number {
    const startMs = this.hopStartMs[side];
    if (startMs === null) return 0;
    const elapsed = nowMs - startMs;
    if (elapsed >= HOP_DURATION_MS) {
      this.hopStartMs[side] = null;
      return 0;
    }
    const progress = Math.max(0, Math.min(1, elapsed / HOP_DURATION_MS));
    return -Math.round(Math.sin(progress * Math.PI) * HOP_HEIGHT_PX);
  }

  private renderFrame(nowMs: number): void {
    const ctx = this.ctx;
    ctx.imageSmoothingEnabled = false;
    if (this.bgCanvas) {
      ctx.drawImage(this.bgCanvas, 0, 0);
    } else {
      ctx.fillStyle = '#204828';
      ctx.fillRect(0, 0, NATIVE_WIDTH, NATIVE_HEIGHT);
    }

    const animElapsedMs = Math.max(0, nowMs - this.startTimeMs);
    for (const side of ['left', 'right'] as const) {
      const bundle = this.bundles[side];
      const anim = bundle?.actions.Idle;
      const tile = SIDE_TILE_POS[side];
      const placement = computePmdTileSpritePlacement(
        tile.x * PMD_TILE_NATIVE_PX,
        tile.y * PMD_TILE_NATIVE_PX,
        anim?.frameWidth ?? PMD_TILE_NATIVE_PX,
        anim?.frameHeight ?? PMD_TILE_NATIVE_PX,
        PMD_TILE_NATIVE_PX
      );

      const shadowRadiusX = (bundle?.shadowSize ?? 1) >= 2 ? 9 : 6;
      ctx.fillStyle = 'rgba(6, 10, 22, 0.48)';
      ctx.beginPath();
      ctx.ellipse(placement.shadowCenterX, placement.shadowCenterY, shadowRadiusX, 3, 0, 0, Math.PI * 2);
      ctx.fill();

      if (!anim) continue;
      const hopOffsetY = this.resolveHopOffsetY(side, nowMs);
      const frameIdx = resolveAnimFrameIndex(anim, animElapsedMs);
      drawSpriteAnimFrame(
        ctx,
        anim,
        frameIdx,
        SIDE_DIRECTIONS[side],
        placement.drawX,
        placement.drawY + hopOffsetY
      );
    }
  }
}
