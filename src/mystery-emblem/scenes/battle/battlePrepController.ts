/**
 * Chapter Prep Overlay, Deployment Slots, Map Subscriptions & Asset Preloading (`battlePrepController.ts`)
 */

import type { AudioManager } from '../../audio/AudioManager';
import { loadSpeciesSpriteBundle } from '../../assets/pmdAssetLoader';
import { loadTilesetSheet, normalizeTilesetId } from '../../assets/tilesetLoader';
import {
  getEffectiveChapterMap,
  subscribeChapterMapChanges,
} from '../../data/chapterMapRegistry';
import {
  buildBattleUnitsFromPrepDeployment,
  createFallbackBattlePrepManager,
  createInitialPrepDeploymentSlots,
  getMapDeploymentCap,
  resolveEnemySpawnsForMap,
} from '../../engine/battleSetup';
import { createRandomRngSeed } from '../../engine/seededRng';
import type { SaveStateManager } from '../../state/SaveStateManager';
import { DungeonPrepOverlay } from '../../ui/DungeonPrepOverlay';
import {
  clearOpeningAndPhaseAnimations,
  playBattleOpeningSequence,
} from './battleBannersAndTransitions';
import {
  clearBattleSelection,
  clearInspectedAllyRange,
  recomputeDangerArea,
  syncHudControls,
  syncPrepChromeVisibility,
  toggleGlobalDangerArea,
  toggleIndividualEnemyDanger,
  toggleInspectedAllyRange,
} from './battleDangerAndViewportState';
import type { BattleDomRefs } from './battleDomShell';
import { clearFloatingTexts } from './battleFloatingCallouts';
import { updateBattleInfoStrip } from './battleHudCards';
import type { BattleSceneOptions } from './battlePublicTypes';
import {
  cloneSaveSupportsForBattle,
  syncBattleSupportsFromSave,
} from './battleSupportHelpers';
import { openBattleSaveProgressOverlay } from './battleSuspend';
import { dismissTalkChoiceModal } from './battleTalkChoiceModal';
import {
  triggerBattleTutorial,
  triggerPrepHubTutorials,
} from './battleTutorialIntegration';
import type { BattleControllerContext, BattleRuntimeState } from './battleTypesAndState';
import {
  getLivingEnemies,
  getLivingUnits,
  getLordUnit,
  getUnitVisualKey,
} from './battleUnitQueries';

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
  dom.moveLearnedModalBackdropEl.hidden = true;
  if (state.moveLearnedResolver) {
    const resolve = state.moveLearnedResolver;
    state.moveLearnedResolver = null;
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
  clearInspectedAllyRange(state);
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
  state.dangerRangeCache.clear();
  state.tileCacheVersion += 1;
  state.hoveredTile = null;
  state.lastComputedHoverEnemyId = null;
  state.suppressedHoverEnemyId = null;
  state.triggeredEventIds.clear();
  state.spawnedReinforcementIds.clear();
  state.activatedSquadIds.clear();
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
  state.battleSupportPoints = cloneSaveSupportsForBattle(activeSave);
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

export function togglePrepDeployUnit(
  ctx: BattleControllerContext,
  instanceId: string
): { ok: boolean; message: string } {
  const { state, saveManager } = ctx;
  const activeSave = getActivePrepSaveManager(state, saveManager).getSave();
  const unit = activeSave?.roster.find((u) => u.instanceId === instanceId);
  if (!unit) {
    return { ok: false, message: 'Unit not found in roster.' };
  }
  if (unit.isLord) {
    return {
      ok: false,
      message: `${unit.nickname} is your Dragon Lord and must enter every dungeon.`,
    };
  }

  const existingSlot = state.deploymentSlots.find((s) => s.unitInstanceId === instanceId);
  if (existingSlot) {
    existingSlot.unitInstanceId = null;
    if (state.prepSwapSlotIndex === existingSlot.slotIndex) {
      state.prepSwapSlotIndex = null;
    }
    rebuildPrepBattleUnits(ctx);
    return { ok: true, message: `${unit.nickname} moved to Standby.` };
  }

  const deployedCount = state.deploymentSlots.filter((s) => s.unitInstanceId !== null).length;
  const cap = getMapDeploymentCap(state.map);
  if (deployedCount >= cap) {
    return {
      ok: false,
      message: `Deployment cap reached (${cap}/${cap}). Bench another unit first.`,
    };
  }

  const openSlot = state.deploymentSlots.find((s) => s.unitInstanceId === null);
  if (!openSlot) {
    return { ok: false, message: 'No open starting tile available.' };
  }

  openSlot.unitInstanceId = unit.instanceId;
  rebuildPrepBattleUnits(ctx);
  return {
    ok: true,
    message: `${unit.nickname} deployed.`,
  };
}

export function handlePrepViewMapTileTap(
  ctx: BattleControllerContext,
  tx: number,
  ty: number
): void {
  const { state, prepOverlay, audioManager } = ctx;
  state.inspectedTile = { x: tx, y: ty };
  const livingOcc = getLivingUnits(state).find((u) => u.x === tx && u.y === ty);
  state.touchInspectedUnitId = state.hoveredTile === null && livingOcc ? livingOcc.id : null;
  const clickedSlot = state.deploymentSlots.find((s) => s.x === tx && s.y === ty) ?? null;

  if (state.prepSwapSlotIndex === null) {
    if (clickedSlot && clickedSlot.unitInstanceId) {
      clearInspectedAllyRange(state);
      state.prepSwapSlotIndex = clickedSlot.slotIndex;
      state.selectionPulseStartMs = performance.now();
      audioManager.playSfx('select');
      prepOverlay.syncMapHudState();
      state.prepMapStatusNotice = 'Tap another blue tile to swap.';
      updateBattleInfoStrip(ctx);
      ctx.onLayerStateChanged();
      ctx.renderNow();
      return;
    }

    if (clickedSlot) {
      clearInspectedAllyRange(state);
      audioManager.playSfx('dialogue_advance');
      state.prepMapStatusNotice = 'Open blue tile - tap a unit first.';
      updateBattleInfoStrip(ctx);
      ctx.onLayerStateChanged();
      ctx.renderNow();
      return;
    }

    state.prepMapStatusNotice = null;
    const tappedEnemy = getLivingEnemies(state).find((e) => e.x === tx && e.y === ty);
    if (tappedEnemy) {
      audioManager.playSfx('select');
      toggleIndividualEnemyDanger(ctx, tappedEnemy.id);
    } else if (livingOcc && livingOcc.faction === 'npc') {
      toggleInspectedAllyRange(ctx, livingOcc.id);
      ctx.onLayerStateChanged();
    } else if (clearInspectedAllyRange(state)) {
      audioManager.playSfx('cancel');
      ctx.onLayerStateChanged();
    } else {
      audioManager.playSfx('dialogue_advance');
    }
    updateBattleInfoStrip(ctx);
    ctx.renderNow();
    return;
  }

  const sourceSlot = state.deploymentSlots.find((s) => s.slotIndex === state.prepSwapSlotIndex);
  if (!sourceSlot) {
    state.prepSwapSlotIndex = null;
    state.prepMapStatusNotice = null;
    prepOverlay.syncMapHudState();
    updateBattleInfoStrip(ctx);
    ctx.onLayerStateChanged();
    return;
  }

  if (clickedSlot && clickedSlot.slotIndex === sourceSlot.slotIndex) {
    state.prepSwapSlotIndex = null;
    state.prepMapStatusNotice = null;
    audioManager.playSfx('cancel');
    prepOverlay.syncMapHudState();
    updateBattleInfoStrip(ctx);
    ctx.onLayerStateChanged();
    ctx.renderNow();
    return;
  }

  if (clickedSlot) {
    const tempUnitId = sourceSlot.unitInstanceId;
    sourceSlot.unitInstanceId = clickedSlot.unitInstanceId;
    clickedSlot.unitInstanceId = tempUnitId;
    state.prepSwapSlotIndex = null;
    state.prepMapStatusNotice = 'Positions swapped.';
    audioManager.playSfx('select');
    rebuildPrepBattleUnits(ctx);
    prepOverlay.refreshAll();
    const postRebuildOcc = getLivingUnits(state).find((u) => u.x === tx && u.y === ty);
    state.touchInspectedUnitId =
      state.hoveredTile === null && postRebuildOcc ? postRebuildOcc.id : null;
    updateBattleInfoStrip(ctx);
    ctx.onLayerStateChanged();
    ctx.renderNow();
    return;
  }

  state.prepSwapSlotIndex = null;
  audioManager.playSfx('cancel');
  prepOverlay.syncMapHudState();
  state.prepMapStatusNotice = 'Only blue starting tiles can swap.';
  updateBattleInfoStrip(ctx);
  ctx.onLayerStateChanged();
  ctx.renderNow();
}

export function refreshFromExternalSaveCheat(ctx: BattleControllerContext): void {
  const { state, prepOverlay, saveManager } = ctx;
  if (!state.openState) return;
  syncBattleSupportsFromSave(ctx);
  if (state.phase !== 'dungeon_prep') {
    updateBattleInfoStrip(ctx);
    ctx.renderNow();
    return;
  }
  const activeSave = getActivePrepSaveManager(state, saveManager).getSave();
  if (!activeSave) return;
  const rosterIds = new Set(activeSave.roster.map((u) => u.instanceId));
  const slotsStillValid =
    state.deploymentSlots.length > 0 &&
    state.deploymentSlots.every(
      (s) => s.unitInstanceId === null || rosterIds.has(s.unitInstanceId)
    ) &&
    state.deploymentSlots.some((s) => s.unitInstanceId !== null);
  if (!slotsStillValid) {
    state.deploymentSlots = createInitialPrepDeploymentSlots(state.map, activeSave.roster);
  }
  rebuildPrepBattleUnits(ctx);
  prepOverlay.refreshAll();
}

export function createBattlePrepOverlay(
  options: BattleSceneOptions,
  audioManager: AudioManager,
  state: BattleRuntimeState,
  dom: BattleDomRefs,
  getCtx: () => BattleControllerContext
): DungeonPrepOverlay {
  let overlayRef!: DungeonPrepOverlay;
  const clearPrepViewMapSelection = () => {
    const ctx = getCtx();
    state.prepSwapSlotIndex = null;
    state.prepMapStatusNotice = null;
    state.touchInspectedUnitId = null;
    clearInspectedAllyRange(state);
    syncPrepChromeVisibility(state, dom, overlayRef);
    updateBattleInfoStrip(ctx);
    ctx.renderNow();
  };

  overlayRef = new DungeonPrepOverlay({
    parentEl: dom.rootEl,
    audioManager,
    getDialogueOverlay: () => options.dialogueOverlay,
    getSaveManager: () => getActivePrepSaveManager(state, options.saveManager),
    getLevelId: () => state.activeLevelId,
    getMap: () => state.map,
    getEnemyCount: () => getLivingEnemies(state).length,
    getObjectiveLabel: () => state.objectiveLabel,
    getDeploymentSlots: () => state.deploymentSlots,
    getDeploymentCap: () => getMapDeploymentCap(state.map),
    getGlobalDangerEnabled: () => state.globalDangerEnabled,
    getSelectedSwapSlotIndex: () => state.prepSwapSlotIndex,
    onToggleDeployUnit: (id) => togglePrepDeployUnit(getCtx(), id),
    onRosterOrLoadoutMutated: () => rebuildPrepBattleUnits(getCtx()),
    onSupportsMutated: () => {
      const ctx = getCtx();
      syncBattleSupportsFromSave(ctx);
      updateBattleInfoStrip(ctx);
      ctx.renderNow();
    },
    onEnterViewMap: clearPrepViewMapSelection,
    onExitViewMap: clearPrepViewMapSelection,
    onToggleGlobalDanger: () => toggleGlobalDangerArea(getCtx()),
    onConfirmEnterDungeon: () => confirmEnterDungeonFromPrep(getCtx()),
    onSaveProgress: () => openBattleSaveProgressOverlay(getCtx()),
    onSubLayerChanged: () => {
      const ctx = getCtx();
      syncPrepChromeVisibility(state, dom, overlayRef);
      updateBattleInfoStrip(ctx);
      options.onLayerStateChanged();
    },
    onSubModeEntered: (subMode) => {
      const ctx = getCtx();
      if (subMode === 'manage_units') {
        void triggerBattleTutorial(ctx, 'prep_units_and_moves');
      } else if (subMode === 'manage_items') {
        void triggerBattleTutorial(ctx, 'prep_items_and_convoy');
      }
    },
  });

  return overlayRef;
}

export function subscribeBattlePrepMapChanges(
  getCtx: () => BattleControllerContext
): () => void {
  return subscribeChapterMapChanges((changedLevelId) => {
    const ctx = getCtx();
    const { state } = ctx;
    if (
      state.openState &&
      state.phase === 'dungeon_prep' &&
      !state.explicitCustomMap &&
      (changedLevelId === null || changedLevelId === state.activeLevelId)
    ) {
      state.map = getEffectiveChapterMap(state.activeLevelId);
      state.enemySpawnDefs = resolveEnemySpawnsForMap(
        state.map,
        state.explicitEnemyOverrides
      );
      void setupFreshBattleState(ctx).then(() => {
        if (state.openState) ctx.renderNow();
      });
    }
  });
}
