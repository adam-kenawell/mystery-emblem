/**
 * Chapter Prep Deployment Slot Toggling, `View Map` Blue-Tile Swapping & External Cheat Refresh
 */

import {
  createInitialPrepDeploymentSlots,
  getMapDeploymentCap,
} from '../../engine/battleSetup';
import {
  clearInspectedAllyRange,
  toggleIndividualEnemyDanger,
  toggleInspectedAllyRange,
} from './battleDangerAndViewportState';
import { updateBattleInfoStrip } from './battleHudCards';
import { getActivePrepSaveManager, rebuildPrepBattleUnits } from './battlePrepAndAssets';
import type { BattleControllerContext } from './battleTypesAndState';
import { getLivingEnemies, getLivingUnits } from './battleUnitQueries';

export function togglePrepDeployUnit(
  ctx: BattleControllerContext,
  instanceId: string
): { ok: boolean; message: string } {
  const { state, saveManager } = ctx;
  const activeSave = getActivePrepSaveManager(state, saveManager).getSave();
  const unit = activeSave?.roster.find((u) => u.instanceId === instanceId);
  if (!unit) {
    return { ok: false, message: 'Unit not found in roster.' };
  }
  if (unit.isLord) {
    return {
      ok: false,
      message: `${unit.nickname} is your Dragon Lord and must enter every dungeon.`,
    };
  }

  const existingSlot = state.deploymentSlots.find((s) => s.unitInstanceId === instanceId);
  if (existingSlot) {
    existingSlot.unitInstanceId = null;
    if (state.prepSwapSlotIndex === existingSlot.slotIndex) {
      state.prepSwapSlotIndex = null;
    }
    rebuildPrepBattleUnits(ctx);
    return { ok: true, message: `${unit.nickname} moved to Standby.` };
  }

  const deployedCount = state.deploymentSlots.filter((s) => s.unitInstanceId !== null).length;
  const cap = getMapDeploymentCap(state.map);
  if (deployedCount >= cap) {
    return {
      ok: false,
      message: `Deployment cap reached (${cap}/${cap}). Bench another unit first.`,
    };
  }

  const openSlot = state.deploymentSlots.find((s) => s.unitInstanceId === null);
  if (!openSlot) {
    return { ok: false, message: 'No open starting tile available.' };
  }

  openSlot.unitInstanceId = unit.instanceId;
  rebuildPrepBattleUnits(ctx);
  return {
    ok: true,
    message: `${unit.nickname} deployed.`,
  };
}

export function handlePrepViewMapTileTap(
  ctx: BattleControllerContext,
  tx: number,
  ty: number
): void {
  const { state, prepOverlay, audioManager, tutorialOverlay } = ctx;
  state.inspectedTile = { x: tx, y: ty };
  const livingOcc = getLivingUnits(state).find((u) => u.x === tx && u.y === ty);
  state.touchInspectedUnitId = state.hoveredTile === null && livingOcc ? livingOcc.id : null;
  const clickedSlot = state.deploymentSlots.find((s) => s.x === tx && s.y === ty) ?? null;

  if (state.prepSwapSlotIndex === null) {
    if (clickedSlot && clickedSlot.unitInstanceId) {
      clearInspectedAllyRange(state);
      state.prepSwapSlotIndex = clickedSlot.slotIndex;
      state.selectionPulseStartMs = performance.now();
      audioManager.playSfx('select');
      prepOverlay.syncMapHudState();
      state.prepMapStatusNotice = 'Tap another blue tile to swap.';
      updateBattleInfoStrip(ctx);
      ctx.onLayerStateChanged();
      ctx.renderNow();
      return;
    }

    if (clickedSlot) {
      clearInspectedAllyRange(state);
      audioManager.playSfx('dialogue_advance');
      state.prepMapStatusNotice = 'Open blue tile - tap a unit first.';
      updateBattleInfoStrip(ctx);
      ctx.onLayerStateChanged();
      ctx.renderNow();
      return;
    }

    state.prepMapStatusNotice = null;
    const tappedEnemy = getLivingEnemies(state).find((e) => e.x === tx && e.y === ty);
    if (tappedEnemy) {
      audioManager.playSfx('select');
      toggleIndividualEnemyDanger(ctx, tappedEnemy.id);
    } else if (livingOcc && livingOcc.faction === 'npc') {
      toggleInspectedAllyRange(ctx, livingOcc.id);
      ctx.onLayerStateChanged();
    } else if (clearInspectedAllyRange(state)) {
      audioManager.playSfx('cancel');
      ctx.onLayerStateChanged();
    } else {
      audioManager.playSfx('dialogue_advance');
    }
    updateBattleInfoStrip(ctx);
    ctx.renderNow();
    return;
  }

  const sourceSlot = state.deploymentSlots.find((s) => s.slotIndex === state.prepSwapSlotIndex);
  if (!sourceSlot) {
    state.prepSwapSlotIndex = null;
    state.prepMapStatusNotice = null;
    prepOverlay.syncMapHudState();
    updateBattleInfoStrip(ctx);
    ctx.onLayerStateChanged();
    return;
  }

  if (clickedSlot && clickedSlot.slotIndex === sourceSlot.slotIndex) {
    state.prepSwapSlotIndex = null;
    state.prepMapStatusNotice = null;
    audioManager.playSfx('cancel');
    prepOverlay.syncMapHudState();
    updateBattleInfoStrip(ctx);
    ctx.onLayerStateChanged();
    ctx.renderNow();
    return;
  }

  if (clickedSlot) {
    const tempUnitId = sourceSlot.unitInstanceId;
    sourceSlot.unitInstanceId = clickedSlot.unitInstanceId;
    clickedSlot.unitInstanceId = tempUnitId;
    state.prepSwapSlotIndex = null;
    state.prepMapStatusNotice = 'Positions swapped.';
    audioManager.playSfx('select');
    rebuildPrepBattleUnits(ctx);
    prepOverlay.refreshAll();
    const postRebuildOcc = getLivingUnits(state).find((u) => u.x === tx && u.y === ty);
    state.touchInspectedUnitId =
      state.hoveredTile === null && postRebuildOcc ? postRebuildOcc.id : null;
    updateBattleInfoStrip(ctx);
    ctx.onLayerStateChanged();
    tutorialOverlay?.notifyActionCompleted('prep_swap_or_finish_view_map');
    ctx.renderNow();
    return;
  }

  state.prepSwapSlotIndex = null;
  audioManager.playSfx('cancel');
  prepOverlay.syncMapHudState();
  state.prepMapStatusNotice = 'Only blue starting tiles can swap.';
  updateBattleInfoStrip(ctx);
  ctx.onLayerStateChanged();
  ctx.renderNow();
}

export function refreshFromExternalSaveCheat(ctx: BattleControllerContext): void {
  const { state, prepOverlay, saveManager } = ctx;
  if (!state.openState || state.phase !== 'dungeon_prep') return;
  const activeSave = getActivePrepSaveManager(state, saveManager).getSave();
  if (!activeSave) return;
  const rosterIds = new Set(activeSave.roster.map((u) => u.instanceId));
  const slotsStillValid =
    state.deploymentSlots.length > 0 &&
    state.deploymentSlots.every(
      (s) => s.unitInstanceId === null || rosterIds.has(s.unitInstanceId)
    ) &&
    state.deploymentSlots.some((s) => s.unitInstanceId !== null);
  if (!slotsStillValid) {
    state.deploymentSlots = createInitialPrepDeploymentSlots(state.map, activeSave.roster);
  }
  rebuildPrepBattleUnits(ctx);
  prepOverlay.refreshAll();
}
