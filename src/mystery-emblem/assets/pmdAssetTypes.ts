/**
 * PMD Asset Types, 8-Directional Math & Tile Footline Placement (`pmdAssetTypes.ts`)
 */

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

export type PmdNamedDirection =
  | 'Down'
  | 'DownRight'
  | 'Right'
  | 'UpRight'
  | 'Up'
  | 'UpLeft'
  | 'Left'
  | 'DownLeft';

export type PmdDirectionInput = PmdDirection | PmdCompassCode | PmdNamedDirection;

const NAMED_DIRECTION_TO_PMD_ROW: Readonly<Record<string, PmdDirection>> = {
  '0': 0, s: 0, south: 0, down: 0,
  '1': 1, se: 1, southeast: 1, downright: 1,
  '2': 2, e: 2, east: 2, right: 2,
  '3': 3, ne: 3, northeast: 3, upright: 3,
  '4': 4, n: 4, north: 4, up: 4,
  '5': 5, nw: 5, northwest: 5, upleft: 5,
  '6': 6, w: 6, west: 6, left: 6,
  '7': 7, sw: 7, southwest: 7, downleft: 7,
};

export function normalizePmdDirection(
  raw: PmdDirectionInput | number | string | null | undefined,
  fallback: PmdDirection = 0
): PmdDirection {
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    const mod = ((Math.round(raw) % 8) + 8) % 8;
    return mod as PmdDirection;
  }
  if (typeof raw === 'string') {
    const key = raw.trim().toLowerCase().replace(/[\s_-]+/g, '');
    const mapped = NAMED_DIRECTION_TO_PMD_ROW[key];
    if (mapped !== undefined) return mapped;
  }
  return fallback;
}

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

const ANGLE_TO_PMD_ROW: readonly PmdDirection[] = [2, 1, 0, 7, 6, 5, 4, 3];

export function directionFromDelta(dx: number, dy: number): PmdDirection {
  if (dx === 0 && dy === 0) return 0;
  const deg = ((Math.atan2(dy, dx) * 180) / Math.PI + 360) % 360;
  return ANGLE_TO_PMD_ROW[Math.round(deg / 45) % 8] ?? 0;
}

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

export const PMD_EXTENDED_PORTRAIT_EMOTIONS = [
  ...PMD_PORTRAIT_EMOTIONS,
  'Teary-Eyed',
  'Joyous',
  'Inspired',
  'Crying',
  'Stunned',
  'Dizzy',
  'Shouting',
] as const;

export type PmdPortraitEmotion = (typeof PMD_EXTENDED_PORTRAIT_EMOTIONS)[number];

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

export interface LoadedItemIconAsset {
  iconSlug: string;
  itemId?: string;
  source: CanvasImageSource;
  sourceUrl: string;
  width: number;
  height: number;
  cropX: number;
  cropY: number;
  cropW: number;
  cropH: number;
  synthesizedFallback: boolean;
}

export interface PmdTileSpritePlacement {
  drawX: number;
  drawY: number;
  shadowCenterX: number;
  shadowCenterY: number;
}

/**
 * Computes exact PMD: Explorers of Sky / PMDCollab tile-space sprite placement.
 * Anchors ground shadow `(frameWidth / 2, frameHeight / 2 + 4)` on the `24x24` tile footline `(12, 20)`.
 */
export function computePmdTileSpritePlacement(
  tileScreenX: number,
  tileScreenY: number,
  frameWidth: number,
  frameHeight: number,
  tileSizePx = 24
): PmdTileSpritePlacement {
  const halfTile = Math.floor(tileSizePx / 2);
  const footlineY = tileSizePx - 4;
  return {
    drawX: Math.round(tileScreenX + (tileSizePx - frameWidth) / 2),
    drawY: Math.round(tileScreenY + footlineY - (frameHeight / 2 + 4)),
    shadowCenterX: Math.round(tileScreenX + halfTile),
    shadowCenterY: Math.round(tileScreenY + footlineY),
  };
}

export function hashHue(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h) % 360;
}

export function createOfflineCrestCanvas(seed: string, size = 40): HTMLCanvasElement {
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
