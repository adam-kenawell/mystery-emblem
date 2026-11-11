/**
 * Cutscene Stage Asset Loading & Actor Resolution (`cutsceneActorResolver.ts`)
 */

import {
  loadNamedSpriteAnimation,
  loadSpeciesSpriteBundle,
  normalizePmdDirection,
  PMD_SPRITE_ACTIONS,
  type LoadedActionAnimation,
  type LoadedSpriteBundle,
} from '../../assets/pmdAssetLoader';
import {
  loadTilesetSheet,
  normalizeTilesetId,
  type LoadedTilesetSheet,
} from '../../assets/tilesetLoader';
import type {
  CastMember,
  CastPlacement,
  CutsceneDoc,
  LocationDoc,
  PropPlacement,
} from '../../data/cutscenes/cutsceneDocTypes';
import { collectCutsceneLocationIds, getLocationDoc } from '../../data/cutscenes/cutsceneRegistry';
import { castIdentityToSpeakerRef } from '../../data/cutscenes/dialogueCompiler';
import { decodeLocationTileRows } from '../../data/cutscenes/locationCodec';
import { loadMediaImage, resolveMediaUrl } from '../../data/cutscenes/mediaLibrary';
import { resolveSpeakerIdentity } from '../../engine/speakerResolver';
import type { SaveData } from '../../types/schemas';
import type {
  ResolvedLocation,
  ResolvedLocationLayer,
  RuntimeCutsceneActor,
  RuntimeCutsceneProp,
} from './cutsceneTypes';

export interface CutsceneAssetCaches {
  tilesetSheets: Map<string, LoadedTilesetSheet>;
  spriteBundles: Map<string, LoadedSpriteBundle>;
  namedAnims: Map<string, LoadedActionAnimation | null>;
  locations: Map<string, ResolvedLocation>;
  propImages: Map<string, HTMLImageElement | null>;
}

export function createCutsceneAssetCaches(): CutsceneAssetCaches {
  return {
    tilesetSheets: new Map(),
    spriteBundles: new Map(),
    namedAnims: new Map(),
    locations: new Map(),
    propImages: new Map(),
  };
}

export const namedAnimKey = (visualAssetKey: string, anim: string) => `${visualAssetKey}::${anim}`;

export function isCanonicalPoseName(anim: string): boolean {
  return (PMD_SPRITE_ACTIONS as readonly string[]).includes(anim);
}

const FALLBACK_LOCATION: LocationDoc = { id: '__missing__', name: 'Missing location', width: 16, height: 11, layers: [] };

export function instantiateCutsceneActor(
  member: CastMember,
  placement: CastPlacement | undefined,
  save: SaveData | null
): RuntimeCutsceneActor {
  const ref = castIdentityToSpeakerRef(member.who, save);
  const identity = ref ? resolveSpeakerIdentity(ref, save) : null;
  const available = Boolean(identity);
  return {
    actorId: member.id,
    roleKind: member.who.kind,
    nickname: identity?.nickname ?? 'Ally',
    speciesId: identity?.speciesId,
    pmdAssetId: identity?.pmdAssetId ?? '0016',
    visualAssetKey: identity ? (identity.visualAssetId ?? identity.speciesId ?? identity.pmdAssetId) : 'starly',
    available,
    offStage: Boolean(member.offStage),
    visible: available && !member.offStage && Boolean(placement) && !placement?.hidden,
    alpha: 1,
    alphaFade: null,
    x: placement?.x ?? 0,
    y: placement?.y ?? 0,
    direction: normalizePmdDirection(placement?.facing ?? 'Down', 0),
    action: 'Idle',
    poseName: null,
    poseAnim: null,
    animElapsedMs: (member.id.length * 97) % 400,
    walk: null,
    hop: null,
    shakeRemainingMs: 0,
    poseRemainingMs: 0,
    emote: null,
  };
}

export function instantiateCutsceneProp(
  placement: PropPlacement,
  caches: CutsceneAssetCaches
): RuntimeCutsceneProp {
  return {
    id: placement.id,
    kind: placement.kind,
    imageName: placement.image,
    image: placement.image ? (caches.propImages.get(placement.image) ?? null) : null,
    x: placement.x,
    y: placement.y,
    visible: !placement.hidden,
    layer: placement.layer ?? (placement.kind === 'campfire' ? 'behind' : 'auto'),
    walk: null,
  };
}

export async function resolveLocation(
  locationId: string,
  caches: CutsceneAssetCaches,
  override?: LocationDoc
): Promise<ResolvedLocation> {
  const doc = override ?? getLocationDoc(locationId) ?? { ...FALLBACK_LOCATION, id: locationId };
  const layers: ResolvedLocationLayer[] = [];
  const sheetIds = new Set<string>();
  for (const layer of doc.layers) {
    if (layer.kind === 'tiles') {
      const grid = decodeLocationTileRows(layer.rows, layer.tileset, doc.width, doc.height);
      for (const row of grid) for (const cell of row) if (cell) sheetIds.add(normalizeTilesetId(cell.tilesetId));
      layers.push({ ...layer, grid });
    } else {
      const url = resolveMediaUrl('cutscene-backgrounds', layer.image);
      layers.push({ ...layer, img: url ? await loadMediaImage(url) : null });
    }
  }
  await Promise.all(
    [...sheetIds].map(async (id) => {
      if (!caches.tilesetSheets.has(id)) caches.tilesetSheets.set(id, await loadTilesetSheet(id));
    })
  );
  const resolved: ResolvedLocation = {
    doc,
    width: doc.width,
    height: doc.height,
    layers,
    fillsScreen: doc.layers.some((l) => l.kind === 'texture'),
  };
  if (!override) caches.locations.set(locationId, resolved);
  return resolved;
}

function collectProps(doc: CutsceneDoc): PropPlacement[] {
  const props = [...(doc.props ?? [])];
  for (const beat of doc.beats) {
    for (const a of beat.actions ?? []) if (a.type === 'location') props.push(...(a.props ?? []));
  }
  return props;
}

/** Loads every tileset, location image, sprite, pose animation and prop image a cutscene uses. */
export async function preloadCutsceneAssets(opts: {
  doc: CutsceneDoc;
  actors: ReadonlyArray<RuntimeCutsceneActor>;
  caches: CutsceneAssetCaches;
  locationOverrides?: ReadonlyMap<string, LocationDoc>;
}): Promise<void> {
  const { doc, actors, caches } = opts;
  const visualByCast = new Map(actors.map((a) => [a.actorId, a.visualAssetKey]));
  const poseLoads: Array<Promise<void>> = [];
  for (const beat of doc.beats) {
    for (const a of beat.actions ?? []) {
      if (a.type !== 'pose' || isCanonicalPoseName(a.anim)) continue;
      const vis = visualByCast.get(a.who);
      if (!vis) continue;
      const key = namedAnimKey(vis, a.anim);
      if (caches.namedAnims.has(key)) continue;
      poseLoads.push(
        loadNamedSpriteAnimation(vis, a.anim).then((anim) => {
          caches.namedAnims.set(key, anim);
        })
      );
    }
  }
  const propLoads = collectProps(doc)
    .filter((p) => p.kind === 'image' && p.image && !caches.propImages.has(p.image))
    .map(async (p) => {
      const url = resolveMediaUrl('cutscene-props', p.image);
      caches.propImages.set(p.image!, url ? await loadMediaImage(url) : null);
    });
  const spriteKeys = new Set(actors.filter((a) => a.available && !a.offStage).map((a) => a.visualAssetKey));

  await Promise.all([
    ...collectCutsceneLocationIds(doc).map(async (id) => {
      const override = opts.locationOverrides?.get(id);
      if (override) caches.locations.set(id, await resolveLocation(id, caches, override));
      else if (caches.locations.get(id)?.doc !== getLocationDoc(id)) await resolveLocation(id, caches);
    }),
    ...[...spriteKeys].map(async (key) => {
      if (!caches.spriteBundles.has(key)) caches.spriteBundles.set(key, await loadSpeciesSpriteBundle(key));
    }),
    ...poseLoads,
    ...propLoads,
  ]);
}
