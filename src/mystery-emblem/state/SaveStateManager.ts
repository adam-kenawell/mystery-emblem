import {
  getAllCustomMapOverrides,
  getCustomMapsSyncEnvelope,
  hasAnyCustomMapSyncState,
  mergeCustomMapsRecord,
  reconcileCustomMapsEnvelope,
  type CustomMapsSyncEnvelope,
} from '../data/chapterMapRegistry';
import { ITEM_MAP, MOVE_MAP, SPECIES_MAP } from '../data/index';
import {
  DEFAULT_OVERWORLD_GRAPH,
  getOverworldNodeById,
  type OverworldGraphDefinition,
} from '../data/overworldMapData';
import {
  buildKecleonShopState,
  buildSkirmishSpawnState,
  createPrologueOverworldNodes,
  createSandboxOverworldNodes,
  createUnlockedAllOverworldNodes,
  ensureOverworldGraphState,
  rollPostBattleOverworldSpawns,
  type PostBattleSpawnResult,
} from '../engine/overworldEngine';
import {
  CURRENT_SAVE_SCHEMA_VERSION,
  type EvolutionBranch,
  type ItemDefinition,
  type KecleonShopType,
  type OwnedPokemonInstance,
  type PokemonSpeciesDefinition,
  type QuizRecruitSeeds,
  type SaveData,
  type SupportLevel,
  type SupportPairProgress,
} from '../types/schemas';
import { validateSaveData } from '../types/validators';
import {
  FirestoreSyncAdapter,
  extractCloudPayloadParts,
  type CloudSyncAdapter,
  type CloudUser,
} from './firebaseSync';

export const SAVE_STORAGE_KEY = 'mystery_emblem_save_v1';
const LEGACY_SAVE_STORAGE_KEY = 'poke_emblem_save_v1';
export const META_STORAGE_KEY = 'mystery_emblem_meta_v1';

export const SUPPORT_LEVEL_THRESHOLDS: readonly [number, number, number, number, number] = [
  5, 12, 22, 35, 50,
];

export type CloudSyncResolution =
  | 'unauthenticated'
  | 'empty'
  | 'already_in_sync'
  | 'pulled_newer_cloud'
  | 'pushed_newer_local'
  | 'cloud_error';

export interface SyncStatusSnapshot {
  isFirebaseConfigured: boolean;
  user: CloudUser | null;
  lastResolution: CloudSyncResolution | null;
  lastSyncedAt: number | null;
  errorMessage: string | null;
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

function getDefaultStorage(): StorageLike {
  if (typeof window !== 'undefined' && window.localStorage) {
    return window.localStorage;
  }
  const map = new Map<string, string>();
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => {
      map.set(k, v);
    },
    removeItem: (k) => {
      map.delete(k);
    },
  };
}

function generateId(prefix: string): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}

export function formatCampaignChapterLabel(chapterId: string | null | undefined): string {
  const raw = (chapterId ?? '').trim();
  if (!raw) return 'Prologue';
  const lower = raw.toLowerCase();
  if (lower === 'prologue') return 'Prologue';
  if (lower === 'epilogue') return 'Epilogue';
  if (lower === 'endgame') return 'Endgame';

  const chMatch = /^(?:chapter|ch)[_\-\s]*(\d+)$/i.exec(raw);
  if (chMatch) {
    return `Chapter ${Number(chMatch[1])}`;
  }
  if (/^\d+$/.test(raw)) {
    return `Chapter ${Number(raw)}`;
  }
  const paraMatch = /^(?:paralogue|para|par)[_\-\s]*(\d+)$/i.exec(raw);
  if (paraMatch) {
    return `Paralogue ${Number(paraMatch[1])}`;
  }

  return raw
    .split(/[_\-\s]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

export function makeSupportPairKey(instanceIdA: string, instanceIdB: string): string {
  if (instanceIdA === instanceIdB) {
    throw new Error('Cannot compute Support pair key between a unit and itself.');
  }
  return instanceIdA < instanceIdB
    ? `${instanceIdA}::${instanceIdB}`
    : `${instanceIdB}::${instanceIdA}`;
}

export function computeSupportLevel(points: number): SupportLevel {
  if (points >= SUPPORT_LEVEL_THRESHOLDS[4]) return 5;
  if (points >= SUPPORT_LEVEL_THRESHOLDS[3]) return 4;
  if (points >= SUPPORT_LEVEL_THRESHOLDS[2]) return 3;
  if (points >= SUPPORT_LEVEL_THRESHOLDS[1]) return 2;
  if (points >= SUPPORT_LEVEL_THRESHOLDS[0]) return 1;
  return 0;
}

export function sanitizeNickname(rawNickname: string | undefined, fallbackSpeciesName: string): string {
  const trimmed = (rawNickname ?? '').trim().slice(0, 16);
  return trimmed.length > 0 ? trimmed : fallbackSpeciesName;
}

/**
 * Returns the single item equipped on a unit (either a Held Gear/Berry in `heldItemId`
 * or an Active Healing/Promotion/X-Item in `consumableItemId`), or `null` if empty.
 */
export function getUnitEquippedItemId(
  unit: Pick<OwnedPokemonInstance, 'heldItemId' | 'consumableItemId'>
): string | null {
  return unit.heldItemId ?? unit.consumableItemId ?? null;
}

function returnItemToConvoyList(convoy: Array<{ itemId: string; quantity: number }>, itemId: string): void {
  if (!ITEM_MAP.has(itemId)) return;
  const existing = convoy.find((c) => c.itemId === itemId);
  if (existing) {
    existing.quantity += 1;
  } else {
    convoy.push({ itemId, quantity: 1 });
  }
}

/**
 * Sanitizes legacy saves that had both `heldItemId` and `consumableItemId` populated by
 * returning `consumableItemId` to the Convoy so every unit strictly obeys the 1-item-slot rule.
 */
function normalizeLegacySingleItemSlots(candidate: unknown): unknown {
  if (!candidate || typeof candidate !== 'object') return candidate;
  const obj = candidate as Partial<SaveData>;
  if (!Array.isArray(obj.roster) || !Array.isArray(obj.convoy)) return candidate;

  let mutated = false;
  for (const unit of obj.roster) {
    if (unit && unit.heldItemId !== null && unit.consumableItemId !== null) {
      mutated = true;
      break;
    }
  }
  if (!mutated) return candidate;

  const cloned = JSON.parse(JSON.stringify(obj)) as SaveData;
  for (const unit of cloned.roster) {
    if (unit.heldItemId !== null && unit.consumableItemId !== null) {
      returnItemToConvoyList(cloned.convoy, unit.consumableItemId);
      unit.consumableItemId = null;
    }
  }
  return cloned;
}

function findForwardEvolutionPath(
  fromSp: PokemonSpeciesDefinition,
  targetSpeciesId: string,
  visited = new Set<string>()
): EvolutionBranch[] | null {
  if (visited.has(fromSp.id)) return null;
  visited.add(fromSp.id);
  for (const branch of fromSp.evolutions) {
    if (branch.targetSpeciesId === targetSpeciesId) {
      return [branch];
    }
    const nextSp = SPECIES_MAP.get(branch.targetSpeciesId);
    if (nextSp) {
      const rest = findForwardEvolutionPath(nextSp, targetSpeciesId, new Set(visited));
      if (rest) {
        return [branch, ...rest];
      }
    }
  }
  return null;
}

export interface CreatePokemonOptions {
  speciesId: string;
  nickname?: string;
  level?: number;
  isLord?: boolean;
  heldItemId?: string | null;
  consumableItemId?: string | null;
}

export function createPokemonInstance(opts: CreatePokemonOptions): OwnedPokemonInstance {
  const sp = SPECIES_MAP.get(opts.speciesId);
  if (!sp) {
    throw new Error(`Unknown Pokémon speciesId "${opts.speciesId}".`);
  }
  if (sp.faction === 'enemy') {
    throw new Error(
      `Rule 5 violation: Enemy-only Pokémon "${sp.name}" cannot be instantiated for the player roster.`
    );
  }

  const level = Math.max(1, Math.min(40, Math.floor(opts.level ?? sp.defaultJoinLevel)));
  const unlockedMoveIds: string[] = [];
  for (const entry of sp.learnset) {
    if (entry.level <= level && !unlockedMoveIds.includes(entry.moveId)) {
      unlockedMoveIds.push(entry.moveId);
    }
  }
  if (unlockedMoveIds.length === 0 && sp.learnset[0]) {
    unlockedMoveIds.push(sp.learnset[0].moveId);
  }

  // Equip up to the 4 most recent unlocked moves
  const activeMoveIds = unlockedMoveIds.slice(-4);

  // Rule 4: Single [E] Equipped offensive move for Enemy Phase counter-attacks
  let equippedMoveId: string | null = null;
  for (const mId of activeMoveIds) {
    const mv = MOVE_MAP.get(mId);
    if (mv && (mv.category === 'Physical' || mv.category === 'Special')) {
      equippedMoveId = mId;
      break;
    }
  }

  if (opts.heldItemId && opts.consumableItemId) {
    throw new Error(
      `Unit "${sp.name}" cannot start with both heldItemId ("${opts.heldItemId}") and consumableItemId ("${opts.consumableItemId}") — each unit has 1 item slot.`
    );
  }

  return {
    instanceId: generateId('unit'),
    speciesId: sp.id,
    nickname: sanitizeNickname(opts.nickname, sp.name),
    isLord: Boolean(opts.isLord),
    level,
    exp: 0,
    currentStats: { ...sp.baseStats },
    bonusPpByMoveId: {},
    unlockedMoveIds,
    activeMoveIds,
    equippedMoveId,
    heldItemId: opts.heldItemId ?? null,
    consumableItemId: opts.consumableItemId ?? null,
  };
}

export const DEFAULT_QUIZ_SEEDS: QuizRecruitSeeds = {
  q1Healer: ['happiny'],
  q2BugFlying: ['caterpie', 'pidgey'],
  q3GhostPsychic: ['duskull', 'ralts'],
  q4Electric: ['shinx'],
  q5FrontlineTrio: ['machop', 'geodude', 'trapinch'],
  q6WaterGrass: ['poliwag', 'bellsprout'],
  q7Fire: ['litwick'],
  q8SteelFairy: ['tinkatink', 'cleffa'],
  q9IceArmored: ['mime_jr_galar', 'beldum'],
};

export interface NewCampaignConfig {
  lordSpeciesId: string;
  lordNickname?: string;
  partnerSpeciesId: string;
  partnerNickname?: string;
  healerSpeciesId: string;
  healerNickname?: string;
  quizSeeds?: QuizRecruitSeeds;
  startingGold?: number;
  currentChapterId?: string;
}

export class SaveStateManager {
  private readonly storage: StorageLike;
  private readonly isBrowserPrimaryStorage: boolean;
  private readonly cloud: CloudSyncAdapter;
  private currentSave: SaveData | null = null;
  private syncStatus: SyncStatusSnapshot;
  private readonly changeListeners = new Set<(save: SaveData | null, status: SyncStatusSnapshot) => void>();
  private unsubscribeAuth: (() => void) | null = null;
  private inFlightReconcile: Promise<CloudSyncResolution> | null = null;

  constructor(storage?: StorageLike, cloudAdapter?: CloudSyncAdapter) {
    this.storage = storage ?? getDefaultStorage();
    this.isBrowserPrimaryStorage =
      typeof window !== 'undefined' &&
      Boolean(window.localStorage) &&
      this.storage === window.localStorage;
    this.cloud = cloudAdapter ?? new FirestoreSyncAdapter();
    this.currentSave = this.readValidLocalSave();
    if (this.isBrowserPrimaryStorage && this.currentSave?.customMaps) {
      mergeCustomMapsRecord(this.currentSave.customMaps);
    }
    this.syncStatus = {
      isFirebaseConfigured: this.cloud.isConfigured,
      user: this.cloud.getCurrentUser(),
      lastResolution: null,
      lastSyncedAt: null,
      errorMessage: null,
    };

    this.unsubscribeAuth = this.cloud.onAuthStateChanged((user) => {
      this.syncStatus = { ...this.syncStatus, user };
      if (user) {
        void this.reconcileWithCloud();
      } else {
        this.emitChange();
      }
    });
  }

  public dispose(): void {
    if (this.unsubscribeAuth) {
      this.unsubscribeAuth();
      this.unsubscribeAuth = null;
    }
    this.changeListeners.clear();
  }

  public subscribe(listener: (save: SaveData | null, status: SyncStatusSnapshot) => void): () => void {
    this.changeListeners.add(listener);
    listener(this.getSave(), this.getSyncStatus());
    return () => {
      this.changeListeners.delete(listener);
    };
  }

  public getSave(): SaveData | null {
    return this.currentSave ? (JSON.parse(JSON.stringify(this.currentSave)) as SaveData) : null;
  }

  public getSyncStatus(): SyncStatusSnapshot {
    return { ...this.syncStatus };
  }

  public isNewGamePlusUnlocked(): boolean {
    if (this.currentSave?.newGamePlusUnlocked) return true;
    try {
      const rawMeta = this.storage.getItem(META_STORAGE_KEY);
      if (!rawMeta) return false;
      const parsed = JSON.parse(rawMeta) as { newGamePlusUnlocked?: boolean };
      return Boolean(parsed.newGamePlusUnlocked);
    } catch {
      return false;
    }
  }

  public setNewGamePlusUnlocked(unlocked: boolean): void {
    this.storage.setItem(META_STORAGE_KEY, JSON.stringify({ newGamePlusUnlocked: unlocked }));
    if (this.currentSave) {
      this.currentSave.newGamePlusUnlocked = unlocked;
      this.commitSave(this.currentSave);
    } else {
      this.emitChange();
    }
  }

  public createNewCampaignSave(cfg: NewCampaignConfig): SaveData {
    const lord = createPokemonInstance({
      speciesId: cfg.lordSpeciesId,
      nickname: cfg.lordNickname,
      level: 1,
      isLord: true,
      consumableItemId: 'potion',
    });
    const partner = createPokemonInstance({
      speciesId: cfg.partnerSpeciesId,
      nickname: cfg.partnerNickname,
      level: 1,
      heldItemId: 'oran_berry',
    });
    const healer = createPokemonInstance({
      speciesId: cfg.healerSpeciesId,
      nickname: cfg.healerNickname,
      level: 1,
    });

    const seeds: QuizRecruitSeeds = cfg.quizSeeds
      ? JSON.parse(JSON.stringify(cfg.quizSeeds))
      : {
          ...DEFAULT_QUIZ_SEEDS,
          q1Healer: [cfg.healerSpeciesId],
        };

    const initialChapterId = cfg.currentChapterId?.trim() || 'prologue';

    const save: SaveData = {
      schemaVersion: CURRENT_SAVE_SCHEMA_VERSION,
      saveId: generateId('campaign'),
      lastUpdated: Date.now(),
      newGamePlusUnlocked: this.isNewGamePlusUnlocked(),
      gold: cfg.startingGold ?? 1500,
      campaign: {
        currentChapterId: initialChapterId,
        lordInstanceId: lord.instanceId,
        partnerInstanceId: partner.instanceId,
        quizSeeds: seeds,
        kecleonShopsUnlocked: false,
        completedChapterIds: [],
      },
      roster: [lord, partner, healer],
      convoy: [
        { itemId: 'potion', quantity: 3 },
        { itemId: 'full_heal', quantity: 1 },
        { itemId: 'oran_berry', quantity: 2 },
        { itemId: 'muscle_band', quantity: 1 },
        { itemId: 'x_attack', quantity: 1 },
      ],
      supports: {},
      overworld: {
        currentNodeId: initialChapterId,
        nodes: {
          [initialChapterId]: {
            nodeId: initialChapterId,
            unlocked: true,
            cleared: false,
            activeSkirmish: null,
            activeKecleonShop: null,
          },
        },
      },
    };

    this.commitSave(save);
    return this.getSave()!;
  }

  public setCurrentChapter(chapterId: string): SaveData {
    const save = this.requireActiveSave();
    const trimmed = chapterId.trim();
    if (!trimmed) {
      throw new Error('chapterId must be a non-empty string.');
    }
    save.campaign.currentChapterId = trimmed;
    this.commitSave(save);
    return this.getSave()!;
  }

  public renamePokemon(instanceId: string, newNickname: string): OwnedPokemonInstance {
    const save = this.requireActiveSave();
    const unit = save.roster.find((u) => u.instanceId === instanceId);
    if (!unit) {
      throw new Error(`Pokémon instance "${instanceId}" not found in roster.`);
    }
    const sp = SPECIES_MAP.get(unit.speciesId);
    unit.nickname = sanitizeNickname(newNickname, sp?.name ?? unit.speciesId);
    this.commitSave(save);
    return JSON.parse(JSON.stringify(unit)) as OwnedPokemonInstance;
  }

  /**
   * Transitions an owned Pokémon within its evolutionary line (e.g., Stage 1 -> 2 -> 3 or Eevee branching).
   * Applies manual `promotionBonuses` when advancing along an evolution branch, preserves custom nicknames
   * and continuous level, and triggers immediate UI + cloud save updates.
   */
  public evolveUnitToSpecies(instanceId: string, targetSpeciesId: string): OwnedPokemonInstance {
    const save = this.requireActiveSave();
    const unit = save.roster.find((u) => u.instanceId === instanceId);
    if (!unit) {
      throw new Error(`Pokémon instance "${instanceId}" not found in roster.`);
    }
    const currentSp = SPECIES_MAP.get(unit.speciesId);
    const targetSp = SPECIES_MAP.get(targetSpeciesId);
    if (!currentSp || !targetSp) {
      throw new Error(`Unknown species transition "${unit.speciesId}" -> "${targetSpeciesId}".`);
    }
    if (targetSp.faction === 'enemy') {
      throw new Error(`Rule 5 violation: Cannot evolve player unit into enemy-only species "${targetSp.name}".`);
    }
    if (currentSp.lineId !== targetSp.lineId) {
      throw new Error(
        `Invalid evolution line mismatch: "${currentSp.id}" (${currentSp.lineId}) cannot become "${targetSp.id}" (${targetSp.lineId}).`
      );
    }
    if (unit.speciesId === targetSp.id) {
      return JSON.parse(JSON.stringify(unit)) as OwnedPokemonInstance;
    }

    const forwardPath = findForwardEvolutionPath(currentSp, targetSp.id);
    if (forwardPath && forwardPath.length > 0) {
      for (const branch of forwardPath) {
        unit.currentStats.hp += branch.promotionBonuses.hp;
        unit.currentStats.atk += branch.promotionBonuses.atk;
        unit.currentStats.def += branch.promotionBonuses.def;
        unit.currentStats.spa += branch.promotionBonuses.spa;
        unit.currentStats.spd += branch.promotionBonuses.spd;
        unit.currentStats.spe += branch.promotionBonuses.spe;
      }
      unit.currentStats.mov = targetSp.baseStats.mov;
    } else {
      // Sideways branch preview (e.g., Vaporeon -> Sylveon) or Dev Tools stage reset (Stage 3 -> Stage 1)
      unit.currentStats = { ...targetSp.baseStats };
    }

    // Preserve custom nicknames across evolutions; only update if still using the uncustomized species name
    if (unit.nickname === currentSp.name) {
      unit.nickname = targetSp.name;
    }

    unit.speciesId = targetSp.id;

    for (const entry of targetSp.learnset) {
      if (entry.level <= unit.level && !unit.unlockedMoveIds.includes(entry.moveId)) {
        unit.unlockedMoveIds.push(entry.moveId);
        if (unit.activeMoveIds.length < 4) {
          unit.activeMoveIds.push(entry.moveId);
        }
      }
    }
    if (!unit.equippedMoveId) {
      const firstOffensive = unit.activeMoveIds.find((mId) => {
        const mv = MOVE_MAP.get(mId);
        return mv && (mv.category === 'Physical' || mv.category === 'Special');
      });
      unit.equippedMoveId = firstOffensive ?? null;
    }

    this.commitSave(save);
    return JSON.parse(JSON.stringify(unit)) as OwnedPokemonInstance;
  }

  public setEquippedMove(instanceId: string, moveId: string | null): OwnedPokemonInstance {
    const save = this.requireActiveSave();
    const unit = save.roster.find((u) => u.instanceId === instanceId);
    if (!unit) {
      throw new Error(`Pokémon instance "${instanceId}" not found in roster.`);
    }
    if (moveId !== null) {
      if (!unit.activeMoveIds.includes(moveId)) {
        throw new Error(`Move "${moveId}" is not in unit's 4-move active loadout.`);
      }
      const mv = MOVE_MAP.get(moveId);
      if (!mv || (mv.category !== 'Physical' && mv.category !== 'Special')) {
        throw new Error('Only offensive (Physical or Special) moves can be marked [E] Equipped.');
      }
    }
    unit.equippedMoveId = moveId;
    this.commitSave(save);
    return JSON.parse(JSON.stringify(unit)) as OwnedPokemonInstance;
  }

  public setActiveMoves(instanceId: string, moveIds: string[]): OwnedPokemonInstance {
    const save = this.requireActiveSave();
    const unit = save.roster.find((u) => u.instanceId === instanceId);
    if (!unit) {
      throw new Error(`Pokémon instance "${instanceId}" not found in roster.`);
    }
    const uniqueMoves = [...new Set(moveIds)];
    if (uniqueMoves.length === 0 || uniqueMoves.length > 4) {
      throw new Error('Active loadout must contain between 1 and 4 moves.');
    }
    for (const mId of uniqueMoves) {
      if (!unit.unlockedMoveIds.includes(mId)) {
        throw new Error(`Move "${mId}" has not been unlocked by ${unit.nickname}.`);
      }
    }
    unit.activeMoveIds = uniqueMoves;
    if (unit.equippedMoveId && !uniqueMoves.includes(unit.equippedMoveId)) {
      const fallback = uniqueMoves.find((mId) => {
        const mv = MOVE_MAP.get(mId);
        return mv && (mv.category === 'Physical' || mv.category === 'Special');
      });
      unit.equippedMoveId = fallback ?? null;
    }
    this.commitSave(save);
    return JSON.parse(JSON.stringify(unit)) as OwnedPokemonInstance;
  }

  public addConvoyItem(itemId: string, quantity = 1): void {
    if (!ITEM_MAP.has(itemId) || quantity < 1) {
      throw new Error(`Invalid item "${itemId}" or quantity ${quantity}.`);
    }
    const save = this.requireActiveSave();
    const existing = save.convoy.find((c) => c.itemId === itemId);
    if (existing) {
      existing.quantity += quantity;
    } else {
      save.convoy.push({ itemId, quantity });
    }
    this.commitSave(save);
  }

  public recruitPokemon(opts: CreatePokemonOptions): OwnedPokemonInstance {
    const save = this.requireActiveSave();
    const created = createPokemonInstance({ ...opts, isLord: false });
    save.roster.push(created);
    this.commitSave(save);
    return JSON.parse(JSON.stringify(created)) as OwnedPokemonInstance;
  }

  public unlockUnitMove(
    instanceId: string,
    moveId: string,
    autoEquipIfRoom = false
  ): OwnedPokemonInstance {
    const save = this.requireActiveSave();
    const unit = save.roster.find((u) => u.instanceId === instanceId);
    if (!unit) {
      throw new Error(`Pokémon instance "${instanceId}" not found in roster.`);
    }
    const mv = MOVE_MAP.get(moveId);
    if (!mv) {
      throw new Error(`Unknown moveId "${moveId}".`);
    }
    if (!unit.unlockedMoveIds.includes(moveId)) {
      unit.unlockedMoveIds.push(moveId);
    }
    if (autoEquipIfRoom && unit.activeMoveIds.length < 4 && !unit.activeMoveIds.includes(moveId)) {
      unit.activeMoveIds.push(moveId);
      if (!unit.equippedMoveId && (mv.category === 'Physical' || mv.category === 'Special')) {
        unit.equippedMoveId = moveId;
      }
    }
    this.commitSave(save);
    return JSON.parse(JSON.stringify(unit)) as OwnedPokemonInstance;
  }

  /**
   * Equips or unequips a single item (`itemId | null`) on `instanceId`, enforcing the 1-item-slot
   * rule across Held Gear, Berries, Healing Consumables, Promotion Stones/Gems, and X-Items.
   * - Any previously equipped item on `instanceId` is automatically returned to `save.convoy`.
   * - When `sourceUnitInstanceId` is provided, transfers the item directly from that roster unit;
   *   otherwise consumes `1` from `save.convoy`.
   */
  public equipItemToUnit(
    instanceId: string,
    itemId: string | null,
    sourceUnitInstanceId?: string
  ): OwnedPokemonInstance {
    const save = this.requireActiveSave();
    const targetUnit = save.roster.find((u) => u.instanceId === instanceId);
    if (!targetUnit) {
      throw new Error(`Pokémon instance "${instanceId}" not found in roster.`);
    }

    const prevItemId = getUnitEquippedItemId(targetUnit);

    if (itemId === null) {
      if (prevItemId !== null) {
        returnItemToConvoyList(save.convoy, prevItemId);
        targetUnit.heldItemId = null;
        targetUnit.consumableItemId = null;
        this.commitSave(save);
      }
      return JSON.parse(JSON.stringify(targetUnit)) as OwnedPokemonInstance;
    }

    const item = ITEM_MAP.get(itemId);
    if (!item) {
      throw new Error(`Unknown item "${itemId}".`);
    }
    if (item.equipSlot !== 'held' && item.equipSlot !== 'consumable') {
      throw new Error(`${item.name} cannot be equipped into a unit's battle item slot.`);
    }

    if (prevItemId === itemId && (!sourceUnitInstanceId || sourceUnitInstanceId === instanceId)) {
      return JSON.parse(JSON.stringify(targetUnit)) as OwnedPokemonInstance;
    }

    if (sourceUnitInstanceId && sourceUnitInstanceId !== instanceId) {
      const sourceUnit = save.roster.find((u) => u.instanceId === sourceUnitInstanceId);
      if (!sourceUnit || getUnitEquippedItemId(sourceUnit) !== itemId) {
        throw new Error(`Source unit does not currently hold ${item.name}.`);
      }
      sourceUnit.heldItemId = null;
      sourceUnit.consumableItemId = null;
      if (prevItemId !== null) {
        returnItemToConvoyList(save.convoy, prevItemId);
      }
    } else {
      const convoySlot = save.convoy.find((c) => c.itemId === itemId);
      if (!convoySlot || convoySlot.quantity < 1) {
        throw new Error(`${item.name} is not available in the Bag.`);
      }
      convoySlot.quantity -= 1;
      if (convoySlot.quantity <= 0) {
        save.convoy = save.convoy.filter((c) => c.itemId !== itemId);
      }
      if (prevItemId !== null) {
        returnItemToConvoyList(save.convoy, prevItemId);
      }
    }

    if (item.equipSlot === 'held') {
      targetUnit.heldItemId = item.id;
      targetUnit.consumableItemId = null;
    } else {
      targetUnit.consumableItemId = item.id;
      targetUnit.heldItemId = null;
    }

    this.commitSave(save);
    return JSON.parse(JSON.stringify(targetUnit)) as OwnedPokemonInstance;
  }

  public useVitaminOnUnit(
    instanceId: string,
    vitaminItemId: string,
    targetMoveId?: string
  ): OwnedPokemonInstance {
    const save = this.requireActiveSave();
    const unit = save.roster.find((u) => u.instanceId === instanceId);
    if (!unit) {
      throw new Error(`Pokémon instance "${instanceId}" not found in roster.`);
    }
    const item = ITEM_MAP.get(vitaminItemId);
    if (!item || item.category !== 'vitamin') {
      throw new Error(`"${vitaminItemId}" is not a valid Vitamin.`);
    }
    const convoySlot = save.convoy.find((c) => c.itemId === vitaminItemId);
    if (!convoySlot || convoySlot.quantity < 1) {
      throw new Error(`${item.name} is not in the Bag.`);
    }

    if (item.effect.permanentPpBoost) {
      const moveId = targetMoveId ?? unit.activeMoveIds[0];
      if (!moveId || !unit.unlockedMoveIds.includes(moveId)) {
        throw new Error(`Select a known move to apply ${item.name}.`);
      }
      unit.bonusPpByMoveId[moveId] =
        (unit.bonusPpByMoveId[moveId] ?? 0) + item.effect.permanentPpBoost;
    } else if (item.effect.permanentStatBoost) {
      const b = item.effect.permanentStatBoost;
      if (b.hp) unit.currentStats.hp += b.hp;
      if (b.atk) unit.currentStats.atk += b.atk;
      if (b.def) unit.currentStats.def += b.def;
      if (b.spa) unit.currentStats.spa += b.spa;
      if (b.spd) unit.currentStats.spd += b.spd;
      if (b.spe) unit.currentStats.spe += b.spe;
    }

    convoySlot.quantity -= 1;
    if (convoySlot.quantity <= 0) {
      save.convoy = save.convoy.filter((c) => c.itemId !== vitaminItemId);
    }

    this.commitSave(save);
    return JSON.parse(JSON.stringify(unit)) as OwnedPokemonInstance;
  }

  public teachTmMove(instanceId: string, tmItemId: string): OwnedPokemonInstance {
    const save = this.requireActiveSave();
    const unit = save.roster.find((u) => u.instanceId === instanceId);
    if (!unit) throw new Error(`Pokémon instance "${instanceId}" not found.`);

    const tmItem = ITEM_MAP.get(tmItemId);
    if (!tmItem || tmItem.category !== 'tm' || !tmItem.effect.teachesMoveId) {
      throw new Error(`"${tmItemId}" is not a valid Technical Machine.`);
    }

    const sp = SPECIES_MAP.get(unit.speciesId);
    if (!sp || !sp.compatibleTmIds.includes(tmItemId)) {
      throw new Error(`${unit.nickname} (${sp?.name ?? unit.speciesId}) is not compatible with ${tmItem.name}.`);
    }

    const moveId = tmItem.effect.teachesMoveId;
    if (unit.unlockedMoveIds.includes(moveId)) {
      throw new Error(`${unit.nickname} already knows that move.`);
    }

    const convoySlot = save.convoy.find((c) => c.itemId === tmItemId);
    if (!convoySlot || convoySlot.quantity < 1) {
      throw new Error(`${tmItem.name} is not in the Convoy.`);
    }

    // Consume single-use TM
    convoySlot.quantity -= 1;
    if (convoySlot.quantity <= 0) {
      save.convoy = save.convoy.filter((c) => c.itemId !== tmItemId);
    }

    unit.unlockedMoveIds.push(moveId);
    if (unit.activeMoveIds.length < 4) {
      unit.activeMoveIds.push(moveId);
      if (!unit.equippedMoveId) {
        const mv = MOVE_MAP.get(moveId);
        if (mv && (mv.category === 'Physical' || mv.category === 'Special')) {
          unit.equippedMoveId = moveId;
        }
      }
    }

    this.commitSave(save);
    return JSON.parse(JSON.stringify(unit)) as OwnedPokemonInstance;
  }

  public addSupportPoints(instanceIdA: string, instanceIdB: string, delta = 1): SupportPairProgress {
    const save = this.requireActiveSave();
    const pairKey = makeSupportPairKey(instanceIdA, instanceIdB);
    const prev = save.supports[pairKey]?.points ?? 0;
    const points = Math.max(0, prev + delta);
    const progress: SupportPairProgress = {
      points,
      level: computeSupportLevel(points),
    };
    save.supports[pairKey] = progress;
    this.commitSave(save);
    return { ...progress };
  }

  // ==========================================================================
  // Step 4 Overworld Traversal, Kecleon Shops, Skirmish Spawners & Promotions
  // ==========================================================================

  public addGold(amount: number): SaveData {
    const save = this.requireActiveSave();
    save.gold = Math.max(0, Math.floor(save.gold + amount));
    this.commitSave(save);
    return this.getSave()!;
  }

  public setUnitLevelForTest(instanceId: string, level: number): OwnedPokemonInstance {
    const save = this.requireActiveSave();
    const unit = save.roster.find((u) => u.instanceId === instanceId);
    if (!unit) {
      throw new Error(`Pokémon instance "${instanceId}" not found in roster.`);
    }
    const clamped = Math.max(1, Math.min(40, Math.floor(level)));
    unit.level = clamped;
    const sp = SPECIES_MAP.get(unit.speciesId);
    if (sp) {
      for (const entry of sp.learnset) {
        if (entry.level <= clamped && !unit.unlockedMoveIds.includes(entry.moveId)) {
          unit.unlockedMoveIds.push(entry.moveId);
          if (unit.activeMoveIds.length < 4) {
            unit.activeMoveIds.push(entry.moveId);
          }
        }
      }
    }
    this.commitSave(save);
    return JSON.parse(JSON.stringify(unit)) as OwnedPokemonInstance;
  }

  public useEvolutionItemOnUnit(
    instanceId: string,
    itemId: 'evolution_stone' | 'evolution_gem',
    targetSpeciesId?: string
  ): OwnedPokemonInstance {
    const save = this.requireActiveSave();
    const unit = save.roster.find((u) => u.instanceId === instanceId);
    if (!unit) {
      throw new Error(`Pokémon instance "${instanceId}" not found in roster.`);
    }
    const currentSp = SPECIES_MAP.get(unit.speciesId);
    if (!currentSp) {
      throw new Error(`Unknown species "${unit.speciesId}".`);
    }

    const matchingBranches = currentSp.evolutions.filter((b) => b.requiredItemId === itemId);
    if (matchingBranches.length === 0) {
      throw new Error(`${unit.nickname} (${currentSp.name}) cannot promote with ${ITEM_MAP.get(itemId)?.name ?? itemId}.`);
    }

    const chosenBranch = targetSpeciesId
      ? matchingBranches.find((b) => b.targetSpeciesId === targetSpeciesId)
      : matchingBranches[0];
    if (!chosenBranch) {
      throw new Error(`Invalid promotion target "${targetSpeciesId ?? ''}" for ${currentSp.name}.`);
    }

    if (unit.level < chosenBranch.minLevel) {
      throw new Error(
        `${unit.nickname} must reach Lv. ${chosenBranch.minLevel} to use ${ITEM_MAP.get(itemId)?.name ?? itemId} (currently Lv. ${unit.level}).`
      );
    }

    // Consume promotion item from unit's equipped slot OR Convoy
    if (unit.consumableItemId === itemId) {
      unit.consumableItemId = null;
    } else {
      const convoySlot = save.convoy.find((c) => c.itemId === itemId);
      if (!convoySlot || convoySlot.quantity < 1) {
        throw new Error(`${ITEM_MAP.get(itemId)?.name ?? itemId} is not in the Bag.`);
      }
      convoySlot.quantity -= 1;
      if (convoySlot.quantity <= 0) {
        save.convoy = save.convoy.filter((c) => c.itemId !== itemId);
      }
    }

    const targetSp = SPECIES_MAP.get(chosenBranch.targetSpeciesId)!;
    unit.currentStats.hp += chosenBranch.promotionBonuses.hp;
    unit.currentStats.atk += chosenBranch.promotionBonuses.atk;
    unit.currentStats.def += chosenBranch.promotionBonuses.def;
    unit.currentStats.spa += chosenBranch.promotionBonuses.spa;
    unit.currentStats.spd += chosenBranch.promotionBonuses.spd;
    unit.currentStats.spe += chosenBranch.promotionBonuses.spe;
    unit.currentStats.mov = targetSp.baseStats.mov;

    if (unit.nickname === currentSp.name) {
      unit.nickname = targetSp.name;
    }
    unit.speciesId = targetSp.id;

    for (const entry of targetSp.learnset) {
      if (entry.level <= unit.level && !unit.unlockedMoveIds.includes(entry.moveId)) {
        unit.unlockedMoveIds.push(entry.moveId);
        if (unit.activeMoveIds.length < 4) {
          unit.activeMoveIds.push(entry.moveId);
        }
      }
    }
    if (!unit.equippedMoveId) {
      const firstOffensive = unit.activeMoveIds.find((mId) => {
        const mv = MOVE_MAP.get(mId);
        return mv && (mv.category === 'Physical' || mv.category === 'Special');
      });
      unit.equippedMoveId = firstOffensive ?? null;
    }

    this.commitSave(save);
    return JSON.parse(JSON.stringify(unit)) as OwnedPokemonInstance;
  }

  public ensureOverworldInitialized(
    graph: OverworldGraphDefinition = DEFAULT_OVERWORLD_GRAPH
  ): SaveData {
    const save = this.requireActiveSave();
    const reconciled = ensureOverworldGraphState(save, graph);
    if (reconciled.mutated) {
      save.overworld = {
        currentNodeId: reconciled.currentNodeId,
        nodes: reconciled.nodes,
      };
      this.commitSave(save);
    }
    return this.getSave()!;
  }

  public applyOverworldSandboxPreset(
    graph: OverworldGraphDefinition = DEFAULT_OVERWORLD_GRAPH,
    rng: () => number = Math.random
  ): SaveData {
    const save = this.requireActiveSave();
    const nodes = createSandboxOverworldNodes(graph, rng);
    const clearedIds = Object.values(nodes)
      .filter((st) => st.cleared)
      .map((st) => st.nodeId);

    save.campaign.completedChapterIds = clearedIds;
    save.campaign.kecleonShopsUnlocked = true;
    save.campaign.currentChapterId = nodes['chapter_04'] ? 'chapter_04' : graph.startNodeId;
    save.gold = Math.max(save.gold, 2500);
    save.overworld = {
      currentNodeId: graph.startNodeId,
      nodes,
    };

    this.commitSave(save);
    return this.getSave()!;
  }

  public resetOverworldToPrologue(
    graph: OverworldGraphDefinition = DEFAULT_OVERWORLD_GRAPH
  ): SaveData {
    const save = this.requireActiveSave();
    save.campaign.completedChapterIds = [];
    save.campaign.kecleonShopsUnlocked = false;
    save.campaign.currentChapterId = graph.startNodeId;
    save.overworld = {
      currentNodeId: graph.startNodeId,
      nodes: createPrologueOverworldNodes(graph),
    };
    this.commitSave(save);
    return this.getSave()!;
  }

  public unlockAllOverworldNodes(
    graph: OverworldGraphDefinition = DEFAULT_OVERWORLD_GRAPH
  ): SaveData {
    const save = this.requireActiveSave();
    const nodes = createUnlockedAllOverworldNodes(graph);
    const current =
      save.overworld?.currentNodeId && nodes[save.overworld.currentNodeId]
        ? save.overworld.currentNodeId
        : graph.startNodeId;
    save.campaign.kecleonShopsUnlocked = true;
    save.overworld = {
      currentNodeId: current,
      nodes,
    };
    this.commitSave(save);
    return this.getSave()!;
  }

  public setOverworldCurrentNode(
    nodeId: string,
    graph: OverworldGraphDefinition = DEFAULT_OVERWORLD_GRAPH
  ): SaveData {
    const save = this.requireActiveSave();
    const reconciled = ensureOverworldGraphState(save, graph);
    const target = reconciled.nodes[nodeId];
    if (!target || !target.unlocked) {
      throw new Error(`Overworld node "${nodeId}" is locked or does not exist.`);
    }
    save.overworld = {
      currentNodeId: nodeId,
      nodes: reconciled.nodes,
    };
    this.commitSave(save);
    return this.getSave()!;
  }

  public spawnOverworldKecleonShop(
    nodeId: string,
    shopType?: KecleonShopType,
    rng: () => number = Math.random,
    graph: OverworldGraphDefinition = DEFAULT_OVERWORLD_GRAPH
  ): SaveData {
    const save = this.requireActiveSave();
    const reconciled = ensureOverworldGraphState(save, graph);
    const nodeState = reconciled.nodes[nodeId];
    if (!nodeState || !nodeState.unlocked) {
      throw new Error(`Cannot spawn a Kecleon Shop on locked node "${nodeId}".`);
    }
    nodeState.activeKecleonShop = buildKecleonShopState(shopType, rng);
    save.campaign.kecleonShopsUnlocked = true;
    save.overworld = {
      currentNodeId: reconciled.currentNodeId,
      nodes: reconciled.nodes,
    };
    this.commitSave(save);
    return this.getSave()!;
  }

  public spawnOverworldSkirmish(
    nodeId: string,
    recommendedLevel?: number,
    tilesetId?: string,
    graph: OverworldGraphDefinition = DEFAULT_OVERWORLD_GRAPH
  ): SaveData {
    const save = this.requireActiveSave();
    const reconciled = ensureOverworldGraphState(save, graph);
    const def = getOverworldNodeById(nodeId, graph);
    const nodeState = reconciled.nodes[nodeId];
    if (!def || !nodeState || !nodeState.unlocked) {
      throw new Error(`Cannot spawn a Feral Skirmish on locked node "${nodeId}".`);
    }
    nodeState.activeSkirmish = buildSkirmishSpawnState(def, {
      recommendedLevel,
      tilesetId,
    });
    save.overworld = {
      currentNodeId: reconciled.currentNodeId,
      nodes: reconciled.nodes,
    };
    this.commitSave(save);
    return this.getSave()!;
  }

  public clearOverworldSkirmish(
    nodeId: string,
    goldBounty = 0,
    graph: OverworldGraphDefinition = DEFAULT_OVERWORLD_GRAPH
  ): SaveData {
    const save = this.requireActiveSave();
    const reconciled = ensureOverworldGraphState(save, graph);
    const nodeState = reconciled.nodes[nodeId];
    if (nodeState) {
      nodeState.activeSkirmish = null;
    }
    if (goldBounty > 0) {
      save.gold += Math.floor(goldBounty);
    }
    save.overworld = {
      currentNodeId: reconciled.currentNodeId,
      nodes: reconciled.nodes,
    };
    this.commitSave(save);
    return this.getSave()!;
  }

  public completeOverworldChapter(
    nodeId: string,
    opts?: {
      rng?: () => number;
      graph?: OverworldGraphDefinition;
      skirmishChance?: number;
      shopChance?: number;
    }
  ): { save: SaveData; firstClear: boolean; spawns: PostBattleSpawnResult } {
    const graph = opts?.graph ?? DEFAULT_OVERWORLD_GRAPH;
    const save = this.requireActiveSave();
    const reconciled = ensureOverworldGraphState(save, graph);
    const def = getOverworldNodeById(nodeId, graph);
    const nodeState = reconciled.nodes[nodeId];
    if (!def || !nodeState) {
      throw new Error(`Unknown Overworld node "${nodeId}".`);
    }

    const firstClear = !nodeState.cleared && !save.campaign.completedChapterIds.includes(nodeId);
    nodeState.unlocked = true;
    nodeState.cleared = true;
    if (!save.campaign.completedChapterIds.includes(nodeId)) {
      save.campaign.completedChapterIds.push(nodeId);
    }
    if (def.unlocksKecleonShopsOnClear) {
      save.campaign.kecleonShopsUnlocked = true;
    }
    if (firstClear && def.clearGoldReward > 0) {
      save.gold += def.clearGoldReward;
    }

    for (const nextId of def.unlocksNodeIdsOnClear) {
      const nextState = reconciled.nodes[nextId];
      if (nextState) {
        nextState.unlocked = true;
      }
    }

    // Advance `campaign.currentChapterId` to the earliest unlocked non-cleared story node
    const nextStory = graph.nodes.find(
      (n) => n.kind === 'story' && reconciled.nodes[n.id]?.unlocked && !reconciled.nodes[n.id]?.cleared
    );
    if (nextStory) {
      save.campaign.currentChapterId = nextStory.id;
    }

    const spawns = rollPostBattleOverworldSpawns(reconciled.nodes, graph, {
      justClearedNodeId: nodeId,
      kecleonShopsUnlocked: save.campaign.kecleonShopsUnlocked,
      skirmishChance: opts?.skirmishChance,
      shopChance: opts?.shopChance,
      rng: opts?.rng,
    });

    save.overworld = {
      currentNodeId: nodeId,
      nodes: reconciled.nodes,
    };

    this.commitSave(save);
    return {
      save: this.getSave()!,
      firstClear,
      spawns,
    };
  }

  public buyKecleonShopItem(
    nodeId: string,
    itemId: string,
    graph: OverworldGraphDefinition = DEFAULT_OVERWORLD_GRAPH
  ): { save: SaveData; item: ItemDefinition; remainingStock: number } {
    const save = this.requireActiveSave();
    const reconciled = ensureOverworldGraphState(save, graph);
    const nodeState = reconciled.nodes[nodeId];
    const shop = nodeState?.activeKecleonShop;
    if (!nodeState || !shop) {
      throw new Error('No Kecleon Shop is currently active at this location.');
    }

    const stockIndex = shop.inventoryItemIds.indexOf(itemId);
    if (stockIndex === -1) {
      throw new Error('That item is out of stock at this Kecleon stall.');
    }

    const item = ITEM_MAP.get(itemId);
    if (!item || item.buyPrice === null) {
      throw new Error(`Item "${itemId}" cannot be purchased.`);
    }
    if (save.gold < item.buyPrice) {
      throw new Error(`Not enough Gold! Need ${item.buyPrice}G (have ${save.gold}G).`);
    }

    save.gold -= item.buyPrice;
    returnItemToConvoyList(save.convoy, item.id);
    shop.inventoryItemIds.splice(stockIndex, 1);
    const remainingStock = shop.inventoryItemIds.length;
    if (remainingStock === 0) {
      nodeState.activeKecleonShop = null;
    }

    save.overworld = {
      currentNodeId: reconciled.currentNodeId,
      nodes: reconciled.nodes,
    };
    this.commitSave(save);
    return {
      save: this.getSave()!,
      item,
      remainingStock,
    };
  }

  public clearLocalSave(): void {
    this.storage.removeItem(SAVE_STORAGE_KEY);
    this.storage.removeItem(LEGACY_SAVE_STORAGE_KEY);
    this.currentSave = null;
    this.emitChange();
  }

  /**
   * Deletes all save data from localStorage AND from the currently signed-in Google account's
   * Cloud Firestore document (`saves/{uid}`).
   */
  public async deleteSaveFromLinkedAccount(): Promise<{
    deletedLocal: boolean;
    deletedCloud: boolean;
  }> {
    const hadLocal = Boolean(
      this.currentSave ||
        this.storage.getItem(SAVE_STORAGE_KEY) ||
        this.storage.getItem(LEGACY_SAVE_STORAGE_KEY)
    );
    this.storage.removeItem(SAVE_STORAGE_KEY);
    this.storage.removeItem(LEGACY_SAVE_STORAGE_KEY);
    this.storage.removeItem(META_STORAGE_KEY);
    this.currentSave = null;

    const user = this.cloud.getCurrentUser();
    if (!user || typeof this.cloud.deleteCloudSave !== 'function') {
      this.syncStatus = {
        ...this.syncStatus,
        lastResolution: 'unauthenticated',
        errorMessage: null,
      };
      this.emitChange();
      return { deletedLocal: hadLocal, deletedCloud: false };
    }

    try {
      await this.cloud.deleteCloudSave(user.uid);
      if (
        this.isBrowserPrimaryStorage &&
        Object.keys(getAllCustomMapOverrides()).length > 0 &&
        typeof this.cloud.pushCustomMapsOnly === 'function'
      ) {
        await this.cloud.pushCustomMapsOnly(
          user.uid,
          JSON.stringify(getCustomMapsSyncEnvelope())
        );
      }
      this.syncStatus = {
        ...this.syncStatus,
        user,
        lastResolution: 'empty',
        lastSyncedAt: Date.now(),
        errorMessage: null,
      };
      this.emitChange();
      return { deletedLocal: hadLocal, deletedCloud: true };
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to delete save data from Cloud Firestore.';
      this.syncStatus = {
        ...this.syncStatus,
        user,
        lastResolution: 'cloud_error',
        errorMessage: message,
      };
      this.emitChange();
      throw err;
    }
  }

  public exportSaveJson(): string {
    const save = this.requireActiveSave();
    return JSON.stringify(save, null, 2);
  }

  public importSaveJson(rawJson: string, preserveTimestamp = false): SaveData {
    let parsed: unknown;
    try {
      parsed = JSON.parse(rawJson);
    } catch {
      throw new Error('Invalid JSON file: could not parse backup payload.');
    }

    const normalized = normalizeLegacySingleItemSlots(parsed);
    const check = validateSaveData(normalized, SPECIES_MAP, MOVE_MAP, ITEM_MAP);
    if (!check.valid || !check.save) {
      throw new Error(`Invalid save backup: ${check.errors.join(' ')}`);
    }

    const nextSave: SaveData = {
      ...check.save,
      lastUpdated: preserveTimestamp ? check.save.lastUpdated : Date.now(),
    };

    if (nextSave.newGamePlusUnlocked) {
      this.storage.setItem(META_STORAGE_KEY, JSON.stringify({ newGamePlusUnlocked: true }));
    }

    this.commitSave(nextSave, preserveTimestamp);
    return this.getSave()!;
  }

  public async signInWithGoogleAndSync(): Promise<CloudSyncResolution> {
    const user = await this.cloud.signInWithGoogle();
    this.syncStatus = { ...this.syncStatus, user, errorMessage: null };
    if (this.inFlightReconcile) {
      return this.inFlightReconcile;
    }
    return this.reconcileWithCloud();
  }

  public async signOutFromGoogle(): Promise<void> {
    await this.cloud.signOut();
    this.syncStatus = {
      ...this.syncStatus,
      user: null,
      lastResolution: 'unauthenticated',
      errorMessage: null,
    };
    this.emitChange();
  }

  /**
   * Rule 7: Cross-Device Timestamp Resolution between `localStorage` and Cloud Firestore (`saves/{uid}`).
   */
  public reconcileWithCloud(): Promise<CloudSyncResolution> {
    if (this.inFlightReconcile) {
      return this.inFlightReconcile;
    }
    const p = this.performReconcileWithCloud().finally(() => {
      if (this.inFlightReconcile === p) {
        this.inFlightReconcile = null;
      }
    });
    this.inFlightReconcile = p;
    return p;
  }

  private getSerializedCustomMapsEnvelopeOrNull(): string | null {
    if (this.isBrowserPrimaryStorage && hasAnyCustomMapSyncState()) {
      return JSON.stringify(getCustomMapsSyncEnvelope());
    }
    if (this.currentSave?.customMaps && Object.keys(this.currentSave.customMaps).length > 0) {
      return JSON.stringify({
        version: 2,
        overrides: this.currentSave.customMaps,
        resets: {},
      });
    }
    return null;
  }

  private withMergedCustomMaps(save: SaveData): SaveData {
    if (!this.isBrowserPrimaryStorage) return save;
    const cloned = JSON.parse(JSON.stringify(save)) as SaveData;
    const allOverrides = getAllCustomMapOverrides();
    if (Object.keys(allOverrides).length > 0) {
      cloned.customMaps = allOverrides;
    } else {
      delete cloned.customMaps;
    }
    return cloned;
  }

  private async performReconcileWithCloud(): Promise<CloudSyncResolution> {
    const user = this.cloud.getCurrentUser();
    if (!user) {
      this.syncStatus = { ...this.syncStatus, user: null, lastResolution: 'unauthenticated' };
      this.emitChange();
      return 'unauthenticated';
    }

    try {
      const localSave = this.readValidLocalSave();
      this.currentSave = localSave;

      if (this.isBrowserPrimaryStorage && localSave?.customMaps) {
        mergeCustomMapsRecord(localSave.customMaps);
      }

      const rawCloud = await this.cloud.fetchCloudSave(user.uid);
      const { saveCandidate, customMapsEnvelope } = extractCloudPayloadParts(rawCloud);

      let mapSync = { localChanged: false, cloudOutdated: false };
      if (this.isBrowserPrimaryStorage) {
        mapSync = reconcileCustomMapsEnvelope(
          customMapsEnvelope as CustomMapsSyncEnvelope | null
        );
      }

      let cloudSave: SaveData | null = null;
      if (saveCandidate) {
        const normalizedCloud = normalizeLegacySingleItemSlots(saveCandidate);
        const check = validateSaveData(normalizedCloud, SPECIES_MAP, MOVE_MAP, ITEM_MAP);
        if (check.valid && check.save) {
          cloudSave = check.save;
        }
      }

      let resolution: CloudSyncResolution;
      if (!localSave && !cloudSave) {
        if (mapSync.cloudOutdated) {
          const envJson = this.getSerializedCustomMapsEnvelopeOrNull();
          if (envJson && typeof this.cloud.pushCustomMapsOnly === 'function') {
            await this.cloud.pushCustomMapsOnly(user.uid, envJson);
          }
          resolution = mapSync.localChanged ? 'pulled_newer_cloud' : 'pushed_newer_local';
        } else if (mapSync.localChanged) {
          resolution = 'pulled_newer_cloud';
        } else {
          resolution = 'empty';
        }
      } else if (!localSave && cloudSave) {
        this.writeLocalOnly(this.withMergedCustomMaps(cloudSave));
        if (mapSync.cloudOutdated) {
          await this.cloud.pushCloudSave(
            user.uid,
            this.currentSave!,
            this.getSerializedCustomMapsEnvelopeOrNull()
          );
        }
        resolution = 'pulled_newer_cloud';
      } else if (localSave && !cloudSave) {
        this.writeLocalOnly(this.withMergedCustomMaps(localSave));
        await this.cloud.pushCloudSave(
          user.uid,
          this.currentSave!,
          this.getSerializedCustomMapsEnvelopeOrNull()
        );
        resolution = 'pushed_newer_local';
      } else if (cloudSave!.lastUpdated > localSave!.lastUpdated) {
        this.writeLocalOnly(this.withMergedCustomMaps(cloudSave!));
        if (mapSync.cloudOutdated) {
          await this.cloud.pushCloudSave(
            user.uid,
            this.currentSave!,
            this.getSerializedCustomMapsEnvelopeOrNull()
          );
        }
        resolution = 'pulled_newer_cloud';
      } else if (localSave!.lastUpdated > cloudSave!.lastUpdated) {
        this.writeLocalOnly(this.withMergedCustomMaps(localSave!));
        await this.cloud.pushCloudSave(
          user.uid,
          this.currentSave!,
          this.getSerializedCustomMapsEnvelopeOrNull()
        );
        resolution = 'pushed_newer_local';
      } else {
        if (mapSync.localChanged) {
          this.writeLocalOnly(this.withMergedCustomMaps(localSave!));
        }
        if (mapSync.cloudOutdated) {
          this.writeLocalOnly(this.withMergedCustomMaps(localSave!));
          await this.cloud.pushCloudSave(
            user.uid,
            this.currentSave!,
            this.getSerializedCustomMapsEnvelopeOrNull()
          );
          resolution = mapSync.localChanged ? 'pulled_newer_cloud' : 'pushed_newer_local';
        } else {
          resolution = mapSync.localChanged ? 'pulled_newer_cloud' : 'already_in_sync';
        }
      }

      this.syncStatus = {
        ...this.syncStatus,
        user,
        lastResolution: resolution,
        lastSyncedAt: Date.now(),
        errorMessage: null,
      };
      this.emitChange();
      return resolution;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Cloud Firestore sync failed.';
      this.syncStatus = {
        ...this.syncStatus,
        user,
        lastResolution: 'cloud_error',
        errorMessage: message,
      };
      this.emitChange();
      return 'cloud_error';
    }
  }

  private requireActiveSave(): SaveData {
    if (!this.currentSave) {
      throw new Error('No active campaign save loaded.');
    }
    return this.currentSave;
  }

  private readValidLocalSave(): SaveData | null {
    try {
      let raw = this.storage.getItem(SAVE_STORAGE_KEY);
      if (!raw) {
        const legacy = this.storage.getItem(LEGACY_SAVE_STORAGE_KEY);
        if (legacy) {
          this.storage.setItem(SAVE_STORAGE_KEY, legacy);
          this.storage.removeItem(LEGACY_SAVE_STORAGE_KEY);
          raw = legacy;
        }
      }
      if (!raw) return null;
      const parsed = JSON.parse(raw) as unknown;
      const normalized = normalizeLegacySingleItemSlots(parsed);
      const check = validateSaveData(normalized, SPECIES_MAP, MOVE_MAP, ITEM_MAP);
      return check.valid && check.save ? check.save : null;
    } catch {
      return null;
    }
  }

  /**
   * Syncs Dev Tools map overrides & reset tombstones (`ChapterMapStore`) to `localStorage` AND
   * immediately pushes them to Cloud Firestore (`saves/{uid}`) — even if no campaign save has
   * been started yet — so PC and Mobile devices signed into the same Google account stay in sync.
   */
  public async syncCustomMapsWithActiveSave(): Promise<CloudSyncResolution> {
    if (!this.isBrowserPrimaryStorage) {
      return 'unauthenticated';
    }

    const allOverrides = getAllCustomMapOverrides();
    const customMapsField = Object.keys(allOverrides).length > 0 ? allOverrides : undefined;
    const envelopeJson = this.getSerializedCustomMapsEnvelopeOrNull();

    if (this.currentSave) {
      const stamped: SaveData = {
        ...this.currentSave,
        customMaps: customMapsField,
        lastUpdated: Math.max(Date.now(), (this.currentSave.lastUpdated ?? 0) + 1),
      };
      if (stamped.customMaps === undefined) {
        delete stamped.customMaps;
      }
      const check = validateSaveData(stamped, SPECIES_MAP, MOVE_MAP, ITEM_MAP);
      if (check.valid && check.save) {
        this.writeLocalOnly(check.save);
        this.emitChange();
      }
    }

    const user = this.cloud.getCurrentUser();
    if (!user) {
      return 'unauthenticated';
    }

    try {
      if (this.currentSave) {
        await this.cloud.pushCloudSave(user.uid, this.currentSave, envelopeJson);
      } else if (envelopeJson && typeof this.cloud.pushCustomMapsOnly === 'function') {
        await this.cloud.pushCustomMapsOnly(user.uid, envelopeJson);
      }
      this.syncStatus = {
        ...this.syncStatus,
        user,
        lastResolution: 'pushed_newer_local',
        lastSyncedAt: Date.now(),
        errorMessage: null,
      };
      this.emitChange();
      return 'pushed_newer_local';
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to sync custom maps to Cloud Firestore.';
      this.syncStatus = {
        ...this.syncStatus,
        user,
        lastResolution: 'cloud_error',
        errorMessage: message,
      };
      this.emitChange();
      return 'cloud_error';
    }
  }

  private writeLocalOnly(save: SaveData): void {
    this.currentSave = JSON.parse(JSON.stringify(save)) as SaveData;
    if (this.isBrowserPrimaryStorage && this.currentSave.customMaps) {
      mergeCustomMapsRecord(this.currentSave.customMaps);
    }
    this.storage.setItem(SAVE_STORAGE_KEY, JSON.stringify(this.currentSave));
    if (this.currentSave.newGamePlusUnlocked) {
      this.storage.setItem(META_STORAGE_KEY, JSON.stringify({ newGamePlusUnlocked: true }));
    }
  }

  private commitSave(save: SaveData, keepExistingTimestamp = false): void {
    let customMapsField = save.customMaps;
    if (this.isBrowserPrimaryStorage) {
      if (save.customMaps) {
        mergeCustomMapsRecord(save.customMaps);
      }
      const allOverrides = getAllCustomMapOverrides();
      customMapsField = Object.keys(allOverrides).length > 0 ? allOverrides : undefined;
    }

    const stamped: SaveData = {
      ...save,
      customMaps: customMapsField,
      lastUpdated: keepExistingTimestamp ? save.lastUpdated : Math.max(Date.now(), (this.currentSave?.lastUpdated ?? 0) + 1),
    };
    if (stamped.customMaps === undefined) {
      delete stamped.customMaps;
    }

    const check = validateSaveData(stamped, SPECIES_MAP, MOVE_MAP, ITEM_MAP);
    if (!check.valid || !check.save) {
      throw new Error(`Refusing to persist invalid save state: ${check.errors.join(' ')}`);
    }

    this.writeLocalOnly(check.save);
    this.emitChange();

    const user = this.cloud.getCurrentUser();
    if (user) {
      const envelopeJson = this.getSerializedCustomMapsEnvelopeOrNull();
      void this.cloud
        .pushCloudSave(user.uid, this.currentSave!, envelopeJson)
        .then(() => {
          this.syncStatus = {
            ...this.syncStatus,
            lastResolution: 'pushed_newer_local',
            lastSyncedAt: Date.now(),
            errorMessage: null,
          };
          this.emitChange();
        })
        .catch((err: unknown) => {
          this.syncStatus = {
            ...this.syncStatus,
            lastResolution: 'cloud_error',
            errorMessage: err instanceof Error ? err.message : 'Failed to push save to Firestore.',
          };
          this.emitChange();
        });
    }
  }

  private emitChange(): void {
    const snapSave = this.getSave();
    const snapStatus = this.getSyncStatus();
    for (const fn of this.changeListeners) {
      fn(snapSave, snapStatus);
    }
  }
}
