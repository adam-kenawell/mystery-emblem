/**
 * Cutscene Editor Pickers: Pokémon, Emotions, Songs & Media Uploads (`editorPickers.ts`)
 */

import {
  PMD_EXTENDED_PORTRAIT_EMOTIONS,
  loadSpeciesPortrait,
  type PmdPortraitEmotion,
} from '../assets/pmdAssetLoader';
import { getAudioManager } from '../audio/AudioManager';
import {
  getPlayOnceTrackIds,
  PMD_BGM_TRACKS,
  registerUploadedTrack,
  setTrackPlaysOnce,
} from '../audio/audioTracks';
import {
  listMediaFiles,
  registerUploadedMedia,
  resolveMediaUrl,
  type MediaFolder,
} from '../data/cutscenes/mediaLibrary';
import { POKEMON_SPECIES_LIST } from '../data/index';
import { uploadProjectAsset, writeProjectJson } from '../ui/devtools/projectFileClient';
import { button, h, selectInput, type UiContext } from './editorDom';
import { dexToSpriteCollabId, POKEMON_NAMES_BY_DEX } from './pokemonNames';

let datalistMounted = false;

/** Text box with autocomplete over every Pokémon; reports a SpriteCollab id like `0497`. */
export function pokemonPicker(ui: UiContext, currentId: string, onPick: (pokemonId: string, name: string) => void): HTMLElement {
  if (!datalistMounted) {
    const list = h('datalist', { id: 'cse-pokemon-names' });
    POKEMON_NAMES_BY_DEX.forEach((name, i) => list.append(h('option', { value: `${name} #${i + 1}` })));
    document.body.append(list);
    datalistMounted = true;
  }
  const dex = Number(currentId.split('/')[0]);
  const input = h('input', {
    class: 'cse-input',
    list: 'cse-pokemon-names',
    placeholder: 'Type a Pokémon name…',
    'data-testid': 'cse-pokemon-picker',
  });
  input.value = Number.isFinite(dex) && POKEMON_NAMES_BY_DEX[dex - 1] ? `${POKEMON_NAMES_BY_DEX[dex - 1]} #${dex}` : currentId;
  input.addEventListener(
    'change',
    () => {
      const m = input.value.match(/#(\d+)\s*$/);
      let found = m ? Number(m[1]) : NaN;
      if (!Number.isFinite(found)) {
        const idx = POKEMON_NAMES_BY_DEX.findIndex((n) => n.toLowerCase() === input.value.trim().toLowerCase());
        found = idx >= 0 ? idx + 1 : NaN;
      }
      if (Number.isFinite(found) && found >= 1 && found <= POKEMON_NAMES_BY_DEX.length) {
        onPick(dexToSpriteCollabId(found), POKEMON_NAMES_BY_DEX[found - 1]!);
      }
    },
    { signal: ui.signal }
  );
  return input;
}

/** Game species (for recruits / show-if hero checks). */
export function speciesOptions(filter?: (factions: string) => boolean): Array<{ value: string; label: string }> {
  return POKEMON_SPECIES_LIST.filter((s) => !filter || filter(s.faction)).map((s) => ({ value: s.id, label: s.name }));
}

const portraitThumbCache = new Map<string, Promise<{ canvas: HTMLCanvasElement; missing: boolean }>>();

function portraitThumb(visualKey: string, emotion: PmdPortraitEmotion): Promise<{ canvas: HTMLCanvasElement; missing: boolean }> {
  const key = `${visualKey}::${emotion}`;
  const cached = portraitThumbCache.get(key);
  if (cached) return cached;
  const promise = loadSpeciesPortrait(visualKey, emotion).then((asset) => {
    const canvas = document.createElement('canvas');
    canvas.width = 40;
    canvas.height = 40;
    const c = canvas.getContext('2d')!;
    c.imageSmoothingEnabled = false;
    c.drawImage(asset.source, 0, 0, asset.width, asset.height, 0, 0, 40, 40);
    return { canvas, missing: asset.resolvedEmotion !== emotion || asset.synthesizedFallback };
  });
  portraitThumbCache.set(key, promise);
  return promise;
}

/** Grid of the speaker's real portraits; emotions the Pokémon lacks are dimmed. */
export function emotionGrid(
  ui: UiContext,
  visualKey: string | null,
  current: PmdPortraitEmotion,
  onPick: (emotion: PmdPortraitEmotion) => void
): HTMLElement {
  const grid = h('div', { class: 'cse-emotion-grid', 'data-testid': 'cse-emotion-grid' });
  for (const emotion of PMD_EXTENDED_PORTRAIT_EMOTIONS) {
    const cell = button(ui, '', () => onPick(emotion), { kind: 'ghost', active: emotion === current, title: emotion });
    cell.classList.add('cse-emotion-cell');
    cell.dataset.emotion = emotion;
    const label = h('span', { class: 'cse-emotion-label', text: emotion });
    cell.append(label);
    if (visualKey) {
      void portraitThumb(visualKey, emotion).then(({ canvas, missing }) => {
        const clone = document.createElement('canvas');
        clone.width = 40;
        clone.height = 40;
        clone.className = 'pmd-pixelated';
        clone.getContext('2d')!.drawImage(canvas, 0, 0);
        cell.prepend(clone);
        if (missing) {
          cell.classList.add('is-missing');
          cell.title = `${emotion} - this Pokémon has no ${emotion} portrait (shows Normal)`;
        }
      });
    }
    grid.append(cell);
  }
  return grid;
}

let previewAudio: HTMLAudioElement | null = null;

function stopPreviewAudio(): void {
  if (previewAudio) {
    previewAudio.pause();
    previewAudio = null;
  }
}

function playPreviewUrl(url: string): void {
  stopPreviewAudio();
  previewAudio = new Audio(url);
  previewAudio.volume = 0.6;
  void previewAudio.play().catch(() => {});
}

function hiddenFileInput(accept: string, onFile: (file: File) => void, signal: AbortSignal): HTMLInputElement {
  const input = h('input', { type: 'file', accept, class: 'cse-hidden-file' });
  input.addEventListener(
    'change',
    () => {
      const file = input.files?.[0];
      if (file) onFile(file);
      input.value = '';
    },
    { signal }
  );
  return input;
}

export interface UploadNotifier {
  toast: (msg: string) => void;
  canSave: boolean;
}

/** Song dropdown with ▶ listen and "Upload new song" (loops / plays once). */
export function songPicker(
  ui: UiContext,
  value: string | null,
  onPick: (trackId: string) => void,
  notifier: UploadNotifier
): HTMLElement {
  const options = PMD_BGM_TRACKS.map((t) => ({ value: t.id, label: `${t.trackNumber ? `${t.trackNumber} · ` : ''}${t.title}${t.loop ? '' : ' (plays once)'}` }));
  const resolved = value ? (PMD_BGM_TRACKS.find((t) => t.id === value)?.id ?? resolveAlias(value)) : '';
  if (value && !options.some((o) => o.value === resolved)) options.unshift({ value: value, label: `${value} (alias)` });
  const select = selectInput(ui, options, resolved || value || '', (v) => onPick(v), 'cse-song-select');
  const listen = button(ui, '▶', () => {
    const track = PMD_BGM_TRACKS.find((t) => t.id === select.value);
    if (track) playPreviewUrl(track.url);
  }, { kind: 'chip', title: 'Listen' });
  const stop = button(ui, '■', () => stopPreviewAudio(), { kind: 'chip', title: 'Stop' });

  const fileInput = hiddenFileInput('audio/*,.webm,.ogg,.mp3,.m4a,.wav,.opus', (file) => {
    const suggested = file.name.replace(/\.[^.]+$/, '');
    const title = window.prompt('Song name (shown in the song list):', suggested);
    if (title === null) return;
    const ext = file.name.match(/\.[^.]+$/)?.[0] ?? '.webm';
    const once = window.confirm('Should this song loop?\n\nOK = Loops (background music)\nCancel = Plays once (jingle / fanfare)') === false;
    if (file.size > 6 * 1024 * 1024) {
      notifier.toast(`Heads up: ${Math.round(file.size / 1024 / 1024)} MB is large - players download the whole song. WebM/OGG are much smaller than WAV.`);
    }
    void uploadProjectAsset('audio', file, `${title.trim() || suggested}${ext}`)
      .then(async (savedName) => {
        const track = registerUploadedTrack(savedName);
        if (once) {
          setTrackPlaysOnce(track.id, true);
          await writeProjectJson('src/mystery-emblem/audio/trackSettings.json', { playOnce: getPlayOnceTrackIds() });
        }
        notifier.toast(`Added song “${track.title}”`);
        onPick(track.id);
      })
      .catch((err: unknown) => notifier.toast(err instanceof Error ? err.message : 'Upload failed'));
  }, ui.signal);
  const upload = button(ui, 'Upload new song…', () => fileInput.click(), { kind: 'chip', disabled: !notifier.canSave, title: notifier.canSave ? 'Copies the file into assets/audio/' : 'Uploading only works when running locally' });
  return h('div', { class: 'cse-row cse-row--wrap' }, select, listen, stop, upload, fileInput);
}

function resolveAlias(value: string): string {
  return getAudioManager().getAvailableTracks().find((t) => t.id === value)?.id ?? value;
}

const FOLDER_ACCEPT: Record<MediaFolder, string> = {
  'cutscene-backgrounds': 'image/png,image/webp,image/gif,image/jpeg',
  'cutscene-props': 'image/png,image/webp,image/gif,image/jpeg',
  sfx: 'audio/*,.webm,.ogg,.mp3,.m4a,.wav,.opus',
};

/** File dropdown for a media folder with upload + preview. */
export function mediaPicker(
  ui: UiContext,
  folder: MediaFolder,
  value: string | undefined,
  onPick: (fileName: string) => void,
  notifier: UploadNotifier
): HTMLElement {
  const files = listMediaFiles(folder);
  const options = [{ value: '', label: files.length ? '- pick a file -' : '- no files yet: upload one -' }, ...files.map((f) => ({ value: f, label: f }))];
  if (value && !files.includes(value)) options.push({ value, label: `${value} (missing)` });
  const select = selectInput(ui, options, value ?? '', (v) => onPick(v), `cse-media-${folder}`);
  const wrap = h('div', { class: 'cse-row cse-row--wrap' }, select);
  if (folder === 'sfx') {
    wrap.append(button(ui, '▶', () => {
      const url = resolveMediaUrl('sfx', select.value);
      if (url) playPreviewUrl(url);
    }, { kind: 'chip', title: 'Listen' }));
  } else if (value) {
    const url = resolveMediaUrl(folder, value);
    if (url) wrap.append(h('img', { class: 'cse-media-thumb pmd-pixelated', src: url, alt: '' }));
  }
  const fileInput = hiddenFileInput(FOLDER_ACCEPT[folder], (file) => {
    void uploadProjectAsset(folder, file)
      .then((savedName) => {
        registerUploadedMedia(folder, savedName);
        notifier.toast(`Uploaded ${savedName}`);
        onPick(savedName);
      })
      .catch((err: unknown) => notifier.toast(err instanceof Error ? err.message : 'Upload failed'));
  }, ui.signal);
  wrap.append(
    button(ui, 'Upload…', () => fileInput.click(), { kind: 'chip', disabled: !notifier.canSave, title: notifier.canSave ? `Copies the file into assets/${folder}/` : 'Uploading only works when running locally' }),
    fileInput
  );
  return wrap;
}

export function stopAllPreviewAudio(): void {
  stopPreviewAudio();
}
