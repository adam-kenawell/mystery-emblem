/**
 * 8-Directional PMD Sprite Bundle Loader & Portrait-Token Fallback (`spriteBundleLoader.ts`)
 */

import {
  calcFrameInfo,
  fetchDetailedAnimData,
  loadImage,
  spriteUrl,
  type DetailedAnimEntry,
} from '../../utils/sprite-utils';
import {
  PMD_DIRECTION_INFO,
  PMD_SPRITE_ACTIONS,
  type LoadedActionAnimation,
  type LoadedSpriteBundle,
  type PmdSpriteAction,
} from './pmdAssetTypes';
import { loadSpeciesPortrait } from './portraitAndItemLoader';
import { resolveSpeciesAssetTarget } from './subformResolver';

const ACTION_CANDIDATE_CHAINS: Record<PmdSpriteAction, readonly string[]> = {
  Idle: ['Idle', 'Walk'],
  Walk: ['Walk', 'Idle'],
  Attack: ['Attack', 'Strike', 'Swing', 'Double', 'Hop', 'Charge', 'Walk', 'Idle'],
  Special: [
    'SpAttack',
    'Shoot',
    'Special',
    'Charge',
    'Appeal',
    'Double',
    'Twirl',
    'Hop',
    'Attack',
    'Walk',
    'Idle',
  ],
  Hurt: ['Hurt', 'Pain', 'Cringe', 'Shake', 'TumbleBack', 'Walk', 'Idle'],
};

const DEFAULT_FRAME_DURATION_MS: Record<PmdSpriteAction, number> = {
  Idle: 160,
  Walk: 120,
  Attack: 75,
  Special: 85,
  Hurt: 110,
};

const spriteBundleCache = new Map<string, Promise<LoadedSpriteBundle>>();

export function clearSpriteBundleCache(): void {
  spriteBundleCache.clear();
}

function synthesizeSpriteSheetFromPortrait(
  portraitSource: CanvasImageSource,
  srcW: number,
  srcH: number,
  action: PmdSpriteAction
): LoadedActionAnimation {
  const frameW = 32;
  const frameH = 32;
  const frameCount = 4;
  const rowCount = 8;

  const sheet = document.createElement('canvas');
  sheet.width = frameW * frameCount;
  sheet.height = frameH * rowCount;
  const ctx = sheet.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;

  for (let dir = 0; dir < rowCount; dir++) {
    const dirInfo = PMD_DIRECTION_INFO[dir]!;
    const flipWest = dirInfo.dx < 0;

    for (let f = 0; f < frameCount; f++) {
      const cellX = f * frameW;
      const cellY = dir * frameH;

      let ox = 0;
      let oy = 0;
      if (action === 'Idle') {
        oy = f % 2 === 1 ? -1 : 0;
      } else if (action === 'Walk') {
        oy = f % 2 === 1 ? -2 : 0;
        ox = f === 1 ? dirInfo.dx : f === 3 ? -dirInfo.dx : 0;
      } else if (action === 'Attack') {
        const lunge = f === 1 ? 3 : f === 2 ? 2 : 0;
        ox = dirInfo.dx * lunge;
        oy = dirInfo.dy * lunge;
      } else if (action === 'Special') {
        oy = f === 1 || f === 2 ? -2 : 0;
      } else if (action === 'Hurt') {
        ox = f === 1 ? -2 : f === 2 ? 2 : 0;
        oy = f === 1 ? 1 : 0;
      }

      ctx.fillStyle = 'rgba(8, 14, 26, 0.45)';
      ctx.fillRect(cellX + 9, cellY + 18, 14, 4);

      const tokenSize = 20;
      const drawX = cellX + Math.floor((frameW - tokenSize) / 2) + ox;
      const drawY = cellY + 3 + oy;

      ctx.save();
      if (flipWest) {
        ctx.translate(drawX + tokenSize, drawY);
        ctx.scale(-1, 1);
        ctx.drawImage(portraitSource, 0, 0, srcW, srcH, 0, 0, tokenSize, tokenSize);
      } else {
        ctx.drawImage(portraitSource, 0, 0, srcW, srcH, drawX, drawY, tokenSize, tokenSize);
      }
      ctx.restore();

      if (action === 'Special' && (f === 1 || f === 2)) {
        ctx.strokeStyle = f === 1 ? '#48b8e8' : '#f8d048';
        ctx.lineWidth = 1;
        ctx.strokeRect(drawX - 1.5, drawY - 1.5, tokenSize + 3, tokenSize + 3);
      } else if (action === 'Hurt' && f === 1) {
        ctx.fillStyle = 'rgba(255, 120, 120, 0.38)';
        ctx.fillRect(drawX, drawY, tokenSize, tokenSize);
      }
    }
  }

  const dur = DEFAULT_FRAME_DURATION_MS[action];
  return {
    canonicalAction: action,
    xmlAnimName: 'PortraitToken',
    sheetName: 'PortraitToken',
    source: sheet,
    sourceUrl: `synthesized://portrait-token/${action}`,
    frameWidth: frameW,
    frameHeight: frameH,
    frameCount,
    rowCount,
    durationsMs: [dur, dur, dur, dur],
    hitFrame: action === 'Attack' || action === 'Special' ? 1 : undefined,
    synthesizedFallback: true,
  };
}

function normalizeDurations(
  rawDurations: number[] | undefined,
  frameCount: number,
  action: PmdSpriteAction
): number[] {
  const fallback = DEFAULT_FRAME_DURATION_MS[action];
  const out: number[] = [];
  for (let i = 0; i < frameCount; i++) {
    const val = rawDurations?.[i];
    out.push(val && val > 0 ? val : fallback);
  }
  return out;
}

async function loadSpriteBundleUncached(
  pmdAssetId: string,
  speciesId?: string
): Promise<LoadedSpriteBundle> {
  const detailed = await fetchDetailedAnimData(pmdAssetId);
  const anims = detailed?.anims ?? {};

  const chosenXmlByAction: Partial<Record<PmdSpriteAction, DetailedAnimEntry>> = {};
  const sheetsToFetch = new Set<string>();

  for (const canonical of PMD_SPRITE_ACTIONS) {
    for (const candidateName of ACTION_CANDIDATE_CHAINS[canonical]) {
      const entry = anims[candidateName];
      if (entry) {
        chosenXmlByAction[canonical] = entry;
        sheetsToFetch.add(entry.resolvedSheetName);
        break;
      }
    }
  }

  if (sheetsToFetch.size === 0) {
    for (const direct of ['Idle', 'Walk', 'Attack', 'Shoot', 'Hurt']) {
      sheetsToFetch.add(direct);
    }
  }

  const sheetImages = new Map<string, { img: HTMLImageElement; url: string }>();
  await Promise.all(
    [...sheetsToFetch].map(async (sheetName) => {
      const url = spriteUrl(pmdAssetId, sheetName);
      const img = await loadImage(url);
      if (img) {
        sheetImages.set(sheetName, { img, url });
      }
    })
  );

  if (sheetImages.size === 0) {
    const portrait = await loadSpeciesPortrait(speciesId ?? pmdAssetId, 'Normal');
    const actions = {} as Record<PmdSpriteAction, LoadedActionAnimation>;
    for (const canonical of PMD_SPRITE_ACTIONS) {
      actions[canonical] = synthesizeSpriteSheetFromPortrait(
        portrait.source,
        portrait.width,
        portrait.height,
        canonical
      );
    }
    return {
      pmdAssetId,
      speciesId,
      shadowSize: 1,
      maxFrameWidth: 32,
      maxFrameHeight: 32,
      synthesizedFallback: true,
      actions,
    };
  }

  const fallbackSheetEntry =
    sheetImages.get(anims.Walk?.resolvedSheetName ?? 'Walk') ??
    sheetImages.get(anims.Idle?.resolvedSheetName ?? 'Idle') ??
    [...sheetImages.values()][0]!;
  const fallbackXml = anims.Walk ?? anims.Idle;

  const actions = {} as Record<PmdSpriteAction, LoadedActionAnimation>;
  let maxFrameWidth = 0;
  let maxFrameHeight = 0;

  for (const canonical of PMD_SPRITE_ACTIONS) {
    let xmlEntry: DetailedAnimEntry | undefined = chosenXmlByAction[canonical];
    let loadedSheet = xmlEntry ? sheetImages.get(xmlEntry.resolvedSheetName) : undefined;

    if (!loadedSheet) {
      for (const candidateName of ACTION_CANDIDATE_CHAINS[canonical]) {
        const altXml = anims[candidateName];
        const found = sheetImages.get(altXml?.resolvedSheetName ?? candidateName);
        if (found) {
          xmlEntry = altXml;
          loadedSheet = found;
          break;
        }
      }
    }

    if (!loadedSheet) {
      xmlEntry = fallbackXml;
      loadedSheet = fallbackSheetEntry;
    }

    const info = calcFrameInfo(
      loadedSheet.img,
      xmlEntry ? { w: xmlEntry.w, h: xmlEntry.h } : undefined
    );
    const rowCount = Math.max(1, Math.floor(loadedSheet.img.naturalHeight / info.h));
    const durationsMs = normalizeDurations(xmlEntry?.durationsMs, info.count, canonical);

    if (info.w > maxFrameWidth) maxFrameWidth = info.w;
    if (info.h > maxFrameHeight) maxFrameHeight = info.h;

    actions[canonical] = {
      canonicalAction: canonical,
      xmlAnimName: xmlEntry?.name ?? canonical,
      sheetName: xmlEntry?.resolvedSheetName ?? canonical,
      source: loadedSheet.img,
      sourceUrl: loadedSheet.url,
      frameWidth: info.w,
      frameHeight: info.h,
      frameCount: info.count,
      rowCount,
      durationsMs,
      hitFrame: xmlEntry?.hitFrame,
      synthesizedFallback: false,
    };
  }

  return {
    pmdAssetId,
    speciesId,
    shadowSize: detailed?.shadowSize ?? 1,
    maxFrameWidth,
    maxFrameHeight,
    synthesizedFallback: false,
    actions,
  };
}

export function loadSpeciesSpriteBundle(speciesIdOrAssetId: string): Promise<LoadedSpriteBundle> {
  const { pmdAssetId, species } = resolveSpeciesAssetTarget(speciesIdOrAssetId);
  const cacheKey = `${pmdAssetId}::${species?.id ?? ''}`;
  const cached = spriteBundleCache.get(cacheKey);
  if (cached) return cached;

  const promise = loadSpriteBundleUncached(pmdAssetId, species?.id);
  spriteBundleCache.set(cacheKey, promise);
  return promise;
}
