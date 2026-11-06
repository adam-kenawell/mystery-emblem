/**
 * Crisp `image-rendering: pixelated` 8-Directional Map Sprite & Emotion Portrait Renderers (Step 2)
 */

import {
  loadSpeciesPortrait,
  loadSpeciesSpriteBundle,
  type LoadedActionAnimation,
  type LoadedPortraitAsset,
  type LoadedSpriteBundle,
  type PmdDirection,
  type PmdPortraitEmotion,
  type PmdSpriteAction,
} from '../assets/pmdAssetLoader';
import { bindPointerTap } from './pointerControls';

export const DESKTOP_SPRITE_SCALE = 1.5;
export const MOBILE_SPRITE_SCALE = 2;
const DESKTOP_VIEWPORT_QUERY = '(min-width: 641px) and (min-height: 501px)';

export function getDefaultPmdSpriteScale(): number {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return DESKTOP_SPRITE_SCALE;
  }
  return window.matchMedia(DESKTOP_VIEWPORT_QUERY).matches
    ? DESKTOP_SPRITE_SCALE
    : MOBILE_SPRITE_SCALE;
}

export interface PmdSpriteActorOptions {
  speciesIdOrAssetId: string;
  /** Uniform pixel scale override; defaults to `1.5` on Desktop and `2` on Mobile */
  scale?: number;
  initialAction?: PmdSpriteAction;
  initialDirection?: PmdDirection;
  /** Optional fixed logical CSS box; if omitted, sizes dynamically to `maxFrameWidth * scale` */
  fixedBoxPx?: { width: number; height: number };
  /** When true, tapping the sprite triggers a one-shot `Attack` animation */
  interactiveTapAttack?: boolean;
  testId?: string;
}

export interface PmdSpriteActorSnapshot {
  speciesId: string | undefined;
  pmdAssetId: string;
  action: PmdSpriteAction;
  direction: PmdDirection;
  frameIndex: number;
  xmlAnimName: string;
  sheetName: string;
  sourceUrl: string;
  frameWidth: number;
  frameHeight: number;
  frameCount: number;
  rowCount: number;
  scale: number;
  displayWidthPx: number;
  displayHeightPx: number;
  imageSmoothingEnabled: boolean;
  synthesizedFallback: boolean;
}

const activeActors = new Set<PmdSpriteActor>();
let actorRafRunning = false;
let mediaListenerBound = false;

function ensureResponsiveScaleListener(): void {
  if (
    mediaListenerBound ||
    typeof window === 'undefined' ||
    typeof window.matchMedia !== 'function'
  ) {
    return;
  }
  mediaListenerBound = true;
  const mql = window.matchMedia(DESKTOP_VIEWPORT_QUERY);
  const onViewportChange = () => {
    const nextScale = mql.matches ? DESKTOP_SPRITE_SCALE : MOBILE_SPRITE_SCALE;
    for (const actor of activeActors) {
      actor.applyResponsiveScale(nextScale);
    }
  };
  if (typeof mql.addEventListener === 'function') {
    mql.addEventListener('change', onViewportChange);
  }
}

function ensureActorLoop(): void {
  if (actorRafRunning) return;
  actorRafRunning = true;

  const step = (now: number) => {
    if (activeActors.size === 0) {
      actorRafRunning = false;
      return;
    }
    for (const actor of activeActors) {
      actor.tick(now);
    }
    requestAnimationFrame(step);
  };

  requestAnimationFrame(step);
}

export function destroyAllPmdSpriteActors(): void {
  for (const actor of [...activeActors]) {
    actor.destroy();
  }
  activeActors.clear();
  actorRafRunning = false;
}

export class PmdSpriteActor {
  public readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private bundle: LoadedSpriteBundle | null = null;
  private currentTarget: string;
  private action: PmdSpriteAction;
  private direction: PmdDirection;
  private scale: number;
  private usesResponsiveDefaultScale: boolean;
  private readonly fixedBoxPx?: { width: number; height: number };
  private frameIndex = 0;
  private nextFrameAt = 0;
  private loopCurrentAction = true;
  private onOneShotComplete: (() => void) | null = null;
  private loadToken = 0;
  private destroyed = false;
  private readonly tapAbort = new AbortController();

  constructor(options: PmdSpriteActorOptions) {
    this.currentTarget = options.speciesIdOrAssetId;
    this.action = options.initialAction ?? 'Idle';
    this.direction = options.initialDirection ?? 0;
    this.usesResponsiveDefaultScale = options.scale === undefined;
    this.scale = options.scale ?? getDefaultPmdSpriteScale();
    this.fixedBoxPx = options.fixedBoxPx;

    this.canvas = document.createElement('canvas');
    this.canvas.className = 'pmd-sprite-canvas pmd-pixelated';
    this.canvas.style.imageRendering = 'pixelated';
    if (options.testId) {
      this.canvas.dataset.testid = options.testId;
    }

    // Native 1:1 pixel buffer + CSS `image-rendering: pixelated` sizing avoids double-resampling
    // on fractional scales (e.g., 1.5x desktop -> exact 3x physical pixels on 2x HiDPI screens).
    this.canvas.width = 32;
    this.canvas.height = 32;
    this.syncCanvasDimensions();

    this.ctx = this.canvas.getContext('2d')!;
    this.ctx.imageSmoothingEnabled = false;

    if (options.interactiveTapAttack) {
      this.canvas.style.cursor = 'pointer';
      bindPointerTap(
        this.canvas,
        () => {
          this.setAction('Attack', {
            loop: false,
            onComplete: () => this.setAction('Idle', { loop: true }),
          });
        },
        { signal: this.tapAbort.signal, stopPropagation: true }
      );
    }

    activeActors.add(this);
    ensureResponsiveScaleListener();
    ensureActorLoop();
  }

  public async ready(): Promise<this> {
    await this.setSpecies(this.currentTarget);
    return this;
  }

  public async setSpecies(speciesIdOrAssetId: string): Promise<LoadedSpriteBundle | null> {
    if (this.destroyed) return null;
    this.currentTarget = speciesIdOrAssetId;
    const token = ++this.loadToken;
    const loaded = await loadSpeciesSpriteBundle(speciesIdOrAssetId);
    if (this.destroyed || token !== this.loadToken) {
      return null;
    }

    this.bundle = loaded;
    this.syncCanvasDimensions();
    this.ctx.imageSmoothingEnabled = false;
    this.frameIndex = 0;
    this.nextFrameAt = performance.now() + this.getCurrentFrameDuration();
    this.syncDataset();
    this.drawCurrentFrame();
    return loaded;
  }

  public setAction(
    action: PmdSpriteAction,
    opts?: { loop?: boolean; onComplete?: () => void }
  ): void {
    this.action = action;
    this.loopCurrentAction = opts?.loop ?? true;
    this.onOneShotComplete = opts?.onComplete ?? null;
    this.frameIndex = 0;
    this.nextFrameAt = performance.now() + this.getCurrentFrameDuration();
    this.syncDataset();
    this.drawCurrentFrame();
  }

  public setDirection(direction: PmdDirection): void {
    this.direction = direction;
    this.syncDataset();
    this.drawCurrentFrame();
  }

  public setScale(scale: number): void {
    this.usesResponsiveDefaultScale = false;
    this.scale = Math.max(0.5, scale);
    this.syncCanvasDimensions();
    this.ctx.imageSmoothingEnabled = false;
    this.syncDataset();
    this.drawCurrentFrame();
  }

  public applyResponsiveScale(nextScale: number): void {
    if (!this.usesResponsiveDefaultScale || this.destroyed) return;
    if (this.scale === nextScale) return;
    this.scale = nextScale;
    this.syncCanvasDimensions();
    this.ctx.imageSmoothingEnabled = false;
    this.syncDataset();
    this.drawCurrentFrame();
  }

  public tick(now: number): void {
    if (this.destroyed || !this.bundle) return;
    if (now < this.nextFrameAt) return;

    const anim = this.getCurrentAnim();
    if (!anim) return;

    const nextIdx = this.frameIndex + 1;
    if (nextIdx >= anim.frameCount) {
      if (!this.loopCurrentAction) {
        const cb = this.onOneShotComplete;
        this.onOneShotComplete = null;
        this.loopCurrentAction = true;
        if (cb) {
          cb();
          return;
        }
      }
      this.frameIndex = 0;
    } else {
      this.frameIndex = nextIdx;
    }

    this.nextFrameAt = now + this.getCurrentFrameDuration();
    this.drawCurrentFrame();
  }

  public getSnapshot(): PmdSpriteActorSnapshot | null {
    const anim = this.getCurrentAnim();
    if (!this.bundle || !anim) return null;
    const displayWidthPx = this.fixedBoxPx
      ? this.fixedBoxPx.width
      : Math.round(this.canvas.width * this.scale);
    const displayHeightPx = this.fixedBoxPx
      ? this.fixedBoxPx.height
      : Math.round(this.canvas.height * this.scale);
    return {
      speciesId: this.bundle.speciesId,
      pmdAssetId: this.bundle.pmdAssetId,
      action: this.action,
      direction: this.direction,
      frameIndex: this.frameIndex,
      xmlAnimName: anim.xmlAnimName,
      sheetName: anim.sheetName,
      sourceUrl: anim.sourceUrl,
      frameWidth: anim.frameWidth,
      frameHeight: anim.frameHeight,
      frameCount: anim.frameCount,
      rowCount: anim.rowCount,
      scale: this.scale,
      displayWidthPx,
      displayHeightPx,
      imageSmoothingEnabled: this.ctx.imageSmoothingEnabled,
      synthesizedFallback: anim.synthesizedFallback,
    };
  }

  public destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.tapAbort.abort();
    activeActors.delete(this);
  }

  private syncCanvasDimensions(): void {
    const baseW = Math.max(16, this.bundle?.maxFrameWidth ?? 32);
    const baseH = Math.max(16, this.bundle?.maxFrameHeight ?? 32);
    this.canvas.width = baseW;
    this.canvas.height = baseH;

    if (this.fixedBoxPx) {
      this.canvas.style.width = `${this.fixedBoxPx.width}px`;
      this.canvas.style.height = `${this.fixedBoxPx.height}px`;
    } else {
      this.canvas.style.width = `${Math.round(baseW * this.scale)}px`;
      this.canvas.style.height = `${Math.round(baseH * this.scale)}px`;
    }
  }

  private getCurrentAnim(): LoadedActionAnimation | null {
    if (!this.bundle) return null;
    return this.bundle.actions[this.action] ?? this.bundle.actions.Idle;
  }

  private getCurrentFrameDuration(): number {
    const anim = this.getCurrentAnim();
    if (!anim) return 140;
    return anim.durationsMs[this.frameIndex % anim.durationsMs.length] ?? 140;
  }

  private syncDataset(): void {
    const anim = this.getCurrentAnim();
    this.canvas.dataset.speciesId = this.bundle?.speciesId ?? '';
    this.canvas.dataset.pmdAssetId = this.bundle?.pmdAssetId ?? '';
    this.canvas.dataset.action = this.action;
    this.canvas.dataset.direction = String(this.direction);
    this.canvas.dataset.sheetName = anim?.sheetName ?? '';
    this.canvas.dataset.xmlAnimName = anim?.xmlAnimName ?? '';
    this.canvas.dataset.scale = String(this.scale);
  }

  private drawCurrentFrame(): void {
    const anim = this.getCurrentAnim();
    if (!anim) return;

    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.imageSmoothingEnabled = false;

    const frameIdx = this.frameIndex % Math.max(1, anim.frameCount);
    const rowIdx = anim.rowCount >= 8 ? this.direction : this.direction % anim.rowCount;

    // Draw 1:1 native texels centered in the species' max bounding box; CSS `style.width/height`
    // applies uniform `this.scale` (1.5x desktop, 2x mobile) across all actions via `image-rendering: pixelated`.
    const offsetX = Math.floor((this.canvas.width - anim.frameWidth) / 2);
    const offsetY = Math.floor((this.canvas.height - anim.frameHeight) / 2);

    this.ctx.drawImage(
      anim.source,
      frameIdx * anim.frameWidth,
      rowIdx * anim.frameHeight,
      anim.frameWidth,
      anim.frameHeight,
      offsetX,
      offsetY,
      anim.frameWidth,
      anim.frameHeight
    );
  }
}

export interface PmdPortraitViewOptions {
  pixelScale?: number;
  testId?: string;
}

export interface SetPortraitParams {
  speciesIdOrAssetId: string;
  emotion: PmdPortraitEmotion;
  mirrorHorizontal?: boolean;
}

export class PmdPortraitView {
  public readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly pixelScale: number;
  private loadToken = 0;
  private lastAsset: LoadedPortraitAsset | null = null;
  private mirrored = false;

  constructor(options: PmdPortraitViewOptions = {}) {
    this.pixelScale = options.pixelScale ?? DESKTOP_SPRITE_SCALE;
    this.canvas = document.createElement('canvas');
    // Native 40x40 portrait buffer + CSS pixelated scaling avoids double-resampling at 1.5x/1.6x/2x
    this.canvas.width = 40;
    this.canvas.height = 40;
    if (options.pixelScale !== undefined) {
      this.canvas.style.width = `${Math.round(40 * options.pixelScale)}px`;
      this.canvas.style.height = `${Math.round(40 * options.pixelScale)}px`;
    }
    this.canvas.className = 'pmd-portrait-canvas pmd-pixelated';
    this.canvas.style.imageRendering = 'pixelated';
    if (options.testId) {
      this.canvas.dataset.testid = options.testId;
    }

    this.ctx = this.canvas.getContext('2d')!;
    this.ctx.imageSmoothingEnabled = false;
  }

  public async setPortrait(params: SetPortraitParams): Promise<LoadedPortraitAsset | null> {
    const token = ++this.loadToken;
    const asset = await loadSpeciesPortrait(params.speciesIdOrAssetId, params.emotion);
    if (token !== this.loadToken) return null;

    this.lastAsset = asset;
    this.mirrored = Boolean(params.mirrorHorizontal);
    this.canvas.width = asset.width;
    this.canvas.height = asset.height;

    this.canvas.dataset.speciesId = asset.speciesId ?? '';
    this.canvas.dataset.pmdAssetId = asset.pmdAssetId;
    this.canvas.dataset.requestedEmotion = asset.requestedEmotion;
    this.canvas.dataset.resolvedEmotion = asset.resolvedEmotion;
    this.canvas.dataset.mirrored = String(this.mirrored);
    this.canvas.dataset.sourceUrl = asset.sourceUrl;

    this.redraw();
    return asset;
  }

  public setMirrored(mirrorHorizontal: boolean): void {
    this.mirrored = mirrorHorizontal;
    this.canvas.dataset.mirrored = String(this.mirrored);
    this.redraw();
  }

  public getSnapshot(): {
    pmdAssetId: string;
    speciesId?: string;
    requestedEmotion: PmdPortraitEmotion;
    resolvedEmotion: PmdPortraitEmotion;
    mirrored: boolean;
    sourceUrl: string;
    imageSmoothingEnabled: boolean;
  } | null {
    if (!this.lastAsset) return null;
    return {
      pmdAssetId: this.lastAsset.pmdAssetId,
      speciesId: this.lastAsset.speciesId,
      requestedEmotion: this.lastAsset.requestedEmotion,
      resolvedEmotion: this.lastAsset.resolvedEmotion,
      mirrored: this.mirrored,
      sourceUrl: this.lastAsset.sourceUrl,
      imageSmoothingEnabled: this.ctx.imageSmoothingEnabled,
    };
  }

  private redraw(): void {
    if (!this.lastAsset) return;
    const w = this.canvas.width;
    const h = this.canvas.height;
    this.ctx.clearRect(0, 0, w, h);
    this.ctx.imageSmoothingEnabled = false;

    this.ctx.save();
    if (this.mirrored) {
      this.ctx.translate(w, 0);
      this.ctx.scale(-1, 1);
    }
    this.ctx.drawImage(
      this.lastAsset.source,
      0,
      0,
      this.lastAsset.width,
      this.lastAsset.height,
      0,
      0,
      w,
      h
    );
    this.ctx.restore();
  }
}
