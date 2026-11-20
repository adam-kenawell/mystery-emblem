/**
 * Battle Support Context, Floating Heart Callouts & Point Gain Helpers (`battleSupportHelpers.ts`)
 */

import {
  clampSupportPointsForUnlockedRank,
  getMaxSupportRank,
  getSupportPairDefinition,
} from '../../data/supports/supportMatrix';
import type { BattleSupportContext, BattleUnitState } from '../../engine/combatEngine';
import { recordBattleSupportInteraction } from '../../engine/supportEngine';
import type { SaveData, SupportPairProgress } from '../../types/schemas';
import { spawnSupportHeartCallout } from './battleFloatingCallouts';
import type { BattleControllerContext, BattleRuntimeState } from './battleTypesAndState';

export function getBattleSupportContext(state: BattleRuntimeState): BattleSupportContext {
  return {
    units: state.units,
    supports: state.battleSupportPoints,
  };
}

export function cloneSaveSupportsForBattle(
  save: SaveData | null | undefined
): Record<string, SupportPairProgress> {
  const out: Record<string, SupportPairProgress> = {};
  if (!save?.supports) return out;
  for (const [k, v] of Object.entries(save.supports)) {
    if (!v) continue;
    out[k] = { points: v.points, unlockedRank: v.unlockedRank ?? null };
  }
  return out;
}

export function syncBattleSupportsFromSave(ctx: BattleControllerContext): void {
  const save = ctx.saveManager.getSave();
  if (!save?.supports) return;
  for (const [pairKey, saveEntry] of Object.entries(save.supports)) {
    if (!saveEntry) continue;
    const parts = pairKey.split('::');
    if (parts.length !== 2) continue;
    const pairDef = getSupportPairDefinition(parts[0], parts[1]);
    if (!pairDef) continue;
    const cur = ctx.state.battleSupportPoints[pairDef.pairKey];
    const unlockedRank = getMaxSupportRank(cur?.unlockedRank ?? null, saveEntry.unlockedRank ?? null);
    const points = clampSupportPointsForUnlockedRank(
      Math.max(cur?.points ?? 0, saveEntry.points ?? 0),
      unlockedRank,
      pairDef.maxRank
    );
    ctx.state.battleSupportPoints[pairDef.pairKey] = { points, unlockedRank };
  }
}

function isSupportGainAllowedInBattle(state: BattleRuntimeState): boolean {
  return state.activeLevelId !== 'prologue';
}

export function awardBattleCombatSupportPoints(
  ctx: BattleControllerContext,
  playerUnit: BattleUnitState,
  opponent?: BattleUnitState
): void {
  const { state, dom } = ctx;
  if (!isSupportGainAllowedInBattle(state)) return;
  if (
    playerUnit.faction !== 'player' ||
    playerUnit.defeated ||
    playerUnit.currentHp <= 0 ||
    playerUnit.sparring ||
    opponent?.sparring
  ) {
    return;
  }

  let anyGainedForPlayer = false;
  for (const ally of state.units) {
    if (
      ally.id === playerUnit.id ||
      ally.faction !== 'player' ||
      ally.defeated ||
      ally.currentHp <= 0 ||
      ally.sparring
    ) {
      continue;
    }
    if (Math.abs(ally.x - playerUnit.x) + Math.abs(ally.y - playerUnit.y) !== 1) continue;

    const res = recordBattleSupportInteraction(state.battleSupportPoints, playerUnit, ally, 1);
    if (res.gained) {
      anyGainedForPlayer = true;
      state.supportHeartEarnedThisBattle = true;
      spawnSupportHeartCallout(state, dom, ally.x, ally.y);
    }
  }

  if (anyGainedForPlayer) {
    spawnSupportHeartCallout(state, dom, playerUnit.x, playerUnit.y);
  }
}

export function awardBattleAllyPairSupportPoint(
  ctx: BattleControllerContext,
  actor: BattleUnitState,
  target: BattleUnitState
): void {
  const { state, dom } = ctx;
  if (!isSupportGainAllowedInBattle(state)) return;
  if (
    actor.id === target.id ||
    actor.faction !== 'player' ||
    target.faction !== 'player' ||
    actor.defeated ||
    target.defeated ||
    actor.currentHp <= 0 ||
    target.currentHp <= 0 ||
    actor.sparring ||
    target.sparring
  ) {
    return;
  }

  const res = recordBattleSupportInteraction(state.battleSupportPoints, actor, target, 1);
  if (res.gained) {
    state.supportHeartEarnedThisBattle = true;
    spawnSupportHeartCallout(state, dom, actor.x, actor.y);
    spawnSupportHeartCallout(state, dom, target.x, target.y);
  }
}
