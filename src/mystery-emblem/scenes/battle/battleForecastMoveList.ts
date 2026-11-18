/**
 * Shared Move-Row List & Valid Move Resolver for Attack & Heal Forecast Modals
 */

import { isMoveEquipped } from '../../data/equippedMoves';
import {
  getHealingMovesForTargetAtDistance,
  getEnemyTargetingMovesAtDistance,
  getOffensiveMovesReachableForTarget,
  manhattanDistance,
  type BattleMoveSlot,
  type BattleUnitState,
} from '../../engine/combatEngine';
import { bindPointerTap } from '../../ui/pointerControls';
import { renderColoredTypeHtml } from '../../ui/typeColors';
import type { BattleControllerContext, BattleRuntimeState } from './battleTypesAndState';
import { escapeHudHtml, getSelectedUnit } from './battleUnitQueries';

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
