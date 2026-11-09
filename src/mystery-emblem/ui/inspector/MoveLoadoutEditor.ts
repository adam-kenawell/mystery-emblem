/**
 * Mystery Emblem — Shared Prep Move Loadout & TM Strip Inspector (`MoveLoadoutEditor.ts`)
 */

import type { AudioManager } from '../../audio/AudioManager';
import { getItemById, getMoveById, getSpeciesById } from '../../data/index';
import type { SaveStateManager } from '../../state/SaveStateManager';
import type { OwnedPokemonInstance, SaveData } from '../../types/schemas';
import { createItemIconCell, createMiniItemIcon } from '../PmdItemIconGrid';
import { bindPointerTap } from '../pointerControls';
import { renderColoredTypeHtml } from '../typeColors';
import { escapeUiHtml, formatMoveCategoryBadge } from './UnitDetailCard';

export interface PrepMoveLoadoutRenderParams {
  unit: OwnedPokemonInstance;
  saveManager: SaveStateManager;
  audioManager: AudioManager;
  activeHeadingEl: Element | null;
  activeListEl: HTMLElement | null;
  unlockedWrapEl: HTMLElement | null;
  unlockedListEl: HTMLElement | null;
  pendingMoveToSwapIn: string | null;
  onSetPendingSwap: (moveId: string | null, statusMsg: string) => void;
  onMutated: (statusMsg: string) => void;
}

export function renderPrepMoveLoadout(params: PrepMoveLoadoutRenderParams): void {
  const {
    unit,
    saveManager,
    audioManager,
    activeHeadingEl,
    activeListEl,
    unlockedWrapEl,
    unlockedListEl,
    pendingMoveToSwapIn,
    onSetPendingSwap,
    onMutated,
  } = params;

  if (activeHeadingEl) {
    activeHeadingEl.textContent = pendingMoveToSwapIn
      ? `Replace a move with ${getMoveById(pendingMoveToSwapIn)?.name ?? pendingMoveToSwapIn}:`
      : `Moves (${unit.activeMoveIds.length} / 4) · [E] Counter`;
  }

  if (activeListEl) {
    activeListEl.innerHTML = '';
    for (const moveId of unit.activeMoveIds) {
      const mv = getMoveById(moveId);
      if (!mv) continue;
      const maxPp = mv.pp + (unit.bonusPpByMoveId[mv.id] ?? 0);
      const isOffensive = mv.category === 'Physical' || mv.category === 'Special';
      const isEquipped = unit.equippedMoveId === mv.id;

      const card = document.createElement('div');
      card.className = `pmd-prep-move-card${isEquipped ? ' is-equipped' : ''}`;
      card.dataset.testid = `prep-active-move-card-${mv.id}`;

      const infoDiv = document.createElement('div');
      infoDiv.className = 'pmd-prep-move-info';
      infoDiv.innerHTML = `
        <div class="pmd-prep-move-title-line">
          <strong>${isEquipped ? '[E] ' : ''}${escapeUiHtml(mv.name)}</strong>
          <span class="pmd-prep-cat-tag">${renderColoredTypeHtml(mv.type)} · ${escapeUiHtml(formatMoveCategoryBadge(mv))}</span>
        </div>
        <span class="pmd-prep-move-stats">${isOffensive ? `Mt ${mv.mt} · Hit ${mv.hit}% · Crit ${mv.crit}% · ` : ''}PP ${maxPp}</span>
      `;

      const btnsDiv = document.createElement('div');
      btnsDiv.className = 'pmd-prep-move-actions';

      if (pendingMoveToSwapIn) {
        const replaceBtn = document.createElement('button');
        replaceBtn.type = 'button';
        replaceBtn.className = 'pmd-btn pmd-btn-primary pmd-chip-btn';
        replaceBtn.dataset.testid = `prep-move-replace-${mv.id}`;
        replaceBtn.textContent = 'Replace';
        bindPointerTap(replaceBtn, () => {
          const nextActive = unit.activeMoveIds.map((id) =>
            id === mv.id ? pendingMoveToSwapIn : id
          );
          saveManager.setActiveMoves(unit.instanceId, nextActive);
          audioManager.playSfx('select');
          onMutated(
            `Equipped ${getMoveById(pendingMoveToSwapIn)?.name ?? pendingMoveToSwapIn}.`
          );
        });
        btnsDiv.appendChild(replaceBtn);
      } else {
        if (isOffensive) {
          const eqBtn = document.createElement('button');
          eqBtn.type = 'button';
          eqBtn.className = `pmd-btn pmd-chip-btn${isEquipped ? ' is-active' : ''}`;
          eqBtn.dataset.testid = `prep-move-equip-counter-${mv.id}`;
          eqBtn.textContent = isEquipped ? '[E]' : 'Set [E]';
          bindPointerTap(eqBtn, () => {
            if (isEquipped) return;
            saveManager.setEquippedMove(unit.instanceId, mv.id);
            audioManager.playSfx('select');
            onMutated(`[E] ${mv.name} set for Enemy Phase.`);
          });
          btnsDiv.appendChild(eqBtn);
        }

        if (unit.activeMoveIds.length > 1) {
          const remBtn = document.createElement('button');
          remBtn.type = 'button';
          remBtn.className = 'pmd-btn pmd-chip-btn';
          remBtn.dataset.testid = `prep-move-remove-${mv.id}`;
          remBtn.textContent = 'Unequip';
          bindPointerTap(remBtn, () => {
            const nextActive = unit.activeMoveIds.filter((id) => id !== mv.id);
            saveManager.setActiveMoves(unit.instanceId, nextActive);
            audioManager.playSfx('cancel');
            onMutated(`Unequipped ${mv.name}.`);
          });
          btnsDiv.appendChild(remBtn);
        }
      }

      card.append(infoDiv, btnsDiv);
      activeListEl.appendChild(card);
    }
  }

  const benchMoveIds = unit.unlockedMoveIds.filter((id) => !unit.activeMoveIds.includes(id));
  if (unlockedWrapEl && unlockedListEl) {
    unlockedListEl.innerHTML = '';
    if (benchMoveIds.length === 0) unlockedWrapEl.hidden = true;
    else {
      unlockedWrapEl.hidden = false;
      for (const moveId of benchMoveIds) {
        const mv = getMoveById(moveId);
        if (!mv) continue;
        const isOffensive = mv.category === 'Physical' || mv.category === 'Special';
        const card = document.createElement('div');
        card.className = 'pmd-prep-move-card is-bench';
        card.innerHTML = `
          <div class="pmd-prep-move-info">
            <div class="pmd-prep-move-title-line">
              <strong>${escapeUiHtml(mv.name)}</strong>
              <span class="pmd-prep-cat-tag">${renderColoredTypeHtml(mv.type)} · ${escapeUiHtml(formatMoveCategoryBadge(mv))}</span>
            </div>
            <span class="pmd-prep-move-stats">${isOffensive ? `Mt ${mv.mt} · Hit ${mv.hit}% · ` : ''}PP ${mv.pp}</span>
          </div>
        `;
        const addBtn = document.createElement('button');
        addBtn.type = 'button';
        addBtn.className = 'pmd-btn pmd-btn-primary pmd-chip-btn';
        addBtn.dataset.testid = `prep-move-add-${mv.id}`;
        addBtn.textContent = unit.activeMoveIds.length < 4 ? 'Equip' : 'Swap';
        bindPointerTap(addBtn, () => {
          if (unit.activeMoveIds.length < 4) {
            saveManager.setActiveMoves(unit.instanceId, [...unit.activeMoveIds, mv.id]);
            audioManager.playSfx('select');
            onMutated(`Equipped ${mv.name}.`);
          } else {
            audioManager.playSfx('select');
            onSetPendingSwap(mv.id, `Tap an active move above to replace with ${mv.name}.`);
          }
        });
        card.appendChild(addBtn);
        unlockedListEl.appendChild(card);
      }
    }
  }
}

export function renderTmStripInspector(params: {
  containerEl: HTMLElement;
  unit: OwnedPokemonInstance;
  save: SaveData;
  onlyCompatibleUnknown: boolean;
  selectedTmId: string | null;
  stripTestId?: string;
  cellTestIdPrefix: string;
  teachBtnTestIdPrefix: string;
  signal?: AbortSignal;
  saveManager: SaveStateManager;
  audioManager: AudioManager;
  onSelectTm: (tmId: string) => void;
  onTaught: (msg: string) => void;
  onError?: (msg: string) => void;
}): { renderedCount: number; resolvedSelectedTmId: string | null } {
  const {
    containerEl,
    unit,
    save,
    onlyCompatibleUnknown,
    selectedTmId,
    stripTestId,
    cellTestIdPrefix,
    teachBtnTestIdPrefix,
    signal,
    saveManager,
    audioManager,
    onSelectTm,
    onTaught,
    onError,
  } = params;

  const sp = getSpeciesById(unit.speciesId);
  const candidateTms = save.convoy.filter((entry) => {
    if (entry.quantity < 1) return false;
    const item = getItemById(entry.itemId);
    if (!item || item.category !== 'tm') return false;
    if (!onlyCompatibleUnknown) return true;
    const mvId = item.effect.teachesMoveId;
    return Boolean(
      sp && mvId && sp.compatibleTmIds.includes(item.id) && !unit.unlockedMoveIds.includes(mvId)
    );
  });

  if (candidateTms.length === 0) {
    return { renderedCount: 0, resolvedSelectedTmId: selectedTmId };
  }

  let nextSelId = selectedTmId;
  if (!nextSelId || !candidateTms.some((e) => e.itemId === nextSelId)) {
    const firstTeachable = candidateTms.find((slot) => {
      const it = getItemById(slot.itemId);
      const mvId = it?.effect.teachesMoveId;
      return Boolean(
        it && sp?.compatibleTmIds.includes(it.id) && mvId && !unit.unlockedMoveIds.includes(mvId)
      );
    });
    nextSelId = (firstTeachable ?? candidateTms[0]!).itemId;
  }

  const selTmSlot = candidateTms.find((t) => t.itemId === nextSelId) ?? candidateTms[0]!;
  const selTmItem = getItemById(selTmSlot.itemId)!;
  const selMoveId = selTmItem.effect.teachesMoveId ?? '';
  const selMove = getMoveById(selMoveId);
  const selCompatible = Boolean(sp?.compatibleTmIds.includes(selTmItem.id));
  const selAlreadyKnown = Boolean(selMoveId && unit.unlockedMoveIds.includes(selMoveId));
  const selCanTeach = selCompatible && !selAlreadyKnown;

  const tmStrip = document.createElement('div');
  tmStrip.className = 'pmd-item-icon-grid is-strip';
  if (stripTestId) tmStrip.dataset.testid = stripTestId;
  for (const slot of candidateTms) {
    const it = getItemById(slot.itemId)!;
    const mvId = it.effect.teachesMoveId ?? '';
    const compat = Boolean(sp?.compatibleTmIds.includes(it.id));
    const known = Boolean(mvId && unit.unlockedMoveIds.includes(mvId));
    tmStrip.appendChild(
      createItemIconCell({
        itemId: it.id,
        testId: `${cellTestIdPrefix}${it.id}`,
        quantity: slot.quantity,
        isSelected: it.id === selTmItem.id,
        isDepleted: !onlyCompatibleUnknown && !(compat && !known),
        signal,
        onSelect: () => {
          audioManager.playSfx('select');
          onSelectTm(it.id);
        },
      })
    );
  }

  const tmBanner = document.createElement('div');
  tmBanner.className = 'pmd-item-inspector-banner';
  if (!onlyCompatibleUnknown) tmBanner.style.marginTop = '6px';
  const tmMain = document.createElement('div');
  tmMain.className = 'pmd-item-inspector-main';
  tmMain.appendChild(createMiniItemIcon(selTmItem.id, { sizePx: 24, decorative: true }));
  const tmCopy = document.createElement('div');
  tmCopy.className = 'pmd-item-inspector-copy';
  const descHtml = selAlreadyKnown
    ? 'Already known'
    : selCompatible
      ? `Teaches ${escapeUiHtml(selMove?.name ?? selMoveId)}${selMove ? ` (${renderColoredTypeHtml(selMove.type)}${onlyCompatibleUnknown ? ` · ${escapeUiHtml(formatMoveCategoryBadge(selMove))}` : ''})` : ''}`
      : 'Incompatible';
  tmCopy.innerHTML = `
    <div class="pmd-item-inspector-head"><strong class="pmd-item-inspector-name">${escapeUiHtml(selTmItem.name)} ×${selTmSlot.quantity}</strong></div>
    <span class="pmd-item-inspector-desc">${descHtml}</span>
  `;
  tmMain.appendChild(tmCopy);

  const teachBtn = document.createElement('button');
  teachBtn.type = 'button';
  teachBtn.className = 'pmd-btn pmd-btn-primary pmd-chip-btn';
  teachBtn.dataset.testid = `${teachBtnTestIdPrefix}${selTmItem.id}`;
  teachBtn.disabled = !selCanTeach;
  teachBtn.textContent = selAlreadyKnown ? 'Known' : selCompatible ? 'Teach' : 'Incompatible';
  bindPointerTap(teachBtn, () => {
    try {
      saveManager.teachTmMove(unit.instanceId, selTmItem.id);
      audioManager.playSfx('heal');
      onTaught(`${unit.nickname} learned ${selMove?.name ?? selTmItem.name}!`);
    } catch (err) {
      audioManager.playSfx('cancel');
      onError?.(err instanceof Error ? err.message : 'Could not teach TM.');
    }
  });

  tmBanner.append(tmMain, teachBtn);
  containerEl.append(tmStrip, tmBanner);
  return { renderedCount: candidateTms.length, resolvedSelectedTmId: nextSelId };
}
