/**
 * `DungeonPrepOverlay` Instantiation & Live Custom Map Watcher for `BattleScene`
 */

import type { AudioManager } from '../../audio/AudioManager';
import {
  getEffectiveChapterMap,
  subscribeChapterMapChanges,
} from '../../data/chapterMapRegistry';
import {
  getMapDeploymentCap,
  resolveEnemySpawnsForMap,
} from '../../engine/battleSetup';
import { DungeonPrepOverlay } from '../../ui/DungeonPrepOverlay';
import {
  syncPrepChromeVisibility,
  toggleGlobalDangerArea,
} from './battleDangerAndViewportState';
import type { BattleDomRefs } from './battleDomShell';
import { updateBattleInfoStrip } from './battleHudCards';
import {
  confirmEnterDungeonFromPrep,
  getActivePrepSaveManager,
  rebuildPrepBattleUnits,
  setupFreshBattleState,
} from './battlePrepAndAssets';
import { togglePrepDeployUnit } from './battlePrepSlotActions';
import type { BattleSceneOptions } from './battlePublicTypes';
import { openBattleSaveProgressOverlay } from './battleSuspend';
import { triggerBattleTutorial } from './battleTutorialIntegration';
import type { BattleControllerContext, BattleRuntimeState } from './battleTypesAndState';
import { getLivingEnemies } from './battleUnitQueries';

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
    syncPrepChromeVisibility(state, dom, overlayRef);
    updateBattleInfoStrip(ctx);
    ctx.renderNow();
  };

  overlayRef = new DungeonPrepOverlay({
    parentEl: dom.rootEl,
    audioManager,
    getTutorialOverlay: () => options.tutorialOverlay,
    getSaveManager: () => getActivePrepSaveManager(state, options.saveManager),
    getMap: () => state.map,
    getEnemyCount: () => getLivingEnemies(state).length,
    getObjectiveLabel: () => state.objectiveLabel,
    getDeploymentSlots: () => state.deploymentSlots,
    getDeploymentCap: () => getMapDeploymentCap(state.map),
    getGlobalDangerEnabled: () => state.globalDangerEnabled,
    getSelectedSwapSlotIndex: () => state.prepSwapSlotIndex,
    onToggleDeployUnit: (id) => togglePrepDeployUnit(getCtx(), id),
    onRosterOrLoadoutMutated: () => rebuildPrepBattleUnits(getCtx()),
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
