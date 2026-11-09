/**
 * Strike-by-Strike Animated Combat Exchange, Item Drop & EXP Award Sequencer
 */

import { directionFromDelta } from '../../assets/pmdAssetLoader';
import { PMD_TILE_NATIVE_PX } from '../../assets/tilesetLoader';
import { getItemById } from '../../data/index';
import {
  resolveCombatExchange,
  type BattleUnitState,
  type CombatForecast,
} from '../../engine/combatEngine';
import { computeCombatExpGain } from '../../engine/progressionEngine';
import { ensureTilePairVisible, waitBattleMs } from './battleBannersAndTransitions';
import { spawnFloatingText } from './battleFloatingCallouts';
import { updateBattleInfoStrip } from './battleHudCards';
import { grantExpAndHandleLevelUps } from './battleLevelUpModal';
import type { BattleControllerContext } from './battleTypesAndState';

export async function playCombatExchangeAsync(
  ctx: BattleControllerContext,
  attacker: BattleUnitState,
  defender: BattleUnitState,
  forecast: CombatForecast,
  runGen = ctx.state.battleRunGen
): Promise<void> {
  const { state, dom, audioManager } = ctx;
  const rng = state.customRng ?? Math.random;
  const outcome = resolveCombatExchange(forecast, attacker, defender, rng);

  ensureTilePairVisible(state, attacker.x, attacker.y, defender.x, defender.y);

  for (const strike of outcome.strikes) {
    if (!state.openState || runGen !== state.battleRunGen) return;

    const actor = strike.actorId === attacker.id ? attacker : defender;
    const target = strike.targetId === attacker.id ? attacker : defender;
    if (actor.defeated || target.defeated) break;

    actor.direction = directionFromDelta(target.x - actor.x, target.y - actor.y);
    target.direction = directionFromDelta(actor.x - target.x, actor.y - target.y);

    const actorMoveSlot = actor.activeMoves.find((s) => s.id === strike.move.id);
    if (actorMoveSlot) {
      actorMoveSlot.ppRemaining = strike.actorPpAfter;
    }

    if (strike.paralyzedSkip) {
      audioManager.playSfx('cancel');
      spawnFloatingText(state, dom, actor.x, actor.y, 'PARALYZED!', '#f8d048');
      await waitBattleMs(state, 340);
      continue;
    }

    const isPhysical = strike.move.category === 'Physical';
    actor.action = isPhysical ? 'Attack' : 'Special';
    actor.frameIndex = 0;
    actor.nextFrameAt = performance.now() + 70;

    const dxNorm = Math.sign(target.x - actor.x);
    const dyNorm = Math.sign(target.y - actor.y);

    if (isPhysical) {
      actor.renderWorldX = actor.x * PMD_TILE_NATIVE_PX + dxNorm * 6;
      actor.renderWorldY = actor.y * PMD_TILE_NATIVE_PX + dyNorm * 6;
      state.activeStrikeVfx = {
        kind: 'melee',
        fromWorldX: actor.x * PMD_TILE_NATIVE_PX + 12,
        fromWorldY: actor.y * PMD_TILE_NATIVE_PX + 12,
        toWorldX: target.x * PMD_TILE_NATIVE_PX + 12,
        toWorldY: target.y * PMD_TILE_NATIVE_PX + 12,
        color: strike.isCrit ? '#f8d048' : '#ffffff',
        startedAtMs: performance.now(),
        durationMs: state.fastMode ? 45 : 220,
      };
      await waitBattleMs(state, 190);
    } else {
      state.activeStrikeVfx = {
        kind: 'ranged',
        fromWorldX: actor.x * PMD_TILE_NATIVE_PX + 12,
        fromWorldY: actor.y * PMD_TILE_NATIVE_PX + 12,
        toWorldX: target.x * PMD_TILE_NATIVE_PX + 12,
        toWorldY: target.y * PMD_TILE_NATIVE_PX + 12,
        color: strike.isCrit ? '#f8d048' : '#68e0ff',
        startedAtMs: performance.now(),
        durationMs: state.fastMode ? 55 : 260,
      };
      await waitBattleMs(state, 240);
    }

    if (!state.openState || runGen !== state.battleRunGen) return;

    actor.renderWorldX = actor.x * PMD_TILE_NATIVE_PX;
    actor.renderWorldY = actor.y * PMD_TILE_NATIVE_PX;

    if (!strike.didHit) {
      audioManager.playSfx('attack_miss');
      target.renderWorldX = target.x * PMD_TILE_NATIVE_PX + (dyNorm !== 0 ? 4 : 0);
      target.renderWorldY = target.y * PMD_TILE_NATIVE_PX + (dxNorm !== 0 ? -3 : 0);
      spawnFloatingText(state, dom, target.x, target.y, 'MISS', '#90d8f8');
      await waitBattleMs(state, 260);
      target.renderWorldX = target.x * PMD_TILE_NATIVE_PX;
      target.renderWorldY = target.y * PMD_TILE_NATIVE_PX;
      actor.action = 'Idle';
      continue;
    }

    target.currentHp = strike.targetHpAfter;
    target.action = 'Hurt';
    target.frameIndex = 0;
    target.hitFlashUntilMs = performance.now() + (state.fastMode ? 60 : 230);

    state.activeStrikeVfx = {
      kind: 'impact_burst',
      fromWorldX: target.x * PMD_TILE_NATIVE_PX + 12,
      fromWorldY: target.y * PMD_TILE_NATIVE_PX + 12,
      toWorldX: target.x * PMD_TILE_NATIVE_PX + 12,
      toWorldY: target.y * PMD_TILE_NATIVE_PX + 12,
      color: strike.isCrit ? '#f8d048' : '#ff6878',
      startedAtMs: performance.now(),
      durationMs: state.fastMode ? 50 : 210,
    };

    if (strike.typeMultiplier === 0) {
      audioManager.playSfx('attack_miss');
      spawnFloatingText(state, dom, target.x, target.y, 'IMMUNE (0)', '#c8d4e8');
    } else if (strike.isCrit) {
      audioManager.playSfx('critical_hit');
      spawnFloatingText(state, dom, target.x, target.y, `CRIT! -${strike.damageDealt}`, '#f8d048');
    } else {
      audioManager.playSfx('attack_hit');
      spawnFloatingText(state, dom, target.x, target.y, `-${strike.damageDealt}`, '#ff7888');
    }

    updateBattleInfoStrip(ctx);
    await waitBattleMs(state, 310);
    if (!state.openState || runGen !== state.battleRunGen) return;

    actor.action = 'Idle';
    state.activeStrikeVfx = null;

    if (strike.targetDefeated) {
      audioManager.playSfx('unit_ko');
      spawnFloatingText(state, dom, target.x, target.y, 'DEFEATED!', '#ffb060', 950);
      if (target.faction === 'enemy' && target.droppableItemId) {
        const dropId = target.droppableItemId;
        target.droppableItemId = null;
        state.collectedDrops.push(dropId);
        const dropDef = getItemById(dropId);
        const dropName = dropDef?.name ?? dropId;
        audioManager.playSfx('heal');
        spawnFloatingText(
          state,
          dom,
          target.x,
          Math.max(0, target.y - 1),
          `Got ${dropName}!`,
          '#ffd860',
          1200
        );
      }
      const koSteps = 6;
      for (let s = 1; s <= koSteps; s++) {
        if (!state.openState || runGen !== state.battleRunGen) return;
        target.koDissolveProgress = s / koSteps;
        await waitBattleMs(state, 55);
      }
      target.defeated = true;
      state.trackedEnemyIds.delete(target.id);
      break;
    } else {
      target.action = 'Idle';
    }
  }

  state.activeStrikeVfx = null;

  const playerUnit =
    attacker.faction === 'player' ? attacker : defender.faction === 'player' ? defender : null;
  const enemyUnit =
    attacker.faction === 'enemy' ? attacker : defender.faction === 'enemy' ? defender : null;

  if (
    playerUnit &&
    enemyUnit &&
    !playerUnit.defeated &&
    playerUnit.currentHp > 0 &&
    outcome.strikes.some((s) => s.actorId === playerUnit.id)
  ) {
    const playerStrikes = outcome.strikes.filter((s) => s.actorId === playerUnit.id);
    const landedHit = playerStrikes.some((s) => s.didHit);
    const dealtDamage = playerStrikes.some((s) => s.didHit && s.damageDealt > 0);
    const defeatedEnemy = enemyUnit.defeated || enemyUnit.currentHp <= 0;
    const expGain = computeCombatExpGain({
      playerLevel: playerUnit.level,
      enemyLevel: enemyUnit.level,
      landedHit,
      dealtDamage,
      defeatedEnemy,
    });
    await grantExpAndHandleLevelUps(ctx, playerUnit, expGain, runGen);
  }
}
