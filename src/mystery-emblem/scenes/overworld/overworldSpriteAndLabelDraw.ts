/**
 * Mystery Emblem — Overworld Sprite Footline & Crisp DOM Node Pill Helpers (`overworldSpriteAndLabelDraw.ts`)
 */

import {
  computePmdTileSpritePlacement,
  type LoadedSpriteBundle,
  type PmdDirection,
  type PmdSpriteAction,
} from '../../assets/pmdAssetLoader';
import type { OverworldGraphDefinition } from '../../data/overworldMapData';
import type { OverworldNodeState } from '../../types/schemas';

const OVERWORLD_SPRITE_SCALE_FACTOR = 0.5;

export interface NodeLabelDomEntry {
  anchorEl: HTMLElement;
  pillEl: HTMLElement;
  codeEl: HTMLElement;
  nameEl: HTMLElement;
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

  const totalAnimMs = Math.max(
    80,
    anim.durationsMs.reduce((acc, d) => acc + Math.max(16, d), 0)
  );
  let rem = animClockMs % totalAnimMs;
  let frameIdx = 0;
  for (let i = 0; i < anim.frameCount; i++) {
    const dur = Math.max(16, anim.durationsMs[i] ?? 120);
    if (rem < dur) {
      frameIdx = i;
      break;
    }
    rem -= dur;
  }

  const rowIdx = anim.rowCount > 1 ? direction % anim.rowCount : 0;
  const sx = frameIdx * anim.frameWidth;
  const sy = rowIdx * anim.frameHeight;

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
  ctx.drawImage(
    anim.source,
    sx,
    sy,
    anim.frameWidth,
    anim.frameHeight,
    drawX,
    drawY,
    drawW,
    drawH
  );
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
  } = params;
  const activeIds = new Set<string>();

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
    if (!st?.unlocked) {
      entry.anchorEl.hidden = true;
      continue;
    }

    entry.anchorEl.hidden = false;
    entry.codeEl.textContent = def.code;
    entry.nameEl.textContent = def.name;
    entry.pillEl.classList.toggle('is-current', reconciled.currentNodeId === def.id && !isTraveling);
    entry.pillEl.classList.toggle('is-hovered', hoveredNodeId === def.id);
    entry.pillEl.classList.toggle('is-cleared', Boolean(st?.cleared));
    entry.pillEl.classList.toggle('has-skirmish', Boolean(st?.activeSkirmish));

    const cx = Math.round((def.x - cameraX) * scale);
    const cy = Math.round((def.y - cameraY) * scale);
    const labelY = cy + Math.round(7.2 * scale);
    entry.anchorEl.style.transform = `translate3d(${cx}px, ${labelY}px, 0)`;
  }

  for (const [nodeId, entry] of nodeLabelMap.entries()) {
    if (!activeIds.has(nodeId)) entry.anchorEl.hidden = true;
  }
}
