/**
 * Step 7 Status Hex Forecast View, Cast Animator & Phase-Start Status Tick Runner
 */

import { directionFromDelta } from '../../assets/pmdAssetLoader';
import { PMD_TILE_NATIVE_PX } from '../../assets/tilesetLoader';
import { getItemById } from '../../data/index';
import {
  STATUS_ACTION_CALLOUTS,
  STATUS_BADGE_COLORS,
  STATUS_SHORT_EFFECT_TEXT,
  applyInflictedStatusToUnit,
  applyPhaseStartStatusTick,
  computeStatusMoveForecast,
  type BattleMoveSlot,
  type BattleUnitState,
  type StatusMoveForecast,
} from '../../engine/combatEngine';
import { computeSupportHealExpGain } from '../../engine/progressionEngine';
import { createMiniItemIcon } from '../../ui/PmdItemIconGrid';
import { createMiniSpeciesPortrait } from '../../ui/PmdUnitPortraitGrid';
import { bindPointerTap } from '../../ui/pointerControls';
import { ensureTilePairVisible, waitBattleMs } from './battleBannersAndTransitions';
import {
  clearBattleSelection,
  recomputeDangerArea,
  syncHudControls,
  syncPrepChromeVisibility,
} from './battleDangerAndViewportState';
import { runTileReachedEvents } from './battleEventRunner';
import { spawnFloatingText } from './battleFloatingCallouts';
import { renderForecastMoveList, setForecastStatLabels } from './battleForecastMoveList';
import { updateBattleInfoStrip } from './battleHudCards';
import { grantExpAndHandleLevelUps } from './battleLevelUpModal';
import { checkAndTriggerMatchEnd } from './battleOutcomeModals';
import { getBattleRng, type BattleControllerContext } from './battleTypesAndState';
import {
  areAllLivingPlayersWaited,
  getAttackableEnemiesFromCurrentTile,
  getSelectedUnit,
  getUnitVisualKey,
} from './battleUnitQueries';

export function renderStatusHexForecastModalDom(
  ctx: BattleControllerContext,
  caster: BattleUnitState,
  defender: BattleUnitState,
  chosenSlot: BattleMoveSlot,
  validMoves: ReadonlyArray<BattleMoveSlot>,
  onRefresh: () => void
): void {
  const { state, dom, audioManager, abortSignal } = ctx;
  const forecast = computeStatusMoveForecast(state.map, caster, defender, chosenSlot.id);
  if (!forecast) return;
  state.currentForecast = null;

  const backdrop = dom.forecastModalBackdropEl;
  const q = (sel: string) => backdrop.querySelector<HTMLElement>(sel);
  const setTxt = (sel: string, txt: string) => {
    const el = q(sel);
    if (el) el.textContent = txt;
  };

  setTxt('[data-forecast-title]', 'STATUS FORECAST');
  const defCardEl = q('[data-testid="forecast-defender-card"]');
  if (defCardEl) defCardEl.className = 'pmd-fe-enemy-box is-defender';
  const confirmBtnEl = backdrop.querySelector<HTMLButtonElement>('[data-testid="forecast-attack-btn"]');
  if (confirmBtnEl) {
    confirmBtnEl.textContent = 'Hex!';
    confirmBtnEl.disabled = Boolean(forecast.blockedReason);
  }

  renderForecastMoveList(ctx, caster, validMoves, chosenSlot.id, onRefresh);
  setForecastStatLabels(backdrop, { atk2: 'STS', atk3: 'HIT', atk4: 'RNG', def2: 'DMG', def3: 'HIT', def4: 'CRT' });

  void dom.attackerPortraitView.setPortrait({ speciesIdOrAssetId: getUnitVisualKey(caster), emotion: 'Determined', mirrorHorizontal: false });
  void dom.defenderPortraitView.setPortrait({
    speciesIdOrAssetId: getUnitVisualKey(defender),
    emotion: forecast.blockedReason ? 'Normal' : 'Worried',
    mirrorHorizontal: true,
  });

  const effBadgeEl = q('[data-testid="forecast-effectiveness-badge"]');
  if (effBadgeEl) {
    effBadgeEl.className = `pmd-forecast-eff-badge ${forecast.blockedReason ? 'is-resisted' : 'is-super'}`;
    effBadgeEl.textContent = forecast.blockedReason ?? STATUS_SHORT_EFFECT_TEXT[forecast.inflictStatus];
    effBadgeEl.hidden = false;
  }

  const allTargets = getAttackableEnemiesFromCurrentTile(state, caster);
  const targetsWrap = q('[data-forecast-targets-wrap]');
  const targetsRow = q('[data-forecast-targets]');
  if (targetsWrap && targetsRow) {
    targetsRow.innerHTML = '';
    targetsWrap.hidden = allTargets.length <= 1;
    if (allTargets.length > 1) {
      for (const entry of allTargets) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `pmd-btn pmd-chip-btn pmd-portrait-action-btn${entry.enemy.id === defender.id ? ' is-active' : ''}`;
        btn.dataset.testid = `forecast-target-${entry.enemy.id}`;
        const hpSpan = document.createElement('span');
        hpSpan.textContent = `HP ${entry.enemy.currentHp}`;
        btn.append(createMiniSpeciesPortrait(getUnitVisualKey(entry.enemy), { sizePx: 20 }), hpSpan);
        bindPointerTap(
          btn,
          () => {
            audioManager.playSfx('select');
            state.forecastTargetId = entry.enemy.id;
            caster.direction = directionFromDelta(entry.enemy.x - caster.x, entry.enemy.y - caster.y);
            onRefresh();
            ctx.renderNow();
          },
          { signal: abortSignal }
        );
        targetsRow.appendChild(btn);
      }
    }
  }

  const [rMin, rMax] = chosenSlot.range;
  setTxt('[data-testid="forecast-attacker-name"]', `${caster.nickname}`);
  setTxt('[data-testid="forecast-attacker-weapon"]', forecast.move.name);
  setTxt('[data-testid="forecast-attacker-hp"]', `${caster.currentHp} → ${caster.currentHp}`);
  setTxt('[data-testid="forecast-attacker-dmg"]', forecast.inflictStatus);
  setTxt('[data-testid="forecast-attacker-hit"]', `${forecast.hitRate}%`);
  setTxt('[data-testid="forecast-attacker-crit"]', rMin === rMax ? `R${rMin}` : `R${rMin}-${rMax}`);

  const setHpBars = (curSel: string, projSel: string, pct: string, isEnemy: boolean) => {
    const cur = q(curSel);
    const proj = q(projSel);
    if (cur) cur.style.width = pct;
    if (proj) {
      proj.className = `pmd-forecast-hp-bar-fill${isEnemy ? ' is-enemy' : ''}`;
      proj.style.width = pct;
    }
  };
  setHpBars('[data-attacker-hp-cur-bar]', '[data-attacker-hp-proj-bar]', `${Math.round((caster.currentHp / caster.maxHp) * 100)}%`, false);

  setTxt('[data-testid="forecast-defender-name"]', `${defender.nickname}${defender.isBoss ? ' [BOSS]' : ''}`);
  setTxt('[data-testid="forecast-defender-weapon"]', 'No Counter');
  setTxt('[data-testid="forecast-defender-hp"]', `${defender.currentHp} → ${defender.currentHp}`);
  setTxt('[data-testid="forecast-defender-dmg"]', '—');
  setTxt('[data-testid="forecast-defender-hit"]', '—');
  setTxt('[data-testid="forecast-defender-crit"]', '—');

  const defMetaEl = q('[data-defender-meta]');
  if (defMetaEl) {
    defMetaEl.innerHTML = '';
    if (defender.droppableItemId && getItemById(defender.droppableItemId)) {
      const dropChip = document.createElement('span');
      dropChip.className = 'pmd-hud-drop-chip';
      dropChip.dataset.testid = 'forecast-defender-drop-chip';
      const dropLbl = document.createElement('span');
      dropLbl.textContent = 'DROP';
      dropChip.append(dropLbl, createMiniItemIcon(defender.droppableItemId, { sizePx: 16, cropped: true }));
      defMetaEl.appendChild(dropChip);
      defMetaEl.hidden = false;
    } else {
      defMetaEl.hidden = true;
    }
  }
  setHpBars('[data-defender-hp-cur-bar]', '[data-defender-hp-proj-bar]', `${Math.round((defender.currentHp / defender.maxHp) * 100)}%`, true);
}

export async function playStatusHexActionAsync(
  ctx: BattleControllerContext,
  caster: BattleUnitState,
  target: BattleUnitState,
  forecast: StatusMoveForecast,
  runGen = ctx.state.battleRunGen
): Promise<boolean> {
  const { state, dom, audioManager } = ctx;
  ensureTilePairVisible(state, caster.x, caster.y, target.x, target.y);

  caster.direction = directionFromDelta(target.x - caster.x, target.y - caster.y);
  target.direction = directionFromDelta(caster.x - target.x, caster.y - target.y);
  caster.action = 'Special';
  caster.frameIndex = 0;

  const slot = caster.activeMoves.find((s) => s.id === forecast.move.id);
  if (slot) slot.ppRemaining = forecast.ppAfter;

  const fxColor = STATUS_BADGE_COLORS[forecast.inflictStatus];
  const tx = target.x * PMD_TILE_NATIVE_PX + 12;
  const ty = target.y * PMD_TILE_NATIVE_PX + 12;
  state.activeStrikeVfx = {
    kind: 'ranged',
    fromWorldX: caster.x * PMD_TILE_NATIVE_PX + 12,
    fromWorldY: caster.y * PMD_TILE_NATIVE_PX + 12,
    toWorldX: tx,
    toWorldY: ty,
    color: fxColor,
    startedAtMs: performance.now(),
    durationMs: state.fastMode ? 60 : 250,
  };
  await waitBattleMs(state, 220);
  if (!state.openState || runGen !== state.battleRunGen) return false;

  const r = getBattleRng(state)();
  const roll = Math.floor(Math.max(0, Math.min(0.999999, Number.isFinite(r) ? r : 0.5)) * 100) + 1;
  const didHit = !forecast.blockedReason && roll <= forecast.hitRate;

  if (!didHit) {
    audioManager.playSfx('attack_miss');
    spawnFloatingText(state, dom, target.x, target.y, forecast.blockedReason?.toUpperCase() ?? 'MISS', '#90d8f8');
  } else {
    const res = applyInflictedStatusToUnit(target, forecast.inflictStatus);
    target.hitFlashUntilMs = performance.now() + (state.fastMode ? 60 : 220);
    state.activeStrikeVfx = {
      kind: 'impact_burst',
      fromWorldX: tx,
      fromWorldY: ty,
      toWorldX: tx,
      toWorldY: ty,
      color: fxColor,
      startedAtMs: performance.now(),
      durationMs: state.fastMode ? 60 : 220,
    };
    if (res.lumBerryConsumed) {
      audioManager.playSfx('heal');
      spawnFloatingText(state, dom, target.x, target.y, 'LUM BERRY!', '#68f8a8', 900);
    } else {
      audioManager.playSfx('attack_hit');
      spawnFloatingText(state, dom, target.x, target.y, STATUS_ACTION_CALLOUTS[forecast.inflictStatus], fxColor, 920);
    }
  }

  updateBattleInfoStrip(ctx);
  await waitBattleMs(state, 280);
  if (!state.openState || runGen !== state.battleRunGen) return didHit;

  state.activeStrikeVfx = null;
  caster.action = 'Idle';
  if (caster.faction === 'player' && !caster.defeated && caster.currentHp > 0 && didHit) {
    await grantExpAndHandleLevelUps(ctx, caster, computeSupportHealExpGain(caster.level, target.level), runGen);
  }
  return didHit;
}

export async function confirmForecastStatusHex(
  ctx: BattleControllerContext,
  onRunEnemyPhase: (ctx: BattleControllerContext) => Promise<void>
): Promise<void> {
  const { state, dom, prepOverlay, audioManager, tutorialOverlay } = ctx;
  const caster = getSelectedUnit(state);
  const target = state.units.find((u) => u.id === state.forecastTargetId && !u.defeated && u.currentHp > 0);
  if (!caster || !target || !state.forecastMoveId) return;

  const forecast = computeStatusMoveForecast(state.map, caster, target, state.forecastMoveId);
  if (!forecast || forecast.blockedReason) return;

  const runGen = state.battleRunGen;
  tutorialOverlay?.notifyActionCompleted('battle_confirm_attack');
  audioManager.playSfx('select');
  dom.forecastModalBackdropEl.hidden = true;
  dom.actionMenuEl.hidden = true;
  state.currentRange = null;
  state.previewPath = null;
  state.interactionState = 'combat_animating';
  syncPrepChromeVisibility(state, dom, prepOverlay);
  syncHudControls(state, dom);
  updateBattleInfoStrip(ctx);
  ctx.onLayerStateChanged();

  await playStatusHexActionAsync(ctx, caster, target, forecast, runGen);
  if (!state.openState || runGen !== state.battleRunGen) return;

  caster.waited = true;
  caster.action = 'Idle';
  caster.renderWorldX = caster.x * PMD_TILE_NATIVE_PX;
  caster.renderWorldY = caster.y * PMD_TILE_NATIVE_PX;

  recomputeDangerArea(ctx);
  clearBattleSelection(state, dom, prepOverlay);
  await runTileReachedEvents(ctx, caster, runGen);
  if (!state.openState || runGen !== state.battleRunGen || checkAndTriggerMatchEnd(ctx)) return;

  syncHudControls(state, dom);
  updateBattleInfoStrip(ctx);
  ctx.onLayerStateChanged();
  ctx.renderNow();

  if (areAllLivingPlayersWaited(state)) {
    await waitBattleMs(state, 240);
    if (state.openState && runGen === state.battleRunGen && state.phase === 'player_phase') {
      await onRunEnemyPhase(ctx);
    }
  }
}

export function runFactionPhaseStartStatusTicks(
  ctx: BattleControllerContext,
  units: ReadonlyArray<BattleUnitState>
): void {
  const { state, dom } = ctx;
  for (const unit of units) {
    const tick = applyPhaseStartStatusTick(unit);
    if (tick.calloutText) {
      spawnFloatingText(state, dom, unit.x, unit.y, tick.calloutText, tick.calloutColor, 880);
    }
  }
}
