/**
 * Mystery Emblem — Dev "Save to Project" Client (`projectFileClient.ts`)
 *
 * Talks to the dev-only endpoints in `scripts/devProjectWriterPlugin.mjs`. Available only while
 * running `npm run dev` on this computer; on the live site every call reports "unavailable".
 */

import { formatChapterJson, formatProjectJson } from '../../data/jsonFormat';

const ENDPOINT = '/__me-dev/';
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

let availability: Promise<boolean> | null = null;

export function checkProjectSaveAvailable(): Promise<boolean> {
  if (availability) return availability;
  if (typeof window === 'undefined' || !LOCAL_HOSTS.has(window.location.hostname)) {
    availability = Promise.resolve(false);
    return availability;
  }
  availability = fetch(`${ENDPOINT}status`, { cache: 'no-store' })
    .then(async (res) => res.ok && Boolean((await res.json() as { ok?: boolean }).ok))
    .catch(() => false);
  return availability;
}

async function postJson(action: string, body: unknown): Promise<void> {
  const res = await fetch(`${ENDPOINT}${action}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
  if (!res.ok || !data.ok) throw new Error(data.error ?? `Save failed (${res.status})`);
}

export async function writeProjectJson(path: string, value: unknown, maxInlineWidth = 100): Promise<void> {
  if (!(await checkProjectSaveAvailable())) throw new Error('Saving to the project only works when running locally (npm run dev).');
  await postJson('write', { path, content: formatProjectJson(value, maxInlineWidth) });
}

/** Writes a chapter's `chapter.json` in its hand-written house style (small git diffs). */
export async function writeChapterJsonFile(chapterId: string, chapter: object): Promise<void> {
  if (!(await checkProjectSaveAvailable())) throw new Error('Saving to the project only works when running locally (npm run dev).');
  await postJson('write', {
    path: `src/mystery-emblem/data/chapters/${chapterId}/chapter.json`,
    content: formatChapterJson(chapter as Record<string, unknown>),
  });
}

export async function deleteProjectFile(path: string): Promise<void> {
  if (!(await checkProjectSaveAvailable())) throw new Error('Deleting only works when running locally (npm run dev).');
  await postJson('delete', { path });
}

export type ProjectUploadFolder = 'cutscene-backgrounds' | 'cutscene-props' | 'sfx' | 'audio';

/** Copies a file into `assets/<folder>/` and returns the saved file name. */
export async function uploadProjectAsset(
  folder: ProjectUploadFolder,
  file: File,
  fileName = file.name
): Promise<string> {
  if (!(await checkProjectSaveAvailable())) throw new Error('Uploading only works when running locally (npm run dev).');
  const url = `${ENDPOINT}upload?folder=${encodeURIComponent(folder)}&name=${encodeURIComponent(fileName)}`;
  const res = await fetch(url, { method: 'POST', body: file });
  const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; name?: string };
  if (!res.ok || !data.ok || !data.name) throw new Error(data.error ?? `Upload failed (${res.status})`);
  return data.name;
}
