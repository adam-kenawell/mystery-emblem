/**
 * Mystery Emblem - Firebase Auth, Cloud Firestore Codec & Timestamp Reconciler (`firebaseSync.ts`)
 *
 * Enforces Cloud Firestore's wire constraint: zero nested 2D arrays (`tiles[][]`),
 * zero `undefined` fields, and flat `customMapsEnvelopeJson` serialization.
 */

import { getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import {
  GoogleAuthProvider,
  getAuth,
  onAuthStateChanged as fbOnAuthStateChanged,
  signInWithPopup,
  signOut as fbSignOut,
  type Auth,
  type User,
} from 'firebase/auth';
import { deleteDoc, doc, getDoc, getFirestore, setDoc, type Firestore } from 'firebase/firestore';
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
import { normalizeLegacySingleItemSlots, type CloudSyncResolution } from './saveHelpersAndFactory';

// ---------------------------------------------------------------------------
// Firestore Flat Wire Codec
// ---------------------------------------------------------------------------

export interface FirebaseEnvConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId: string;
}

export function assertFirestoreNoNestedArrays(value: unknown, path = 'root'): void {
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      const item = value[i];
      if (Array.isArray(item)) {
        throw new Error(
          `Firestore nested array forbidden at ${path}[${i}]. Encode 2D grids via customMapsEnvelopeJson.`
        );
      }
      assertFirestoreNoNestedArrays(item, `${path}[${i}]`);
    }
    return;
  }
  if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (v === undefined) {
        throw new Error(`Firestore undefined field forbidden at ${path}.${k}.`);
      }
      assertFirestoreNoNestedArrays(v, `${path}.${k}`);
    }
  }
}

export function serializeSaveForFirestore(
  save: SaveData,
  customMapsEnvelopeJson?: string | null
): Record<string, unknown> {
  const cleanPayload = structuredClone(save) as unknown as Record<string, unknown>;
  const rawCustomMaps = cleanPayload.customMaps;
  delete cleanPayload.customMaps;

  if (typeof customMapsEnvelopeJson === 'string' && customMapsEnvelopeJson.length > 0) {
    cleanPayload.customMapsEnvelopeJson = customMapsEnvelopeJson;
    cleanPayload.customMapsUpdatedAt = Date.now();
  } else if (rawCustomMaps && typeof rawCustomMaps === 'object') {
    cleanPayload.customMapsEnvelopeJson = JSON.stringify({
      version: 2,
      overrides: rawCustomMaps,
      resets: {},
    });
    cleanPayload.customMapsUpdatedAt = Date.now();
  }

  assertFirestoreNoNestedArrays(cleanPayload);
  return cleanPayload;
}

export function extractCloudPayloadParts(rawDoc: unknown): {
  saveCandidate: unknown | null;
  customMapsEnvelope: unknown | null;
} {
  if (!rawDoc || typeof rawDoc !== 'object') {
    return { saveCandidate: null, customMapsEnvelope: null };
  }
  const obj = rawDoc as Record<string, unknown>;

  let customMapsEnvelope: unknown | null = null;
  if (typeof obj.customMapsEnvelopeJson === 'string' && obj.customMapsEnvelopeJson.trim().length > 0) {
    try {
      customMapsEnvelope = JSON.parse(obj.customMapsEnvelopeJson);
    } catch {
      customMapsEnvelope = null;
    }
  } else if (obj.customMaps && typeof obj.customMaps === 'object') {
    customMapsEnvelope = obj.customMaps;
  }

  if (obj.schemaVersion === undefined) {
    return { saveCandidate: null, customMapsEnvelope };
  }

  const cloned = structuredClone(obj) as Record<string, unknown>;
  delete cloned.customMapsEnvelopeJson;
  delete cloned.customMapsUpdatedAt;
  delete cloned.customMaps;

  return { saveCandidate: cloned, customMapsEnvelope };
}

function readFirebaseEnvConfig(): FirebaseEnvConfig | null {
  const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env ?? {};
  const apiKey = env.PUBLIC_FIREBASE_API_KEY?.trim() ?? '';
  const authDomain = env.PUBLIC_FIREBASE_AUTH_DOMAIN?.trim() ?? '';
  const projectId = env.PUBLIC_FIREBASE_PROJECT_ID?.trim() ?? '';
  const appId = env.PUBLIC_FIREBASE_APP_ID?.trim() ?? '';

  if (!apiKey || !authDomain || !projectId || !appId) return null;

  return {
    apiKey,
    authDomain,
    projectId,
    storageBucket: env.PUBLIC_FIREBASE_STORAGE_BUCKET?.trim() || undefined,
    messagingSenderId: env.PUBLIC_FIREBASE_MESSAGING_SENDER_ID?.trim() || undefined,
    appId,
  };
}

// ---------------------------------------------------------------------------
// Cloud Sync Interfaces & Adapters
// ---------------------------------------------------------------------------

export interface CloudUser {
  uid: string;
  email: string | null;
  displayName: string | null;
}

export interface CloudSyncAdapter {
  readonly isConfigured: boolean;
  getCurrentUser(): CloudUser | null;
  onAuthStateChanged(listener: (user: CloudUser | null) => void): () => void;
  signInWithGoogle(): Promise<CloudUser>;
  signOut(): Promise<void>;
  fetchCloudSave(uid: string, slot?: number): Promise<unknown | null>;
  pushCloudSave(
    uid: string,
    save: SaveData,
    customMapsEnvelopeJson?: string | null,
    slot?: number
  ): Promise<void>;
  pushCustomMapsOnly?(uid: string, customMapsEnvelopeJson: string): Promise<void>;
  deleteCloudSave(uid: string, slot?: number): Promise<void>;
}

/** Slot 1 keeps the original `saves/{uid}` doc (which also carries the custom-maps envelope); slots 2+ live in a subcollection. */
export function cloudSaveDocPath(uid: string, slot = 1): string[] {
  return slot === 1 ? ['saves', uid] : ['saves', uid, 'slots', `slot${slot}`];
}

function toCloudUser(user: User | null): CloudUser | null {
  if (!user) return null;
  return { uid: user.uid, email: user.email, displayName: user.displayName };
}

export class FirestoreSyncAdapter implements CloudSyncAdapter {
  public readonly isConfigured: boolean;
  private app: FirebaseApp | null = null;
  private auth: Auth | null = null;
  private db: Firestore | null = null;

  constructor() {
    const cfg = readFirebaseEnvConfig();
    if (!cfg) {
      this.isConfigured = false;
      return;
    }
    try {
      this.app = getApps().length > 0 ? getApps()[0]! : initializeApp(cfg);
      this.auth = getAuth(this.app);
      this.db = getFirestore(this.app);
      this.isConfigured = true;
    } catch {
      this.isConfigured = false;
    }
  }

  public getCurrentUser(): CloudUser | null {
    return this.auth ? toCloudUser(this.auth.currentUser) : null;
  }

  public onAuthStateChanged(listener: (user: CloudUser | null) => void): () => void {
    if (!this.auth) {
      listener(null);
      return () => {};
    }
    return fbOnAuthStateChanged(this.auth, (user) => listener(toCloudUser(user)));
  }

  public async signInWithGoogle(): Promise<CloudUser> {
    if (!this.auth) {
      throw new Error(
        'Firebase is not configured yet. Add PUBLIC_FIREBASE_* keys to `.env` (see `.env.example`).'
      );
    }
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    const cred = await signInWithPopup(this.auth, provider);
    const mapped = toCloudUser(cred.user);
    if (!mapped) throw new Error('Google Sign-In did not return an authenticated user.');
    return mapped;
  }

  public async signOut(): Promise<void> {
    if (this.auth) await fbSignOut(this.auth);
  }

  public async fetchCloudSave(uid: string, slot = 1): Promise<unknown | null> {
    if (!this.db) return null;
    const [col, ...rest] = cloudSaveDocPath(uid, slot);
    const snap = await getDoc(doc(this.db, col!, ...rest));
    return snap.exists() ? snap.data() : null;
  }

  public async pushCloudSave(
    uid: string,
    save: SaveData,
    customMapsEnvelopeJson?: string | null,
    slot = 1
  ): Promise<void> {
    if (!this.db) return;
    const [col, ...rest] = cloudSaveDocPath(uid, slot);
    const payload = serializeSaveForFirestore(save, slot === 1 ? customMapsEnvelopeJson : null);
    if (slot !== 1) {
      delete payload.customMapsEnvelopeJson;
      delete payload.customMapsUpdatedAt;
    }
    await setDoc(doc(this.db, col!, ...rest), payload);
  }

  public async pushCustomMapsOnly(uid: string, customMapsEnvelopeJson: string): Promise<void> {
    if (!this.db) return;
    const mergePayload = { customMapsEnvelopeJson, customMapsUpdatedAt: Date.now() };
    assertFirestoreNoNestedArrays(mergePayload);
    await setDoc(doc(this.db, 'saves', uid), mergePayload, { merge: true });
  }

  public async deleteCloudSave(uid: string, slot = 1): Promise<void> {
    if (!this.db) return;
    const [col, ...rest] = cloudSaveDocPath(uid, slot);
    await deleteDoc(doc(this.db, col!, ...rest));
  }
}

export class InMemoryCloudSyncAdapter implements CloudSyncAdapter {
  public readonly isConfigured = true;
  private currentUser: CloudUser | null = null;
  private readonly listeners = new Set<(user: CloudUser | null) => void>();
  private readonly cloudDocs: Map<string, Record<string, unknown>>;
  private readonly mockAccount: CloudUser;

  constructor(
    sharedCloudStore: Map<string, Record<string, unknown>> = new Map(),
    mockAccount: CloudUser = {
      uid: 'test-google-uid-001',
      email: 'trainer@mystery-emblem.dev',
      displayName: 'Dragon Tactician',
    }
  ) {
    this.cloudDocs = sharedCloudStore;
    this.mockAccount = mockAccount;
  }

  public getCurrentUser(): CloudUser | null {
    return this.currentUser;
  }

  public onAuthStateChanged(listener: (user: CloudUser | null) => void): () => void {
    this.listeners.add(listener);
    listener(this.currentUser);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public async signInWithGoogle(): Promise<CloudUser> {
    this.currentUser = { ...this.mockAccount };
    for (const fn of this.listeners) fn(this.currentUser);
    return this.currentUser;
  }

  public async signOut(): Promise<void> {
    this.currentUser = null;
    for (const fn of this.listeners) fn(null);
  }

  public async fetchCloudSave(uid: string, slot = 1): Promise<unknown | null> {
    const found = this.cloudDocs.get(cloudSaveDocPath(uid, slot).slice(1).join('/'));
    return found ? structuredClone(found) : null;
  }

  public async pushCloudSave(
    uid: string,
    save: SaveData,
    customMapsEnvelopeJson?: string | null,
    slot = 1
  ): Promise<void> {
    const payload = serializeSaveForFirestore(save, slot === 1 ? customMapsEnvelopeJson : null);
    if (slot !== 1) {
      delete payload.customMapsEnvelopeJson;
      delete payload.customMapsUpdatedAt;
    }
    this.cloudDocs.set(cloudSaveDocPath(uid, slot).slice(1).join('/'), payload);
  }

  public async pushCustomMapsOnly(uid: string, customMapsEnvelopeJson: string): Promise<void> {
    const existing = this.cloudDocs.get(uid) ?? {};
    const merged: Record<string, unknown> = {
      ...structuredClone(existing),
      customMapsEnvelopeJson,
      customMapsUpdatedAt: Date.now(),
    };
    assertFirestoreNoNestedArrays(merged);
    this.cloudDocs.set(uid, merged);
  }

  public async deleteCloudSave(uid: string, slot = 1): Promise<void> {
    this.cloudDocs.delete(cloudSaveDocPath(uid, slot).slice(1).join('/'));
  }
}

// ---------------------------------------------------------------------------
// LocalStorage + Cloud Timestamp Reconciler
// ---------------------------------------------------------------------------

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
  const cloned = structuredClone(save);
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
  slot?: number;
}

export async function performCloudSaveReconciliation(
  ctx: ReconcileContext
): Promise<CloudSyncResolution> {
  const { cloud, user, localSave, writeLocalOnly, getCurrentSave } = ctx;
  const slot = ctx.slot ?? 1;
  const isBrowserPrimaryStorage = ctx.isBrowserPrimaryStorage;
  // Custom-map envelope sync only rides along with the slot-1 root doc.
  const syncMaps = isBrowserPrimaryStorage && slot === 1;

  if (isBrowserPrimaryStorage && localSave?.customMaps) {
    mergeCustomMapsRecord(localSave.customMaps);
  }

  const rawCloud = await cloud.fetchCloudSave(user.uid, slot);
  const { saveCandidate, customMapsEnvelope } = extractCloudPayloadParts(rawCloud);

  let mapSync = { localChanged: false, cloudOutdated: false };
  if (syncMaps) {
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

  const getEnvJson = () =>
    slot === 1 ? serializeCustomMapsEnvelope(isBrowserPrimaryStorage, getCurrentSave()) : null;
  const push = (save: SaveData) => cloud.pushCloudSave(user.uid, save, getEnvJson(), slot);

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
      await push(getCurrentSave()!);
    }
    return 'pulled_newer_cloud';
  }

  if (localSave && !cloudSave) {
    writeLocalOnly(attachMergedCustomMaps(localSave, isBrowserPrimaryStorage));
    await push(getCurrentSave()!);
    return 'pushed_newer_local';
  }

  if (cloudSave!.lastUpdated > localSave!.lastUpdated) {
    writeLocalOnly(attachMergedCustomMaps(cloudSave!, isBrowserPrimaryStorage));
    if (mapSync.cloudOutdated) {
      await push(getCurrentSave()!);
    }
    return 'pulled_newer_cloud';
  }

  if (localSave!.lastUpdated > cloudSave!.lastUpdated) {
    writeLocalOnly(attachMergedCustomMaps(localSave!, isBrowserPrimaryStorage));
    await push(getCurrentSave()!);
    return 'pushed_newer_local';
  }

  if (mapSync.localChanged) {
    writeLocalOnly(attachMergedCustomMaps(localSave!, isBrowserPrimaryStorage));
  }
  if (mapSync.cloudOutdated) {
    writeLocalOnly(attachMergedCustomMaps(localSave!, isBrowserPrimaryStorage));
    await push(getCurrentSave()!);
    return mapSync.localChanged ? 'pulled_newer_cloud' : 'pushed_newer_local';
  }

  return mapSync.localChanged ? 'pulled_newer_cloud' : 'already_in_sync';
}
