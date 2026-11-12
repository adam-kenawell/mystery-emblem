/**
 * Mystery Emblem - Chapter Prep `Manage Items` Renderer (`PrepItemsRenderer.ts`)
 */

import { resolveUnitVisualAssetId } from '../../assets/pmdAssetLoader';
import type { AudioManager } from '../../audio/AudioManager';
import { getUnitEquippedItemId, type SaveStateManager } from '../../state/SaveStateManager';
import type { SaveData } from '../../types/schemas';
import { createUnitPortraitCell } from '../PmdUnitPortraitGrid';
import {
  collectAcquiredItems,
  renderPrepAcquiredItemsInspector,
  type ItemFilterTab,
} from '../inspector/ItemActionInspector';
import { renderUnitEquippedSlotBanner } from '../inspector/UnitDetailCard';

export interface PrepItemsRenderContext {
  itemsBackdropEl: HTMLElement;
  saveManager: SaveStateManager;
  save: SaveData;
  audioManager: AudioManager;
  signal: AbortSignal;
  selectedUnitInstanceId: string | null;
  selectedPrepItemId: string | null;
  itemFilter: ItemFilterTab;
  itemsStatusMsg: string;
  isUnitDeployed: (instanceId: string) => boolean;
  onSelectUnit: (instanceId: string) => void;
  onSelectItem: (itemId: string) => void;
  onMutated: (msg: string, alsoRefreshHub?: boolean) => void;
  onError: (msg: string) => void;
}

export function renderPrepManageItems(ctx: PrepItemsRenderContext): string | null {
  const {
    itemsBackdropEl,
    saveManager,
    save,
    audioManager,
    signal,
    selectedUnitInstanceId,
    selectedPrepItemId,
    itemFilter,
    itemsStatusMsg,
    isUnitDeployed,
    onSelectUnit,
    onSelectItem,
    onMutated,
    onError,
  } = ctx;

  const selectedUnit = save.roster.find((u) => u.instanceId === selectedUnitInstanceId);
  if (!selectedUnit) return selectedPrepItemId;

  const unitBarEl = itemsBackdropEl.querySelector<HTMLElement>(
    '[data-testid="prep-items-unit-list"]'
  );
  if (unitBarEl) {
    unitBarEl.innerHTML = '';
    for (const u of save.roster) {
      const uItemId = getUnitEquippedItemId(u);
      const isSel = u.instanceId === selectedUnit.instanceId;
      const isDep = isUnitDeployed(u.instanceId);
      unitBarEl.appendChild(
        createUnitPortraitCell({
          speciesIdOrAssetId: resolveUnitVisualAssetId(u.speciesId, u.cosmeticForm),
          ariaLabel: u.nickname,
          isSelected: isSel,
          isLord: u.isLord,
          isDeployed: isDep,
          isBenched: !isDep,
          hasItem: Boolean(uItemId),
          equippedItemId: uItemId,
          testId: `prep-items-unit-${u.instanceId}`,
          portraitTestId: `prep-items-portrait-${u.instanceId}`,
          signal,
          onSelect: () => {
            audioManager.playSfx('select');
            onSelectUnit(u.instanceId);
          },
        })
      );
    }
  }

  const slotCardEl = itemsBackdropEl.querySelector<HTMLElement>(
    '[data-testid="prep-unit-item-slot-card"]'
  );
  if (slotCardEl) {
    renderUnitEquippedSlotBanner({
      containerEl: slotCardEl,
      unit: selectedUnit,
      saveManager,
      audioManager,
      iconTestId: 'prep-unit-slot-item-icon',
      unequipBtnTestId: 'prep-item-unequip-btn',
      showCategoryBadge: true,
      onUnequipped: (itemName) => onMutated(`Returned ${itemName} to Bag.`),
    });
  }

  let nextSelectedItemId = selectedPrepItemId;
  const acquiredItems = collectAcquiredItems(save, itemFilter);
  const itemsListEl = itemsBackdropEl.querySelector<HTMLElement>(
    '[data-testid="prep-acquired-items-list"]'
  );
  if (itemsListEl) {
    nextSelectedItemId = renderPrepAcquiredItemsInspector({
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
    });
  }

  const statusEl = itemsBackdropEl.querySelector<HTMLElement>('[data-testid="prep-items-status"]');
  if (statusEl) {
    statusEl.hidden = !itemsStatusMsg;
    statusEl.textContent = itemsStatusMsg;
  }

  return nextSelectedItemId;
}
