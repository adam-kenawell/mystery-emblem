/**
 * Declarative Dungeon Event Action Executor (`battleEventActions.ts`)
 *
 * Executes `DungeonEventAction[]` (`show_banner`, `play_dialogue`, `spawn_units`,
 * `convert_unit`, `despawn_units`, `recruit_choice`, `set_tiles`, `set_objective`,
 * `grant_items`, `unlock_kecleon_shop`, `recruit_post_battle`, `move_unit`,
 * `rest_player_units`, `give_unit_item`, `scripted_attack`, `win_battle`).
 */

import { directionFromDelta, loadSpeciesSpriteBundle } from '../../assets/pmdAssetLoader';
import { PMD_TILE_NATIVE_PX } from '../../assets/tilesetLoader';
import { DEFAULT_TERRAIN_PALETTE } from '../../data/chapterMapRegistry';
import { getItemById, getMoveById } from '../../data/index';
import { resolveDefaultObjectiveLabel } from '../../engine/battleEvents';
import {
  buildSpawnedBattleUnit,
  findNearestFreeSpawnTile,
} from '../../engine/battleSpawnHelpers';
import {
  STATUS_ACTION_CALLOUTS,
  STATUS_BADGE_COLORS,
  applyInflictedStatusToUnit,
  computeCombatForecast,
  type BattleUnitState,
} from '../../engine/combatEngine';
import { interpolateCampaignText } from '../../engine/speakerResolver';
import { coordKey, findShortestPathAStar, isInMapBounds } from '../../engine/terrainAndPathfinding';
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
import { triggerVictoryModal } from './battleOutcomeModals';
import { preloadMapTilesets } from './battlePrepAndAssets';
import { presentTalkChoiceModalAsync } from './battleTalkChoiceModal';
import type { BattleControllerContext, BattleRuntimeState } from './battleTypesAndState';
import { getTutorialHealerUnit, getTutorialPartnerUnit } from './battleTutorialSpotlights';
import { playWalkPathAsync } from './battleWalkAndHealAnimator';
import {
  getLivingUnits,
  getLordUnit,
  getUnitVisualKey,
  recomputeSelectedUnitRange,
} from './battleUnitQueries';

const FACE_DELTAS: Record<'left' | 'right' | 'up' | 'down', [number, number]> = {
  left: [-1, 0],
  right: [1, 0],
  up: [0, -1],
  down: [0, 1],
};

function resolveEventTargetUnit(
  state: BattleRuntimeState,
  targetRef: string
): BattleUnitState | undefined {
  if (targetRef === 'lord' || targetRef === '{lord}') return getLordUnit(state);
  if (targetRef === 'partner' || targetRef === '{partner}') return getTutorialPartnerUnit(state);
  if (targetRef === 'healer' || targetRef === '{healer}') return getTutorialHealerUnit(state);
  return getLivingUnits(state).find(
    (u) => u.id === targetRef || u.speciesId === targetRef
  );
}

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
        ctx.renderNow();
        await waitBattleMs(state, 220);
      }
      if (action.bannerText) showPhaseBanner(state, dom, action.bannerText);
      if (state.selectedUnitId) recomputeSelectedUnitRange(state);
      recomputeDangerArea(ctx);
      updateBattleInfoStrip(ctx);
    } else if (action.type === 'convert_unit') {
      const target = resolveEventTargetUnit(state, action.targetUnitId);
      if (target) {
        target.faction = action.toFaction;
        target.sparring = false;
        state.trackedEnemyIds.delete(target.id);
        if (state.lastComputedHoverEnemyId === target.id) state.lastComputedHoverEnemyId = null;
        if (state.suppressedHoverEnemyId === target.id) state.suppressedHoverEnemyId = null;
        if (action.healToFull) {
          target.currentHp = target.maxHp;
          target.status = null;
          target.statusTurns = 0;
        }
        if (action.toFaction === 'player') {
          target.isBoss = false;
          target.stationary = false;
          target.aiMode = 'wait_until_in_range';
          target.waited = !(action.readyToAct ?? true);
          if (action.addToPermanentRoster !== false) target.recruitedMidBattle = true;
        } else if (action.toFaction === 'npc') {
          target.isBoss = false;
          if (!target.stationary && target.aiMode === 'stationary') {
            target.aiMode = 'wait_until_in_range';
          }
          target.waited = !(action.readyToAct ?? true);
        }
        state.originRangeSnapshot = null;
        if (state.selectedUnitId) {
          recomputeSelectedUnitRange(state);
        } else {
          state.currentRange = null;
        }
        ensureTilePairVisible(state, target.x, target.y, target.x, target.y);
        audioManager.playSfx('victory_fanfare');
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
          state.trackedEnemyIds.delete(u.id);
          if (state.lastComputedHoverEnemyId === u.id) state.lastComputedHoverEnemyId = null;
          if (state.suppressedHoverEnemyId === u.id) state.suppressedHoverEnemyId = null;
          state.defeatIfUnitIdsFall = state.defeatIfUnitIdsFall.filter((id) => id !== u.id);
          state.units.splice(idx, 1);
        }
      }
      if (state.selectedUnitId) recomputeSelectedUnitRange(state);
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
      if (state.selectedUnitId) recomputeSelectedUnitRange(state);
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
    } else if (action.type === 'move_unit') {
      const mover = resolveEventTargetUnit(state, action.targetUnitId);
      if (mover) {
        const path = findShortestPathAStar(
          state.map,
          { ...mover, stationary: false, aiMode: 'aggressive', mov: 99 },
          action.x,
          action.y,
          getLivingUnits(state)
        );
        if (path && path.length > 1) {
          ensureTilePairVisible(state, mover.x, mover.y, action.x, action.y);
          await playWalkPathAsync(state, mover, path, true);
          if (!state.openState || runGen !== state.battleRunGen) return { aborted: true };
          if (state.selectedUnitId) recomputeSelectedUnitRange(state);
          recomputeDangerArea(ctx);
          updateBattleInfoStrip(ctx);
          ctx.renderNow();
        }
        if (action.face) {
          const [fdx, fdy] = FACE_DELTAS[action.face];
          mover.direction = directionFromDelta(fdx, fdy);
          ctx.renderNow();
        }
      }
    } else if (action.type === 'rest_player_units') {
      const keepHealerId = action.exceptHealer ? getTutorialHealerUnit(state)?.id : undefined;
      const keepPartnerId = action.exceptPartner ? getTutorialPartnerUnit(state)?.id : undefined;
      for (const u of getLivingUnits(state)) {
        if (
          u.faction !== 'player' ||
          (action.exceptLord && u.isLord) ||
          u.id === keepHealerId ||
          u.id === keepPartnerId
        ) {
          continue;
        }
        u.waited = true;
        u.action = 'Idle';
      }
      ctx.renderNow();
    } else if (action.type === 'give_unit_item') {
      const recipient = resolveEventTargetUnit(state, action.targetUnitId);
      const itemDef = getItemById(action.itemId);
      if (recipient && itemDef) {
        if (itemDef.category === 'held_berry' || itemDef.category === 'held_gear') {
          if (recipient.heldItemId) {
            state.eventBonusItems.push({ itemId: recipient.heldItemId, quantity: 1 });
          }
          recipient.heldItemId = itemDef.id;
        } else {
          if (recipient.consumableItemId) {
            state.eventBonusItems.push({ itemId: recipient.consumableItemId, quantity: 1 });
          }
          recipient.consumableItemId = itemDef.id;
        }
        ensureTilePairVisible(state, recipient.x, recipient.y, recipient.x, recipient.y);
        audioManager.playSfx('heal');
        updateBattleInfoStrip(ctx);
        ctx.renderNow();
        await waitBattleMs(state, 220);
      }
    } else if (action.type === 'scripted_attack') {
      const actor = resolveEventTargetUnit(state, action.attackerUnitId);
      const target = resolveEventTargetUnit(state, action.targetUnitId);
      const mv = getMoveById(action.moveId);
      if (actor && target && mv) {
        if (action.destX !== undefined && action.destY !== undefined) {
          const path = findShortestPathAStar(
            state.map,
            { ...actor, stationary: false, aiMode: 'aggressive', mov: 99 },
            action.destX,
            action.destY,
            getLivingUnits(state)
          );
          if (path && path.length > 1) {
            ensureTilePairVisible(state, actor.x, actor.y, action.destX, action.destY);
            await playWalkPathAsync(state, actor, path, true);
            if (!state.openState || runGen !== state.battleRunGen) return { aborted: true };
          }
        }
        ensureTilePairVisible(state, actor.x, actor.y, target.x, target.y);
        actor.direction = directionFromDelta(target.x - actor.x, target.y - actor.y);
        target.direction = directionFromDelta(actor.x - target.x, actor.y - target.y);

        const forecast = computeCombatForecast(state.map, actor, target, mv.id);
        const rawDamage = forecast ? Math.max(1, forecast.attackerSide.damage) : Math.max(1, mv.mt);
        const dealt = Math.min(Math.max(0, target.currentHp - 1), rawDamage);
        const isPhysical = mv.category === 'Physical';
        const dxNorm = Math.sign(target.x - actor.x);
        const dyNorm = Math.sign(target.y - actor.y);

        actor.action = isPhysical ? 'Attack' : 'Special';
        actor.frameIndex = 0;
        if (isPhysical) {
          actor.renderWorldX = actor.x * PMD_TILE_NATIVE_PX + dxNorm * 6;
          actor.renderWorldY = actor.y * PMD_TILE_NATIVE_PX + dyNorm * 6;
        }
        state.activeStrikeVfx = {
          kind: isPhysical ? 'melee' : 'ranged',
          fromWorldX: actor.x * PMD_TILE_NATIVE_PX + 12,
          fromWorldY: actor.y * PMD_TILE_NATIVE_PX + 12,
          toWorldX: target.x * PMD_TILE_NATIVE_PX + 12,
          toWorldY: target.y * PMD_TILE_NATIVE_PX + 12,
          color: '#f8d048',
          startedAtMs: performance.now(),
          durationMs: state.fastMode ? 45 : 220,
        };
        await waitBattleMs(state, 200);
        if (!state.openState || runGen !== state.battleRunGen) return { aborted: true };

        actor.renderWorldX = actor.x * PMD_TILE_NATIVE_PX;
        actor.renderWorldY = actor.y * PMD_TILE_NATIVE_PX;
        target.currentHp = Math.max(1, target.currentHp - dealt);
        target.action = 'Hurt';
        target.hitFlashUntilMs = performance.now() + (state.fastMode ? 60 : 230);
        audioManager.playSfx('attack_hit');
        spawnFloatingText(state, dom, target.x, target.y, `-${dealt}`, '#ff7888', 950);
        updateBattleInfoStrip(ctx);
        ctx.renderNow();
        await waitBattleMs(state, 280);
        if (!state.openState || runGen !== state.battleRunGen) return { aborted: true };

        actor.action = 'Idle';
        target.action = 'Idle';
        state.activeStrikeVfx = null;

        if (mv.secondaryEffect?.status) {
          const st = mv.secondaryEffect.status;
          applyInflictedStatusToUnit(target, st);
          spawnFloatingText(
            state,
            dom,
            target.x,
            Math.max(0, target.y - 1),
            STATUS_ACTION_CALLOUTS[st],
            STATUS_BADGE_COLORS[st],
            950
          );
        }
        recomputeDangerArea(ctx);
        updateBattleInfoStrip(ctx);
        ctx.renderNow();
        await waitBattleMs(state, 220);
      }
    } else if (action.type === 'win_battle') {
      triggerVictoryModal(ctx);
      return { aborted: true };
    }
  }
  return { aborted: false };
}
