/**
 * Unified Forecast Modal DOM Builder, Move Picker & Attack/Heal/Hex View Updaters (`battleForecastView.ts`)
 */

import { directionFromDelta } from '../../assets/pmdAssetLoader';
import { PMD_TILE_NATIVE_PX } from '../../assets/tilesetLoader';
import { isMoveEquipped } from '../../data/equippedMoves';
import {
  computeCombatForecast,
  computeHealForecast,
  computeStatusMoveForecast,
  findBestStopTileForOffensiveMove,
  getEnemyTargetingMovesAtDistance,
  getHealingMovesForTargetAtDistance,
  getOffensiveMovesReachableForTarget,
  isEnemyStatusMove,
  manhattanDistance,
  type BattleMoveSlot,
  type BattleUnitState,
} from '../../engine/combatEngine';
import { bindPointerTap } from '../../ui/pointerControls';
import { renderColoredTypeHtml } from '../../ui/typeColors';
import {
  buildAttackForecastLines,
  buildHealForecastLines,
  buildHexForecastLines,
  positionForecastFrame,
  renderForecastLog,
  setForecastConfirm,
  setForecastHpBars,
  setForecastSidePortrait,
  setForecastSideStats,
  setForecastSideVisible,
} from './battleForecastLog';
import { getBattleSupportContext } from './battleSupportHelpers';
import type { BattleControllerContext, BattleRuntimeState } from './battleTypesAndState';
import { escapeHudHtml, getLivingUnits, getSelectedUnit } from './battleUnitQueries';

export interface BattleForecastDomRefs {
  forecastModalBackdropEl: HTMLElement;
}

export function createBattleForecastDom(): BattleForecastDomRefs {
  const forecastModalBackdropEl = document.createElement('div');
  forecastModalBackdropEl.className = 'pmd-battle-modal-backdrop pmd-forecast-backdrop';
  forecastModalBackdropEl.dataset.testid = 'battle-forecast-modal';
  forecastModalBackdropEl.hidden = true;
  forecastModalBackdropEl.innerHTML = `
    <button type="button" class="pmd-window pmd-window--compact pmd-forecast-back-btn" data-testid="forecast-back-btn" aria-label="Back">Back</button>
    <div class="pmd-window pmd-battle-forecast-dialog pmd-fe-forecast-frame" role="dialog" aria-modal="true" aria-label="Combat Forecast">
      <div class="pmd-fe-title">Battle Forecast</div>
      <div class="pmd-fe-body" data-forecast-body>
        <div class="pmd-fe-sides">
          <div class="pmd-fe-side is-left" data-testid="forecast-attacker-card">
            <span class="pmd-fe-side-portrait" data-attacker-portrait></span>
            <div class="pmd-fe-side-info">
              <div class="pmd-fe-side-stats" data-attacker-stats>
                <span data-attacker-hit-wrap>HIT <strong data-testid="forecast-attacker-hit">-</strong></span>
                <span data-attacker-crit-wrap>CRT <strong data-testid="forecast-attacker-crit">-</strong></span>
                <span class="pmd-fe-side-note" data-testid="forecast-attacker-note" data-attacker-note hidden></span>
              </div>
              <div class="pmd-forecast-hp-bar-track">
                <div class="pmd-forecast-hp-bar-ghost" data-attacker-hp-cur-bar></div>
                <div class="pmd-forecast-hp-bar-fill" data-attacker-hp-proj-bar></div>
              </div>
            </div>
          </div>
          <div class="pmd-fe-side is-right" data-testid="forecast-defender-card">
            <span class="pmd-fe-side-portrait" data-defender-portrait></span>
            <div class="pmd-fe-side-info">
              <div class="pmd-fe-side-stats" data-defender-stats>
                <span data-defender-hit-wrap>HIT <strong data-testid="forecast-defender-hit">-</strong></span>
                <span data-defender-crit-wrap>CRT <strong data-testid="forecast-defender-crit">-</strong></span>
                <span class="pmd-fe-side-note" data-testid="forecast-defender-note" data-defender-note hidden></span>
              </div>
              <div class="pmd-forecast-hp-bar-track">
                <div class="pmd-forecast-hp-bar-ghost" data-defender-hp-cur-bar></div>
                <div class="pmd-forecast-hp-bar-fill" data-defender-hp-proj-bar></div>
              </div>
            </div>
          </div>
        </div>
        <div class="pmd-fe-divider" role="separator"></div>
        <div class="pmd-fe-section-label">Battle Sequence</div>
        <div class="pmd-fe-log" data-testid="forecast-log" data-forecast-log></div>
      </div>

      <div class="pmd-fe-move-picker" data-forecast-move-picker hidden>
        <div class="pmd-fe-move-list pmd-menu-list" data-testid="forecast-move-list" data-forecast-moves></div>
      </div>

      <div class="pmd-fe-footer">
        <button type="button" class="pmd-btn pmd-fe-using-btn" data-testid="forecast-move-switch-btn">Using: -</button>
        <button type="button" class="pmd-btn pmd-btn-primary pmd-fe-confirm-btn" data-testid="forecast-attack-btn">Attack!</button>
      </div>
    </div>
  `;

  return { forecastModalBackdropEl };
}

export function getValidForecastMoves(state: BattleRuntimeState): BattleMoveSlot[] {
  if (state.forecastMode === 'heal') {
    const healer = getSelectedUnit(state);
    const target = state.units.find(
      (u) => u.id === state.forecastTargetId && !u.defeated && u.currentHp > 0
    );
    if (!healer || !target) return [];
    const dist =
      target.id === healer.id ? 0 : manhattanDistance(healer.x, healer.y, target.x, target.y);
    return getHealingMovesForTargetAtDistance(healer, target, dist);
  }

  const attacker = getSelectedUnit(state);
  const defender = state.units.find(
    (u) => u.id === state.forecastTargetId && !u.defeated && u.currentHp > 0
  );
  if (!attacker || !defender) return [];

  const canRepositionAcrossRange =
    state.forecastReturnMode === 'unit_selected' &&
    state.originRangeSnapshot !== null &&
    state.uncommittedOrigin !== null &&
    state.uncommittedOrigin.unitId === attacker.id;

  if (canRepositionAcrossRange && state.originRangeSnapshot) {
    return getOffensiveMovesReachableForTarget(
      attacker,
      defender,
      state.originRangeSnapshot.reachableTiles
    );
  }
  const distNow = manhattanDistance(attacker.x, attacker.y, defender.x, defender.y);
  return getEnemyTargetingMovesAtDistance(attacker, distNow);
}

export function isForecastMovePickerOpen(backdropEl: HTMLElement): boolean {
  const picker = backdropEl.querySelector<HTMLElement>('[data-forecast-move-picker]');
  return Boolean(picker && !picker.hidden);
}

/** Opens/closes the move picker popup layered over the forecast box. */
export function setForecastMovePickerOpen(backdropEl: HTMLElement, open: boolean): void {
  const picker = backdropEl.querySelector<HTMLElement>('[data-forecast-move-picker]');
  const usingBtn = backdropEl.querySelector<HTMLElement>(
    '[data-testid="forecast-move-switch-btn"]'
  );
  if (picker) picker.hidden = !open;
  usingBtn?.classList.toggle('is-open', open);
}

export function renderForecastMoveList(
  ctx: BattleControllerContext,
  actor: BattleUnitState,
  validMoves: ReadonlyArray<BattleMoveSlot>,
  selectedMoveId: string,
  onSelectMove: () => void
): void {
  const { state, dom, audioManager, abortSignal } = ctx;
  const movesListEl = dom.forecastModalBackdropEl.querySelector<HTMLElement>(
    '[data-forecast-moves]'
  );
  if (!movesListEl) return;
  movesListEl.innerHTML = '';

  const usingBtn = dom.forecastModalBackdropEl.querySelector<HTMLButtonElement>(
    '[data-testid="forecast-move-switch-btn"]'
  );
  const selectedSlot = actor.activeMoves.find((s) => s.id === selectedMoveId);
  if (usingBtn) {
    usingBtn.innerHTML = `<span class="pmd-fe-using-label">Using:</span> <span class="pmd-fe-using-move">${escapeHudHtml(selectedSlot?.move.name ?? '-')}</span>`;
    usingBtn.disabled = actor.activeMoves.length <= 1;
  }

  const validIds = new Set(validMoves.map((m) => m.id));
  for (const slot of actor.activeMoves) {
    const isUsable = validIds.has(slot.id);
    const isSelected = slot.id === selectedMoveId;
    const isEqCounter =
      isMoveEquipped(actor, slot.id) && slot.move.category !== 'Support/Heal';

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `pmd-btn pmd-menu-row pmd-fe-move-row${isSelected ? ' is-active is-selected' : ''}`;
    btn.dataset.testid = `forecast-move-row-${slot.id}`;
    btn.disabled = !isUsable;

    const nameSpan = document.createElement('span');
    nameSpan.className = 'pmd-fe-move-row-name';
    nameSpan.textContent = `${isEqCounter ? '[E] ' : ''}${slot.move.name}`;

    const metaSpan = document.createElement('span');
    metaSpan.className = 'pmd-fe-move-row-meta';
    const rangeText =
      slot.range[0] === 0 && slot.range[1] === 0
        ? 'Self'
        : slot.range[0] === slot.range[1]
          ? `R${slot.range[0]}`
          : `R${slot.range[0]}-${slot.range[1]}`;
    metaSpan.innerHTML = `${renderColoredTypeHtml(slot.move.type)} · ${escapeHudHtml(rangeText)} · ${slot.ppRemaining}/${slot.maxPp} PP`;

    btn.append(nameSpan, metaSpan);

    if (isUsable) {
      bindPointerTap(
        btn,
        () => {
          setForecastMovePickerOpen(dom.forecastModalBackdropEl, false);
          audioManager.playSfx('select');
          if (state.forecastMoveId === slot.id) return;
          state.forecastMoveId = slot.id;
          onSelectMove();
          ctx.renderNow();
        },
        { signal: abortSignal }
      );
    }

    movesListEl.appendChild(btn);
  }
}

export function renderStatusHexForecastModalDom(
  ctx: BattleControllerContext,
  caster: BattleUnitState,
  defender: BattleUnitState,
  chosenSlot: BattleMoveSlot,
  validMoves: ReadonlyArray<BattleMoveSlot>,
  onRefresh: () => void
): void {
  const { state, dom } = ctx;
  const forecast = computeStatusMoveForecast(
    state.map,
    caster,
    defender,
    chosenSlot.id,
    undefined,
    getBattleSupportContext(state)
  );
  if (!forecast) return;
  state.currentForecast = null;

  const backdrop = dom.forecastModalBackdropEl;
  setForecastConfirm(backdrop, 'Hex!', Boolean(forecast.blockedReason));
  renderForecastMoveList(ctx, caster, validMoves, chosenSlot.id, onRefresh);
  renderForecastLog(backdrop, buildHexForecastLines(defender, forecast));
  setForecastSideStats(backdrop, 'attacker', null);
  setForecastSideStats(backdrop, 'defender', { note: 'No Counter' });
  setForecastSideVisible(backdrop, 'defender', true);
  setForecastSidePortrait(backdrop, 'attacker', caster);
  setForecastSidePortrait(backdrop, 'defender', defender);
  setForecastHpBars(backdrop, 'attacker', caster, caster.currentHp);
  setForecastHpBars(backdrop, 'defender', defender, defender.currentHp);
  positionForecastFrame(backdrop, dom.canvas, state.cam, [caster, defender]);
}

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
  setForecastHpBars(backdrop, 'attacker', attacker, forecast.projectedAttackerHp);
  setForecastHpBars(backdrop, 'defender', defender, forecast.projectedDefenderHp);
  positionForecastFrame(backdrop, dom.canvas, state.cam, [attacker, defender]);
}

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
