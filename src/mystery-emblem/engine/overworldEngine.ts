/**
 * Mystery Emblem — Overworld Traversal, Pathfinding & Event Spawner Engine
 *
 * Handles:
 * - Multi-waypoint road Dijkstra pathfinding across unlocked continent nodes
 * - Constant-speed polyline interpolation + 8-directional PMD facing (`directionFromDelta`)
 * - Awakening-style Feral Skirmish spawner (occasional spawns on cleared nodes; one-shot clear)
 * - Random 4-type Kecleon Shop spawner (`tm_shop`, `held_shop`, `healing_shop`, `x_item_shop`)
 */

import { directionFromDelta, type PmdDirection } from '../assets/pmdAssetLoader';
import {
  ALL_KECLEON_SHOP_TYPES,
  DEMO_OVERWORLD_GRAPH,
  buildKecleonShopInventory,
  getOverworldNodeById,
  type OverworldEdgeDefinition,
  type OverworldGraphDefinition,
  type OverworldNodeDefinition,
  type OverworldPoint,
} from '../data/overworldMapData';
import type {
  KecleonShopSpawnState,
  KecleonShopType,
  OverworldNodeState,
  SaveData,
  SkirmishSpawnState,
} from '../types/schemas';

export interface OverworldRouteResult {
  reachable: boolean;
  nodePath: string[];
  edgeIds: string[];
  points: OverworldPoint[];
  totalDistancePx: number;
}

export interface PolylineSample {
  x: number;
  y: number;
  direction: PmdDirection;
  totalDistancePx: number;
  clampedDistancePx: number;
  progress01: number;
  completed: boolean;
}

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

  // Prune any obsolete legacy node IDs not in the active graph
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

export function getEdgePointsOrdered(
  edge: OverworldEdgeDefinition,
  fromNode: OverworldNodeDefinition,
  toNode: OverworldNodeDefinition
): OverworldPoint[] {
  const forward = edge.fromNodeId === fromNode.id && edge.toNodeId === toNode.id;
  const mids = forward ? edge.waypoints : [...edge.waypoints].reverse();
  return [
    { x: fromNode.x, y: fromNode.y },
    ...mids.map((pt) => ({ x: pt.x, y: pt.y })),
    { x: toNode.x, y: toNode.y },
  ];
}

export function computePolylineLength(points: ReadonlyArray<OverworldPoint>): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1]!;
    const cur = points[i]!;
    total += Math.hypot(cur.x - prev.x, cur.y - prev.y);
  }
  return total;
}

export function findOverworldRoute(
  graph: OverworldGraphDefinition,
  nodeStates: Record<string, OverworldNodeState>,
  fromNodeId: string,
  toNodeId: string
): OverworldRouteResult {
  const nodeMap = new Map<string, OverworldNodeDefinition>();
  for (const n of graph.nodes) {
    nodeMap.set(n.id, n);
  }

  const startDef = nodeMap.get(fromNodeId);
  const goalDef = nodeMap.get(toNodeId);
  if (!startDef || !goalDef) {
    return { reachable: false, nodePath: [], edgeIds: [], points: [], totalDistancePx: 0 };
  }
  if (nodeStates[fromNodeId]?.unlocked === false || nodeStates[toNodeId]?.unlocked === false) {
    return { reachable: false, nodePath: [], edgeIds: [], points: [], totalDistancePx: 0 };
  }

  if (fromNodeId === toNodeId) {
    return {
      reachable: true,
      nodePath: [fromNodeId],
      edgeIds: [],
      points: [{ x: startDef.x, y: startDef.y }],
      totalDistancePx: 0,
    };
  }

  interface NeighborStep {
    neighborId: string;
    edge: OverworldEdgeDefinition;
    distance: number;
    points: OverworldPoint[];
  }

  const adjacency = new Map<string, NeighborStep[]>();
  for (const edge of graph.edges) {
    const a = nodeMap.get(edge.fromNodeId);
    const b = nodeMap.get(edge.toNodeId);
    if (!a || !b) continue;
    if (nodeStates[a.id]?.unlocked === false || nodeStates[b.id]?.unlocked === false) {
      continue;
    }

    const forwardPts = getEdgePointsOrdered(edge, a, b);
    const dist = Math.max(1, computePolylineLength(forwardPts));
    const reversePts = getEdgePointsOrdered(edge, b, a);

    const listA = adjacency.get(a.id) ?? [];
    listA.push({ neighborId: b.id, edge, distance: dist, points: forwardPts });
    adjacency.set(a.id, listA);

    const listB = adjacency.get(b.id) ?? [];
    listB.push({ neighborId: a.id, edge, distance: dist, points: reversePts });
    adjacency.set(b.id, listB);
  }

  const distByNode = new Map<string, number>();
  const prevByNode = new Map<
    string,
    { prevNodeId: string; edgeId: string; points: OverworldPoint[] }
  >();
  const visited = new Set<string>();

  distByNode.set(fromNodeId, 0);

  while (true) {
    let currentId: string | null = null;
    let bestDist = Infinity;
    for (const [id, d] of distByNode.entries()) {
      if (!visited.has(id) && d < bestDist) {
        bestDist = d;
        currentId = id;
      }
    }

    if (currentId === null) break;
    if (currentId === toNodeId) break;
    visited.add(currentId);

    const neighbors = adjacency.get(currentId) ?? [];
    for (const step of neighbors) {
      if (visited.has(step.neighborId)) continue;
      const alt = bestDist + step.distance;
      const prevBest = distByNode.get(step.neighborId) ?? Infinity;
      if (alt < prevBest) {
        distByNode.set(step.neighborId, alt);
        prevByNode.set(step.neighborId, {
          prevNodeId: currentId,
          edgeId: step.edge.id,
          points: step.points,
        });
      }
    }
  }

  if (!prevByNode.has(toNodeId)) {
    return { reachable: false, nodePath: [], edgeIds: [], points: [], totalDistancePx: 0 };
  }

  const nodePath: string[] = [toNodeId];
  const edgeIds: string[] = [];
  const edgePointChains: OverworldPoint[][] = [];

  let cursor = toNodeId;
  while (cursor !== fromNodeId) {
    const step = prevByNode.get(cursor);
    if (!step) break;
    nodePath.push(step.prevNodeId);
    edgeIds.push(step.edgeId);
    edgePointChains.push(step.points);
    cursor = step.prevNodeId;
  }

  nodePath.reverse();
  edgeIds.reverse();
  edgePointChains.reverse();

  const mergedPoints: OverworldPoint[] = [];
  for (const chain of edgePointChains) {
    for (const pt of chain) {
      const last = mergedPoints[mergedPoints.length - 1];
      if (!last || Math.hypot(pt.x - last.x, pt.y - last.y) > 0.01) {
        mergedPoints.push({ x: pt.x, y: pt.y });
      }
    }
  }

  const totalDistancePx = computePolylineLength(mergedPoints);
  return {
    reachable: true,
    nodePath,
    edgeIds,
    points: mergedPoints,
    totalDistancePx,
  };
}

export function samplePolylineAtDistance(
  points: ReadonlyArray<OverworldPoint>,
  distancePx: number,
  fallbackDirection: PmdDirection = 0
): PolylineSample {
  if (points.length === 0) {
    return {
      x: 0,
      y: 0,
      direction: fallbackDirection,
      totalDistancePx: 0,
      clampedDistancePx: 0,
      progress01: 1,
      completed: true,
    };
  }
  if (points.length === 1) {
    return {
      x: points[0]!.x,
      y: points[0]!.y,
      direction: fallbackDirection,
      totalDistancePx: 0,
      clampedDistancePx: 0,
      progress01: 1,
      completed: true,
    };
  }

  const totalDistancePx = computePolylineLength(points);
  if (totalDistancePx <= 0.001) {
    const end = points[points.length - 1]!;
    return {
      x: end.x,
      y: end.y,
      direction: fallbackDirection,
      totalDistancePx: 0,
      clampedDistancePx: 0,
      progress01: 1,
      completed: true,
    };
  }

  const clamped = Math.max(0, Math.min(totalDistancePx, distancePx));
  let walked = 0;
  let lastValidDir = fallbackDirection;

  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!;
    const b = points[i]!;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const segLen = Math.hypot(dx, dy);
    if (segLen <= 0.0001) continue;

    lastValidDir = directionFromDelta(dx, dy);
    if (walked + segLen >= clamped || i === points.length - 1) {
      const localT = Math.max(0, Math.min(1, (clamped - walked) / segLen));
      return {
        x: a.x + dx * localT,
        y: a.y + dy * localT,
        direction: lastValidDir,
        totalDistancePx,
        clampedDistancePx: clamped,
        progress01: clamped / totalDistancePx,
        completed: clamped >= totalDistancePx - 0.0001,
      };
    }
    walked += segLen;
  }

  const finalPt = points[points.length - 1]!;
  return {
    x: finalPt.x,
    y: finalPt.y,
    direction: lastValidDir,
    totalDistancePx,
    clampedDistancePx: totalDistancePx,
    progress01: 1,
    completed: true,
  };
}

export function buildKecleonShopState(
  shopType?: KecleonShopType,
  rng: () => number = Math.random
): KecleonShopSpawnState {
  const resolvedType =
    shopType ??
    ALL_KECLEON_SHOP_TYPES[
      Math.floor(rng() * ALL_KECLEON_SHOP_TYPES.length) % ALL_KECLEON_SHOP_TYPES.length
    ]!;
  return {
    shopType: resolvedType,
    inventoryItemIds: buildKecleonShopInventory(resolvedType, rng),
  };
}

export function buildSkirmishSpawnState(
  node: OverworldNodeDefinition,
  overrides?: {
    recommendedLevel?: number;
    tilesetId?: string;
    spawnedAtTimestamp?: number;
  }
): SkirmishSpawnState {
  return {
    spawnedAtTimestamp: overrides?.spawnedAtTimestamp ?? Date.now(),
    recommendedLevel: Math.max(
      1,
      Math.min(40, Math.floor(overrides?.recommendedLevel ?? node.recommendedLevel))
    ),
    tilesetId: overrides?.tilesetId ?? node.tilesetId,
  };
}

export interface PostBattleSpawnOptions {
  justClearedNodeId?: string;
  kecleonShopsUnlocked: boolean;
  skirmishChance?: number;
  maxActiveSkirmishes?: number;
  shopChance?: number;
  maxActiveShops?: number;
  rng?: () => number;
  nowTimestamp?: number;
}

export interface PostBattleSpawnResult {
  spawnedSkirmishNodeId: string | null;
  spawnedShopNodeId: string | null;
  spawnedShopType: KecleonShopType | null;
}

export function rollPostBattleOverworldSpawns(
  nodes: Record<string, OverworldNodeState>,
  graph: OverworldGraphDefinition = DEMO_OVERWORLD_GRAPH,
  options: PostBattleSpawnOptions
): PostBattleSpawnResult {
  const rng = options.rng ?? Math.random;
  const nowTimestamp = options.nowTimestamp ?? Date.now();
  const skirmishChance = options.skirmishChance ?? 0.35;
  const maxActiveSkirmishes = options.maxActiveSkirmishes ?? 2;
  const shopChance = options.shopChance ?? 0.55;
  const maxActiveShops = options.maxActiveShops ?? 2;

  let spawnedSkirmishNodeId: string | null = null;
  let spawnedShopNodeId: string | null = null;
  let spawnedShopType: KecleonShopType | null = null;

  const clearedDefs = graph.nodes.filter((def) => nodes[def.id]?.unlocked && nodes[def.id]?.cleared);

  const activeSkirmishCount = clearedDefs.filter((def) => Boolean(nodes[def.id]?.activeSkirmish)).length;
  if (activeSkirmishCount < maxActiveSkirmishes && clearedDefs.length > 0 && rng() < skirmishChance) {
    const preferred = clearedDefs.filter(
      (def) => !nodes[def.id]?.activeSkirmish && def.id !== options.justClearedNodeId
    );
    const pool =
      preferred.length > 0
        ? preferred
        : clearedDefs.filter((def) => !nodes[def.id]?.activeSkirmish);

    if (pool.length > 0) {
      const picked = pool[Math.floor(rng() * pool.length) % pool.length]!;
      nodes[picked.id]!.activeSkirmish = buildSkirmishSpawnState(picked, {
        spawnedAtTimestamp: nowTimestamp,
      });
      spawnedSkirmishNodeId = picked.id;
    }
  }

  if (options.kecleonShopsUnlocked && clearedDefs.length > 0) {
    const activeShopCount = clearedDefs.filter((def) => Boolean(nodes[def.id]?.activeKecleonShop)).length;
    if (activeShopCount < maxActiveShops && rng() < shopChance) {
      const candidates = clearedDefs.filter((def) => !nodes[def.id]?.activeKecleonShop);
      if (candidates.length > 0) {
        const picked = candidates[Math.floor(rng() * candidates.length) % candidates.length]!;
        const shopState = buildKecleonShopState(undefined, rng);
        nodes[picked.id]!.activeKecleonShop = shopState;
        spawnedShopNodeId = picked.id;
        spawnedShopType = shopState.shopType;
      }
    }
  }

  return {
    spawnedSkirmishNodeId,
    spawnedShopNodeId,
    spawnedShopType,
  };
}
