/**
 * Mystery Emblem — Chapter Prep `Manage Units` Renderer (`PrepUnitsRenderer.ts`)
 */

import { resolveUnitVisualAssetId } from '../../assets/pmdAssetLoader';
import type { AudioManager } from '../../audio/AudioManager';
import { getItemById, getPersonalSkillById, getSpeciesById } from '../../data/index';
import { getUnitEquippedItemId, type SaveStateManager } from '../../state/SaveStateManager';
import type { SaveData } from '../../types/schemas';
import { createMiniItemIcon } from '../PmdItemIconGrid';
import type { PmdPortraitView } from '../PmdSpriteCanvas';
import { createUnitPortraitCell } from '../PmdUnitPortraitGrid';
import { renderPrepMoveLoadout, renderTmStripInspector } from '../inspector/MoveLoadoutEditor';
import {
  escapeUiHtml,
  populateUnitSevenStatBoxes,
  renderPrepPromotionShortcutRow,
} from '../inspector/UnitDetailCard';
import { bindPointerTap } from '../pointerControls';
import { getElementalTypeColor } from '../typeColors';

export interface PrepUnitsRenderContext {
  unitsBackdropEl: HTMLElement;
  unitPortraitView: PmdPortraitView;
  saveManager: SaveStateManager;
  save: SaveData;
  audioManager: AudioManager;
  signal: AbortSignal;
  selectedUnitInstanceId: string | null;
  selectedPrepUnitTmId: string | null;
  pendingMoveToSwapIn: string | null;
  unitsStatusMsg: string;
  deployedCount: number;
  deploymentCap: number;
  isUnitDeployed: (instanceId: string) => boolean;
  onSelectUnit: (instanceId: string) => void;
  onToggleDeployUnit: (instanceId: string) => { ok: boolean; message: string };
  onSetStatusAndRefresh: (msg: string, opts?: { mutated?: boolean; refreshHub?: boolean }) => void;
  onSetPendingMoveSwap: (moveId: string | null, msg: string) => void;
  onSelectUnitTm: (tmId: string) => void;
}

export function renderPrepManageUnits(ctx: PrepUnitsRenderContext): string | null {
  const {
    unitsBackdropEl, unitPortraitView, saveManager, save, audioManager, signal,
    selectedUnitInstanceId, selectedPrepUnitTmId, pendingMoveToSwapIn, unitsStatusMsg,
    deployedCount, deploymentCap, isUnitDeployed, onSelectUnit, onToggleDeployUnit,
    onSetStatusAndRefresh, onSetPendingMoveSwap, onSelectUnitTm,
  } = ctx;

  const counterEl = unitsBackdropEl.querySelector('[data-testid="prep-deploy-counter"]');
  if (counterEl) counterEl.textContent = `${deployedCount} / ${deploymentCap} Deployed`;

  const listEl = unitsBackdropEl.querySelector<HTMLElement>('[data-testid="prep-roster-list"]');
  if (listEl) {
    listEl.innerHTML = '';
    for (const unit of save.roster) {
      const isSelected = unit.instanceId === selectedUnitInstanceId;
      const isDeployed = isUnitDeployed(unit.instanceId);
      const itemId = getUnitEquippedItemId(unit);

      listEl.appendChild(
        createUnitPortraitCell({
          speciesIdOrAssetId: resolveUnitVisualAssetId(unit.speciesId, unit.cosmeticForm),
          ariaLabel: unit.nickname,
          isSelected,
          isLord: unit.isLord,
          isDeployed,
          isBenched: !isDeployed,
          hasItem: Boolean(itemId),
          equippedItemId: itemId,
          testId: `prep-unit-row-${unit.instanceId}`,
          portraitTestId: `prep-unit-portrait-cell-${unit.instanceId}`,
          signal,
          onSelect: () => { audioManager.playSfx('select'); onSelectUnit(unit.instanceId); },
        })
      );
    }
  }

  const selected = save.roster.find((u) => u.instanceId === selectedUnitInstanceId);
  if (!selected) return selectedPrepUnitTmId;
  const sp = getSpeciesById(selected.speciesId);
  if (!sp) return selectedPrepUnitTmId;

  void unitPortraitView.setPortrait({
    speciesIdOrAssetId: resolveUnitVisualAssetId(selected.speciesId, selected.cosmeticForm),
    emotion: selected.isLord ? 'Determined' : 'Normal',
    mirrorHorizontal: false,
  });

  const nickEl = unitsBackdropEl.querySelector('[data-testid="prep-detail-nickname"]');
  if (nickEl) nickEl.textContent = `${selected.nickname}`;

  const deploySlotEl = unitsBackdropEl.querySelector<HTMLElement>('[data-prep-deploy-slot]');
  if (deploySlotEl) {
    deploySlotEl.innerHTML = '';
    const isSelectedDeployed = isUnitDeployed(selected.instanceId);
    const deployBtn = document.createElement('button');
    deployBtn.type = 'button';
    deployBtn.dataset.testid = `prep-unit-deploy-btn-${selected.instanceId}`;
    if (selected.isLord) {
      deployBtn.className = 'pmd-btn pmd-chip-btn is-active pmd-prep-deploy-btn';
      deployBtn.textContent = '★ Locked';
      deployBtn.disabled = true;
    } else if (isSelectedDeployed) {
      deployBtn.className = 'pmd-btn pmd-chip-btn is-active pmd-prep-deploy-btn';
      deployBtn.textContent = 'Standby';
      bindPointerTap(deployBtn, () => {
        const res = onToggleDeployUnit(selected.instanceId);
        audioManager.playSfx(res.ok ? 'select' : 'cancel');
        onSetStatusAndRefresh(res.message, { refreshHub: true });
      }, { signal });
    } else {
      const capFull = deployedCount >= deploymentCap;
      deployBtn.className = `pmd-btn pmd-chip-btn pmd-prep-deploy-btn${capFull ? '' : ' pmd-btn-primary'}`;
      deployBtn.textContent = capFull ? 'Full' : '+ Deploy';
      deployBtn.disabled = capFull;
      bindPointerTap(deployBtn, () => {
        const res = onToggleDeployUnit(selected.instanceId);
        audioManager.playSfx(res.ok ? 'select' : 'cancel');
        onSetStatusAndRefresh(res.message, { refreshHub: true });
      }, { signal });
    }
    deploySlotEl.appendChild(deployBtn);
  }

  const metaEl = unitsBackdropEl.querySelector('[data-testid="prep-detail-meta"]');
  if (metaEl) {
    const speciesPrefix = selected.nickname.trim().toLowerCase() !== sp.name.trim().toLowerCase() ? `${sp.name} · ` : '';
    metaEl.textContent = `${speciesPrefix}Lv. ${selected.level} (EXP ${selected.exp}/100)`;
  }

  const badgesEl = unitsBackdropEl.querySelector<HTMLElement>('[data-testid="prep-unit-types"]');
  if (badgesEl) {
    const typeBadges = sp.types
      .map((t) => {
        const color = getElementalTypeColor(t);
        return `<span class="pmd-prep-type-pill pmd-type-text" data-el-type="${escapeUiHtml(t)}" style="color:${color}; border-color:${color};">${escapeUiHtml(t)}</span>`;
      })
      .join('');
    badgesEl.innerHTML = `${typeBadges}<span class="pmd-prep-traversal-pill" data-testid="prep-unit-traversal">${escapeUiHtml(sp.traversalClass)}</span>`;
  }

  const skill = getPersonalSkillById(sp.personalSkillId);
  const abilityEl = unitsBackdropEl.querySelector<HTMLElement>('[data-testid="prep-unit-ability"]');
  if (abilityEl) {
    abilityEl.innerHTML = `<span class="pmd-prep-ability-title"><strong>${escapeUiHtml(skill?.name ?? sp.personalSkillId)}</strong> — ${escapeUiHtml(skill?.description ?? '—')}</span>`;
  }

  const eqItemId = getUnitEquippedItemId(selected);
  const eqItem = eqItemId ? getItemById(eqItemId) : undefined;
  const itemSumEl = unitsBackdropEl.querySelector<HTMLElement>('[data-testid="prep-unit-item-summary"]');
  const itemBtnEl = unitsBackdropEl.querySelector<HTMLElement>('[data-testid="prep-unit-open-items-btn"]');
  if (itemSumEl) {
    itemSumEl.innerHTML = '';
    if (eqItem) {
      const wrap = document.createElement('span');
      wrap.className = 'pmd-inline-item-row';
      const lbl = document.createElement('span');
      lbl.textContent = 'Item:';
      wrap.append(lbl, createMiniItemIcon(eqItem.id, { sizePx: 20 }));
      itemSumEl.appendChild(wrap);
    } else itemSumEl.innerHTML = 'Item: <strong>Empty</strong>';
  }
  if (itemBtnEl) itemBtnEl.textContent = eqItem ? 'Change' : 'Equip';

  renderPrepPromotionShortcutRow({
    promoWrapEl: unitsBackdropEl.querySelector<HTMLElement>('[data-prep-promo-wrap]'),
    unit: selected,
    save,
    saveManager,
    audioManager,
    onPromoted: (msg) => onSetStatusAndRefresh(msg, { mutated: true, refreshHub: true }),
    onError: (msg) => onSetStatusAndRefresh(msg),
  });

  const statsEl = unitsBackdropEl.querySelector<HTMLElement>('[data-testid="prep-unit-stats"]');
  if (statsEl) populateUnitSevenStatBoxes(statsEl, selected, 'prep');

  renderPrepMoveLoadout({
    unit: selected,
    saveManager,
    audioManager,
    activeHeadingEl: unitsBackdropEl.querySelector('[data-prep-active-moves-heading]'),
    activeListEl: unitsBackdropEl.querySelector<HTMLElement>('[data-testid="prep-active-moves"]'),
    unlockedWrapEl: unitsBackdropEl.querySelector<HTMLElement>('[data-prep-unlocked-wrap]'),
    unlockedListEl: unitsBackdropEl.querySelector<HTMLElement>('[data-testid="prep-unlocked-moves"]'),
    pendingMoveToSwapIn,
    onSetPendingSwap: onSetPendingMoveSwap,
    onMutated: (msg) => onSetStatusAndRefresh(msg, { mutated: true }),
  });

  let nextTmId = selectedPrepUnitTmId;
  const tmWrap = unitsBackdropEl.querySelector<HTMLElement>('[data-prep-tm-wrap]');
  const tmListEl = unitsBackdropEl.querySelector<HTMLElement>('[data-testid="prep-compatible-tms"]');
  if (tmWrap && tmListEl) {
    tmListEl.innerHTML = '';
    tmListEl.className = 'pmd-prep-items-list';
    const res = renderTmStripInspector({
      containerEl: tmListEl, unit: selected, save, onlyCompatibleUnknown: true,
      selectedTmId: selectedPrepUnitTmId, cellTestIdPrefix: 'prep-tm-cell-',
      teachBtnTestIdPrefix: 'prep-teach-tm-', signal, saveManager, audioManager,
      onSelectTm: onSelectUnitTm,
      onTaught: (msg) => onSetStatusAndRefresh(msg, { mutated: true }),
    });
    tmWrap.hidden = res.renderedCount === 0;
    nextTmId = res.resolvedSelectedTmId;
  }

  const statusEl = unitsBackdropEl.querySelector<HTMLElement>('[data-testid="prep-units-status"]');
  if (statusEl) {
    statusEl.hidden = !unitsStatusMsg;
    statusEl.textContent = unitsStatusMsg;
  }
  return nextTmId;
}
