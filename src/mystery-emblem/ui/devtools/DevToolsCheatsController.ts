/**
 * Mystery Emblem — Admin Dev Tools Cheats Tab Controller (`DevToolsCheatsController.ts`)
 */

import type { AudioManager } from '../../audio/AudioManager';
import { DEMO_STARTING_LEVEL } from '../../data/campaignRegistry';
import { getItemById } from '../../data/index';
import { DEMO_OVERWORLD_GRAPH } from '../../data/overworldMapData';
import type { SaveStateManager } from '../../state/SaveStateManager';
import type { KecleonShopType } from '../../types/schemas';
import { bindPointerTap } from '../pointerControls';
import {
  populateDevToolsStaticSelects,
  renderDevToolsUnitStageButtons,
  seedFreshDemoSaveForCheat,
  syncDevToolsUnitSelectOptions,
} from './devToolsRosterActions';

export interface DevToolsCheatsDeps {
  modalEl: HTMLElement;
  saveManager: SaveStateManager;
  audioManager: AudioManager;
  isBattleOpen: () => boolean;
  onCheatFullHealSquad: () => void;
  onCheatInstantWin: () => void;
  onLiveStateMutated: (opts?: { snapOverworld?: boolean }) => void;
  onRequestRenameUnit: (instanceId: string) => void;
  onClose: () => void;
  signal: AbortSignal;
}

export class DevToolsCheatsController {
  private readonly deps: DevToolsCheatsDeps;
  private selectedUnitInstanceId: string | null = null;

  private readonly unitSelectEl: HTMLSelectElement | null;
  private readonly unitStageBtnsEl: HTMLElement | null;
  private readonly goldLabelEl: HTMLElement | null;
  private readonly itemSelectEl: HTMLSelectElement | null;
  private readonly recruitSelectEl: HTMLSelectElement | null;
  private readonly battleHealBtnEl: HTMLButtonElement | null;
  private readonly battleWinBtnEl: HTMLButtonElement | null;
  private readonly cheatStatusEl: HTMLElement | null;

  constructor(deps: DevToolsCheatsDeps) {
    this.deps = deps;
    const { modalEl } = deps;
    this.unitSelectEl = modalEl.querySelector('[data-testid="devtools-unit-select"]');
    this.unitStageBtnsEl = modalEl.querySelector('[data-testid="devtools-unit-stage-buttons"]');
    this.goldLabelEl = modalEl.querySelector('[data-testid="devtools-gold-label"]');
    this.itemSelectEl = modalEl.querySelector('[data-testid="devtools-item-select"]');
    this.recruitSelectEl = modalEl.querySelector('[data-testid="devtools-recruit-select"]');
    this.battleHealBtnEl = modalEl.querySelector('[data-testid="devtools-battle-heal"]');
    this.battleWinBtnEl = modalEl.querySelector('[data-testid="devtools-battle-win"]');
    this.cheatStatusEl = modalEl.querySelector('[data-testid="devtools-cheat-status"]');

    populateDevToolsStaticSelects(this.itemSelectEl, this.recruitSelectEl);
    this.bindControls();
  }

  private setCheatStatus(msg: string): void {
    if (!this.cheatStatusEl) return;
    const trimmed = msg.trim();
    this.cheatStatusEl.textContent = trimmed;
    this.cheatStatusEl.hidden = trimmed.length === 0;
  }

  private ensureActiveSaveForCheat(): void {
    if (this.deps.saveManager.getSave() === null) seedFreshDemoSaveForCheat(this.deps.saveManager);
  }

  private bindControls(): void {
    const { modalEl, saveManager, audioManager, signal } = this.deps;

    this.unitSelectEl?.addEventListener(
      'change',
      () => {
        this.selectedUnitInstanceId = this.unitSelectEl?.value ?? null;
        this.renderStageButtons();
      },
      { signal }
    );

    bindPointerTap(
      modalEl.querySelector('[data-testid="devtools-rename-unit"]'),
      () => {
        if (!this.selectedUnitInstanceId) return;
        audioManager.playSfx('select');
        this.deps.onRequestRenameUnit(this.selectedUnitInstanceId);
      },
      { signal }
    );

    const applyUnitLv = (computeLv: (cur: number) => number) => {
      const unit = saveManager.getSave()?.roster.find((u) => u.instanceId === this.selectedUnitInstanceId);
      if (!unit) return;
      const nextLv = Math.max(1, Math.min(40, computeLv(unit.level)));
      saveManager.setUnitLevelForTest(unit.instanceId, nextLv, true);
      audioManager.playSfx('select');
      this.setCheatStatus(`${unit.nickname} → Lv.${nextLv}`);
      this.refresh();
      this.deps.onLiveStateMutated();
    };

    modalEl.querySelectorAll<HTMLButtonElement>('[data-unit-lv-delta]').forEach((btn) => {
      bindPointerTap(btn, () => applyUnitLv((lv) => lv + Number(btn.dataset.unitLvDelta ?? 0)), { signal });
    });
    modalEl.querySelectorAll<HTMLButtonElement>('[data-unit-lv-set]').forEach((btn) => {
      bindPointerTap(btn, () => applyUnitLv(() => Number(btn.dataset.unitLvSet ?? 10)), { signal });
    });

    bindPointerTap(
      modalEl.querySelector('[data-testid="devtools-add-gold"]'),
      () => {
        this.ensureActiveSaveForCheat();
        const updated = saveManager.addGold(1000);
        audioManager.playSfx('heal');
        this.setCheatStatus(`Gold: ${updated.gold.toLocaleString()}G`);
        this.refresh();
        this.deps.onLiveStateMutated();
      },
      { signal }
    );

    bindPointerTap(
      modalEl.querySelector('[data-testid="devtools-spawn-item"]'),
      () => {
        const itemId = this.itemSelectEl?.value;
        if (!itemId) return;
        this.ensureActiveSaveForCheat();
        saveManager.addConvoyItem(itemId, 1);
        audioManager.playSfx('select');
        this.setCheatStatus(`Added ${getItemById(itemId)?.name ?? itemId} to Bag.`);
        this.refresh();
        this.deps.onLiveStateMutated();
      },
      { signal }
    );

    bindPointerTap(
      modalEl.querySelector('[data-testid="devtools-recruit-btn"]'),
      () => {
        const speciesId = this.recruitSelectEl?.value;
        if (!speciesId) return;
        this.ensureActiveSaveForCheat();
        const joined = saveManager.recruitPokemon({ speciesId, level: DEMO_STARTING_LEVEL, scaleStatsToLevel: true });
        this.selectedUnitInstanceId = joined.instanceId;
        audioManager.playSfx('victory_fanfare');
        this.setCheatStatus(`Recruited ${joined.nickname} (Lv.${joined.level})!`);
        this.refresh();
        this.deps.onLiveStateMutated();
      },
      { signal }
    );

    bindPointerTap(
      modalEl.querySelector('[data-testid="devtools-unlock-all-nodes"]'),
      () => {
        this.ensureActiveSaveForCheat();
        saveManager.unlockAllOverworldNodes(DEMO_OVERWORLD_GRAPH);
        audioManager.playSfx('select');
        this.setCheatStatus('Unlocked all 6 Act 1 nodes.');
        this.deps.onLiveStateMutated();
      },
      { signal }
    );

    bindPointerTap(
      modalEl.querySelector('[data-testid="devtools-reset-d1"]'),
      () => {
        this.ensureActiveSaveForCheat();
        saveManager.resetOverworldToPrologue(DEMO_OVERWORLD_GRAPH);
        audioManager.playSfx('select');
        this.setCheatStatus('Reset World Map to Prologue: Hometown Pitch.');
        this.deps.onLiveStateMutated({ snapOverworld: true });
      },
      { signal }
    );

    bindPointerTap(
      modalEl.querySelector('[data-testid="devtools-clear-current-node"]'),
      () => {
        this.ensureActiveSaveForCheat();
        const nodeId = saveManager.getSave()?.overworld.currentNodeId ?? 'prologue';
        saveManager.completeOverworldChapter(nodeId, { graph: DEMO_OVERWORLD_GRAPH });
        audioManager.playSfx('victory_fanfare');
        this.setCheatStatus(`Marked ${nodeId} cleared.`);
        this.deps.onLiveStateMutated();
      },
      { signal }
    );

    bindPointerTap(
      modalEl.querySelector('[data-testid="devtools-spawn-skirmish"]'),
      () => {
        this.ensureActiveSaveForCheat();
        const nodeId = saveManager.getSave()?.overworld.currentNodeId ?? 'prologue';
        saveManager.setOverworldNodeStateCheat(nodeId, { unlocked: true, cleared: true }, DEMO_OVERWORLD_GRAPH);
        saveManager.spawnOverworldSkirmish(nodeId, undefined, undefined, DEMO_OVERWORLD_GRAPH);
        audioManager.playSfx('phase_change');
        this.setCheatStatus(`Spawned Skirmish at ${nodeId}.`);
        this.deps.onLiveStateMutated();
      },
      { signal }
    );

    modalEl.querySelectorAll<HTMLButtonElement>('[data-shop-type]').forEach((btn) => {
      bindPointerTap(
        btn,
        () => {
          const shopType = btn.dataset.shopType as KecleonShopType | undefined;
          if (!shopType) return;
          this.ensureActiveSaveForCheat();
          const nodeId = saveManager.getSave()?.overworld.currentNodeId ?? 'prologue';
          saveManager.setOverworldNodeStateCheat(nodeId, { unlocked: true, cleared: true }, DEMO_OVERWORLD_GRAPH);
          saveManager.spawnOverworldKecleonShop(nodeId, shopType, Math.random, DEMO_OVERWORLD_GRAPH);
          audioManager.playSfx('select');
          this.setCheatStatus(`Spawned Kecleon Shop (${shopType}) at ${nodeId}.`);
          this.deps.onLiveStateMutated();
        },
        { signal }
      );
    });

    bindPointerTap(
      modalEl.querySelector('[data-testid="devtools-seed-save"]'),
      () => {
        seedFreshDemoSaveForCheat(saveManager);
        audioManager.playSfx('select');
        this.setCheatStatus(`Seeded fresh Demo save (Lv. ${DEMO_STARTING_LEVEL}).`);
        this.refresh();
        this.deps.onLiveStateMutated({ snapOverworld: true });
      },
      { signal }
    );

    bindPointerTap(
      modalEl.querySelector('[data-testid="devtools-delete-account-save"]'),
      async () => {
        audioManager.playSfx('cancel');
        const res = await saveManager.deleteSaveFromLinkedAccount();
        this.setCheatStatus(res.deletedCloud ? 'Deleted local & Cloud save.' : 'Cleared local save.');
        this.refresh();
        this.deps.onLiveStateMutated({ snapOverworld: true });
      },
      { signal }
    );

    bindPointerTap(
      this.battleHealBtnEl,
      () => {
        if (!this.deps.isBattleOpen()) return;
        this.deps.onCheatFullHealSquad();
        this.setCheatStatus('Squad healed to full HP & PP.');
      },
      { signal }
    );

    bindPointerTap(
      this.battleWinBtnEl,
      () => {
        if (!this.deps.isBattleOpen()) return;
        this.deps.onCheatInstantWin();
        this.setCheatStatus('Triggered Instant Win.');
        this.deps.onClose();
      },
      { signal }
    );
  }

  public refresh(): void {
    const save = this.deps.saveManager.getSave();
    if (this.goldLabelEl) this.goldLabelEl.textContent = `${(save?.gold ?? 0).toLocaleString()}G`;
    const battleOpen = this.deps.isBattleOpen();
    if (this.battleHealBtnEl) this.battleHealBtnEl.disabled = !battleOpen;
    if (this.battleWinBtnEl) this.battleWinBtnEl.disabled = !battleOpen;
    this.selectedUnitInstanceId = syncDevToolsUnitSelectOptions(this.unitSelectEl, save, this.selectedUnitInstanceId);
    this.renderStageButtons();
  }

  private renderStageButtons(): void {
    renderDevToolsUnitStageButtons({
      container: this.unitStageBtnsEl,
      save: this.deps.saveManager.getSave(),
      selectedUnitInstanceId: this.selectedUnitInstanceId,
      saveManager: this.deps.saveManager,
      audioManager: this.deps.audioManager,
      signal: this.deps.signal,
      onEvolved: (msg) => {
        this.setCheatStatus(msg);
        this.refresh();
        this.deps.onLiveStateMutated();
      },
    });
  }
}
