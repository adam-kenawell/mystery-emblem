/**
 * Cutscene Actor Resolver, Preloader & Snapshot Builder (`cutsceneActorResolver.ts`)
 */

import {
  loadSpeciesSpriteBundle,
  normalizePmdDirection,
  type LoadedSpriteBundle,
} from '../../assets/pmdAssetLoader';
import {
  loadTilesetSheet,
  normalizeTilesetId,
  type LoadedTilesetSheet,
} from '../../assets/tilesetLoader';
import {
  getEffectiveChapterMap,
  hasChapterMapOverride,
  resolveCutsceneStageIdForDefinition,
} from '../../data/chapterMapRegistry';
import {
  resolveRecruitCameoUnits,
  resolveSpeakerIdentity,
} from '../../engine/speakerResolver';
import type { SaveData } from '../../types/schemas';
import type { CutsceneChoreographer } from './cutsceneChoreographer';
import type {
  CutsceneActorSpawnDef,
  CutsceneSceneSnapshot,
  RuntimeCutsceneActor,
  StoryCutsceneDefinition,
} from './cutsceneTypes';

export function instantiateCutsceneActor(
  spawn: CutsceneActorSpawnDef,
  save: SaveData | null
): RuntimeCutsceneActor {
  let nickname = 'Ally';
  let speciesId: string | undefined;
  let pmdAssetId = '0610';
  let visualAssetKey = 'axew';
  let available = true;

  switch (spawn.role.kind) {
    case 'lord':
    case 'partner':
    case 'healer':
    case 'mentor':
    case 'advisor': {
      const id = resolveSpeakerIdentity({ kind: spawn.role.kind }, save);
      nickname = id.nickname;
      speciesId = id.speciesId;
      pmdAssetId = id.pmdAssetId;
      visualAssetKey = id.visualAssetId ?? id.speciesId ?? id.pmdAssetId;
      break;
    }
    case 'npc': {
      nickname = spawn.role.name;
      pmdAssetId = spawn.role.pmdAssetId;
      visualAssetKey = spawn.role.pmdAssetId;
      break;
    }
    case 'cameo_recruit': {
      const cameos = resolveRecruitCameoUnits(save);
      const picked = cameos[spawn.role.slotIndex];
      if (!picked) {
        nickname = 'Ally';
        pmdAssetId = '0016';
        visualAssetKey = 'starly';
        available = false;
      } else {
        const id = resolveSpeakerIdentity(
          { kind: 'unit', instanceId: picked.instanceId, fallbackSpeciesId: picked.speciesId },
          save
        );
        nickname = id.nickname;
        speciesId = id.speciesId;
        pmdAssetId = id.pmdAssetId;
        visualAssetKey = id.visualAssetId ?? id.speciesId ?? id.pmdAssetId;
      }
      break;
    }
  }

  return {
    actorId: spawn.actorId,
    roleKind: spawn.role.kind,
    nickname,
    speciesId,
    pmdAssetId,
    visualAssetKey,
    available,
    visible: available && spawn.visible !== false,
    x: spawn.x,
    y: spawn.y,
    direction: normalizePmdDirection(spawn.direction, 0),
    action: 'Idle',
    animElapsedMs: (spawn.actorId.length * 97) % 400,
    walk: null,
    hop: null,
    shakeRemainingMs: 0,
    poseRemainingMs: 0,
    emote: null,
  };
}

export async function preloadCutsceneStageAssets(opts: {
  def: StoryCutsceneDefinition;
  actors: ReadonlyArray<RuntimeCutsceneActor>;
  tilesetSheets: Map<string, LoadedTilesetSheet>;
  spriteBundles: Map<string, LoadedSpriteBundle>;
}): Promise<void> {
  const tileIds = new Set<string>();
  for (const row of opts.def.tiles) {
    for (const cell of row) tileIds.add(normalizeTilesetId(cell.tilesetId));
  }
  const spriteKeys = new Set<string>(
    opts.actors.filter((a) => a.available).map((a) => a.visualAssetKey)
  );

  await Promise.all([
    ...[...tileIds].map(async (id) => {
      if (!opts.tilesetSheets.has(id)) {
        opts.tilesetSheets.set(id, await loadTilesetSheet(id));
      }
    }),
    ...[...spriteKeys].map(async (visKey) => {
      if (!opts.spriteBundles.has(visKey)) {
        opts.spriteBundles.set(visKey, await loadSpeciesSpriteBundle(visKey));
      }
    }),
  ]);
}

export function resolveEffectiveCutsceneDefinition(rawDef: StoryCutsceneDefinition): {
  def: StoryCutsceneDefinition;
  stageId: string | null;
  isStageCustomized: boolean;
} {
  const stageId = resolveCutsceneStageIdForDefinition(rawDef);
  if (!stageId || !hasChapterMapOverride(stageId)) {
    return { def: rawDef, stageId, isStageCustomized: false };
  }
  const ov = getEffectiveChapterMap(stageId);
  const maxX = Math.max(0, ov.width - 1);
  const maxY = Math.max(0, ov.height - 1);
  return {
    def: {
      ...rawDef,
      width: ov.width,
      height: ov.height,
      tiles: ov.tiles,
      actors: rawDef.actors.map((a) => ({
        ...a,
        x: Math.max(0, Math.min(maxX, a.x)),
        y: Math.max(0, Math.min(maxY, a.y)),
      })),
    },
    stageId,
    isStageCustomized: true,
  };
}

export function buildCutsceneSceneSnapshot(opts: {
  isOpen: boolean;
  activeDef: StoryCutsceneDefinition | null;
  stageId: string | null;
  isStageCustomized: boolean;
  currentLineIndex: number;
  choreo: CutsceneChoreographer;
  displayScale: number;
  actors: ReadonlyArray<RuntimeCutsceneActor>;
}): CutsceneSceneSnapshot {
  return {
    isOpen: opts.isOpen,
    cutsceneId: opts.activeDef?.id ?? null,
    stageId: opts.stageId,
    isStageCustomized: opts.isStageCustomized,
    stageWidth: opts.activeDef?.width ?? 0,
    stageHeight: opts.activeDef?.height ?? 0,
    title: opts.activeDef?.title ?? null,
    locationLabel: opts.activeDef?.locationLabel ?? null,
    lightingMood: opts.activeDef?.lightingMood ?? null,
    currentLineIndex: opts.currentLineIndex,
    cameraTile: {
      x: Math.round(opts.choreo.cameraTileX * 100) / 100,
      y: Math.round(opts.choreo.cameraTileY * 100) / 100,
    },
    displayScale: opts.displayScale,
    actors: opts.actors
      .filter((a) => a.available)
      .map((a) => ({
        actorId: a.actorId,
        roleKind: a.roleKind,
        nickname: a.nickname,
        speciesId: a.speciesId,
        pmdAssetId: a.pmdAssetId,
        visualAssetKey: a.visualAssetKey,
        visible: a.visible,
        x: Math.round(a.x * 100) / 100,
        y: Math.round(a.y * 100) / 100,
        direction: a.direction,
        action: a.action,
        activeEmote: a.emote?.kind ?? null,
      })),
    propCount: opts.activeDef?.props?.length ?? 0,
  };
}
