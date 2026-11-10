/**
 * Barrel re-export for Chapter Map Catalog, Codec & Persistent Override Store.
 */

export * from './chapters/chapterTypes';
export {
  DEFAULT_TERRAIN_PALETTE,
  cloneDungeonMap,
  decodeTileRows,
  encodeTileRows,
} from './chapters/chapterCodec';
export { isCorruptedAllWaterOverride } from './chapters/mapValidator';
export {
  CHAPTER_LEVEL_CATALOG,
  getChapterCatalogEntry,
} from './chapters/defaultCatalog';
export {
  CUTSCENE_STAGE_CATALOG,
  getCutsceneStageActorMarkers,
  getCutsceneStageCatalogEntry,
  getDefaultCutsceneStageMap,
  getDefaultTargetMap as getDefaultChapterMap,
  isCutsceneStageId,
  resolveCutsceneStageIdForDefinition,
  validateTargetMapDefinition as validateDungeonMapDefinition,
  type CutsceneStageActorMarker,
  type CutsceneStageCatalogEntry,
  type MapEditorTargetKind,
} from './chapters/cutsceneStageCatalog';
export * from './mapOverrideStore';
