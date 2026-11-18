/**
 * Mystery Emblem - Shared Unit Detail, Inspector Banners, Evolution & Audio UI Helpers (`UnitDetailCard.ts`)
 *
 * Shared UI helpers for rendering unit stats, elemental typing, 1-item-slot banners,
 * item/TM/vitamin inspector cards, branched Evolution Stone / Gem buttons, and audio controls
 * across Overworld, Chapter Prep, and Dungeon Settings.
 *
 * Strictly obeys Rule 2 (Unified Pointer Events ONLY) and Rule 3 (PMD visual skin).
 */

import { resolveUnitVisualAssetId } from '../../assets/pmdAssetLoader';
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
import { createMiniSpeciesPortrait } from '../PmdUnitPortraitGrid';
import { bindPointerTap } from '../pointerControls';
import { escapeHtml } from '../typeColors';

export { escapeHtml as escapeUiHtml };

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

export function createItemInspectorBanner(params: {
  itemId: string;
  iconSizePx?: number;
  headHtml: string;
  descHtml: string;
  testId?: string;
  marginTopPx?: number;
  holders?: ReadonlyArray<{ assetId: string; title: string; testId?: string }>;
}): HTMLElement {
  const banner = document.createElement('div');
  banner.className = 'pmd-item-inspector-banner';
  if (params.testId) banner.dataset.testid = params.testId;
  if (params.marginTopPx !== undefined) banner.style.marginTop = `${params.marginTopPx}px`;

  const mainEl = document.createElement('div');
  mainEl.className = 'pmd-item-inspector-main';
  mainEl.appendChild(
    createMiniItemIcon(params.itemId, { sizePx: params.iconSizePx ?? 24, decorative: true })
  );

  const copyEl = document.createElement('div');
  copyEl.className = 'pmd-item-inspector-copy';
  copyEl.innerHTML = `
    <div class="pmd-item-inspector-head">${params.headHtml}${params.holders ? '<span class="pmd-item-holders-inline" data-item-holders></span>' : ''}</div>
    <span class="pmd-item-inspector-desc">${params.descHtml}</span>
  `;

  if (params.holders) {
    const holdersContainer = copyEl.querySelector<HTMLElement>('[data-item-holders]');
    if (holdersContainer) {
      if (params.holders.length === 0) {
        holdersContainer.hidden = true;
      } else {
        for (const h of params.holders) {
          holdersContainer.appendChild(
            createMiniSpeciesPortrait(h.assetId, {
              title: h.title,
              sizePx: 22,
              testId: h.testId,
            })
          );
        }
      }
    }
  }

  mainEl.appendChild(copyEl);
  banner.appendChild(mainEl);
  return banner;
}

export function createEvolutionBranchButton(params: {
  unit: OwnedPokemonInstance;
  branch: EvolutionBranch;
  saveManager: SaveStateManager;
  audioManager: AudioManager;
  testId?: string;
  label?: string;
  disabled?: boolean;
  sfx?: 'heal' | 'victory_fanfare';
  onPromoted: (promoted: OwnedPokemonInstance, targetSpeciesName: string) => void;
  onError: (msg: string) => void;
}): HTMLButtonElement {
  const { unit, branch, saveManager, audioManager, onPromoted, onError } = params;
  const targetSp = getSpeciesById(branch.targetSpeciesId);
  const targetName = targetSp?.name ?? branch.targetSpeciesId;
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'pmd-btn pmd-btn-primary pmd-chip-btn';
  if (params.testId) btn.dataset.testid = params.testId;
  if (params.disabled) btn.disabled = true;
  btn.textContent = params.label ?? `Evolve → ${targetName}`;

  if (!params.disabled) {
    bindPointerTap(btn, () => {
      try {
        const promoted = saveManager.useEvolutionItemOnUnit(
          unit.instanceId,
          branch.requiredItemId,
          branch.targetSpeciesId
        );
        audioManager.playSfx(params.sfx ?? 'heal');
        const evolvedName = getSpeciesById(promoted.speciesId)?.name ?? promoted.speciesId;
        onPromoted(promoted, evolvedName);
      } catch (err) {
        audioManager.playSfx('cancel');
        onError(err instanceof Error ? err.message : 'Promotion failed.');
      }
    });
  }
  return btn;
}

export function renderSharedAudioSettingsControls(params: {
  audioManager: AudioManager;
  layout: 'battle' | 'overworld';
  muteTestId: string;
  bgmSliderTestId: string;
  sfxSliderTestId: string;
  bgmValTestId?: string;
  sfxValTestId?: string;
  onAfterToggleMute?: () => void;
}): HTMLElement {
  const {
    audioManager,
    layout,
    muteTestId,
    bgmSliderTestId,
    sfxSliderTestId,
    bgmValTestId,
    sfxValTestId,
    onAfterToggleMute,
  } = params;
  const settings = audioManager.getSettings();
  const bgmPct = Math.round(settings.bgmVolume * 100);
  const sfxPct = Math.round(settings.sfxVolume * 100);

  const root = document.createElement('div');
  if (layout === 'battle') {
    root.className = 'pmd-dungeon-settings-list';
    root.innerHTML = `
      <button type="button" class="pmd-btn${settings.muted ? '' : ' is-active'}" data-testid="${muteTestId}">
        ${settings.muted ? 'Audio: Muted' : 'Audio: ON'}
      </button>
      <div class="pmd-dungeon-slider-row">
        <label for="${bgmSliderTestId}">Music</label>
        <input id="${bgmSliderTestId}" type="range" min="0" max="100" value="${bgmPct}" data-testid="${bgmSliderTestId}" />
        <span class="pmd-dungeon-slider-val"${bgmValTestId ? ` data-testid="${bgmValTestId}"` : ''} data-audio-bgm-val>${bgmPct}%</span>
      </div>
      <div class="pmd-dungeon-slider-row">
        <label for="${sfxSliderTestId}">SFX</label>
        <input id="${sfxSliderTestId}" type="range" min="0" max="100" value="${sfxPct}" data-testid="${sfxSliderTestId}" />
        <span class="pmd-dungeon-slider-val"${sfxValTestId ? ` data-testid="${sfxValTestId}"` : ''} data-audio-sfx-val>${sfxPct}%</span>
      </div>
    `;
  } else {
    root.className = 'pmd-overworld-subbox';
    root.innerHTML = `
      <p class="pmd-overworld-subbox-title">Audio</p>
      <div class="pmd-overworld-action-row">
        <button type="button" class="pmd-btn pmd-chip-btn${settings.muted ? '' : ' is-active'}" data-testid="${muteTestId}">
          ${settings.muted ? 'Audio: Muted' : 'Audio: ON'}
        </button>
        <label style="display:flex;align-items:center;gap:0.4rem;font-size:0.75rem;">
          <span>BGM</span>
          <input type="range" min="0" max="100" value="${bgmPct}" data-testid="${bgmSliderTestId}" />
        </label>
        <label style="display:flex;align-items:center;gap:0.4rem;font-size:0.75rem;">
          <span>SFX</span>
          <input type="range" min="0" max="100" value="${sfxPct}" data-testid="${sfxSliderTestId}" />
        </label>
      </div>
    `;
  }

  const muteBtn = root.querySelector<HTMLButtonElement>(`[data-testid="${muteTestId}"]`);
  const bgmSlider = root.querySelector<HTMLInputElement>(`[data-testid="${bgmSliderTestId}"]`);
  const sfxSlider = root.querySelector<HTMLInputElement>(`[data-testid="${sfxSliderTestId}"]`);
  const bgmValEl = root.querySelector<HTMLElement>('[data-audio-bgm-val]');
  const sfxValEl = root.querySelector<HTMLElement>('[data-audio-sfx-val]');

  bindPointerTap(muteBtn, () => {
    const nowMuted = audioManager.toggleMute();
    if (!nowMuted) audioManager.playSfx('select');
    if (muteBtn) {
      muteBtn.textContent = nowMuted ? 'Audio: Muted' : 'Audio: ON';
      muteBtn.classList.toggle('is-active', !nowMuted);
    }
    onAfterToggleMute?.();
  });

  bgmSlider?.addEventListener('input', () => {
    const pct = Math.max(0, Math.min(100, Math.round(Number(bgmSlider.value))));
    audioManager.setBgmVolume(pct / 100);
    if (bgmValEl) bgmValEl.textContent = `${pct}%`;
  });

  sfxSlider?.addEventListener('input', () => {
    const pct = Math.max(0, Math.min(100, Math.round(Number(sfxSlider.value))));
    audioManager.setSfxVolume(pct / 100);
    if (sfxValEl) sfxValEl.textContent = `${pct}%`;
  });
  sfxSlider?.addEventListener('change', () => {
    audioManager.playSfx('select');
  });

  return root;
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
    btnsWrap.appendChild(
      createEvolutionBranchButton({
        unit,
        branch,
        saveManager,
        audioManager,
        testId: `prep-evolve-btn-${branch.targetSpeciesId}`,
        sfx: 'heal',
        onPromoted: (promoted, evolvedName) =>
          onPromoted(`★ ${promoted.nickname} evolved into ${evolvedName}!`),
        onError,
      })
    );
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
  const { containerEl, unit, saveManager, audioManager, iconTestId, unequipBtnTestId, onUnequipped } = params;
  containerEl.innerHTML = '';
  const currentItemId = getUnitEquippedItemId(unit);
  const currentItem = currentItemId ? getItemById(currentItemId) : undefined;
  const infoDiv = document.createElement('div');
  infoDiv.className = 'pmd-prep-slot-info';

  const unitHeaderRow = document.createElement('div');
  unitHeaderRow.className = 'pmd-inline-item-row';
  unitHeaderRow.appendChild(
    createMiniSpeciesPortrait(resolveUnitVisualAssetId(unit.speciesId, unit.cosmeticForm), {
      title: unit.nickname,
      sizePx: 24,
    })
  );
  const unitTitleSpan = document.createElement('span');
  unitTitleSpan.innerHTML = `<strong style="color:var(--pmd-text-yellow);font-size:15px;">${escapeHtml(unit.nickname)}</strong> <span class="pmd-prep-unit-meta-line">Lv. ${unit.level}</span>`;
  unitHeaderRow.appendChild(unitTitleSpan);
  infoDiv.appendChild(unitHeaderRow);

  if (currentItem) {
    const titleLine = document.createElement('div');
    titleLine.className = 'pmd-inline-item-row';
    const itemLbl = document.createElement('span');
    itemLbl.className = 'pmd-move-learned-field-lbl';
    itemLbl.textContent = 'Equipped Item:';
    const itemNameStrong = document.createElement('strong');
    itemNameStrong.style.color = 'var(--pmd-text-green)';
    itemNameStrong.textContent = currentItem.name;
    titleLine.append(
      itemLbl,
      createMiniItemIcon(currentItem.id, { sizePx: 22, testId: iconTestId }),
      itemNameStrong
    );
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
    const emptyLine = document.createElement('div');
    emptyLine.className = 'pmd-inline-item-row';
    emptyLine.innerHTML = `<span class="pmd-move-learned-field-lbl">Equipped Item:</span><strong>Empty</strong>`;
    infoDiv.appendChild(emptyLine);
    containerEl.appendChild(infoDiv);
  }
}
