/**
 * High-DPI Screen-Space Floating Combat Callouts & Per-Frame Walk/Sprite Tick
 */

import { PMD_TILE_NATIVE_PX } from '../../assets/tilesetLoader';
import { ensureTilePairVisible } from './battleBannersAndTransitions';
import type { BattleDomRefs } from './battleDomShell';
import {
  WALK_MS_PER_TILE_FAST,
  WALK_MS_PER_TILE_NORMAL,
  type BattleRuntimeState,
  type FloatingBattleText,
} from './battleTypesAndState';
import { getRenderableUnits, getUnitVisualKey } from './battleUnitQueries';

export function clearFloatingTexts(state: BattleRuntimeState, dom: BattleDomRefs): void {
  state.floatingTexts.length = 0;
  state.floatingTextEls.clear();
  dom.floatingCalloutLayerEl.innerHTML = '';
}

export function spawnFloatingText(
  state: BattleRuntimeState,
  dom: BattleDomRefs,
  tileX: number,
  tileY: number,
  text: string,
  color: string,
  durationMs = 820
): void {
  const now = performance.now();
  const id = state.nextFloatingTextId++;
  const emphasis = /^(CRIT!|DEFEATED!|LEVEL UP!|FULL HEAL!|Got )/.test(text);
  const ft: FloatingBattleText = {
    id,
    worldX: tileX * PMD_TILE_NATIVE_PX + PMD_TILE_NATIVE_PX / 2,
    worldY: tileY * PMD_TILE_NATIVE_PX + 2,
    text,
    color,
    emphasis,
    createdAtMs: now,
    durationMs: state.fastMode ? Math.max(120, Math.round(durationMs * 0.25)) : durationMs,
  };
  state.floatingTexts.push(ft);

  const el = document.createElement('span');
  el.className = `pmd-battle-floating-callout${emphasis ? ' is-emphasis' : ''}`;
  el.dataset.testid = 'battle-floating-callout';
  el.textContent = text;
  el.style.color = color;
  dom.floatingCalloutLayerEl.appendChild(el);
  state.floatingTextEls.set(id, el);
  syncFloatingCalloutDom(state, dom, now);
}

export function syncFloatingCalloutDom(
  state: BattleRuntimeState,
  dom: BattleDomRefs,
  now: number
): void {
  if (state.floatingTexts.length === 0) return;

  const stageW = dom.canvasStageEl.clientWidth || 640;
  const stageH = dom.canvasStageEl.clientHeight || 480;
  const { bufferWidth, bufferHeight, displayScale, cameraX, cameraY } = state.cam;
  const canvasOffsetX = (stageW - bufferWidth * displayScale) / 2;
  const canvasOffsetY = (stageH - bufferHeight * displayScale) / 2;
  const stackCounts = new Map<string, number>();

  for (let i = state.floatingTexts.length - 1; i >= 0; i--) {
    const ft = state.floatingTexts[i]!;
    const el = state.floatingTextEls.get(ft.id);
    if (!el) continue;

    const tileBucketKey = `${Math.round(ft.worldX)}:${Math.round(ft.worldY)}`;
    const stackIdx = stackCounts.get(tileBucketKey) ?? 0;
    stackCounts.set(tileBucketKey, stackIdx + 1);

    const t = Math.max(0, Math.min(1, (now - ft.createdAtMs) / Math.max(1, ft.durationMs)));
    const riseCssPx = Math.round(t * 12 * displayScale + stackIdx * 11 * displayScale);
    const screenX = Math.round(canvasOffsetX + (ft.worldX - cameraX) * displayScale);
    const screenY = Math.round(canvasOffsetY + (ft.worldY - cameraY) * displayScale - riseCssPx);
    const fontPx = Math.max(14, Math.round((ft.emphasis ? 10 : 9) * displayScale));
    const alpha = t > 0.78 ? Math.max(0, (1 - t) / 0.22) : 1;

    el.style.left = `${screenX}px`;
    el.style.top = `${screenY}px`;
    el.style.fontSize = `${fontPx}px`;
    el.style.opacity = alpha.toFixed(3);

    if (t < 0.14) {
      const popT = t / 0.14;
      const peak = ft.emphasis ? 1.24 : 1.14;
      const scale = peak - (peak - 1) * popT;
      el.style.transform = `translate3d(-50%, -100%, 0) scale(${scale.toFixed(3)})`;
    } else {
      el.style.transform = 'translate3d(-50%, -100%, 0)';
    }
  }
}

export function advanceBattleAnimations(state: BattleRuntimeState, now: number): void {
  const walkMsPerTile = state.fastMode ? WALK_MS_PER_TILE_FAST : WALK_MS_PER_TILE_NORMAL;

  if (state.activeWalk) {
    const unit = state.units.find((u) => u.id === state.activeWalk!.unitId);
    if (!unit) {
      const done = state.activeWalk.onComplete;
      state.activeWalk = null;
      done();
    } else {
      const dt = Math.min(80, Math.max(0, now - state.activeWalk.lastTickMs));
      state.activeWalk.lastTickMs = now;
      state.activeWalk.segmentElapsedMs += dt;

      while (state.activeWalk && state.activeWalk.segmentElapsedMs >= walkMsPerTile) {
        state.activeWalk.segmentElapsedMs -= walkMsPerTile;
        state.activeWalk.segmentIndex += 1;
        const reachedStep = state.activeWalk.steps[state.activeWalk.segmentIndex];
        if (!reachedStep) break;
        unit.x = reachedStep.x;
        unit.y = reachedStep.y;

        if (state.activeWalk.segmentIndex >= state.activeWalk.steps.length - 1) {
          const done = state.activeWalk.onComplete;
          state.activeWalk = null;
          unit.renderWorldX = unit.x * PMD_TILE_NATIVE_PX;
          unit.renderWorldY = unit.y * PMD_TILE_NATIVE_PX;
          done();
          break;
        }
      }

      if (state.activeWalk) {
        const fromStep = state.activeWalk.steps[state.activeWalk.segmentIndex]!;
        const toStep = state.activeWalk.steps[state.activeWalk.segmentIndex + 1]!;
        const dx = toStep.x - fromStep.x;
        const dy = toStep.y - fromStep.y;
        if (dx > 0) unit.direction = 2;
        else if (dx < 0) unit.direction = 6;
        else if (dy < 0) unit.direction = 4;
        else if (dy > 0) unit.direction = 0;

        const t = Math.min(1, state.activeWalk.segmentElapsedMs / walkMsPerTile);
        unit.renderWorldX = Math.round((fromStep.x + dx * t) * PMD_TILE_NATIVE_PX);
        unit.renderWorldY = Math.round((fromStep.y + dy * t) * PMD_TILE_NATIVE_PX);

        if (state.activeWalk.followCamera) {
          ensureTilePairVisible(state, unit.x, unit.y, toStep.x, toStep.y);
        }
      }
    }
  }

  for (const unit of getRenderableUnits(state)) {
    const bundle = state.spriteBundles.get(getUnitVisualKey(unit));
    if (!bundle) continue;
    const anim = bundle.actions[unit.action] ?? bundle.actions.Idle;
    if (now >= unit.nextFrameAt) {
      unit.frameIndex = (unit.frameIndex + 1) % Math.max(1, anim.frameCount);
      const dur = anim.durationsMs[unit.frameIndex % anim.durationsMs.length] ?? 140;
      unit.nextFrameAt = now + dur;
    }
  }

  for (let i = state.floatingTexts.length - 1; i >= 0; i--) {
    const ft = state.floatingTexts[i]!;
    if (now - ft.createdAtMs >= ft.durationMs) {
      state.floatingTextEls.get(ft.id)?.remove();
      state.floatingTextEls.delete(ft.id);
      state.floatingTexts.splice(i, 1);
    }
  }
}
