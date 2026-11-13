/**
 * Mystery Emblem - Shared Acquired-Item Action Inspector (`ItemActionInspector.ts`)
 */

import { resolveUnitVisualAssetId } from '../../assets/pmdAssetLoader';
import type { AudioManager } from '../../audio/AudioManager';
import { ITEMS_LIST, getItemById, getMoveById, getSpeciesById } from '../../data/index';
import { getUnitEquippedItemId, type SaveStateManager } from '../../state/SaveStateManager';
import type { ItemDefinition, OwnedPokemonInstance, SaveData } from '../../types/schemas';
import { createItemIconCell, createMiniItemIcon } from '../PmdItemIconGrid';
import { createMiniSpeciesPortrait } from '../PmdUnitPortraitGrid';
import { bindPointerTap } from '../pointerControls';
import { renderColoredTypeHtml } from '../typeColors';
import { escapeUiHtml, formatItemCategoryLabel } from './UnitDetailCard';

export type ItemFilterTab = 'all' | 'held' | 'healing' | 'x_item' | 'special';

export interface AcquiredItemEntry {
  item: ItemDefinition;
  bagQty: number;
  holders: OwnedPokemonInstance[];
}

export function collectAcquiredItems(save: SaveData, filter: ItemFilterTab): AcquiredItemEntry[] {
  const convoyQtyByItemId = new Map<string, number>();
  for (const c of save.convoy) {
    if (c.quantity > 0) {
      convoyQtyByItemId.set(c.itemId, (convoyQtyByItemId.get(c.itemId) ?? 0) + c.quantity);
    }
  }
  const holdersByItemId = new Map<string, OwnedPokemonInstance[]>();
  for (const u of save.roster) {
    const id = getUnitEquippedItemId(u);
    if (id) {
      const arr = holdersByItemId.get(id) ?? [];
      arr.push(u);
      holdersByItemId.set(id, arr);
    }
  }

  const out: AcquiredItemEntry[] = [];
  for (const itemDef of ITEMS_LIST) {
    const bagQty = convoyQtyByItemId.get(itemDef.id) ?? 0;
    const holders = holdersByItemId.get(itemDef.id) ?? [];
    if (bagQty <= 0 && holders.length === 0) continue;

    if (filter === 'held' && itemDef.category !== 'held_gear' && itemDef.category !== 'held_berry') {
      continue;
    }
    if (
      filter === 'healing' &&
      itemDef.category !== 'consumable' &&
      itemDef.category !== 'promotion'
    ) {
      continue;
    }
    if (filter === 'x_item' && itemDef.category !== 'x_item') continue;
    if (filter === 'special' && itemDef.category !== 'tm' && itemDef.category !== 'vitamin') continue;
    out.push({ item: itemDef, bagQty, holders });
  }
  return out;
}

export function renderPrepAcquiredItemsInspector(params: {
  itemsListEl: HTMLElement;
  acquiredItems: AcquiredItemEntry[];
  selectedUnit: OwnedPokemonInstance;
  selectedPrepItemId: string | null;
  signal: AbortSignal;
  saveManager: SaveStateManager;
  audioManager: AudioManager;
  onSelectItem: (itemId: string) => void;
  onMutated: (statusMsg: string, alsoRefreshHub?: boolean) => void;
  onError: (statusMsg: string) => void;
}): string | null {
  const {
    itemsListEl,
    acquiredItems,
    selectedUnit,
    selectedPrepItemId,
    signal,
    saveManager,
    audioManager,
    onSelectItem,
    onMutated,
    onError,
  } = params;

  itemsListEl.innerHTML = '';
  if (acquiredItems.length === 0) {
    const emptyEl = document.createElement('p');
    emptyEl.className = 'pmd-subcard-text';
    emptyEl.textContent = 'No items in this category.';
    itemsListEl.appendChild(emptyEl);
    return selectedPrepItemId;
  }

  const currentItemId = getUnitEquippedItemId(selectedUnit);
  const currentItem = currentItemId ? getItemById(currentItemId) : undefined;
  const selectedSp = getSpeciesById(selectedUnit.speciesId);

  const resolvedItemId =
    selectedPrepItemId && acquiredItems.some((e) => e.item.id === selectedPrepItemId)
      ? selectedPrepItemId
      : currentItemId && acquiredItems.some((e) => e.item.id === currentItemId)
        ? currentItemId
        : acquiredItems[0]!.item.id;
  const selectedEntry =
    acquiredItems.find((e) => e.item.id === resolvedItemId) ?? acquiredItems[0]!;

  const gridEl = document.createElement('div');
  gridEl.className = 'pmd-item-icon-grid';
  gridEl.dataset.testid = 'prep-acquired-items-grid';
  for (const entry of acquiredItems) {
    const isEqOnSel = currentItemId === entry.item.id;
    const isHeldOther = entry.holders.some((h) => h.instanceId !== selectedUnit.instanceId);
    gridEl.appendChild(
      createItemIconCell({
        itemId: entry.item.id,
        testId: `prep-item-cell-${entry.item.id}`,
        quantity: entry.bagQty,
        showZeroQuantity: true,
        isSelected: entry.item.id === selectedEntry.item.id,
        isEquippedOnSelected: isEqOnSel,
        isHeldByOther: !isEqOnSel && isHeldOther,
        isDepleted: entry.bagQty === 0 && !isEqOnSel,
        signal,
        onSelect: () => {
          audioManager.playSfx('select');
          onSelectItem(entry.item.id);
        },
      })
    );
  }

  const { item, bagQty, holders } = selectedEntry;
  const inspectorEl = document.createElement('div');
  inspectorEl.className = 'pmd-item-inspector-banner';
  inspectorEl.dataset.testid = 'prep-item-inspector';

  const mainEl = document.createElement('div');
  mainEl.className = 'pmd-item-inspector-main';
  mainEl.appendChild(createMiniItemIcon(item.id, { sizePx: 28, decorative: true }));

  const tmMove =
    item.category === 'tm' && item.effect.teachesMoveId
      ? getMoveById(item.effect.teachesMoveId)
      : undefined;
  const infoDiv = document.createElement('div');
  infoDiv.className = 'pmd-item-inspector-copy';
  infoDiv.innerHTML = `
    <div class="pmd-item-inspector-head">
      <strong class="pmd-item-inspector-name">${escapeUiHtml(item.name)}</strong>
      <span class="pmd-prep-cat-tag">${escapeUiHtml(formatItemCategoryLabel(item.category))}</span>
      ${tmMove ? `<span class="pmd-prep-cat-tag">${renderColoredTypeHtml(tmMove.type)}</span>` : ''}
      <span class="pmd-prep-stock-tag">×${bagQty}</span>
      <span class="pmd-item-holders-inline" data-item-holders></span>
    </div>
    <span class="pmd-item-inspector-desc">${escapeUiHtml(item.description)}</span>
  `;
  const holdersContainer = infoDiv.querySelector<HTMLElement>('[data-item-holders]');
  if (holdersContainer) {
    if (holders.length === 0) holdersContainer.hidden = true;
    else {
      for (const h of holders) {
        holdersContainer.appendChild(
          createMiniSpeciesPortrait(resolveUnitVisualAssetId(h.speciesId, h.cosmeticForm), {
            title: h.nickname,
            sizePx: 22,
            testId: `prep-item-holder-${item.id}-${h.instanceId}`,
          })
        );
      }
    }
  }
  mainEl.appendChild(infoDiv);

  const actionBtn = document.createElement('button');
  actionBtn.type = 'button';
  actionBtn.dataset.testid = `prep-item-equip-btn-${item.id}`;

  if (item.equipSlot === 'held' || item.equipSlot === 'consumable') {
    if (currentItemId === item.id) {
      actionBtn.className = 'pmd-btn pmd-chip-btn is-active';
      actionBtn.textContent = 'Unequip';
      bindPointerTap(actionBtn, () => {
        saveManager.equipItemToUnit(selectedUnit.instanceId, null);
        audioManager.playSfx('cancel');
        onMutated(`Unequipped ${item.name}.`);
      });
    } else if (bagQty > 0) {
      actionBtn.className = 'pmd-btn pmd-btn-primary pmd-chip-btn';
      actionBtn.textContent = currentItem ? 'Replace' : 'Equip';
      bindPointerTap(actionBtn, () => {
        saveManager.equipItemToUnit(selectedUnit.instanceId, item.id);
        audioManager.playSfx('select');
        onMutated(`Equipped ${item.name} on ${selectedUnit.nickname}.`);
      });
    } else {
      const otherHolder = holders.find((h) => h.instanceId !== selectedUnit.instanceId);
      actionBtn.className = 'pmd-btn pmd-chip-btn pmd-portrait-action-btn';
      actionBtn.disabled = !otherHolder;
      if (otherHolder) {
        actionBtn.appendChild(
          createMiniSpeciesPortrait(
            resolveUnitVisualAssetId(otherHolder.speciesId, otherHolder.cosmeticForm),
            { title: otherHolder.nickname, sizePx: 20 }
          )
        );
        const takeLbl = document.createElement('span');
        takeLbl.textContent = 'Take';
        actionBtn.appendChild(takeLbl);
        bindPointerTap(actionBtn, () => {
          saveManager.equipItemToUnit(selectedUnit.instanceId, item.id, otherHolder.instanceId);
          audioManager.playSfx('select');
          onMutated(`Moved ${item.name} to ${selectedUnit.nickname}.`);
        });
      } else actionBtn.textContent = 'Equip';
    }
  } else if (item.category === 'tm' && item.effect.teachesMoveId) {
    const alreadyKnows = selectedUnit.unlockedMoveIds.includes(item.effect.teachesMoveId);
    const compatible = Boolean(selectedSp?.compatibleTmIds.includes(item.id));
    actionBtn.className = 'pmd-btn pmd-chip-btn';
    actionBtn.textContent = alreadyKnows ? 'Known' : compatible ? 'Teach' : 'Incompatible';
    actionBtn.disabled = alreadyKnows || !compatible || bagQty < 1;
    if (!actionBtn.disabled) {
      bindPointerTap(actionBtn, () => {
        saveManager.teachTmMove(selectedUnit.instanceId, item.id);
        audioManager.playSfx('heal');
        onMutated(`Taught ${item.name} to ${selectedUnit.nickname}!`);
      });
    }
  } else if (item.category === 'vitamin') {
    actionBtn.className = 'pmd-btn pmd-btn-primary pmd-chip-btn';
    actionBtn.textContent = 'Use';
    actionBtn.disabled = bagQty < 1;
    if (!actionBtn.disabled) {
      bindPointerTap(actionBtn, () => {
        saveManager.useVitaminOnUnit(selectedUnit.instanceId, item.id);
        audioManager.playSfx('heal');
        onMutated(`Used ${item.name} on ${selectedUnit.nickname}!`);
      });
    }
  } else if (item.category === 'promotion') {
    const matchingBranches = (selectedSp?.evolutions ?? []).filter((b) => b.requiredItemId === item.id);
    const minLv = matchingBranches[0]?.minLevel;
    actionBtn.className = 'pmd-btn pmd-chip-btn';
    actionBtn.textContent = minLv ? `Lv. ${minLv}+` : 'Incompatible';
    actionBtn.disabled = true;
  }

  const actionsWrap = document.createElement('div');
  actionsWrap.className = 'pmd-prep-move-actions';

  if (
    (item.id === 'evolution_stone' || item.id === 'evolution_gem') &&
    (bagQty > 0 || currentItemId === item.id) &&
    selectedSp
  ) {
    const eligibleBranches = selectedSp.evolutions.filter(
      (b) => b.requiredItemId === item.id && selectedUnit.level >= b.minLevel
    );
    if (eligibleBranches.length === 0) {
      actionsWrap.appendChild(actionBtn);
    }
    for (const branch of eligibleBranches) {
      const targetSp = getSpeciesById(branch.targetSpeciesId);
      const usePromoBtn = document.createElement('button');
      usePromoBtn.type = 'button';
      usePromoBtn.className = 'pmd-btn pmd-btn-primary pmd-chip-btn';
      usePromoBtn.dataset.testid = `prep-item-use-promo-${branch.targetSpeciesId}`;
      usePromoBtn.textContent = `Evolve → ${targetSp?.name ?? branch.targetSpeciesId}`;
      bindPointerTap(usePromoBtn, () => {
        try {
          const promoted = saveManager.useEvolutionItemOnUnit(
            selectedUnit.instanceId,
            branch.requiredItemId,
            branch.targetSpeciesId
          );
          audioManager.playSfx('heal');
          onMutated(
            `★ ${promoted.nickname} evolved into ${getSpeciesById(promoted.speciesId)?.name ?? promoted.speciesId}!`,
            true
          );
        } catch (err) {
          audioManager.playSfx('cancel');
          onError(err instanceof Error ? err.message : 'Promotion failed.');
        }
      });
      actionsWrap.appendChild(usePromoBtn);
    }
  } else {
    actionsWrap.appendChild(actionBtn);
  }

  inspectorEl.append(mainEl, actionsWrap);
  itemsListEl.append(gridEl, inspectorEl);
  return resolvedItemId;
}
