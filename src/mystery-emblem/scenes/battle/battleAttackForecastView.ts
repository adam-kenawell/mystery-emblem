/**
 * Turn-by-Turn Attack Forecast DOM Updater
 */

import { directionFromDelta } from '../../assets/pmdAssetLoader';
import { PMD_TILE_NATIVE_PX } from '../../assets/tilesetLoader';
import {
  computeCombatForecast,
  findBestStopTileForOffensiveMove,
  isEnemyStatusMove,
  manhattanDistance,
  type BattleUnitState,
} from '../../engine/combatEngine';
import { renderStatusHexForecastModalDom } from './battleStatusHexController';
import {
  buildAttackForecastLines,
  renderForecastLog,
  setForecastConfirm,
  setForecastHpBars,
  setForecastSidePortrait,
  setForecastSideStats,
  setForecastSideVisible,
} from './battleForecastLog';
import { getValidForecastMoves, renderForecastMoveList } from './battleForecastMoveList';
import { getBattleSupportContext } from './battleSupportHelpers';
import type { BattleControllerContext } from './battleTypesAndState';
import { getLivingUnits, getSelectedUnit } from './battleUnitQueries';

export function refreshCombatForecastModalDom(ctx: BattleControllerContext): void {
  const { state, dom } = ctx;
  const attacker = getSelectedUnit(state);
  const defender = state.units.find(
    (u) => u.id === state.forecastTargetId && !u.defeated && u.currentHp > 0
  );
  if (!attacker || !defender) return;

  const canRepositionAcrossRange =
    state.forecastReturnMode === 'unit_selected' &&
    state.originRangeSnapshot !== null &&
    state.uncommittedOrigin !== null &&
    state.uncommittedOrigin.unitId === attacker.id;

  const validMoves = getValidForecastMoves(state);
  if (validMoves.length === 0) return;

  if (!state.forecastMoveId || !validMoves.some((m) => m.id === state.forecastMoveId)) {
    state.forecastMoveId = validMoves[0]!.id;
  }
  const chosenSlot = validMoves.find((m) => m.id === state.forecastMoveId) ?? validMoves[0]!;

  if (canRepositionAcrossRange && state.originRangeSnapshot && state.uncommittedOrigin) {
    const curDist = manhattanDistance(attacker.x, attacker.y, defender.x, defender.y);
    if (curDist < chosenSlot.range[0] || curDist > chosenSlot.range[1]) {
      const originContext: BattleUnitState = {
        ...attacker,
        x: state.uncommittedOrigin.x,
        y: state.uncommittedOrigin.y,
      };
      const bestStop = findBestStopTileForOffensiveMove(
        state.map,
        originContext,
        defender,
        chosenSlot,
        state.originRangeSnapshot.reachableTiles,
        getLivingUnits(state)
      );
      if (bestStop) {
        attacker.x = bestStop.stopX;
        attacker.y = bestStop.stopY;
        attacker.renderWorldX = attacker.x * PMD_TILE_NATIVE_PX;
        attacker.renderWorldY = attacker.y * PMD_TILE_NATIVE_PX;
        attacker.direction = directionFromDelta(
          defender.x - attacker.x,
          defender.y - attacker.y
        );
        state.previewPath = bestStop.path;
        state.inspectedTile = { x: attacker.x, y: attacker.y };
      }
    }
  }

  if (isEnemyStatusMove(chosenSlot.move)) {
    renderStatusHexForecastModalDom(ctx, attacker, defender, chosenSlot, validMoves, () =>
      refreshCombatForecastModalDom(ctx)
    );
    return;
  }
  const forecast = computeCombatForecast(
    state.map,
    attacker,
    defender,
    state.forecastMoveId,
    undefined,
    getBattleSupportContext(state)
  );
  if (!forecast) return;
  state.currentForecast = forecast;

  const backdrop = dom.forecastModalBackdropEl;
  setForecastConfirm(backdrop, 'Attack!', false);

  renderForecastMoveList(ctx, attacker, validMoves, chosenSlot.id, () =>
    refreshCombatForecastModalDom(ctx)
  );
  renderForecastLog(backdrop, buildAttackForecastLines(attacker, defender, forecast));

  const atkSide = forecast.attackerSide;
  setForecastSideStats(backdrop, 'attacker', {
    hit: `${atkSide.hitRate}%`,
    crit: `${atkSide.critRate}%`,
  });
  const defSide = forecast.defenderCanCounter ? forecast.defenderSide : null;
  setForecastSideStats(
    backdrop,
    'defender',
    defSide ? { hit: `${defSide.hitRate}%`, crit: `${defSide.critRate}%` } : { note: 'No Counter' }
  );

  setForecastSideVisible(backdrop, 'defender', true);
  setForecastSidePortrait(backdrop, 'attacker', attacker);
  setForecastSidePortrait(backdrop, 'defender', defender);
  setForecastHpBars(backdrop, 'attacker', attacker, forecast.projectedAttackerHp, 'player');
  setForecastHpBars(backdrop, 'defender', defender, forecast.projectedDefenderHp, 'enemy');
}