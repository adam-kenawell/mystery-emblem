/**
 * Match End Checks, Victory Spoils Commit (`commitBattleResults`), Event Joins & Defeat Modal
 */

import { getSpeciesById } from '../../data/index';
import { DEMO_OVERWORLD_GRAPH } from '../../data/overworldMapData';
import { createMiniItemIcon } from '../../ui/PmdItemIconGrid';
import { clearOpeningAndPhaseAnimations } from './battleBannersAndTransitions';
import {
  clearBattleSelection,
  syncHudControls,
  syncPrepChromeVisibility,
} from './battleDangerAndViewportState';
import { applyBattleVictoryEventsSync } from './battleEventRunner';
import type { BattleControllerContext, BattleRuntimeState } from './battleTypesAndState';
import { getLivingEnemies, getLordUnit, isLordDefeated } from './battleUnitQueries';

function hasFutureEnemySpawns(state: BattleRuntimeState): boolean {
  const futureWaves = state.reinforcements.some(
    (w) =>
      w.turnNumber > state.turnNumber &&
      !state.spawnedReinforcementIds.has(w.id) &&
      !state.blockedReinforcementIds.has(w.id)
  );
  if (futureWaves) return true;
  return state.events.some(
    (ev) =>
      ev.trigger.type === 'turn_start' &&
      ev.trigger.turnNumber > state.turnNumber &&
      !state.triggeredEventIds.has(ev.id) &&
      !(ev.conditions ?? []).some(
        (c) => c.kind === 'event_triggered' && c.negated && state.triggeredEventIds.has(c.eventId)
      ) &&
      ev.actions.some((a) => a.type === 'spawn_units' && a.faction === 'enemy')
  );
}

export function checkAndTriggerMatchEnd(ctx: BattleControllerContext): boolean {
  const { state } = ctx;
  if (isLordDefeated(state)) {
    state.defeatReasonText = null;
    triggerDefeatModal(ctx);
    return true;
  }
  const fallenProtected = state.units.find(
    (u) =>
      (u.defeated || u.currentHp <= 0) &&
      (Boolean(u.mustSurvive) || state.defeatIfUnitIdsFall.includes(u.id))
  );
  if (fallenProtected) {
    state.defeatReasonText = `${fallenProtected.nickname} fell on Turn ${state.turnNumber}.`;
    triggerDefeatModal(ctx);
    return true;
  }

  const livingEnemies = getLivingEnemies(state);
  if (state.objectiveType === 'defeat_boss') {
    const hasAnyBossConfigured = state.units.some((u) => u.faction === 'enemy' && u.isBoss);
    const livingBosses = livingEnemies.filter((u) => u.isBoss);
    if (livingEnemies.length === 0 || (hasAnyBossConfigured && livingBosses.length === 0)) {
      triggerVictoryModal(ctx);
      return true;
    }
    return false;
  }

  if (state.objectiveType === 'survive_turns') {
    const hasAnyBossConfigured = state.units.some((u) => u.faction === 'enemy' && u.isBoss);
    const livingBosses = livingEnemies.filter((u) => u.isBoss);
    if ((hasAnyBossConfigured && livingBosses.length === 0) || (livingEnemies.length === 0 && !hasFutureEnemySpawns(state))) {
      triggerVictoryModal(ctx);
      return true;
    }
    return false;
  }

  if (livingEnemies.length === 0) {
    triggerVictoryModal(ctx);
    return true;
  }
  return false;
}

function tryRecruitEligibleSpeciesToSave(
  ctx: BattleControllerContext,
  opts: { speciesId: string; level: number; nickname?: string; scaleStatsToLevel?: boolean }
): string | null {
  const { saveManager } = ctx;
  const sp = getSpeciesById(opts.speciesId);
  if (!sp || sp.faction === 'enemy' || sp.faction === 'ally_npc') return null;
  const alreadyOwned = saveManager.getSave()?.roster.some((owned) => {
    return getSpeciesById(owned.speciesId)?.lineId === sp.lineId;
  });
  if (alreadyOwned) return null;
  const created = saveManager.recruitPokemon({
    speciesId: sp.id,
    nickname: opts.nickname,
    level: opts.level,
    scaleStatsToLevel: opts.scaleStatsToLevel ?? true,
  });
  return created.instanceId;
}

export function triggerVictoryModal(ctx: BattleControllerContext): void {
  const { state, dom, prepOverlay, saveManager } = ctx;
  clearOpeningAndPhaseAnimations(state, dom);
  clearBattleSelection(state, dom, prepOverlay);
  state.phase = 'victory';
  state.interactionState = 'idle';
  dom.phaseBannerEl.hidden = true;
  syncPrepChromeVisibility(state, dom, prepOverlay);

  const victoryScripts = applyBattleVictoryEventsSync(ctx);

  if (!state.victoryCallbackFired) {
    state.victoryCallbackFired = true;
    const canCommitSave = state.commitToSaveOnVictory && saveManager.getSave() !== null;
    if (canCommitSave) {
      for (const u of state.units) {
        if (
          u.faction === 'player' &&
          !u.rosterInstanceId &&
          u.recruitedMidBattle &&
          !u.defeated &&
          u.currentHp > 0
        ) {
          const createdId = tryRecruitEligibleSpeciesToSave(ctx, {
            speciesId: u.speciesId,
            level: u.level,
            nickname: u.nickname,
            scaleStatsToLevel: true,
          });
          if (createdId) u.rosterInstanceId = createdId;
        }
      }

      const deployedSync = state.units
        .filter((u) => u.faction === 'player' && u.rosterInstanceId)
        .map((u) => ({
          instanceId: u.rosterInstanceId!,
          speciesId: u.speciesId,
          cosmeticForm: u.cosmeticForm,
          nickname: u.nickname,
          level: u.level,
          exp: u.exp ?? 0,
          currentStats: { ...u.stats },
          unlockedMoveIds: [...(u.unlockedMoveIds ?? u.activeMoves.map((m) => m.id))],
          activeMoveIds: u.activeMoves.map((m) => m.id),
          equippedPhysicalMoveId: u.equippedPhysicalMoveId,
          equippedSpecialMoveId: u.equippedSpecialMoveId,
          heldItemId: u.heldItemId,
          consumableItemId: u.consumableItemId,
        }));
      saveManager.commitBattleResults({
        deployedUnits: deployedSync,
        droppedItemIds: state.collectedDrops,
        clearRewardItems: [...state.clearRewardItems, ...state.eventBonusItems],
        bonusGold: state.eventBonusGold,
      });

      for (const rec of state.pendingPostBattleRecruits) {
        tryRecruitEligibleSpeciesToSave(ctx, rec);
      }
    }

    state.currentOnVictory?.();

    if (canCommitSave && state.pendingShopUnlocks.length > 0) {
      for (const unlock of state.pendingShopUnlocks) {
        try {
          saveManager.spawnOverworldKecleonShop(
            unlock.nodeId,
            unlock.shopType,
            Math.random,
            DEMO_OVERWORLD_GRAPH
          );
        } catch {
          // Ignore if target node is locked or absent in standalone test maps
        }
      }
    }
  }

  const subEl = dom.victoryModalBackdropEl.querySelector('[data-victory-sub]');
  const summaryEl = dom.victoryModalBackdropEl.querySelector<HTMLElement>('[data-victory-summary]');
  if (subEl) subEl.textContent = `${state.map.name} · Turn ${state.turnNumber}`;
  if (summaryEl) {
    const qtyByItemId = new Map<string, number>();
    for (const dropId of state.collectedDrops) {
      qtyByItemId.set(dropId, (qtyByItemId.get(dropId) ?? 0) + 1);
    }
    for (const rew of [...state.clearRewardItems, ...state.eventBonusItems]) {
      if (rew.quantity > 0) {
        qtyByItemId.set(rew.itemId, (qtyByItemId.get(rew.itemId) ?? 0) + rew.quantity);
      }
    }
    summaryEl.innerHTML = '';
    if (qtyByItemId.size > 0) {
      const row = document.createElement('span');
      row.className = 'pmd-inline-item-row';
      const lbl = document.createElement('span');
      lbl.textContent = 'Acquired:';
      row.appendChild(lbl);
      for (const [itemId, qty] of qtyByItemId.entries()) {
        row.appendChild(
          createMiniItemIcon(itemId, { sizePx: 22, quantityBadge: qty > 1 ? qty : undefined })
        );
      }
      summaryEl.appendChild(row);
      summaryEl.hidden = false;
    } else {
      summaryEl.hidden = true;
    }
  }

  const runGen = state.battleRunGen;
  const beforeModalHook = state.currentOnBeforeVictoryModal;
  state.currentOnBeforeVictoryModal = undefined;
  const hasVictoryDialogue = victoryScripts.length > 0 && Boolean(ctx.dialogueOverlay);
  if (hasVictoryDialogue || beforeModalHook) {
    state.cutsceneInProgress = true;
    syncHudControls(state, dom);
    ctx.onLayerStateChanged();
    ctx.renderNow();
    void (async () => {
      try {
        if (ctx.dialogueOverlay) {
          for (const script of victoryScripts) {
            if (!state.openState || runGen !== state.battleRunGen) return;
            await ctx.dialogueOverlay.playScript(script);
          }
        }
        if (beforeModalHook) await beforeModalHook();
      } finally {
        if (state.openState && runGen === state.battleRunGen) state.cutsceneInProgress = false;
      }
      if (!state.openState || runGen !== state.battleRunGen || state.phase !== 'victory') return;
      showVictoryModalCard(ctx);
    })();
    return;
  }

  showVictoryModalCard(ctx);
}

export function showVictoryModalCard(ctx: BattleControllerContext): void {
  const { state, dom, audioManager } = ctx;
  dom.victoryModalBackdropEl.hidden = false;
  audioManager.playSfx('victory_fanfare');
  audioManager.playBgm('job_clear', { fadeMs: 180, loop: false, restart: true });
  syncHudControls(state, dom);
  ctx.onLayerStateChanged();
  ctx.renderNow();
}

export function triggerDefeatModal(ctx: BattleControllerContext): void {
  const { state, dom, prepOverlay, audioManager } = ctx;
  clearOpeningAndPhaseAnimations(state, dom);
  clearBattleSelection(state, dom, prepOverlay);
  state.phase = 'defeat';
  state.interactionState = 'idle';
  dom.phaseBannerEl.hidden = true;
  syncPrepChromeVisibility(state, dom, prepOverlay);

  const lord = getLordUnit(state);
  const subEl = dom.defeatModalBackdropEl.querySelector('[data-defeat-sub]');
  const summaryEl = dom.defeatModalBackdropEl.querySelector<HTMLElement>('[data-defeat-summary]');
  if (subEl) {
    subEl.textContent =
      state.defeatReasonText ??
      `${lord ? lord.nickname : 'Squad'} fainted on Turn ${state.turnNumber}.`;
  }
  if (summaryEl) {
    summaryEl.textContent = '';
    summaryEl.hidden = true;
  }

  dom.defeatModalBackdropEl.hidden = false;
  audioManager.playSfx('game_over');
  audioManager.playBgm('oh_no', { fadeMs: 180, loop: false, restart: true });
  syncHudControls(state, dom);
  ctx.onLayerStateChanged();
  ctx.renderNow();
}
