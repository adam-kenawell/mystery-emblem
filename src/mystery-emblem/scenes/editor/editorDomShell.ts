/**
 * DOM Shell & Element Reference Builder for `ChapterMapEditorScene`
 */

export interface EditorDomRefs {
  rootEl: HTMLElement;
  canvasStageEl: HTMLElement;
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  topHudBarEl: HTMLElement;
  hudPaletteBtnEl: HTMLButtonElement;
  hudToolBtnEl: HTMLButtonElement;
  hudUndoBtnEl: HTMLButtonElement;
  hudSaveBtnEl: HTMLButtonElement;
  hudPlayBtnEl: HTMLButtonElement;
  toastBannerEl: HTMLElement;
  infoStripEl: HTMLElement;
  drawerEl: HTMLElement;
  levelSelectEl: HTMLSelectElement;
  statusBadgeEl: HTMLElement;
  savePlayBtnEl: HTMLButtonElement;
  enemyConfigBoxEl: HTMLElement;
  enemySpeciesSelectEl: HTMLSelectElement;
  enemyLevelValEl: HTMLElement;
  waveTurnRowEl: HTMLElement;
  waveTurnValEl: HTMLElement;
  gridToggleBtnEl: HTMLButtonElement;
  spawnsToggleBtnEl: HTMLButtonElement;
  activeBrushSummaryEl: HTMLElement;
  tilesetSelectEl: HTMLSelectElement;
  chunkPaletteEl: HTMLElement;
  mapWidthValEl: HTMLElement;
  mapHeightValEl: HTMLElement;
  deployCapItemEl: HTMLElement;
  deployCapValEl: HTMLElement;
  systemMenuBackdropEl: HTMLElement;
  sysPlayBtnEl: HTMLButtonElement;
  jsonModalBackdropEl: HTMLElement;
  jsonTextareaEl: HTMLTextAreaElement;
  jsonStatusEl: HTMLElement;
}

export function createEditorDomShell(viewportEl: HTMLElement): EditorDomRefs {
  const rootEl = document.createElement('section');
  rootEl.id = 'pmd-map-editor-scene';
  rootEl.className = 'pmd-battle-scene pmd-map-editor-scene';
  rootEl.dataset.testid = 'chapter-map-editor-scene';
  rootEl.hidden = true;

  const canvasStageEl = document.createElement('div');
  canvasStageEl.className = 'pmd-battle-canvas-stage';
  canvasStageEl.dataset.testid = 'map-editor-canvas-stage';

  const canvas = document.createElement('canvas');
  canvas.className = 'pmd-battle-canvas pmd-pixelated';
  canvas.dataset.testid = 'map-editor-canvas';
  canvas.style.imageRendering = 'pixelated';
  canvas.style.flexShrink = '0';
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not initialize 2D context for ChapterMapEditorScene.');
  ctx.imageSmoothingEnabled = false;
  canvasStageEl.appendChild(canvas);

  const topHudBarEl = document.createElement('div');
  topHudBarEl.className = 'pmd-battle-hud-top';
  topHudBarEl.dataset.testid = 'map-editor-top-hud';

  const makeHudBtn = (cls: string, testid: string, label: string, disabled = false) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = cls;
    btn.dataset.testid = testid;
    btn.textContent = label;
    btn.disabled = disabled;
    return btn;
  };

  const hudPaletteBtnEl = makeHudBtn('pmd-btn pmd-battle-hud-btn is-active', 'editor-hud-palette-btn', 'Palette');
  const hudToolBtnEl = makeHudBtn('pmd-btn pmd-battle-hud-btn', 'editor-hud-tool-btn', 'Tool: Paint');
  const hudUndoBtnEl = makeHudBtn('pmd-btn pmd-battle-hud-btn', 'editor-hud-undo-btn', 'Undo', true);
  const hudSaveBtnEl = makeHudBtn('pmd-btn pmd-btn-primary pmd-battle-hud-btn', 'editor-hud-save-btn', 'Save');
  const hudPlayBtnEl = makeHudBtn('pmd-btn pmd-battle-hud-btn', 'editor-hud-play-btn', 'Play');
  topHudBarEl.append(hudPaletteBtnEl, hudToolBtnEl, hudUndoBtnEl, hudSaveBtnEl, hudPlayBtnEl);

  const toastBannerEl = document.createElement('div');
  toastBannerEl.className = 'pmd-window pmd-window--translucent pmd-battle-phase-banner';
  toastBannerEl.dataset.testid = 'map-editor-toast';
  toastBannerEl.hidden = true;

  const infoStripEl = document.createElement('div');
  infoStripEl.className = 'pmd-window pmd-window--translucent pmd-battle-info-strip';
  infoStripEl.dataset.testid = 'map-editor-info-strip';

  const drawerEl = document.createElement('aside');
  drawerEl.className = 'pmd-window pmd-battle-sandbox-drawer pmd-map-editor-drawer';
  drawerEl.dataset.testid = 'map-editor-drawer';
  drawerEl.innerHTML = `
    <div class="pmd-devtools-row-between">
      <h3 class="pmd-subcard-title">LEVEL &amp; CHAPTER MAP EDITOR</h3>
      <button type="button" class="pmd-btn pmd-chip-btn" data-testid="editor-drawer-close-btn">Hide Panel</button>
    </div>
    <div class="pmd-battle-sandbox-section">
      <div class="pmd-devtools-row-between">
        <span class="pmd-preset-label">1. Select Chapter or Cutscene Stage</span>
        <span class="pmd-editor-status-pill" data-testid="editor-status-badge">DEFAULT</span>
      </div>
      <select class="pmd-select" data-testid="editor-level-select" aria-label="Select Chapter or Cutscene Stage"></select>
      <div class="pmd-inline-btns">
        <button type="button" class="pmd-btn pmd-btn-primary pmd-chip-btn" data-testid="editor-save-btn">Save to Game</button>
        <button type="button" class="pmd-btn pmd-chip-btn" data-testid="editor-save-play-btn">Save &amp; Play</button>
        <button type="button" class="pmd-btn pmd-chip-btn" data-testid="editor-json-modal-btn">Import / Export JSON</button>
        <button type="button" class="pmd-btn pmd-btn-danger pmd-chip-btn" data-testid="editor-reset-default-btn">Reset Default</button>
      </div>
    </div>
    <div class="pmd-battle-sandbox-section">
      <span class="pmd-preset-label">2. Pointer Tool &amp; View Overlays</span>
      <div class="pmd-inline-btns" data-editor-tool-row>
        <button type="button" class="pmd-btn pmd-chip-btn is-active" data-editor-tool="paint" data-testid="editor-tool-paint">Tap Paint</button>
        <button type="button" class="pmd-btn pmd-chip-btn" data-editor-tool="stroke" data-testid="editor-tool-stroke">Drag Stroke</button>
        <button type="button" class="pmd-btn pmd-chip-btn" data-editor-tool="eyedropper" data-testid="editor-tool-eyedropper">Pick Tile</button>
        <button type="button" class="pmd-btn pmd-chip-btn" data-editor-tool="player_spawn" data-testid="editor-tool-player_spawn">Blue Spawns</button>
        <button type="button" class="pmd-btn pmd-chip-btn" data-editor-tool="enemy_spawn" data-testid="editor-tool-enemy_spawn">Enemy Spawns</button>
        <button type="button" class="pmd-btn pmd-chip-btn" data-editor-tool="stairs_wave" data-testid="editor-tool-stairs_wave">Stairs Waves</button>
        <button type="button" class="pmd-btn pmd-chip-btn" data-editor-tool="pan" data-testid="editor-tool-pan">Pan Only</button>
      </div>
      <div class="pmd-editor-enemy-config" data-editor-enemy-config hidden>
        <span class="pmd-subcard-text">Tap map tile to place/remove enemy spawn or Stairs reinforcement wave:</span>
        <select class="pmd-select" data-testid="editor-enemy-species-select" aria-label="Enemy Spawn Species"></select>
        <div class="pmd-inline-btns pmd-editor-stepper-row">
          <span class="pmd-subcard-text">Enemy Level: <strong data-enemy-level-val>2</strong></span>
          <button type="button" class="pmd-btn pmd-chip-btn" data-testid="editor-enemy-lv-dec">- Lv</button>
          <button type="button" class="pmd-btn pmd-chip-btn" data-testid="editor-enemy-lv-inc">+ Lv</button>
        </div>
        <div class="pmd-inline-btns pmd-editor-stepper-row" data-editor-wave-turn-row hidden>
          <span class="pmd-subcard-text">Wave Turn: <strong data-wave-turn-val>2</strong></span>
          <button type="button" class="pmd-btn pmd-chip-btn" data-testid="editor-wave-turn-dec">- Turn</button>
          <button type="button" class="pmd-btn pmd-chip-btn" data-testid="editor-wave-turn-inc">+ Turn</button>
        </div>
      </div>
      <div class="pmd-inline-btns">
        <button type="button" class="pmd-btn pmd-chip-btn" data-testid="editor-grid-toggle-btn">Grid: OFF</button>
        <button type="button" class="pmd-btn pmd-chip-btn is-active" data-testid="editor-spawns-toggle-btn">Spawns: ON</button>
      </div>
    </div>
    <div class="pmd-battle-sandbox-section">
      <span class="pmd-preset-label">3. Quick Biome Presets &amp; Terrain Rule</span>
      <div class="pmd-inline-btns" data-editor-biome-presets></div>
      <span class="pmd-subcard-text">Gameplay Terrain Rule (keeps selected chunk):</span>
      <div class="pmd-inline-btns" data-editor-terrain-chips></div>
      <p class="pmd-subcard-text pmd-editor-brush-readout" data-testid="editor-active-brush-summary">—</p>
      <select class="pmd-select" data-testid="editor-tileset-select" aria-label="Select EoS 24x24 Tileset Sheet"></select>
      <div class="pmd-battle-chunk-palette" data-testid="editor-chunk-grid"></div>
    </div>
    <div class="pmd-battle-sandbox-section">
      <span class="pmd-preset-label">4. Map Dimensions &amp; Deployment Cap</span>
      <div class="pmd-editor-dim-grid">
        <div class="pmd-editor-dim-item">
          <span class="pmd-subcard-text">Width: <strong data-testid="editor-width-val">18</strong></span>
          <div class="pmd-inline-btns">
            <button type="button" class="pmd-btn pmd-chip-btn" data-testid="editor-width-dec">-W</button>
            <button type="button" class="pmd-btn pmd-chip-btn" data-testid="editor-width-inc">+W</button>
          </div>
        </div>
        <div class="pmd-editor-dim-item">
          <span class="pmd-subcard-text">Height: <strong data-testid="editor-height-val">12</strong></span>
          <div class="pmd-inline-btns">
            <button type="button" class="pmd-btn pmd-chip-btn" data-testid="editor-height-dec">-H</button>
            <button type="button" class="pmd-btn pmd-chip-btn" data-testid="editor-height-inc">+H</button>
          </div>
        </div>
        <div class="pmd-editor-dim-item" data-testid="editor-deploy-cap-item">
          <span class="pmd-subcard-text">Deploy Cap: <strong data-testid="editor-cap-val">3</strong></span>
          <div class="pmd-inline-btns">
            <button type="button" class="pmd-btn pmd-chip-btn" data-testid="editor-cap-dec">-Cap</button>
            <button type="button" class="pmd-btn pmd-chip-btn" data-testid="editor-cap-inc">+Cap</button>
          </div>
        </div>
      </div>
      <div class="pmd-inline-btns">
        <button type="button" class="pmd-btn pmd-btn-danger pmd-chip-btn" data-testid="editor-exit-btn">Exit Map Editor</button>
      </div>
    </div>
  `;

  const systemMenuBackdropEl = document.createElement('div');
  systemMenuBackdropEl.className = 'pmd-battle-modal-backdrop';
  systemMenuBackdropEl.dataset.testid = 'editor-system-menu-modal';
  systemMenuBackdropEl.hidden = true;
  systemMenuBackdropEl.innerHTML = `
    <div class="pmd-window pmd-battle-system-dialog" role="dialog" aria-modal="true" aria-labelledby="editor-sys-title">
      <h3 id="editor-sys-title" class="pmd-panel-title">MAP EDITOR MENU</h3>
      <p class="pmd-panel-sub">Save your custom dungeon tiles to the live game or jump straight into battle.</p>
      <div class="pmd-battle-system-actions pmd-menu-list">
        <button type="button" class="pmd-btn pmd-btn-primary pmd-menu-row" data-testid="editor-sys-save-btn">Save Map to Game</button>
        <button type="button" class="pmd-btn pmd-menu-row" data-testid="editor-sys-play-btn">Save &amp; Play Level</button>
        <button type="button" class="pmd-btn pmd-menu-row" data-testid="editor-sys-drawer-btn">Open Palette Drawer</button>
        <button type="button" class="pmd-btn pmd-btn-danger pmd-menu-row" data-testid="editor-sys-reset-btn">Reset Level to Default</button>
        <button type="button" class="pmd-btn pmd-btn-danger pmd-menu-row" data-testid="editor-sys-exit-btn">Exit to Dev Tools</button>
        <button type="button" class="pmd-btn pmd-menu-row" data-testid="editor-sys-resume-btn">Resume Editing</button>
      </div>
    </div>
  `;

  const jsonModalBackdropEl = document.createElement('div');
  jsonModalBackdropEl.className = 'pmd-battle-modal-backdrop';
  jsonModalBackdropEl.dataset.testid = 'editor-json-modal';
  jsonModalBackdropEl.hidden = true;
  jsonModalBackdropEl.innerHTML = `
    <div class="pmd-window pmd-battle-export-dialog" role="dialog" aria-modal="true" aria-labelledby="editor-json-title">
      <h3 id="editor-json-title" class="pmd-panel-title">IMPORT / EXPORT MAP JSON</h3>
      <p class="pmd-panel-sub">Copy this level's DungeonMapDefinition JSON or paste edited JSON to apply &amp; save.</p>
      <textarea class="pmd-textarea" rows="8" data-testid="editor-json-textarea"></textarea>
      <p class="pmd-subcard-text" data-testid="editor-json-status" hidden></p>
      <div class="pmd-inline-btns">
        <button type="button" class="pmd-btn pmd-btn-primary" data-testid="editor-json-apply-btn">Import &amp; Save JSON</button>
        <button type="button" class="pmd-btn" data-testid="editor-json-copy-btn">Copy JSON</button>
        <button type="button" class="pmd-btn" data-testid="editor-json-close-btn">Close</button>
      </div>
    </div>
  `;

  rootEl.append(
    canvasStageEl,
    topHudBarEl,
    toastBannerEl,
    infoStripEl,
    drawerEl,
    systemMenuBackdropEl,
    jsonModalBackdropEl
  );
  viewportEl.appendChild(rootEl);

  const q = <T extends HTMLElement>(parent: HTMLElement, sel: string) =>
    parent.querySelector<T>(sel)!;

  return {
    rootEl,
    canvasStageEl,
    canvas,
    ctx,
    topHudBarEl,
    hudPaletteBtnEl,
    hudToolBtnEl,
    hudUndoBtnEl,
    hudSaveBtnEl,
    hudPlayBtnEl,
    toastBannerEl,
    infoStripEl,
    drawerEl,
    levelSelectEl: q<HTMLSelectElement>(drawerEl, '[data-testid="editor-level-select"]'),
    statusBadgeEl: q(drawerEl, '[data-testid="editor-status-badge"]'),
    savePlayBtnEl: q<HTMLButtonElement>(drawerEl, '[data-testid="editor-save-play-btn"]'),
    enemyConfigBoxEl: q(drawerEl, '[data-editor-enemy-config]'),
    enemySpeciesSelectEl: q<HTMLSelectElement>(drawerEl, '[data-testid="editor-enemy-species-select"]'),
    enemyLevelValEl: q(drawerEl, '[data-enemy-level-val]'),
    waveTurnRowEl: q(drawerEl, '[data-editor-wave-turn-row]'),
    waveTurnValEl: q(drawerEl, '[data-wave-turn-val]'),
    gridToggleBtnEl: q<HTMLButtonElement>(drawerEl, '[data-testid="editor-grid-toggle-btn"]'),
    spawnsToggleBtnEl: q<HTMLButtonElement>(drawerEl, '[data-testid="editor-spawns-toggle-btn"]'),
    activeBrushSummaryEl: q(drawerEl, '[data-testid="editor-active-brush-summary"]'),
    tilesetSelectEl: q<HTMLSelectElement>(drawerEl, '[data-testid="editor-tileset-select"]'),
    chunkPaletteEl: q(drawerEl, '[data-testid="editor-chunk-grid"]'),
    mapWidthValEl: q(drawerEl, '[data-testid="editor-width-val"]'),
    mapHeightValEl: q(drawerEl, '[data-testid="editor-height-val"]'),
    deployCapItemEl: q(drawerEl, '[data-testid="editor-deploy-cap-item"]'),
    deployCapValEl: q(drawerEl, '[data-testid="editor-cap-val"]'),
    systemMenuBackdropEl,
    sysPlayBtnEl: q<HTMLButtonElement>(systemMenuBackdropEl, '[data-testid="editor-sys-play-btn"]'),
    jsonModalBackdropEl,
    jsonTextareaEl: q<HTMLTextAreaElement>(jsonModalBackdropEl, '[data-testid="editor-json-textarea"]'),
    jsonStatusEl: q(jsonModalBackdropEl, '[data-testid="editor-json-status"]'),
  };
}
