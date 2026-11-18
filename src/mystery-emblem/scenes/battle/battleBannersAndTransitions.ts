/**
 * Opening Objective Card, Phase Transitions, Toast Banner & Timing Helpers
 */

import { PMD_TILE_NATIVE_PX } from '../../assets/tilesetLoader';
import { clampDungeonCameraPosition } from '../../ui/gridViewportMath';
import type { BattleDomRefs } from './battleDomShell';
import { runTurnStartEvents } from './battleEventRunner';
import { triggerTurn1BattleTutorials } from './battleTutorialIntegration';
import type { BattleControllerContext, BattleRuntimeState } from './battleTypesAndState';

export function waitBattleMs(_state: BattleRuntimeState, normalMs: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, normalMs);
  });
}

export function ensureTilePairVisible(
  state: BattleRuntimeState,
  ax: number,
  ay: number,
  bx: number,
  by: number
): void {
  const midWorldX = ((ax + bx) / 2) * PMD_TILE_NATIVE_PX + PMD_TILE_NATIVE_PX / 2;
  const midWorldY = ((ay + by) / 2) * PMD_TILE_NATIVE_PX + PMD_TILE_NATIVE_PX / 2;
  const margin = 36;
  const { cameraX, cameraY, bufferWidth, bufferHeight } = state.cam;
  if (
    midWorldX < cameraX + margin ||
    midWorldX > cameraX + bufferWidth - margin ||
    midWorldY < cameraY + margin ||
    midWorldY > cameraY + bufferHeight - margin
  ) {
    clampDungeonCameraPosition(
      state.cam,
      state.map.width,
      state.map.height,
      midWorldX - bufferWidth / 2,
      midWorldY - bufferHeight / 2
    );
  }
}

export function dismissBeginBattleCard(state: BattleRuntimeState, dom: BattleDomRefs): void {
  if (state.beginBattleTimer !== null) {
    window.clearTimeout(state.beginBattleTimer);
    state.beginBattleTimer = null;
  }
  dom.beginBattleBackdropEl.hidden = true;
  if (state.beginBattleResolver) {
    const resolve = state.beginBattleResolver;
    state.beginBattleResolver = null;
    resolve();
  }
}

export function isPhaseTransitionPlaying(state: BattleRuntimeState): boolean {
  return state.phaseTransitionResolver !== null || state.phaseTransitionTimer !== null;
}

export function cancelPhaseTransitionAnimation(
  state: BattleRuntimeState,
  dom: BattleDomRefs
): void {
  if (state.phaseTransitionTimer !== null) {
    window.clearTimeout(state.phaseTransitionTimer);
    state.phaseTransitionTimer = null;
  }
  dom.phaseTransitionEl.hidden = true;
  dom.phaseTransitionEl.classList.remove('is-animating');
  if (state.phaseTransitionResolver) {
    const resolve = state.phaseTransitionResolver;
    state.phaseTransitionResolver = null;
    resolve();
  }
}

export function clearOpeningAndPhaseAnimations(
  state: BattleRuntimeState,
  dom: BattleDomRefs
): void {
  dismissBeginBattleCard(state, dom);
  cancelPhaseTransitionAnimation(state, dom);
}

export function presentBeginBattleCardAsync(
  ctx: BattleControllerContext,
  runGen: number
): Promise<void> {
  const { state, dom, audioManager } = ctx;
  dismissBeginBattleCard(state, dom);
  if (!state.openState || runGen !== state.battleRunGen || state.phase !== 'player_phase') {
    return Promise.resolve();
  }

  dom.beginBattleObjectiveEl.textContent = state.objectiveLabel;
  dom.beginBattleBackdropEl.hidden = false;
  audioManager.playSfx('select');

  return new Promise<void>((resolve) => {
    state.beginBattleResolver = resolve;
    state.beginBattleTimer = window.setTimeout(() => {
      if (state.beginBattleResolver === resolve) {
        dismissBeginBattleCard(state, dom);
      }
    }, 1300);
  });
}

export function playPhaseTransitionAsync(
  state: BattleRuntimeState,
  dom: BattleDomRefs,
  faction: 'player' | 'ally' | 'enemy',
  runGen = state.battleRunGen
): Promise<void> {
  cancelPhaseTransitionAnimation(state, dom);
  if (!state.openState || runGen !== state.battleRunGen) {
    return Promise.resolve();
  }

  const durationMs = 1150;
  dom.phaseTransitionTitleEl.textContent =
    faction === 'enemy' ? 'ENEMY PHASE' : faction === 'ally' ? 'ALLY PHASE' : 'PLAYER PHASE';
  dom.phaseTransitionEl.style.setProperty('--pmd-phase-dur', `${durationMs}ms`);
  dom.phaseTransitionEl.className = `pmd-phase-cine-overlay ${
    faction === 'enemy' ? 'is-enemy' : faction === 'ally' ? 'is-ally' : 'is-player'
  }`;
  dom.phaseTransitionEl.dataset.phaseFaction = faction;
  dom.phaseTransitionEl.hidden = false;
  void dom.phaseTransitionEl.offsetWidth;
  dom.phaseTransitionEl.classList.add('is-animating');

  return new Promise<void>((resolve) => {
    state.phaseTransitionResolver = resolve;
    state.phaseTransitionTimer = window.setTimeout(() => {
      state.phaseTransitionTimer = null;
      dom.phaseTransitionEl.hidden = true;
      dom.phaseTransitionEl.classList.remove('is-animating');
      const done = state.phaseTransitionResolver;
      state.phaseTransitionResolver = null;
      done?.();
    }, durationMs);
  });
}

export async function playBattleOpeningSequence(
  ctx: BattleControllerContext,
  runGen: number
): Promise<void> {
  const { state, dom, audioManager } = ctx;
  await presentBeginBattleCardAsync(ctx, runGen);
  if (!state.openState || runGen !== state.battleRunGen || state.phase !== 'player_phase') {
    return;
  }
  audioManager.playSfx('phase_change');
  await playPhaseTransitionAsync(state, dom, 'player', runGen);
  if (!state.openState || runGen !== state.battleRunGen || state.phase !== 'player_phase') {
    return;
  }
  await runTurnStartEvents(ctx, 1, 'player_phase', runGen);
  if (!state.openState || runGen !== state.battleRunGen || state.phase !== 'player_phase') {
    return;
  }
  await triggerTurn1BattleTutorials(ctx, runGen);
}

export function showPhaseBanner(
  state: BattleRuntimeState,
  dom: BattleDomRefs,
  text: string
): void {
  if (state.phaseBannerTimer !== null) {
    window.clearTimeout(state.phaseBannerTimer);
  }
  dom.phaseBannerEl.textContent = text;
  dom.phaseBannerEl.hidden = false;
  state.phaseBannerTimer = window.setTimeout(() => {
    dom.phaseBannerEl.hidden = true;
    state.phaseBannerTimer = null;
  }, 1100);
}
