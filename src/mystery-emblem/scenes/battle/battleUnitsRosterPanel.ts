/**
 * Read-Only Deployed Squad `Units` Inspector Panel (`dungeon-units-panel`)
 *
 * Opened from Dungeon Field Menu -> `Units`. Displays a portrait grid of all `player`-faction
 * battle units in `state.units` (including fainted units shown dimmed with `'Pain'` portraits)
 * and a read-only tactical inspector (Lv/EXP, live HP & status/Fainted, 7 effective stats,
 * manual % growth rates w/ Hidden Potential +20%, skill, item, and 4 moves w/ Mt/Hit/Crit/PP/[E]).
 */

import { isMoveEquipped } from '../../data/equippedMoves';
import { getItemById, getPersonalSkillById, getSpeciesById } from '../../data/index';
import {
  STATUS_BADGE_COLORS,
  getUnitEffectiveCombatStats,
  isOffensiveMove,
} from '../../engine/combatEngine';
import { MAX_UNIT_LEVEL } from '../../engine/progressionEngine';
import { getEffectiveMovementPoints } from '../../engine/terrainAndPathfinding';
import type { OwnedPokemonInstance, StatBlockSeven } from '../../types/schemas';
import { createMiniItemIcon } from '../../ui/PmdItemIconGrid';
import { PmdPortraitView } from '../../ui/PmdSpriteCanvas';
import {
  escapeUiHtml,
  formatMoveCategoryBadge,
  populateUnitSevenStatBoxes,
} from '../../ui/inspector/UnitDetailCard';
import { bindPointerTap } from '../../ui/pointerControls';
import { renderColoredTypeHtml, renderColoredTypesHtml } from '../../ui/typeColors';
import type { BattleControllerContext } from './battleTypesAndState';
import { getLordUnit, getSelectedUnit, getUnitVisualKey } from './battleUnitQueries';
import { createRosterUnitPortraitBtn } from './battleUnitsRosterCell';

export function renderBattleUnitsRosterPanel(
  ctx: BattleControllerContext,
  cardEl: HTMLElement,
  onClose: () => void
): void {
  const { state, audioManager, abortSignal } = ctx;
  const playerUnits = state.units.filter((u) => u.faction === 'player');
  let activeUnitId =
    getSelectedUnit(state)?.id ?? getLordUnit(state)?.id ?? playerUnits[0]?.id ?? null;
  if (activeUnitId && !playerUnits.some((u) => u.id === activeUnitId)) {
    activeUnitId = playerUnits[0]?.id ?? null;
  }

  cardEl.dataset.testid = 'dungeon-units-panel';
  cardEl.classList.add('is-units-panel');
  cardEl.setAttribute('aria-label', 'Deployed Squad Units');

  const detailPortrait = new PmdPortraitView({
    pixelScale: 1,
    testId: 'dungeon-units-detail-portrait',
  });

  const renderPanel = () => {
    cardEl.innerHTML = '';
    const livingCount = playerUnits.filter((u) => !u.defeated && u.currentHp > 0).length;

    const headEl = document.createElement('div');
    headEl.className = 'pmd-dungeon-units-head';
    headEl.innerHTML = `
      <div>
        <h3 class="pmd-panel-title">UNITS</h3>
        <p class="pmd-panel-sub">${livingCount} / ${playerUnits.length} Active</p>
      </div>
      <button type="button" class="pmd-btn pmd-btn-primary" data-testid="battle-units-close-btn">Close</button>
    `;
    bindPointerTap(
      headEl.querySelector<HTMLElement>('[data-testid="battle-units-close-btn"]'),
      () => {
        audioManager.playSfx('cancel');
        onClose();
      },
      { signal: abortSignal }
    );

    const gridEl = document.createElement('div');
    gridEl.className = 'pmd-unit-portrait-grid pmd-dungeon-units-grid';
    gridEl.dataset.testid = 'dungeon-units-grid';
    for (const u of playerUnits) {
      gridEl.appendChild(
        createRosterUnitPortraitBtn(
          u,
          u.id === activeUnitId,
          () => {
            if (activeUnitId === u.id) return;
            audioManager.playSfx('select');
            activeUnitId = u.id;
            renderPanel();
          },
          abortSignal
        )
      );
    }
    cardEl.append(headEl, gridEl);

    const unit = playerUnits.find((u) => u.id === activeUnitId) ?? playerUnits[0];
    if (!unit) return;

    const isFainted = unit.defeated || unit.currentHp <= 0;
    const sp = getSpeciesById(unit.speciesId);
    const skill = getPersonalSkillById(unit.personalSkillId || sp?.personalSkillId || '');
    const hasHiddenPotential =
      unit.personalSkillId === 'hidden_potential' || sp?.personalSkillId === 'hidden_potential';
    const eff = getUnitEffectiveCombatStats(unit);
    const effMov = isFainted ? unit.mov : getEffectiveMovementPoints(unit);
    const speciesTag =
      unit.nickname.trim().toLowerCase() !== unit.speciesName.trim().toLowerCase()
        ? `${escapeUiHtml(unit.speciesName)} · `
        : '';
    const expLabel = unit.level >= MAX_UNIT_LEVEL ? 'MAX' : `${unit.exp ?? 0}/100`;

    let statusBadgeHtml: string;
    if (isFainted) {
      statusBadgeHtml = `<span class="pmd-unit-popup-status is-fainted" data-testid="dungeon-units-detail-status">Fainted</span>`;
    } else if (unit.status) {
      statusBadgeHtml = `<span class="pmd-unit-popup-status" data-testid="dungeon-units-detail-status" style="color:${STATUS_BADGE_COLORS[unit.status]}">${unit.status}</span>`;
    } else {
      statusBadgeHtml = `<span class="pmd-dungeon-units-state" data-testid="dungeon-units-detail-status">${unit.waited ? 'Waited' : 'Ready'}</span>`;
    }

    const hpPct = isFainted
      ? 0
      : Math.max(0, Math.min(100, Math.round((unit.currentHp / Math.max(1, unit.maxHp)) * 100)));

    const detailEl = document.createElement('div');
    detailEl.className = 'pmd-dungeon-units-detail';
    detailEl.dataset.testid = 'dungeon-units-detail';
    detailEl.innerHTML = `
      <div class="pmd-forecast-unit-head">
        <div class="pmd-forecast-portrait-slot" data-units-detail-portrait></div>
        <div class="pmd-forecast-unit-id">
          <strong class="pmd-forecast-unit-name" data-testid="dungeon-units-detail-name">${escapeUiHtml(unit.nickname)}</strong>
          <span class="pmd-forecast-unit-meta" data-testid="dungeon-units-detail-level-exp">${speciesTag}Lv ${unit.level} · EXP ${expLabel}</span>
          <span class="pmd-forecast-unit-meta"><span data-testid="dungeon-units-detail-types">${renderColoredTypesHtml(unit.types, ' / ')}</span> · ${escapeUiHtml(unit.traversalClass)}</span>
        </div>
      </div>
      <div class="pmd-dungeon-units-hp-box">
        <div class="pmd-unit-popup-hp-row">
          <span class="pmd-unit-popup-lbl">HP</span>
          <strong data-testid="dungeon-units-detail-hp">${isFainted ? 0 : unit.currentHp} / ${unit.maxHp}</strong>
          ${statusBadgeHtml}
        </div>
        <div class="pmd-forecast-hp-bar-track pmd-unit-popup-hp-bar">
          <div class="pmd-forecast-hp-bar-fill" style="width:${hpPct}%"></div>
        </div>
      </div>
      <div class="pmd-prep-stats-grid" data-testid="dungeon-units-detail-stats"></div>
      <div class="pmd-dungeon-units-subbox" data-testid="dungeon-units-detail-growths"></div>
      <div class="pmd-dungeon-units-subbox">
        <div class="pmd-dungeon-units-kv" data-testid="dungeon-units-detail-skill">
          <strong>${escapeUiHtml(skill?.name ?? 'Ability')}</strong>
          <span>${escapeUiHtml(skill?.description ?? '—')}</span>
        </div>
        <div class="pmd-dungeon-units-kv" data-testid="dungeon-units-detail-item"></div>
      </div>
      <div class="pmd-dungeon-units-moves" data-testid="dungeon-units-detail-moves"></div>
    `;

    detailEl.querySelector('[data-units-detail-portrait]')?.appendChild(detailPortrait.canvas);
    void detailPortrait.setPortrait({
      speciesIdOrAssetId: getUnitVisualKey(unit),
      emotion: isFainted ? 'Pain' : 'Normal',
    });

    const statsEl = detailEl.querySelector<HTMLElement>('[data-testid="dungeon-units-detail-stats"]')!;
    const effectiveSeven: StatBlockSeven = {
      hp: unit.maxHp,
      atk: eff.atk,
      def: eff.def,
      spa: eff.spa,
      spd: eff.spd,
      spe: eff.spe,
      mov: effMov,
    };
    populateUnitSevenStatBoxes(
      statsEl,
      { currentStats: effectiveSeven } as OwnedPokemonInstance,
      'prep'
    );
    const basePairs: Array<[keyof StatBlockSeven, number]> = [
      ['hp', unit.stats.hp],
      ['atk', unit.stats.atk],
      ['def', unit.stats.def],
      ['spa', unit.stats.spa],
      ['spd', unit.stats.spd],
      ['spe', unit.stats.spe],
      ['mov', unit.mov],
    ];
    const statCells = statsEl.querySelectorAll<HTMLElement>('.pmd-prep-stat-box');
    basePairs.forEach(([key, baseVal], idx) => {
      const cell = statCells[idx];
      const valEl = cell?.querySelector<HTMLElement>('.pmd-prep-stat-val');
      if (!cell || !valEl) return;
      cell.dataset.testid = `dungeon-units-stat-${key}`;
      const delta = effectiveSeven[key] - baseVal;
      if (delta !== 0) {
        cell.classList.add(delta > 0 ? 'is-buffed' : 'is-debuffed');
        valEl.textContent = `${effectiveSeven[key]} (${delta > 0 ? `+${delta}` : delta})`;
      }
    });

    const growthsEl = detailEl.querySelector<HTMLElement>('[data-testid="dungeon-units-detail-growths"]')!;
    if (sp) {
      const bonus = hasHiddenPotential ? 20 : 0;
      const gEntries: Array<[string, number]> = [
        ['HP', Math.min(100, sp.growthRates.hp + bonus)],
        ['ATK', Math.min(100, sp.growthRates.atk + bonus)],
        ['DEF', Math.min(100, sp.growthRates.def + bonus)],
        ['SPA', Math.min(100, sp.growthRates.spa + bonus)],
        ['SPD', Math.min(100, sp.growthRates.spd + bonus)],
        ['SPE', Math.min(100, sp.growthRates.spe + bonus)],
      ];
      growthsEl.innerHTML = `
        <span class="pmd-dungeon-units-kicker">Growth Rates${hasHiddenPotential ? ' (+20% Hidden Potential)' : ''}</span>
        <div class="pmd-dungeon-units-growth-strip${hasHiddenPotential ? ' is-boosted' : ''}">
          ${gEntries.map(([lbl, pct]) => `<span><em>${lbl}</em> <strong>${pct}%</strong></span>`).join('')}
        </div>
      `;
    }

    const itemSlotEl = detailEl.querySelector<HTMLElement>('[data-testid="dungeon-units-detail-item"]')!;
    const itemIds = [unit.heldItemId, unit.consumableItemId].filter((id): id is string => Boolean(id));
    if (itemIds.length === 0) {
      itemSlotEl.innerHTML = `<strong>Item: Empty</strong>`;
    } else {
      for (const id of itemIds) {
        const def = getItemById(id);
        if (!def) continue;
        const row = document.createElement('div');
        row.className = 'pmd-inline-item-row';
        row.appendChild(createMiniItemIcon(def.id, { sizePx: 18, cropped: true }));
        const txt = document.createElement('span');
        txt.innerHTML = `<strong>${escapeUiHtml(def.name)}</strong> — ${escapeUiHtml(def.description)}`;
        row.appendChild(txt);
        itemSlotEl.appendChild(row);
      }
    }

    const movesEl = detailEl.querySelector<HTMLElement>('[data-testid="dungeon-units-detail-moves"]')!;
    movesEl.innerHTML = unit.activeMoves
      .map((slot) => {
        const isEq = isMoveEquipped(unit, slot.id) && isOffensiveMove(slot.move);
        const mtLbl = isOffensiveMove(slot.move) ? String(slot.move.mt) : '—';
        return `
          <div class="pmd-dungeon-units-move${isEq ? ' is-equipped' : ''}" data-testid="dungeon-units-move-${escapeUiHtml(slot.id)}">
            <div class="pmd-dungeon-units-move-top">
              <strong>${isEq ? '[E] ' : ''}${escapeUiHtml(slot.move.name)}</strong>
              <span>${renderColoredTypeHtml(slot.move.type)} · ${escapeUiHtml(formatMoveCategoryBadge(slot.move))}</span>
            </div>
            <div class="pmd-dungeon-units-move-stats">Mt ${mtLbl} · Hit ${slot.move.hit}% · Crit ${slot.move.crit}% · PP ${slot.ppRemaining}/${slot.maxPp}</div>
          </div>
        `;
      })
      .join('');

    cardEl.appendChild(detailEl);
  };

  renderPanel();
}
