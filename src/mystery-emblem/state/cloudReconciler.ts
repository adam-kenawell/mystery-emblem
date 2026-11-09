/**
 * Mystery Emblem — Rule 7 Hybrid localStorage + Cloud Firestore Timestamp Reconciler
 */

import {
  getAllCustomMapOverrides,
  getCustomMapsSyncEnvelope,
  hasAnyCustomMapSyncState,
  mergeCustomMapsRecord,
  reconcileCustomMapsEnvelope,
  type CustomMapsSyncEnvelope,
} from '../data/chapterMapRegistry';
import { ITEM_MAP, MOVE_MAP, SPECIES_MAP } from '../data/index';
import type { SaveData } from '../types/schemas';
import { validateSaveData } from '../types/validators';
import { extractCloudPayloadParts, type CloudSyncAdapter, type CloudUser } from './firebaseSync';
import { normalizeLegacySingleItemSlots, type CloudSyncResolution } from './saveHelpersAndFactory';

export function serializeCustomMapsEnvelope(
  isBrowserPrimaryStorage: boolean,
  currentSave: SaveData | null
): string | null {
  if (isBrowserPrimaryStorage && hasAnyCustomMapSyncState()) {
    return JSON.stringify(getCustomMapsSyncEnvelope());
  }
  if (currentSave?.customMaps && Object.keys(currentSave.customMaps).length > 0) {
    return JSON.stringify({
      version: 2,
      overrides: currentSave.customMaps,
      resets: {},
    });
  }
  return null;
}

export function attachMergedCustomMaps(
  save: SaveData,
  isBrowserPrimaryStorage: boolean
): SaveData {
  if (!isBrowserPrimaryStorage) return save;
  const cloned = JSON.parse(JSON.stringify(save)) as SaveData;
  const allOverrides = getAllCustomMapOverrides();
  if (Object.keys(allOverrides).length > 0) {
    cloned.customMaps = allOverrides;
  } else {
    delete cloned.customMaps;
  }
  return cloned;
}

export interface ReconcileContext {
  cloud: CloudSyncAdapter;
  user: CloudUser;
  isBrowserPrimaryStorage: boolean;
  localSave: SaveData | null;
  writeLocalOnly: (save: SaveData) => void;
  getCurrentSave: () => SaveData | null;
}

export async function performCloudSaveReconciliation(
  ctx: ReconcileContext
): Promise<CloudSyncResolution> {
  const { cloud, user, isBrowserPrimaryStorage, localSave, writeLocalOnly, getCurrentSave } = ctx;

  if (isBrowserPrimaryStorage && localSave?.customMaps) {
    mergeCustomMapsRecord(localSave.customMaps);
  }

  const rawCloud = await cloud.fetchCloudSave(user.uid);
  const { saveCandidate, customMapsEnvelope } = extractCloudPayloadParts(rawCloud);

  let mapSync = { localChanged: false, cloudOutdated: false };
  if (isBrowserPrimaryStorage) {
    mapSync = reconcileCustomMapsEnvelope(customMapsEnvelope as CustomMapsSyncEnvelope | null);
  }

  let cloudSave: SaveData | null = null;
  if (saveCandidate) {
    const normalizedCloud = normalizeLegacySingleItemSlots(saveCandidate);
    const check = validateSaveData(normalizedCloud, SPECIES_MAP, MOVE_MAP, ITEM_MAP);
    if (check.valid && check.save) {
      cloudSave = check.save;
    }
  }

  const getEnvJson = () => serializeCustomMapsEnvelope(isBrowserPrimaryStorage, getCurrentSave());

  if (!localSave && !cloudSave) {
    if (mapSync.cloudOutdated) {
      const envJson = getEnvJson();
      if (envJson && typeof cloud.pushCustomMapsOnly === 'function') {
        await cloud.pushCustomMapsOnly(user.uid, envJson);
      }
      return mapSync.localChanged ? 'pulled_newer_cloud' : 'pushed_newer_local';
    }
    return mapSync.localChanged ? 'pulled_newer_cloud' : 'empty';
  }

  if (!localSave && cloudSave) {
    writeLocalOnly(attachMergedCustomMaps(cloudSave, isBrowserPrimaryStorage));
    if (mapSync.cloudOutdated) {
      await cloud.pushCloudSave(user.uid, getCurrentSave()!, getEnvJson());
    }
    return 'pulled_newer_cloud';
  }

  if (localSave && !cloudSave) {
    writeLocalOnly(attachMergedCustomMaps(localSave, isBrowserPrimaryStorage));
    await cloud.pushCloudSave(user.uid, getCurrentSave()!, getEnvJson());
    return 'pushed_newer_local';
  }

  if (cloudSave!.lastUpdated > localSave!.lastUpdated) {
    writeLocalOnly(attachMergedCustomMaps(cloudSave!, isBrowserPrimaryStorage));
    if (mapSync.cloudOutdated) {
      await cloud.pushCloudSave(user.uid, getCurrentSave()!, getEnvJson());
    }
    return 'pulled_newer_cloud';
  }

  if (localSave!.lastUpdated > cloudSave!.lastUpdated) {
    writeLocalOnly(attachMergedCustomMaps(localSave!, isBrowserPrimaryStorage));
    await cloud.pushCloudSave(user.uid, getCurrentSave()!, getEnvJson());
    return 'pushed_newer_local';
  }

  if (mapSync.localChanged) {
    writeLocalOnly(attachMergedCustomMaps(localSave!, isBrowserPrimaryStorage));
  }
  if (mapSync.cloudOutdated) {
    writeLocalOnly(attachMergedCustomMaps(localSave!, isBrowserPrimaryStorage));
    await cloud.pushCloudSave(user.uid, getCurrentSave()!, getEnvJson());
    return mapSync.localChanged ? 'pulled_newer_cloud' : 'pushed_newer_local';
  }

  return mapSync.localChanged ? 'pulled_newer_cloud' : 'already_in_sync';
}
