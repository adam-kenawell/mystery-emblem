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
import { doc, getDoc, getFirestore, setDoc, type Firestore } from 'firebase/firestore';
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
  pushCloudSave(uid: string, save: SaveData): Promise<void>;
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

  public async pushCloudSave(uid: string, save: SaveData): Promise<void> {
    if (!this.db) return;
    const ref = doc(this.db, 'saves', uid);
    // Write clean JSON-serializable SaveData document to saves/{uid}
    const cleanPayload = JSON.parse(JSON.stringify(save)) as SaveData;
    await setDoc(ref, cleanPayload);
  }
}

/**
 * Deterministic in-memory CloudSyncAdapter used for automated cross-device
 * Desktop <-> Cloud <-> Mobile timestamp conflict resolution tests.
 */
export class InMemoryCloudSyncAdapter implements CloudSyncAdapter {
  public readonly isConfigured = true;
  private currentUser: CloudUser | null = null;
  private readonly listeners = new Set<(user: CloudUser | null) => void>();
  private readonly cloudDocs: Map<string, SaveData>;
  private readonly mockAccount: CloudUser;

  constructor(
    sharedCloudStore: Map<string, SaveData> = new Map(),
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
    return found ? (JSON.parse(JSON.stringify(found)) as SaveData) : null;
  }

  public async pushCloudSave(uid: string, save: SaveData): Promise<void> {
    this.cloudDocs.set(uid, JSON.parse(JSON.stringify(save)) as SaveData);
  }
}
