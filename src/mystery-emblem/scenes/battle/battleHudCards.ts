/**
 * Bottom-Left Stacked Tile Info Card (`dungeon-tile-display`) & Character Info Card (`dungeon-unit-popup`)
 */

import { getItemById } from '../../data/index';
import { STATUS_BADGE_COLORS, computeUnitPopupStats, type BattleUnitState } from '../../engine/combatEngine';
import {
  TERRAIN_METADATA,
  getMapTerrainAt,
  getTerrainBonuses,
  getTerrainMoveCost,
} from '../../engine/terrainAndPathfinding';
import { createMiniItemIcon } from '../../ui/PmdItemIconGrid';
import { renderColoredTypeHtml, renderColoredTypesHtml } from '../../ui/typeColors';
import {
  canInteractWithBattleViewport,
  syncHoverDangerArea,
} from './battleDangerAndViewportState';
import type { BattleControllerContext } from './battleTypesAndState';
import {
  escapeHudHtml,
  getLivingUnits,
  getSelectedUnit,
  getUnitVisualKey,
} from './battleUnitQueries';

export function updateBattleInfoStrip(ctx: BattleControllerContext): void {
  const { state, dom } = ctx;
  const cursor = state.hoveredTile ?? state.inspectedTile;
  const terrain = getMapTerrainAt(state.map, cursor.x, cursor.y) ?? 'floor';
  const meta = TERRAIN_METADATA[terrain];
  const occupant = getLivingUnits(state).find((u) => u.x === cursor.x && u.y === cursor.y);
  const contextUnit = getSelectedUnit(state) ?? occupant;
  const unitForTerrain = contextUnit ?? {
    traversalClass: 'Grounded' as const,
    types: [] as const,
    heldItemId: null,
  };

  const cost = getTerrainMoveCost(terrain, unitForTerrain);
  const bonuses = getTerrainBonuses(terrain, unitForTerrain);

  let movChip: string;
  if (cost !== null) {
    movChip = `Mov ${cost}`;
  } else if (!contextUnit) {
    if (terrain === 'water') movChip = 'Water/Fly';
    else if (terrain === 'lava') movChip = 'Fire/Fly';
    else if (terrain === 'void' || terrain === 'barrier') movChip = 'Lev Only';
    else movChip = 'Mov —';
  } else {
    movChip = 'Mov —';
  }

  const defChip = `Def +${bonuses.defBonus}`;
  const avoChip = `Avo +${bonuses.avoidBonus}%`;
  const specialChip =
    terrain === 'wonder_tile' ? '+20% HP' : terrain === 'stairs' ? 'Stairs' : null;

  dom.infoStripEl.dataset.terrain = terrain;
  dom.infoStripEl.innerHTML = `
    <div class="pmd-tile-box-head">
      <strong class="pmd-tile-box-name" data-testid="dungeon-tile-name">${escapeHudHtml(meta.label)}</strong>
      ${specialChip ? `<span class="pmd-tile-chip is-special">${escapeHudHtml(specialChip)}</span>` : ''}
    </div>
    <div class="pmd-tile-box-chips">
      <span class="pmd-tile-chip" data-testid="dungeon-tile-mov">${escapeHudHtml(movChip)}</span>
      <span class="pmd-tile-chip" data-testid="dungeon-tile-def">${escapeHudHtml(defChip)}</span>
      <span class="pmd-tile-chip" data-testid="dungeon-tile-avo">${escapeHudHtml(avoChip)}</span>
    </div>
    ${state.prepMapStatusNotice ? `<div class="pmd-tile-box-notice" data-testid="dungeon-tile-notice">${escapeHudHtml(state.prepMapStatusNotice)}</div>` : ''}
  `;

  syncHoverDangerArea(ctx);
  updateUnitHoverPopup(ctx);
}

export function getPopupTargetUnit(ctx: BattleControllerContext): BattleUnitState | null {
  const { state, dom, prepOverlay, tutorialOverlay } = ctx;
  if (!canInteractWithBattleViewport(state, dom, prepOverlay, tutorialOverlay)) {
    return null;
  }
  const inViewMap =
    state.phase === 'dungeon_prep' &&
    prepOverlay.isOpen() &&
    prepOverlay.getSubMode() === 'view_map';
  if (state.phase !== 'player_phase' && !inViewMap) {
    return null;
  }
  if (state.interactionState !== 'idle' && state.interactionState !== 'unit_selected') {
    return null;
  }

  if (state.hoveredTile !== null) {
    const { x, y } = state.hoveredTile;
    return getLivingUnits(state).find((u) => u.x === x && u.y === y) ?? null;
  }
  if (state.touchInspectedUnitId !== null) {
    return getLivingUnits(state).find((u) => u.id === state.touchInspectedUnitId) ?? null;
  }
  return null;
}

export function updateUnitHoverPopup(ctx: BattleControllerContext): void {
  const { state, dom } = ctx;
  const unit = getPopupTargetUnit(ctx);
  if (!unit) {
    dom.unitPopupEl.hidden = true;
    return;
  }

  const isEnemy = unit.faction === 'enemy';
  const isNpc = unit.faction === 'npc';
  dom.unitPopupEl.className = `pmd-window pmd-unit-hover-popup ${
    isEnemy ? 'is-enemy' : isNpc ? 'is-npc' : 'is-player'
  }`;
  dom.unitPopupEl.dataset.unitId = unit.id;
  dom.unitPopupEl.dataset.faction = unit.faction;

  const visKey = getUnitVisualKey(unit);
  const speciesKey = `${visKey}:${unit.faction}`;
  if (state.renderedPopupSpeciesKey !== speciesKey) {
    state.renderedPopupSpeciesKey = speciesKey;
    void dom.unitPopupPortraitView.setPortrait({
      speciesIdOrAssetId: visKey,
      emotion: 'Normal',
      mirrorHorizontal: isEnemy,
    });
  }

  const rolePipEl = dom.unitPopupEl.querySelector<HTMLElement>('[data-popup-role-pip]');
  if (rolePipEl) {
    if (unit.isLord) {
      rolePipEl.textContent = '★';
      rolePipEl.hidden = false;
    } else if (unit.isBoss) {
      rolePipEl.textContent = 'BOSS';
      rolePipEl.hidden = false;
    } else if (isNpc) {
      rolePipEl.textContent = 'ALLY';
      rolePipEl.hidden = false;
    } else {
      rolePipEl.hidden = true;
    }
  }

  const statusEl = dom.unitPopupEl.querySelector<HTMLElement>('[data-popup-status]');
  if (statusEl) {
    if (unit.status) {
      statusEl.textContent = unit.status;
      statusEl.dataset.testid = 'unit-popup-status';
      statusEl.style.color = STATUS_BADGE_COLORS[unit.status];
      statusEl.hidden = false;
    } else {
      statusEl.hidden = true;
    }
  }

  const typesEl = dom.unitPopupEl.querySelector<HTMLElement>('[data-testid="unit-popup-types"]');
  if (typesEl) {
    typesEl.innerHTML = renderColoredTypesHtml(unit.types, ' / ');
  }

  const hpTextEl = dom.unitPopupEl.querySelector('[data-testid="unit-popup-hp"]');
  if (hpTextEl) {
    hpTextEl.textContent = `${unit.currentHp}/${unit.maxHp}`;
  }
  const hpFillEl = dom.unitPopupEl.querySelector<HTMLElement>('[data-popup-hp-fill]');
  if (hpFillEl) {
    hpFillEl.className = `pmd-forecast-hp-bar-fill${
      isEnemy ? ' is-enemy' : isNpc ? ' is-npc' : ''
    }`;
    hpFillEl.style.width = `${Math.max(0, Math.min(100, Math.round((unit.currentHp / unit.maxHp) * 100)))}%`;
  }

  const summary = computeUnitPopupStats(state.map, unit);
  const mightEl = dom.unitPopupEl.querySelector('[data-testid="unit-popup-might"]');
  const defEl = dom.unitPopupEl.querySelector('[data-testid="unit-popup-def"]');
  const spdEl = dom.unitPopupEl.querySelector('[data-testid="unit-popup-spd"]');
  if (mightEl) mightEl.textContent = summary.might !== null ? String(summary.might) : '—';
  if (defEl) defEl.textContent = String(summary.effectiveDef);
  if (spdEl) spdEl.textContent = String(summary.effectiveSpd);

  const movesWrap = dom.unitPopupEl.querySelector<HTMLElement>(
    '[data-testid="unit-popup-moves"]'
  );
  if (movesWrap) {
    movesWrap.innerHTML = unit.activeMoves
      .map((slot) => {
        const isEq = slot.id === unit.equippedMoveId && slot.move.category !== 'Support/Heal';
        const rLbl = slot.range[0] === slot.range[1] ? `R${slot.range[0]}` : `R${slot.range[0]}-${slot.range[1]}`;
        return `<div class="pmd-unit-popup-move${isEq ? ' is-equipped' : ''}"><span>${isEq ? '[E] ' : ''}${escapeHudHtml(slot.move.name)}</span><em>${renderColoredTypeHtml(slot.move.type)} · ${rLbl}</em></div>`;
      })
      .join('');
  }

  const itemEl = dom.unitPopupEl.querySelector<HTMLElement>('[data-testid="unit-popup-item"]');
  if (itemEl) {
    const hasHeld = Boolean(unit.heldItemId && getItemById(unit.heldItemId));
    const hasCons = Boolean(unit.consumableItemId && getItemById(unit.consumableItemId));
    const hasDrop = Boolean(unit.droppableItemId && getItemById(unit.droppableItemId));
    const itemKey = `${hasHeld ? unit.heldItemId : ''}|${hasCons ? unit.consumableItemId : ''}|${hasDrop ? unit.droppableItemId : ''}`;
    if (!hasHeld && !hasCons && !hasDrop) {
      itemEl.dataset.itemKey = '';
      itemEl.innerHTML = '';
      itemEl.hidden = true;
    } else {
      if (itemEl.dataset.itemKey !== itemKey) {
        itemEl.dataset.itemKey = itemKey;
        itemEl.innerHTML = '';
        if (hasHeld && unit.heldItemId) {
          itemEl.appendChild(createMiniItemIcon(unit.heldItemId, { sizePx: 18, cropped: true }));
        }
        if (hasCons && unit.consumableItemId) {
          itemEl.appendChild(
            createMiniItemIcon(unit.consumableItemId, { sizePx: 18, cropped: true })
          );
        }
        if (hasDrop && unit.droppableItemId) {
          const dropChip = document.createElement('span');
          dropChip.className = 'pmd-hud-drop-chip';
          const dropLbl = document.createElement('span');
          dropLbl.textContent = 'DROP';
          dropChip.append(
            dropLbl,
            createMiniItemIcon(unit.droppableItemId, { sizePx: 16, cropped: true })
          );
          itemEl.appendChild(dropChip);
        }
      }
      itemEl.hidden = false;
    }
  }

  dom.unitPopupEl.hidden = false;
}

export function positionActiveUnitHoverPopup(ctx: BattleControllerContext): void {
  if (ctx.dom.unitPopupEl.hidden) return;
  if (!getPopupTargetUnit(ctx)) {
    ctx.dom.unitPopupEl.hidden = true;
  }
}
