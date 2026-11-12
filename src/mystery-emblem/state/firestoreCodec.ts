/**
 * Mystery Emblem - Cloud Firestore Flat Wire Codec (`firestoreCodec.ts`)
 *
 * Enforces Cloud Firestore's wire constraint: zero nested 2D arrays (`tiles[][]`),
 * zero `undefined` fields, and flat `customMapsEnvelopeJson` serialization.
 */

import type { SaveData } from '../types/schemas';

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

  return { saveCandidate: cloned, customMapsEnvelope };
}

export function readFirebaseEnvConfig(): FirebaseEnvConfig | null {
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
