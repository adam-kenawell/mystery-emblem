/**
 * Declarative Dungeon Event Trigger Dispatches & `Talk` Command Runner (`battleEventRunner.ts`)
 */

import { directionFromDelta } from '../../assets/pmdAssetLoader';
import { PMD_TILE_NATIVE_PX } from '../../assets/tilesetLoader';
import {
  getAvailableTalkEventsForPair,
  getMatchingTileReachedEvents,
  getMatchingTurnStartEvents,
  getMatchingUnitDefeatedEvents,
  getMatchingUnitHealedEvents,
  getMatchingVictoryEvents,
} from '../../engine/battleEvents';
import { manhattanDistance, type BattleUnitState } from '../../engine/combatEngine';
import type { DungeonEventDefinition } from '../../types/schemas';
import type { DialogueScript } from '../../ui/DialogueOverlay';
import { waitBattleMs } from './battleBannersAndTransitions';
import {
  clearBattleSelection,
  recomputeDangerArea,
  syncHudControls,
  syncPrepChromeVisibility,
} from './battleDangerAndViewportState';
import {
  executeEventActionsAsync,
  resolveDialogueScriptFromAction,
} from './battleEventActions';
import { updateBattleInfoStrip } from './battleHudCards';
import { checkAndTriggerMatchEnd } from './battleOutcomeModals';
import { runEnemyPhase } from './battlePhaseAndAiRunner';
import {
  cancelUncommittedMove,
  openFloatingCommandMenu,
} from './battleSelectionAndMenu';
import type { BattleControllerContext } from './battleTypesAndState';
import {
  areAllLivingPlayersWaited,
  getLivingUnits,
  getSelectedUnit,
} from './battleUnitQueries';

async function runMatchedEvents(
  ctx: BattleControllerContext,
  matched: ReadonlyArray<DungeonEventDefinition>,
  runGen: number
): Promise<void> {
  for (const ev of matched) {
    if (!ctx.state.openState || runGen !== ctx.state.battleRunGen) return;
    ctx.state.triggeredEventIds.add(ev.id);
    const res = await executeEventActionsAsync(ctx, ev.id, ev.actions, runGen);
    if (res.aborted) return;
  }
}

export async function runTurnStartEvents(
  ctx: BattleControllerContext,
  turnNumber: number,
  phase: 'player_phase' | 'enemy_phase',
  runGen: number
): Promise<void> {
  const matched = getMatchingTurnStartEvents(
    ctx.state.events,
    ctx.state.triggeredEventIds,
    turnNumber,
    phase,
    ctx.state.units
  );
  await runMatchedEvents(ctx, matched, runGen);
}

export async function runUnitDefeatedEvents(
  ctx: BattleControllerContext,
  candidates: ReadonlyArray<BattleUnitState>,
  runGen: number
): Promise<void> {
  for (const u of candidates) {
    if (!u.defeated && u.currentHp > 0) continue;
    const matched = getMatchingUnitDefeatedEvents(
      ctx.state.events,
      ctx.state.triggeredEventIds,
      u.id,
      ctx.state.units
    );
    await runMatchedEvents(ctx, matched, runGen);
  }
}

export async function runTileReachedEvents(
  ctx: BattleControllerContext,
  unit: BattleUnitState,
  runGen: number
): Promise<void> {
  const matched = getMatchingTileReachedEvents(
    ctx.state.events,
    ctx.state.triggeredEventIds,
    unit,
    ctx.state.units
  );
  await runMatchedEvents(ctx, matched, runGen);
}

export async function runUnitHealedEvents(
  ctx: BattleControllerContext,
  runGen: number
): Promise<void> {
  const matched = getMatchingUnitHealedEvents(
    ctx.state.events,
    ctx.state.triggeredEventIds,
    ctx.state.units
  );
  await runMatchedEvents(ctx, matched, runGen);
}

export function applyBattleVictoryEventsSync(ctx: BattleControllerContext): DialogueScript[] {
  const { state } = ctx;
  const scripts: DialogueScript[] = [];
  const matched = getMatchingVictoryEvents(state.events, state.triggeredEventIds, state.units);
  for (const ev of matched) {
    state.triggeredEventIds.add(ev.id);
    for (const action of ev.actions) {
      if (action.type === 'grant_items') {
        if (action.items) {
          for (const entry of action.items) {
            if (entry.quantity > 0) state.eventBonusItems.push({ ...entry });
          }
        }
        if (action.gold && action.gold > 0) state.eventBonusGold += action.gold;
      } else if (action.type === 'unlock_kecleon_shop') {
        state.pendingShopUnlocks.push({ nodeId: action.nodeId, shopType: action.shopType });
      } else if (action.type === 'recruit_post_battle') {
        state.pendingPostBattleRecruits.push({
          speciesId: action.speciesId,
          level: action.level,
          nickname: action.nickname,
          scaleStatsToLevel: action.scaleStatsToLevel,
        });
      } else if (action.type === 'play_dialogue') {
        const script = resolveDialogueScriptFromAction(ctx, ev.id, action);
        if (script) scripts.push(script);
      }
    }
  }
  return scripts;
}

export function getTalkableTargetsFromCurrentTile(
  ctx: BattleControllerContext,
  initiator: BattleUnitState
): Array<{ target: BattleUnitState; events: DungeonEventDefinition[] }> {
  const { state } = ctx;
  const out: Array<{ target: BattleUnitState; events: DungeonEventDefinition[] }> = [];
  for (const target of getLivingUnits(state)) {
    if (target.id === initiator.id) continue;
    if (manhattanDistance(initiator.x, initiator.y, target.x, target.y) !== 1) continue;
    const events = getAvailableTalkEventsForPair(
      state.events,
      state.triggeredEventIds,
      initiator,
      target,
      state.units
    );
    if (events.length > 0) out.push({ target, events });
  }
  return out;
}

export async function executeTalkFromCommandMenu(
  ctx: BattleControllerContext,
  explicitTargetId?: string
): Promise<void> {
  const { state, dom, prepOverlay, audioManager } = ctx;
  const initiator = getSelectedUnit(state);
  if (!initiator) return;
  const pairs = getTalkableTargetsFromCurrentTile(ctx, initiator);
  if (pairs.length === 0) return;

  const chosenPair = explicitTargetId
    ? pairs.find((p) => p.target.id === explicitTargetId) ?? pairs[0]!
    : pairs[0]!;
  const runGen = state.battleRunGen;

  audioManager.playSfx('select');
  initiator.direction = directionFromDelta(
    chosenPair.target.x - initiator.x,
    chosenPair.target.y - initiator.y
  );
  chosenPair.target.direction = directionFromDelta(
    initiator.x - chosenPair.target.x,
    initiator.y - chosenPair.target.y
  );
  dom.actionMenuEl.hidden = true;
  state.interactionState = 'combat_animating';
  syncPrepChromeVisibility(state, dom, prepOverlay);
  syncHudControls(state, dom);
  updateBattleInfoStrip(ctx);
  ctx.onLayerStateChanged();
  ctx.renderNow();

  for (const ev of chosenPair.events) {
    const res = await executeEventActionsAsync(ctx, ev.id, ev.actions, runGen);
    if (res.aborted) {
      if (!state.openState || runGen !== state.battleRunGen) return;
      if (state.forecastReturnMode === 'action_menu') {
        openFloatingCommandMenu(ctx, initiator);
      } else {
        cancelUncommittedMove(ctx);
      }
      return;
    }
    state.triggeredEventIds.add(ev.id);
  }

  initiator.waited = true;
  initiator.action = 'Idle';
  initiator.renderWorldX = initiator.x * PMD_TILE_NATIVE_PX;
  initiator.renderWorldY = initiator.y * PMD_TILE_NATIVE_PX;

  clearBattleSelection(state, dom, prepOverlay);
  await runTileReachedEvents(ctx, initiator, runGen);
  if (!state.openState || runGen !== state.battleRunGen) return;

  recomputeDangerArea(ctx);
  if (checkAndTriggerMatchEnd(ctx)) return;

  syncHudControls(state, dom);
  updateBattleInfoStrip(ctx);
  ctx.onLayerStateChanged();
  ctx.renderNow();

  if (areAllLivingPlayersWaited(state)) {
    await waitBattleMs(state, 220);
    if (!state.openState || runGen !== state.battleRunGen || state.phase !== 'player_phase') return;
    await runEnemyPhase(ctx);
  }
}
