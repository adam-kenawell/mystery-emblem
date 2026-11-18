/**
 * Mystery Emblem - Overworld System Menu `Items` (`convoy`) Tab Renderer (`OverworldItemsTabRenderer.ts`)
 */

import { resolveUnitVisualAssetId } from '../../assets/pmdAssetLoader';
import type { AudioManager } from '../../audio/AudioManager';
import { getItemById, getMoveById, getSpeciesById } from '../../data/index';
import { getUnitEquippedItemId, type SaveStateManager } from '../../state/SaveStateManager';
import type { ItemDefinition, SaveData } from '../../types/schemas';
import { createItemIconCell } from '../../ui/PmdItemIconGrid';
import { createMiniSpeciesPortrait, createUnitPortraitCell } from '../../ui/PmdUnitPortraitGrid';
import {
  createEvolutionBranchButton,
  createItemInspectorBanner,
  escapeUiHtml,
  renderUnitEquippedSlotBanner,
} from '../../ui/inspector/UnitDetailCard';
import { bindPointerTap } from '../../ui/pointerControls';
import { renderColoredTypeHtml } from '../../ui/typeColors';

export interface OverworldItemsTabParams {
  menuPanelBodyEl: HTMLElement;
  save: SaveData;
  saveManager: SaveStateManager;
  audioManager: AudioManager;
  selectedUnitInstanceId: string | null;
  selectedConvoyItemId: string | null;
  onSelectUnit: (instanceId: string) => void;
  onSelectConvoyItem: (itemId: string) => void;
  onEvolvedPreloadSprites: () => void;
  onFeedbackAndRefresh: (msg: string) => void;
}

export function renderOverworldConvoyTab(params: OverworldItemsTabParams): {
  selectedUnitInstanceId: string | null;
  selectedConvoyItemId: string | null;
} {
  const {
    menuPanelBodyEl,
    save,
    saveManager,
    audioManager,
    onSelectUnit,
    onSelectConvoyItem,
    onEvolvedPreloadSprites,
    onFeedbackAndRefresh,
  } = params;

  const resolvedUnitId =
    params.selectedUnitInstanceId &&
    save.roster.some((u) => u.instanceId === params.selectedUnitInstanceId)
      ? params.selectedUnitInstanceId
      : (save.roster[0]?.instanceId ?? null);
  const targetUnit =
    save.roster.find((u) => u.instanceId === resolvedUnitId) ?? save.roster[0];

  const unitBar = document.createElement('div');
  unitBar.className = 'pmd-unit-portrait-grid pmd-overworld-items-unit-grid';
  unitBar.dataset.testid = 'overworld-items-unit-grid';
  for (const u of save.roster) {
    const uItemId = getUnitEquippedItemId(u);
    unitBar.appendChild(
      createUnitPortraitCell({
        speciesIdOrAssetId: resolveUnitVisualAssetId(u.speciesId, u.cosmeticForm),
        ariaLabel: u.nickname,
        testId: `overworld-items-unit-${u.instanceId}`,
        portraitTestId: `overworld-items-portrait-${u.instanceId}`,
        isSelected: u.instanceId === targetUnit?.instanceId,
        isLord: u.isLord,
        hasItem: Boolean(uItemId),
        equippedItemId: uItemId,
        onSelect: () => {
          audioManager.playSfx('select');
          onSelectUnit(u.instanceId);
        },
      })
    );
  }

  const slotBanner = document.createElement('div');
  slotBanner.className = 'pmd-prep-slot-banner';
  slotBanner.dataset.testid = 'overworld-items-slot-card';
  slotBanner.style.marginBottom = '0.45rem';
  if (targetUnit) {
    renderUnitEquippedSlotBanner({
      containerEl: slotBanner,
      unit: targetUnit,
      saveManager,
      audioManager,
      iconTestId: 'overworld-items-slot-icon',
      unequipBtnTestId: 'overworld-items-unequip-btn',
      showCategoryBadge: false,
      onUnequipped: (itemName) => onFeedbackAndRefresh(`Returned ${itemName} to Bag.`),
    });
  }

  const box = document.createElement('div');
  box.className = 'pmd-overworld-subbox';
  box.innerHTML = `<p class="pmd-overworld-subbox-title">Bag (<span data-testid="overworld-items-gold">${save.gold}G</span>)</p>`;

  const validBagEntries: Array<{ item: ItemDefinition; quantity: number }> = [];
  for (const entry of save.convoy) {
    if (entry.quantity <= 0) continue;
    const item = getItemById(entry.itemId);
    if (item) validBagEntries.push({ item, quantity: entry.quantity });
  }

  let nextConvoyItemId = params.selectedConvoyItemId;
  if (validBagEntries.length === 0) {
    box.innerHTML += `<span style="font-size:0.72rem;color:#b8dcff;">Bag is empty.</span>`;
  } else {
    const targetItemId = targetUnit ? getUnitEquippedItemId(targetUnit) : null;
    if (
      !nextConvoyItemId ||
      !validBagEntries.some((e) => e.item.id === nextConvoyItemId)
    ) {
      nextConvoyItemId =
        targetItemId && validBagEntries.some((e) => e.item.id === targetItemId)
          ? targetItemId
          : validBagEntries[0]!.item.id;
    }
    const selBag =
      validBagEntries.find((e) => e.item.id === nextConvoyItemId) ?? validBagEntries[0]!;
    const selItem = selBag.item;

    const bagGrid = document.createElement('div');
    bagGrid.className = 'pmd-item-icon-grid';
    bagGrid.dataset.testid = 'overworld-convoy-grid';
    for (const entry of validBagEntries) {
      bagGrid.appendChild(
        createItemIconCell({
          itemId: entry.item.id,
          testId: `overworld-convoy-cell-${entry.item.id}`,
          quantity: entry.quantity,
          isSelected: entry.item.id === selItem.id,
          isEquippedOnSelected: targetItemId === entry.item.id,
          onSelect: () => {
            audioManager.playSfx('select');
            onSelectConvoyItem(entry.item.id);
          },
        })
      );
    }

    const selTmMove =
      selItem.category === 'tm' && selItem.effect.teachesMoveId
        ? getMoveById(selItem.effect.teachesMoveId)
        : undefined;
    const bagBanner = createItemInspectorBanner({
      itemId: selItem.id,
      iconSizePx: 26,
      marginTopPx: 6,
      testId: 'overworld-convoy-inspector',
      headHtml: `
        <strong class="pmd-item-inspector-name">${escapeUiHtml(selItem.name)} ×${selBag.quantity}</strong>
        ${selTmMove ? `<span class="pmd-prep-cat-tag">${renderColoredTypeHtml(selTmMove.type)}</span>` : ''}
      `,
      descHtml: escapeUiHtml(selItem.description),
    });

    const actionsWrap = document.createElement('div');
    actionsWrap.className = 'pmd-inline-btns';

    const equippable = selItem.equipSlot === 'held' || selItem.equipSlot === 'consumable';
    if (equippable && targetUnit) {
      const giveBtn = document.createElement('button');
      giveBtn.type = 'button';
      giveBtn.className = 'pmd-btn pmd-btn-primary pmd-chip-btn pmd-portrait-action-btn';
      giveBtn.dataset.equipConvoy = selItem.id;
      giveBtn.dataset.testid = `overworld-convoy-equip-btn-${selItem.id}`;
      giveBtn.appendChild(
        createMiniSpeciesPortrait(
          resolveUnitVisualAssetId(targetUnit.speciesId, targetUnit.cosmeticForm),
          { title: targetUnit.nickname, sizePx: 20 }
        )
      );
      const lbl = document.createElement('span');
      lbl.textContent = targetItemId ? 'Replace' : 'Equip';
      giveBtn.appendChild(lbl);
      bindPointerTap(giveBtn, () => {
        audioManager.playSfx('select');
        saveManager.equipItemToUnit(targetUnit.instanceId, selItem.id);
        onFeedbackAndRefresh(`Equipped ${selItem.name} on ${targetUnit.nickname}.`);
      });
      actionsWrap.appendChild(giveBtn);
    }

    if (
      targetUnit &&
      (selItem.id === 'evolution_stone' || selItem.id === 'evolution_gem')
    ) {
      const targetSpDef = getSpeciesById(targetUnit.speciesId);
      const eligibleBranches = (targetSpDef?.evolutions ?? []).filter(
        (b) => b.requiredItemId === selItem.id && targetUnit.level >= b.minLevel
      );
      for (const branch of eligibleBranches) {
        actionsWrap.appendChild(
          createEvolutionBranchButton({
            unit: targetUnit,
            branch,
            saveManager,
            audioManager,
            testId: `overworld-convoy-use-promo-${branch.targetSpeciesId}`,
            sfx: 'victory_fanfare',
            onPromoted: (_promoted, evolvedName) => {
              onEvolvedPreloadSprites();
              onFeedbackAndRefresh(`${targetUnit.nickname} evolved into ${evolvedName}!`);
            },
            onError: onFeedbackAndRefresh,
          })
        );
      }
    }

    if (actionsWrap.childElementCount > 0) {
      bagBanner.appendChild(actionsWrap);
    }
    box.append(bagGrid, bagBanner);
  }

  menuPanelBodyEl.append(unitBar, slotBanner, box);
  return {
    selectedUnitInstanceId: resolvedUnitId,
    selectedConvoyItemId: nextConvoyItemId,
  };
}
