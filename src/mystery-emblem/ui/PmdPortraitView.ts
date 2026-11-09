/**
 * Crisp `image-rendering: pixelated` Multi-Emotion Portrait Canvas (`PmdPortraitView.ts`)
 */

import {
  loadSpeciesPortrait,
  type LoadedPortraitAsset,
  type PmdPortraitEmotion,
} from '../assets/pmdAssetLoader';
import { DESKTOP_SPRITE_SCALE } from './PmdSpriteActor';

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
    this.canvas.dataset.emotion = params.emotion;
    this.canvas.dataset.requestedEmotion = params.emotion;
    const asset = await loadSpeciesPortrait(params.speciesIdOrAssetId, params.emotion);
    if (token !== this.loadToken) return null;

    this.lastAsset = asset;
    this.mirrored = Boolean(params.mirrorHorizontal);
    this.canvas.width = asset.width;
    this.canvas.height = asset.height;

    this.canvas.dataset.speciesId = asset.speciesId ?? '';
    this.canvas.dataset.pmdAssetId = asset.pmdAssetId;
    this.canvas.dataset.emotion = asset.requestedEmotion;
    this.canvas.dataset.requestedEmotion = asset.requestedEmotion;
    this.canvas.dataset.resolvedEmotion = asset.resolvedEmotion;
    this.canvas.dataset.mirrored = String(this.mirrored);
    this.canvas.dataset.sourceUrl = asset.sourceUrl;

    this.redraw();
    return asset;
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
