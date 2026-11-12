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
import {
  assertFirestoreNoNestedArrays,
  extractCloudPayloadParts,
  readFirebaseEnvConfig,
  serializeSaveForFirestore,
} from './firestoreCodec';

export {
  assertFirestoreNoNestedArrays,
  extractCloudPayloadParts,
  serializeSaveForFirestore,
};

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
    return found ? (JSON.parse(JSON.stringify(found)) as Record<string, unknown>) : null;
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
      ...(JSON.parse(JSON.stringify(existing)) as Record<string, unknown>),
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
