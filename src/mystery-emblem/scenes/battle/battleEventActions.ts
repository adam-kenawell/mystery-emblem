/**
 * Declarative Dungeon Event Action Executor (`battleEventActions.ts`)
 *
 * Executes `DungeonEventAction[]` (`show_banner`, `play_dialogue`, `spawn_units`,
 * `convert_unit`, `despawn_units`, `recruit_choice`, `set_tiles`, `set_objective`,
 * `grant_items`, `unlock_kecleon_shop`, `recruit_post_battle`).
 */

import { loadSpeciesSpriteBundle } from '../../assets/pmdAssetLoader';
import { PMD_TILE_NATIVE_PX } from '../../assets/tilesetLoader';
import { DEFAULT_TERRAIN_PALETTE } from '../../data/chapterMapRegistry';
import { resolveDefaultObjectiveLabel } from '../../engine/battleEvents';
import {
  buildSpawnedBattleUnit,
  findNearestFreeSpawnTile,
} from '../../engine/battleSpawnHelpers';
import { interpolateCampaignText } from '../../engine/speakerResolver';
import { coordKey, isInMapBounds } from '../../engine/terrainAndPathfinding';
import type { DungeonEventAction } from '../../types/schemas';
import type { DialogueScript } from '../../ui/DialogueOverlay';
import {
  ensureTilePairVisible,
  showPhaseBanner,
  waitBattleMs,
} from './battleBannersAndTransitions';
import { recomputeDangerArea } from './battleDangerAndViewportState';
import { spawnFloatingText } from './battleFloatingCallouts';
import { updateBattleInfoStrip } from './battleHudCards';
import { preloadMapTilesets } from './battlePrepAndAssets';
import { presentTalkChoiceModalAsync } from './battleTalkChoiceModal';
import type { BattleControllerContext } from './battleTypesAndState';
import { getLivingUnits, getUnitVisualKey } from './battleUnitQueries';

export function resolveDialogueScriptFromAction(
  ctx: BattleControllerContext,
  eventId: string,
  action: Extract<DungeonEventAction, { type: 'play_dialogue' }>
): DialogueScript | null {
  const { state, saveManager } = ctx;
  if (action.scriptId && state.eventScripts[action.scriptId]) {
    return state.eventScripts[action.scriptId]!(saveManager.getSave());
  }
  if (action.lines && action.lines.length > 0) {
    return {
      id: `${eventId}_dlg`,
      title: action.title,
      bgm: action.bgm,
      restorePreviousBgmOnClose: action.restorePreviousBgmOnClose,
      lines: action.lines.map((l) => ({ ...l })),
    };
  }
  return null;
}

export async function executeEventActionsAsync(
  ctx: BattleControllerContext,
  eventId: string,
  actions: ReadonlyArray<DungeonEventAction>,
  runGen: number
): Promise<{ aborted: boolean }> {
  const { state, dom, saveManager, audioManager } = ctx;

  for (const action of actions) {
    if (!state.openState || runGen !== state.battleRunGen) return { aborted: true };

    if (action.type === 'show_banner') {
      showPhaseBanner(state, dom, interpolateCampaignText(action.text, saveManager.getSave()));
    } else if (action.type === 'play_dialogue') {
      const script = resolveDialogueScriptFromAction(ctx, eventId, action);
      if (script && ctx.dialogueOverlay && script.lines.length > 0) {
        state.cutsceneInProgress = true;
        ctx.onLayerStateChanged();
        ctx.renderNow();
        try {
          await ctx.dialogueOverlay.playScript(script);
        } finally {
          if (state.openState && runGen === state.battleRunGen) {
            state.cutsceneInProgress = false;
            ctx.onLayerStateChanged();
            ctx.renderNow();
          }
        }
      }
    } else if (action.type === 'spawn_units') {
      for (const uSpawn of action.units) {
        if (!state.openState || runGen !== state.battleRunGen) return { aborted: true };
        const occupied = new Set(getLivingUnits(state).map((u) => coordKey(u.x, u.y)));
        if (action.checkStairsBlocking && occupied.has(coordKey(uSpawn.x, uSpawn.y))) {
          state.blockedReinforcementIds.add(uSpawn.id || eventId);
          audioManager.playSfx('select');
          spawnFloatingText(state, dom, uSpawn.x, uSpawn.y, 'STAIRS BLOCKED!', '#88f8b8', 1050);
          await waitBattleMs(state, 180);
          continue;
        }
        const built = buildSpawnedBattleUnit(
          uSpawn,
          action.faction,
          state.units.length,
          performance.now(),
          { addToPermanentRoster: action.addToPermanentRoster, save: saveManager.getSave() }
        );
        if (!built) continue;
        const free = findNearestFreeSpawnTile(state.map, uSpawn.x, uSpawn.y, built, occupied);
        if (!free) continue;
        built.x = free.x;
        built.y = free.y;
        built.renderWorldX = free.x * PMD_TILE_NATIVE_PX;
        built.renderWorldY = free.y * PMD_TILE_NATIVE_PX;
        if (uSpawn.mustSurvive && !state.defeatIfUnitIdsFall.includes(built.id)) {
          state.defeatIfUnitIdsFall.push(built.id);
        }
        const visKey = getUnitVisualKey(built);
        if (!state.spriteBundles.has(visKey)) {
          state.spriteBundles.set(visKey, await loadSpeciesSpriteBundle(visKey));
        }
        state.units.push(built);
        ensureTilePairVisible(state, built.x, built.y, built.x, built.y);
        audioManager.playSfx(action.faction === 'enemy' ? 'phase_change' : 'victory_fanfare');
        spawnFloatingText(
          state,
          dom,
          built.x,
          built.y,
          action.calloutText ?? (action.faction === 'enemy' ? 'REINFORCEMENT!' : 'ALLY ARRIVED!'),
          action.faction === 'enemy' ? '#ff8090' : '#68f8a8',
          1050
        );
        ctx.renderNow();
        await waitBattleMs(state, 220);
      }
      if (action.bannerText) showPhaseBanner(state, dom, action.bannerText);
      recomputeDangerArea(ctx);
      updateBattleInfoStrip(ctx);
    } else if (action.type === 'convert_unit') {
      const target = state.units.find(
        (u) => u.id === action.targetUnitId && !u.defeated && u.currentHp > 0
      );
      if (target) {
        target.faction = action.toFaction;
        state.trackedEnemyIds.delete(target.id);
        if (action.healToFull) {
          target.currentHp = target.maxHp;
          target.status = null;
          target.statusTurns = 0;
        }
        if (action.toFaction === 'player') {
          target.isBoss = false;
          target.stationary = false;
          target.waited = !(action.readyToAct ?? true);
          if (action.addToPermanentRoster !== false) target.recruitedMidBattle = true;
        } else if (action.toFaction === 'npc') {
          target.isBoss = false;
          target.waited = !(action.readyToAct ?? true);
        }
        ensureTilePairVisible(state, target.x, target.y, target.x, target.y);
        audioManager.playSfx('victory_fanfare');
        spawnFloatingText(state, dom, target.x, target.y, action.calloutText ?? 'JOINED!', '#ffd860', 1100);
        recomputeDangerArea(ctx);
        updateBattleInfoStrip(ctx);
        ctx.renderNow();
        await waitBattleMs(state, 220);
      }
    } else if (action.type === 'despawn_units') {
      for (const uid of action.unitIds) {
        const idx = state.units.findIndex((item) => item.id === uid && !item.defeated);
        if (idx >= 0) {
          const u = state.units[idx]!;
          spawnFloatingText(state, dom, u.x, u.y, action.calloutText ?? 'DEPARTED', '#a8d8ff', 950);
          state.trackedEnemyIds.delete(u.id);
          state.defeatIfUnitIdsFall = state.defeatIfUnitIdsFall.filter((id) => id !== u.id);
          state.units.splice(idx, 1);
        }
      }
      recomputeDangerArea(ctx);
      updateBattleInfoStrip(ctx);
      ctx.renderNow();
    } else if (action.type === 'recruit_choice') {
      const chosen = await presentTalkChoiceModalAsync(
        ctx,
        action.promptTitle,
        action.promptSubtitle,
        action.options
      );
      if (!chosen) return { aborted: true };
      const nested = await executeEventActionsAsync(ctx, eventId, chosen.actions, runGen);
      if (nested.aborted) return nested;
    } else if (action.type === 'set_tiles') {
      for (const t of action.tiles) {
        if (!isInMapBounds(state.map, t.x, t.y)) continue;
        const prev = state.map.tiles[t.y]![t.x]!;
        const fallback = DEFAULT_TERRAIN_PALETTE[t.terrainType];
        state.map.tiles[t.y]![t.x] = {
          terrainType: t.terrainType,
          tilesetId: t.tilesetId ?? prev.tilesetId ?? fallback.tilesetId,
          chunkIndex: t.chunkIndex ?? fallback.chunkIndex,
        };
      }
      await preloadMapTilesets(state);
      recomputeDangerArea(ctx);
      updateBattleInfoStrip(ctx);
      ctx.renderNow();
    } else if (action.type === 'set_objective') {
      state.objectiveType = action.objectiveType;
      state.objectiveLabel =
        action.objectiveLabel ||
        resolveDefaultObjectiveLabel(action.objectiveType, action.surviveTurns);
      if (action.surviveTurns !== undefined) state.surviveTurns = action.surviveTurns;
      if (action.defeatIfUnitIdsFall !== undefined) {
        state.defeatIfUnitIdsFall = [...action.defeatIfUnitIdsFall];
      }
      showPhaseBanner(state, dom, state.objectiveLabel);
      updateBattleInfoStrip(ctx);
      ctx.renderNow();
    } else if (action.type === 'grant_items') {
      if (action.items) {
        for (const entry of action.items) {
          if (entry.quantity > 0) state.eventBonusItems.push({ ...entry });
        }
      }
      if (action.gold && action.gold > 0) state.eventBonusGold += action.gold;
      if (action.bannerText) showPhaseBanner(state, dom, action.bannerText);
    } else if (action.type === 'unlock_kecleon_shop') {
      state.pendingShopUnlocks.push({ nodeId: action.nodeId, shopType: action.shopType });
    } else if (action.type === 'recruit_post_battle') {
      state.pendingPostBattleRecruits.push({
        speciesId: action.speciesId,
        level: action.level,
        nickname: action.nickname,
        scaleStatsToLevel: action.scaleStatsToLevel,
      });
      if (action.bannerText) showPhaseBanner(state, dom, action.bannerText);
    }
  }
  return { aborted: false };
}
