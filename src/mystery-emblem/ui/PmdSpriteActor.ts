/**
 * Crisp `image-rendering: pixelated` 8-Directional Map Sprite Actor (`PmdSpriteActor.ts`)
 */

import {
  loadSpeciesSpriteBundle,
  normalizePmdDirection,
  type LoadedActionAnimation,
  type LoadedSpriteBundle,
  type PmdDirection,
  type PmdDirectionInput,
  type PmdSpriteAction,
} from '../assets/pmdAssetLoader';
import {
  DESKTOP_SPRITE_SCALE,
  destroyAllPmdSpriteActors,
  getDefaultPmdSpriteScale,
  MOBILE_SPRITE_SCALE,
  registerScheduledSpriteActor,
  unregisterScheduledSpriteActor,
  type ScheduledSpriteActor,
} from './pmdSpriteScheduler';
import { bindPointerTap } from './pointerControls';

export {
  DESKTOP_SPRITE_SCALE,
  MOBILE_SPRITE_SCALE,
  destroyAllPmdSpriteActors,
  getDefaultPmdSpriteScale,
};

export interface PmdSpriteActorOptions {
  speciesIdOrAssetId: string;
  scale?: number;
  initialAction?: PmdSpriteAction;
  initialDirection?: PmdDirectionInput;
  fixedBoxPx?: { width: number; height: number };
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

export class PmdSpriteActor implements ScheduledSpriteActor {
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
    this.direction = normalizePmdDirection(options.initialDirection, 0);
    this.usesResponsiveDefaultScale = options.scale === undefined;
    this.scale = options.scale ?? getDefaultPmdSpriteScale();
    this.fixedBoxPx = options.fixedBoxPx;

    this.canvas = document.createElement('canvas');
    this.canvas.className = 'pmd-sprite-canvas pmd-pixelated';
    this.canvas.style.imageRendering = 'pixelated';
    if (options.testId) this.canvas.dataset.testid = options.testId;

    this.canvas.width = 32;
    this.canvas.height = 32;
    this.syncCanvasDimensions();

    this.ctx = this.canvas.getContext('2d')!;
    this.ctx.imageSmoothingEnabled = false;

    if (options.interactiveTapAttack) {
      this.canvas.style.cursor = 'inherit';
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

    registerScheduledSpriteActor(this);
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
    if (this.destroyed || token !== this.loadToken) return null;

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

  public setDirection(direction: PmdDirectionInput): void {
    this.direction = normalizePmdDirection(direction, 0);
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
    if (!this.usesResponsiveDefaultScale || this.destroyed || this.scale === nextScale) return;
    this.scale = nextScale;
    this.syncCanvasDimensions();
    this.ctx.imageSmoothingEnabled = false;
    this.syncDataset();
    this.drawCurrentFrame();
  }

  public tick(now: number): void {
    if (this.destroyed || !this.bundle || now < this.nextFrameAt) return;
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
      displayWidthPx: this.fixedBoxPx
        ? this.fixedBoxPx.width
        : Math.round(this.canvas.width * this.scale),
      displayHeightPx: this.fixedBoxPx
        ? this.fixedBoxPx.height
        : Math.round(this.canvas.height * this.scale),
      imageSmoothingEnabled: this.ctx.imageSmoothingEnabled,
      synthesizedFallback: anim.synthesizedFallback,
    };
  }

  public destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.tapAbort.abort();
    unregisterScheduledSpriteActor(this);
  }

  private syncCanvasDimensions(): void {
    const baseW = Math.max(16, this.bundle?.maxFrameWidth ?? 32);
    const baseH = Math.max(16, this.bundle?.maxFrameHeight ?? 32);
    this.canvas.width = baseW;
    this.canvas.height = baseH;
    this.canvas.style.width = `${this.fixedBoxPx ? this.fixedBoxPx.width : Math.round(baseW * this.scale)}px`;
    this.canvas.style.height = `${this.fixedBoxPx ? this.fixedBoxPx.height : Math.round(baseH * this.scale)}px`;
  }

  private getCurrentAnim(): LoadedActionAnimation | null {
    return this.bundle ? (this.bundle.actions[this.action] ?? this.bundle.actions.Idle) : null;
  }

  private getCurrentFrameDuration(): number {
    const anim = this.getCurrentAnim();
    return anim ? (anim.durationsMs[this.frameIndex % anim.durationsMs.length] ?? 140) : 140;
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
    const safeDir = normalizePmdDirection(this.direction, 0);
    const rowIdx = anim.rowCount >= 8 ? safeDir : safeDir % Math.max(1, anim.rowCount);
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
