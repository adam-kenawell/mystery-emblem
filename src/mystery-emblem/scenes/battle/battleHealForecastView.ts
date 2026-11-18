/**
 * Turn-by-Turn Support / Heal / Shield Forecast DOM Updater
 */

import { computeHealForecast } from '../../engine/combatEngine';
import {
  buildHealForecastLines,
  renderForecastLog,
  setForecastConfirm,
  setForecastHpBars,
  positionForecastFrame,
  setForecastSidePortrait,
  setForecastSideStats,
  setForecastSideVisible,
} from './battleForecastLog';
import { getValidForecastMoves, renderForecastMoveList } from './battleForecastMoveList';
import { getBattleSupportContext } from './battleSupportHelpers';
import type { BattleControllerContext } from './battleTypesAndState';
import { getSelectedUnit } from './battleUnitQueries';

export function refreshHealForecastModalDom(ctx: BattleControllerContext): void {
  const { state, dom } = ctx;
  const healer = getSelectedUnit(state);
  const target = state.units.find(
    (u) => u.id === state.forecastTargetId && !u.defeated && u.currentHp > 0
  );
  if (!healer || !target) return;

  const validMoves = getValidForecastMoves(state);
  if (validMoves.length === 0) return;

  if (!state.forecastMoveId || !validMoves.some((m) => m.id === state.forecastMoveId)) {
    state.forecastMoveId = validMoves[0]!.id;
  }
  const activeSlot = validMoves.find((m) => m.id === state.forecastMoveId) ?? validMoves[0]!;

  const healForecast = computeHealForecast(
    state.map,
    healer,
    target,
    state.forecastMoveId,
    undefined,
    getBattleSupportContext(state)
  );
  if (!healForecast) return;
  state.currentHealForecast = healForecast;

  const backdrop = dom.forecastModalBackdropEl;
  const isSelf = target.id === healer.id;
  setForecastConfirm(backdrop, healForecast.shield ? 'Shield!' : 'Heal!', false);
  renderForecastMoveList(ctx, healer, validMoves, activeSlot.id, () =>
    refreshHealForecastModalDom(ctx)
  );
  renderForecastLog(backdrop, buildHealForecastLines(target, healForecast));
  setForecastSideStats(backdrop, 'attacker', null);
  setForecastSideStats(backdrop, 'defender', null);

  if (isSelf) {
    setForecastHpBars(backdrop, 'attacker', healer, healForecast.projectedTargetHp);
  } else {
    setForecastHpBars(backdrop, 'attacker', healer, healer.currentHp);
    setForecastHpBars(backdrop, 'defender', target, healForecast.projectedTargetHp);
  }
  setForecastSideVisible(backdrop, 'defender', !isSelf);
  setForecastSidePortrait(backdrop, 'attacker', healer);
  setForecastSidePortrait(backdrop, 'defender', target);
  positionForecastFrame(backdrop, dom.canvas, state.cam, isSelf ? [healer] : [healer, target]);
}
