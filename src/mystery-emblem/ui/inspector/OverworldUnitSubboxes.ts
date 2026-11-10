/**
 * Mystery Emblem — Overworld `Units` Tab Vitamin & Move-Loadout Subboxes (`OverworldUnitSubboxes.ts`)
 */

import type { AudioManager } from '../../audio/AudioManager';
import { isMoveEquipped, type EquipCategory } from '../../data/equippedMoves';
import { getItemById, getMoveById } from '../../data/index';
import type { SaveStateManager } from '../../state/SaveStateManager';
import type { OwnedPokemonInstance, SaveData } from '../../types/schemas';
import { createItemIconCell, createMiniItemIcon } from '../PmdItemIconGrid';
import { bindPointerTap } from '../pointerControls';
import { renderColoredTypeHtml } from '../typeColors';
import { escapeUiHtml } from './UnitDetailCard';

export function renderOverworldVitaminsSubbox(params: {
  save: SaveData;
  unit: OwnedPokemonInstance;
  selectedVitaminId: string | null;
  saveManager: SaveStateManager;
  audioManager: AudioManager;
  onSelectVitamin: (itemId: string) => void;
  onUsed: (msg: string) => void;
  onError: (msg: string) => void;
}): { element: HTMLElement | null; resolvedVitaminId: string | null } {
  const { save, unit, selectedVitaminId, saveManager, audioManager, onSelectVitamin, onUsed, onError } =
    params;
  const vitaminsInBag = save.convoy.filter(
    (c) => c.quantity > 0 && getItemById(c.itemId)?.category === 'vitamin'
  );
  if (vitaminsInBag.length === 0) {
    return { element: null, resolvedVitaminId: selectedVitaminId };
  }

  const resolvedId =
    selectedVitaminId && vitaminsInBag.some((v) => v.itemId === selectedVitaminId)
      ? selectedVitaminId
      : vitaminsInBag[0]!.itemId;
  const selVitSlot = vitaminsInBag.find((v) => v.itemId === resolvedId) ?? vitaminsInBag[0]!;
  const selVitItem = getItemById(selVitSlot.itemId)!;

  const vitaminBox = document.createElement('div');
  vitaminBox.className = 'pmd-overworld-subbox';
  vitaminBox.innerHTML = `<p class="pmd-overworld-subbox-title">Vitamins</p>`;

  const vitStrip = document.createElement('div');
  vitStrip.className = 'pmd-item-icon-grid is-strip';
  vitStrip.dataset.testid = 'overworld-unit-vitamins-grid';
  for (const slot of vitaminsInBag) {
    vitStrip.appendChild(
      createItemIconCell({
        itemId: slot.itemId,
        testId: `overworld-vitamin-cell-${slot.itemId}`,
        quantity: slot.quantity,
        isSelected: slot.itemId === selVitItem.id,
        onSelect: () => {
          audioManager.playSfx('select');
          onSelectVitamin(slot.itemId);
        },
      })
    );
  }

  const vitBanner = document.createElement('div');
  vitBanner.className = 'pmd-item-inspector-banner';
  vitBanner.style.marginTop = '6px';
  const vitMain = document.createElement('div');
  vitMain.className = 'pmd-item-inspector-main';
  vitMain.appendChild(createMiniItemIcon(selVitItem.id, { sizePx: 24, decorative: true }));
  const vitCopy = document.createElement('div');
  vitCopy.className = 'pmd-item-inspector-copy';
  vitCopy.innerHTML = `
    <div class="pmd-item-inspector-head"><strong class="pmd-item-inspector-name">${escapeUiHtml(selVitItem.name)} ×${selVitSlot.quantity}</strong></div>
    <span class="pmd-item-inspector-desc">${escapeUiHtml(selVitItem.description)}</span>
  `;
  vitMain.appendChild(vitCopy);

  const useBtn = document.createElement('button');
  useBtn.type = 'button';
  useBtn.className = 'pmd-btn pmd-btn-primary pmd-chip-btn';
  useBtn.dataset.testid = `overworld-use-vitamin-${selVitItem.id}`;
  useBtn.textContent = 'Use';
  bindPointerTap(useBtn, () => {
    try {
      saveManager.useVitaminOnUnit(unit.instanceId, selVitItem.id);
      audioManager.playSfx('heal');
      onUsed(`Used ${selVitItem.name} on ${unit.nickname}!`);
    } catch (err) {
      audioManager.playSfx('cancel');
      onError(err instanceof Error ? err.message : 'Could not use Vitamin.');
    }
  });

  vitBanner.append(vitMain, useBtn);
  vitaminBox.append(vitStrip, vitBanner);
  return { element: vitaminBox, resolvedVitaminId: resolvedId };
}

export function buildOverworldMoveLoadoutSubbox(params: {
  unit: OwnedPokemonInstance;
  saveManager: SaveStateManager;
  audioManager: AudioManager;
  onFeedbackAndRefresh: (msg: string) => void;
}): HTMLElement {
  const { unit, saveManager, audioManager, onFeedbackAndRefresh } = params;
  const movesBox = document.createElement('div');
  movesBox.className = 'pmd-overworld-subbox';
  movesBox.innerHTML = `<p class="pmd-overworld-subbox-title">Moves (${unit.activeMoveIds.length}/4 Active · [E] Phys + Spec Counters)</p>`;

  for (const mId of unit.unlockedMoveIds) {
    const mv = getMoveById(mId);
    if (!mv) continue;
    const isActive = unit.activeMoveIds.includes(mId);
    const isEquipped = isMoveEquipped(unit, mId);
    const canCounter = mv.category === 'Physical' || mv.category === 'Special';
    const row = document.createElement('div');
    row.className = 'pmd-overworld-action-row';
    row.dataset.testid = `overworld-unit-move-${mId}`;
    row.innerHTML = `
      <div class="pmd-overworld-action-meta">
        <strong>${isEquipped ? '[E] ' : ''}${escapeUiHtml(mv.name)}</strong>
        <span>${renderColoredTypeHtml(mv.type)} · R${mv.range[0]} · ${canCounter ? `Mt ${mv.mt} · Hit ${mv.hit}% · ` : ''}PP ${mv.pp + (unit.bonusPpByMoveId[mId] ?? 0)}</span>
      </div>
      <div class="pmd-inline-btns">
        ${isActive && canCounter && !isEquipped ? `<button type="button" class="pmd-btn pmd-chip-btn" data-set-eq="${mId}">Set [E]</button>` : ''}
        ${isActive && canCounter && isEquipped ? `<button type="button" class="pmd-btn pmd-chip-btn is-active" data-clear-eq="${mId}">[E]</button>` : ''}
        ${!isActive && unit.activeMoveIds.length < 4 ? `<button type="button" class="pmd-btn pmd-chip-btn" data-add-active="${mId}">Equip</button>` : ''}
        ${isActive && unit.activeMoveIds.length > 1 ? `<button type="button" class="pmd-btn pmd-chip-btn" data-rem-active="${mId}">Unequip</button>` : ''}
      </div>
    `;
    bindPointerTap(row.querySelector<HTMLElement>(`[data-set-eq="${mId}"]`), () => {
      audioManager.playSfx('select');
      saveManager.setEquippedMove(unit.instanceId, mId);
      onFeedbackAndRefresh(`[E] ${mv.name} set as ${mv.category} counter.`);
    });
    bindPointerTap(row.querySelector<HTMLElement>(`[data-clear-eq="${mId}"]`), () => {
      audioManager.playSfx('cancel');
      saveManager.clearEquippedMove(unit.instanceId, mv.category as EquipCategory);
      onFeedbackAndRefresh(`${mv.category} [E] cleared — no counter at Range ${mv.range[0]}.`);
    });
    bindPointerTap(row.querySelector<HTMLElement>(`[data-add-active="${mId}"]`), () => {
      audioManager.playSfx('select');
      saveManager.setActiveMoves(unit.instanceId, [...unit.activeMoveIds, mId]);
      onFeedbackAndRefresh(`Equipped ${mv.name}.`);
    });
    bindPointerTap(row.querySelector<HTMLElement>(`[data-rem-active="${mId}"]`), () => {
      audioManager.playSfx('cancel');
      saveManager.setActiveMoves(
        unit.instanceId,
        unit.activeMoveIds.filter((id) => id !== mId)
      );
      onFeedbackAndRefresh(`Unequipped ${mv.name}.`);
    });
    movesBox.appendChild(row);
  }
  return movesBox;
}
