/**
 * PMD Asset Loader (Step 2)
 *
 * Connects to the site's PMDCollab / SpriteCollab Git repository endpoints to load and cache:
 * - 8-directional map sprite animations (`Idle`, `Walk`, `Attack`, `Special`, `Hurt`)
 * - Multi-emotion character portraits (`Normal`, `Happy`, `Determined`, `Angry`, `Pain`, `Worried`, `Surprised`, `Sad`)
 *
 * Strictly enforces crisp nearest-neighbor pixel rendering (`imageSmoothingEnabled = false`),
 * resolves `<CopyOf>` XML aliases without duplicate fetches, falls back cleanly to `Normal.png`
 * for partial emotion sheets, and synthesizes a nearest-neighbor 8-directional sprite sheet
 * from `Normal.png` for the 5 upstream-WIP species lacking `AnimData.xml`.
 */

import { SPECIES_MAP } from '../data/index';
import type { PokemonSpeciesDefinition } from '../types/schemas';
import {
  calcFrameInfo,
  fetchDetailedAnimData,
  loadImage,
  normalizeAssetPath,
  portraitUrl,
  spriteUrl,
  type DetailedAnimEntry,
} from '../../utils/sprite-utils';

export const PMD_SPRITE_ACTIONS = ['Idle', 'Walk', 'Attack', 'Special', 'Hurt'] as const;
export type PmdSpriteAction = (typeof PMD_SPRITE_ACTIONS)[number];

/**
 * Standard PMDCollab 8-row directional sprite layout:
 * 0 = South (Down), 1 = South-East, 2 = East (Right), 3 = North-East,
 * 4 = North (Up), 5 = North-West, 6 = West (Left), 7 = South-West.
 */
export const PMD_DIRECTIONS = [0, 1, 2, 3, 4, 5, 6, 7] as const;
export type PmdDirection = (typeof PMD_DIRECTIONS)[number];

export type PmdCompassCode = 'S' | 'SE' | 'E' | 'NE' | 'N' | 'NW' | 'W' | 'SW';

export interface PmdDirectionDescriptor {
  dir: PmdDirection;
  code: PmdCompassCode;
  label: string;
  dx: number;
  dy: number;
}

export const PMD_DIRECTION_INFO: readonly PmdDirectionDescriptor[] = [
  { dir: 0, code: 'S', label: 'Down (S)', dx: 0, dy: 1 },
  { dir: 1, code: 'SE', label: 'Down-Right (SE)', dx: 1, dy: 1 },
  { dir: 2, code: 'E', label: 'Right (E)', dx: 1, dy: 0 },
  { dir: 3, code: 'NE', label: 'Up-Right (NE)', dx: 1, dy: -1 },
  { dir: 4, code: 'N', label: 'Up (N)', dx: 0, dy: -1 },
  { dir: 5, code: 'NW', label: 'Up-Left (NW)', dx: -1, dy: -1 },
  { dir: 6, code: 'W', label: 'Left (W)', dx: -1, dy: 0 },
  { dir: 7, code: 'SW', label: 'Down-Left (SW)', dx: -1, dy: 1 },
];

export const PMD_PORTRAIT_EMOTIONS = [
  'Normal',
  'Happy',
  'Determined',
  'Angry',
  'Pain',
  'Worried',
  'Surprised',
  'Sad',
] as const;

export type PmdPortraitEmotion = (typeof PMD_PORTRAIT_EMOTIONS)[number];

export interface LoadedActionAnimation {
  canonicalAction: PmdSpriteAction;
  xmlAnimName: string;
  sheetName: string;
  source: CanvasImageSource;
  sourceUrl: string;
  frameWidth: number;
  frameHeight: number;
  frameCount: number;
  rowCount: number;
  durationsMs: number[];
  hitFrame?: number;
  synthesizedFallback: boolean;
}

export interface LoadedSpriteBundle {
  pmdAssetId: string;
  speciesId?: string;
  shadowSize: number;
  maxFrameWidth: number;
  maxFrameHeight: number;
  synthesizedFallback: boolean;
  actions: Record<PmdSpriteAction, LoadedActionAnimation>;
}

export interface LoadedPortraitAsset {
  pmdAssetId: string;
  speciesId?: string;
  requestedEmotion: PmdPortraitEmotion;
  resolvedEmotion: PmdPortraitEmotion;
  source: CanvasImageSource;
  sourceUrl: string;
  width: number;
  height: number;
  synthesizedFallback: boolean;
}

export interface PmdTileSpritePlacement {
  /** Top-left X where the animation frame should be drawn in native pixel coordinates */
  drawX: number;
  /** Top-left Y where the animation frame should be drawn in native pixel coordinates */
  drawY: number;
  /** Ground-shadow / tile-foot center X (`tileScreenX + 12` for a `24x24` PMD tile) */
  shadowCenterX: number;
  /** Ground-shadow / tile-foot center Y (`tileScreenY + 20` for a `24x24` PMD tile) */
  shadowCenterY: number;
}

/**
 * Computes exact PMD: Explorers of Sky / PMDCollab tile-space sprite placement.
 *
 * In PMDCollab (`SpriteCollab`), every action frame (`Idle`, `Walk`, `Attack`, `Special`, `Hurt`)
 * anchors the Pokémon's ground shadow (`*-Shadow.png` white pixel) at `(frameWidth / 2, frameHeight / 2 + 4)`.
 * Placing that ground-shadow anchor on the `24x24` tile's lower footline `(12, 20)` centers grounded
 * and floating Pokémon cleanly inside their `24x24` tile with zero vertical drift across actions.
 */
export function computePmdTileSpritePlacement(
  tileScreenX: number,
  tileScreenY: number,
  frameWidth: number,
  frameHeight: number,
  tileSizePx = 24
): PmdTileSpritePlacement {
  const halfTile = Math.floor(tileSizePx / 2);
  const footlineY = tileSizePx - 4; // 20 inside a 0..23 PMD tile
  return {
    drawX: Math.round(tileScreenX + (tileSizePx - frameWidth) / 2),
    drawY: Math.round(tileScreenY + footlineY - (frameHeight / 2 + 4)),
    shadowCenterX: Math.round(tileScreenX + halfTile),
    shadowCenterY: Math.round(tileScreenY + footlineY),
  };
}

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

const ANGLE_TO_PMD_ROW: readonly PmdDirection[] = [2, 1, 0, 7, 6, 5, 4, 3];

export function directionFromDelta(dx: number, dy: number): PmdDirection {
  if (dx === 0 && dy === 0) return 0;
  const deg = ((Math.atan2(dy, dx) * 180) / Math.PI + 360) % 360;
  return ANGLE_TO_PMD_ROW[Math.round(deg / 45) % 8] ?? 0;
}

export function resolveSpeciesAssetTarget(speciesIdOrAssetId: string): {
  pmdAssetId: string;
  species?: PokemonSpeciesDefinition;
} {
  const trimmed = speciesIdOrAssetId.trim();
  const species = SPECIES_MAP.get(trimmed);
  if (species) {
    return { pmdAssetId: species.pmdAssetId, species };
  }
  return { pmdAssetId: normalizeAssetPath(trimmed) };
}

const spriteBundleCache = new Map<string, Promise<LoadedSpriteBundle>>();
const portraitCache = new Map<string, Promise<LoadedPortraitAsset>>();

export function clearPmdAssetCache(): void {
  spriteBundleCache.clear();
  portraitCache.clear();
}

function hashHue(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h) % 360;
}

function createOfflineCrestCanvas(seed: string, size = 40): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;

  const hue = hashHue(seed);
  ctx.fillStyle = `hsl(${hue}, 42%, 22%)`;
  ctx.fillRect(0, 0, size, size);

  ctx.strokeStyle = '#48b8e8';
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, size - 2, size - 2);

  ctx.fillStyle = `hsl(${(hue + 40) % 360}, 78%, 62%)`;
  const pad = Math.floor(size * 0.25);
  ctx.fillRect(pad, pad, size - pad * 2, size - pad * 2);

  ctx.fillStyle = '#f8d048';
  ctx.fillRect(pad + 3, pad + 3, 4, 4);
  ctx.fillRect(size - pad - 7, pad + 3, 4, 4);
  return canvas;
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

      // Crisp pixel shadow oval anchored at `(frameW / 2, frameH / 2 + 4)` = `(16, 20)`
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

  // Pick best XML entry (if any) per canonical action
  const chosenXmlByAction: Partial<Record<PmdSpriteAction, DetailedAnimEntry>> = {};
  const sheetsToFetch = new Set<string>();

  for (const canonical of PMD_SPRITE_ACTIONS) {
    const candidates = ACTION_CANDIDATE_CHAINS[canonical];
    for (const candidateName of candidates) {
      const entry = anims[candidateName];
      if (entry) {
        chosenXmlByAction[canonical] = entry;
        sheetsToFetch.add(entry.resolvedSheetName);
        break;
      }
    }
  }

  // If XML was missing or incomplete, also probe core direct PNG names before falling back
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

  // If zero sprite PNGs exist upstream (the 5 WIP species), synthesize from portrait!
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

  // Pick a guaranteed base fallback sheet (`Walk` or `Idle` or first loaded sheet)
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

    // If the primary XML candidate's PNG failed to load, try remaining candidates in chain
    if (!loadedSheet) {
      for (const candidateName of ACTION_CANDIDATE_CHAINS[canonical]) {
        const altXml = anims[candidateName];
        const sheetKey = altXml?.resolvedSheetName ?? candidateName;
        const found = sheetImages.get(sheetKey);
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
    const normalAsset = await loadSpeciesPortrait(speciesId ?? pmdAssetId, 'Normal');
    return {
      ...normalAsset,
      requestedEmotion: emotion,
      resolvedEmotion: normalAsset.resolvedEmotion,
    };
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
