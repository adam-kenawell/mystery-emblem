/**
 * Y-Sorted PMD Unit Sprites, Waited/Hit-Flash Tints, Micro HP Bars & Strike VFX Renderer
 */

import { computePmdTileSpritePlacement } from '../../assets/pmdAssetLoader';
import { PMD_TILE_NATIVE_PX } from '../../assets/tilesetLoader';
import { getAvailableTalkTargetIds } from '../../engine/battleEvents';
import { STATUS_BADGE_COLORS } from '../../engine/combatEngine';
import type { BattleDomRefs } from './battleDomShell';
import { drawUnitGroundShadow } from './battleRangeZonePainter';
import type { BattleRuntimeState } from './battleTypesAndState';
import { getRenderableUnits, getUnitVisualKey } from './battleUnitQueries';

export function renderUnitsAndStrikeVfx(
  ctx: CanvasRenderingContext2D,
  state: BattleRuntimeState,
  dom: BattleDomRefs,
  now: number
): void {
  const { cameraX, cameraY } = state.cam;
  const talkTargetIds =
    state.phase === 'player_phase' && state.events.length > 0
      ? getAvailableTalkTargetIds(state.events, state.triggeredEventIds, state.units)
      : null;
  const sortedUnits = [...getRenderableUnits(state)].sort(
    (a, b) => a.renderWorldY - b.renderWorldY || a.renderWorldX - b.renderWorldX
  );

  for (const unit of sortedUnits) {
    const tileScreenX = unit.renderWorldX - cameraX;
    const tileScreenY = unit.renderWorldY - cameraY;
    const bundle = state.spriteBundles.get(getUnitVisualKey(unit));
    const anim = bundle ? (bundle.actions[unit.action] ?? bundle.actions.Idle) : undefined;
    const placement = computePmdTileSpritePlacement(
      tileScreenX,
      tileScreenY,
      anim?.frameWidth ?? PMD_TILE_NATIVE_PX,
      anim?.frameHeight ?? PMD_TILE_NATIVE_PX,
      PMD_TILE_NATIVE_PX
    );

    ctx.save();
    if (unit.koDissolveProgress > 0) {
      ctx.globalAlpha = Math.max(0.05, 1 - unit.koDissolveProgress);
    }

    drawUnitGroundShadow(
      ctx,
      state,
      placement.shadowCenterX,
      placement.shadowCenterY,
      bundle?.shadowSize ?? 1,
      unit
    );

    if (bundle && anim) {
      const frameIdx = unit.frameIndex % Math.max(1, anim.frameCount);
      const rowIdx = anim.rowCount >= 8 ? unit.direction : unit.direction % anim.rowCount;
      const { drawX, drawY } = placement;
      const isHitFlashing = now < unit.hitFlashUntilMs;

      if (isHitFlashing || unit.waited) {
        if (
          dom.tintScratchCanvas.width < anim.frameWidth ||
          dom.tintScratchCanvas.height < anim.frameHeight
        ) {
          dom.tintScratchCanvas.width = anim.frameWidth;
          dom.tintScratchCanvas.height = anim.frameHeight;
        }
        dom.tintScratchCtx.clearRect(0, 0, anim.frameWidth, anim.frameHeight);
        dom.tintScratchCtx.imageSmoothingEnabled = false;
        dom.tintScratchCtx.globalCompositeOperation = 'source-over';
        dom.tintScratchCtx.drawImage(
          anim.source,
          frameIdx * anim.frameWidth,
          rowIdx * anim.frameHeight,
          anim.frameWidth,
          anim.frameHeight,
          0,
          0,
          anim.frameWidth,
          anim.frameHeight
        );
        dom.tintScratchCtx.globalCompositeOperation = 'source-atop';
        dom.tintScratchCtx.fillStyle = isHitFlashing
          ? 'rgba(255, 232, 236, 0.72)'
          : 'rgba(18, 26, 44, 0.56)';
        dom.tintScratchCtx.fillRect(0, 0, anim.frameWidth, anim.frameHeight);
        dom.tintScratchCtx.globalCompositeOperation = 'source-over';

        ctx.drawImage(
          dom.tintScratchCanvas,
          0,
          0,
          anim.frameWidth,
          anim.frameHeight,
          drawX,
          drawY,
          anim.frameWidth,
          anim.frameHeight
        );
      } else {
        ctx.drawImage(
          anim.source,
          frameIdx * anim.frameWidth,
          rowIdx * anim.frameHeight,
          anim.frameWidth,
          anim.frameHeight,
          drawX,
          drawY,
          anim.frameWidth,
          anim.frameHeight
        );
      }
    }

    if (unit.koDissolveProgress === 0) {
      const barX = Math.round(tileScreenX + 3);
      const barY = Math.round(tileScreenY + PMD_TILE_NATIVE_PX - 3);
      const hpRatio = Math.max(0, Math.min(1, unit.currentHp / Math.max(1, unit.maxHp)));
      const fillW = Math.round(16 * hpRatio);

      ctx.fillStyle = 'rgba(4, 8, 18, 0.92)';
      ctx.fillRect(barX, barY, 18, 3);
      if (unit.status) {
        ctx.fillStyle = '#081020';
        ctx.fillRect(barX, barY - 4, 6, 4);
        ctx.fillStyle = STATUS_BADGE_COLORS[unit.status];
        ctx.fillRect(barX + 1, barY - 3, 4, 2);
      }
      if (fillW > 0) {
        ctx.fillStyle =
          unit.faction === 'enemy'
            ? '#ff5c6c'
            : unit.faction === 'npc'
              ? '#48e898'
              : hpRatio > 0.5
                ? '#58e890'
                : hpRatio > 0.25
                  ? '#f8d048'
                  : '#ff5464';
        ctx.fillRect(barX + 1, barY + 1, fillW, 1);
      }

      if (talkTargetIds?.has(unit.id)) {
        const tx = Math.round(tileScreenX + PMD_TILE_NATIVE_PX - 8);
        const ty = Math.round(tileScreenY + 1);
        const pulse = 0.5 + 0.5 * Math.sin(now / 220);
        const glow = ctx.createRadialGradient(tx + 3.5, ty + 3, 1, tx + 3.5, ty + 3, 8);
        glow.addColorStop(0, `rgba(255, 248, 120, ${(0.55 + pulse * 0.35).toFixed(2)})`);
        glow.addColorStop(1, 'rgba(255, 216, 64, 0)');
        ctx.fillStyle = glow;
        ctx.fillRect(tx - 5, ty - 5, 17, 16);
        ctx.fillStyle = '#081020';
        ctx.fillRect(tx, ty, 7, 6);
        ctx.fillStyle = pulse > 0.5 ? '#ffffc8' : '#f8f858';
        ctx.fillRect(tx + 1, ty + 1, 5, 3);
        ctx.fillRect(tx + 2, ty + 4, 2, 1);
      }
    }

    ctx.restore();
  }

  if (state.activeStrikeVfx) {
    const vfx = state.activeStrikeVfx;
    const progress = Math.max(
      0,
      Math.min(1, (now - vfx.startedAtMs) / Math.max(1, vfx.durationMs))
    );
    ctx.save();
    ctx.fillStyle = vfx.color;
    if (vfx.kind === 'ranged') {
      const wx = vfx.fromWorldX + (vfx.toWorldX - vfx.fromWorldX) * progress - cameraX;
      const wy = vfx.fromWorldY + (vfx.toWorldY - vfx.fromWorldY) * progress - cameraY;
      ctx.fillRect(Math.round(wx - 3), Math.round(wy - 3), 6, 6);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(Math.round(wx - 1), Math.round(wy - 1), 2, 2);
    } else {
      const bx = vfx.toWorldX - cameraX;
      const by = vfx.toWorldY - cameraY;
      const spread = Math.round(2 + progress * 6);
      ctx.fillRect(Math.round(bx - spread), Math.round(by - 1), 3, 2);
      ctx.fillRect(Math.round(bx + spread - 3), Math.round(by - 1), 3, 2);
      ctx.fillRect(Math.round(bx - 1), Math.round(by - spread), 2, 3);
      ctx.fillRect(Math.round(bx - 1), Math.round(by + spread - 3), 2, 3);
    }
    ctx.restore();
  }
}
