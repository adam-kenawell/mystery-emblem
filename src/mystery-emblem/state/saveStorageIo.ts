/**
 * Mystery Emblem — LocalStorage IO, JSON Backup Import/Export & Cloud Push Helpers (`saveStorageIo.ts`)
 */

import {
  getAllCustomMapOverrides,
  getCustomMapsSyncEnvelope,
  mergeCustomMapsRecord,
} from '../data/chapterMapRegistry';
import { ITEM_MAP, MOVE_MAP, SPECIES_MAP } from '../data/index';
import type { SaveData } from '../types/schemas';
import { validateSaveData } from '../types/validators';
import { serializeCustomMapsEnvelope } from './cloudReconciler';
import type { CloudSyncAdapter } from './firebaseSync';
import {
  LEGACY_SAVE_STORAGE_KEY,
  META_STORAGE_KEY,
  SAVE_STORAGE_KEY,
  normalizeLegacySingleItemSlots,
  type CloudSyncResolution,
  type StorageLike,
  type SyncStatusSnapshot,
} from './saveHelpersAndFactory';

export function readValidLocalSaveFromStorage(storage: StorageLike): SaveData | null {
  try {
    let raw = storage.getItem(SAVE_STORAGE_KEY);
    if (!raw) {
      const legacy = storage.getItem(LEGACY_SAVE_STORAGE_KEY);
      if (legacy) {
        storage.setItem(SAVE_STORAGE_KEY, legacy);
        storage.removeItem(LEGACY_SAVE_STORAGE_KEY);
        raw = legacy;
      }
    }
    if (!raw) return null;
    const check = validateSaveData(
      normalizeLegacySingleItemSlots(JSON.parse(raw)),
      SPECIES_MAP,
      MOVE_MAP,
      ITEM_MAP
    );
    return check.valid && check.save ? check.save : null;
  } catch {
    return null;
  }
}

export function writeLocalSaveToStorage(
  storage: StorageLike,
  isBrowserPrimaryStorage: boolean,
  save: SaveData
): SaveData {
  const cloned = JSON.parse(JSON.stringify(save)) as SaveData;
  if (isBrowserPrimaryStorage && cloned.customMaps) {
    mergeCustomMapsRecord(cloned.customMaps);
  }
  storage.setItem(SAVE_STORAGE_KEY, JSON.stringify(cloned));
  if (cloned.newGamePlusUnlocked) {
    storage.setItem(META_STORAGE_KEY, JSON.stringify({ newGamePlusUnlocked: true }));
  }
  return cloned;
}

export function stampAndValidateSaveForCommit(params: {
  save: SaveData;
  previousLastUpdated: number;
  isBrowserPrimaryStorage: boolean;
  keepExistingTimestamp: boolean;
}): SaveData {
  const { save, previousLastUpdated, isBrowserPrimaryStorage, keepExistingTimestamp } = params;
  let customMapsField = save.customMaps;
  if (isBrowserPrimaryStorage) {
    if (save.customMaps) mergeCustomMapsRecord(save.customMaps);
    const allOverrides = getAllCustomMapOverrides();
    customMapsField = Object.keys(allOverrides).length > 0 ? allOverrides : undefined;
  }

  const stamped: SaveData = {
    ...save,
    customMaps: customMapsField,
    lastUpdated: keepExistingTimestamp
      ? save.lastUpdated
      : Math.max(Date.now(), previousLastUpdated + 1),
  };
  if (stamped.customMaps === undefined) delete stamped.customMaps;

  const check = validateSaveData(stamped, SPECIES_MAP, MOVE_MAP, ITEM_MAP);
  if (!check.valid || !check.save) {
    throw new Error(`Refusing to persist invalid save state: ${check.errors.join(' ')}`);
  }
  return check.save;
}

export function parseImportedSaveBackup(rawJson: string, preserveTimestamp: boolean): SaveData {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawJson);
  } catch {
    throw new Error('Invalid JSON file: could not parse backup payload.');
  }

  const check = validateSaveData(
    normalizeLegacySingleItemSlots(parsed),
    SPECIES_MAP,
    MOVE_MAP,
    ITEM_MAP
  );
  if (!check.valid || !check.save) {
    throw new Error(`Invalid save backup: ${check.errors.join(' ')}`);
  }

  return {
    ...check.save,
    lastUpdated: preserveTimestamp ? check.save.lastUpdated : Date.now(),
  };
}

export async function performDeleteSaveFromAccount(params: {
  storage: StorageLike;
  isBrowserPrimaryStorage: boolean;
  cloud: CloudSyncAdapter;
  hadCurrentSave: boolean;
  onUpdateSyncStatus: (patch: Partial<SyncStatusSnapshot>) => void;
}): Promise<{ deletedLocal: boolean; deletedCloud: boolean }> {
  const { storage, isBrowserPrimaryStorage, cloud, hadCurrentSave, onUpdateSyncStatus } = params;
  const hadLocal = Boolean(
    hadCurrentSave ||
      storage.getItem(SAVE_STORAGE_KEY) ||
      storage.getItem(LEGACY_SAVE_STORAGE_KEY)
  );
  storage.removeItem(SAVE_STORAGE_KEY);
  storage.removeItem(LEGACY_SAVE_STORAGE_KEY);
  storage.removeItem(META_STORAGE_KEY);

  const user = cloud.getCurrentUser();
  if (!user || typeof cloud.deleteCloudSave !== 'function') {
    onUpdateSyncStatus({ lastResolution: 'unauthenticated', errorMessage: null });
    return { deletedLocal: hadLocal, deletedCloud: false };
  }

  try {
    await cloud.deleteCloudSave(user.uid);
    if (
      isBrowserPrimaryStorage &&
      Object.keys(getAllCustomMapOverrides()).length > 0 &&
      typeof cloud.pushCustomMapsOnly === 'function'
    ) {
      await cloud.pushCustomMapsOnly(user.uid, JSON.stringify(getCustomMapsSyncEnvelope()));
    }
    onUpdateSyncStatus({
      user,
      lastResolution: 'empty',
      lastSyncedAt: Date.now(),
      errorMessage: null,
    });
    return { deletedLocal: hadLocal, deletedCloud: true };
  } catch (err) {
    onUpdateSyncStatus({
      user,
      lastResolution: 'cloud_error',
      errorMessage:
        err instanceof Error ? err.message : 'Failed to delete save data from Cloud Firestore.',
    });
    throw err;
  }
}

export async function performSyncCustomMapsWithSave(params: {
  isBrowserPrimaryStorage: boolean;
  cloud: CloudSyncAdapter;
  getCurrentSave: () => SaveData | null;
  writeLocalOnly: (save: SaveData) => void;
  onUpdateSyncStatus: (patch: Partial<SyncStatusSnapshot>) => void;
}): Promise<CloudSyncResolution> {
  const { isBrowserPrimaryStorage, cloud, getCurrentSave, writeLocalOnly, onUpdateSyncStatus } =
    params;
  if (!isBrowserPrimaryStorage) return 'unauthenticated';
  const allOverrides = getAllCustomMapOverrides();
  const customMapsField = Object.keys(allOverrides).length > 0 ? allOverrides : undefined;
  const activeSave = getCurrentSave();
  const envelopeJson = serializeCustomMapsEnvelope(isBrowserPrimaryStorage, activeSave);

  if (activeSave) {
    const stamped: SaveData = {
      ...activeSave,
      customMaps: customMapsField,
      lastUpdated: Math.max(Date.now(), (activeSave.lastUpdated ?? 0) + 1),
    };
    if (stamped.customMaps === undefined) delete stamped.customMaps;
    const check = validateSaveData(stamped, SPECIES_MAP, MOVE_MAP, ITEM_MAP);
    if (check.valid && check.save) writeLocalOnly(check.save);
  }

  const user = cloud.getCurrentUser();
  if (!user) return 'unauthenticated';

  try {
    const latest = getCurrentSave();
    if (latest) {
      await cloud.pushCloudSave(user.uid, latest, envelopeJson);
    } else if (envelopeJson && typeof cloud.pushCustomMapsOnly === 'function') {
      await cloud.pushCustomMapsOnly(user.uid, envelopeJson);
    }
    onUpdateSyncStatus({
      user,
      lastResolution: 'pushed_newer_local',
      lastSyncedAt: Date.now(),
      errorMessage: null,
    });
    return 'pushed_newer_local';
  } catch (err) {
    onUpdateSyncStatus({
      user,
      lastResolution: 'cloud_error',
      errorMessage:
        err instanceof Error ? err.message : 'Failed to sync custom maps to Cloud Firestore.',
    });
    return 'cloud_error';
  }
}
