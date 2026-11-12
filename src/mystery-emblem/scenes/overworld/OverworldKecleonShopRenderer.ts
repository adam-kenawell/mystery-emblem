/**
 * Mystery Emblem - Overworld Kecleon Shop Shelf & Inspector Renderer (`OverworldKecleonShopRenderer.ts`)
 */

import { resolveUnitVisualAssetId } from '../../assets/pmdAssetLoader';
import type { AudioManager } from '../../audio/AudioManager';
import { getItemById, getMoveById, getSpeciesById } from '../../data/index';
import {
  KECLEON_SHOP_METADATA,
  type OverworldGraphDefinition,
} from '../../data/overworldMapData';
import { ensureOverworldGraphState } from '../../engine/overworldEngine';
import type { SaveStateManager } from '../../state/SaveStateManager';
import type { ItemDefinition, SaveData } from '../../types/schemas';
import { createItemIconCell, createMiniItemIcon } from '../../ui/PmdItemIconGrid';
import { createMiniSpeciesPortrait } from '../../ui/PmdUnitPortraitGrid';
import { bindPointerTap } from '../../ui/pointerControls';
import { createColoredTypeSpan } from '../../ui/typeColors';
import type { OverworldDomElements } from './overworldDomTemplates';

export interface OverworldKecleonRenderParams {
  dom: OverworldDomElements;
  save: SaveData;
  graph: OverworldGraphDefinition;
  saveManager: SaveStateManager;
  audioManager: AudioManager;
  selectedShopItemId: string | null;
  statusMessage: string;
  onSelectShopItem: (itemId: string) => void;
  onStatusAndRefresh: (statusMsg: string) => void;
}

export function renderOverworldKecleonShop(params: OverworldKecleonRenderParams): string | null {
  const {
    dom,
    save,
    graph,
    saveManager,
    audioManager,
    selectedShopItemId,
    statusMessage,
    onSelectShopItem,
    onStatusAndRefresh,
  } = params;

  const reconciled = ensureOverworldGraphState(save, graph);
  const shop = reconciled.nodes[reconciled.currentNodeId]?.activeKecleonShop;

  dom.kecleonGoldEl.textContent = `${save.gold}G`;
  dom.kecleonStatusEl.textContent = statusMessage;
  dom.kecleonStatusEl.hidden = statusMessage.length === 0;
  dom.kecleonShelfEl.innerHTML = '';

  if (!shop) {
    dom.kecleonTitleEl.textContent = 'KECLEON SHOP - SOLD OUT';
    dom.kecleonSpeechNameEl.textContent = 'Kecleon';
    dom.kecleonSpeechTextEl.textContent = 'Sold out! Safe travels!';
    return selectedShopItemId;
  }

  const meta = KECLEON_SHOP_METADATA[shop.shopType];
  dom.kecleonTitleEl.textContent = meta.title.toUpperCase();
  dom.kecleonSpeechNameEl.textContent = 'Kecleon';
  dom.kecleonSpeechTextEl.textContent = meta.greeting;

  const shopItems: ItemDefinition[] = [];
  for (const itemId of shop.inventoryItemIds) {
    const item = getItemById(itemId);
    if (item && item.buyPrice !== null) {
      shopItems.push(item);
    }
  }

  if (shopItems.length === 0) {
    dom.kecleonTitleEl.textContent = 'KECLEON SHOP - SOLD OUT';
    dom.kecleonSpeechNameEl.textContent = 'Kecleon';
    dom.kecleonSpeechTextEl.textContent = 'Sold out! Safe travels!';
    return selectedShopItemId;
  }

  const resolvedItemId =
    selectedShopItemId && shopItems.some((it) => it.id === selectedShopItemId)
      ? selectedShopItemId
      : shopItems[0]!.id;
  const selectedItem = shopItems.find((it) => it.id === resolvedItemId) ?? shopItems[0]!;

  const gridEl = document.createElement('div');
  gridEl.className = 'pmd-item-icon-grid';
  gridEl.dataset.testid = 'kecleon-item-grid';
  for (const item of shopItems) {
    gridEl.appendChild(
      createItemIconCell({
        itemId: item.id,
        testId: `kecleon-item-cell-${item.id}`,
        isSelected: item.id === selectedItem.id,
        priceGold: item.buyPrice ?? undefined,
        isDepleted: save.gold < (item.buyPrice ?? 0),
        onSelect: () => {
          audioManager.playSfx('select');
          onSelectShopItem(item.id);
        },
      })
    );
  }

  const canAfford = save.gold >= (selectedItem.buyPrice ?? 0);
  const bannerEl = document.createElement('div');
  bannerEl.className = 'pmd-item-inspector-banner';
  bannerEl.dataset.testid = 'kecleon-inspector-banner';

  const mainEl = document.createElement('div');
  mainEl.className = 'pmd-item-inspector-main';
  mainEl.appendChild(createMiniItemIcon(selectedItem.id, { sizePx: 28, decorative: true }));

  const copyEl = document.createElement('div');
  copyEl.className = 'pmd-item-inspector-copy';
  const headEl = document.createElement('div');
  headEl.className = 'pmd-item-inspector-head';
  const nameEl = document.createElement('strong');
  nameEl.className = 'pmd-item-inspector-name';
  nameEl.textContent = selectedItem.name;
  const priceEl = document.createElement('span');
  priceEl.className = 'pmd-kecleon-item-price';
  priceEl.textContent = `${selectedItem.buyPrice}G`;
  headEl.appendChild(nameEl);
  if (selectedItem.category === 'tm' && selectedItem.effect.teachesMoveId) {
    const taughtMove = getMoveById(selectedItem.effect.teachesMoveId);
    if (taughtMove) {
      headEl.appendChild(createColoredTypeSpan(taughtMove.type, 'pmd-prep-cat-tag'));
    }
  }
  headEl.appendChild(priceEl);

  const descEl = document.createElement('span');
  descEl.className = 'pmd-item-inspector-desc';
  descEl.textContent = selectedItem.description;
  copyEl.append(headEl, descEl);

  if (selectedItem.category === 'tm') {
    const compatibleUnits = save.roster.filter((u) => {
      const sp = getSpeciesById(u.speciesId);
      const mvId = selectedItem.effect.teachesMoveId;
      return (
        sp &&
        sp.compatibleTmIds.includes(selectedItem.id) &&
        (!mvId || !u.unlockedMoveIds.includes(mvId))
      );
    });
    const fitsRow = document.createElement('div');
    fitsRow.className = 'pmd-kecleon-tm-fits';
    fitsRow.dataset.testid = `kecleon-tm-fits-${selectedItem.id}`;
    const fitsLbl = document.createElement('span');
    fitsLbl.className = 'pmd-kecleon-fits-lbl';
    fitsLbl.textContent = 'Fits:';
    fitsRow.appendChild(fitsLbl);

    if (compatibleUnits.length > 0) {
      for (const u of compatibleUnits) {
        fitsRow.appendChild(
          createMiniSpeciesPortrait(resolveUnitVisualAssetId(u.speciesId, u.cosmeticForm), {
            title: u.nickname,
            testId: `kecleon-tm-fit-${selectedItem.id}-${u.instanceId}`,
            sizePx: 24,
          })
        );
      }
    } else {
      const noneSpan = document.createElement('span');
      noneSpan.className = 'pmd-kecleon-fits-none';
      noneSpan.textContent = 'None';
      fitsRow.appendChild(noneSpan);
    }
    copyEl.appendChild(fitsRow);
  }

  mainEl.appendChild(copyEl);

  const buyBtn = document.createElement('button');
  buyBtn.type = 'button';
  buyBtn.className = 'pmd-btn pmd-btn-primary';
  buyBtn.dataset.testid = `kecleon-buy-${selectedItem.id}`;
  buyBtn.disabled = !canAfford;
  buyBtn.textContent = canAfford ? `Buy (${selectedItem.buyPrice}G)` : `${selectedItem.buyPrice}G`;
  bindPointerTap(buyBtn, () => {
    try {
      const outcome = saveManager.buyKecleonShopItem(
        reconciled.currentNodeId,
        selectedItem.id,
        graph
      );
      audioManager.playSfx('heal');
      onStatusAndRefresh(`Bought ${outcome.item.name} (${outcome.save.gold}G left).`);
    } catch (err) {
      audioManager.playSfx('cancel');
      onStatusAndRefresh(err instanceof Error ? err.message : 'Purchase failed.');
    }
  });

  bannerEl.append(mainEl, buyBtn);
  dom.kecleonShelfEl.append(gridEl, bannerEl);
  return resolvedItemId;
}
