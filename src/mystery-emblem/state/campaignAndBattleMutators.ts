/**
 * Mystery Emblem - Campaign Flags, Overworld, Support & Battle Commit Mutators (`campaignAndBattleMutators.ts`)
 */

import { MAX_UNIT_LEVEL, MIN_UNIT_LEVEL } from '../data/campaignConfig';
import { reconcileEquippedMoves, type EquippedMoveSlots } from '../data/equippedMoves';
import { ITEM_MAP, MOVE_MAP, SPECIES_MAP } from '../data/index';
import {
  DEMO_OVERWORLD_GRAPH,
  getOverworldNodeById,
  type OverworldGraphDefinition,
} from '../data/overworldMapData';
import {
  SUPPORT_PAIR_DEFINITIONS,
  SUPPORT_RANK_THRESHOLDS,
  SUPPORT_UNLOCK_REQUIRED_CHAPTER_ID,
  clampSupportPointsForUnlockedRank,
  getMaxSupportRank,
  getNextSupportRank,
  getSupportPairDefinition,
  getSupportRankIndex,
} from '../data/supports/supportMatrix';
import {
  buildKecleonShopState,
  buildSkirmishSpawnState,
  createPrologueOverworldNodes,
  createUnlockedAllOverworldNodes,
  ensureOverworldGraphState,
  rollPostBattleOverworldSpawns,
  type PostBattleSpawnResult,
} from '../engine/overworldEngine';
import { buildRosterActorLookup, resolveSupportActorIdForRosterUnit } from '../engine/supportEngine';
import type {
  ConvoyEntry,
  ItemDefinition,
  KecleonShopType,
  SaveData,
  StatBlockSeven,
  SupportPairProgress,
  SupportRank,
  UnitCosmeticForm,
} from '../types/schemas';
import { returnItemToConvoyList, sanitizeNickname } from './saveHelpersAndFactory';

// ---------------------------------------------------------------------------
// Campaign Flag & Field Notes Mutators
// ---------------------------------------------------------------------------

export function pushUniqueIdToFlagList(
  list: string[] | undefined,
  rawId: string
): { nextList: string[]; mutated: boolean } {
  const trimmed = rawId.trim();
  const base = Array.isArray(list) ? list : [];
  if (!trimmed || base.includes(trimmed)) {
    return { nextList: base, mutated: false };
  }
  base.push(trimmed);
  return { nextList: base, mutated: true };
}

export function readAreTutorialsEnabled(save: SaveData | null): boolean {
  if (!save) return false;
  return Boolean(save.campaign.tutorialsEnabled);
}

export function readUnlockedTutorialIds(save: SaveData | null): string[] {
  if (!save) return [];
  const combined = new Set<string>([
    ...(save.campaign.unlockedTutorialIds ?? []),
    ...(save.campaign.seenTutorialIds ?? []),
  ]);
  return [...combined];
}

export function mutateMarkTutorialSeen(save: SaveData, topicId: string): boolean {
  const trimmed = topicId.trim();
  if (!trimmed) return false;
  if (!Array.isArray(save.campaign.unlockedTutorialIds)) {
    save.campaign.unlockedTutorialIds = [];
  }
  if (!Array.isArray(save.campaign.seenTutorialIds)) {
    save.campaign.seenTutorialIds = [];
  }
  let mutated = false;
  if (!save.campaign.unlockedTutorialIds.includes(trimmed)) {
    save.campaign.unlockedTutorialIds.push(trimmed);
    mutated = true;
  }
  if (!save.campaign.seenTutorialIds.includes(trimmed)) {
    save.campaign.seenTutorialIds.push(trimmed);
    mutated = true;
  }
  return mutated;
}

// ---------------------------------------------------------------------------
// Overworld Graph, Kecleon Shop & Skirmish Mutators
// ---------------------------------------------------------------------------

export function mutateEnsureOverworldInitialized(
  save: SaveData,
  graph: OverworldGraphDefinition = DEMO_OVERWORLD_GRAPH
): boolean {
  const reconciled = ensureOverworldGraphState(save, graph);
  if (reconciled.mutated) {
    save.overworld = {
      currentNodeId: reconciled.currentNodeId,
      nodes: reconciled.nodes,
    };
    return true;
  }
  return false;
}

export function mutateSetOverworldNodeStateCheat(
  save: SaveData,
  nodeId: string,
  patch: {
    unlocked?: boolean;
    cleared?: boolean;
    activeKecleonShop?: SaveData['overworld']['nodes'][string]['activeKecleonShop'];
    activeSkirmish?: SaveData['overworld']['nodes'][string]['activeSkirmish'];
  },
  graph: OverworldGraphDefinition = DEMO_OVERWORLD_GRAPH
): void {
  const reconciled = ensureOverworldGraphState(save, graph);
  const target = reconciled.nodes[nodeId];
  if (!target) throw new Error(`Unknown Overworld node "${nodeId}".`);

  if (patch.unlocked !== undefined) {
    target.unlocked = patch.unlocked;
    if (!patch.unlocked) {
      target.cleared = false;
      target.activeKecleonShop = null;
      target.activeSkirmish = null;
    }
  }
  if (patch.cleared !== undefined) {
    target.cleared = patch.cleared;
    if (patch.cleared) {
      target.unlocked = true;
      if (!save.campaign.completedChapterIds.includes(nodeId)) {
        save.campaign.completedChapterIds.push(nodeId);
      }
    } else {
      save.campaign.completedChapterIds = save.campaign.completedChapterIds.filter(
        (id) => id !== nodeId
      );
    }
  }
  if (patch.activeKecleonShop !== undefined) {
    target.activeKecleonShop = patch.activeKecleonShop;
    if (patch.activeKecleonShop) {
      save.campaign.kecleonShopsUnlocked = true;
    }
  }
  if (patch.activeSkirmish !== undefined) {
    target.activeSkirmish = patch.activeSkirmish;
  }

  save.overworld = {
    currentNodeId: reconciled.nodes[reconciled.currentNodeId]?.unlocked
      ? reconciled.currentNodeId
      : graph.startNodeId,
    nodes: reconciled.nodes,
  };
}

export function mutateResetOverworldToPrologue(
  save: SaveData,
  graph: OverworldGraphDefinition = DEMO_OVERWORLD_GRAPH
): void {
  save.campaign.completedChapterIds = [];
  save.campaign.kecleonShopsUnlocked = false;
  save.campaign.currentChapterId = graph.startNodeId;
  save.overworld = {
    currentNodeId: graph.startNodeId,
    nodes: createPrologueOverworldNodes(graph),
  };
}

export function mutateUnlockAllOverworldNodes(
  save: SaveData,
  graph: OverworldGraphDefinition = DEMO_OVERWORLD_GRAPH
): void {
  const nodes = createUnlockedAllOverworldNodes(graph, save.overworld?.nodes);
  const current =
    save.overworld?.currentNodeId && nodes[save.overworld.currentNodeId]
      ? save.overworld.currentNodeId
      : graph.startNodeId;
  save.campaign.kecleonShopsUnlocked = true;
  save.overworld = { currentNodeId: current, nodes };
}

export function mutateSetOverworldCurrentNode(
  save: SaveData,
  nodeId: string,
  graph: OverworldGraphDefinition = DEMO_OVERWORLD_GRAPH
): void {
  const reconciled = ensureOverworldGraphState(save, graph);
  const target = reconciled.nodes[nodeId];
  if (!target || !target.unlocked) {
    throw new Error(`Overworld node "${nodeId}" is locked or does not exist.`);
  }
  save.overworld = { currentNodeId: nodeId, nodes: reconciled.nodes };
}

export function mutateSpawnOverworldKecleonShop(
  save: SaveData,
  nodeId: string,
  shopType?: KecleonShopType,
  rng: () => number = Math.random,
  graph: OverworldGraphDefinition = DEMO_OVERWORLD_GRAPH
): void {
  const reconciled = ensureOverworldGraphState(save, graph);
  const nodeState = reconciled.nodes[nodeId];
  if (!nodeState || !nodeState.unlocked) {
    throw new Error(`Cannot spawn a Kecleon Shop on locked node "${nodeId}".`);
  }
  nodeState.activeKecleonShop = buildKecleonShopState(shopType, rng, {
    completedChapterIds: save.campaign.completedChapterIds,
  });
  save.campaign.kecleonShopsUnlocked = true;
  save.overworld = { currentNodeId: reconciled.currentNodeId, nodes: reconciled.nodes };
}

export function mutateSpawnOverworldSkirmish(
  save: SaveData,
  nodeId: string,
  recommendedLevel?: number,
  tilesetId?: string,
  graph: OverworldGraphDefinition = DEMO_OVERWORLD_GRAPH
): void {
  const reconciled = ensureOverworldGraphState(save, graph);
  const def = getOverworldNodeById(nodeId, graph);
  const nodeState = reconciled.nodes[nodeId];
  if (!def || !nodeState || !nodeState.unlocked) {
    throw new Error(`Cannot spawn a Feral Skirmish on locked node "${nodeId}".`);
  }
  nodeState.activeSkirmish = buildSkirmishSpawnState(def, { recommendedLevel, tilesetId });
  save.overworld = { currentNodeId: reconciled.currentNodeId, nodes: reconciled.nodes };
}

export function mutateClearOverworldSkirmish(
  save: SaveData,
  nodeId: string,
  goldBounty = 0,
  graph: OverworldGraphDefinition = DEMO_OVERWORLD_GRAPH
): void {
  const reconciled = ensureOverworldGraphState(save, graph);
  const nodeState = reconciled.nodes[nodeId];
  if (nodeState) nodeState.activeSkirmish = null;
  if (goldBounty > 0) save.gold += Math.floor(goldBounty);
  save.overworld = { currentNodeId: reconciled.currentNodeId, nodes: reconciled.nodes };
}

export function mutateCompleteOverworldChapter(
  save: SaveData,
  nodeId: string,
  opts?: {
    rng?: () => number;
    graph?: OverworldGraphDefinition;
    skirmishChance?: number;
    shopChance?: number;
  }
): { firstClear: boolean; spawns: PostBattleSpawnResult } {
  const graph = opts?.graph ?? DEMO_OVERWORLD_GRAPH;
  const reconciled = ensureOverworldGraphState(save, graph);
  const def = getOverworldNodeById(nodeId, graph);
  const nodeState = reconciled.nodes[nodeId];
  if (!def || !nodeState) throw new Error(`Unknown Overworld node "${nodeId}".`);

  const firstClear = !nodeState.cleared && !save.campaign.completedChapterIds.includes(nodeId);
  nodeState.unlocked = true;
  nodeState.cleared = true;
  if (!save.campaign.completedChapterIds.includes(nodeId)) {
    save.campaign.completedChapterIds.push(nodeId);
  }
  if (def.unlocksKecleonShopsOnClear) {
    save.campaign.kecleonShopsUnlocked = true;
  }
  if (firstClear && def.clearGoldReward > 0) {
    save.gold += def.clearGoldReward;
  }

  for (const nextId of def.unlocksNodeIdsOnClear) {
    const nextState = reconciled.nodes[nextId];
    if (nextState) nextState.unlocked = true;
  }

  const nextStory = graph.nodes.find(
    (n) => n.kind === 'story' && reconciled.nodes[n.id]?.unlocked && !reconciled.nodes[n.id]?.cleared
  );
  if (nextStory) {
    save.campaign.currentChapterId = nextStory.id;
  }

  const spawns = rollPostBattleOverworldSpawns(reconciled.nodes, graph, {
    justClearedNodeId: nodeId,
    kecleonShopsUnlocked: save.campaign.kecleonShopsUnlocked,
    completedChapterIds: save.campaign.completedChapterIds,
    campaignMode: save.campaign.campaignMode,
    skirmishesUnlocked: save.campaign.skirmishesUnlocked,
    skirmishChance: opts?.skirmishChance,
    shopChance: opts?.shopChance,
    rng: opts?.rng,
  });

  save.overworld = { currentNodeId: nodeId, nodes: reconciled.nodes };
  return { firstClear, spawns };
}

export function mutateBuyKecleonShopItem(
  save: SaveData,
  nodeId: string,
  itemId: string,
  graph: OverworldGraphDefinition = DEMO_OVERWORLD_GRAPH
): { item: ItemDefinition; remainingStock: number } {
  const reconciled = ensureOverworldGraphState(save, graph);
  const nodeState = reconciled.nodes[nodeId];
  const shop = nodeState?.activeKecleonShop;
  if (!nodeState || !shop) {
    throw new Error('No Kecleon Shop is currently active at this location.');
  }

  const stockIndex = shop.inventoryItemIds.indexOf(itemId);
  if (stockIndex === -1) {
    throw new Error('That item is out of stock at this Kecleon stall.');
  }

  const item = ITEM_MAP.get(itemId);
  if (!item || item.buyPrice === null) {
    throw new Error(`Item "${itemId}" cannot be purchased.`);
  }
  if (save.gold < item.buyPrice) {
    throw new Error(`Not enough Gold! Need ${item.buyPrice}G (have ${save.gold}G).`);
  }

  save.gold -= item.buyPrice;
  returnItemToConvoyList(save.convoy, item.id);
  shop.inventoryItemIds.splice(stockIndex, 1);
  const remainingStock = shop.inventoryItemIds.length;
  if (remainingStock === 0) {
    nodeState.activeKecleonShop = null;
  }

  save.overworld = { currentNodeId: reconciled.currentNodeId, nodes: reconciled.nodes };
  return { item, remainingStock };
}

// ---------------------------------------------------------------------------
// Support Matrix & Post-Battle Commit Mutators
// ---------------------------------------------------------------------------

export interface BattleUnitSaveSyncEntry extends EquippedMoveSlots {
  instanceId: string;
  speciesId: string;
  nickname: string;
  cosmeticForm?: UnitCosmeticForm;
  level: number;
  exp: number;
  currentStats: StatBlockSeven;
  unlockedMoveIds: string[];
  activeMoveIds: string[];
  heldItemId: string | null;
  consumableItemId: string | null;
}

export interface CommitBattleResultsPayload {
  deployedUnits: ReadonlyArray<BattleUnitSaveSyncEntry>;
  droppedItemIds?: ReadonlyArray<string>;
  clearRewardItems?: ReadonlyArray<ConvoyEntry>;
  bonusGold?: number;
  battleSupports?: Readonly<Record<string, SupportPairProgress>>;
}

function resolveActorIdInput(save: SaveData, idOrActor: string): string {
  const unit = save.roster.find((u) => u.instanceId === idOrActor);
  if (!unit) return idOrActor;
  return resolveSupportActorIdForRosterUnit(unit, save) ?? idOrActor;
}

export function mutateUnlockSupportRank(
  save: SaveData,
  actorIdA: string,
  actorIdB: string,
  rank: SupportRank
): SupportPairProgress {
  const actorA = resolveActorIdInput(save, actorIdA);
  const actorB = resolveActorIdInput(save, actorIdB);
  const pairDef = getSupportPairDefinition(actorA, actorB);
  if (!pairDef) {
    throw new Error(`No Support pairing defined between "${actorA}" and "${actorB}".`);
  }
  if (getSupportRankIndex(rank) > getSupportRankIndex(pairDef.maxRank)) {
    throw new Error(`Support rank "${rank}" exceeds max rank "${pairDef.maxRank}" for "${pairDef.pairKey}".`);
  }
  const prev = save.supports[pairDef.pairKey] ?? { points: 0, unlockedRank: null };
  const unlockedRank = getMaxSupportRank(prev.unlockedRank ?? null, rank) ?? rank;
  const points = clampSupportPointsForUnlockedRank(
    Math.max(prev.points, SUPPORT_RANK_THRESHOLDS[rank]),
    unlockedRank,
    pairDef.maxRank
  );
  const progress: SupportPairProgress = { points, unlockedRank };
  save.supports[pairDef.pairKey] = progress;
  return { ...progress };
}

export function mutateReadyNextSupportRanksForCheat(
  save: SaveData,
  filterActorId?: string
): number {
  if (!save.campaign.completedChapterIds.includes(SUPPORT_UNLOCK_REQUIRED_CHAPTER_ID)) {
    save.campaign.completedChapterIds.push(SUPPORT_UNLOCK_REQUIRED_CHAPTER_ID);
  }
  const rosterActors = buildRosterActorLookup(save);
  let readied = 0;
  for (const def of SUPPORT_PAIR_DEFINITIONS) {
    if (!rosterActors.has(def.actorA) || !rosterActors.has(def.actorB)) continue;
    if (filterActorId && def.actorA !== filterActorId && def.actorB !== filterActorId) continue;
    const prev = save.supports[def.pairKey] ?? { points: 0, unlockedRank: null };
    const nextRank = getNextSupportRank(prev.unlockedRank ?? null, def.maxRank);
    if (!nextRank) continue;
    const targetPts = SUPPORT_RANK_THRESHOLDS[nextRank];
    const nextPts = clampSupportPointsForUnlockedRank(
      Math.max(prev.points, targetPts),
      prev.unlockedRank ?? null,
      def.maxRank
    );
    save.supports[def.pairKey] = {
      points: nextPts,
      unlockedRank: prev.unlockedRank ?? null,
    };
    readied += 1;
  }
  return readied;
}

export function mutateCommitBattleResults(
  save: SaveData,
  payload: CommitBattleResultsPayload
): void {
  const byId = new Map(save.roster.map((u) => [u.instanceId, u]));

  for (const syncUnit of payload.deployedUnits) {
    const owned = byId.get(syncUnit.instanceId);
    if (!owned) continue;
    const sp = SPECIES_MAP.get(syncUnit.speciesId);
    if (!sp || sp.faction === 'enemy' || sp.faction === 'ally_npc') continue;

    owned.speciesId = sp.id;
    owned.nickname = sanitizeNickname(syncUnit.nickname, sp.name);
    if (syncUnit.cosmeticForm !== undefined) {
      owned.cosmeticForm = syncUnit.cosmeticForm;
    }
    owned.level = Math.max(MIN_UNIT_LEVEL, Math.min(MAX_UNIT_LEVEL, Math.floor(syncUnit.level)));
    owned.exp = owned.level >= MAX_UNIT_LEVEL ? 0 : Math.max(0, Math.min(99, Math.floor(syncUnit.exp)));
    owned.currentStats = { ...syncUnit.currentStats };

    for (const mId of syncUnit.unlockedMoveIds) {
      if (MOVE_MAP.has(mId) && !owned.unlockedMoveIds.includes(mId)) {
        owned.unlockedMoveIds.push(mId);
      }
    }

    const validActive = syncUnit.activeMoveIds
      .filter((mId) => MOVE_MAP.has(mId) && owned.unlockedMoveIds.includes(mId))
      .slice(0, 4);
    if (validActive.length > 0) owned.activeMoveIds = validActive;

    owned.equippedPhysicalMoveId = syncUnit.equippedPhysicalMoveId;
    owned.equippedSpecialMoveId = syncUnit.equippedSpecialMoveId;
    reconcileEquippedMoves(owned, owned.activeMoveIds, { fillEmpty: false });

    if (syncUnit.heldItemId && ITEM_MAP.get(syncUnit.heldItemId)?.equipSlot === 'held') {
      owned.heldItemId = syncUnit.heldItemId;
      owned.consumableItemId = null;
    } else if (
      syncUnit.consumableItemId &&
      ITEM_MAP.get(syncUnit.consumableItemId)?.equipSlot === 'consumable'
    ) {
      owned.consumableItemId = syncUnit.consumableItemId;
      owned.heldItemId = null;
    } else {
      owned.heldItemId = null;
      owned.consumableItemId = null;
    }
  }

  if (payload.droppedItemIds) {
    for (const itemId of payload.droppedItemIds) {
      if (ITEM_MAP.has(itemId)) returnItemToConvoyList(save.convoy, itemId);
    }
  }

  if (payload.clearRewardItems) {
    for (const reward of payload.clearRewardItems) {
      if (ITEM_MAP.has(reward.itemId) && reward.quantity > 0) {
        for (let i = 0; i < reward.quantity; i++) {
          returnItemToConvoyList(save.convoy, reward.itemId);
        }
      }
    }
  }

  if (payload.bonusGold && payload.bonusGold > 0) {
    save.gold = Math.max(0, Math.floor(save.gold + payload.bonusGold));
  }

  if (payload.battleSupports) {
    for (const [pairKey, battleEntry] of Object.entries(payload.battleSupports)) {
      if (!battleEntry) continue;
      const parts = pairKey.split('::');
      if (parts.length !== 2) continue;
      const pairDef = getSupportPairDefinition(parts[0], parts[1]);
      if (!pairDef) continue;
      const existing = save.supports[pairDef.pairKey] ?? { points: 0, unlockedRank: null };
      const unlockedRank = getMaxSupportRank(
        existing.unlockedRank ?? null,
        battleEntry.unlockedRank ?? null
      );
      const points = clampSupportPointsForUnlockedRank(
        Math.max(existing.points, battleEntry.points ?? 0),
        unlockedRank,
        pairDef.maxRank
      );
      save.supports[pairDef.pairKey] = { points, unlockedRank };
    }
  }
}
