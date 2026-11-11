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
  getDefaultChapterMap,
  validateDungeonMapDefinition,
} from './chapters/defaultCatalog';
export * from './mapOverrideStore';

/** `chapter` = a battle map; `location` = a cutscene location tile layer (hand-off mode) */
export type MapEditorTargetKind = 'chapter' | 'location';
