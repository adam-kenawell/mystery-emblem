/**
 * Cutscene Media Library (`mediaLibrary.ts`)
 *
 * Auto-discovers background images, prop images, and story sound effects dropped into
 * `assets/cutscene-backgrounds/`, `assets/cutscene-props/`, and `assets/sfx/`. Files uploaded
 * by the Dev Tools editor during a session are registered at runtime so they work right away.
 */

const backgroundModules = import.meta.glob<string>(
  '/assets/cutscene-backgrounds/*.{png,webp,gif,jpg,jpeg}',
  { eager: true, query: '?url', import: 'default' }
);
const propModules = import.meta.glob<string>(
  '/assets/cutscene-props/*.{png,webp,gif,jpg,jpeg}',
  { eager: true, query: '?url', import: 'default' }
);
const sfxModules = import.meta.glob<string>(
  '/assets/sfx/*.{mp3,ogg,opus,webm,wav,m4a}',
  { eager: true, query: '?url', import: 'default' }
);

export type MediaFolder = 'cutscene-backgrounds' | 'cutscene-props' | 'sfx';

function toNameMap(modules: Record<string, string>): Map<string, string> {
  const map = new Map<string, string>();
  for (const [path, url] of Object.entries(modules)) {
    map.set(path.split('/').pop() ?? path, url);
  }
  return map;
}

const libraries: Record<MediaFolder, Map<string, string>> = {
  'cutscene-backgrounds': toNameMap(backgroundModules),
  'cutscene-props': toNameMap(propModules),
  sfx: toNameMap(sfxModules),
};

export function listMediaFiles(folder: MediaFolder): string[] {
  return [...libraries[folder].keys()].sort((a, b) =>
    a.localeCompare(b, undefined, { numeric: true })
  );
}

export function resolveMediaUrl(folder: MediaFolder, fileName: string | undefined): string | null {
  if (!fileName) return null;
  return libraries[folder].get(fileName) ?? null;
}

/** Registers a file uploaded this session (served from the project folder by the dev server). */
export function registerUploadedMedia(folder: MediaFolder, fileName: string): void {
  libraries[folder].set(fileName, `/assets/${folder}/${encodeURIComponent(fileName)}`);
}

export function unregisterMedia(folder: MediaFolder, fileName: string): void {
  libraries[folder].delete(fileName);
}

const imageCache = new Map<string, Promise<HTMLImageElement | null>>();

export function loadMediaImage(url: string): Promise<HTMLImageElement | null> {
  const cached = imageCache.get(url);
  if (cached) return cached;
  const promise = new Promise<HTMLImageElement | null>((resolve) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
  imageCache.set(url, promise);
  return promise;
}
