/**
 * Mystery Emblem - Dev Tools Roster & Select Population Helpers (`devToolsRosterActions.ts`)
 */

import type { AudioManager } from '../../audio/AudioManager';
import { DEMO_INITIAL_CONVOY, DEMO_STARTING_LEVEL, MENTOR_JAGEN_SPECIES_ID } from '../../data/campaignRegistry';
import {
  ITEMS_LIST,
  POKEMON_SPECIES_LIST,
  getSpeciesById,
} from '../../data/index';
import { DEMO_OVERWORLD_GRAPH } from '../../data/overworldMapData';
import type { SaveStateManager } from '../../state/SaveStateManager';
import type { SaveData } from '../../types/schemas';
import { bindPointerTap } from '../pointerControls';

export function seedFreshDemoSaveForCheat(saveManager: SaveStateManager): SaveData {
  return saveManager.createNewCampaignSave({
    campaignMode: 'demo',
    lordSpeciesId: 'axew',
    partnerSpeciesId: 'quaxly',
    healerSpeciesId: 'flabebe',
    startingLevel: DEMO_STARTING_LEVEL,
    scaleStatsToLevel: true,
    initialConvoy: [...DEMO_INITIAL_CONVOY, { itemId: 'evolution_stone', quantity: 1 }],
    overworldGraph: DEMO_OVERWORLD_GRAPH,
  });
}

export function populateDevToolsStaticSelects(
  itemSelectEl: HTMLSelectElement | null,
  recruitSelectEl: HTMLSelectElement | null
): void {
  if (itemSelectEl) {
    itemSelectEl.innerHTML = '';
    for (const item of ITEMS_LIST) {
      const opt = document.createElement('option');
      opt.value = item.id;
      opt.textContent = `${item.name} (${item.category})`;
      itemSelectEl.appendChild(opt);
    }
  }
  if (recruitSelectEl) {
    recruitSelectEl.innerHTML = '';
    const recruitable = POKEMON_SPECIES_LIST.filter(
      (sp) =>
        sp.faction !== 'enemy' &&
        sp.faction !== 'ally_npc' &&
        (sp.stage === 1 || sp.id === MENTOR_JAGEN_SPECIES_ID || sp.id === 'dragapult' || sp.id === 'hydreigon')
    );
    for (const sp of recruitable) {
      const opt = document.createElement('option');
      opt.value = sp.id;
      opt.textContent = `${sp.name} (${sp.types.join('/')})`;
      recruitSelectEl.appendChild(opt);
    }
  }
}

export function syncDevToolsUnitSelectOptions(
  unitSelectEl: HTMLSelectElement | null,
  save: SaveData | null,
  selectedUnitInstanceId: string | null
): string | null {
  if (!unitSelectEl) return selectedUnitInstanceId;
  unitSelectEl.innerHTML = '';
  if (!save || save.roster.length === 0) {
    const opt = document.createElement('option');
    opt.value = '';
    opt.textContent = 'No active save (tap Seed Demo Save)';
    unitSelectEl.appendChild(opt);
    unitSelectEl.disabled = true;
    return null;
  }

  unitSelectEl.disabled = false;
  const resolvedId =
    selectedUnitInstanceId && save.roster.some((u) => u.instanceId === selectedUnitInstanceId)
      ? selectedUnitInstanceId
      : save.roster[0]!.instanceId;
  for (const u of save.roster) {
    const sp = getSpeciesById(u.speciesId);
    const opt = document.createElement('option');
    opt.value = u.instanceId;
    opt.textContent = `${u.nickname} (${sp?.name ?? u.speciesId} · Lv.${u.level})`;
    unitSelectEl.appendChild(opt);
  }
  unitSelectEl.value = resolvedId;
  return resolvedId;
}

export function renderDevToolsUnitStageButtons(params: {
  container: HTMLElement | null;
  save: SaveData | null;
  selectedUnitInstanceId: string | null;
  saveManager: SaveStateManager;
  audioManager: AudioManager;
  signal: AbortSignal;
  onEvolved: (statusMsg: string) => void;
}): void {
  const { container, save, selectedUnitInstanceId, saveManager, audioManager, signal, onEvolved } =
    params;
  if (!container) return;
  container.innerHTML = '';

  const unit = save?.roster.find((u) => u.instanceId === selectedUnitInstanceId);
  const curSp = unit ? getSpeciesById(unit.speciesId) : undefined;
  if (!unit || !curSp) return;

  const lineForms = POKEMON_SPECIES_LIST.filter((sp) => sp.lineId === curSp.lineId).sort(
    (a, b) => a.stage - b.stage
  );
  for (const form of lineForms) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `pmd-btn pmd-chip-btn${form.id === unit.speciesId ? ' is-active' : ''}`;
    btn.dataset.testid = `devtools-stage-${form.id}`;
    btn.textContent = `S${form.stage}: ${form.name}`;
    bindPointerTap(
      btn,
      () => {
        if (form.id === unit.speciesId) return;
        audioManager.playSfx('select');
        saveManager.evolveUnitToSpecies(unit.instanceId, form.id);
        onEvolved(`${unit.nickname} → ${form.name}`);
      },
      { signal }
    );
    container.appendChild(btn);
  }
}
