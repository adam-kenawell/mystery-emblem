/**
 * Mystery Emblem — Overworld Multi-Waypoint Road Dijkstra & Polyline Sampler
 */

import { directionFromDelta, type PmdDirection } from '../../assets/pmdAssetLoader';
import type {
  OverworldEdgeDefinition,
  OverworldGraphDefinition,
  OverworldNodeDefinition,
  OverworldPoint,
} from '../../data/overworldMapData';
import type { OverworldNodeState } from '../../types/schemas';

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

    if (currentId === null || currentId === toNodeId) break;
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
