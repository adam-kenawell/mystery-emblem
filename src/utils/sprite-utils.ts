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

export interface DetailedAnimData {
  shadowSize: number;
  anims: Record<string, DetailedAnimEntry>;
}

export const SPRITE_BASE = 'https://raw.githubusercontent.com/PMDCollab/SpriteCollab/master/sprite';
export const PORTRAIT_BASE =
  'https://raw.githubusercontent.com/PMDCollab/SpriteCollab/master/portrait';

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

export function animDataUrl(pokemonIdOrPath: number | string): string {
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

export async function fetchAnimData(
  pokemonIdOrPath: number | string
): Promise<Record<string, { w: number; h: number }>> {
  const detailed = await fetchDetailedAnimData(pokemonIdOrPath);
  if (!detailed) return {};
  const result: Record<string, { w: number; h: number }> = {};
  for (const [name, entry] of Object.entries(detailed.anims)) {
    result[name] = { w: entry.w, h: entry.h };
  }
  return result;
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

const WIDGET_ACTIONS = ['Walk', 'Idle', 'Attack', 'Sleep'] as const;
type WidgetAction = (typeof WIDGET_ACTIONS)[number];

interface SpriteWidgetInstance {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  sheets: Record<WidgetAction, HTMLImageElement | null>;
  frameInfo: Record<WidgetAction, FrameInfo | null>;
  frame: number;
  state: 'idle' | 'attacking';
  stateEnd: number;
  direction: number;
  nextFrameTime: number;
  scale: number;
}

let activeWidgets: SpriteWidgetInstance[] = [];
let widgetLoopRunning = false;

export function resetSpriteWidgets(): void {
  activeWidgets = [];
  widgetLoopRunning = false;
}

function startWidgetLoop(): void {
  if (widgetLoopRunning) return;
  widgetLoopRunning = true;

  function tick() {
    if (activeWidgets.length === 0) {
      widgetLoopRunning = false;
      return;
    }
    const now = performance.now();
    for (const w of activeWidgets) {
      const frameDuration = w.state === 'attacking' ? 80 : 150;
      if (now >= w.nextFrameTime) {
        w.nextFrameTime = now + frameDuration;
        const action: WidgetAction = w.state === 'attacking' ? 'Attack' : 'Idle';
        const sheet = w.sheets[action] || w.sheets.Idle || w.sheets.Walk;
        const info = w.frameInfo[action] || w.frameInfo.Idle || w.frameInfo.Walk;
        if (!sheet || !info) continue;

        const frameIdx = w.frame % info.count;
        w.ctx.clearRect(0, 0, w.canvas.width, w.canvas.height);
        w.ctx.imageSmoothingEnabled = false;
        const offsetX = Math.floor((w.canvas.width - info.w * w.scale) / 2);
        const offsetY = Math.floor((w.canvas.height - info.h * w.scale) / 2);
        w.ctx.drawImage(
          sheet,
          frameIdx * info.w,
          w.direction * info.h,
          info.w,
          info.h,
          offsetX,
          offsetY,
          info.w * w.scale,
          info.h * w.scale
        );
        w.frame++;
      }
      if (w.state === 'attacking' && now > w.stateEnd) {
        w.state = 'idle';
        w.frame = 0;
        w.nextFrameTime = 0;
      }
    }
    requestAnimationFrame(tick);
  }

  requestAnimationFrame(tick);
}

export async function createSpriteWidget(
  pokemonIdOrPath: number | string,
  scale = 2
): Promise<HTMLCanvasElement | null> {
  if (typeof pokemonIdOrPath === 'number' && pokemonIdOrPath <= 0) return null;
  if (typeof pokemonIdOrPath === 'string' && pokemonIdOrPath.trim().length === 0) return null;

  const detailed = await fetchDetailedAnimData(pokemonIdOrPath);
  const anims = detailed?.anims ?? {};

  const sheetNameFor = (act: WidgetAction): string => anims[act]?.resolvedSheetName ?? act;
  const [walkImg, idleImg, attackImg, sleepImg] = await Promise.all([
    loadImage(spriteUrl(pokemonIdOrPath, sheetNameFor('Walk'))),
    loadImage(spriteUrl(pokemonIdOrPath, sheetNameFor('Idle'))),
    loadImage(spriteUrl(pokemonIdOrPath, sheetNameFor('Attack'))),
    loadImage(spriteUrl(pokemonIdOrPath, sheetNameFor('Sleep'))),
  ]);
  if (!walkImg && !idleImg) return null;

  const sheets: Record<WidgetAction, HTMLImageElement | null> = {
    Walk: walkImg,
    Idle: idleImg,
    Attack: attackImg,
    Sleep: sleepImg,
  };
  const frameInfo: Record<WidgetAction, FrameInfo | null> = {
    Walk: walkImg ? calcFrameInfo(walkImg, anims.Walk) : null,
    Idle: idleImg ? calcFrameInfo(idleImg, anims.Idle) : null,
    Attack: attackImg ? calcFrameInfo(attackImg, anims.Attack) : null,
    Sleep: sleepImg ? calcFrameInfo(sleepImg, anims.Sleep) : null,
  };

  let maxW = 0;
  let maxH = 0;
  for (const act of WIDGET_ACTIONS) {
    const info = frameInfo[act];
    if (info) {
      if (info.w > maxW) maxW = info.w;
      if (info.h > maxH) maxH = info.h;
    }
  }

  const canvas = document.createElement('canvas');
  canvas.width = maxW * scale;
  canvas.height = maxH * scale;
  canvas.className = 'poke-sprite-canvas';
  canvas.style.imageRendering = 'pixelated';
  canvas.style.cursor = 'pointer';

  const ctx = canvas.getContext('2d')!;
  const widget: SpriteWidgetInstance = {
    canvas,
    ctx,
    sheets,
    frameInfo,
    frame: 0,
    state: 'idle',
    stateEnd: 0,
    direction: 0,
    nextFrameTime: 0,
    scale,
  };

  canvas.addEventListener('pointerdown', () => {
    const atkInfo = widget.frameInfo.Attack;
    if (widget.sheets.Attack && atkInfo) {
      widget.state = 'attacking';
      widget.frame = 0;
      widget.nextFrameTime = performance.now();
      widget.stateEnd = performance.now() + atkInfo.count * 80;
    }
  });

  activeWidgets.push(widget);
  startWidgetLoop();
  return canvas;
}
