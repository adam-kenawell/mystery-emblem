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
import type { SaveData } from '../types/schemas';

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
  fetchCloudSave(uid: string): Promise<unknown | null>;
  pushCloudSave(
    uid: string,
    save: SaveData,
    customMapsEnvelopeJson?: string | null
  ): Promise<void>;
  pushCustomMapsOnly?(uid: string, customMapsEnvelopeJson: string): Promise<void>;
  deleteCloudSave(uid: string): Promise<void>;
}

/**
 * Enforces Cloud Firestore's wire constraint: nested arrays (`Array<Array<unknown>>`,
 * such as 2D `DungeonMapTileCell[][]` grids) are strictly forbidden inside Firestore documents.
 */
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

/**
 * Converts a `SaveData` payload (which may contain 2D `tiles[][]` inside `customMaps`) into a
 * 100% Cloud Firestore-compatible flat document (`customMapsEnvelopeJson` string, zero nested arrays).
 */
export function serializeSaveForFirestore(
  save: SaveData,
  customMapsEnvelopeJson?: string | null
): Record<string, unknown> {
  const cleanPayload = JSON.parse(JSON.stringify(save)) as Record<string, unknown>;
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

/**
 * Unpacks a raw Firestore `saves/{uid}` document into:
 * - `saveCandidate`: Campaign `SaveData` (if `schemaVersion` exists on the document), and
 * - `customMapsEnvelope`: Decoded custom chapter maps & reset tombstones (even when no campaign save exists yet).
 */
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

  const cloned = JSON.parse(JSON.stringify(obj)) as Record<string, unknown>;
  delete cloned.customMapsEnvelopeJson;
  delete cloned.customMapsUpdatedAt;
  delete cloned.customMaps;

  return {
    saveCandidate: cloned,
    customMapsEnvelope,
  };
}

interface FirebaseEnvConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId: string;
}

function readFirebaseEnvConfig(): FirebaseEnvConfig | null {
  const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env ?? {};
  const apiKey = env.PUBLIC_FIREBASE_API_KEY?.trim() ?? '';
  const authDomain = env.PUBLIC_FIREBASE_AUTH_DOMAIN?.trim() ?? '';
  const projectId = env.PUBLIC_FIREBASE_PROJECT_ID?.trim() ?? '';
  const appId = env.PUBLIC_FIREBASE_APP_ID?.trim() ?? '';

  if (!apiKey || !authDomain || !projectId || !appId) {
    return null;
  }

  return {
    apiKey,
    authDomain,
    projectId,
    storageBucket: env.PUBLIC_FIREBASE_STORAGE_BUCKET?.trim() || undefined,
    messagingSenderId: env.PUBLIC_FIREBASE_MESSAGING_SENDER_ID?.trim() || undefined,
    appId,
  };
}

function toCloudUser(user: User | null): CloudUser | null {
  if (!user) return null;
  return {
    uid: user.uid,
    email: user.email,
    displayName: user.displayName,
  };
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
    if (!this.auth) return null;
    return toCloudUser(this.auth.currentUser);
  }

  public onAuthStateChanged(listener: (user: CloudUser | null) => void): () => void {
    if (!this.auth) {
      listener(null);
      return () => {};
    }
    return fbOnAuthStateChanged(this.auth, (user) => {
      listener(toCloudUser(user));
    });
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
    if (!mapped) {
      throw new Error('Google Sign-In did not return an authenticated user.');
    }
    return mapped;
  }

  public async signOut(): Promise<void> {
    if (!this.auth) return;
    await fbSignOut(this.auth);
  }

  public async fetchCloudSave(uid: string): Promise<unknown | null> {
    if (!this.db) return null;
    const ref = doc(this.db, 'saves', uid);
    const snap = await getDoc(ref);
    if (!snap.exists()) return null;
    return snap.data();
  }

  public async pushCloudSave(
    uid: string,
    save: SaveData,
    customMapsEnvelopeJson?: string | null
  ): Promise<void> {
    if (!this.db) return;
    const ref = doc(this.db, 'saves', uid);
    // Serialize SaveData + flat customMapsEnvelopeJson (strictly zero 2D nested arrays!)
    const firestorePayload = serializeSaveForFirestore(save, customMapsEnvelopeJson);
    await setDoc(ref, firestorePayload);
  }

  public async pushCustomMapsOnly(uid: string, customMapsEnvelopeJson: string): Promise<void> {
    if (!this.db) return;
    const ref = doc(this.db, 'saves', uid);
    const mergePayload = {
      customMapsEnvelopeJson,
      customMapsUpdatedAt: Date.now(),
    };
    assertFirestoreNoNestedArrays(mergePayload);
    await setDoc(ref, mergePayload, { merge: true });
  }

  public async deleteCloudSave(uid: string): Promise<void> {
    if (!this.db) return;
    const ref = doc(this.db, 'saves', uid);
    await deleteDoc(ref);
  }
}

/**
 * Deterministic in-memory CloudSyncAdapter used for automated cross-device
 * Desktop <-> Cloud <-> Mobile timestamp conflict resolution tests.
 * Enforces Firestore's exact wire constraints (including zero nested arrays).
 */
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

  public async fetchCloudSave(uid: string): Promise<unknown | null> {
    const found = this.cloudDocs.get(uid);
    return found ? (JSON.parse(JSON.stringify(found)) as Record<string, unknown>) : null;
  }

  public async pushCloudSave(
    uid: string,
    save: SaveData,
    customMapsEnvelopeJson?: string | null
  ): Promise<void> {
    const firestorePayload = serializeSaveForFirestore(save, customMapsEnvelopeJson);
    this.cloudDocs.set(uid, firestorePayload);
  }

  public async pushCustomMapsOnly(uid: string, customMapsEnvelopeJson: string): Promise<void> {
    const existing = this.cloudDocs.get(uid) ?? {};
    const merged: Record<string, unknown> = {
      ...(JSON.parse(JSON.stringify(existing)) as Record<string, unknown>),
      customMapsEnvelopeJson,
      customMapsUpdatedAt: Date.now(),
    };
    assertFirestoreNoNestedArrays(merged);
    this.cloudDocs.set(uid, merged);
  }

  public async deleteCloudSave(uid: string): Promise<void> {
    this.cloudDocs.delete(uid);
  }
}
