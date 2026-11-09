/**
 * Fire Emblem Interlocking 'L'-Shape Attack Forecast DOM Updater
 */

import { directionFromDelta } from '../../assets/pmdAssetLoader';
import { PMD_TILE_NATIVE_PX } from '../../assets/tilesetLoader';
import { getItemById } from '../../data/index';
import {
  computeCombatForecast,
  findBestStopTileForOffensiveMove,
  manhattanDistance,
  type BattleUnitState,
} from '../../engine/combatEngine';
import { createMiniItemIcon } from '../../ui/PmdItemIconGrid';
import { createMiniSpeciesPortrait } from '../../ui/PmdUnitPortraitGrid';
import { bindPointerTap } from '../../ui/pointerControls';
import {
  getValidForecastMoves,
  renderForecastMoveList,
  setForecastStatLabels,
} from './battleForecastMoveList';
import type { BattleControllerContext } from './battleTypesAndState';
import {
  getAttackableEnemiesFromCurrentTile,
  getLivingUnits,
  getSelectedUnit,
  getUnitVisualKey,
} from './battleUnitQueries';

export function refreshCombatForecastModalDom(ctx: BattleControllerContext): void {
  const { state, dom, audioManager, abortSignal } = ctx;
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

  const allTargets = getAttackableEnemiesFromCurrentTile(state, attacker);
  const forecast = computeCombatForecast(state.map, attacker, defender, state.forecastMoveId);
  if (!forecast) return;
  state.currentForecast = forecast;

  const backdrop = dom.forecastModalBackdropEl;
  const titleEl = backdrop.querySelector('[data-forecast-title]');
  if (titleEl) titleEl.textContent = 'COMBAT FORECAST';
  const defCardEl = backdrop.querySelector<HTMLElement>('[data-testid="forecast-defender-card"]');
  if (defCardEl) defCardEl.className = 'pmd-fe-enemy-box is-defender';
  const confirmBtnEl = backdrop.querySelector<HTMLElement>('[data-testid="forecast-attack-btn"]');
  if (confirmBtnEl) confirmBtnEl.textContent = 'Attack!';

  renderForecastMoveList(ctx, attacker, validMoves, chosenSlot.id, () =>
    refreshCombatForecastModalDom(ctx)
  );
  setForecastStatLabels(backdrop, {
    atk2: 'DMG',
    atk3: 'HIT',
    atk4: 'CRT',
    def2: 'DMG',
    def3: 'HIT',
    def4: 'CRT',
  });

  void dom.attackerPortraitView.setPortrait({
    speciesIdOrAssetId: getUnitVisualKey(attacker),
    emotion: forecast.projectedAttackerHp <= 0 ? 'Pain' : 'Normal',
    mirrorHorizontal: false,
  });
  void dom.defenderPortraitView.setPortrait({
    speciesIdOrAssetId: getUnitVisualKey(defender),
    emotion: forecast.projectedDefenderHp <= 0 ? 'Pain' : 'Normal',
    mirrorHorizontal: true,
  });

  const effBadgeEl = backdrop.querySelector<HTMLElement>(
    '[data-testid="forecast-effectiveness-badge"]'
  );
  const atkSide = forecast.attackerSide;
  if (effBadgeEl) {
    effBadgeEl.className = 'pmd-forecast-eff-badge';
    if (atkSide.typeMultiplier === 1 && !atkSide.hasStab) {
      effBadgeEl.textContent = '1x';
      effBadgeEl.hidden = true;
    } else if (atkSide.typeMultiplier === 1 && atkSide.hasStab) {
      effBadgeEl.textContent = 'STAB 1.25x';
      effBadgeEl.hidden = false;
    } else {
      const stabPart = atkSide.hasStab ? ' · STAB' : '';
      effBadgeEl.textContent = `${atkSide.effectivenessLabel} (${atkSide.typeMultiplier}x)${stabPart}`;
      if (atkSide.typeMultiplier > 1) effBadgeEl.classList.add('is-super');
      else if (atkSide.typeMultiplier < 1) effBadgeEl.classList.add('is-resisted');
      effBadgeEl.hidden = false;
    }
  }

  const targetsWrap = backdrop.querySelector<HTMLElement>('[data-forecast-targets-wrap]');
  const targetsRow = backdrop.querySelector<HTMLElement>('[data-forecast-targets]');
  if (targetsWrap && targetsRow) {
    targetsRow.innerHTML = '';
    if (allTargets.length > 1) {
      targetsWrap.hidden = false;
      for (const entry of allTargets) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `pmd-btn pmd-chip-btn pmd-portrait-action-btn${entry.enemy.id === defender.id ? ' is-active' : ''}`;
        btn.dataset.testid = `forecast-target-${entry.enemy.id}`;
        btn.appendChild(
          createMiniSpeciesPortrait(getUnitVisualKey(entry.enemy), { sizePx: 20 })
        );
        const hpSpan = document.createElement('span');
        hpSpan.textContent = `HP ${entry.enemy.currentHp}`;
        btn.appendChild(hpSpan);
        bindPointerTap(
          btn,
          () => {
            audioManager.playSfx('select');
            state.forecastTargetId = entry.enemy.id;
            attacker.direction = directionFromDelta(
              entry.enemy.x - attacker.x,
              entry.enemy.y - attacker.y
            );
            refreshCombatForecastModalDom(ctx);
            ctx.renderNow();
          },
          { signal: abortSignal }
        );
        targetsRow.appendChild(btn);
      }
    } else {
      targetsWrap.hidden = true;
    }
  }

  const q = (sel: string) => backdrop.querySelector<HTMLElement>(sel);
  const atkNameEl = q('[data-testid="forecast-attacker-name"]');
  const atkWpnEl = q('[data-testid="forecast-attacker-weapon"]');
  const atkHpEl = q('[data-testid="forecast-attacker-hp"]');
  const atkDmgEl = q('[data-testid="forecast-attacker-dmg"]');
  const atkHitEl = q('[data-testid="forecast-attacker-hit"]');
  const atkCritEl = q('[data-testid="forecast-attacker-crit"]');
  const atkCurBar = q('[data-attacker-hp-cur-bar]');
  const atkProjBar = q('[data-attacker-hp-proj-bar]');

  if (atkNameEl) atkNameEl.textContent = `${attacker.nickname}${attacker.isLord ? ' ★' : ''}`;
  if (atkWpnEl) atkWpnEl.textContent = atkSide.move.name;
  if (atkHpEl) atkHpEl.textContent = `${attacker.currentHp} → ${forecast.projectedAttackerHp}`;
  if (atkDmgEl) {
    atkDmgEl.textContent = atkSide.strikes === 2 ? `${atkSide.damage} ×2` : `${atkSide.damage}`;
  }
  if (atkHitEl) atkHitEl.textContent = `${atkSide.hitRate}%`;
  if (atkCritEl) atkCritEl.textContent = `${atkSide.critRate}%`;
  if (atkCurBar) {
    atkCurBar.style.width = `${Math.round((attacker.currentHp / attacker.maxHp) * 100)}%`;
  }
  if (atkProjBar) {
    atkProjBar.className = 'pmd-forecast-hp-bar-fill';
    atkProjBar.style.width = `${Math.round((forecast.projectedAttackerHp / attacker.maxHp) * 100)}%`;
  }

  const defNameEl = q('[data-testid="forecast-defender-name"]');
  const defMetaEl = q('[data-defender-meta]');
  const defWpnEl = q('[data-testid="forecast-defender-weapon"]');
  const defHpEl = q('[data-testid="forecast-defender-hp"]');
  const defDmgEl = q('[data-testid="forecast-defender-dmg"]');
  const defHitEl = q('[data-testid="forecast-defender-hit"]');
  const defCritEl = q('[data-testid="forecast-defender-crit"]');
  const defCurBar = q('[data-defender-hp-cur-bar]');
  const defProjBar = q('[data-defender-hp-proj-bar]');

  if (defNameEl) {
    defNameEl.textContent = `${defender.nickname}${defender.isBoss ? ' [BOSS]' : ''}`;
  }
  if (defMetaEl) {
    defMetaEl.innerHTML = '';
    let hasMeta = false;
    if (defender.stationary) {
      const immSpan = document.createElement('span');
      immSpan.textContent = 'Immovable';
      defMetaEl.appendChild(immSpan);
      hasMeta = true;
    }
    if (defender.droppableItemId && getItemById(defender.droppableItemId)) {
      if (hasMeta) {
        const sep = document.createElement('span');
        sep.textContent = ' · ';
        defMetaEl.appendChild(sep);
      }
      const dropChip = document.createElement('span');
      dropChip.className = 'pmd-hud-drop-chip';
      dropChip.dataset.testid = 'forecast-defender-drop-chip';
      const dropLbl = document.createElement('span');
      dropLbl.textContent = 'DROP';
      dropChip.append(
        dropLbl,
        createMiniItemIcon(defender.droppableItemId, { sizePx: 16, cropped: true })
      );
      defMetaEl.appendChild(dropChip);
      hasMeta = true;
    }
    defMetaEl.hidden = !hasMeta;
  }
  if (defHpEl) {
    defHpEl.textContent =
      forecast.projectedDefenderHp <= 0
        ? `${defender.currentHp} → 0 (KO!)`
        : `${defender.currentHp} → ${forecast.projectedDefenderHp}`;
  }

  if (forecast.defenderCanCounter && forecast.defenderSide) {
    const ds = forecast.defenderSide;
    if (defWpnEl) defWpnEl.textContent = `[E] ${ds.move.name}`;
    if (defDmgEl) defDmgEl.textContent = ds.strikes === 2 ? `${ds.damage} ×2` : `${ds.damage}`;
    if (defHitEl) defHitEl.textContent = `${ds.hitRate}%`;
    if (defCritEl) defCritEl.textContent = `${ds.critRate}%`;
  } else {
    if (defWpnEl) defWpnEl.textContent = 'No Counter';
    if (defDmgEl) defDmgEl.textContent = '—';
    if (defHitEl) defHitEl.textContent = '—';
    if (defCritEl) defCritEl.textContent = '—';
  }

  if (defCurBar) {
    defCurBar.style.width = `${Math.round((defender.currentHp / defender.maxHp) * 100)}%`;
  }
  if (defProjBar) {
    defProjBar.className = 'pmd-forecast-hp-bar-fill is-enemy';
    defProjBar.style.width = `${Math.round((forecast.projectedDefenderHp / defender.maxHp) * 100)}%`;
  }
}
