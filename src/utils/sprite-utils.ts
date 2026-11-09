export interface FrameInfo {
  w: number;
  h: number;
  count: number;
}

export interface DetailedAnimEntry {
  name: string;
  /** Underlying PMDCollab sheet name after resolving `<CopyOf>` chains (e.g. `SpAttack` -> `RearUp`) */
  resolvedSheetName: string;
  copyOf?: string;
  w: number;
  h: number;
  durationsMs: number[];
  rushFrame?: number;
  hitFrame?: number;
  returnFrame?: number;
}

interface DetailedAnimData {
  shadowSize: number;
  anims: Record<string, DetailedAnimEntry>;
}

const SPRITE_BASE = 'https://raw.githubusercontent.com/PMDCollab/SpriteCollab/master/sprite';
const PORTRAIT_BASE = 'https://raw.githubusercontent.com/PMDCollab/SpriteCollab/master/portrait';
const ITEM_SPRITE_BASE = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items';

export function itemSpriteUrl(iconSlug: string): string {
  return `${ITEM_SPRITE_BASE}/${encodeURIComponent(iconSlug.trim())}.png`;
}

export function normalizeAssetPath(pokemonIdOrPath: number | string): string {
  if (typeof pokemonIdOrPath === 'number') {
    return String(pokemonIdOrPath).padStart(4, '0');
  }
  const trimmed = pokemonIdOrPath.trim();
  if (/^\d+$/.test(trimmed)) {
    return trimmed.padStart(4, '0');
  }
  return trimmed;
}

export function spriteUrl(pokemonIdOrPath: number | string, action: string): string {
  const path = normalizeAssetPath(pokemonIdOrPath);
  return `${SPRITE_BASE}/${path}/${action}-Anim.png`;
}

export function portraitUrl(
  pokemonIdOrPath: number | string,
  emotion: string,
  flippedVariant = false
): string {
  const path = normalizeAssetPath(pokemonIdOrPath);
  const fileStem = flippedVariant ? `${emotion}^` : emotion;
  return `${PORTRAIT_BASE}/${path}/${encodeURIComponent(fileStem)}.png`;
}

function animDataUrl(pokemonIdOrPath: number | string): string {
  const path = normalizeAssetPath(pokemonIdOrPath);
  return `${SPRITE_BASE}/${path}/AnimData.xml`;
}

export function loadImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

function parseOptionalInt(text: string | null | undefined): number | undefined {
  if (!text) return undefined;
  const n = parseInt(text.trim(), 10);
  return Number.isFinite(n) ? n : undefined;
}

/**
 * Fetches and parses PMDCollab `AnimData.xml` including `<CopyOf>` aliases and per-frame
 * 60fps tick `<Durations>` (converted to milliseconds).
 */
export async function fetchDetailedAnimData(
  pokemonIdOrPath: number | string
): Promise<DetailedAnimData | null> {
  try {
    const res = await fetch(animDataUrl(pokemonIdOrPath));
    if (!res.ok) return null;
    const text = await res.text();
    const doc = new DOMParser().parseFromString(text, 'text/xml');
    if (doc.querySelector('parsererror')) return null;

    const shadowSize = parseOptionalInt(doc.querySelector('ShadowSize')?.textContent) ?? 1;
    interface RawNode {
      name: string;
      copyOf?: string;
      w: number;
      h: number;
      durationsMs: number[];
      rushFrame?: number;
      hitFrame?: number;
      returnFrame?: number;
    }

    const rawMap = new Map<string, RawNode>();
    doc.querySelectorAll('Anim').forEach((el) => {
      const name = el.querySelector('Name')?.textContent?.trim() ?? '';
      if (!name) return;
      const copyOf = el.querySelector('CopyOf')?.textContent?.trim() || undefined;
      const w = parseOptionalInt(el.querySelector('FrameWidth')?.textContent) ?? 0;
      const h = parseOptionalInt(el.querySelector('FrameHeight')?.textContent) ?? 0;
      const durationsMs: number[] = [];
      el.querySelectorAll('Durations > Duration').forEach((durEl) => {
        const ticks = parseOptionalInt(durEl.textContent);
        if (ticks && ticks > 0) {
          durationsMs.push(Math.max(24, Math.round((ticks * 1000) / 60)));
        }
      });

      rawMap.set(name, {
        name,
        copyOf,
        w,
        h,
        durationsMs,
        rushFrame: parseOptionalInt(el.querySelector('RushFrame')?.textContent),
        hitFrame: parseOptionalInt(el.querySelector('HitFrame')?.textContent),
        returnFrame: parseOptionalInt(el.querySelector('ReturnFrame')?.textContent),
      });
    });

    const resolveEntry = (name: string, visited = new Set<string>()): DetailedAnimEntry | null => {
      if (visited.has(name)) return null;
      const node = rawMap.get(name);
      if (!node) return null;

      if (node.copyOf) {
        visited.add(name);
        const target = resolveEntry(node.copyOf, visited);
        if (!target) return null;
        return {
          name,
          resolvedSheetName: target.resolvedSheetName,
          copyOf: node.copyOf,
          w: node.w > 0 ? node.w : target.w,
          h: node.h > 0 ? node.h : target.h,
          durationsMs: node.durationsMs.length > 0 ? node.durationsMs : target.durationsMs,
          rushFrame: node.rushFrame ?? target.rushFrame,
          hitFrame: node.hitFrame ?? target.hitFrame,
          returnFrame: node.returnFrame ?? target.returnFrame,
        };
      }

      if (node.w <= 0 || node.h <= 0) return null;
      return {
        name,
        resolvedSheetName: name,
        w: node.w,
        h: node.h,
        durationsMs: node.durationsMs,
        rushFrame: node.rushFrame,
        hitFrame: node.hitFrame,
        returnFrame: node.returnFrame,
      };
    };

    const anims: Record<string, DetailedAnimEntry> = {};
    for (const key of rawMap.keys()) {
      const resolved = resolveEntry(key);
      if (resolved) {
        anims[key] = resolved;
      }
    }

    return { shadowSize, anims };
  } catch {
    return null;
  }
}

export function calcFrameInfo(img: HTMLImageElement, dims?: { w: number; h: number }): FrameInfo {
  if (dims && dims.w > 0 && dims.h > 0) {
    return {
      w: dims.w,
      h: dims.h,
      count: Math.max(1, Math.floor(img.naturalWidth / dims.w)),
    };
  }
  const size = Math.max(1, Math.floor(img.naturalHeight / 8));
  return {
    w: size,
    h: size,
    count: Math.max(1, Math.floor(img.naturalWidth / size)),
  };
}
