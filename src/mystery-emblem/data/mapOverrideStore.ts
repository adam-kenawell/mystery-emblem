/**
 * Persistent Dev Tools Map Override Store (`mapOverrideStore.ts`)
 *
 * Persists customized chapter maps immediately to `localStorage` (`mystery_emblem_map_overrides_v1`)
 * and reconciles via `customMapsEnvelopeJson` with Cloud Firestore (`saves/{uid}`).
 */

import type { CustomMapOverrideEntry, DungeonMapDefinition } from '../types/schemas';
import { cloneDungeonMap } from './chapters/chapterCodec';
import {
  getDefaultTargetMap,
  isCutsceneStageId,
  validateTargetMapDefinition,
} from './chapters/cutsceneStageCatalog';
import { isCorruptedAllWaterOverride } from './chapters/mapValidator';

export const MAP_OVERRIDES_STORAGE_KEY = 'mystery_emblem_map_overrides_v1';

export interface CustomMapsSyncEnvelope {
  version: 2;
  overrides: Record<string, CustomMapOverrideEntry>;
  resets: Record<string, number>;
}

type MapStoreListener = (changedLevelId: string | null) => void;

function normalizeIncomingEnvelope(
  candidate: CustomMapsSyncEnvelope | Record<string, CustomMapOverrideEntry> | null | undefined
): { overrides: Record<string, CustomMapOverrideEntry>; resets: Record<string, number> } {
  if (!candidate || typeof candidate !== 'object') return { overrides: {}, resets: {} };
  const maybeEnv = candidate as Partial<CustomMapsSyncEnvelope>;
  if (maybeEnv.version === 2 && maybeEnv.overrides && typeof maybeEnv.overrides === 'object') {
    const cleanResets: Record<string, number> = {};
    if (maybeEnv.resets && typeof maybeEnv.resets === 'object') {
      for (const [id, ts] of Object.entries(maybeEnv.resets)) {
        if (typeof ts === 'number' && Number.isFinite(ts) && ts > 0) cleanResets[id] = ts;
      }
    }
    return { overrides: maybeEnv.overrides, resets: cleanResets };
  }
  return { overrides: candidate as Record<string, CustomMapOverrideEntry>, resets: {} };
}

class ChapterMapOverrideStore {
  private overrides = new Map<string, CustomMapOverrideEntry>();
  private resets = new Map<string, number>();
  private readonly listeners = new Set<MapStoreListener>();
  private loadedFromStorage = false;
  private lastStamp = 0;

  private nextTimestamp(requested?: number): number {
    const base = typeof requested === 'number' && Number.isFinite(requested) && requested > 0 ? requested : Date.now();
    this.lastStamp = Math.max(base, this.lastStamp + 1);
    return this.lastStamp;
  }

  private ensureLoaded(): void {
    if (this.loadedFromStorage) return;
    this.loadedFromStorage = true;
    if (typeof window === 'undefined' || !window.localStorage) return;
    try {
      const raw = window.localStorage.getItem(MAP_OVERRIDES_STORAGE_KEY);
      if (!raw) return;
      const { overrides, resets } = normalizeIncomingEnvelope(
        JSON.parse(raw) as CustomMapsSyncEnvelope | Record<string, CustomMapOverrideEntry>
      );
      for (const [id, ts] of Object.entries(resets)) {
        this.resets.set(id, ts);
        if (ts > this.lastStamp) this.lastStamp = ts;
      }
      let healed = false;
      for (const [id, entry] of Object.entries(overrides)) {
        if (!entry || typeof entry !== 'object') continue;
        const ts = typeof entry.updatedAt === 'number' && Number.isFinite(entry.updatedAt) && entry.updatedAt > 0 ? entry.updatedAt : Date.now();
        if ((this.resets.get(id) ?? 0) >= ts) continue;
        const v = validateTargetMapDefinition(entry.map, id);
        if (v.valid && v.map) {
          if (!isCutsceneStageId(id) && isCorruptedAllWaterOverride(v.map)) {
            const healTs = Math.max(ts + 1, Date.now());
            this.resets.set(id, healTs);
            if (healTs > this.lastStamp) this.lastStamp = healTs;
            healed = true;
            continue;
          }
          this.overrides.set(id, { map: v.map, updatedAt: ts });
          this.resets.delete(id);
          if (ts > this.lastStamp) this.lastStamp = ts;
        }
      }
      if (healed) this.persist();
    } catch {
      // Ignore malformed storage entries safely
    }
  }

  private persist(): void {
    if (typeof window === 'undefined' || !window.localStorage) return;
    try {
      if (this.overrides.size === 0 && this.resets.size === 0) {
        window.localStorage.removeItem(MAP_OVERRIDES_STORAGE_KEY);
        return;
      }
      window.localStorage.setItem(MAP_OVERRIDES_STORAGE_KEY, JSON.stringify(this.getSyncEnvelope()));
    } catch {
      // Quota fallback
    }
  }

  private emit(id: string | null): void {
    for (const fn of this.listeners) fn(id);
  }

  public reloadFromLocalStorage(): void {
    this.loadedFromStorage = false;
    this.overrides.clear();
    this.resets.clear();
    this.ensureLoaded();
    this.emit(null);
  }

  public hasOverride(id: string): boolean { this.ensureLoaded(); return this.overrides.has(id); }
  public hasAnySyncState(): boolean { this.ensureLoaded(); return this.overrides.size > 0 || this.resets.size > 0; }

  public getOverrideEntry(id: string): CustomMapOverrideEntry | null {
    this.ensureLoaded();
    const found = this.overrides.get(id);
    return found ? { map: cloneDungeonMap(found.map), updatedAt: found.updatedAt } : null;
  }

  public getEffectiveMap(id: string): DungeonMapDefinition {
    this.ensureLoaded();
    const ov = this.overrides.get(id);
    return ov ? cloneDungeonMap(ov.map) : getDefaultTargetMap(id);
  }

  public getAllOverridesRecord(): Record<string, CustomMapOverrideEntry> {
    this.ensureLoaded();
    const out: Record<string, CustomMapOverrideEntry> = {};
    for (const [id, entry] of this.overrides.entries()) out[id] = { map: cloneDungeonMap(entry.map), updatedAt: entry.updatedAt };
    return out;
  }

  public getSyncEnvelope(): CustomMapsSyncEnvelope {
    this.ensureLoaded();
    const resets: Record<string, number> = {};
    for (const [id, ts] of this.resets.entries()) resets[id] = ts;
    return { version: 2, overrides: this.getAllOverridesRecord(), resets };
  }

  public saveOverride(id: string, candidateMap: DungeonMapDefinition, updatedAt?: number): DungeonMapDefinition {
    this.ensureLoaded();
    const v = validateTargetMapDefinition(candidateMap, id);
    if (!v.valid || !v.map) throw new Error(`Invalid map for "${id}": ${v.errors.join(' ')}`);
    const stamp = this.nextTimestamp(updatedAt);
    const stored = cloneDungeonMap(v.map);
    this.overrides.set(id, { map: stored, updatedAt: stamp });
    this.resets.delete(id);
    this.persist();
    this.emit(id);
    return cloneDungeonMap(stored);
  }

  public resetOverride(id: string, resetAt?: number): DungeonMapDefinition {
    this.ensureLoaded();
    const existed = this.overrides.delete(id);
    if (existed || resetAt !== undefined || (this.resets.get(id) ?? 0) === 0) {
      this.resets.set(id, this.nextTimestamp(resetAt));
      this.persist();
      if (existed) this.emit(id);
    }
    return getDefaultTargetMap(id);
  }

  public resetAllOverrides(clearResetsToo = false): void {
    this.ensureLoaded();
    if (clearResetsToo) {
      const hadAny = this.overrides.size > 0 || this.resets.size > 0;
      this.overrides.clear();
      this.resets.clear();
      this.persist();
      if (hadAny) this.emit(null);
      return;
    }
    if (this.overrides.size === 0) return;
    const stamp = this.nextTimestamp();
    for (const id of this.overrides.keys()) this.resets.set(id, stamp);
    this.overrides.clear();
    this.persist();
    this.emit(null);
  }

  public reconcileEnvelope(
    incoming: CustomMapsSyncEnvelope | Record<string, CustomMapOverrideEntry> | null | undefined
  ): { localChanged: boolean; cloudOutdated: boolean } {
    this.ensureLoaded();
    const { overrides: incOv, resets: incRes } = normalizeIncomingEnvelope(incoming);
    const allIds = new Set([...this.overrides.keys(), ...this.resets.keys(), ...Object.keys(incOv), ...Object.keys(incRes)]);
    let localChanged = false;
    let cloudOutdated = false;

    for (const id of allIds) {
      const locOv = this.overrides.get(id);
      const locOvTs = locOv?.updatedAt ?? 0;
      const locResTs = this.resets.get(id) ?? 0;
      const locKind = locResTs >= locOvTs && locResTs > 0 ? 'reset' : locOv ? 'override' : 'none';
      const locTs = locKind === 'reset' ? locResTs : locOvTs;

      let validIncMap: DungeonMapDefinition | null = null;
      let incOvTs = 0;
      let incResTs = incRes[id] ?? 0;
      const rawOv = incOv[id];
      if (rawOv && typeof rawOv === 'object') {
        const v = validateTargetMapDefinition(rawOv.map, id);
        if (v.valid && v.map) {
          const rawTs = typeof rawOv.updatedAt === 'number' && Number.isFinite(rawOv.updatedAt) && rawOv.updatedAt > 0 ? rawOv.updatedAt : 1;
          if (!isCutsceneStageId(id) && isCorruptedAllWaterOverride(v.map)) {
            incResTs = Math.max(incResTs, rawTs + 1, locTs + 1, Date.now());
            cloudOutdated = true;
          } else {
            validIncMap = v.map;
            incOvTs = rawTs;
          }
        }
      }
      const incKind = incResTs >= incOvTs && incResTs > 0 ? 'reset' : validIncMap ? 'override' : 'none';
      const incTs = incKind === 'reset' ? incResTs : incOvTs;

      if (incTs > locTs) {
        if (incKind === 'reset') {
          const had = this.overrides.delete(id);
          this.resets.set(id, incResTs);
          if (incResTs > this.lastStamp) this.lastStamp = incResTs;
          if (had || locResTs !== incResTs) localChanged = true;
        } else if (incKind === 'override' && validIncMap) {
          this.overrides.set(id, { map: validIncMap, updatedAt: incOvTs });
          this.resets.delete(id);
          if (incOvTs > this.lastStamp) this.lastStamp = incOvTs;
          localChanged = true;
        }
      } else if (locTs > incTs) {
        cloudOutdated = true;
      } else if (locTs > 0 && locKind !== incKind) {
        if (incKind === 'reset') {
          this.overrides.delete(id);
          this.resets.set(id, incResTs);
          localChanged = true;
        } else if (locKind === 'reset') {
          cloudOutdated = true;
        }
      }
    }

    if (localChanged) {
      this.persist();
      this.emit(null);
    }
    return { localChanged, cloudOutdated };
  }

  public subscribe(listener: MapStoreListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}

const store = new ChapterMapOverrideStore();

export const hasChapterMapOverride = (id: string): boolean => store.hasOverride(id);
export const hasAnyCustomMapSyncState = (): boolean => store.hasAnySyncState();
export const getChapterMapOverrideEntry = (id: string): CustomMapOverrideEntry | null => store.getOverrideEntry(id);
export const getEffectiveChapterMap = (id: string): DungeonMapDefinition => store.getEffectiveMap(id);
export const getAllCustomMapOverrides = (): Record<string, CustomMapOverrideEntry> => store.getAllOverridesRecord();
export const getCustomMapsSyncEnvelope = (): CustomMapsSyncEnvelope => store.getSyncEnvelope();
export const saveChapterMapOverride = (id: string, map: DungeonMapDefinition, ts?: number): DungeonMapDefinition => store.saveOverride(id, map, ts);
export const resetChapterMapOverride = (id: string): DungeonMapDefinition => store.resetOverride(id);
export const resetAllChapterMapOverrides = (clearResetsToo = false): void => store.resetAllOverrides(clearResetsToo);
export const mergeCustomMapsRecord = (incoming: Record<string, CustomMapOverrideEntry> | undefined): boolean =>
  Boolean(incoming && typeof incoming === 'object') && store.reconcileEnvelope(incoming).localChanged;
export const reconcileCustomMapsEnvelope = (
  incoming: CustomMapsSyncEnvelope | Record<string, CustomMapOverrideEntry> | null | undefined
): { localChanged: boolean; cloudOutdated: boolean } => store.reconcileEnvelope(incoming);
export const reloadChapterMapsFromStorage = (): void => store.reloadFromLocalStorage();
export const exportChapterMapJson = (id: string): string => JSON.stringify(getEffectiveChapterMap(id), null, 2);
export function importChapterMapJson(rawJson: string, targetLevelId?: string): DungeonMapDefinition {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawJson);
  } catch (err) {
    throw new Error(`Could not parse Map JSON: ${err instanceof Error ? err.message : 'Malformed JSON'}`);
  }
  const resolvedId =
    targetLevelId ??
    (parsed && typeof parsed === 'object' && typeof (parsed as { id?: unknown }).id === 'string'
      ? ((parsed as { id: string }).id.trim() || 'prologue')
      : 'prologue');
  return saveChapterMapOverride(resolvedId, parsed as DungeonMapDefinition);
}
export const subscribeChapterMapChanges = (listener: MapStoreListener): (() => void) => store.subscribe(listener);
