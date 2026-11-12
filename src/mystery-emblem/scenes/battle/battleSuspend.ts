/**
 * Mid-Battle "Save Progress" Snapshot: Build, Gate & Restore (`battleSuspendJson`)
 */

import type { BattleUnitState } from '../../engine/combatEngine';
import type { LevelUpResult } from '../../engine/progressionEngine';
import { openSaveSlotOverlay } from '../../ui/SaveSlotOverlay';
import type {
  BattleObjectiveType,
  ConvoyEntry,
  DungeonMapDefinition,
  KecleonShopType,
  PrepDeploymentSlot,
} from '../../types/schemas';
import { isPhaseTransitionPlaying, playPhaseTransitionAsync } from './battleBannersAndTransitions';
import {
  recomputeDangerArea,
  syncHudControls,
  syncPrepChromeVisibility,
} from './battleDangerAndViewportState';
import { updateBattleInfoStrip } from './battleHudCards';
import { preloadAllUnitSprites, preloadMapTilesets } from './battlePrepAndAssets';
import type { BattleSuspendSource } from './battlePublicTypes';
import type {
  BattleControllerContext,
  BattleRuntimeState,
  PendingPostBattleRecruit,
} from './battleTypesAndState';
import { getLordUnit } from './battleUnitQueries';

export const BATTLE_SUSPEND_VERSION = 1 as const;

export interface BattleSuspendSnapshot {
  version: typeof BATTLE_SUSPEND_VERSION;
  savedAt: number;
  source: BattleSuspendSource;
  levelId: string;
  mapName: string;
  map: DungeonMapDefinition;
  turnNumber: number;
  rngState: number;
  objectiveType: BattleObjectiveType;
  objectiveLabel: string;
  surviveTurns: number | null;
  defeatIfUnitIdsFall: string[];
  units: BattleUnitState[];
  deploymentSlots: PrepDeploymentSlot[];
  triggeredEventIds: string[];
  spawnedReinforcementIds: string[];
  blockedReinforcementIds: string[];
  collectedDrops: string[];
  eventBonusItems: ConvoyEntry[];
  eventBonusGold: number;
  pendingShopUnlocks: Array<{ nodeId: string; shopType?: KecleonShopType }>;
  pendingPostBattleRecruits: PendingPostBattleRecruit[];
  levelUpHistory: LevelUpResult[];
  globalDangerEnabled: boolean;
  trackedEnemyIds: string[];
}

/** Returns why saving is blocked right now, or null when it is safe to snapshot. */
export function getBattleSaveBlockReason(
  state: BattleRuntimeState,
  extra?: { dialogueOpen?: boolean; tutorialActive?: boolean }
): string | null {
  if (!state.openState) return 'No battle in progress.';
  if (!state.suspendSource) return 'This battle cannot be saved.';
  if (state.cutsceneInProgress || extra?.dialogueOpen) return 'Wait for the scene to finish.';
  if (extra?.tutorialActive) return 'Finish the tutorial step first.';
  if (state.phase === 'dungeon_prep') return null;
  if (state.phase !== 'player_phase') return 'You can only save during your turn.';
  if (state.interactionState !== 'idle') return 'Finish the current action first.';
  if (isPhaseTransitionPlaying(state) || state.beginBattleResolver !== null) {
    return 'Wait for the phase change to finish.';
  }
  if (state.levelUpResolver !== null || state.talkChoiceResolver !== null) {
    return 'Close the open window first.';
  }
  return null;
}

/** Prep-phase saves carry no snapshot: reloading simply restarts at prep. */
export function buildBattleSuspendJson(state: BattleRuntimeState): string | null {
  if (!state.suspendSource || state.phase !== 'player_phase') return null;
  const snap: BattleSuspendSnapshot = {
    version: BATTLE_SUSPEND_VERSION,
    savedAt: Date.now(),
    source: state.suspendSource,
    levelId: state.activeLevelId,
    mapName: state.map.name,
    map: state.map,
    turnNumber: state.turnNumber,
    rngState: state.rngState,
    objectiveType: state.objectiveType,
    objectiveLabel: state.objectiveLabel,
    surviveTurns: state.surviveTurns ?? null,
    defeatIfUnitIdsFall: [...state.defeatIfUnitIdsFall],
    units: state.units,
    deploymentSlots: state.deploymentSlots,
    triggeredEventIds: [...state.triggeredEventIds],
    spawnedReinforcementIds: [...state.spawnedReinforcementIds],
    blockedReinforcementIds: [...state.blockedReinforcementIds],
    collectedDrops: state.collectedDrops,
    eventBonusItems: state.eventBonusItems,
    eventBonusGold: state.eventBonusGold,
    pendingShopUnlocks: state.pendingShopUnlocks,
    pendingPostBattleRecruits: state.pendingPostBattleRecruits,
    levelUpHistory: state.levelUpHistory,
    globalDangerEnabled: state.globalDangerEnabled,
    trackedEnemyIds: [...state.trackedEnemyIds],
  };
  return JSON.stringify(snap);
}

export function parseBattleSuspendJson(raw: string | null | undefined): BattleSuspendSnapshot | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<BattleSuspendSnapshot>;
    if (
      parsed?.version !== BATTLE_SUSPEND_VERSION ||
      !parsed.source ||
      !parsed.map ||
      !Array.isArray(parsed.units) ||
      typeof parsed.turnNumber !== 'number'
    ) {
      return null;
    }
    return parsed as BattleSuspendSnapshot;
  } catch {
    return null;
  }
}

/** Opens the shared slot picker for the battle field menu / prep hub "Save Progress" buttons. */
export function openBattleSaveProgressOverlay(ctx: BattleControllerContext): void {
  const { state, saveManager, audioManager, dialogueOverlay, tutorialOverlay } = ctx;
  const blockedReason = !saveManager.getSave()
    ? 'No campaign file is loaded.'
    : getBattleSaveBlockReason(state, {
        dialogueOpen: Boolean(dialogueOverlay?.isOpen()),
        tutorialActive: Boolean(tutorialOverlay?.isBlockingSceneInput()),
      });
  openSaveSlotOverlay({
    manager: saveManager,
    audioManager,
    mode: 'save',
    blockedReason,
    onSaveToSlot: (slot) => {
      saveManager.saveProgressToSlot(slot, { battleSuspendJson: buildBattleSuspendJson(state) });
    },
    onClose: () => ctx.onLayerStateChanged(),
  });
  ctx.onLayerStateChanged();
}

/** Overlays a parsed snapshot onto a freshly opened battle and hands control back to the player. */
export async function applyBattleSuspendSnapshot(
  ctx: BattleControllerContext,
  snap: BattleSuspendSnapshot
): Promise<void> {
  const { state, dom, prepOverlay, audioManager } = ctx;
  const runGen = state.battleRunGen;
  prepOverlay.hide();

  state.map = snap.map;
  state.turnNumber = snap.turnNumber;
  state.rngState = snap.rngState >>> 0;
  state.objectiveType = snap.objectiveType;
  state.objectiveLabel = snap.objectiveLabel;
  state.surviveTurns = snap.surviveTurns ?? undefined;
  state.defeatIfUnitIdsFall = [...snap.defeatIfUnitIdsFall];
  state.units = snap.units.map((u) => ({
    ...u,
    frameIndex: 0,
    nextFrameAt: 0,
    hitFlashUntilMs: 0,
    action: u.defeated ? u.action : 'Idle',
  }));
  state.deploymentSlots = snap.deploymentSlots;
  state.triggeredEventIds = new Set(snap.triggeredEventIds);
  state.spawnedReinforcementIds = new Set(snap.spawnedReinforcementIds);
  state.blockedReinforcementIds = new Set(snap.blockedReinforcementIds);
  state.collectedDrops = [...snap.collectedDrops];
  state.eventBonusItems = snap.eventBonusItems.map((e) => ({ ...e }));
  state.eventBonusGold = snap.eventBonusGold;
  state.pendingShopUnlocks = [...snap.pendingShopUnlocks];
  state.pendingPostBattleRecruits = [...snap.pendingPostBattleRecruits];
  state.levelUpHistory = [...snap.levelUpHistory];
  state.globalDangerEnabled = snap.globalDangerEnabled;
  state.trackedEnemyIds = new Set(snap.trackedEnemyIds);
  state.victoryCallbackFired = false;
  state.phase = 'player_phase';
  state.interactionState = 'idle';

  await Promise.all([preloadMapTilesets(state), preloadAllUnitSprites(state)]);
  if (!state.openState || runGen !== state.battleRunGen) return;

  const lord = getLordUnit(state) ?? state.units.find((u) => u.faction === 'player' && !u.defeated);
  if (lord) {
    state.inspectedTile = { x: lord.x, y: lord.y };
    ctx.centerCameraOnTile(lord.x, lord.y);
  }
  syncPrepChromeVisibility(state, dom, prepOverlay);
  recomputeDangerArea(ctx);
  syncHudControls(state, dom);
  updateBattleInfoStrip(ctx);
  ctx.onLayerStateChanged();
  ctx.renderNow();

  audioManager.playSfx('phase_change');
  await playPhaseTransitionAsync(state, dom, 'player', runGen);
}
