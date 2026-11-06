/**
 * Handcrafted Playable Dungeon Skirmish Map (`18x12` = `864x576px` at `2x` scale)
 *
 * Uses verified seamless 24x24 chunks from PMD: Explorers of Sky tilesets:
 * - `142` (Lush Prairie: grass floor, standalone foliage trees, sparkling stream)
 * - `110` (Steam Cave / Crag: stone road floor, rocky mountain crags)
 * - `001` (Beach Cave: cavern perimeter walls)
 * Plus `Wonder Tile` (`(8, 6)`) and `Dungeon Stairs` (`(15, 2)`) overlays.
 *
 * Paced so Turn 1 lets the player engage the frontline scout immediately or take cover
 * in Trees / Wonder Tile while Enemy Phase AI visibly pursues and attacks across lanes.
 */

import { PMD_TILE_NATIVE_PX } from '../assets/tilesetLoader';
import { isOffensiveMove, type BattleMoveSlot, type BattleUnitState } from '../engine/combatEngine';
import type {
  DungeonMapDefinition,
  DungeonMapTileCell,
  SaveData,
  StatBlockSeven,
  TerrainType,
} from '../types/schemas';
import { getMoveById, getSpeciesById } from './index';
import { DEFAULT_TERRAIN_PALETTE } from './testDungeonMap';

function cell(
  terrainType: TerrainType,
  tilesetId?: string,
  chunkIndex?: number
): DungeonMapTileCell {
  const def = DEFAULT_TERRAIN_PALETTE[terrainType];
  return {
    terrainType,
    tilesetId: tilesetId ?? def.tilesetId,
    chunkIndex: chunkIndex ?? def.chunkIndex,
  };
}

/**
 * ASCII Layout (`18` cols x `12` rows):
 * - `#` = Cavern Perimeter Wall (`wall`)
 * - `.` = Lush Grass Floor (`floor`, `142`)
 * - `,` = Stone Vanguard Road (`floor`, `110`)
 * - `T` = Trees / Foliage (`trees`, `+1 Def/SpD, +15% Avoid` Grounded)
 * - `~` = Shallow Stream (`water`, passable to Water/Flying/Levitate; bridged on y=5..6)
 * - `M` = Mountain Crag (`mountain`, `+2 Def/SpD, +20% Avoid` Grounded)
 * - `W` = Wonder Tile (`wonder_tile`, `+2 Def/SpD, +20% Avoid, 20% HP heal`)
 * - `S` = Dungeon Stairs (`stairs`, `+1 Def/SpD, +10% Avoid`)
 */
const PLAYABLE_ASCII_LAYOUT: ReadonlyArray<string> = [
  '##################', // y=0
  '#.....~~..MM,,,,.#', // y=1
  '#..T..~~..MM,,,S.#', // y=2
  '#.....~~...T,,,,.#', // y=3  <- Partner (3,3); Seedot (11,3)
  '#..T.......,,,,,M#', // y=4
  '#.....,.,,.,,,,,.#', // y=5  <- Dragon Lord (3,5); Outrider Zigzagoon (9,5)
  '#.....,.W,.,,,,,.#', // y=6  <- Wonder Tile (8,6)
  '#....T~~....,,,,.#', // y=7  <- Ally 3 (3,7); Shadow Scout Gothita (12,7)
  '#.....~~..TT,,,,.#', // y=8
  '#..T..~~...T...M.#', // y=9
  '#................#', // y=10
  '##################', // y=11
];

function battleTileFromAscii(ch: string, x: number, y: number): DungeonMapTileCell {
  const parity = (x * 7 + y * 13) % 3;
  switch (ch) {
    case '#':
      return cell('wall', '001', parity === 0 ? 1 : 19);
    case '.': {
      const grassChunks = [27, 59, 138] as const;
      return cell('floor', '142', grassChunks[parity]);
    }
    case ',': {
      const stoneChunks = [25, 59, 96] as const;
      return cell('floor', '110', stoneChunks[parity]);
    }
    case 'T': {
      const treeChunks = [1, 10, 15] as const;
      return cell('trees', '142', treeChunks[parity]);
    }
    case '~':
      return cell('water', '142', 88);
    case 'M':
      return cell('mountain', '110', parity === 1 ? 36 : 1);
    case 'W':
      return cell('wonder_tile', '142', 59);
    case 'S':
      return cell('stairs', '110', 59);
    default:
      return cell('floor', '142', 59);
  }
}

export interface ManualEnemyBattleSpawn {
  id: string;
  x: number;
  y: number;
  speciesId: string;
  nickname: string;
  level: number;
  /** Manually tuned skirmish stat block (Rule 1: 100% human-editable manual balance) */
  stats: StatBlockSeven;
  moveIds?: string[];
  equippedMoveId?: string;
  heldItemId?: string | null;
}

export const DEFAULT_VANGUARD_ENEMY_SPAWNS: ReadonlyArray<ManualEnemyBattleSpawn> = [
  {
    id: 'enemy_0',
    x: 9,
    y: 5,
    speciesId: 'zigzagoon_galar',
    nickname: 'Outrider Scout',
    level: 1,
    stats: { hp: 14, atk: 5, def: 4, spa: 3, spd: 4, spe: 7, mov: 5 },
    moveIds: ['tackle'],
    equippedMoveId: 'tackle',
    heldItemId: null,
  },
  {
    id: 'enemy_1',
    x: 11,
    y: 3,
    speciesId: 'seedot',
    nickname: 'Briar Raider',
    level: 1,
    stats: { hp: 14, atk: 5, def: 5, spa: 4, spd: 5, spe: 5, mov: 5 },
    moveIds: ['tackle'],
    equippedMoveId: 'tackle',
    heldItemId: null,
  },
  {
    id: 'enemy_2',
    x: 12,
    y: 7,
    speciesId: 'gothita',
    nickname: 'Shadow Acolyte',
    level: 2,
    stats: { hp: 13, atk: 3, def: 4, spa: 6, spd: 6, spe: 5, mov: 5 },
    moveIds: ['confusion'],
    equippedMoveId: 'confusion',
    heldItemId: null,
  },
];

export interface ManualPlayerBattleSpawn {
  id: string;
  x: number;
  y: number;
  isLord: boolean;
  speciesId: string;
  lineId: string;
  nickname: string;
  level: number;
  moveIds: string[];
  equippedMoveId: string;
  heldItemId?: string | null;
}

export const DEFAULT_VANGUARD_PLAYER_SQUAD: ReadonlyArray<ManualPlayerBattleSpawn> = [
  {
    id: 'player_0',
    x: 3,
    y: 5,
    isLord: true,
    speciesId: 'dratini',
    lineId: 'dratini_line',
    nickname: 'Dratini',
    level: 1,
    moveIds: ['wrap', 'dragon_breath'],
    equippedMoveId: 'wrap',
    heldItemId: null,
  },
  {
    id: 'player_1',
    x: 3,
    y: 3,
    isLord: false,
    speciesId: 'bulbasaur',
    lineId: 'bulbasaur_line',
    nickname: 'Bulbasaur',
    level: 1,
    moveIds: ['tackle', 'razor_leaf'],
    equippedMoveId: 'tackle',
    heldItemId: null,
  },
  {
    id: 'player_2',
    x: 3,
    y: 7,
    isLord: false,
    speciesId: 'happiny',
    lineId: 'happiny_line',
    nickname: 'Happiny',
    level: 1,
    moveIds: ['soft_boiled', 'pound'],
    equippedMoveId: 'pound',
    heldItemId: null,
  },
];

export const EXTRA_PLAYER_DEPLOYMENT_COORDS: ReadonlyArray<{ x: number; y: number }> = [
  { x: 3, y: 5 },
  { x: 3, y: 3 },
  { x: 3, y: 7 },
  { x: 2, y: 4 },
  { x: 2, y: 6 },
  { x: 2, y: 8 },
];

export function createPlayableVanguardBattleMap(): DungeonMapDefinition {
  const height = PLAYABLE_ASCII_LAYOUT.length;
  const width = PLAYABLE_ASCII_LAYOUT[0]!.length;
  const tiles: DungeonMapTileCell[][] = [];

  for (let y = 0; y < height; y++) {
    const rowStr = PLAYABLE_ASCII_LAYOUT[y]!;
    const row: DungeonMapTileCell[] = [];
    for (let x = 0; x < width; x++) {
      row.push(battleTileFromAscii(rowStr[x] ?? '.', x, y));
    }
    tiles.push(row);
  }

  return {
    id: 'drenched_bluff_vanguard',
    name: 'Drenched Bluff — Vanguard Skirmish',
    bgmCue: 'drenched_bluff',
    width,
    height,
    tiles,
    playerSpawns: DEFAULT_VANGUARD_PLAYER_SQUAD.map((p) => ({
      x: p.x,
      y: p.y,
      speciesId: p.speciesId,
      level: p.level,
      nickname: p.nickname,
      heldItemId: p.heldItemId ?? null,
    })),
    enemySpawns: DEFAULT_VANGUARD_ENEMY_SPAWNS.map((e) => ({
      x: e.x,
      y: e.y,
      speciesId: e.speciesId,
      level: e.level,
      nickname: e.nickname,
      heldItemId: e.heldItemId ?? null,
    })),
  };
}

function buildMoveSlots(
  moveIds: ReadonlyArray<string>,
  bonusPpByMoveId?: Record<string, number>
): BattleMoveSlot[] {
  const slots: BattleMoveSlot[] = [];
  for (const moveId of moveIds.slice(0, 4)) {
    const mv = getMoveById(moveId);
    if (!mv) continue;
    const maxPp = mv.pp + (bonusPpByMoveId?.[mv.id] ?? 0);
    slots.push({
      id: mv.id,
      range: mv.range,
      targetType: mv.targetType,
      ppRemaining: maxPp,
      maxPp,
      move: mv,
    });
  }
  return slots;
}

function resolveDefaultEquippedMove(
  slots: ReadonlyArray<BattleMoveSlot>,
  preferredId: string | null | undefined
): string | null {
  if (preferredId) {
    const found = slots.find((s) => s.id === preferredId && isOffensiveMove(s.move));
    if (found) return found.id;
  }
  const firstOff = slots.find((s) => isOffensiveMove(s.move));
  return firstOff ? firstOff.id : null;
}

/**
 * Instantiates the full player + enemy `BattleUnitState[]` array for a dungeon run.
 * For the Drenched Bluff playable test dungeon (`drenched_bluff_vanguard`), deploys the curated
 * Stage-1 trio (`Dratini` with Wrap + Dragon Breath, `Bulbasaur` with Tackle + Razor Leaf, and
 * `Happiny` with Soft-Boiled + Pound), while preserving any custom nicknames from `SaveStateManager`.
 */
export function buildInitialBattleUnits(
  map: DungeonMapDefinition,
  save: SaveData | null,
  enemyOverrides: ReadonlyArray<ManualEnemyBattleSpawn> = DEFAULT_VANGUARD_ENEMY_SPAWNS
): BattleUnitState[] {
  const now = typeof performance !== 'undefined' ? performance.now() : 0;
  const units: BattleUnitState[] = [];

  if (map.id === 'drenched_bluff_vanguard') {
    DEFAULT_VANGUARD_PLAYER_SQUAD.forEach((preset, idx) => {
      const sp = getSpeciesById(preset.speciesId);
      if (!sp) return;

      // Preserve any custom player-chosen nickname from SaveStateManager without pulling Stage 2/3 evolutions
      let resolvedNickname = preset.nickname || sp.name;
      let bonusPp: Record<string, number> | undefined;
      let heldItemId: string | null = preset.heldItemId ?? null;
      let consumableItemId: string | null = null;

      if (save && save.roster.length > 0) {
        const matchedOwned =
          save.roster.find((o) => getSpeciesById(o.speciesId)?.lineId === preset.lineId) ??
          (preset.isLord ? save.roster.find((o) => o.isLord) : undefined);
        if (matchedOwned) {
          const ownedSp = getSpeciesById(matchedOwned.speciesId);
          if (matchedOwned.nickname && matchedOwned.nickname !== ownedSp?.name) {
            resolvedNickname = matchedOwned.nickname;
          }
          bonusPp = matchedOwned.bonusPpByMoveId;
          heldItemId = matchedOwned.heldItemId ?? heldItemId;
          consumableItemId = matchedOwned.consumableItemId ?? null;
        }
      }

      const coord = map.playerSpawns[idx] ?? { x: preset.x, y: preset.y };
      const moveSlots = buildMoveSlots(preset.moveIds, bonusPp);
      const equippedMoveId = resolveDefaultEquippedMove(moveSlots, preset.equippedMoveId);
      const stats: StatBlockSeven = { ...sp.baseStats };

      units.push({
        id: preset.id || `player_${idx}`,
        slotIndex: idx,
        faction: 'player',
        isLord: preset.isLord,
        speciesId: sp.id,
        speciesName: sp.name,
        nickname: resolvedNickname,
        level: preset.level,
        x: coord.x,
        y: coord.y,
        mov: stats.mov,
        maxHp: stats.hp,
        currentHp: stats.hp,
        stats,
        traversalClass: sp.traversalClass,
        types: sp.types,
        personalSkillId: sp.personalSkillId,
        heldItemId,
        consumableItemId,
        status: null,
        activeMoves: moveSlots,
        equippedMoveId,
        waited: false,
        defeated: false,
        direction: 2, // East
        action: 'Idle',
        frameIndex: 0,
        nextFrameAt: now + 140,
        renderWorldX: coord.x * PMD_TILE_NATIVE_PX,
        renderWorldY: coord.y * PMD_TILE_NATIVE_PX,
        hitFlashUntilMs: 0,
        koDissolveProgress: 0,
      });
    });
  } else if (save && save.roster.length > 0) {
    // Ensure Lord is deployed first at slot 0 `(3, 5)` followed by party members up to deployment cap
    const orderedRoster = [...save.roster].sort((a, b) => {
      if (a.isLord !== b.isLord) return a.isLord ? -1 : 1;
      return 0;
    });

    const maxDeploy = Math.min(orderedRoster.length, EXTRA_PLAYER_DEPLOYMENT_COORDS.length);
    for (let idx = 0; idx < maxDeploy; idx++) {
      const owned = orderedRoster[idx]!;
      const sp = getSpeciesById(owned.speciesId);
      if (!sp) continue;

      const coord = map.playerSpawns[idx] ?? EXTRA_PLAYER_DEPLOYMENT_COORDS[idx] ?? { x: 3, y: 5 };
      const moveSlots = buildMoveSlots(owned.activeMoveIds, owned.bonusPpByMoveId);
      const equippedMoveId = resolveDefaultEquippedMove(moveSlots, owned.equippedMoveId);
      const stats: StatBlockSeven = { ...owned.currentStats };

      units.push({
        id: `player_${idx}`,
        slotIndex: idx,
        faction: 'player',
        isLord: owned.isLord || idx === 0,
        speciesId: sp.id,
        speciesName: sp.name,
        nickname: owned.nickname || sp.name,
        level: owned.level,
        x: coord.x,
        y: coord.y,
        mov: stats.mov,
        maxHp: stats.hp,
        currentHp: stats.hp,
        stats,
        traversalClass: sp.traversalClass,
        types: sp.types,
        personalSkillId: sp.personalSkillId,
        heldItemId: owned.heldItemId,
        consumableItemId: owned.consumableItemId,
        status: null,
        activeMoves: moveSlots,
        equippedMoveId,
        waited: false,
        defeated: false,
        direction: 2, // East
        action: 'Idle',
        frameIndex: 0,
        nextFrameAt: now + 140,
        renderWorldX: coord.x * PMD_TILE_NATIVE_PX,
        renderWorldY: coord.y * PMD_TILE_NATIVE_PX,
        hitFlashUntilMs: 0,
        koDissolveProgress: 0,
      });
    }
  } else {
    map.playerSpawns.forEach((spawn, idx) => {
      const sp = getSpeciesById(spawn.speciesId);
      if (!sp) return;
      const learnedIds = sp.learnset
        .filter((l) => l.level <= Math.max(spawn.level, sp.defaultJoinLevel))
        .map((l) => l.moveId);
      if (learnedIds.length === 0 && sp.learnset[0]) {
        learnedIds.push(sp.learnset[0].moveId);
      }
      const moveSlots = buildMoveSlots(learnedIds.slice(-4));
      const equippedMoveId = resolveDefaultEquippedMove(moveSlots, null);
      const stats: StatBlockSeven = { ...sp.baseStats };

      units.push({
        id: `player_${idx}`,
        slotIndex: idx,
        faction: 'player',
        isLord: idx === 0,
        speciesId: sp.id,
        speciesName: sp.name,
        nickname: spawn.nickname ?? sp.name,
        level: spawn.level,
        x: spawn.x,
        y: spawn.y,
        mov: stats.mov,
        maxHp: stats.hp,
        currentHp: stats.hp,
        stats,
        traversalClass: sp.traversalClass,
        types: sp.types,
        personalSkillId: sp.personalSkillId,
        heldItemId: spawn.heldItemId ?? null,
        consumableItemId: null,
        status: null,
        activeMoves: moveSlots,
        equippedMoveId,
        waited: false,
        defeated: false,
        direction: 2, // East
        action: 'Idle',
        frameIndex: 0,
        nextFrameAt: now + 140,
        renderWorldX: spawn.x * PMD_TILE_NATIVE_PX,
        renderWorldY: spawn.y * PMD_TILE_NATIVE_PX,
        hitFlashUntilMs: 0,
        koDissolveProgress: 0,
      });
    });
  }

  enemyOverrides.forEach((eSpawn, idx) => {
    const sp = getSpeciesById(eSpawn.speciesId);
    if (!sp) return;
    const rawMoveIds =
      eSpawn.moveIds && eSpawn.moveIds.length > 0
        ? eSpawn.moveIds
        : sp.learnset
            .filter((l) => l.level <= Math.max(eSpawn.level, sp.defaultJoinLevel))
            .map((l) => l.moveId)
            .slice(-4);
    const moveSlots = buildMoveSlots(rawMoveIds);
    const equippedMoveId = resolveDefaultEquippedMove(moveSlots, eSpawn.equippedMoveId);
    const stats: StatBlockSeven = { ...eSpawn.stats };

    units.push({
      id: eSpawn.id || `enemy_${idx}`,
      slotIndex: idx,
      faction: 'enemy',
      isLord: false,
      speciesId: sp.id,
      speciesName: sp.name,
      nickname: eSpawn.nickname || sp.name,
      level: eSpawn.level,
      x: eSpawn.x,
      y: eSpawn.y,
      mov: stats.mov,
      maxHp: stats.hp,
      currentHp: stats.hp,
      stats,
      traversalClass: sp.traversalClass,
      types: sp.types,
      personalSkillId: sp.personalSkillId,
      heldItemId: eSpawn.heldItemId ?? null,
      consumableItemId: null,
      status: null,
      activeMoves: moveSlots,
      equippedMoveId,
      waited: false,
      defeated: false,
      direction: 6, // West
      action: 'Idle',
      frameIndex: 0,
      nextFrameAt: now + 140,
      renderWorldX: eSpawn.x * PMD_TILE_NATIVE_PX,
      renderWorldY: eSpawn.y * PMD_TILE_NATIVE_PX,
      hitFlashUntilMs: 0,
      koDissolveProgress: 0,
    });
  });

  return units;
}
