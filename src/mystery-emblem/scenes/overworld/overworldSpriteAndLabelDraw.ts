/**
 * Mystery Emblem - Overworld Sprite Footline & Crisp DOM Node Pill Helpers (`overworldSpriteAndLabelDraw.ts`)
 */

import {
  computePmdTileSpritePlacement,
  drawSpriteAnimFrame,
  resolveAnimFrameIndex,
  type LoadedSpriteBundle,
  type PmdDirection,
  type PmdSpriteAction,
} from '../../assets/pmdAssetLoader';
import type { OverworldGraphDefinition } from '../../data/overworldMapData';
import { resolveCurrentStoryChapterNodeId } from '../../engine/overworld/overworldGraphState';
import type { OverworldNodeState } from '../../types/schemas';
import type { OverworldClearSequence } from './OverworldTravelAndSprites';

const OVERWORLD_SPRITE_SCALE_FACTOR = 0.5;

export interface NodeLabelDomEntry {
  anchorEl: HTMLElement;
  pillEl: HTMLElement;
  codeEl: HTMLElement;
  nameEl: HTMLElement;
  lastHidden?: boolean;
  lastCode?: string;
  lastName?: string;
  lastCurrent?: boolean;
  lastStoryChapter?: boolean;
  lastHovered?: boolean;
  lastCleared?: boolean;
  lastSkirmish?: boolean;
  lastTransform?: string;
}

export function drawAnimatedSpriteAtMapPoint(
  ctx: CanvasRenderingContext2D,
  bundle: LoadedSpriteBundle | undefined,
  action: PmdSpriteAction,
  direction: PmdDirection,
  mapX: number,
  mapY: number,
  cameraX: number,
  cameraY: number,
  scale: number,
  animClockMs: number,
  tintGlowColor?: string
): void {
  if (!bundle) return;
  const anim = bundle.actions[action] ?? bundle.actions.Idle;
  const spriteScale = scale * OVERWORLD_SPRITE_SCALE_FACTOR;
  const screenX = Math.round((mapX - cameraX) * scale);
  const screenY = Math.round((mapY - cameraY) * scale);
  const frameIdx = resolveAnimFrameIndex(anim, animClockMs);

  const placement = computePmdTileSpritePlacement(
    -12,
    -20,
    anim.frameWidth,
    anim.frameHeight,
    24
  );
  const drawX = Math.round(screenX + placement.drawX * spriteScale);
  const drawY = Math.round(screenY + placement.drawY * spriteScale);
  const drawW = Math.round(anim.frameWidth * spriteScale);
  const drawH = Math.round(anim.frameHeight * spriteScale);

  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = tintGlowColor ?? 'rgba(8, 12, 24, 0.55)';
  ctx.beginPath();
  ctx.ellipse(
    screenX,
    screenY + 2 * spriteScale,
    6 * spriteScale,
    2.6 * spriteScale,
    0,
    0,
    Math.PI * 2
  );
  ctx.fill();
  drawSpriteAnimFrame(ctx, anim, frameIdx, direction, drawX, drawY, drawW, drawH);
  ctx.restore();
}

export function syncOverworldNodeLabelsOverlay(params: {
  nodeLabelsLayerEl: HTMLElement;
  nodeLabelMap: Map<string, NodeLabelDomEntry>;
  graph: OverworldGraphDefinition;
  reconciled: { currentNodeId: string; nodes: Record<string, OverworldNodeState> };
  scale: number;
  cameraX: number;
  cameraY: number;
  isTraveling: boolean;
  hoveredNodeId: string | null;
  clearSequence?: OverworldClearSequence | null;
}): void {
  const {
    nodeLabelsLayerEl,
    nodeLabelMap,
    graph,
    reconciled,
    scale,
    cameraX,
    cameraY,
    isTraveling,
    hoveredNodeId,
    clearSequence,
  } = params;
  const activeIds = new Set<string>();
  const storyChapterNodeId = resolveCurrentStoryChapterNodeId(reconciled.nodes, graph);

  for (const def of graph.nodes) {
    activeIds.add(def.id);
    let entry = nodeLabelMap.get(def.id);
    if (!entry) {
      const anchorEl = document.createElement('div');
      anchorEl.className = 'pmd-overworld-node-label-anchor';
      const pillEl = document.createElement('div');
      pillEl.className = 'pmd-overworld-node-pill';
      pillEl.dataset.testid = `overworld-node-label-${def.id}`;
      pillEl.dataset.nodeId = def.id;
      const codeEl = document.createElement('span');
      codeEl.className = 'pmd-overworld-node-pill-code';
      const nameEl = document.createElement('span');
      nameEl.className = 'pmd-overworld-node-pill-name';
      pillEl.append(codeEl, nameEl);
      anchorEl.appendChild(pillEl);
      nodeLabelsLayerEl.appendChild(anchorEl);
      entry = { anchorEl, pillEl, codeEl, nameEl };
      nodeLabelMap.set(def.id, entry);
    }

    const st = reconciled.nodes[def.id];
    const isNewDuringClear = Boolean(clearSequence?.newlyUnlockedNodeIds.includes(def.id));
    if (isNewDuringClear && clearSequence?.phase !== 'pop_nodes') {
      if (entry.lastHidden !== true) {
        entry.anchorEl.hidden = true;
        entry.lastHidden = true;
      }
      continue;
    }
    // Declutter: only the Lord's settled node and the current story chapter show a title card
    // (no hover reveal); paralogues, cleared chapters and shop/skirmish nodes stay hidden.
    const isCurrent = reconciled.currentNodeId === def.id && !isTraveling;
    const isStoryChapter = storyChapterNodeId === def.id;
    if (!st?.unlocked || (!isCurrent && !isStoryChapter)) {
      if (entry.lastHidden !== true) {
        entry.anchorEl.hidden = true;
        entry.lastHidden = true;
      }
      continue;
    }

    if (entry.lastHidden !== false) {
      entry.anchorEl.hidden = false;
      entry.lastHidden = false;
    }
    if (entry.lastCode !== def.code) {
      entry.codeEl.textContent = def.code;
      entry.lastCode = def.code;
    }
    if (entry.lastName !== def.name) {
      entry.nameEl.textContent = def.name;
      entry.lastName = def.name;
    }
    if (entry.lastCurrent !== isCurrent) {
      entry.pillEl.classList.toggle('is-current', isCurrent);
      entry.lastCurrent = isCurrent;
    }
    if (entry.lastStoryChapter !== isStoryChapter) {
      entry.pillEl.classList.toggle('is-story-chapter', isStoryChapter);
      entry.lastStoryChapter = isStoryChapter;
    }
    const isHovered = hoveredNodeId === def.id;
    if (entry.lastHovered !== isHovered) {
      entry.pillEl.classList.toggle('is-hovered', isHovered);
      entry.lastHovered = isHovered;
    }
    const isCleared = Boolean(st?.cleared);
    if (entry.lastCleared !== isCleared) {
      entry.pillEl.classList.toggle('is-cleared', isCleared);
      entry.lastCleared = isCleared;
    }
    const hasSkirmish = Boolean(st?.activeSkirmish);
    if (entry.lastSkirmish !== hasSkirmish) {
      entry.pillEl.classList.toggle('has-skirmish', hasSkirmish);
      entry.lastSkirmish = hasSkirmish;
    }

    const cx = Math.round((def.x - cameraX) * scale);
    const cy = Math.round((def.y - cameraY) * scale);
    const labelY = cy + Math.round(7.2 * scale);
    const nextTransform = `translate3d(${cx}px, ${labelY}px, 0)`;
    if (entry.lastTransform !== nextTransform) {
      entry.anchorEl.style.transform = nextTransform;
      entry.lastTransform = nextTransform;
    }
  }

  for (const [nodeId, entry] of nodeLabelMap.entries()) {
    if (!activeIds.has(nodeId) && entry.lastHidden !== true) {
      entry.anchorEl.hidden = true;
      entry.lastHidden = true;
    }
  }
}
