import { ITEM_MAP, MOVE_MAP, SPECIES_MAP } from '../data/index';
import {
  CURRENT_SAVE_SCHEMA_VERSION,
  type EvolutionBranch,
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
}

export class SaveStateManager {
  private readonly storage: StorageLike;
  private readonly cloud: CloudSyncAdapter;
  private currentSave: SaveData | null = null;
  private syncStatus: SyncStatusSnapshot;
  private readonly changeListeners = new Set<(save: SaveData | null, status: SyncStatusSnapshot) => void>();
  private unsubscribeAuth: (() => void) | null = null;
  private inFlightReconcile: Promise<CloudSyncResolution> | null = null;

  constructor(storage?: StorageLike, cloudAdapter?: CloudSyncAdapter) {
    this.storage = storage ?? getDefaultStorage();
    this.cloud = cloudAdapter ?? new FirestoreSyncAdapter();
    this.currentSave = this.readValidLocalSave();
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

    const save: SaveData = {
      schemaVersion: CURRENT_SAVE_SCHEMA_VERSION,
      saveId: generateId('campaign'),
      lastUpdated: Date.now(),
      newGamePlusUnlocked: this.isNewGamePlusUnlocked(),
      gold: cfg.startingGold ?? 1500,
      campaign: {
        currentChapterId: 'prologue',
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
      ],
      supports: {},
      overworld: {
        currentNodeId: 'prologue',
        nodes: {
          prologue: {
            nodeId: 'prologue',
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

  public clearLocalSave(): void {
    this.storage.removeItem(SAVE_STORAGE_KEY);
    this.storage.removeItem(LEGACY_SAVE_STORAGE_KEY);
    this.currentSave = null;
    this.emitChange();
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

    const check = validateSaveData(parsed, SPECIES_MAP, MOVE_MAP, ITEM_MAP);
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

      const rawCloud = await this.cloud.fetchCloudSave(user.uid);
      let cloudSave: SaveData | null = null;
      if (rawCloud) {
        const check = validateSaveData(rawCloud, SPECIES_MAP, MOVE_MAP, ITEM_MAP);
        if (check.valid && check.save) {
          cloudSave = check.save;
        }
      }

      let resolution: CloudSyncResolution;
      if (!localSave && !cloudSave) {
        resolution = 'empty';
      } else if (!localSave && cloudSave) {
        this.writeLocalOnly(cloudSave);
        resolution = 'pulled_newer_cloud';
      } else if (localSave && !cloudSave) {
        await this.cloud.pushCloudSave(user.uid, localSave);
        resolution = 'pushed_newer_local';
      } else if (cloudSave!.lastUpdated > localSave!.lastUpdated) {
        this.writeLocalOnly(cloudSave!);
        resolution = 'pulled_newer_cloud';
      } else if (localSave!.lastUpdated > cloudSave!.lastUpdated) {
        await this.cloud.pushCloudSave(user.uid, localSave!);
        resolution = 'pushed_newer_local';
      } else {
        resolution = 'already_in_sync';
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
      const check = validateSaveData(parsed, SPECIES_MAP, MOVE_MAP, ITEM_MAP);
      return check.valid && check.save ? check.save : null;
    } catch {
      return null;
    }
  }

  private writeLocalOnly(save: SaveData): void {
    this.currentSave = JSON.parse(JSON.stringify(save)) as SaveData;
    this.storage.setItem(SAVE_STORAGE_KEY, JSON.stringify(this.currentSave));
    if (this.currentSave.newGamePlusUnlocked) {
      this.storage.setItem(META_STORAGE_KEY, JSON.stringify({ newGamePlusUnlocked: true }));
    }
  }

  private commitSave(save: SaveData, keepExistingTimestamp = false): void {
    const stamped: SaveData = {
      ...save,
      lastUpdated: keepExistingTimestamp ? save.lastUpdated : Math.max(Date.now(), (this.currentSave?.lastUpdated ?? 0) + 1),
    };

    const check = validateSaveData(stamped, SPECIES_MAP, MOVE_MAP, ITEM_MAP);
    if (!check.valid || !check.save) {
      throw new Error(`Refusing to persist invalid save state: ${check.errors.join(' ')}`);
    }

    this.writeLocalOnly(check.save);
    this.emitChange();

    const user = this.cloud.getCurrentUser();
    if (user) {
      void this.cloud
        .pushCloudSave(user.uid, this.currentSave!)
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
