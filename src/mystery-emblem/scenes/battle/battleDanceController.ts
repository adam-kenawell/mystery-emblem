/**
 * Dancer Turn-Refresh Controller (`Oricorio` - `battleDanceController.ts`)
 *
 * Executes adjacent ally turn-refresh (`target.waited = false` + `'AGAIN!'`),
 * awards support EXP, and strictly blocks Dancer-on-Dancer refresh loops.
 */

import { directionFromDelta } from '../../assets/pmdAssetLoader';
import { PMD_TILE_NATIVE_PX } from '../../assets/tilesetLoader';
import { getMoveById } from '../../data/index';
import {
  getDanceMovesForTargetAtDistance,
  manhattanDistance,
  type BattleMoveSlot,
  type BattleUnitState,
} from '../../engine/combatEngine';
import { computeSupportHealExpGain } from '../../engine/progressionEngine';
import { ensureTilePairVisible, waitBattleMs } from './battleBannersAndTransitions';
import { finalizePlayerUnitAction } from './battleCommandExecution';
import {
  syncHudControls,
  syncPrepChromeVisibility,
} from './battleDangerAndViewportState';
import { logDanceAction } from './battleActionLog';
import { updateBattleInfoStrip } from './battleHudCards';
import { grantExpAndHandleLevelUps } from './battleLevelUpModal';
import { awardBattleAllyPairSupportPoint } from './battleSupportHelpers';
import type { BattleControllerContext, BattleRuntimeState } from './battleTypesAndState';
import {
  getLivingPlayers,
  getSelectedUnit,
} from './battleUnitQueries';

export function getDanceableTargetsFromCurrentTile(
  state: BattleRuntimeState,
  dancer: BattleUnitState
): Array<{
  ally: BattleUnitState;
  distance: number;
  moves: BattleMoveSlot[];
}> {
  const out: Array<{ ally: BattleUnitState; distance: number; moves: BattleMoveSlot[] }> = [];
  for (const ally of getLivingPlayers(state)) {
    if (ally.id === dancer.id) continue;
    const dist = manhattanDistance(dancer.x, dancer.y, ally.x, ally.y);
    const moves = getDanceMovesForTargetAtDistance(dancer, ally, dist);
    if (moves.length > 0) {
      out.push({ ally, distance: dist, moves });
    }
  }
  return out;
}

export async function playDanceActionAsync(
  ctx: BattleControllerContext,
  dancer: BattleUnitState,
  targetAlly: BattleUnitState,
  moveSlot: BattleMoveSlot,
  runGen = ctx.state.battleRunGen
): Promise<void> {
  const { state, dom, audioManager } = ctx;
  ensureTilePairVisible(state, dancer.x, dancer.y, targetAlly.x, targetAlly.y);

  dancer.direction = directionFromDelta(targetAlly.x - dancer.x, targetAlly.y - dancer.y);
  dancer.action = 'Special';
  dancer.frameIndex = 0;
  moveSlot.ppRemaining = Math.max(0, moveSlot.ppRemaining - 1);

  const toCenterX = targetAlly.x * PMD_TILE_NATIVE_PX + PMD_TILE_NATIVE_PX / 2;
  const toCenterY = targetAlly.y * PMD_TILE_NATIVE_PX + PMD_TILE_NATIVE_PX / 2;

  state.activeStrikeVfx = {
    kind: 'impact_burst',
    fromWorldX: toCenterX,
    fromWorldY: toCenterY,
    toWorldX: toCenterX,
    toWorldY: toCenterY,
    color: '#ffd860',
    startedAtMs: performance.now(),
    durationMs: 300,
  };

  audioManager.playSfx('heal');
  await waitBattleMs(state, 180);
  if (!state.openState || runGen !== state.battleRunGen) return;

  targetAlly.waited = false;
  targetAlly.action = 'Idle';
  logDanceAction(state, dom, dancer, targetAlly, getMoveById(moveSlot.id)?.name ?? 'Dance');
  updateBattleInfoStrip(ctx);

  await waitBattleMs(state, 260);
  if (!state.openState || runGen !== state.battleRunGen) return;

  state.activeStrikeVfx = null;
  dancer.action = 'Idle';

  if (dancer.faction === 'player' && !dancer.defeated && dancer.currentHp > 0) {
    awardBattleAllyPairSupportPoint(ctx, dancer, targetAlly);
    const enemies = state.units.filter((u) => u.faction === 'enemy');
    const chapterLv =
      enemies.length > 0
        ? Math.max(1, Math.round(enemies.reduce((s, e) => s + e.level, 0) / enemies.length))
        : dancer.level;
    const expGain = computeSupportHealExpGain(dancer.level, chapterLv);
    await grantExpAndHandleLevelUps(ctx, dancer, expGain, runGen);
  }
}

export async function executeDanceFromCommandMenu(
  ctx: BattleControllerContext,
  explicitTargetId?: string
): Promise<void> {
  const { state, dom, prepOverlay, audioManager } = ctx;
  const dancer = getSelectedUnit(state);
  if (!dancer) return;

  const candidates = getDanceableTargetsFromCurrentTile(state, dancer);
  if (candidates.length === 0) return;

  const chosen = explicitTargetId
    ? candidates.find((c) => c.ally.id === explicitTargetId) ?? candidates[0]!
    : candidates[0]!;
  const moveSlot = chosen.moves[0]!;
  const runGen = state.battleRunGen;

  audioManager.playSfx('select');
  dom.actionMenuEl.hidden = true;
  state.currentRange = null;
  state.previewPath = null;
  state.interactionState = 'combat_animating';
  syncPrepChromeVisibility(state, dom, prepOverlay);
  syncHudControls(state, dom);
  updateBattleInfoStrip(ctx);
  ctx.onLayerStateChanged();

  await playDanceActionAsync(ctx, dancer, chosen.ally, moveSlot, runGen);
  if (!state.openState || runGen !== state.battleRunGen) return;

  await finalizePlayerUnitAction(ctx, dancer, runGen, { autoEndDelayMs: 220 });
}
