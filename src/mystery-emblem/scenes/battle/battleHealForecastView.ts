/**
 * Fire Emblem Interlocking 'L'-Shape Support / Heal Forecast DOM Updater
 */

import { directionFromDelta } from '../../assets/pmdAssetLoader';
import { computeHealForecast } from '../../engine/combatEngine';
import { createMiniSpeciesPortrait } from '../../ui/PmdUnitPortraitGrid';
import { bindPointerTap } from '../../ui/pointerControls';
import {
  getValidForecastMoves,
  renderForecastMoveList,
  setForecastStatLabels,
} from './battleForecastMoveList';
import type { BattleControllerContext } from './battleTypesAndState';
import {
  getHealableTargetsFromCurrentTile,
  getSelectedUnit,
  getUnitVisualKey,
} from './battleUnitQueries';

export function refreshHealForecastModalDom(ctx: BattleControllerContext): void {
  const { state, dom, audioManager, abortSignal } = ctx;
  const healer = getSelectedUnit(state);
  const target = state.units.find(
    (u) => u.id === state.forecastTargetId && !u.defeated && u.currentHp > 0
  );
  if (!healer || !target) return;

  const allHealTargets = getHealableTargetsFromCurrentTile(state, healer);
  const validMoves = getValidForecastMoves(state);
  if (validMoves.length === 0) return;

  if (!state.forecastMoveId || !validMoves.some((m) => m.id === state.forecastMoveId)) {
    state.forecastMoveId = validMoves[0]!.id;
  }
  const activeSlot = validMoves.find((m) => m.id === state.forecastMoveId) ?? validMoves[0]!;

  const healForecast = computeHealForecast(state.map, healer, target, state.forecastMoveId);
  if (!healForecast) return;
  state.currentHealForecast = healForecast;

  const backdrop = dom.forecastModalBackdropEl;
  const titleEl = backdrop.querySelector('[data-forecast-title]');
  if (titleEl) titleEl.textContent = 'HEAL FORECAST';
  const defCardEl = backdrop.querySelector<HTMLElement>('[data-testid="forecast-defender-card"]');
  if (defCardEl) defCardEl.className = 'pmd-fe-enemy-box is-ally-heal';
  const confirmBtnEl = backdrop.querySelector<HTMLElement>('[data-testid="forecast-attack-btn"]');
  if (confirmBtnEl) confirmBtnEl.textContent = 'Heal!';

  renderForecastMoveList(ctx, healer, validMoves, activeSlot.id, () =>
    refreshHealForecastModalDom(ctx)
  );
  setForecastStatLabels(backdrop, {
    atk2: 'HEAL',
    atk3: 'HIT',
    atk4: 'PP',
    def2: 'GAIN',
    def3: 'MAX',
    def4: 'STAT',
  });

  void dom.attackerPortraitView.setPortrait({
    speciesIdOrAssetId: getUnitVisualKey(healer),
    emotion: 'Happy',
    mirrorHorizontal: false,
  });
  void dom.defenderPortraitView.setPortrait({
    speciesIdOrAssetId: getUnitVisualKey(target),
    emotion: 'Happy',
    mirrorHorizontal: true,
  });

  const effBadgeEl = backdrop.querySelector<HTMLElement>(
    '[data-testid="forecast-effectiveness-badge"]'
  );
  if (effBadgeEl) {
    effBadgeEl.textContent = `+${healForecast.actualHeal} HP`;
    effBadgeEl.className = 'pmd-forecast-eff-badge is-super';
    effBadgeEl.hidden = false;
  }

  const targetsWrap = backdrop.querySelector<HTMLElement>('[data-forecast-targets-wrap]');
  const targetsRow = backdrop.querySelector<HTMLElement>('[data-forecast-targets]');
  if (targetsWrap && targetsRow) {
    targetsRow.innerHTML = '';
    if (allHealTargets.length > 1) {
      targetsWrap.hidden = false;
      for (const entry of allHealTargets) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `pmd-btn pmd-chip-btn pmd-portrait-action-btn${entry.ally.id === target.id ? ' is-active' : ''}`;
        btn.dataset.testid = `forecast-target-${entry.ally.id}`;
        btn.appendChild(
          createMiniSpeciesPortrait(getUnitVisualKey(entry.ally), { sizePx: 20 })
        );
        const hpSpan = document.createElement('span');
        hpSpan.textContent = `${entry.ally.currentHp}/${entry.ally.maxHp}`;
        btn.appendChild(hpSpan);
        bindPointerTap(
          btn,
          () => {
            audioManager.playSfx('select');
            state.forecastTargetId = entry.ally.id;
            if (entry.ally.id !== healer.id) {
              healer.direction = directionFromDelta(
                entry.ally.x - healer.x,
                entry.ally.y - healer.y
              );
            }
            refreshHealForecastModalDom(ctx);
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

  const healerProjectedHp =
    target.id === healer.id ? healForecast.projectedTargetHp : healer.currentHp;
  if (atkNameEl) atkNameEl.textContent = `${healer.nickname}${healer.isLord ? ' ★' : ''}`;
  if (atkWpnEl) atkWpnEl.textContent = healForecast.move.name;
  if (atkHpEl) {
    atkHpEl.textContent =
      target.id === healer.id
        ? `${healer.currentHp} → ${healerProjectedHp}`
        : `${healer.currentHp}/${healer.maxHp}`;
  }
  if (atkDmgEl) atkDmgEl.textContent = `+${healForecast.actualHeal}`;
  if (atkHitEl) atkHitEl.textContent = '100%';
  if (atkCritEl) atkCritEl.textContent = `${healForecast.ppAfter}/${activeSlot.maxPp}`;
  if (atkCurBar) {
    atkCurBar.style.width = `${Math.round((healer.currentHp / healer.maxHp) * 100)}%`;
  }
  if (atkProjBar) {
    atkProjBar.className = 'pmd-forecast-hp-bar-fill';
    atkProjBar.style.width = `${Math.round((healerProjectedHp / healer.maxHp) * 100)}%`;
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

  if (defNameEl) defNameEl.textContent = `${target.nickname}${target.isLord ? ' ★' : ''}`;
  if (defMetaEl) {
    defMetaEl.textContent = '';
    defMetaEl.hidden = true;
  }
  if (defWpnEl) defWpnEl.textContent = `+${healForecast.actualHeal} HP`;
  if (defHpEl) defHpEl.textContent = `${target.currentHp} → ${healForecast.projectedTargetHp}`;
  if (defDmgEl) defDmgEl.textContent = `+${healForecast.actualHeal}`;
  if (defHitEl) defHitEl.textContent = `${target.maxHp}`;
  if (defCritEl) {
    defCritEl.textContent = healForecast.curesStatus ? 'Cured!' : (target.status ?? 'OK');
  }
  if (defCurBar) {
    defCurBar.style.width = `${Math.round((target.currentHp / target.maxHp) * 100)}%`;
  }
  if (defProjBar) {
    defProjBar.className = 'pmd-forecast-hp-bar-fill is-heal';
    defProjBar.style.width = `${Math.round((healForecast.projectedTargetHp / target.maxHp) * 100)}%`;
  }
}
