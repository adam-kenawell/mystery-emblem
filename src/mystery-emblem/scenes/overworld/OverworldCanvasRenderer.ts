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
} from '../../data/overworldMapData';
import {
  ensureOverworldGraphState,
  getEdgePointsOrdered,
} from '../../engine/overworldEngine';
import type { SaveData } from '../../types/schemas';
import {
  drawAnimatedSpriteAtMapPoint,
  syncOverworldNodeLabelsOverlay,
  type NodeLabelDomEntry,
} from './overworldSpriteAndLabelDraw';

export type { NodeLabelDomEntry };

export interface OverworldRenderFrameContext {
  ctx: CanvasRenderingContext2D;
  nodeLabelsLayerEl: HTMLElement;
  nodeLabelMap: Map<string, NodeLabelDomEntry>;
  graph: OverworldGraphDefinition;
  mapSource: CanvasImageSource | null;
  spriteBundles: Map<string, LoadedSpriteBundle>;
  save: SaveData | null;
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
}

export function renderOverworldFrame(rc: OverworldRenderFrameContext): void {
  const {
    ctx,
    graph,
    mapSource,
    spriteBundles,
    save,
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

  const reconciled = save
    ? ensureOverworldGraphState(save, graph)
    : { currentNodeId: graph.startNodeId, nodes: {}, mutated: false };
  const nodeMap = new Map(graph.nodes.map((n) => [n.id, n]));
  const pulse01 = 0.5 + 0.5 * Math.sin(animClockMs / 240);
  const activeRouteEdgeSet = new Set<string>(highlightedEdgeIds);

  for (const edge of graph.edges) {
    const a = nodeMap.get(edge.fromNodeId);
    const b = nodeMap.get(edge.toNodeId);
    if (!a || !b) continue;
    const stA = reconciled.nodes[a.id];
    const stB = reconciled.nodes[b.id];
    const bothUnlocked = Boolean(stA?.unlocked && stB?.unlocked);
    if (!stA?.unlocked && !stB?.unlocked) continue;

    const pts = getEdgePointsOrdered(edge, a, b);
    const isHighlightedRoute = activeRouteEdgeSet.has(edge.id);

    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo((pts[0]!.x - cameraX) * scale, (pts[0]!.y - cameraY) * scale);
    for (let i = 1; i < pts.length; i++) {
      ctx.lineTo((pts[i]!.x - cameraX) * scale, (pts[i]!.y - cameraY) * scale);
    }

    if (bothUnlocked) {
      ctx.strokeStyle = '#2b1708';
      ctx.lineWidth = Math.max(6, 2.6 * scale);
      ctx.stroke();

      ctx.strokeStyle = isHighlightedRoute ? '#70f0ff' : '#ffe074';
      ctx.lineWidth = Math.max(3, 1.3 * scale);
      ctx.stroke();

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
    } else {
      ctx.setLineDash([scale * 2, scale * 2]);
      ctx.strokeStyle = 'rgba(28, 18, 10, 0.55)';
      ctx.lineWidth = Math.max(2, 1.1 * scale);
      ctx.stroke();
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

    ctx.save();
    if (isCurrent || isHovered) {
      ctx.beginPath();
      ctx.arc(cx, cy, (7.5 + pulse01 * 2) * scale, 0, Math.PI * 2);
      ctx.strokeStyle = isCurrent
        ? `rgba(248, 208, 72, ${(0.55 + pulse01 * 0.4).toFixed(2)})`
        : 'rgba(112, 240, 255, 0.75)';
      ctx.lineWidth = Math.max(2, 1.1 * scale);
      ctx.stroke();
    }

    const crestRadius = (isUnlocked ? 5.2 : 3.8) * scale;
    ctx.beginPath();
    ctx.arc(cx, cy, crestRadius, 0, Math.PI * 2);
    if (!isUnlocked) {
      ctx.fillStyle = 'rgba(28, 36, 52, 0.82)';
      ctx.strokeStyle = '#8898b0';
    } else if (st?.activeSkirmish) {
      ctx.fillStyle = '#a81c2c';
      ctx.strokeStyle = '#ff98a0';
    } else if (!isCleared) {
      ctx.fillStyle = def.kind === 'paralogue' ? '#1c7c54' : '#b8283c';
      ctx.strokeStyle = '#f8d048';
    } else {
      ctx.fillStyle = '#163c74';
      ctx.strokeStyle = isCurrent ? '#f8d048' : '#58c8f8';
    }
    ctx.lineWidth = Math.max(2, 1 * scale);
    ctx.fill();
    ctx.stroke();

    if (isUnlocked) {
      ctx.beginPath();
      ctx.arc(cx, cy, 1.8 * scale, 0, Math.PI * 2);
      ctx.fillStyle = isCleared ? '#90e8ff' : '#ffe888';
      ctx.fill();
    }
    ctx.restore();

    if (isUnlocked && st?.activeKecleonShop) {
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
    if (isUnlocked && st?.activeSkirmish) {
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
