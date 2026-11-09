/**
 * Mystery Emblem — Shared Unit Detail & Slot Inspector Helpers (`UnitDetailCard.ts`)
 *
 * Shared UI helpers for rendering unit stats, elemental typing, 1-item-slot banners,
 * and branched Evolution Stone / Gem promotion rows across Overworld & Chapter Prep.
 *
 * Strictly obeys Rule 2 (Unified Pointer Events ONLY) and Rule 3 (PMD visual skin).
 */

import type { AudioManager } from '../../audio/AudioManager';
import { getItemById, getSpeciesById } from '../../data/index';
import { getUnitEquippedItemId, type SaveStateManager } from '../../state/SaveStateManager';
import type {
  EvolutionBranch,
  ItemCategory,
  MoveDefinition,
  OwnedPokemonInstance,
  SaveData,
} from '../../types/schemas';
import { createMiniItemIcon } from '../PmdItemIconGrid';
import { bindPointerTap } from '../pointerControls';

export function escapeUiHtml(raw: string): string {
  return raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function formatItemCategoryLabel(category: ItemCategory): string {
  switch (category) {
    case 'held_gear': return 'Held Gear';
    case 'held_berry': return 'Berry';
    case 'consumable': return 'Healing';
    case 'promotion': return 'Evolution';
    case 'x_item': return 'X-Item';
    case 'vitamin': return 'Vitamin';
    case 'tm': return 'TM';
  }
}

export function formatMoveCategoryBadge(mv: MoveDefinition): string {
  if (mv.category === 'Physical') return 'Phys · R1';
  if (mv.category === 'Special') return 'Spec · R2';
  const rText = mv.range[0] === mv.range[1] ? `R${mv.range[0]}` : `R${mv.range[0]}-${mv.range[1]}`;
  return mv.supportSubkind === 'status' ? `Status · ${rText}` : `Support · ${rText}`;
}

export function getOwnedEvolutionBranches(
  unit: OwnedPokemonInstance,
  save: SaveData
): {
  ownedBranches: EvolutionBranch[];
  eligibleNow: EvolutionBranch[];
} {
  const sp = getSpeciesById(unit.speciesId);
  const ownedBranches = (sp?.evolutions ?? []).filter(
    (b) =>
      unit.consumableItemId === b.requiredItemId ||
      save.convoy.some((c) => c.itemId === b.requiredItemId && c.quantity > 0)
  );
  const eligibleNow = ownedBranches.filter((b) => unit.level >= b.minLevel);
  return { ownedBranches, eligibleNow };
}

export function renderPrepPromotionShortcutRow(params: {
  promoWrapEl: HTMLElement | null;
  unit: OwnedPokemonInstance;
  save: SaveData;
  saveManager: SaveStateManager;
  audioManager: AudioManager;
  onPromoted: (msg: string) => void;
  onError: (msg: string) => void;
}): void {
  const { promoWrapEl, unit, save, saveManager, audioManager, onPromoted, onError } = params;
  if (!promoWrapEl) return;
  promoWrapEl.innerHTML = '';
  const { ownedBranches, eligibleNow } = getOwnedEvolutionBranches(unit, save);
  if (ownedBranches.length === 0) {
    promoWrapEl.hidden = true;
    return;
  }
  promoWrapEl.hidden = false;
  if (eligibleNow.length === 0) {
    const firstB = ownedBranches[0]!;
    const noticeDiv = document.createElement('div');
    noticeDiv.className = 'pmd-prep-item-shortcut-info pmd-inline-item-row';
    noticeDiv.style.color = '#ffd878';
    noticeDiv.appendChild(createMiniItemIcon(firstB.requiredItemId, { sizePx: 20 }));
    const lvlTxt = document.createElement('span');
    lvlTxt.innerHTML = `Evolve at <strong>Lv. ${firstB.minLevel}</strong>`;
    noticeDiv.appendChild(lvlTxt);
    promoWrapEl.appendChild(noticeDiv);
    return;
  }

  const infoSpan = document.createElement('div');
  infoSpan.className = 'pmd-prep-item-shortcut-info';
  infoSpan.innerHTML = `<strong style="color:#98f8b8;">★ Ready to Evolve</strong>`;
  const btnsWrap = document.createElement('div');
  btnsWrap.className = 'pmd-inline-btns';
  for (const branch of eligibleNow) {
    const targetSp = getSpeciesById(branch.targetSpeciesId);
    const evoBtn = document.createElement('button');
    evoBtn.type = 'button';
    evoBtn.className = 'pmd-btn pmd-btn-primary pmd-chip-btn';
    evoBtn.dataset.testid = `prep-evolve-btn-${branch.targetSpeciesId}`;
    evoBtn.textContent = `Evolve → ${targetSp?.name ?? branch.targetSpeciesId}`;
    bindPointerTap(evoBtn, () => {
      try {
        const promoted = saveManager.useEvolutionItemOnUnit(unit.instanceId, branch.requiredItemId, branch.targetSpeciesId);
        audioManager.playSfx('heal');
        onPromoted(`★ ${promoted.nickname} evolved into ${getSpeciesById(promoted.speciesId)?.name ?? promoted.speciesId}!`);
      } catch (err) {
        audioManager.playSfx('cancel');
        onError(err instanceof Error ? err.message : 'Promotion failed.');
      }
    });
    btnsWrap.appendChild(evoBtn);
  }
  promoWrapEl.append(infoSpan, btnsWrap);
}

export function populateUnitSevenStatBoxes(
  containerEl: HTMLElement,
  unit: OwnedPokemonInstance,
  mode: 'overworld' | 'prep'
): void {
  const st = unit.currentStats;
  const stats: Array<[string, number, string]> = [
    ['HP', st.hp, 'hp'], ['ATK', st.atk, 'atk'], ['DEF', st.def, 'def'],
    ['SPA', st.spa, 'spa'], ['SPD', st.spd, 'spd'], ['SPE', st.spe, 'spe'], ['MOV', st.mov, 'mov'],
  ];

  if (mode === 'overworld') {
    containerEl.innerHTML = '';
    for (const [label, val, key] of stats) {
      const cell = document.createElement('div');
      cell.className = 'pmd-overworld-stat-cell';
      cell.innerHTML = `<span>${label}</span><strong data-testid="overworld-stat-${key}">${val}</strong>`;
      containerEl.appendChild(cell);
    }
    return;
  }

  containerEl.innerHTML = stats
    .map(([label, val]) => `<div class="pmd-prep-stat-box"><span class="pmd-prep-stat-lbl">${label}</span><strong class="pmd-prep-stat-val">${val}</strong></div>`)
    .join('');
}

export interface UnitItemSlotBannerParams {
  containerEl: HTMLElement;
  unit: OwnedPokemonInstance;
  saveManager: SaveStateManager;
  audioManager: AudioManager;
  iconTestId: string;
  unequipBtnTestId: string;
  showCategoryBadge?: boolean;
  onUnequipped: (unequippedItemName: string) => void;
}

export function renderUnitEquippedSlotBanner(params: UnitItemSlotBannerParams): void {
  const { containerEl, unit, saveManager, audioManager, iconTestId, unequipBtnTestId, showCategoryBadge = false, onUnequipped } = params;
  containerEl.innerHTML = '';
  const currentItemId = getUnitEquippedItemId(unit);
  const currentItem = currentItemId ? getItemById(currentItemId) : undefined;
  const infoDiv = document.createElement('div');
  infoDiv.className = 'pmd-prep-slot-info';

  if (currentItem) {
    const titleLine = document.createElement('div');
    titleLine.className = 'pmd-inline-item-row';
    const nickStrong = document.createElement('strong');
    nickStrong.textContent = `${unit.nickname}:`;
    titleLine.append(nickStrong, createMiniItemIcon(currentItem.id, { sizePx: 22, testId: iconTestId }));
    if (showCategoryBadge) {
      const catTag = document.createElement('span');
      catTag.className = 'pmd-prep-cat-tag';
      catTag.textContent = formatItemCategoryLabel(currentItem.category);
      titleLine.appendChild(catTag);
    }
    const descSpan = document.createElement('span');
    descSpan.className = 'pmd-prep-move-stats';
    descSpan.textContent = currentItem.description;
    infoDiv.append(titleLine, descSpan);

    const unequipBtn = document.createElement('button');
    unequipBtn.type = 'button';
    unequipBtn.className = 'pmd-btn pmd-chip-btn';
    unequipBtn.dataset.testid = unequipBtnTestId;
    unequipBtn.textContent = 'Unequip';
    bindPointerTap(unequipBtn, () => {
      saveManager.equipItemToUnit(unit.instanceId, null);
      audioManager.playSfx('cancel');
      onUnequipped(currentItem.name);
    });
    containerEl.append(infoDiv, unequipBtn);
  } else {
    infoDiv.innerHTML = `<div class="pmd-prep-move-title-line"><strong>${escapeUiHtml(unit.nickname)}: Empty</strong></div>`;
    containerEl.appendChild(infoDiv);
  }
}
