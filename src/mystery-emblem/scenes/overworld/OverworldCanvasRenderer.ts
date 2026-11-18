/**
 * Mystery Emblem - Crisp Pixel-Art Overworld Canvas Renderer (`OverworldCanvasRenderer.ts`)
 */

import type {
  LoadedSpriteBundle,
  PmdDirection,
  PmdSpriteAction,
} from '../../assets/pmdAssetLoader';
import {
  KECLEON_PMD_ASSET_ID,
  type OverworldGraphDefinition,
  type OverworldNodeDefinition,
  type OverworldPoint,
} from '../../data/overworldMapData';
import { getEdgePointsOrdered } from '../../engine/overworldEngine';
import type { OverworldNodeState } from '../../types/schemas';
import type { OverworldClearSequence } from './OverworldTravelAndSprites';
import {
  drawAnimatedSpriteAtMapPoint,
  syncOverworldNodeLabelsOverlay,
  type NodeLabelDomEntry,
} from './overworldSpriteAndLabelDraw';

export type { NodeLabelDomEntry };

function slicePolylineAtFraction(
  points: ReadonlyArray<OverworldPoint>,
  fraction: number
): OverworldPoint[] {
  if (points.length <= 1 || fraction <= 0) return points.slice(0, 1);
  if (fraction >= 1) return points.map((p) => ({ x: p.x, y: p.y }));

  let totalLen = 0;
  for (let i = 1; i < points.length; i++) {
    totalLen += Math.hypot(points[i]!.x - points[i - 1]!.x, points[i]!.y - points[i - 1]!.y);
  }
  const targetDist = totalLen * fraction;
  const sliced: OverworldPoint[] = [{ x: points[0]!.x, y: points[0]!.y }];
  let accum = 0;

  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1]!;
    const cur = points[i]!;
    const segLen = Math.hypot(cur.x - prev.x, cur.y - prev.y);
    if (accum + segLen <= targetDist) {
      sliced.push({ x: cur.x, y: cur.y });
      accum += segLen;
    } else {
      const remaining = targetDist - accum;
      const t = segLen > 0 ? remaining / segLen : 0;
      sliced.push({
        x: prev.x + (cur.x - prev.x) * t,
        y: prev.y + (cur.y - prev.y) * t,
      });
      break;
    }
  }
  return sliced;
}

export interface OverworldRenderFrameContext {
  ctx: CanvasRenderingContext2D;
  nodeLabelsLayerEl: HTMLElement;
  nodeLabelMap: Map<string, NodeLabelDomEntry>;
  graph: OverworldGraphDefinition;
  nodeMap: ReadonlyMap<string, OverworldNodeDefinition>;
  reconciled: { currentNodeId: string; nodes: Record<string, OverworldNodeState> };
  mapSource: CanvasImageSource | null;
  spriteBundles: Map<string, LoadedSpriteBundle>;
  lordSpeciesId: string;
  lordWorldX: number;
  lordWorldY: number;
  lordDirection: PmdDirection;
  lordAction: PmdSpriteAction;
  animClockMs: number;
  displayScale: number;
  canvasDpr: number;
  viewWidthPx: number;
  viewHeightPx: number;
  cameraX: number;
  cameraY: number;
  isTraveling: boolean;
  hoveredNodeId: string | null;
  highlightedEdgeIds: string[];
  clearSequence?: OverworldClearSequence | null;
}

export function renderOverworldFrame(rc: OverworldRenderFrameContext): void {
  const {
    ctx,
    graph,
    nodeMap,
    reconciled,
    mapSource,
    spriteBundles,
    lordSpeciesId,
    lordWorldX,
    lordWorldY,
    lordDirection,
    lordAction,
    animClockMs,
    displayScale: scale,
    canvasDpr,
    viewWidthPx,
    viewHeightPx,
    cameraX,
    cameraY,
    isTraveling,
    hoveredNodeId,
    highlightedEdgeIds,
  } = rc;

  const dpr = canvasDpr || 1;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = '#080e1c';
  ctx.fillRect(0, 0, viewWidthPx, viewHeightPx);

  if (mapSource) {
    const mapDrawX = Math.round(-cameraX * scale);
    const mapDrawY = Math.round(-cameraY * scale);
    const mapDrawW = Math.round(graph.imageWidth * scale);
    const mapDrawH = Math.round(graph.imageHeight * scale);

    ctx.fillStyle = 'rgba(2, 6, 14, 0.65)';
    ctx.fillRect(mapDrawX - 4, mapDrawY - 2, mapDrawW + 10, mapDrawH + 10);
    ctx.fillStyle = '#a8c0e0';
    ctx.fillRect(mapDrawX - 4, mapDrawY - 4, mapDrawW + 8, mapDrawH + 8);
    ctx.fillStyle = '#385078';
    ctx.fillRect(mapDrawX - 2, mapDrawY - 2, mapDrawW + 4, mapDrawH + 4);
    ctx.drawImage(mapSource, mapDrawX, mapDrawY, mapDrawW, mapDrawH);
  }

  const clearSeq = rc.clearSequence;
  const pulse01 = 0.5 + 0.5 * Math.sin(animClockMs / 240);
  const activeRouteEdgeSet = new Set<string>(highlightedEdgeIds);

  for (const edge of graph.edges) {
    const a = nodeMap.get(edge.fromNodeId);
    const b = nodeMap.get(edge.toNodeId);
    if (!a || !b) continue;
    const stA = reconciled.nodes[a.id];
    const stB = reconciled.nodes[b.id];
    const bothUnlocked = Boolean(stA?.unlocked && stB?.unlocked);

    const isNewlyUnlocked = Boolean(clearSeq?.newlyUnlockedEdgeIds.includes(edge.id));
    if (isNewlyUnlocked) {
      if (clearSeq?.phase === 'red_to_green') continue;
    } else {
      if (!bothUnlocked) continue;
    }

    let pts: OverworldPoint[];
    let edgeFraction = 1;
    if (isNewlyUnlocked && clearSeq?.phase === 'draw_edges') {
      edgeFraction = clearSeq.edgeProgress;
      const isANew = clearSeq.newlyUnlockedNodeIds.includes(a.id);
      const isBNew = clearSeq.newlyUnlockedNodeIds.includes(b.id);
      const fromNode = isANew && !isBNew ? b : a;
      const toNode = isANew && !isBNew ? a : b;
      const fullPts = getEdgePointsOrdered(edge, fromNode, toNode);
      pts = slicePolylineAtFraction(fullPts, edgeFraction);
    } else {
      pts = getEdgePointsOrdered(edge, a, b);
    }
    if (pts.length < 2) continue;

    const isHighlightedRoute = activeRouteEdgeSet.has(edge.id);

    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo((pts[0]!.x - cameraX) * scale, (pts[0]!.y - cameraY) * scale);
    for (let i = 1; i < pts.length; i++) {
      ctx.lineTo((pts[i]!.x - cameraX) * scale, (pts[i]!.y - cameraY) * scale);
    }

    ctx.strokeStyle = '#2b1708';
    ctx.lineWidth = Math.max(6, 2.6 * scale);
    ctx.stroke();

    ctx.strokeStyle = isHighlightedRoute ? '#70f0ff' : '#ffe074';
    ctx.lineWidth = Math.max(3, 1.3 * scale);
    ctx.stroke();

    if (edgeFraction >= 0.99) {
      for (const wp of edge.waypoints) {
        ctx.fillStyle = isHighlightedRoute ? '#ffffff' : '#fff0a8';
        ctx.beginPath();
        ctx.arc(
          (wp.x - cameraX) * scale,
          (wp.y - cameraY) * scale,
          Math.max(2, 0.85 * scale),
          0,
          Math.PI * 2
        );
        ctx.fill();
      }
    }
    ctx.restore();
  }

  for (const def of graph.nodes) {
    const st = reconciled.nodes[def.id];
    const isUnlocked = Boolean(st?.unlocked);
    const isCleared = Boolean(st?.cleared);
    const isCurrent = reconciled.currentNodeId === def.id && !isTraveling;
    const isHovered = hoveredNodeId === def.id;
    const cx = Math.round((def.x - cameraX) * scale);
    const cy = Math.round((def.y - cameraY) * scale);

    const isNewDuringClear = Boolean(clearSeq?.newlyUnlockedNodeIds.includes(def.id));
    if (isNewDuringClear) {
      if (clearSeq?.phase === 'red_to_green' || clearSeq?.phase === 'draw_edges') {
        continue;
      }
    } else if (!isUnlocked) {
      continue;
    }

    let nodeScale = 1;
    if (isNewDuringClear && clearSeq?.phase === 'pop_nodes') {
      nodeScale = clearSeq.popScale;
    }
    if (nodeScale <= 0) continue;

    ctx.save();
    if ((isCurrent || isHovered) && !isNewDuringClear) {
      ctx.beginPath();
      ctx.arc(cx, cy, (7.5 + pulse01 * 2) * scale, 0, Math.PI * 2);
      ctx.strokeStyle = isCurrent
        ? `rgba(248, 208, 72, ${(0.55 + pulse01 * 0.4).toFixed(2)})`
        : 'rgba(112, 240, 255, 0.75)';
      ctx.lineWidth = Math.max(2, 1.1 * scale);
      ctx.stroke();
    }

    const crestRadius = 5.2 * scale * nodeScale;

    if (clearSeq && clearSeq.clearedNodeId === def.id && clearSeq.phase === 'red_to_green') {
      const t = clearSeq.progress;
      ctx.beginPath();
      const glowR = crestRadius + (2 + t * 16) * scale;
      ctx.arc(cx, cy, glowR, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(104, 248, 168, ${(1 - t) * 0.85})`;
      ctx.lineWidth = Math.max(2, 1.5 * scale);
      ctx.stroke();
    }

    ctx.beginPath();
    ctx.arc(cx, cy, crestRadius, 0, Math.PI * 2);

    let fillColor: string;
    let strokeColor: string;
    let dotColor: string;

    if (clearSeq && clearSeq.clearedNodeId === def.id && clearSeq.phase === 'red_to_green') {
      const t = clearSeq.progress;
      const r = Math.round(184 + (30 - 184) * t);
      const g = Math.round(40 + (140 - 40) * t);
      const b = Math.round(60 + (82 - 60) * t);
      fillColor = `rgb(${r}, ${g}, ${b})`;
      strokeColor = '#f8d048';
      const dotR = Math.round(255 + (184 - 255) * t);
      const dotG = Math.round(232 + (255 - 232) * t);
      const dotB = Math.round(136 + (216 - 136) * t);
      dotColor = `rgb(${dotR}, ${dotG}, ${dotB})`;
    } else if (st?.activeSkirmish) {
      fillColor = '#a81c2c';
      strokeColor = '#ff98a0';
      dotColor = isCleared ? '#b8ffd8' : '#ffe888';
    } else if (!isCleared) {
      fillColor = '#b8283c';
      strokeColor = '#f8d048';
      dotColor = '#ffe888';
    } else {
      fillColor = '#1e8c52';
      strokeColor = isCurrent ? '#f8d048' : '#68f8a8';
      dotColor = '#b8ffd8';
    }

    ctx.fillStyle = fillColor;
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = Math.max(2, 1 * scale);
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(cx, cy, 1.8 * scale * nodeScale, 0, Math.PI * 2);
    ctx.fillStyle = dotColor;
    ctx.fill();
    ctx.restore();

    if (isUnlocked && st?.activeKecleonShop && !isNewDuringClear) {
      drawAnimatedSpriteAtMapPoint(
        ctx,
        spriteBundles.get(KECLEON_PMD_ASSET_ID),
        'Idle',
        0,
        def.x + 12,
        def.y - 4,
        cameraX,
        cameraY,
        scale,
        animClockMs,
        'rgba(56, 216, 120, 0.65)'
      );
    }
    if (isUnlocked && st?.activeSkirmish && !isNewDuringClear) {
      drawAnimatedSpriteAtMapPoint(
        ctx,
        spriteBundles.get(def.skirmishScoutSpeciesId),
        'Idle',
        0,
        def.x - 12,
        def.y - 4,
        cameraX,
        cameraY,
        scale,
        animClockMs,
        'rgba(255, 72, 88, 0.72)'
      );
    }
  }

  syncOverworldNodeLabelsOverlay({
    nodeLabelsLayerEl: rc.nodeLabelsLayerEl,
    nodeLabelMap: rc.nodeLabelMap,
    graph,
    reconciled,
    scale,
    cameraX,
    cameraY,
    isTraveling,
    hoveredNodeId,
    clearSequence: rc.clearSequence,
  });

  drawAnimatedSpriteAtMapPoint(
    ctx,
    spriteBundles.get(lordSpeciesId),
    lordAction,
    lordDirection,
    lordWorldX,
    lordWorldY,
    cameraX,
    cameraY,
    scale,
    animClockMs,
    'rgba(248, 208, 72, 0.72)'
  );
}
