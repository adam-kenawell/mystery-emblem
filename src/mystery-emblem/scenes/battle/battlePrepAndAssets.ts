/**
 * Battle Initialization, Asset Preloading & Prep -> Turn 1 Entry (`BattleScene`)
 */

import { loadSpeciesSpriteBundle } from '../../assets/pmdAssetLoader';
import { loadTilesetSheet, normalizeTilesetId } from '../../assets/tilesetLoader';
import {
  buildBattleUnitsFromPrepDeployment,
  createFallbackBattlePrepManager,
  createInitialPrepDeploymentSlots,
  resolveEnemySpawnsForMap,
} from '../../engine/battleSetup';
import { createRandomRngSeed } from '../../engine/seededRng';
import type { SaveStateManager } from '../../state/SaveStateManager';
import {
  clearOpeningAndPhaseAnimations,
  playBattleOpeningSequence,
} from './battleBannersAndTransitions';
import {
  clearBattleSelection,
  recomputeDangerArea,
  syncHudControls,
  syncPrepChromeVisibility,
} from './battleDangerAndViewportState';
import { clearFloatingTexts } from './battleFloatingCallouts';
import { updateBattleInfoStrip } from './battleHudCards';
import { dismissTalkChoiceModal } from './battleTalkChoiceModal';
import { triggerPrepHubTutorials } from './battleTutorialIntegration';
import type { BattleControllerContext, BattleRuntimeState } from './battleTypesAndState';
import { getLordUnit, getUnitVisualKey } from './battleUnitQueries';

export function getActivePrepSaveManager(
  state: BattleRuntimeState,
  saveManager: SaveStateManager
): SaveStateManager {
  if (saveManager.getSave() !== null) {
    return saveManager;
  }
  if (!state.guestPrepManager) {
    state.guestPrepManager = createFallbackBattlePrepManager();
  }
  return state.guestPrepManager;
}

export function hideAllBattleModals(ctx: BattleControllerContext): void {
  const { state, dom, prepOverlay } = ctx;
  prepOverlay.hide();
  clearOpeningAndPhaseAnimations(state, dom);
  dismissTalkChoiceModal(state, dom, null);
  dom.forecastModalBackdropEl.hidden = true;
  dom.levelUpModalBackdropEl.hidden = true;
  if (state.levelUpResolver) {
    const resolve = state.levelUpResolver;
    state.levelUpResolver = null;
    resolve();
  }
  dom.systemMenuBackdropEl.hidden = true;
  dom.victoryModalBackdropEl.hidden = true;
  dom.defeatModalBackdropEl.hidden = true;
  dom.actionMenuEl.hidden = true;
  dom.unitPopupEl.hidden = true;
  dom.phaseBannerEl.hidden = true;
  state.systemMenuOpen = false;
  state.systemMenuSubView = 'root';
}

export async function preloadMapTilesets(state: BattleRuntimeState): Promise<void> {
  const needed = new Set<string>();
  for (const row of state.map.tiles) {
    for (const cell of row) {
      needed.add(normalizeTilesetId(cell.tilesetId));
    }
  }
  await Promise.all(
    [...needed].map(async (id) => {
      if (!state.tilesetSheets.has(id)) {
        const loaded = await loadTilesetSheet(id);
        state.tilesetSheets.set(id, loaded);
      }
    })
  );
}

export async function preloadAllUnitSprites(state: BattleRuntimeState): Promise<void> {
  const visualKeys = new Set<string>(state.units.map((u) => getUnitVisualKey(u)));
  await Promise.all(
    [...visualKeys].map(async (visKey) => {
      if (!state.spriteBundles.has(visKey)) {
        const bundle = await loadSpeciesSpriteBundle(visKey);
        state.spriteBundles.set(visKey, bundle);
      }
    })
  );
}

function syncProtectedUnitIdsFromState(state: BattleRuntimeState): void {
  state.defeatIfUnitIdsFall = [
    ...new Set([
      ...(state.explicitDefeatIfUnitIdsFall ?? []),
      ...(state.map.defeatIfUnitIdsFall ?? []),
      ...state.units.filter((u) => u.mustSurvive).map((u) => u.id),
    ]),
  ];
}

export function rebuildPrepBattleUnits(ctx: BattleControllerContext): void {
  const { state, saveManager } = ctx;
  const activeSave = getActivePrepSaveManager(state, saveManager).getSave();
  if (!activeSave) return;
  state.units = buildBattleUnitsFromPrepDeployment(
    state.map,
    activeSave.roster,
    state.deploymentSlots,
    state.enemySpawnDefs,
    activeSave
  );
  syncProtectedUnitIdsFromState(state);
  void preloadAllUnitSprites(state).then(() => {
    if (state.openState) ctx.renderNow();
  });
  recomputeDangerArea(ctx);
  updateBattleInfoStrip(ctx);
  ctx.renderNow();
}

const preferredDeployByState = new WeakMap<
  BattleRuntimeState,
  ReadonlyArray<string> | undefined
>();

export async function setupFreshBattleState(
  ctx: BattleControllerContext,
  opts?: { showPrepOverlay?: boolean; preferredDeployInstanceIds?: ReadonlyArray<string> }
): Promise<void> {
  const { state, dom, prepOverlay, saveManager } = ctx;
  if (opts && 'preferredDeployInstanceIds' in opts) {
    preferredDeployByState.set(state, opts.preferredDeployInstanceIds);
  }
  hideAllBattleModals(ctx);
  state.activeWalk = null;
  state.activeStrikeVfx = null;
  clearFloatingTexts(state, dom);
  state.trackedEnemyIds.clear();
  state.hoveredTile = null;
  state.lastComputedHoverEnemyId = null;
  state.suppressedHoverEnemyId = null;
  state.triggeredEventIds.clear();
  state.spawnedReinforcementIds.clear();
  state.blockedReinforcementIds.clear();
  state.collectedDrops = [];
  state.eventBonusItems = [];
  state.eventBonusGold = 0;
  state.pendingShopUnlocks = [];
  state.pendingPostBattleRecruits = [];
  state.defeatReasonText = null;
  state.levelUpHistory = [];
  state.prepSwapSlotIndex = null;
  clearBattleSelection(state, dom, prepOverlay);

  state.turnNumber = 1;
  state.rngState = createRandomRngSeed();
  state.victoryCallbackFired = false;
  state.phase = 'dungeon_prep';
  state.interactionState = 'idle';
  state.selectionPulseStartMs = performance.now();

  state.reinforcements = state.explicitReinforcements ?? state.map.reinforcements ?? [];
  state.events = state.explicitEvents ?? state.map.events ?? [];
  state.enemySpawnDefs = resolveEnemySpawnsForMap(
    state.map,
    state.explicitEnemyOverrides,
    getActivePrepSaveManager(state, saveManager).getSave()
  );
  const activeSave = getActivePrepSaveManager(state, saveManager).getSave()!;
  state.deploymentSlots = createInitialPrepDeploymentSlots(
    state.map,
    activeSave.roster,
    preferredDeployByState.get(state)
  );
  state.units = buildBattleUnitsFromPrepDeployment(
    state.map,
    activeSave.roster,
    state.deploymentSlots,
    state.enemySpawnDefs,
    activeSave
  );
  syncProtectedUnitIdsFromState(state);

  const lord = getLordUnit(state) ?? state.units[0];
  state.inspectedTile = { x: lord?.x ?? 3, y: lord?.y ?? 5 };

  await Promise.all([preloadMapTilesets(state), preloadAllUnitSprites(state)]);

  recomputeDangerArea(ctx);
  syncHudControls(state, dom);
  updateBattleInfoStrip(ctx);
  if (opts?.showPrepOverlay !== false) {
    prepOverlay.show();
    triggerPrepHubTutorials(ctx);
  }
  syncPrepChromeVisibility(state, dom, prepOverlay);
}

export function confirmEnterDungeonFromPrep(ctx: BattleControllerContext): void {
  const { state, dom, prepOverlay } = ctx;
  if (state.phase !== 'dungeon_prep') return;
  state.prepSwapSlotIndex = null;
  prepOverlay.hide();
  rebuildPrepBattleUnits(ctx);

  state.phase = 'player_phase';
  state.interactionState = 'idle';
  syncPrepChromeVisibility(state, dom, prepOverlay);

  const lord = getLordUnit(state) ?? state.units[0];
  if (lord) {
    state.inspectedTile = { x: lord.x, y: lord.y };
    ctx.centerCameraOnTile(lord.x, lord.y);
  }

  syncHudControls(state, dom);
  updateBattleInfoStrip(ctx);
  ctx.onLayerStateChanged();
  ctx.renderNow();
  void playBattleOpeningSequence(ctx, state.battleRunGen);
}
