/**
 * Mystery Emblem — Lean Admin Dev Tools Overlay (`DevToolsHarness`)
 *
 * Strictly restricted to `ADMIN_DEVTOOLS_EMAILS` (`adam.kenawell.family@gmail.com`).
 * Opens as a modal overlay on top of any active screen (`Title`, `OverworldScene`, `BattleScene`)
 * without closing the underlying scene, exposing 2 focused tabs:
 * 1. `Cheats` — Unit Level (`1–40`) & Stage swapper, Gold & Bag item spawner,
 *    World Map node/shop/skirmish/NG+ controls, Playable Pokémon recruiter, and
 *    Mid-Battle `Full Heal Squad` / `Instant Win`.
 * 2. `Map Editor` — 5-Dungeon Demo map preview (`D1`–`D5`), `Open Map Editor`,
 *    `Test Battle`, `Sync Cloud`, and `Reset Default`.
 *
 * Obeys Rule 2 (Unified Pointer Events ONLY — zero keyboard listeners).
 */

import { getAudioManager, type AudioManager } from '../audio/AudioManager';
import { DEMO_INITIAL_CONVOY, DEMO_STARTING_LEVEL } from '../data/campaignRegistry';
import {
  CHAPTER_LEVEL_CATALOG,
  getChapterCatalogEntry,
  getEffectiveChapterMap,
  hasChapterMapOverride,
  resetChapterMapOverride,
  subscribeChapterMapChanges,
} from '../data/chapterMapRegistry';
import {
  ITEMS_LIST,
  POKEMON_SPECIES_LIST,
  getItemById,
  getSpeciesById,
} from '../data/index';
import { DEMO_OVERWORLD_GRAPH } from '../data/overworldMapData';
import { renderDungeonMapPreviewCanvas } from '../scenes/ChapterMapEditorScene';
import type { SaveStateManager } from '../state/SaveStateManager';
import type { KecleonShopType } from '../types/schemas';
import { bindPointerTap } from './pointerControls';

export type DevToolsSubTab = 'cheats' | 'maps';

export interface DevToolsHarnessOptions {
  modalEl: HTMLElement;
  saveManager: SaveStateManager;
  audioManager?: AudioManager;
  isBattleOpen: () => boolean;
  onCheatFullHealSquad: () => void;
  onCheatInstantWin: () => void;
  onLiveStateMutated: (opts?: { snapOverworld?: boolean }) => void;
  onLaunchMapEditor: (levelId: string) => void;
  onPlayMapBattle: (levelId: string) => void;
  onRequestRenameUnit: (instanceId: string) => void;
  onClose: () => void;
  signal?: AbortSignal;
}

export class DevToolsHarness {
  private readonly modalEl: HTMLElement;
  private readonly saveManager: SaveStateManager;
  private readonly audioManager: AudioManager;
  private readonly isBattleOpen: () => boolean;
  private readonly onCheatFullHealSquad: () => void;
  private readonly onCheatInstantWin: () => void;
  private readonly onLiveStateMutated: (opts?: { snapOverworld?: boolean }) => void;
  private readonly onLaunchMapEditor: (levelId: string) => void;
  private readonly onPlayMapBattle: (levelId: string) => void;
  private readonly onRequestRenameUnit: (instanceId: string) => void;
  private readonly onClose: () => void;
  private readonly abortController = new AbortController();

  private activeSubTab: DevToolsSubTab = 'cheats';
  private selectedUnitInstanceId: string | null = null;
  private selectedMapLevelId = 'prologue';
  private mapPreviewGen = 0;
  private unsubscribeMapStore: (() => void) | null = null;

  private unitSelectEl: HTMLSelectElement | null = null;
  private unitStageBtnsEl: HTMLElement | null = null;
  private goldLabelEl: HTMLElement | null = null;
  private itemSelectEl: HTMLSelectElement | null = null;
  private recruitSelectEl: HTMLSelectElement | null = null;
  private ngPlusBtnEl: HTMLButtonElement | null = null;
  private battleHealBtnEl: HTMLButtonElement | null = null;
  private battleWinBtnEl: HTMLButtonElement | null = null;
  private cheatStatusEl: HTMLElement | null = null;

  private mapLevelSelectEl: HTMLSelectElement | null = null;
  private mapStatusBadgeEl: HTMLElement | null = null;
  private mapPreviewCanvasEl: HTMLCanvasElement | null = null;
  private mapMetaEl: HTMLElement | null = null;

  constructor(options: DevToolsHarnessOptions) {
    this.modalEl = options.modalEl;
    this.saveManager = options.saveManager;
    this.audioManager = options.audioManager ?? getAudioManager();
    this.isBattleOpen = options.isBattleOpen;
    this.onCheatFullHealSquad = options.onCheatFullHealSquad;
    this.onCheatInstantWin = options.onCheatInstantWin;
    this.onLiveStateMutated = options.onLiveStateMutated;
    this.onLaunchMapEditor = options.onLaunchMapEditor;
    this.onPlayMapBattle = options.onPlayMapBattle;
    this.onRequestRenameUnit = options.onRequestRenameUnit;
    this.onClose = options.onClose;

    if (options.signal) {
      options.signal.addEventListener('abort', () => this.destroy(), { once: true });
    }

    this.buildModalDom();
    this.populateStaticSelects();
    this.bindControls();

    this.unsubscribeMapStore = subscribeChapterMapChanges(() => {
      this.refreshMapPreviewTab();
    });

    this.refreshCheatsTab();
    this.refreshMapPreviewTab();
  }

  public getActiveSubTab(): DevToolsSubTab {
    return this.activeSubTab;
  }

  public switchSubTab(tab: DevToolsSubTab): void {
    this.activeSubTab = tab;
    const tabBtns = this.modalEl.querySelectorAll<HTMLButtonElement>('[data-devtab-btn]');
    const panels = this.modalEl.querySelectorAll<HTMLElement>('[data-devtab-panel]');

    tabBtns.forEach((btn) => {
      btn.classList.toggle('is-active', btn.dataset.devtabBtn === tab);
    });
    panels.forEach((panel) => {
      panel.hidden = panel.dataset.devtabPanel !== tab;
    });

    if (tab === 'cheats') {
      this.refreshCheatsTab();
    } else if (tab === 'maps') {
      this.refreshMapPreviewTab();
    }
  }

  public onSaveChanged(): void {
    this.refreshCheatsTab();
    if (this.activeSubTab === 'maps') {
      this.refreshMapPreviewTab();
    }
  }

  public destroy(): void {
    this.unsubscribeMapStore?.();
    this.unsubscribeMapStore = null;
    this.abortController.abort();
  }

  private buildModalDom(): void {
    this.modalEl.innerHTML = `
      <header class="pmd-devtools-row-between">
        <div>
          <h2 class="pmd-panel-title">DEV TOOLS</h2>
          <p class="pmd-panel-sub">Admin Cheats &amp; 5-Dungeon Map Editor</p>
        </div>
        <button type="button" class="pmd-btn pmd-chip-btn" data-testid="devtools-close-btn">Close</button>
      </header>

      <nav class="pmd-tabs" aria-label="Dev Tools Tabs">
        <button
          type="button"
          class="pmd-btn pmd-tab-btn is-active"
          data-devtab-btn="cheats"
          data-testid="devtools-tab-cheats"
        >
          Cheats
        </button>
        <button
          type="button"
          class="pmd-btn pmd-tab-btn"
          data-devtab-btn="maps"
          data-testid="devtools-tab-maps"
        >
          Map Editor
        </button>
      </nav>

      <!-- TAB 1: CHEATS -->
      <div class="pmd-tab-panel" data-devtab-panel="cheats">
        <p class="pmd-subcard-text" data-testid="devtools-cheat-status" style="color:#58f858;" hidden></p>

        <!-- 1. Unit Level & Evolution Stage -->
        <div class="pmd-subcard">
          <div class="pmd-devtools-row-between">
            <h3 class="pmd-subcard-title">Unit Level &amp; Stage</h3>
            <button type="button" class="pmd-btn pmd-chip-btn" data-testid="devtools-rename-unit">Rename</button>
          </div>
          <select class="pmd-select" data-testid="devtools-unit-select" aria-label="Select Active Unit"></select>
          <div class="pmd-inline-btns">
            <button type="button" class="pmd-btn pmd-chip-btn" data-unit-lv-delta="-1" data-testid="devtools-lv-dec">Lv -1</button>
            <button type="button" class="pmd-btn pmd-chip-btn" data-unit-lv-delta="1" data-testid="devtools-lv-inc">Lv +1</button>
            <button type="button" class="pmd-btn pmd-chip-btn" data-unit-lv-delta="5" data-testid="devtools-lv-plus5">Lv +5</button>
            <button type="button" class="pmd-btn pmd-chip-btn" data-unit-lv-set="10" data-testid="devtools-lv-10">Lv 10</button>
            <button type="button" class="pmd-btn pmd-chip-btn" data-unit-lv-set="20" data-testid="devtools-lv-20">Lv 20</button>
            <button type="button" class="pmd-btn pmd-chip-btn" data-unit-lv-set="40" data-testid="devtools-lv-40">Lv 40</button>
          </div>
          <div class="pmd-inline-btns" data-testid="devtools-unit-stage-buttons"></div>
        </div>

        <!-- 2. Gold & Bag Item Spawner -->
        <div class="pmd-subcard">
          <div class="pmd-devtools-row-between">
            <h3 class="pmd-subcard-title">Gold &amp; Bag Spawner</h3>
            <span class="pmd-subcard-text" data-testid="devtools-gold-label">0G</span>
          </div>
          <div class="pmd-inline-btns">
            <button type="button" class="pmd-btn pmd-btn-primary pmd-chip-btn" data-testid="devtools-add-gold">+1,000G</button>
          </div>
          <div class="pmd-devtools-row-between" style="flex-wrap:nowrap;">
            <select class="pmd-select" data-testid="devtools-item-select" aria-label="Select Item to Spawn" style="flex:1;"></select>
            <button type="button" class="pmd-btn pmd-btn-primary pmd-chip-btn" data-testid="devtools-spawn-item">+1 Bag</button>
          </div>
        </div>

        <!-- 3. Recruit Any Playable Pokemon -->
        <div class="pmd-subcard">
          <h3 class="pmd-subcard-title">Recruit Playable Pokémon</h3>
          <div class="pmd-devtools-row-between" style="flex-wrap:nowrap;">
            <select class="pmd-select" data-testid="devtools-recruit-select" aria-label="Select Playable Pokemon" style="flex:1;"></select>
            <button type="button" class="pmd-btn pmd-btn-primary pmd-chip-btn" data-testid="devtools-recruit-btn">Recruit</button>
          </div>
        </div>

        <!-- 4. World Map & Save Controls -->
        <div class="pmd-subcard">
          <h3 class="pmd-subcard-title">World Map &amp; Campaign</h3>
          <div class="pmd-inline-btns">
            <button type="button" class="pmd-btn pmd-chip-btn" data-testid="devtools-unlock-all-nodes">Unlock All 5</button>
            <button type="button" class="pmd-btn pmd-chip-btn" data-testid="devtools-reset-d1">Reset to D1</button>
            <button type="button" class="pmd-btn pmd-chip-btn" data-testid="devtools-clear-current-node">Clear Node</button>
            <button type="button" class="pmd-btn pmd-chip-btn" data-testid="devtools-spawn-skirmish">Spawn Skirmish</button>
            <button type="button" class="pmd-btn pmd-chip-btn" data-testid="devtools-toggle-ngplus">NG+: OFF</button>
          </div>
          <div class="pmd-inline-btns">
            <button type="button" class="pmd-btn pmd-chip-btn" data-shop-type="healing_shop" data-testid="devtools-shop-healing_shop">Shop: Heal/Stone</button>
            <button type="button" class="pmd-btn pmd-chip-btn" data-shop-type="tm_shop" data-testid="devtools-shop-tm_shop">Shop: TMs</button>
            <button type="button" class="pmd-btn pmd-chip-btn" data-shop-type="held_shop" data-testid="devtools-shop-held_shop">Shop: Held</button>
            <button type="button" class="pmd-btn pmd-chip-btn" data-shop-type="x_item_shop" data-testid="devtools-shop-x_item_shop">Shop: X-Items</button>
          </div>
          <div class="pmd-inline-btns">
            <button type="button" class="pmd-btn pmd-chip-btn" data-testid="devtools-seed-save">Seed Demo Save</button>
            <button type="button" class="pmd-btn pmd-btn-danger pmd-chip-btn" data-testid="devtools-delete-account-save">Delete Account Save</button>
          </div>
        </div>

        <!-- 5. Mid-Battle Cheats -->
        <div class="pmd-subcard">
          <h3 class="pmd-subcard-title">Mid-Battle</h3>
          <div class="pmd-inline-btns">
            <button type="button" class="pmd-btn pmd-btn-primary pmd-chip-btn" data-testid="devtools-battle-heal">Full Heal Squad</button>
            <button type="button" class="pmd-btn pmd-btn-primary pmd-chip-btn" data-testid="devtools-battle-win">Instant Win</button>
          </div>
        </div>
      </div>

      <!-- TAB 2: MAP EDITOR -->
      <div class="pmd-tab-panel" data-devtab-panel="maps" hidden>
        <div class="pmd-subcard">
          <div class="pmd-devtools-row-between">
            <h3 class="pmd-subcard-title">Demo Dungeon Maps (D1–D5)</h3>
            <span id="devtools-map-status-badge" class="pmd-editor-status-pill" data-testid="devtools-map-status-badge">DEFAULT</span>
          </div>
          <select
            id="devtools-map-level-select"
            class="pmd-select"
            data-testid="devtools-map-level-select"
            aria-label="Select Demo Dungeon Map"
          ></select>
          <div class="pmd-devtools-map-preview-wrap">
            <canvas
              id="devtools-map-preview-canvas"
              class="pmd-devtools-map-preview-canvas"
              data-testid="devtools-map-preview-canvas"
            ></canvas>
          </div>
          <p id="devtools-map-meta" class="pmd-subcard-text" data-testid="devtools-map-meta">—</p>
          <div class="pmd-inline-btns">
            <button
              type="button"
              id="devtools-open-map-editor"
              class="pmd-btn pmd-btn-primary"
              data-testid="devtools-open-map-editor"
            >
              Open Map Editor
            </button>
            <button
              type="button"
              id="devtools-play-selected-map"
              class="pmd-btn"
              data-testid="devtools-play-selected-map"
            >
              Test Battle
            </button>
            <button
              type="button"
              id="devtools-sync-cloud-maps"
              class="pmd-btn"
              data-testid="devtools-sync-cloud-maps"
            >
              Sync Cloud
            </button>
            <button
              type="button"
              id="devtools-reset-selected-map"
              class="pmd-btn pmd-btn-danger"
              data-testid="devtools-reset-selected-map"
            >
              Reset Default
            </button>
          </div>
        </div>
      </div>
    `;

    this.unitSelectEl = this.modalEl.querySelector<HTMLSelectElement>('[data-testid="devtools-unit-select"]');
    this.unitStageBtnsEl = this.modalEl.querySelector<HTMLElement>('[data-testid="devtools-unit-stage-buttons"]');
    this.goldLabelEl = this.modalEl.querySelector<HTMLElement>('[data-testid="devtools-gold-label"]');
    this.itemSelectEl = this.modalEl.querySelector<HTMLSelectElement>('[data-testid="devtools-item-select"]');
    this.recruitSelectEl = this.modalEl.querySelector<HTMLSelectElement>('[data-testid="devtools-recruit-select"]');
    this.ngPlusBtnEl = this.modalEl.querySelector<HTMLButtonElement>('[data-testid="devtools-toggle-ngplus"]');
    this.battleHealBtnEl = this.modalEl.querySelector<HTMLButtonElement>('[data-testid="devtools-battle-heal"]');
    this.battleWinBtnEl = this.modalEl.querySelector<HTMLButtonElement>('[data-testid="devtools-battle-win"]');
    this.cheatStatusEl = this.modalEl.querySelector<HTMLElement>('[data-testid="devtools-cheat-status"]');

    this.mapLevelSelectEl = this.modalEl.querySelector<HTMLSelectElement>('#devtools-map-level-select');
    this.mapStatusBadgeEl = this.modalEl.querySelector<HTMLElement>('#devtools-map-status-badge');
    this.mapPreviewCanvasEl = this.modalEl.querySelector<HTMLCanvasElement>('#devtools-map-preview-canvas');
    this.mapMetaEl = this.modalEl.querySelector<HTMLElement>('#devtools-map-meta');
  }

  private populateStaticSelects(): void {
    if (this.itemSelectEl) {
      this.itemSelectEl.innerHTML = '';
      for (const item of ITEMS_LIST) {
        const opt = document.createElement('option');
        opt.value = item.id;
        opt.textContent = `${item.name} (${item.category})`;
        this.itemSelectEl.appendChild(opt);
      }
    }

    if (this.recruitSelectEl) {
      this.recruitSelectEl.innerHTML = '';
      const recruitable = POKEMON_SPECIES_LIST.filter(
        (sp) => sp.faction !== 'enemy' && sp.stage === 1
      );
      for (const sp of recruitable) {
        const opt = document.createElement('option');
        opt.value = sp.id;
        opt.textContent = `${sp.name} (${sp.types.join('/')})`;
        this.recruitSelectEl.appendChild(opt);
      }
    }
  }

  private setCheatStatus(msg: string): void {
    if (!this.cheatStatusEl) return;
    const trimmed = msg.trim();
    this.cheatStatusEl.textContent = trimmed;
    this.cheatStatusEl.hidden = trimmed.length === 0;
  }

  private ensureActiveSaveForCheat(): void {
    if (this.saveManager.getSave() !== null) return;
    this.saveManager.createNewCampaignSave({
      campaignMode: 'demo',
      lordSpeciesId: 'dratini',
      lordNickname: 'Bahamut',
      partnerSpeciesId: 'bulbasaur',
      partnerNickname: 'Sprout',
      healerSpeciesId: 'happiny',
      healerNickname: 'Clover',
      startingLevel: DEMO_STARTING_LEVEL,
      scaleStatsToLevel: true,
      initialConvoy: DEMO_INITIAL_CONVOY,
      overworldGraph: DEMO_OVERWORLD_GRAPH,
    });
  }

  private bindControls(): void {
    const signal = this.abortController.signal;

    // Close button
    bindPointerTap(
      this.modalEl.querySelector<HTMLElement>('[data-testid="devtools-close-btn"]'),
      () => {
        this.audioManager.playSfx('cancel');
        this.onClose();
      },
      { signal }
    );

    // Sub-tab buttons
    this.modalEl.querySelectorAll<HTMLButtonElement>('[data-devtab-btn]').forEach((btn) => {
      bindPointerTap(
        btn,
        () => {
          const tab = btn.dataset.devtabBtn as DevToolsSubTab | undefined;
          if (!tab) return;
          this.audioManager.playSfx('select');
          this.switchSubTab(tab);
        },
        { signal }
      );
    });

    // Unit select change
    this.unitSelectEl?.addEventListener(
      'change',
      () => {
        this.selectedUnitInstanceId = this.unitSelectEl?.value ?? null;
        this.renderUnitStageButtons();
      },
      { signal }
    );

    // Rename unit
    bindPointerTap(
      this.modalEl.querySelector<HTMLElement>('[data-testid="devtools-rename-unit"]'),
      () => {
        if (!this.selectedUnitInstanceId) return;
        this.audioManager.playSfx('select');
        this.onRequestRenameUnit(this.selectedUnitInstanceId);
      },
      { signal }
    );

    // Unit Level Delta buttons (`-1`, `+1`, `+5`)
    this.modalEl.querySelectorAll<HTMLButtonElement>('[data-unit-lv-delta]').forEach((btn) => {
      bindPointerTap(
        btn,
        () => {
          const save = this.saveManager.getSave();
          const unit = save?.roster.find((u) => u.instanceId === this.selectedUnitInstanceId);
          if (!unit) return;
          const delta = Number(btn.dataset.unitLvDelta ?? 0);
          const nextLv = Math.max(1, Math.min(40, unit.level + delta));
          this.saveManager.setUnitLevelForTest(unit.instanceId, nextLv, true);
          this.audioManager.playSfx('select');
          this.setCheatStatus(`${unit.nickname} → Lv.${nextLv}`);
          this.refreshCheatsTab();
          this.onLiveStateMutated();
        },
        { signal }
      );
    });

    // Unit Level Set buttons (`10`, `20`, `40`)
    this.modalEl.querySelectorAll<HTMLButtonElement>('[data-unit-lv-set]').forEach((btn) => {
      bindPointerTap(
        btn,
        () => {
          const save = this.saveManager.getSave();
          const unit = save?.roster.find((u) => u.instanceId === this.selectedUnitInstanceId);
          if (!unit) return;
          const nextLv = Math.max(1, Math.min(40, Number(btn.dataset.unitLvSet ?? 10)));
          this.saveManager.setUnitLevelForTest(unit.instanceId, nextLv, true);
          this.audioManager.playSfx('select');
          this.setCheatStatus(`${unit.nickname} → Lv.${nextLv}`);
          this.refreshCheatsTab();
          this.onLiveStateMutated();
        },
        { signal }
      );
    });

    // Gold +1,000G
    bindPointerTap(
      this.modalEl.querySelector<HTMLElement>('[data-testid="devtools-add-gold"]'),
      () => {
        this.ensureActiveSaveForCheat();
        const total = this.saveManager.addGold(1000);
        this.audioManager.playSfx('heal');
        this.setCheatStatus(`Gold: ${total.toLocaleString()}G`);
        this.refreshCheatsTab();
        this.onLiveStateMutated();
      },
      { signal }
    );

    // Spawn Item +1 to Bag
    bindPointerTap(
      this.modalEl.querySelector<HTMLElement>('[data-testid="devtools-spawn-item"]'),
      () => {
        const itemId = this.itemSelectEl?.value;
        if (!itemId) return;
        this.ensureActiveSaveForCheat();
        this.saveManager.addConvoyItem(itemId, 1);
        const item = getItemById(itemId);
        this.audioManager.playSfx('select');
        this.setCheatStatus(`Added ${item?.name ?? itemId} to Bag.`);
        this.refreshCheatsTab();
        this.onLiveStateMutated();
      },
      { signal }
    );

    // Recruit Playable Pokemon
    bindPointerTap(
      this.modalEl.querySelector<HTMLElement>('[data-testid="devtools-recruit-btn"]'),
      () => {
        const speciesId = this.recruitSelectEl?.value;
        if (!speciesId) return;
        this.ensureActiveSaveForCheat();
        const joined = this.saveManager.recruitPokemon({
          speciesId,
          level: DEMO_STARTING_LEVEL,
          scaleStatsToLevel: true,
        });
        this.selectedUnitInstanceId = joined.instanceId;
        this.audioManager.playSfx('victory_fanfare');
        this.setCheatStatus(`Recruited ${joined.nickname} (Lv.${joined.level})!`);
        this.refreshCheatsTab();
        this.onLiveStateMutated();
      },
      { signal }
    );

    // World Map Controls
    bindPointerTap(
      this.modalEl.querySelector<HTMLElement>('[data-testid="devtools-unlock-all-nodes"]'),
      () => {
        this.ensureActiveSaveForCheat();
        this.saveManager.unlockAllOverworldNodes(DEMO_OVERWORLD_GRAPH);
        this.audioManager.playSfx('select');
        this.setCheatStatus('Unlocked all 5 Demo nodes.');
        this.onLiveStateMutated();
      },
      { signal }
    );

    bindPointerTap(
      this.modalEl.querySelector<HTMLElement>('[data-testid="devtools-reset-d1"]'),
      () => {
        this.ensureActiveSaveForCheat();
        this.saveManager.resetOverworldToPrologue(DEMO_OVERWORLD_GRAPH);
        this.audioManager.playSfx('select');
        this.setCheatStatus('Reset World Map to D1: Beach Cave.');
        this.onLiveStateMutated({ snapOverworld: true });
      },
      { signal }
    );

    bindPointerTap(
      this.modalEl.querySelector<HTMLElement>('[data-testid="devtools-clear-current-node"]'),
      () => {
        this.ensureActiveSaveForCheat();
        const nodeId = this.saveManager.getSave()?.overworld.currentNodeId ?? 'prologue';
        this.saveManager.completeOverworldChapter(nodeId, { graph: DEMO_OVERWORLD_GRAPH });
        this.audioManager.playSfx('victory_fanfare');
        this.setCheatStatus(`Marked ${nodeId} cleared.`);
        this.onLiveStateMutated();
      },
      { signal }
    );

    bindPointerTap(
      this.modalEl.querySelector<HTMLElement>('[data-testid="devtools-spawn-skirmish"]'),
      () => {
        this.ensureActiveSaveForCheat();
        const nodeId = this.saveManager.getSave()?.overworld.currentNodeId ?? 'prologue';
        this.saveManager.setOverworldNodeStateCheat(
          nodeId,
          { unlocked: true, cleared: true },
          DEMO_OVERWORLD_GRAPH
        );
        this.saveManager.spawnOverworldSkirmish(
          nodeId,
          undefined,
          undefined,
          DEMO_OVERWORLD_GRAPH
        );
        this.audioManager.playSfx('phase_change');
        this.setCheatStatus(`Spawned Skirmish at ${nodeId}.`);
        this.onLiveStateMutated();
      },
      { signal }
    );

    this.modalEl.querySelectorAll<HTMLButtonElement>('[data-shop-type]').forEach((btn) => {
      bindPointerTap(
        btn,
        () => {
          const shopType = btn.dataset.shopType as KecleonShopType | undefined;
          if (!shopType) return;
          this.ensureActiveSaveForCheat();
          const nodeId = this.saveManager.getSave()?.overworld.currentNodeId ?? 'prologue';
          this.saveManager.setOverworldNodeStateCheat(
            nodeId,
            { unlocked: true, cleared: true },
            DEMO_OVERWORLD_GRAPH
          );
          this.saveManager.spawnOverworldKecleonShop(
            nodeId,
            shopType,
            Math.random,
            DEMO_OVERWORLD_GRAPH
          );
          this.audioManager.playSfx('select');
          this.setCheatStatus(`Spawned Kecleon Shop (${shopType}) at ${nodeId}.`);
          this.onLiveStateMutated();
        },
        { signal }
      );
    });

    bindPointerTap(
      this.ngPlusBtnEl,
      () => {
        const next = !this.saveManager.isNewGamePlusUnlocked();
        this.saveManager.setNewGamePlusUnlocked(next);
        this.audioManager.playSfx('select');
        this.setCheatStatus(`New Game+ ${next ? 'Unlocked' : 'Locked'}.`);
        this.refreshCheatsTab();
        this.onLiveStateMutated();
      },
      { signal }
    );

    bindPointerTap(
      this.modalEl.querySelector<HTMLElement>('[data-testid="devtools-seed-save"]'),
      () => {
        this.saveManager.createNewCampaignSave({
          campaignMode: 'demo',
          lordSpeciesId: 'dratini',
          lordNickname: 'Bahamut',
          partnerSpeciesId: 'bulbasaur',
          partnerNickname: 'Sprout',
          healerSpeciesId: 'happiny',
          healerNickname: 'Clover',
          startingLevel: DEMO_STARTING_LEVEL,
          scaleStatsToLevel: true,
          initialConvoy: DEMO_INITIAL_CONVOY,
          overworldGraph: DEMO_OVERWORLD_GRAPH,
        });
        this.audioManager.playSfx('select');
        this.setCheatStatus('Seeded fresh Demo save (Lv. 9).');
        this.refreshCheatsTab();
        this.onLiveStateMutated({ snapOverworld: true });
      },
      { signal }
    );

    bindPointerTap(
      this.modalEl.querySelector<HTMLElement>('[data-testid="devtools-delete-account-save"]'),
      async () => {
        this.audioManager.playSfx('cancel');
        const res = await this.saveManager.deleteSaveFromLinkedAccount();
        this.setCheatStatus(
          res.deletedCloud
            ? 'Deleted local & Cloud save.'
            : 'Cleared local save.'
        );
        this.refreshCheatsTab();
        this.onLiveStateMutated({ snapOverworld: true });
      },
      { signal }
    );

    // Mid-Battle Cheats
    bindPointerTap(
      this.battleHealBtnEl,
      () => {
        if (!this.isBattleOpen()) return;
        this.onCheatFullHealSquad();
        this.setCheatStatus('Squad healed to full HP & PP.');
      },
      { signal }
    );

    bindPointerTap(
      this.battleWinBtnEl,
      () => {
        if (!this.isBattleOpen()) return;
        this.onCheatInstantWin();
        this.setCheatStatus('Triggered Instant Win.');
        this.onClose();
      },
      { signal }
    );

    // Map Editor Tab Controls
    this.mapLevelSelectEl?.addEventListener(
      'change',
      () => {
        this.audioManager.playSfx('select');
        this.selectedMapLevelId = this.mapLevelSelectEl?.value || 'prologue';
        this.refreshMapPreviewTab();
      },
      { signal }
    );

    bindPointerTap(
      this.modalEl.querySelector<HTMLElement>('#devtools-open-map-editor'),
      () => {
        this.audioManager.playSfx('select');
        this.onLaunchMapEditor(this.selectedMapLevelId);
      },
      { signal }
    );

    bindPointerTap(
      this.modalEl.querySelector<HTMLElement>('#devtools-play-selected-map'),
      () => {
        this.audioManager.playSfx('select');
        this.onPlayMapBattle(this.selectedMapLevelId);
      },
      { signal }
    );

    bindPointerTap(
      this.modalEl.querySelector<HTMLElement>('#devtools-sync-cloud-maps'),
      async () => {
        this.audioManager.playSfx('select');
        const res = await this.saveManager.syncCustomMapsWithActiveSave();
        if (this.mapMetaEl) {
          this.mapMetaEl.textContent =
            res === 'pushed_newer_local'
              ? 'Synced custom maps to Cloud.'
              : res === 'pulled_newer_cloud'
                ? 'Pulled newer custom maps from Cloud.'
                : res === 'in_sync'
                  ? 'Cloud maps already in sync.'
                  : 'Sign in with Google to sync maps to Cloud.';
        }
        this.refreshMapPreviewTab();
      },
      { signal }
    );

    bindPointerTap(
      this.modalEl.querySelector<HTMLElement>('#devtools-reset-selected-map'),
      () => {
        this.audioManager.playSfx('cancel');
        resetChapterMapOverride(this.selectedMapLevelId);
        void this.saveManager.syncCustomMapsWithActiveSave();
        this.refreshMapPreviewTab();
      },
      { signal }
    );
  }

  public refreshCheatsTab(): void {
    const save = this.saveManager.getSave();
    if (this.goldLabelEl) {
      this.goldLabelEl.textContent = `${(save?.gold ?? 0).toLocaleString()}G`;
    }
    if (this.ngPlusBtnEl) {
      const ng = this.saveManager.isNewGamePlusUnlocked();
      this.ngPlusBtnEl.textContent = ng ? 'NG+: ON' : 'NG+: OFF';
      this.ngPlusBtnEl.classList.toggle('is-active', ng);
    }
    const battleOpen = this.isBattleOpen();
    if (this.battleHealBtnEl) this.battleHealBtnEl.disabled = !battleOpen;
    if (this.battleWinBtnEl) this.battleWinBtnEl.disabled = !battleOpen;

    if (this.unitSelectEl) {
      this.unitSelectEl.innerHTML = '';
      if (!save || save.roster.length === 0) {
        const opt = document.createElement('option');
        opt.value = '';
        opt.textContent = 'No active save (tap Seed Demo Save)';
        this.unitSelectEl.appendChild(opt);
        this.unitSelectEl.disabled = true;
        this.selectedUnitInstanceId = null;
      } else {
        this.unitSelectEl.disabled = false;
        if (
          !this.selectedUnitInstanceId ||
          !save.roster.some((u) => u.instanceId === this.selectedUnitInstanceId)
        ) {
          this.selectedUnitInstanceId = save.roster[0]!.instanceId;
        }
        for (const u of save.roster) {
          const sp = getSpeciesById(u.speciesId);
          const opt = document.createElement('option');
          opt.value = u.instanceId;
          opt.textContent = `${u.nickname} (${sp?.name ?? u.speciesId} · Lv.${u.level})`;
          this.unitSelectEl.appendChild(opt);
        }
        this.unitSelectEl.value = this.selectedUnitInstanceId;
      }
    }

    this.renderUnitStageButtons();
  }

  private renderUnitStageButtons(): void {
    const container = this.unitStageBtnsEl;
    if (!container) return;
    container.innerHTML = '';

    const save = this.saveManager.getSave();
    const unit = save?.roster.find((u) => u.instanceId === this.selectedUnitInstanceId);
    if (!unit) return;
    const curSp = getSpeciesById(unit.speciesId);
    if (!curSp) return;

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
          this.audioManager.playSfx('select');
          this.saveManager.evolveUnitToSpecies(unit.instanceId, form.id);
          this.setCheatStatus(`${unit.nickname} → ${form.name}`);
          this.refreshCheatsTab();
          this.onLiveStateMutated();
        },
        { signal: this.abortController.signal }
      );
      container.appendChild(btn);
    }
  }

  public refreshMapPreviewTab(): void {
    const selectEl = this.mapLevelSelectEl;
    const badgeEl = this.mapStatusBadgeEl;
    const canvasEl = this.mapPreviewCanvasEl;
    const metaEl = this.mapMetaEl;
    if (!selectEl || !badgeEl || !canvasEl || !metaEl) return;

    selectEl.innerHTML = '';
    for (const entry of CHAPTER_LEVEL_CATALOG) {
      const opt = document.createElement('option');
      opt.value = entry.id;
      const customMark = hasChapterMapOverride(entry.id) ? ' ★ [Custom]' : '';
      opt.textContent = `${entry.label}${customMark}`;
      selectEl.appendChild(opt);
    }
    if (!CHAPTER_LEVEL_CATALOG.some((e) => e.id === this.selectedMapLevelId)) {
      this.selectedMapLevelId = CHAPTER_LEVEL_CATALOG[0]!.id;
    }
    selectEl.value = this.selectedMapLevelId;

    const entry = getChapterCatalogEntry(this.selectedMapLevelId) ?? CHAPTER_LEVEL_CATALOG[0]!;
    const map = getEffectiveChapterMap(entry.id);
    const isCustom = hasChapterMapOverride(entry.id);

    badgeEl.textContent = isCustom ? 'CUSTOMIZED ★' : 'DEFAULT';
    badgeEl.className = `pmd-editor-status-pill${isCustom ? ' is-custom' : ''}`;

    const cap = Math.max(1, Math.min(map.deploymentCap ?? map.playerSpawns.length, map.playerSpawns.length));
    metaEl.textContent = `${map.name} · ${map.width}×${map.height} · Cap ${cap}/${map.playerSpawns.length} · ${map.enemySpawns.length} Enemies`;

    const gen = ++this.mapPreviewGen;
    void renderDungeonMapPreviewCanvas(canvasEl, map).then(() => {
      if (gen !== this.mapPreviewGen) return;
    });
  }
}
