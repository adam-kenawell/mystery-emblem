/**
 * Mystery Emblem — Persistent SaveStateManager (`localStorage` + Cloud Firestore Sync)
 */

import { mergeCustomMapsRecord } from '../data/chapterMapRegistry';
import { DEFAULT_QUIZ_SEEDS, formatCampaignChapterLabel } from '../data/campaignConfig';
import type { EquipCategory } from '../data/equippedMoves';
import { DEMO_OVERWORLD_GRAPH, type OverworldGraphDefinition } from '../data/overworldMapData';
import type { PostBattleSpawnResult } from '../engine/overworldEngine';
import type {
  ItemDefinition, KecleonShopType, OwnedPokemonInstance, SaveData,
  SupportPairProgress, TutorialDetailLevel, TutorialFamiliarityPreferences,
} from '../types/schemas';
import {
  mutateAddSupportPoints, mutateCommitBattleResults,
  type BattleUnitSaveSyncEntry, type CommitBattleResultsPayload,
} from './battleCommitMutators';
import {
  mutateMarkTutorialSeen, mutateTutorialDetailLevel, pushUniqueIdToFlagList,
  readAreTutorialsEnabled, readTutorialPreferences, readUnlockedTutorialIds,
} from './campaignAndTutorialMutators';
import { buildNewCampaignSaveData, type NewCampaignConfig } from './campaignSaveFactory';
import { performCloudSaveReconciliation, serializeCustomMapsEnvelope } from './cloudReconciler';
import {
  mutateAddConvoyItem, mutateEquipItemToUnit, mutateTeachTmMove,
  mutateUseEvolutionItemOnUnit, mutateUseVitaminOnUnit,
} from './convoyAndItemMutators';
import { FirestoreSyncAdapter, type CloudSyncAdapter } from './firebaseSync';
import {
  mutateBuyKecleonShopItem, mutateClearOverworldSkirmish, mutateCompleteOverworldChapter,
  mutateEnsureOverworldInitialized, mutateResetOverworldToPrologue, mutateSetOverworldCurrentNode,
  mutateSetOverworldNodeStateCheat, mutateSpawnOverworldKecleonShop,
  mutateSpawnOverworldSkirmish, mutateUnlockAllOverworldNodes,
} from './overworldAndShopMutators';
import {
  mutateClearEquippedMove, mutateEvolveUnitToSpecies, mutateRecruitPokemon,
  mutateRenamePokemon, mutateSetActiveMoves, mutateSetEquippedMove,
  mutateSetUnitLevelForTest, mutateUnlockUnitMove,
} from './rosterAndMoveMutators';
import {
  computeSupportLevel, createPokemonInstance, getDefaultStorage, getUnitEquippedItemId,
  LEGACY_SAVE_STORAGE_KEY, makeSupportPairKey, META_STORAGE_KEY, sanitizeNickname,
  SAVE_STORAGE_KEY, SUPPORT_LEVEL_THRESHOLDS,
  type CloudSyncResolution, type CreatePokemonOptions, type StorageLike, type SyncStatusSnapshot,
} from './saveHelpersAndFactory';
import {
  parseImportedSaveBackup, performDeleteSaveFromAccount, performSyncCustomMapsWithSave,
  readValidLocalSaveFromStorage, stampAndValidateSaveForCommit, writeLocalSaveToStorage,
} from './saveStorageIo';

export {
  DEFAULT_QUIZ_SEEDS, formatCampaignChapterLabel, SAVE_STORAGE_KEY, META_STORAGE_KEY,
  SUPPORT_LEVEL_THRESHOLDS, makeSupportPairKey, computeSupportLevel, sanitizeNickname,
  getUnitEquippedItemId, createPokemonInstance,
};
export type {
  CloudSyncResolution, SyncStatusSnapshot, StorageLike, CreatePokemonOptions,
  NewCampaignConfig, BattleUnitSaveSyncEntry, CommitBattleResultsPayload,
};

const cloneUnit = (u: OwnedPokemonInstance): OwnedPokemonInstance => JSON.parse(JSON.stringify(u)) as OwnedPokemonInstance;

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
    this.isBrowserPrimaryStorage = typeof window !== 'undefined' && Boolean(window.localStorage) && this.storage === window.localStorage;
    this.cloud = cloudAdapter ?? new FirestoreSyncAdapter();
    this.currentSave = readValidLocalSaveFromStorage(this.storage);
    if (this.isBrowserPrimaryStorage && this.currentSave?.customMaps) mergeCustomMapsRecord(this.currentSave.customMaps);
    this.syncStatus = { isFirebaseConfigured: this.cloud.isConfigured, user: this.cloud.getCurrentUser(), lastResolution: null, lastSyncedAt: null, errorMessage: null };
    this.unsubscribeAuth = this.cloud.onAuthStateChanged((user) => {
      this.syncStatus = { ...this.syncStatus, user };
      if (user) void this.reconcileWithCloud();
      else this.emitChange();
    });
  }

  public dispose(): void { this.unsubscribeAuth?.(); this.unsubscribeAuth = null; this.changeListeners.clear(); }
  public getSave(): SaveData | null { return this.currentSave ? (JSON.parse(JSON.stringify(this.currentSave)) as SaveData) : null; }
  public getSyncStatus(): SyncStatusSnapshot { return { ...this.syncStatus }; }

  public subscribe(listener: (save: SaveData | null, status: SyncStatusSnapshot) => void): () => void {
    this.changeListeners.add(listener);
    listener(this.getSave(), this.getSyncStatus());
    return () => { this.changeListeners.delete(listener); };
  }

  public isNewGamePlusUnlocked(): boolean {
    if (this.currentSave?.newGamePlusUnlocked) return true;
    try { const r = this.storage.getItem(META_STORAGE_KEY); return r ? Boolean((JSON.parse(r) as { newGamePlusUnlocked?: boolean }).newGamePlusUnlocked) : false; }
    catch { return false; }
  }
  public unlockNewGamePlus(): void { this.setNewGamePlusUnlocked(true); }
  public setNewGamePlusUnlocked(unlocked: boolean): void {
    this.storage.setItem(META_STORAGE_KEY, JSON.stringify({ newGamePlusUnlocked: unlocked }));
    if (this.currentSave) { this.currentSave.newGamePlusUnlocked = unlocked; this.commitSave(this.currentSave); } else this.emitChange();
  }
  public createNewCampaignSave(cfg: NewCampaignConfig): SaveData { this.commitSave(buildNewCampaignSaveData(cfg, this.isNewGamePlusUnlocked())); return this.getSave()!; }
  public setCurrentChapter(chapterId: string): SaveData {
    const trimmed = chapterId.trim();
    if (!trimmed) throw new Error('chapterId must be a non-empty string.');
    return this.mutateAndCommit((s) => { s.campaign.currentChapterId = trimmed; });
  }

  public renamePokemon(id: string, name: string): OwnedPokemonInstance { return this.mutateUnit((s) => mutateRenamePokemon(s, id, name)); }
  public setEquippedMove(id: string, moveId: string): OwnedPokemonInstance { return this.mutateUnit((s) => mutateSetEquippedMove(s, id, moveId)); }
  public clearEquippedMove(id: string, category: EquipCategory): OwnedPokemonInstance { return this.mutateUnit((s) => mutateClearEquippedMove(s, id, category)); }
  public setActiveMoves(id: string, moveIds: string[]): OwnedPokemonInstance { return this.mutateUnit((s) => mutateSetActiveMoves(s, id, moveIds)); }
  public addConvoyItem(itemId: string, quantity = 1): void { this.mutateAndCommit((s) => mutateAddConvoyItem(s, itemId, quantity)); }
  public recruitPokemon(opts: CreatePokemonOptions): OwnedPokemonInstance { return this.mutateUnit((s) => mutateRecruitPokemon(s, opts)); }
  public unlockUnitMove(id: string, moveId: string, autoEquip = false): OwnedPokemonInstance { return this.mutateUnit((s) => mutateUnlockUnitMove(s, id, moveId, autoEquip)); }
  public useVitaminOnUnit(id: string, vitaminItemId: string, targetMoveId?: string): OwnedPokemonInstance { return this.mutateUnit((s) => mutateUseVitaminOnUnit(s, id, vitaminItemId, targetMoveId)); }
  public teachTmMove(id: string, tmItemId: string): OwnedPokemonInstance { return this.mutateUnit((s) => mutateTeachTmMove(s, id, tmItemId)); }
  public setUnitLevelForTest(id: string, level: number, rescaleStats = false): OwnedPokemonInstance { return this.mutateUnit((s) => mutateSetUnitLevelForTest(s, id, level, rescaleStats)); }
  public useEvolutionItemOnUnit(id: string, itemId: 'evolution_stone' | 'evolution_gem', targetSpeciesId?: string): OwnedPokemonInstance { return this.mutateUnit((s) => mutateUseEvolutionItemOnUnit(s, id, itemId, targetSpeciesId)); }
  public evolveUnitToSpecies(id: string, targetSpeciesId: string): OwnedPokemonInstance { const s = this.requireActiveSave(); const { unit, mutated } = mutateEvolveUnitToSpecies(s, id, targetSpeciesId); if (mutated) this.commitSave(s); return cloneUnit(unit); }
  public equipItemToUnit(id: string, itemId: string | null, sourceUnitId?: string): OwnedPokemonInstance { const s = this.requireActiveSave(); const { unit, mutated } = mutateEquipItemToUnit(s, id, itemId, sourceUnitId); if (mutated) this.commitSave(s); return cloneUnit(unit); }
  public addSupportPoints(idA: string, idB: string, delta = 1): SupportPairProgress { const s = this.requireActiveSave(); const p = mutateAddSupportPoints(s, idA, idB, delta); this.commitSave(s); return p; }
  public addGold(amount: number): SaveData { return this.mutateAndCommit((s) => { s.gold = Math.max(0, Math.floor(s.gold + amount)); }); }
  public commitBattleResults(payload: CommitBattleResultsPayload): SaveData { return this.mutateAndCommit((s) => mutateCommitBattleResults(s, payload)); }

  public hasRecruitedChapter(id: string): boolean { return Boolean(this.currentSave?.campaign.recruitedChapterIds?.includes(id)); }
  public markChapterRecruited(id: string): SaveData { return this.pushCampaignFlag('recruitedChapterIds', id); }
  public hasSeenChapterCutscene(kind: 'intro' | 'outro', id: string): boolean {
    const list = kind === 'intro' ? this.currentSave?.campaign.seenIntroChapterIds : this.currentSave?.campaign.seenOutroChapterIds;
    return Boolean(list?.includes(id));
  }
  public markChapterCutsceneSeen(kind: 'intro' | 'outro', id: string): SaveData {
    return this.pushCampaignFlag(kind === 'intro' ? 'seenIntroChapterIds' : 'seenOutroChapterIds', id);
  }
  public markDemoCompleted(): SaveData { return this.mutateAndCommit((s) => { s.campaign.demoCompleted = true; }); }
  public hasSeenStoryCutscene(id: string): boolean { return Boolean(this.currentSave?.campaign.seenStoryCutsceneIds?.includes(id)); }
  public markStoryCutsceneSeen(id: string): SaveData { return this.pushCampaignFlag('seenStoryCutsceneIds', id); }
  public hasSeenCredits(): boolean { return Boolean(this.currentSave?.campaign.creditsSeen); }
  public markCreditsSeen(): SaveData {
    const save = this.requireActiveSave();
    if (!save.campaign.creditsSeen) { save.campaign.creditsSeen = true; this.commitSave(save); }
    return this.getSave()!;
  }

  public areTutorialsEnabled(): boolean { return readAreTutorialsEnabled(this.currentSave); }
  public setTutorialsEnabled(enabled: boolean): SaveData { return this.mutateAndCommit((s) => { s.campaign.tutorialsEnabled = Boolean(enabled); }); }
  public getTutorialPreferences(): TutorialFamiliarityPreferences { return readTutorialPreferences(this.currentSave); }
  public setTutorialDetailLevel(sub: 'pokemon' | 'fire_emblem', detail: TutorialDetailLevel): SaveData { return this.mutateAndCommit((s) => mutateTutorialDetailLevel(s, sub, detail)); }
  public hasSeenTutorial(id: string): boolean { return Boolean(this.currentSave?.campaign.seenTutorialIds?.includes(id)); }
  public hasUnlockedTutorial(id: string): boolean { return Boolean(this.currentSave?.campaign.unlockedTutorialIds?.includes(id) || this.currentSave?.campaign.seenTutorialIds?.includes(id)); }
  public getUnlockedTutorialIds(): string[] { return readUnlockedTutorialIds(this.currentSave); }
  public getSeenTutorialIds(): string[] { return [...(this.currentSave?.campaign.seenTutorialIds ?? [])]; }
  public unlockTutorial(id: string): SaveData { return this.pushCampaignFlag('unlockedTutorialIds', id); }
  public markTutorialSeen(id: string): SaveData {
    const save = this.requireActiveSave();
    if (mutateMarkTutorialSeen(save, id)) this.commitSave(save);
    return this.getSave()!;
  }
  public resetTutorialsProgress(): SaveData { return this.mutateAndCommit((s) => { s.campaign.seenTutorialIds = []; s.campaign.unlockedTutorialIds = []; }); }

  public ensureOverworldInitialized(graph: OverworldGraphDefinition = DEMO_OVERWORLD_GRAPH): SaveData {
    const save = this.requireActiveSave();
    if (mutateEnsureOverworldInitialized(save, graph)) this.commitSave(save);
    return this.getSave()!;
  }
  public setOverworldNodeStateCheat(nodeId: string, patch: { unlocked?: boolean; cleared?: boolean; activeKecleonShop?: SaveData['overworld']['nodes'][string]['activeKecleonShop']; activeSkirmish?: SaveData['overworld']['nodes'][string]['activeSkirmish'] }, graph: OverworldGraphDefinition = DEMO_OVERWORLD_GRAPH): SaveData {
    return this.mutateAndCommit((s) => mutateSetOverworldNodeStateCheat(s, nodeId, patch, graph));
  }
  public resetOverworldToPrologue(graph: OverworldGraphDefinition = DEMO_OVERWORLD_GRAPH): SaveData { return this.mutateAndCommit((s) => mutateResetOverworldToPrologue(s, graph)); }
  public unlockAllOverworldNodes(graph: OverworldGraphDefinition = DEMO_OVERWORLD_GRAPH): SaveData { return this.mutateAndCommit((s) => mutateUnlockAllOverworldNodes(s, graph)); }
  public setOverworldCurrentNode(nodeId: string, graph: OverworldGraphDefinition = DEMO_OVERWORLD_GRAPH): SaveData { return this.mutateAndCommit((s) => mutateSetOverworldCurrentNode(s, nodeId, graph)); }
  public spawnOverworldKecleonShop(nodeId: string, shopType?: KecleonShopType, rng: () => number = Math.random, graph: OverworldGraphDefinition = DEMO_OVERWORLD_GRAPH): SaveData {
    return this.mutateAndCommit((s) => mutateSpawnOverworldKecleonShop(s, nodeId, shopType, rng, graph));
  }
  public spawnOverworldSkirmish(nodeId: string, level?: number, tilesetId?: string, graph: OverworldGraphDefinition = DEMO_OVERWORLD_GRAPH): SaveData {
    return this.mutateAndCommit((s) => mutateSpawnOverworldSkirmish(s, nodeId, level, tilesetId, graph));
  }
  public clearOverworldSkirmish(nodeId: string, gold = 0, graph: OverworldGraphDefinition = DEMO_OVERWORLD_GRAPH): SaveData {
    return this.mutateAndCommit((s) => mutateClearOverworldSkirmish(s, nodeId, gold, graph));
  }
  public completeOverworldChapter(nodeId: string, opts?: { rng?: () => number; graph?: OverworldGraphDefinition; skirmishChance?: number; shopChance?: number }): { save: SaveData; firstClear: boolean; spawns: PostBattleSpawnResult } {
    const save = this.requireActiveSave();
    const { firstClear, spawns } = mutateCompleteOverworldChapter(save, nodeId, opts);
    this.commitSave(save);
    return { save: this.getSave()!, firstClear, spawns };
  }
  public buyKecleonShopItem(nodeId: string, itemId: string, graph: OverworldGraphDefinition = DEMO_OVERWORLD_GRAPH): { save: SaveData; item: ItemDefinition; remainingStock: number } {
    const save = this.requireActiveSave();
    const { item, remainingStock } = mutateBuyKecleonShopItem(save, nodeId, itemId, graph);
    this.commitSave(save);
    return { save: this.getSave()!, item, remainingStock };
  }

  public clearLocalSave(): void {
    this.storage.removeItem(SAVE_STORAGE_KEY);
    this.storage.removeItem(LEGACY_SAVE_STORAGE_KEY);
    this.currentSave = null;
    this.emitChange();
  }

  public deleteSaveFromLinkedAccount(): Promise<{ deletedLocal: boolean; deletedCloud: boolean }> {
    const hadCurrent = Boolean(this.currentSave);
    this.currentSave = null;
    return performDeleteSaveFromAccount({
      storage: this.storage, isBrowserPrimaryStorage: this.isBrowserPrimaryStorage, cloud: this.cloud, hadCurrentSave: hadCurrent,
      onUpdateSyncStatus: (p) => { this.syncStatus = { ...this.syncStatus, ...p }; this.emitChange(); },
    });
  }

  public exportSaveJson(): string { return JSON.stringify(this.requireActiveSave(), null, 2); }
  public importSaveJson(rawJson: string, preserveTimestamp = false): SaveData {
    const nextSave = parseImportedSaveBackup(rawJson, preserveTimestamp);
    if (nextSave.newGamePlusUnlocked) this.storage.setItem(META_STORAGE_KEY, JSON.stringify({ newGamePlusUnlocked: true }));
    this.commitSave(nextSave, preserveTimestamp);
    return this.getSave()!;
  }

  public async signInWithGoogleAndSync(): Promise<CloudSyncResolution> {
    const user = await this.cloud.signInWithGoogle();
    this.syncStatus = { ...this.syncStatus, user, errorMessage: null };
    return this.inFlightReconcile ?? this.reconcileWithCloud();
  }
  public async signOutFromGoogle(): Promise<void> {
    await this.cloud.signOut();
    this.syncStatus = { ...this.syncStatus, user: null, lastResolution: 'unauthenticated', errorMessage: null };
    this.emitChange();
  }
  public reconcileWithCloud(): Promise<CloudSyncResolution> {
    if (this.inFlightReconcile) return this.inFlightReconcile;
    const p = this.performReconcileWithCloud().finally(() => { if (this.inFlightReconcile === p) this.inFlightReconcile = null; });
    this.inFlightReconcile = p;
    return p;
  }
  public syncCustomMapsWithActiveSave(): Promise<CloudSyncResolution> {
    return performSyncCustomMapsWithSave({
      isBrowserPrimaryStorage: this.isBrowserPrimaryStorage, cloud: this.cloud, getCurrentSave: () => this.currentSave,
      writeLocalOnly: (s) => { this.currentSave = writeLocalSaveToStorage(this.storage, this.isBrowserPrimaryStorage, s); this.emitChange(); },
      onUpdateSyncStatus: (p) => { this.syncStatus = { ...this.syncStatus, ...p }; this.emitChange(); },
    });
  }

  private async performReconcileWithCloud(): Promise<CloudSyncResolution> {
    const user = this.cloud.getCurrentUser();
    if (!user) { this.syncStatus = { ...this.syncStatus, user: null, lastResolution: 'unauthenticated' }; this.emitChange(); return 'unauthenticated'; }
    try {
      this.currentSave = readValidLocalSaveFromStorage(this.storage);
      const resolution = await performCloudSaveReconciliation({
        cloud: this.cloud, user, isBrowserPrimaryStorage: this.isBrowserPrimaryStorage, localSave: this.currentSave,
        writeLocalOnly: (s) => { this.currentSave = writeLocalSaveToStorage(this.storage, this.isBrowserPrimaryStorage, s); },
        getCurrentSave: () => this.currentSave,
      });
      this.syncStatus = { ...this.syncStatus, user, lastResolution: resolution, lastSyncedAt: Date.now(), errorMessage: null };
      this.emitChange();
      return resolution;
    } catch (err) {
      this.syncStatus = { ...this.syncStatus, user, lastResolution: 'cloud_error', errorMessage: err instanceof Error ? err.message : 'Cloud Firestore sync failed.' };
      this.emitChange();
      return 'cloud_error';
    }
  }

  private requireActiveSave(): SaveData {
    if (!this.currentSave) throw new Error('No active campaign save loaded.');
    return this.currentSave;
  }
  private mutateAndCommit(fn: (save: SaveData) => void): SaveData { const s = this.requireActiveSave(); fn(s); this.commitSave(s); return this.getSave()!; }
  private mutateUnit(fn: (save: SaveData) => OwnedPokemonInstance): OwnedPokemonInstance { const s = this.requireActiveSave(); const u = fn(s); this.commitSave(s); return cloneUnit(u); }
  private pushCampaignFlag(key: 'recruitedChapterIds' | 'seenIntroChapterIds' | 'seenOutroChapterIds' | 'seenStoryCutsceneIds' | 'unlockedTutorialIds', id: string): SaveData {
    const save = this.requireActiveSave();
    const { nextList, mutated } = pushUniqueIdToFlagList(save.campaign[key], id);
    save.campaign[key] = nextList;
    if (mutated) this.commitSave(save);
    return this.getSave()!;
  }
  private commitSave(save: SaveData, keepExistingTimestamp = false): void {
    const validated = stampAndValidateSaveForCommit({ save, previousLastUpdated: this.currentSave?.lastUpdated ?? 0, isBrowserPrimaryStorage: this.isBrowserPrimaryStorage, keepExistingTimestamp });
    this.currentSave = writeLocalSaveToStorage(this.storage, this.isBrowserPrimaryStorage, validated);
    this.emitChange();
    const user = this.cloud.getCurrentUser();
    if (user) {
      const envelopeJson = serializeCustomMapsEnvelope(this.isBrowserPrimaryStorage, this.currentSave);
      void this.cloud.pushCloudSave(user.uid, this.currentSave, envelopeJson)
        .then(() => { this.syncStatus = { ...this.syncStatus, lastResolution: 'pushed_newer_local', lastSyncedAt: Date.now(), errorMessage: null }; this.emitChange(); })
        .catch((err: unknown) => { this.syncStatus = { ...this.syncStatus, lastResolution: 'cloud_error', errorMessage: err instanceof Error ? err.message : 'Failed to push save to Firestore.' }; this.emitChange(); });
    }
  }
  private emitChange(): void {
    const s = this.getSave(), st = this.getSyncStatus();
    for (const fn of this.changeListeners) fn(s, st);
  }
}
