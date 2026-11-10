/**
 * Out-of-Dungeon Cutscene Stage Catalog & Editor Metadata (`cutsceneStageCatalog.ts`)
 *
 * Registers every procedural stage grid in `cutsceneStages.ts` so designers can customize
 * cutscene tiles & dimensions in DevTools `Map Editor` (`kind === 'cutscene'`) and persist
 * overrides via `mapOverrideStore` (`localStorage` + Cloud Firestore `customMapsEnvelopeJson`).
 */

import { normalizePmdDirection } from '../../assets/pmdAssetLoader';
import type { CutsceneActorRole } from '../../scenes/cutscene/cutsceneTypes';
import type { DungeonMapDefinition, DungeonMapTileCell } from '../../types/schemas';
import { STORY_CUTSCENES } from '../storyCutscenes';
import { cloneDungeonMap } from './chapterCodec';
import {
  STAGE_01_COASTAL_MEADOW,
  STAGE_02_SANCTUARY_GLADE,
  STAGE_03_BLUFF_CAMP,
  STAGE_04_WATCHTOWER_PARAPET,
  STAGE_05_SHRINE_COURTYARD,
  STAGE_06_ORCHARD_TWILIGHT,
} from './cutsceneStages';
import {
  getDefaultChapterMap as getDefaultBattleChapterMap,
  validateDungeonMapDefinition as validateBattleChapterMap,
} from './defaultCatalog';
import { validateDungeonMapDefinition as validateMapWithDefaults } from './mapValidator';

export type MapEditorTargetKind = 'chapter' | 'cutscene';

export interface CutsceneStageActorMarker {
  cutsceneId: string;
  actorId: string;
  roleLabel: string;
  previewAssetId: string;
  x: number;
  y: number;
  direction: number;
}

export interface CutsceneStageCatalogEntry {
  id: string;
  kind: 'cutscene';
  shortCode: string;
  label: string;
  name: string;
  primaryTilesetId: string;
  bgmCue: string;
  width: number;
  height: number;
  defaultTiles: ReadonlyArray<ReadonlyArray<DungeonMapTileCell>>;
  cutsceneIds: ReadonlyArray<string>;
}

function makeStageEntry(spec: {
  id: string;
  shortCode: string;
  label: string;
  name: string;
  primaryTilesetId: string;
  bgmCue: string;
  defaultTiles: ReadonlyArray<ReadonlyArray<DungeonMapTileCell>>;
  cutsceneIds: ReadonlyArray<string>;
}): CutsceneStageCatalogEntry {
  return {
    ...spec,
    kind: 'cutscene',
    height: spec.defaultTiles.length,
    width: spec.defaultTiles[0]?.length ?? 16,
  };
}

export const CUTSCENE_STAGE_CATALOG: ReadonlyArray<CutsceneStageCatalogEntry> = [
  makeStageEntry({
    id: 'cutscene_stage_01_coastal_meadow',
    shortCode: 'CS1',
    label: 'Stage 1 — Coastal Meadow (cs_01)',
    name: 'Coastal Meadow',
    primaryTilesetId: '042',
    bgmCue: 'in_the_morning_sun',
    defaultTiles: STAGE_01_COASTAL_MEADOW,
    cutsceneIds: ['cs_01_coastal_friends'],
  }),
  makeStageEntry({
    id: 'cutscene_stage_02_sanctuary_glade',
    shortCode: 'CS2',
    label: 'Stage 2 — Sanctuary Glade (cs_03)',
    name: 'Sanctuary Glade',
    primaryTilesetId: '042',
    bgmCue: 'one_for_all',
    defaultTiles: STAGE_02_SANCTUARY_GLADE,
    cutsceneIds: ['cs_03_bluff_campfire'],
  }),
  makeStageEntry({
    id: 'cutscene_stage_03_bluff_camp',
    shortCode: 'CS3',
    label: 'Stage 3 — Bluff Camp (cs_02)',
    name: 'Bluff Camp',
    primaryTilesetId: '003',
    bgmCue: 'thoughts_for_friends',
    defaultTiles: STAGE_03_BLUFF_CAMP,
    cutsceneIds: ['cs_02_sanctuary_reveal'],
  }),
  makeStageEntry({
    id: 'cutscene_stage_04_watchtower_parapet',
    shortCode: 'CS4',
    label: 'Stage 4 — Watchtower Parapet (cs_04, cs_07)',
    name: 'Watchtower Parapet',
    primaryTilesetId: '014',
    bgmCue: 'calm_cutscene',
    defaultTiles: STAGE_04_WATCHTOWER_PARAPET,
    cutsceneIds: ['cs_04_watchtower_bells', 'cs_07_lantern_pass'],
  }),
  makeStageEntry({
    id: 'cutscene_stage_05_shrine_courtyard',
    shortCode: 'CS5',
    label: 'Stage 5 — Shrine Courtyard (cs_05)',
    name: 'Shrine Courtyard',
    primaryTilesetId: '016',
    bgmCue: 'thoughts_for_friends',
    defaultTiles: STAGE_05_SHRINE_COURTYARD,
    cutsceneIds: ['cs_05_sanctuary_war_room'],
  }),
  makeStageEntry({
    id: 'cutscene_stage_06_orchard_twilight',
    shortCode: 'CS6',
    label: 'Stage 6 — Orchard Twilight (cs_06, cs_08)',
    name: 'Orchard Twilight',
    primaryTilesetId: '042',
    bgmCue: 'at_the_end_of_the_day',
    defaultTiles: STAGE_06_ORCHARD_TWILIGHT,
    cutsceneIds: ['cs_06_orchard_celebration', 'cs_08_fortress_resolve'],
  }),
];

const stageById = new Map<string, CutsceneStageCatalogEntry>(
  CUTSCENE_STAGE_CATALOG.map((entry) => [entry.id, entry])
);

const stageIdByCutsceneId = new Map<string, string>();
for (const entry of CUTSCENE_STAGE_CATALOG) {
  for (const csId of entry.cutsceneIds) {
    stageIdByCutsceneId.set(csId, entry.id);
  }
}

export function isCutsceneStageId(id: string): boolean {
  return stageById.has(id);
}

export function getCutsceneStageCatalogEntry(
  stageId: string
): CutsceneStageCatalogEntry | undefined {
  return stageById.get(stageId);
}

export function resolveCutsceneStageIdForDefinition(def: {
  id: string;
  tiles: ReadonlyArray<ReadonlyArray<DungeonMapTileCell>>;
}): string | null {
  const byId = stageIdByCutsceneId.get(def.id);
  if (byId) return byId;
  const byTiles = CUTSCENE_STAGE_CATALOG.find((s) => s.defaultTiles === def.tiles);
  return byTiles?.id ?? null;
}

export function getDefaultCutsceneStageMap(stageId: string): DungeonMapDefinition {
  const entry = stageById.get(stageId) ?? CUTSCENE_STAGE_CATALOG[0]!;
  return {
    id: entry.id,
    name: entry.name,
    bgmCue: entry.bgmCue,
    deploymentCap: 0,
    width: entry.width,
    height: entry.height,
    tiles: entry.defaultTiles.map((row) => row.map((c) => ({ ...c }))),
    playerSpawns: [],
    enemySpawns: [],
  };
}

export function getDefaultTargetMap(id: string): DungeonMapDefinition {
  if (stageById.has(id)) return getDefaultCutsceneStageMap(id);
  return cloneDungeonMap(getDefaultBattleChapterMap(id));
}

export function validateTargetMapDefinition(
  candidate: unknown,
  expectedId?: string
): { valid: boolean; errors: string[]; map?: DungeonMapDefinition } {
  const resolvedId =
    expectedId ??
    (candidate &&
    typeof candidate === 'object' &&
    typeof (candidate as { id?: unknown }).id === 'string'
      ? (candidate as { id: string }).id.trim()
      : undefined);

  if (resolvedId && stageById.has(resolvedId)) {
    const entry = stageById.get(resolvedId)!;
    return validateMapWithDefaults(candidate, resolvedId, {
      label: entry.name,
      bgmCue: entry.bgmCue,
      defaultDeploymentCap: 0,
      allowEmptySpawns: true,
    });
  }
  return validateBattleChapterMap(candidate, expectedId);
}

function describeActorRole(role: CutsceneActorRole): {
  roleLabel: string;
  previewAssetId: string;
} {
  switch (role.kind) {
    case 'lord':
      return { roleLabel: 'Lord', previewAssetId: 'axew' };
    case 'partner':
      return { roleLabel: 'Partner', previewAssetId: 'piplup' };
    case 'healer':
      return { roleLabel: 'Healer', previewAssetId: 'flabebe' };
    case 'mentor':
      return { roleLabel: 'Sir Empoleon', previewAssetId: 'sir_empoleon' };
    case 'advisor':
      return { roleLabel: 'Wimpod', previewAssetId: 'wimpod' };
    case 'npc':
      return { roleLabel: role.name, previewAssetId: role.pmdAssetId };
    case 'cameo_recruit': {
      const cameoFallbacks = ['starly', 'sewaddle', 'ralts', 'elekid'];
      return {
        roleLabel: `Recruit #${role.slotIndex + 1}`,
        previewAssetId: cameoFallbacks[role.slotIndex % cameoFallbacks.length]!,
      };
    }
  }
}

let cachedMarkersByStageId: Map<string, ReadonlyArray<CutsceneStageActorMarker>> | null = null;

export function getCutsceneStageActorMarkers(
  stageId: string
): ReadonlyArray<CutsceneStageActorMarker> {
  if (!cachedMarkersByStageId) {
    cachedMarkersByStageId = new Map();
    for (const entry of CUTSCENE_STAGE_CATALOG) {
      const seen = new Set<string>();
      const markers: CutsceneStageActorMarker[] = [];
      const matchingCutscenes = STORY_CUTSCENES.filter(
        (cs) => entry.cutsceneIds.includes(cs.id) || cs.tiles === entry.defaultTiles
      );
      for (const cs of matchingCutscenes) {
        for (const actor of cs.actors) {
          if (actor.visible === false) continue;
          const dedupeKey = `${actor.actorId}@${actor.x},${actor.y}`;
          if (seen.has(dedupeKey)) continue;
          seen.add(dedupeKey);
          const { roleLabel, previewAssetId } = describeActorRole(actor.role);
          markers.push({
            cutsceneId: cs.id,
            actorId: actor.actorId,
            roleLabel,
            previewAssetId,
            x: actor.x,
            y: actor.y,
            direction: normalizePmdDirection(actor.direction, 0),
          });
        }
      }
      cachedMarkersByStageId.set(entry.id, markers);
    }
  }
  return cachedMarkersByStageId.get(stageId) ?? [];
}
