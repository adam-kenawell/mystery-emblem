/**
 * Mystery Emblem — Overworld System Menu `Units` Tab Renderer (`OverworldUnitsTabRenderer.ts`)
 */

import { resolveUnitVisualAssetId } from '../../assets/pmdAssetLoader';
import type { AudioManager } from '../../audio/AudioManager';
import { getItemById, getPersonalSkillById, getSpeciesById } from '../../data/index';
import { getUnitEquippedItemId, type SaveStateManager } from '../../state/SaveStateManager';
import type { SaveData } from '../../types/schemas';
import { createMiniItemIcon } from '../../ui/PmdItemIconGrid';
import { PmdPortraitView } from '../../ui/PmdSpriteCanvas';
import { createUnitPortraitCell } from '../../ui/PmdUnitPortraitGrid';
import { renderTmStripInspector } from '../../ui/inspector/MoveLoadoutEditor';
import {
  buildOverworldMoveLoadoutSubbox,
  renderOverworldVitaminsSubbox,
} from '../../ui/inspector/OverworldUnitSubboxes';
import {
  escapeUiHtml,
  getOwnedEvolutionBranches,
  populateUnitSevenStatBoxes,
} from '../../ui/inspector/UnitDetailCard';
import { bindPointerTap } from '../../ui/pointerControls';
import { renderColoredTypesHtml } from '../../ui/typeColors';

export interface OverworldUnitsTabParams {
  menuPanelBodyEl: HTMLElement;
  save: SaveData;
  saveManager: SaveStateManager;
  audioManager: AudioManager;
  unitDetailPortraitView: PmdPortraitView | null;
  selectedUnitInstanceId: string | null;
  selectedUnitVitaminId: string | null;
  selectedUnitTmId: string | null;
  onSelectUnit: (instanceId: string) => void;
  onRequestRenameUnit?: (instanceId: string) => Promise<void> | void;
  onSelectVitamin: (itemId: string) => void;
  onSelectTm: (itemId: string) => void;
  onEvolvedPreloadSprites: () => void;
  onFeedbackAndRefresh: (msg: string) => void;
  isSystemMenuOpen: () => boolean;
}

export function renderOverworldUnitsTab(params: OverworldUnitsTabParams): {
  unitDetailPortraitView: PmdPortraitView;
  selectedUnitInstanceId: string | null;
  selectedUnitVitaminId: string | null;
  selectedUnitTmId: string | null;
} {
  const {
    menuPanelBodyEl,
    save,
    saveManager,
    audioManager,
    selectedUnitVitaminId,
    selectedUnitTmId,
    onSelectUnit,
    onRequestRenameUnit,
    onSelectVitamin,
    onSelectTm,
    onEvolvedPreloadSprites,
    onFeedbackAndRefresh,
    isSystemMenuOpen,
  } = params;

  const resolvedUnitId =
    params.selectedUnitInstanceId &&
    save.roster.some((u) => u.instanceId === params.selectedUnitInstanceId)
      ? params.selectedUnitInstanceId
      : (save.roster[0]?.instanceId ?? null);

  const portraitView =
    params.unitDetailPortraitView ?? new PmdPortraitView({ testId: 'overworld-unit-portrait' });

  const grid = document.createElement('div');
  grid.className = 'pmd-overworld-roster-grid';

  const listCol = document.createElement('div');
  listCol.className = 'pmd-overworld-unit-list pmd-unit-portrait-grid';
  listCol.dataset.testid = 'overworld-roster-grid';

  for (const u of save.roster) {
    const uItemId = getUnitEquippedItemId(u);
    listCol.appendChild(
      createUnitPortraitCell({
        speciesIdOrAssetId: resolveUnitVisualAssetId(u.speciesId, u.cosmeticForm),
        ariaLabel: u.nickname,
        testId: `overworld-roster-unit-${u.instanceId}`,
        portraitTestId: `overworld-roster-portrait-${u.instanceId}`,
        isSelected: u.instanceId === resolvedUnitId,
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

  const detailCol = document.createElement('div');
  detailCol.className = 'pmd-overworld-unit-detail';

  let nextVitaminId = selectedUnitVitaminId;
  let nextTmId = selectedUnitTmId;

  const selected = save.roster.find((u) => u.instanceId === resolvedUnitId);
  if (selected) {
    const sp = getSpeciesById(selected.speciesId);
    const skill = sp ? getPersonalSkillById(sp.personalSkillId) : undefined;
    const equippedItemId = getUnitEquippedItemId(selected);
    const equippedItem = equippedItemId ? getItemById(equippedItemId) : undefined;
    const showSpeciesMeta =
      sp && selected.nickname.trim().toLowerCase() !== sp.name.trim().toLowerCase()
        ? `${sp.name} · `
        : '';

    const headerRow = document.createElement('div');
    headerRow.className = 'pmd-devtools-row-between';
    headerRow.innerHTML = `
      <div class="pmd-forecast-unit-head">
        <div class="pmd-forecast-portrait-slot" data-ow-unit-portrait></div>
        <div class="pmd-forecast-unit-id">
          <strong class="pmd-forecast-unit-name" data-testid="overworld-unit-detail-name">${escapeUiHtml(selected.nickname)}${selected.isLord ? ' ★' : ''}</strong>
          <span class="pmd-forecast-unit-meta">${escapeUiHtml(showSpeciesMeta)}Lv. ${selected.level} · ${sp ? renderColoredTypesHtml(sp.types, '/') : ''} · ${escapeUiHtml(sp?.traversalClass ?? 'Grounded')}</span>
        </div>
      </div>
      <button type="button" class="pmd-btn pmd-chip-btn" data-testid="overworld-unit-rename-btn">Rename</button>
    `;
    headerRow.querySelector('[data-ow-unit-portrait]')!.appendChild(portraitView.canvas);
    void portraitView.setPortrait({
      speciesIdOrAssetId: resolveUnitVisualAssetId(selected.speciesId, selected.cosmeticForm),
      emotion: 'Normal',
    });

    bindPointerTap(
      headerRow.querySelector<HTMLElement>('[data-testid="overworld-unit-rename-btn"]'),
      () => {
        if (!onRequestRenameUnit) return;
        audioManager.playSfx('select');
        void Promise.resolve(onRequestRenameUnit(selected.instanceId)).then(() => {
          if (isSystemMenuOpen()) onFeedbackAndRefresh('');
        });
      }
    );

    const statStrip = document.createElement('div');
    statStrip.className = 'pmd-overworld-stat-strip';
    statStrip.dataset.testid = 'overworld-unit-stats';
    populateUnitSevenStatBoxes(statStrip, selected, 'overworld');

    const gearBox = document.createElement('div');
    gearBox.className = 'pmd-overworld-subbox';
    gearBox.innerHTML = `
      <div class="pmd-overworld-action-row">
        <div class="pmd-overworld-action-meta">
          <strong>${escapeUiHtml(skill?.name ?? 'Ability')}</strong>
          <span>${escapeUiHtml(skill?.description ?? '')}</span>
        </div>
      </div>
    `;
    const itemActionRow = document.createElement('div');
    itemActionRow.className = 'pmd-overworld-action-row';
    const itemMeta = document.createElement('div');
    itemMeta.className = 'pmd-overworld-action-meta';
    itemMeta.dataset.testid = 'overworld-unit-equipped-item';
    if (equippedItem) {
      const iconRow = document.createElement('div');
      iconRow.className = 'pmd-inline-item-row';
      iconRow.appendChild(createMiniItemIcon(equippedItem.id, { sizePx: 22 }));
      const descSpan = document.createElement('span');
      descSpan.textContent = equippedItem.description;
      iconRow.appendChild(descSpan);
      itemMeta.appendChild(iconRow);
    } else {
      const emptyStrong = document.createElement('strong');
      emptyStrong.textContent = 'Item: Empty';
      itemMeta.appendChild(emptyStrong);
    }
    itemActionRow.appendChild(itemMeta);

    if (equippedItem) {
      const unequipBtn = document.createElement('button');
      unequipBtn.type = 'button';
      unequipBtn.className = 'pmd-btn pmd-chip-btn';
      unequipBtn.dataset.testid = 'overworld-unequip-item-btn';
      unequipBtn.textContent = 'Unequip';
      bindPointerTap(unequipBtn, () => {
        audioManager.playSfx('cancel');
        saveManager.equipItemToUnit(selected.instanceId, null);
        onFeedbackAndRefresh(`Returned ${equippedItem.name} to Bag.`);
      });
      itemActionRow.appendChild(unequipBtn);
    }
    gearBox.appendChild(itemActionRow);
    detailCol.append(headerRow, statStrip, gearBox);

    const { ownedBranches } = getOwnedEvolutionBranches(selected, save);
    if (ownedBranches.length > 0) {
      const promoBox = document.createElement('div');
      promoBox.className = 'pmd-overworld-subbox';
      promoBox.innerHTML = `<p class="pmd-overworld-subbox-title">Evolution</p>`;
      for (const branch of ownedBranches) {
        const targetSp = getSpeciesById(branch.targetSpeciesId);
        const meetsLevel = selected.level >= branch.minLevel;
        const row = document.createElement('div');
        row.className = 'pmd-overworld-action-row';
        const metaDiv = document.createElement('div');
        metaDiv.className = 'pmd-overworld-action-meta';
        const titleStrong = document.createElement('strong');
        titleStrong.textContent = `Evolve → ${targetSp?.name ?? branch.targetSpeciesId}`;
        const reqRow = document.createElement('div');
        reqRow.className = 'pmd-inline-item-row';
        reqRow.appendChild(createMiniItemIcon(branch.requiredItemId, { sizePx: 20 }));
        const lvlSpan = document.createElement('span');
        lvlSpan.textContent = `Lv. ${branch.minLevel}+`;
        reqRow.appendChild(lvlSpan);
        metaDiv.append(titleStrong, reqRow);

        const evoBtn = document.createElement('button');
        evoBtn.type = 'button';
        evoBtn.className = 'pmd-btn pmd-btn-primary pmd-chip-btn';
        evoBtn.dataset.testid = `overworld-promote-${branch.targetSpeciesId}`;
        evoBtn.disabled = !meetsLevel;
        evoBtn.textContent = 'Evolve';
        bindPointerTap(evoBtn, () => {
          try {
            saveManager.useEvolutionItemOnUnit(
              selected.instanceId,
              branch.requiredItemId,
              branch.targetSpeciesId
            );
            audioManager.playSfx('victory_fanfare');
            onEvolvedPreloadSprites();
            onFeedbackAndRefresh(
              `${selected.nickname} evolved into ${targetSp?.name ?? branch.targetSpeciesId}!`
            );
          } catch (err) {
            audioManager.playSfx('cancel');
            onFeedbackAndRefresh(err instanceof Error ? err.message : 'Cannot evolve yet.');
          }
        });
        row.append(metaDiv, evoBtn);
        promoBox.appendChild(row);
      }
      detailCol.appendChild(promoBox);
    }

    const vitRes = renderOverworldVitaminsSubbox({
      save,
      unit: selected,
      selectedVitaminId: selectedUnitVitaminId,
      saveManager,
      audioManager,
      onSelectVitamin,
      onUsed: onFeedbackAndRefresh,
      onError: onFeedbackAndRefresh,
    });
    nextVitaminId = vitRes.resolvedVitaminId;
    if (vitRes.element) detailCol.appendChild(vitRes.element);

    const tmBox = document.createElement('div');
    tmBox.className = 'pmd-overworld-subbox';
    tmBox.innerHTML = `<p class="pmd-overworld-subbox-title">TMs</p>`;
    const tmRes = renderTmStripInspector({
      containerEl: tmBox,
      unit: selected,
      save,
      onlyCompatibleUnknown: false,
      selectedTmId: selectedUnitTmId,
      stripTestId: 'overworld-unit-tms-grid',
      cellTestIdPrefix: 'overworld-tm-cell-',
      teachBtnTestIdPrefix: 'overworld-teach-tm-',
      saveManager,
      audioManager,
      onSelectTm,
      onTaught: onFeedbackAndRefresh,
      onError: onFeedbackAndRefresh,
    });
    nextTmId = tmRes.resolvedSelectedTmId;
    if (tmRes.renderedCount > 0) detailCol.appendChild(tmBox);

    detailCol.appendChild(
      buildOverworldMoveLoadoutSubbox({
        unit: selected,
        saveManager,
        audioManager,
        onFeedbackAndRefresh,
      })
    );
  }

  grid.append(listCol, detailCol);
  menuPanelBodyEl.appendChild(grid);
  return {
    unitDetailPortraitView: portraitView,
    selectedUnitInstanceId: resolvedUnitId,
    selectedUnitVitaminId: nextVitaminId,
    selectedUnitTmId: nextTmId,
  };
}
