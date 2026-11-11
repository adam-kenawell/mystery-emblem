/**
 * Cutscene Editor Stage View: Live Preview Canvas, Overlays & Pointer Editing (`editorStageView.ts`)
 *
 * Renders the real cutscene runtime (fast-forwarded to the selected beat) at native pixel scale,
 * then draws editing overlays (paths, end-position ghosts, grid, phone frame, labels) on a
 * crisp CSS-resolution canvas on top.
 */

import { normalizePmdDirection, type PmdDirection } from '../assets/pmdAssetLoader';
import { PMD_TILE_NATIVE_PX } from '../assets/tilesetLoader';
import type { DungeonMapDefinition } from '../types/schemas';
import { renderDungeonMapPreviewCanvas } from '../scenes/ChapterMapEditorScene';
import type { CutsceneStageRuntime } from '../scenes/cutscene/cutsceneChoreographer';
import { createAmbientMotes } from '../scenes/cutscene/cutscenePropsAndMoods';
import { computeCutsceneCamera, drawCutsceneActor, renderCutsceneStageFrame } from '../scenes/cutscene/cutsceneRenderer';
import type { RuntimeCutsceneActor } from '../scenes/cutscene/cutsceneTypes';
import { h } from './editorDom';

export interface StageGhost {
  castId: string;
  x: number;
  y: number;
  facing?: PmdDirection;
}

export interface StagePath {
  points: Array<{ x: number; y: number }>;
  highlighted: boolean;
  color?: string;
}

export interface StageOverlay {
  paths: StagePath[];
  ghosts: StageGhost[];
  markers: Array<{ x: number; y: number; label: string; color: string }>;
  /** Cast ids that can be dragged in the current mode */
  draggable: Set<string>;
  /** Prop ids that can be dragged in the current mode */
  draggableProps: Set<string>;
  hint: string;
  selectedCastId: string | null;
}

export interface StageViewCallbacks {
  onTapTile: (x: number, y: number) => void;
  onSelectCast: (castId: string) => void;
  onDragCast: (castId: string, x: number, y: number, done: boolean) => void;
  onDragProp: (propId: string, x: number, y: number, done: boolean) => void;
}

const PHONE_NATIVE = { w: 195, h: 422, viewHeightCss: 844 };

export class EditorStageView {
  public readonly rootEl: HTMLElement;
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly overlayCanvas: HTMLCanvasElement;
  private readonly octx: CanvasRenderingContext2D;
  private readonly hintEl: HTMLElement;
  public readonly toolbarEl: HTMLElement;
  public readonly dialoguePreviewEl: HTMLElement;
  private readonly motes = createAmbientMotes(22);
  private runtime: CutsceneStageRuntime | null = null;
  private overlay: StageOverlay | null = null;
  private mapBackdrop: { map: DungeonMapDefinition; canvas: HTMLCanvasElement } | null = null;
  private rafId: number | null = null;
  private lastMs = 0;
  private hoverTile: { x: number; y: number } | null = null;
  private drag: { kind: 'cast' | 'prop'; id: string; pointerId: number; moved: boolean; startX: number; startY: number } | null = null;
  private camOverride: { x: number; y: number } | null = null;
  private zoom = 2;
  private cssW = 640;
  private cssH = 400;
  private resizeObserver: ResizeObserver | null = null;

  public showGrid = true;
  public showPhoneFrame = true;
  public halfTileSnap = false;
  public view: 'fit' | 'game' = 'fit';
  /** Two tile corners collected for "tile reached" triggers in dialogue mode */
  public onMapTileTap: ((x: number, y: number) => void) | null = null;

  constructor(private readonly callbacks: StageViewCallbacks, signal: AbortSignal) {
    this.canvas = h('canvas', { class: 'cse-stage-canvas pmd-pixelated', 'data-testid': 'cse-stage-canvas' });
    this.ctx = this.canvas.getContext('2d')!;
    this.overlayCanvas = h('canvas', { class: 'cse-stage-overlay' });
    this.octx = this.overlayCanvas.getContext('2d')!;
    this.hintEl = h('div', { class: 'cse-stage-hint', 'data-testid': 'cse-stage-hint' });
    this.toolbarEl = h('div', { class: 'cse-stage-toolbar' });
    this.dialoguePreviewEl = h('div', { class: 'cse-dlg-preview', 'data-testid': 'cse-dialogue-preview' });
    const surface = h('div', { class: 'cse-stage-surface' }, this.canvas, this.overlayCanvas);
    this.rootEl = h('div', { class: 'cse-stage' }, this.toolbarEl, surface, this.hintEl, this.dialoguePreviewEl);

    this.overlayCanvas.addEventListener('pointerdown', (ev) => this.onPointerDown(ev), { signal });
    this.overlayCanvas.addEventListener('pointermove', (ev) => this.onPointerMove(ev), { signal });
    this.overlayCanvas.addEventListener('pointerup', (ev) => this.onPointerUp(ev), { signal });
    this.overlayCanvas.addEventListener('pointerleave', () => {
      this.hoverTile = null;
    }, { signal });
    this.overlayCanvas.addEventListener('pointercancel', () => {
      this.drag = null;
    }, { signal });

    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => this.syncSize());
      this.resizeObserver.observe(surface);
    }
  }

  public start(): void {
    if (this.rafId !== null) return;
    this.lastMs = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(64, now - this.lastMs);
      this.lastMs = now;
      this.runtime?.step(dt);
      this.render();
      this.rafId = window.requestAnimationFrame(tick);
    };
    this.rafId = window.requestAnimationFrame(tick);
  }

  public stop(): void {
    if (this.rafId !== null) window.cancelAnimationFrame(this.rafId);
    this.rafId = null;
  }

  public destroy(): void {
    this.stop();
    this.resizeObserver?.disconnect();
  }

  public setRuntime(runtime: CutsceneStageRuntime | null, overlay: StageOverlay | null): void {
    this.runtime = runtime;
    this.overlay = overlay;
    this.mapBackdrop = null;
    this.hintEl.textContent = overlay?.hint ?? '';
    this.syncSize();
  }

  public setOverlay(overlay: StageOverlay): void {
    this.overlay = overlay;
    this.hintEl.textContent = overlay.hint;
  }

  public async setMapBackdrop(map: DungeonMapDefinition | null, hint: string): Promise<void> {
    this.runtime = null;
    this.overlay = null;
    this.hintEl.textContent = hint;
    if (!map) {
      this.mapBackdrop = null;
      return;
    }
    const canvas = document.createElement('canvas');
    await renderDungeonMapPreviewCanvas(canvas, map);
    this.mapBackdrop = { map, canvas };
    this.syncSize();
  }

  public setMapBackdropHint(hint: string): void {
    this.hintEl.textContent = hint;
  }

  private syncSize(): void {
    const surface = this.canvas.parentElement;
    if (!surface) return;
    const rect = surface.getBoundingClientRect();
    this.cssW = Math.max(200, Math.floor(rect.width));
    this.cssH = Math.max(160, Math.floor(rect.height));
    const loc = this.runtime?.location;
    if (this.view === 'fit' && loc) {
      const fit = Math.min(this.cssW / (loc.width * PMD_TILE_NATIVE_PX), this.cssH / (loc.height * PMD_TILE_NATIVE_PX));
      this.zoom = Math.max(1, Math.min(4, Math.floor(fit)));
    } else {
      this.zoom = 2;
    }
    if (this.mapBackdrop) {
      const fit = Math.min(this.cssW / this.mapBackdrop.canvas.width, this.cssH / this.mapBackdrop.canvas.height);
      this.zoom = Math.max(1, Math.min(4, Math.floor(fit)));
    }
    const nativeW = Math.ceil(this.cssW / this.zoom);
    const nativeH = Math.ceil(this.cssH / this.zoom);
    if (this.canvas.width !== nativeW || this.canvas.height !== nativeH) {
      this.canvas.width = nativeW;
      this.canvas.height = nativeH;
    }
    this.canvas.style.width = `${nativeW * this.zoom}px`;
    this.canvas.style.height = `${nativeH * this.zoom}px`;
    const dpr = window.devicePixelRatio || 1;
    this.overlayCanvas.width = Math.round(nativeW * this.zoom * dpr);
    this.overlayCanvas.height = Math.round(nativeH * this.zoom * dpr);
    this.overlayCanvas.style.width = `${nativeW * this.zoom}px`;
    this.overlayCanvas.style.height = `${nativeH * this.zoom}px`;
  }

  private camera(): { camX: number; camY: number } {
    const rt = this.runtime!;
    const save = { x: rt.cameraTileX, y: rt.cameraTileY };
    if (this.view === 'fit') {
      rt.cameraTileX = (rt.location.width - 1) / 2;
      rt.cameraTileY = (rt.location.height - 1) / 2;
    } else if (this.camOverride) {
      rt.cameraTileX = this.camOverride.x;
      rt.cameraTileY = this.camOverride.y;
    }
    const cam = computeCutsceneCamera(rt, this.canvas.width, this.canvas.height, this.cssH);
    rt.cameraTileX = save.x;
    rt.cameraTileY = save.y;
    return cam;
  }

  private render(): void {
    const ctx = this.ctx;
    ctx.imageSmoothingEnabled = false;
    if (this.mapBackdrop) {
      this.renderMapBackdrop();
      return;
    }
    const rt = this.runtime;
    this.octx.setTransform(1, 0, 0, 1, 0, 0);
    this.octx.clearRect(0, 0, this.overlayCanvas.width, this.overlayCanvas.height);
    if (!rt) {
      ctx.fillStyle = '#080e1c';
      ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
      return;
    }
    const restore = { x: rt.cameraTileX, y: rt.cameraTileY };
    if (this.view === 'fit') {
      rt.cameraTileX = (rt.location.width - 1) / 2;
      rt.cameraTileY = (rt.location.height - 1) / 2;
    }
    const shake = rt.screenShakeRemainingMs;
    rt.screenShakeRemainingMs = 0;
    const { cssFilter } = renderCutsceneStageFrame({
      ctx,
      nativeW: this.canvas.width,
      nativeH: this.canvas.height,
      viewHeightCss: this.cssH,
      runtime: rt,
      ambientMotes: this.motes,
    });
    rt.screenShakeRemainingMs = shake;
    rt.cameraTileX = restore.x;
    rt.cameraTileY = restore.y;
    if (this.canvas.style.filter !== cssFilter) this.canvas.style.filter = cssFilter;
    this.drawGhosts();
    this.drawOverlay();
  }

  private renderMapBackdrop(): void {
    const { canvas } = this.mapBackdrop!;
    const ctx = this.ctx;
    ctx.fillStyle = '#080e1c';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    const ox = Math.floor((this.canvas.width - canvas.width) / 2);
    const oy = Math.floor((this.canvas.height - canvas.height) / 2);
    ctx.globalAlpha = 0.85;
    ctx.drawImage(canvas, ox, oy);
    ctx.globalAlpha = 1;
    const o = this.octx;
    const dpr = window.devicePixelRatio || 1;
    o.setTransform(dpr, 0, 0, dpr, 0, 0);
    o.clearRect(0, 0, this.overlayCanvas.width, this.overlayCanvas.height);
    if (this.hoverTile && this.onMapTileTap) {
      const s = PMD_TILE_NATIVE_PX * this.zoom;
      o.strokeStyle = '#f8d048';
      o.lineWidth = 2;
      o.strokeRect((ox * this.zoom) + this.hoverTile.x * s, (oy * this.zoom) + this.hoverTile.y * s, s, s);
    }
  }

  private worldToCss(x: number, y: number, cam: { camX: number; camY: number }): { x: number; y: number } {
    return {
      x: (x * PMD_TILE_NATIVE_PX - cam.camX) * this.zoom,
      y: (y * PMD_TILE_NATIVE_PX - cam.camY) * this.zoom,
    };
  }

  private drawGhosts(): void {
    const rt = this.runtime;
    const ov = this.overlay;
    if (!rt || !ov) return;
    const cam = this.camera();
    for (const ghost of ov.ghosts) {
      const actor = rt.actors.find((a) => a.actorId === ghost.castId);
      if (!actor || !actor.available || actor.offStage) continue;
      const g: RuntimeCutsceneActor = {
        ...actor,
        x: ghost.x,
        y: ghost.y,
        direction: ghost.facing ?? actor.direction,
        alpha: 0.45,
        hop: null,
        emote: null,
        shakeRemainingMs: 0,
        walk: null,
        visible: true,
        action: 'Idle',
        poseAnim: null,
      };
      drawCutsceneActor(this.ctx, g, cam.camX, cam.camY, rt.animClockMs, rt.caches.spriteBundles.get(actor.visualAssetKey));
    }
  }

  private drawOverlay(): void {
    const rt = this.runtime!;
    const ov = this.overlay;
    const o = this.octx;
    const dpr = window.devicePixelRatio || 1;
    o.setTransform(dpr, 0, 0, dpr, 0, 0);
    const cam = this.camera();
    const tile = PMD_TILE_NATIVE_PX * this.zoom;

    if (this.showGrid) {
      o.strokeStyle = 'rgba(168, 224, 248, 0.16)';
      o.lineWidth = 1;
      o.beginPath();
      for (let x = 0; x <= rt.location.width; x++) {
        const p = this.worldToCss(x, 0, cam);
        o.moveTo(Math.round(p.x) + 0.5, p.y);
        o.lineTo(Math.round(p.x) + 0.5, p.y + rt.location.height * tile);
      }
      for (let y = 0; y <= rt.location.height; y++) {
        const p = this.worldToCss(0, y, cam);
        o.moveTo(p.x, Math.round(p.y) + 0.5);
        o.lineTo(p.x + rt.location.width * tile, Math.round(p.y) + 0.5);
      }
      o.stroke();
    }

    if (ov) {
      for (const path of ov.paths) {
        if (path.points.length < 2) continue;
        o.strokeStyle = path.highlighted ? '#f8e048' : (path.color ?? 'rgba(248, 224, 72, 0.55)');
        o.lineWidth = path.highlighted ? 3 : 2;
        o.setLineDash([6, 4]);
        o.beginPath();
        path.points.forEach((pt, i) => {
          const p = this.worldToCss(pt.x + 0.5, pt.y + 0.75, cam);
          if (i === 0) o.moveTo(p.x, p.y);
          else o.lineTo(p.x, p.y);
        });
        o.stroke();
        o.setLineDash([]);
        for (const pt of path.points.slice(1)) {
          const p = this.worldToCss(pt.x + 0.5, pt.y + 0.75, cam);
          o.fillStyle = path.highlighted ? '#f8e048' : 'rgba(248, 224, 72, 0.7)';
          o.beginPath();
          o.arc(p.x, p.y, path.highlighted ? 4 : 3, 0, Math.PI * 2);
          o.fill();
        }
      }
      for (const m of ov.markers) {
        const p = this.worldToCss(m.x + 0.5, m.y + 0.5, cam);
        o.strokeStyle = m.color;
        o.lineWidth = 2;
        o.beginPath();
        o.moveTo(p.x - 8, p.y);
        o.lineTo(p.x + 8, p.y);
        o.moveTo(p.x, p.y - 8);
        o.lineTo(p.x, p.y + 8);
        o.stroke();
        this.drawLabel(m.label, p.x, p.y - 12, m.color);
      }
      for (const actor of rt.actors) {
        if (!actor.available || !actor.visible || actor.offStage) continue;
        const selected = ov.selectedCastId === actor.actorId;
        const draggable = ov.draggable.has(actor.actorId);
        const p = this.worldToCss(actor.x + 0.5, actor.y + 1, cam);
        if (selected) {
          o.strokeStyle = '#f8e048';
          o.lineWidth = 2;
          o.strokeRect(p.x - tile / 2 + 1, p.y - tile + 1, tile - 2, tile - 2);
        }
        this.drawLabel(actor.nickname, p.x, p.y + 11, draggable ? '#a8e0f8' : 'rgba(232, 240, 255, 0.75)');
      }
    }

    if (this.hoverTile) {
      const p = this.worldToCss(this.hoverTile.x, this.hoverTile.y, cam);
      o.strokeStyle = 'rgba(248, 208, 72, 0.9)';
      o.lineWidth = 1;
      const size = this.halfTileSnap ? tile / 2 : tile;
      o.strokeRect(Math.round(p.x) + 0.5, Math.round(p.y) + 0.5, size, size);
    }

    if (this.showPhoneFrame) this.drawPhoneFrame(cam);
  }

  private drawPhoneFrame(cam: { camX: number; camY: number }): void {
    const rt = this.runtime!;
    const phone = computeCutsceneCamera(rt, PHONE_NATIVE.w, PHONE_NATIVE.h, PHONE_NATIVE.viewHeightCss);
    const x = (phone.camX - cam.camX) * this.zoom;
    const y = (phone.camY - cam.camY) * this.zoom;
    const w = PHONE_NATIVE.w * this.zoom;
    const hgt = PHONE_NATIVE.h * this.zoom;
    const o = this.octx;
    o.strokeStyle = 'rgba(255, 136, 152, 0.85)';
    o.lineWidth = 2;
    o.setLineDash([10, 6]);
    o.strokeRect(x, y, w, hgt);
    o.setLineDash([]);
    o.fillStyle = 'rgba(255, 136, 152, 0.18)';
    o.fillRect(x, y + hgt * 0.62, w, hgt * 0.38);
    this.drawLabel('Phone view (dialogue box shaded)', x + w / 2, y - 6, 'rgba(255, 170, 180, 0.95)');
  }

  private drawLabel(text: string, x: number, y: number, color: string): void {
    const o = this.octx;
    o.font = '12px "Fusion Pixel 12px Proportional KR", monospace';
    o.textAlign = 'center';
    o.textBaseline = 'middle';
    const w = o.measureText(text).width + 8;
    o.fillStyle = 'rgba(8, 14, 28, 0.78)';
    o.fillRect(x - w / 2, y - 8, w, 16);
    o.fillStyle = color;
    o.fillText(text, x, y);
  }

  private eventToTile(ev: PointerEvent): { x: number; y: number; rawX: number; rawY: number } | null {
    const rect = this.overlayCanvas.getBoundingClientRect();
    const cssX = ev.clientX - rect.left;
    const cssY = ev.clientY - rect.top;
    if (this.mapBackdrop) {
      const { canvas } = this.mapBackdrop;
      const ox = Math.floor((this.canvas.width - canvas.width) / 2) * this.zoom;
      const oy = Math.floor((this.canvas.height - canvas.height) / 2) * this.zoom;
      const s = PMD_TILE_NATIVE_PX * this.zoom;
      const x = Math.floor((cssX - ox) / s);
      const y = Math.floor((cssY - oy) / s);
      if (x < 0 || y < 0 || x >= this.mapBackdrop.map.width || y >= this.mapBackdrop.map.height) return null;
      return { x, y, rawX: x, rawY: y };
    }
    if (!this.runtime) return null;
    const cam = this.camera();
    const rawX = (cssX / this.zoom + cam.camX) / PMD_TILE_NATIVE_PX;
    const rawY = (cssY / this.zoom + cam.camY) / PMD_TILE_NATIVE_PX;
    const snap = (v: number) => (this.halfTileSnap ? Math.floor(v * 2) / 2 : Math.floor(v));
    return { x: snap(rawX), y: snap(rawY), rawX, rawY };
  }

  private hitCast(rawX: number, rawY: number): string | null {
    const rt = this.runtime;
    if (!rt) return null;
    let best: { id: string; d: number } | null = null;
    for (const a of rt.actors) {
      if (!a.available || !a.visible || a.offStage) continue;
      const dx = rawX - (a.x + 0.5);
      const dy = rawY - (a.y + 0.4);
      const d = Math.hypot(dx, dy * 0.8);
      if (d < 0.7 && (!best || d < best.d)) best = { id: a.actorId, d };
    }
    return best?.id ?? null;
  }

  private hitProp(rawX: number, rawY: number): string | null {
    const rt = this.runtime;
    if (!rt || !this.overlay) return null;
    for (const p of rt.props) {
      if (!this.overlay.draggableProps.has(p.id)) continue;
      if (rawX >= p.x && rawX < p.x + 1 && rawY >= p.y && rawY < p.y + 1) return p.id;
    }
    return null;
  }

  private onPointerDown(ev: PointerEvent): void {
    if (ev.button !== 0 && ev.pointerType === 'mouse') return;
    const t = this.eventToTile(ev);
    if (!t || this.mapBackdrop) return;
    const castId = this.hitCast(t.rawX, t.rawY);
    if (castId) {
      this.drag = { kind: 'cast', id: castId, pointerId: ev.pointerId, moved: false, startX: ev.clientX, startY: ev.clientY };
      this.overlayCanvas.setPointerCapture(ev.pointerId);
      return;
    }
    const propId = this.hitProp(t.rawX, t.rawY);
    if (propId) {
      this.drag = { kind: 'prop', id: propId, pointerId: ev.pointerId, moved: false, startX: ev.clientX, startY: ev.clientY };
      this.overlayCanvas.setPointerCapture(ev.pointerId);
    }
  }

  private onPointerMove(ev: PointerEvent): void {
    const t = this.eventToTile(ev);
    this.hoverTile = t ? { x: t.x, y: t.y } : null;
    if (this.mapBackdrop) return;
    const drag = this.drag;
    if (!drag || drag.pointerId !== ev.pointerId || !t) return;
    if (!drag.moved && Math.hypot(ev.clientX - drag.startX, ev.clientY - drag.startY) < 6) return;
    const allowed = drag.kind === 'cast' ? this.overlay?.draggable.has(drag.id) : this.overlay?.draggableProps.has(drag.id);
    if (!allowed) return;
    drag.moved = true;
    if (drag.kind === 'cast') {
      const actor = this.runtime?.actors.find((a) => a.actorId === drag.id);
      if (actor) {
        actor.x = t.x;
        actor.y = t.y;
      }
      this.callbacks.onDragCast(drag.id, t.x, t.y, false);
    } else {
      const prop = this.runtime?.props.find((p) => p.id === drag.id);
      if (prop) {
        prop.x = t.x;
        prop.y = t.y;
      }
      this.callbacks.onDragProp(drag.id, t.x, t.y, false);
    }
  }

  private onPointerUp(ev: PointerEvent): void {
    const t = this.eventToTile(ev);
    if (this.mapBackdrop) {
      if (t && this.onMapTileTap) this.onMapTileTap(t.x, t.y);
      return;
    }
    const drag = this.drag;
    this.drag = null;
    if (drag && drag.pointerId === ev.pointerId) {
      if (drag.moved && t) {
        if (drag.kind === 'cast') this.callbacks.onDragCast(drag.id, t.x, t.y, true);
        else this.callbacks.onDragProp(drag.id, t.x, t.y, true);
        return;
      }
      if (drag.kind === 'cast') {
        this.callbacks.onSelectCast(drag.id);
        return;
      }
    }
    if (t) this.callbacks.onTapTile(t.x, t.y);
  }

  public setGameCameraOverride(cam: { x: number; y: number } | null): void {
    this.camOverride = cam;
  }

  public refreshLayout(): void {
    this.syncSize();
  }
}

export function facingToDirection(facing: string | undefined): PmdDirection | undefined {
  return facing ? normalizePmdDirection(facing as never, 0) : undefined;
}
