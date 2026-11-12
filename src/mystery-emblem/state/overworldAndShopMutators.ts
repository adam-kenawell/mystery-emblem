/**
 * Mystery Emblem - Overworld Graph, Kecleon Shop & Skirmish Save Mutators
 */

import { ITEM_MAP } from '../data/index';
import {
  DEMO_OVERWORLD_GRAPH,
  getOverworldNodeById,
  type OverworldGraphDefinition,
} from '../data/overworldMapData';
import {
  buildKecleonShopState,
  buildSkirmishSpawnState,
  createPrologueOverworldNodes,
  createUnlockedAllOverworldNodes,
  ensureOverworldGraphState,
  rollPostBattleOverworldSpawns,
  type PostBattleSpawnResult,
} from '../engine/overworldEngine';
import type { ItemDefinition, KecleonShopType, SaveData } from '../types/schemas';
import { returnItemToConvoyList } from './saveHelpersAndFactory';

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
