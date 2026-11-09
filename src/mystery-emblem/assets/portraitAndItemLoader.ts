/**
 * Multi-Emotion Character Portrait & Item Sprite Loaders (`portraitAndItemLoader.ts`)
 */

import { itemSpriteUrl, loadImage, portraitUrl } from '../../utils/sprite-utils';
import {
  createOfflineCrestCanvas,
  hashHue,
  type LoadedItemIconAsset,
  type LoadedPortraitAsset,
  type PmdPortraitEmotion,
} from './pmdAssetTypes';
import { resolveItemIconTarget, resolveSpeciesAssetTarget } from './subformResolver';

const portraitCache = new Map<string, Promise<LoadedPortraitAsset>>();
const itemIconCache = new Map<string, Promise<LoadedItemIconAsset>>();

export function clearPortraitAndItemCache(): void {
  portraitCache.clear();
  itemIconCache.clear();
}

async function loadPortraitUncached(
  pmdAssetId: string,
  emotion: PmdPortraitEmotion,
  speciesId?: string
): Promise<LoadedPortraitAsset> {
  const requestedUrl = portraitUrl(pmdAssetId, emotion, false);
  const primaryImg = await loadImage(requestedUrl);
  if (primaryImg) {
    return {
      pmdAssetId,
      speciesId,
      requestedEmotion: emotion,
      resolvedEmotion: emotion,
      source: primaryImg,
      sourceUrl: requestedUrl,
      width: primaryImg.naturalWidth || 40,
      height: primaryImg.naturalHeight || 40,
      synthesizedFallback: false,
    };
  }

  if (emotion !== 'Normal') {
    const normalAsset = await loadSpeciesPortrait(pmdAssetId, 'Normal');
    if (pmdAssetId.includes('/') && normalAsset.pmdAssetId !== pmdAssetId) {
      const baseAssetId = pmdAssetId.split('/')[0]!;
      const baseEmotionAsset = await loadSpeciesPortrait(baseAssetId, emotion);
      return {
        ...baseEmotionAsset,
        speciesId: speciesId ?? baseEmotionAsset.speciesId,
        requestedEmotion: emotion,
      };
    }
    return {
      ...normalAsset,
      speciesId: speciesId ?? normalAsset.speciesId,
      requestedEmotion: emotion,
      resolvedEmotion: normalAsset.resolvedEmotion,
    };
  }

  if (pmdAssetId.includes('/')) {
    const baseAssetId = pmdAssetId.split('/')[0]!;
    const baseNormalAsset = await loadSpeciesPortrait(baseAssetId, 'Normal');
    if (!baseNormalAsset.synthesizedFallback) {
      return {
        ...baseNormalAsset,
        speciesId: speciesId ?? baseNormalAsset.speciesId,
        requestedEmotion: emotion,
      };
    }
  }

  const crest = createOfflineCrestCanvas(speciesId ?? pmdAssetId, 40);
  return {
    pmdAssetId,
    speciesId,
    requestedEmotion: emotion,
    resolvedEmotion: 'Normal',
    source: crest,
    sourceUrl: `synthesized://offline-portrait/${pmdAssetId}`,
    width: crest.width,
    height: crest.height,
    synthesizedFallback: true,
  };
}

export function loadSpeciesPortrait(
  speciesIdOrAssetId: string,
  emotion: PmdPortraitEmotion = 'Normal'
): Promise<LoadedPortraitAsset> {
  const { pmdAssetId, species } = resolveSpeciesAssetTarget(speciesIdOrAssetId);
  const cacheKey = `${pmdAssetId}::${emotion}`;
  const cached = portraitCache.get(cacheKey);
  if (cached) {
    return cached.then((asset) =>
      species && asset.speciesId !== species.id ? { ...asset, speciesId: species.id } : asset
    );
  }

  const promise = loadPortraitUncached(pmdAssetId, emotion, species?.id);
  portraitCache.set(cacheKey, promise);
  return promise;
}

function createOfflineItemCanvas(seed: string, size = 30): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;

  const hue = hashHue(seed);
  const pad = 5;
  const inner = size - pad * 2;

  ctx.fillStyle = '#081018';
  ctx.fillRect(pad - 1, pad - 1, inner + 2, inner + 2);

  ctx.fillStyle = `hsl(${hue}, 68%, 52%)`;
  ctx.fillRect(pad + 1, pad + 1, inner - 2, inner - 2);

  ctx.strokeStyle = '#f8f8f8';
  ctx.lineWidth = 1;
  ctx.strokeRect(pad + 0.5, pad + 0.5, inner - 1, inner - 1);

  ctx.fillStyle = '#f8f880';
  ctx.fillRect(pad + 3, pad + 3, 4, 4);
  return canvas;
}

function normalizeAndMeasureItemSprite(img: HTMLImageElement): {
  source: CanvasImageSource;
  width: number;
  height: number;
  cropX: number;
  cropY: number;
  cropW: number;
  cropH: number;
} {
  const rawW = img.naturalWidth || 30;
  const rawH = img.naturalHeight || 30;
  const targetW = rawW > 30 ? 30 : rawW;
  const targetH = rawH > 30 ? 30 : rawH;

  const scratch = document.createElement('canvas');
  scratch.width = targetW;
  scratch.height = targetH;
  const ctx = scratch.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(img, 0, 0, rawW, rawH, 0, 0, targetW, targetH);

  let minX = targetW;
  let minY = targetH;
  let maxX = -1;
  let maxY = -1;
  try {
    const data = ctx.getImageData(0, 0, targetW, targetH).data;
    for (let y = 0; y < targetH; y++) {
      for (let x = 0; x < targetW; x++) {
        const alpha = data[(y * targetW + x) * 4 + 3] ?? 0;
        if (alpha > 16) {
          if (x < minX) minX = x;
          if (y < minY) minY = y;
          if (x > maxX) maxX = x;
          if (y > maxY) maxY = y;
        }
      }
    }
  } catch {
    // Ignore tainted-canvas security errors if any
  }

  const hasBounds = maxX >= minX && maxY >= minY;
  return {
    source: rawW > 30 || rawH > 30 ? scratch : img,
    width: targetW,
    height: targetH,
    cropX: hasBounds ? minX : 0,
    cropY: hasBounds ? minY : 0,
    cropW: hasBounds ? Math.max(1, maxX - minX + 1) : targetW,
    cropH: hasBounds ? Math.max(1, maxY - minY + 1) : targetH,
  };
}

async function loadItemIconUncached(
  iconSlug: string,
  itemId?: string
): Promise<LoadedItemIconAsset> {
  const requestedUrl = itemSpriteUrl(iconSlug);
  const img = await loadImage(requestedUrl);
  if (img) {
    const measured = normalizeAndMeasureItemSprite(img);
    return {
      iconSlug,
      itemId,
      source: measured.source,
      sourceUrl: requestedUrl,
      width: measured.width,
      height: measured.height,
      cropX: measured.cropX,
      cropY: measured.cropY,
      cropW: measured.cropW,
      cropH: measured.cropH,
      synthesizedFallback: false,
    };
  }

  const fallback = createOfflineItemCanvas(itemId ?? iconSlug, 30);
  return {
    iconSlug,
    itemId,
    source: fallback,
    sourceUrl: `synthesized://offline-item/${iconSlug}`,
    width: fallback.width,
    height: fallback.height,
    cropX: 4,
    cropY: 4,
    cropW: fallback.width - 8,
    cropH: fallback.height - 8,
    synthesizedFallback: true,
  };
}

export function loadItemIcon(itemIdOrSlug: string): Promise<LoadedItemIconAsset> {
  const { iconSlug, item } = resolveItemIconTarget(itemIdOrSlug);
  const cached = itemIconCache.get(iconSlug);
  if (cached) {
    return cached.then((asset) =>
      item && asset.itemId !== item.id ? { ...asset, itemId: item.id } : asset
    );
  }

  const promise = loadItemIconUncached(iconSlug, item?.id);
  itemIconCache.set(iconSlug, promise);
  return promise;
}
