/**
 * Types, Presets & Runtime State for `ChapterMapEditorScene`
 */

import type { LoadedSpriteBundle } from '../../assets/pmdAssetLoader';
import type { LoadedTilesetSheet } from '../../assets/tilesetLoader';
import type { AudioManager } from '../../audio/AudioManager';
import {
  getEffectiveChapterMap,
  hasChapterMapOverride,
  type MapEditorTargetKind,
} from '../../data/chapterMapRegistry';
import type { SaveStateManager } from '../../state/SaveStateManager';
import type { DungeonMapDefinition, TerrainType } from '../../types/schemas';
import {
  computeDungeonCameraBounds,
  createInitialDungeonGridCamera,
  type DungeonGridCameraState,
} from '../../ui/gridViewportMath';
import { MultiTouchPinchTracker } from '../../ui/mapZoomController';

export const EDITOR_DRAG_THRESHOLD_PX = 8;
export const EDITOR_MAX_UNDO_STEPS = 40;

export type MapEditorToolMode =
  | 'paint'
  | 'stroke'
  | 'eyedropper'
  | 'player_spawn'
  | 'enemy_spawn'
  | 'stairs_wave'
  | 'pan';

export interface BiomeBrushPreset {
  id: string;
  label: string;
  terrainType: TerrainType;
  tilesetId: string;
  chunkIndex: number;
}

export const BIOME_BRUSH_PRESETS: ReadonlyArray<BiomeBrushPreset> = [
  { id: 'bluff_floor', label: 'Bluff Floor', terrainType: 'floor', tilesetId: '003', chunkIndex: 59 },
  { id: 'grass_floor', label: 'Lush Grass', terrainType: 'floor', tilesetId: '142', chunkIndex: 59 },
  { id: 'stone_road', label: 'Stone Road', terrainType: 'floor', tilesetId: '110', chunkIndex: 59 },
  { id: 'beach_sand', label: 'Beach Sand', terrainType: 'floor', tilesetId: '001', chunkIndex: 59 },
  { id: 'water_pool', label: 'Water', terrainType: 'water', tilesetId: '142', chunkIndex: 88 },
  { id: 'trees', label: 'Trees', terrainType: 'trees', tilesetId: '142', chunkIndex: 1 },
  { id: 'mountain', label: 'Mountain', terrainType: 'mountain', tilesetId: '110', chunkIndex: 1 },
  { id: 'bluff_wall', label: 'Bluff Wall', terrainType: 'wall', tilesetId: '003', chunkIndex: 1 },
  { id: 'cave_wall', label: 'Cave Wall', terrainType: 'wall', tilesetId: '001', chunkIndex: 1 },
  { id: 'lava', label: 'Lava', terrainType: 'lava', tilesetId: '110', chunkIndex: 106 },
  { id: 'void', label: 'Void', terrainType: 'void', tilesetId: '061', chunkIndex: 100 },
  { id: 'barrier', label: 'Barrier', terrainType: 'barrier', tilesetId: '080', chunkIndex: 15 },
  { id: 'stairs', label: 'Stairs', terrainType: 'stairs', tilesetId: '110', chunkIndex: 59 },
  { id: 'wonder', label: 'Wonder Tile', terrainType: 'wonder_tile', tilesetId: '142', chunkIndex: 59 },
];

/** Faded sprite shown on the map for reference (e.g. a cutscene's cast while painting its location) */
export interface EditorReferenceMarker {
  label: string;
  previewAssetId: string;
  x: number;
  y: number;
  direction: number;
}

/** Painting a cutscene location's tile layer, handed off from the Cutscene Editor */
export interface LocationEditSession {
  locationName: string;
  defaultTilesetId: string;
  markers: ReadonlyArray<EditorReferenceMarker>;
  onDone: (map: DungeonMapDefinition) => void;
  onCancel: () => void;
}

export interface ChapterMapEditorSnapshot {
  isOpen: boolean;
  kind: MapEditorTargetKind;
  levelId: string;
  mapName: string;
  width: number;
  height: number;
  deploymentCap: number;
  playerSpawnCount: number;
  enemySpawnCount: number;
  reinforcementWaveCount: number;
  actorMarkerCount: number;
  isCustomizedInStore: boolean;
  hasUnsavedChanges: boolean;
  toolMode: MapEditorToolMode;
  drawerOpen: boolean;
  systemMenuOpen: boolean;
  jsonModalOpen: boolean;
  showGrid: boolean;
  showSpawns: boolean;
  undoCount: number;
  brush: {
    terrainType: TerrainType;
    tilesetId: string;
    chunkIndex: number;
  };
  camera: {
    x: number;
    y: number;
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
    displayScale: number;
    imageSmoothingEnabled: boolean;
  };
}

export interface ChapterMapEditorSceneOptions {
  viewportEl: HTMLElement;
  saveManager: SaveStateManager;
  audioManager?: AudioManager;
  onExit: () => void;
  onPlayLevel: (levelId: string) => void;
  onLayerStateChanged?: () => void;
}

export interface EditorRuntimeState {
  openState: boolean;
  drawerOpen: boolean;
  systemMenuOpen: boolean;
  jsonModalOpen: boolean;
  previousBgmId: string | null;

  activeLevelId: string;
  editorTargetKind: MapEditorTargetKind;
  referenceMarkers: ReadonlyArray<EditorReferenceMarker>;
  locationSession: LocationEditSession | null;
  map: DungeonMapDefinition;
  undoStack: DungeonMapDefinition[];
  dirty: boolean;

  toolMode: MapEditorToolMode;
  brushTerrainType: TerrainType;
  brushTilesetId: string;
  brushChunkIndex: number;

  spawnEnemySpeciesId: string;
  spawnEnemyLevel: number;
  spawnWaveTurn: number;

  showGrid: boolean;
  showSpawns: boolean;

  inspectedTile: { x: number; y: number };
  hoveredTile: { x: number; y: number } | null;

  cam: DungeonGridCameraState;
  pinchTracker: MultiTouchPinchTracker;

  activePointerId: number | null;
  pointerStartX: number;
  pointerStartY: number;
  pointerStartCamX: number;
  pointerStartCamY: number;
  pointerMoved: boolean;
  strokeUndoPushed: boolean;
  lastStrokedCoordKey: string | null;

  toastTimer: number | null;

  loadedSheets: Map<string, LoadedTilesetSheet>;
  spriteBundles: Map<string, LoadedSpriteBundle>;
}

export function createInitialEditorState(): EditorRuntimeState {
  return {
    openState: false,
    drawerOpen: true,
    systemMenuOpen: false,
    jsonModalOpen: false,
    previousBgmId: null,

    activeLevelId: 'prologue',
    editorTargetKind: 'chapter',
    referenceMarkers: [],
    locationSession: null,
    map: getEffectiveChapterMap('prologue'),
    undoStack: [],
    dirty: false,

    toolMode: 'paint',
    brushTerrainType: 'floor',
    brushTilesetId: '003',
    brushChunkIndex: 59,

    spawnEnemySpeciesId: 'zigzagoon_galar',
    spawnEnemyLevel: 2,
    spawnWaveTurn: 2,

    showGrid: false,
    showSpawns: true,

    inspectedTile: { x: 8, y: 5 },
    hoveredTile: null,

    cam: createInitialDungeonGridCamera(),
    pinchTracker: new MultiTouchPinchTracker(),

    activePointerId: null,
    pointerStartX: 0,
    pointerStartY: 0,
    pointerStartCamX: 0,
    pointerStartCamY: 0,
    pointerMoved: false,
    strokeUndoPushed: false,
    lastStrokedCoordKey: null,

    toastTimer: null,

    loadedSheets: new Map(),
    spriteBundles: new Map(),
  };
}

export function buildEditorSnapshot(
  state: EditorRuntimeState,
  imageSmoothingEnabled: boolean
): ChapterMapEditorSnapshot {
  const bounds = computeDungeonCameraBounds(state.map.width, state.map.height, state.cam);
  return {
    isOpen: state.openState,
    kind: state.editorTargetKind,
    levelId: state.activeLevelId,
    mapName: state.map.name,
    width: state.map.width,
    height: state.map.height,
    deploymentCap:
      state.editorTargetKind === 'location'
        ? 0
        : (state.map.deploymentCap ?? Math.max(1, state.map.playerSpawns.length)),
    playerSpawnCount: state.map.playerSpawns.length,
    enemySpawnCount: state.map.enemySpawns.length,
    reinforcementWaveCount: state.map.reinforcements?.length ?? 0,
    actorMarkerCount:
      state.editorTargetKind === 'location'
        ? state.referenceMarkers.filter(
            (m) => m.x >= 0 && m.y >= 0 && m.x < state.map.width && m.y < state.map.height
          ).length
        : 0,
    isCustomizedInStore: hasChapterMapOverride(state.activeLevelId),
    hasUnsavedChanges: state.dirty,
    toolMode: state.toolMode,
    drawerOpen: state.drawerOpen,
    systemMenuOpen: state.systemMenuOpen,
    jsonModalOpen: state.jsonModalOpen,
    showGrid: state.showGrid,
    showSpawns: state.showSpawns,
    undoCount: state.undoStack.length,
    brush: {
      terrainType: state.brushTerrainType,
      tilesetId: state.brushTilesetId,
      chunkIndex: state.brushChunkIndex,
    },
    camera: {
      x: state.cam.cameraX,
      y: state.cam.cameraY,
      minX: bounds.minX,
      minY: bounds.minY,
      maxX: bounds.maxX,
      maxY: bounds.maxY,
      displayScale: state.cam.displayScale,
      imageSmoothingEnabled,
    },
  };
}
