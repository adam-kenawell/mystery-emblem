/**
 * Mystery Emblem — Overworld Graph State & Unlock Synchronization
 */

import {
  DEMO_OVERWORLD_GRAPH,
  getOverworldNodeById,
  type OverworldGraphDefinition,
} from '../../data/overworldMapData';
import type { OverworldNodeState, SaveData } from '../../types/schemas';

export function cloneOverworldNodesMap(
  nodes: Record<string, OverworldNodeState>
): Record<string, OverworldNodeState> {
  const out: Record<string, OverworldNodeState> = {};
  for (const [id, st] of Object.entries(nodes)) {
    out[id] = {
      nodeId: st.nodeId,
      unlocked: Boolean(st.unlocked),
      cleared: Boolean(st.cleared),
      activeSkirmish: st.activeSkirmish
        ? {
            spawnedAtTimestamp: st.activeSkirmish.spawnedAtTimestamp,
            recommendedLevel: st.activeSkirmish.recommendedLevel,
            tilesetId: st.activeSkirmish.tilesetId,
          }
        : null,
      activeKecleonShop: st.activeKecleonShop
        ? {
            shopType: st.activeKecleonShop.shopType,
            inventoryItemIds: [...st.activeKecleonShop.inventoryItemIds],
          }
        : null,
    };
  }
  return out;
}

export function createPrologueOverworldNodes(
  graph: OverworldGraphDefinition = DEMO_OVERWORLD_GRAPH
): Record<string, OverworldNodeState> {
  const nodes: Record<string, OverworldNodeState> = {};
  for (const def of graph.nodes) {
    nodes[def.id] = {
      nodeId: def.id,
      unlocked: Boolean(def.initiallyUnlocked || def.id === graph.startNodeId),
      cleared: false,
      activeSkirmish: null,
      activeKecleonShop: null,
    };
  }
  return nodes;
}

export function createUnlockedAllOverworldNodes(
  graph: OverworldGraphDefinition = DEMO_OVERWORLD_GRAPH,
  existingNodes?: Record<string, OverworldNodeState>
): Record<string, OverworldNodeState> {
  const nodes: Record<string, OverworldNodeState> = {};
  for (const def of graph.nodes) {
    const prev = existingNodes?.[def.id];
    nodes[def.id] = {
      nodeId: def.id,
      unlocked: true,
      cleared: Boolean(prev?.cleared),
      activeSkirmish: prev?.activeSkirmish ? { ...prev.activeSkirmish } : null,
      activeKecleonShop: prev?.activeKecleonShop
        ? {
            shopType: prev.activeKecleonShop.shopType,
            inventoryItemIds: [...prev.activeKecleonShop.inventoryItemIds],
          }
        : null,
    };
  }
  return nodes;
}

export function ensureOverworldGraphState(
  save: Pick<SaveData, 'overworld' | 'campaign'>,
  graph: OverworldGraphDefinition = DEMO_OVERWORLD_GRAPH
): {
  currentNodeId: string;
  nodes: Record<string, OverworldNodeState>;
  mutated: boolean;
} {
  const completedSet = new Set(save.campaign.completedChapterIds ?? []);
  const nextNodes = cloneOverworldNodesMap(save.overworld?.nodes ?? {});
  let mutated = false;

  const validNodeIds = new Set(graph.nodes.map((n) => n.id));
  for (const existingKey of Object.keys(nextNodes)) {
    if (!validNodeIds.has(existingKey)) {
      delete nextNodes[existingKey];
      mutated = true;
    }
  }

  for (const def of graph.nodes) {
    const existing = nextNodes[def.id];
    const completed = completedSet.has(def.id);
    const shouldStartUnlocked =
      Boolean(def.initiallyUnlocked) || def.id === graph.startNodeId || completed;

    if (!existing) {
      nextNodes[def.id] = {
        nodeId: def.id,
        unlocked: shouldStartUnlocked,
        cleared: completed,
        activeSkirmish: null,
        activeKecleonShop: null,
      };
      mutated = true;
    } else {
      if (completed && (!existing.unlocked || !existing.cleared)) {
        existing.unlocked = true;
        existing.cleared = true;
        mutated = true;
      } else if (shouldStartUnlocked && !existing.unlocked) {
        existing.unlocked = true;
        mutated = true;
      }
    }
  }

  for (const def of graph.nodes) {
    if (nextNodes[def.id]?.cleared) {
      for (const targetId of def.unlocksNodeIdsOnClear) {
        const targetState = nextNodes[targetId];
        if (targetState && !targetState.unlocked) {
          targetState.unlocked = true;
          mutated = true;
        }
      }
    }
  }

  let currentNodeId = save.overworld?.currentNodeId ?? graph.startNodeId;
  const currentDef = getOverworldNodeById(currentNodeId, graph);
  if (!currentDef || !nextNodes[currentNodeId]?.unlocked) {
    const fallbackUnlocked =
      graph.nodes.find((n) => nextNodes[n.id]?.unlocked)?.id ?? graph.startNodeId;
    if (nextNodes[fallbackUnlocked] && !nextNodes[fallbackUnlocked]!.unlocked) {
      nextNodes[fallbackUnlocked]!.unlocked = true;
    }
    currentNodeId = fallbackUnlocked;
    mutated = true;
  }

  return { currentNodeId, nodes: nextNodes, mutated };
}
