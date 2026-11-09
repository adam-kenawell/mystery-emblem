/**
 * Mystery Emblem — Admin Dev Tools Modal HTML Template
 */

export function buildDevToolsModalHtml(): string {
  return `
    <header class="pmd-devtools-row-between">
      <div>
        <h2 class="pmd-panel-title">DEV TOOLS</h2>
        <p class="pmd-panel-sub">Admin Cheats &amp; Campaign Map Editor</p>
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

    <div class="pmd-tab-panel" data-devtab-panel="cheats">
      <p class="pmd-subcard-text" data-testid="devtools-cheat-status" style="color:#58f858;" hidden></p>

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

      <div class="pmd-subcard">
        <h3 class="pmd-subcard-title">Recruit Playable Pokémon</h3>
        <div class="pmd-devtools-row-between" style="flex-wrap:nowrap;">
          <select class="pmd-select" data-testid="devtools-recruit-select" aria-label="Select Playable Pokemon" style="flex:1;"></select>
          <button type="button" class="pmd-btn pmd-btn-primary pmd-chip-btn" data-testid="devtools-recruit-btn">Recruit</button>
        </div>
      </div>

      <div class="pmd-subcard">
        <h3 class="pmd-subcard-title">World Map &amp; Campaign</h3>
        <div class="pmd-inline-btns">
          <button type="button" class="pmd-btn pmd-chip-btn" data-testid="devtools-unlock-all-nodes">Unlock All 9</button>
          <button type="button" class="pmd-btn pmd-chip-btn" data-testid="devtools-reset-d1">Reset to Ch. 1</button>
          <button type="button" class="pmd-btn pmd-chip-btn" data-testid="devtools-clear-current-node">Clear Node</button>
          <button type="button" class="pmd-btn pmd-chip-btn" data-testid="devtools-spawn-skirmish">Spawn Skirmish</button>
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

      <div class="pmd-subcard">
        <h3 class="pmd-subcard-title">Mid-Battle</h3>
        <div class="pmd-inline-btns">
          <button type="button" class="pmd-btn pmd-btn-primary pmd-chip-btn" data-testid="devtools-battle-heal">Full Heal Squad</button>
          <button type="button" class="pmd-btn pmd-btn-primary pmd-chip-btn" data-testid="devtools-battle-win">Instant Win</button>
        </div>
      </div>
    </div>

    <div class="pmd-tab-panel" data-devtab-panel="maps" hidden>
      <div class="pmd-subcard">
        <div class="pmd-devtools-row-between">
          <h3 class="pmd-subcard-title">Demo Chapter Maps (Part 1A)</h3>
          <span id="devtools-map-status-badge" class="pmd-editor-status-pill" data-testid="devtools-map-status-badge">DEFAULT</span>
        </div>
        <select
          id="devtools-map-level-select"
          class="pmd-select"
          data-testid="devtools-map-level-select"
          aria-label="Select Demo Chapter Map"
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
          <button type="button" id="devtools-open-map-editor" class="pmd-btn pmd-btn-primary" data-testid="devtools-open-map-editor">
            Open Map Editor
          </button>
          <button type="button" id="devtools-play-selected-map" class="pmd-btn" data-testid="devtools-play-selected-map">
            Test Battle
          </button>
          <button type="button" id="devtools-sync-cloud-maps" class="pmd-btn" data-testid="devtools-sync-cloud-maps">
            Sync Cloud
          </button>
          <button type="button" id="devtools-reset-selected-map" class="pmd-btn pmd-btn-danger" data-testid="devtools-reset-selected-map">
            Reset Default
          </button>
        </div>
      </div>
    </div>
  `;
}
