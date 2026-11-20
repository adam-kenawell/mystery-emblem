/**
 * Classic PMD-Style Collapsible Battle Action Log (`battleActionLog.ts`)
 *
 * Docked to the right of the bottom-left Terrain ("Dungeon Floor") box.
 * Starts collapsed and slides out on demand. Records concise "- " prefixed
 * action lines grouped by phase separators with semantic color highlighting.
 */

import { getMoveById } from '../../data/index';
import {
  STATUS_BADGE_COLORS,
  type BattleUnitState,
} from '../../engine/combatEngine';
import type { StatusCondition } from '../../types/schemas';
import type { BattleDomRefs } from './battleDomShell';
import type { BattleRuntimeState } from './battleTypesAndState';
import { escapeHudHtml } from './battleUnitQueries';

const MAX_BATTLE_LOG_ENTRIES = 80;
type BattleLogPhaseFaction = 'player' | 'ally' | 'enemy';

const STATUS_INFLICT_PHRASES: Readonly<Record<StatusCondition, string>> = {
  PAR: 'paralyzed',
  BRN: 'burned',
  PSN: 'poisoned',
  SLP: 'asleep',
  FRZ: 'frozen',
};

const STAT_BOOST_NAMES: Readonly<Record<'atk' | 'def' | 'spa' | 'spd' | 'spe', string>> = {
  atk: 'Atk',
  def: 'Def',
  spa: 'SpA',
  spd: 'SpD',
  spe: 'Spe',
};

function fmtUnit(unit: BattleUnitState): string {
  const factionClass =
    unit.faction === 'player'
      ? 'is-player'
      : unit.faction === 'npc'
        ? 'is-npc'
        : 'is-enemy';
  return `<span class="pmd-log-unit ${factionClass}">${escapeHudHtml(unit.nickname)}</span>`;
}

function fmtMove(name: string): string {
  return `<span class="pmd-log-move">${escapeHudHtml(name)}</span>`;
}

function fmtItem(name: string): string {
  return `<span class="pmd-log-item">${escapeHudHtml(name)}</span>`;
}

function fmtDmg(amount: number, isCrit = false): string {
  return `<span class="pmd-log-dmg${isCrit ? ' is-crit' : ''}">-${amount}</span>`;
}

function fmtHeal(amount: number): string {
  return `<span class="pmd-log-heal">+${amount}</span>`;
}

function fmtStatusWord(status: StatusCondition, text: string): string {
  const color = STATUS_BADGE_COLORS[status];
  return `<span class="pmd-log-status" style="color:${color};">${escapeHudHtml(text)}</span>`;
}

function createPhaseGroupEl(faction: BattleLogPhaseFaction): HTMLElement {
  const factionClass =
    faction === 'enemy' ? 'is-enemy' : faction === 'ally' ? 'is-ally' : 'is-player';
  const group = document.createElement('div');
  group.className = `pmd-log-phase-group ${factionClass} is-active is-empty`;
  group.dataset.phaseFaction = faction;
  group.innerHTML =
    '<div class="pmd-log-phase-rail" aria-hidden="true">' +
    '<span class="pmd-log-phase-dot"></span>' +
    '<span class="pmd-log-phase-line"></span>' +
    '</div>' +
    '<div class="pmd-log-phase-lines"></div>';
  return group;
}

function getActivePhaseGroup(dom: BattleDomRefs): HTMLElement | null {
  const last = dom.battleLogEntriesEl.lastElementChild;
  return last instanceof HTMLElement && last.classList.contains('pmd-log-phase-group')
    ? last
    : null;
}

function getPhaseLinesContainer(group: HTMLElement): HTMLElement {
  return group.querySelector<HTMLElement>('.pmd-log-phase-lines')!;
}

function renderEmptyPlaceholder(dom: BattleDomRefs): void {
  dom.battleLogEntriesEl.innerHTML = '';
  const group = createPhaseGroupEl('player');
  getPhaseLinesContainer(group).innerHTML =
    '<div class="pmd-battle-log-empty" data-testid="dungeon-battle-log-empty">No actions yet</div>';
  dom.battleLogEntriesEl.appendChild(group);
}

export function setBattleLogCollapsed(
  state: BattleRuntimeState,
  dom: BattleDomRefs,
  collapsed: boolean
): void {
  state.battleLogCollapsed = collapsed;
  dom.battleLogDockEl.classList.toggle('is-collapsed', collapsed);
  dom.battleLogToggleBtnEl.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
  dom.battleLogToggleBtnEl.setAttribute(
    'aria-label',
    collapsed ? 'Show Battle Log' : 'Hide Battle Log'
  );
  if (!collapsed) {
    dom.battleLogBoxEl.scrollTop = dom.battleLogBoxEl.scrollHeight;
  }
}

export function resetBattleLog(state: BattleRuntimeState, dom: BattleDomRefs): void {
  state.battleLogEntryCount = 0;
  renderEmptyPlaceholder(dom);
  setBattleLogCollapsed(state, dom, true);
}

export function logBattlePhaseSeparator(
  _state: BattleRuntimeState,
  dom: BattleDomRefs,
  faction: BattleLogPhaseFaction
): void {
  const current = getActivePhaseGroup(dom);
  if (current) {
    if (current.classList.contains('is-empty')) {
      const factionClass =
        faction === 'enemy' ? 'is-enemy' : faction === 'ally' ? 'is-ally' : 'is-player';
      current.className = `pmd-log-phase-group ${factionClass} is-active is-empty`;
      current.dataset.phaseFaction = faction;
      return;
    }
    current.classList.remove('is-active');
    current.classList.add('is-complete');
  }

  const nextGroup = createPhaseGroupEl(faction);
  dom.battleLogEntriesEl.appendChild(nextGroup);
  dom.battleLogBoxEl.scrollTop = dom.battleLogBoxEl.scrollHeight;
}

export function appendBattleLogHtml(
  state: BattleRuntimeState,
  dom: BattleDomRefs,
  html: string
): void {
  let group = getActivePhaseGroup(dom);
  if (!group) {
    const fallbackFaction: BattleLogPhaseFaction =
      state.phase === 'enemy_phase'
        ? 'enemy'
        : state.phase === 'ally_phase'
          ? 'ally'
          : 'player';
    group = createPhaseGroupEl(fallbackFaction);
    dom.battleLogEntriesEl.appendChild(group);
  }

  const linesEl = getPhaseLinesContainer(group);
  if (group.classList.contains('is-empty')) {
    linesEl.innerHTML = '';
    group.classList.remove('is-empty');
  }

  const line = document.createElement('div');
  line.className = 'pmd-battle-log-line';
  line.innerHTML = `<span class="pmd-log-bullet" aria-hidden="true">&#8226;</span><span>${html}</span>`;
  linesEl.appendChild(line);
  state.battleLogEntryCount += 1;

  while (state.battleLogEntryCount > MAX_BATTLE_LOG_ENTRIES) {
    const firstGroup = dom.battleLogEntriesEl.firstElementChild;
    if (!(firstGroup instanceof HTMLElement)) break;
    const firstLines = getPhaseLinesContainer(firstGroup);
    const oldestLine = firstLines.querySelector('.pmd-battle-log-line');
    if (oldestLine) {
      oldestLine.remove();
      state.battleLogEntryCount -= 1;
      if (firstLines.childElementCount === 0 && firstGroup !== group) {
        firstGroup.remove();
      }
    } else if (firstGroup !== group) {
      firstGroup.remove();
    } else {
      break;
    }
  }
  dom.battleLogBoxEl.scrollTop = dom.battleLogBoxEl.scrollHeight;
}

export function logParalyzedSkip(
  state: BattleRuntimeState,
  dom: BattleDomRefs,
  unit: BattleUnitState
): void {
  appendBattleLogHtml(
    state,
    dom,
    `${fmtUnit(unit)} is ${fmtStatusWord('PAR', 'paralyzed')}!`
  );
}

export function logCombatMiss(
  state: BattleRuntimeState,
  dom: BattleDomRefs,
  actor: BattleUnitState,
  target: BattleUnitState,
  moveName: string
): void {
  appendBattleLogHtml(
    state,
    dom,
    `${fmtUnit(actor)}'s ${fmtMove(moveName)} missed ${fmtUnit(target)}`
  );
}

export function logCombatImmune(
  state: BattleRuntimeState,
  dom: BattleDomRefs,
  actor: BattleUnitState,
  target: BattleUnitState,
  moveName: string
): void {
  appendBattleLogHtml(
    state,
    dom,
    `${fmtUnit(actor)}'s ${fmtMove(moveName)} had no effect on ${fmtUnit(target)}`
  );
}

export function logCombatHit(
  state: BattleRuntimeState,
  dom: BattleDomRefs,
  actor: BattleUnitState,
  target: BattleUnitState,
  moveName: string,
  damageDealt: number,
  isCrit: boolean
): void {
  const critPrefix = isCrit ? '<span class="pmd-log-crit">CRIT!</span> ' : '';
  appendBattleLogHtml(
    state,
    dom,
    `${critPrefix}${fmtUnit(actor)}'s ${fmtMove(moveName)} hit ${fmtUnit(target)} for ${fmtDmg(damageDealt, isCrit)}`
  );
}

export function logBerryStolen(
  state: BattleRuntimeState,
  dom: BattleDomRefs,
  actor: BattleUnitState,
  _target: BattleUnitState,
  berryName: string,
  healed: number,
  curedStatus: boolean
): void {
  if (healed > 0 && curedStatus) {
    appendBattleLogHtml(
      state,
      dom,
      `${fmtUnit(actor)} ate ${fmtItem(berryName)} for ${fmtHeal(healed)} and cured status`
    );
  } else if (healed > 0) {
    appendBattleLogHtml(
      state,
      dom,
      `${fmtUnit(actor)} ate ${fmtItem(berryName)} for ${fmtHeal(healed)}`
    );
  } else if (curedStatus) {
    appendBattleLogHtml(
      state,
      dom,
      `${fmtUnit(actor)} ate ${fmtItem(berryName)} and cured status`
    );
  } else {
    appendBattleLogHtml(state, dom, `${fmtUnit(actor)} ate ${fmtItem(berryName)}`);
  }
}

export function logUnitFainted(
  state: BattleRuntimeState,
  dom: BattleDomRefs,
  target: BattleUnitState
): void {
  appendBattleLogHtml(state, dom, `${fmtUnit(target)} fainted!`);
}

export function logItemDrop(
  state: BattleRuntimeState,
  dom: BattleDomRefs,
  itemName: string
): void {
  appendBattleLogHtml(state, dom, `Got ${fmtItem(itemName)}`);
}

export function logStatusInflicted(
  state: BattleRuntimeState,
  dom: BattleDomRefs,
  target: BattleUnitState,
  status: StatusCondition,
  lumBerryConsumed: boolean
): void {
  if (lumBerryConsumed) {
    appendBattleLogHtml(
      state,
      dom,
      `${fmtUnit(target)}'s ${fmtItem('Lum Berry')} cured status`
    );
    return;
  }
  const phrase = STATUS_INFLICT_PHRASES[status];
  const verb = status === 'SLP' ? 'fell' : 'was';
  appendBattleLogHtml(
    state,
    dom,
    `${fmtUnit(target)} ${verb} ${fmtStatusWord(status, phrase)}!`
  );
}

export function logStatusHexAttempt(
  state: BattleRuntimeState,
  dom: BattleDomRefs,
  caster: BattleUnitState,
  target: BattleUnitState,
  moveName: string,
  status: StatusCondition,
  outcome: 'missed' | 'blocked' | 'inflicted' | 'lum_berry'
): void {
  if (outcome === 'missed') {
    logCombatMiss(state, dom, caster, target, moveName);
    return;
  }
  if (outcome === 'blocked') {
    logCombatImmune(state, dom, caster, target, moveName);
    return;
  }
  if (outcome === 'lum_berry') {
    appendBattleLogHtml(
      state,
      dom,
      `${fmtUnit(caster)}'s ${fmtMove(moveName)} was cured by ${fmtUnit(target)}'s ${fmtItem('Lum Berry')}`
    );
    return;
  }
  const phrase = STATUS_INFLICT_PHRASES[status];
  const verb = status === 'SLP' ? 'fell' : 'was';
  appendBattleLogHtml(
    state,
    dom,
    `${fmtUnit(caster)} used ${fmtMove(moveName)}: ${fmtUnit(target)} ${verb} ${fmtStatusWord(status, phrase)}!`
  );
}

export function logHealOrSupportAction(
  state: BattleRuntimeState,
  dom: BattleDomRefs,
  healer: BattleUnitState,
  target: BattleUnitState,
  moveName: string,
  opts: {
    isShield?: boolean;
    isDelayedHeal?: boolean;
    actualHeal: number;
    curesStatus: boolean;
  }
): void {
  const isSelf = healer.id === target.id;
  if (opts.isShield || opts.isDelayedHeal) {
    appendBattleLogHtml(
      state,
      dom,
      isSelf
        ? `${fmtUnit(healer)} used ${fmtMove(moveName)}`
        : `${fmtUnit(healer)} used ${fmtMove(moveName)} on ${fmtUnit(target)}`
    );
    return;
  }
  if (opts.actualHeal > 0 && opts.curesStatus) {
    appendBattleLogHtml(
      state,
      dom,
      isSelf
        ? `${fmtUnit(healer)} used ${fmtMove(moveName)} for ${fmtHeal(opts.actualHeal)} and cured status`
        : `${fmtUnit(healer)}'s ${fmtMove(moveName)} healed ${fmtUnit(target)} for ${fmtHeal(opts.actualHeal)} and cured status`
    );
  } else if (opts.actualHeal > 0) {
    appendBattleLogHtml(
      state,
      dom,
      isSelf
        ? `${fmtUnit(healer)} used ${fmtMove(moveName)} for ${fmtHeal(opts.actualHeal)}`
        : `${fmtUnit(healer)}'s ${fmtMove(moveName)} healed ${fmtUnit(target)} for ${fmtHeal(opts.actualHeal)}`
    );
  } else if (opts.curesStatus) {
    appendBattleLogHtml(
      state,
      dom,
      isSelf
        ? `${fmtUnit(healer)} used ${fmtMove(moveName)} and cured status`
        : `${fmtUnit(healer)}'s ${fmtMove(moveName)} cured ${fmtUnit(target)}'s status`
    );
  } else {
    appendBattleLogHtml(state, dom, `${fmtUnit(healer)} used ${fmtMove(moveName)}`);
  }
}

export function logDanceAction(
  state: BattleRuntimeState,
  dom: BattleDomRefs,
  dancer: BattleUnitState,
  targetAlly: BattleUnitState,
  moveName: string
): void {
  appendBattleLogHtml(
    state,
    dom,
    `${fmtUnit(dancer)}'s ${fmtMove(moveName)} refreshed ${fmtUnit(targetAlly)}!`
  );
}

export function logConsumableUsed(
  state: BattleRuntimeState,
  dom: BattleDomRefs,
  unit: BattleUnitState,
  itemName: string,
  opts: {
    healed?: number;
    curedStatus?: boolean;
    statBoosts?: Partial<Record<'atk' | 'def' | 'spa' | 'spd' | 'spe', number>>;
    critBoost?: number;
  }
): void {
  const boostParts: string[] = [];
  if (opts.statBoosts) {
    for (const key of ['atk', 'def', 'spa', 'spd', 'spe'] as const) {
      const amt = opts.statBoosts[key];
      if (typeof amt === 'number' && amt !== 0) {
        boostParts.push(`${STAT_BOOST_NAMES[key]} +${amt}`);
      }
    }
  }
  if (typeof opts.critBoost === 'number' && opts.critBoost !== 0) {
    boostParts.push(`Crit +${opts.critBoost}%`);
  }
  if (boostParts.length > 0) {
    appendBattleLogHtml(
      state,
      dom,
      `${fmtUnit(unit)} used ${fmtItem(itemName)} (${boostParts.join(', ')})`
    );
    return;
  }
  const healed = opts.healed ?? 0;
  if (healed > 0 && opts.curedStatus) {
    appendBattleLogHtml(
      state,
      dom,
      `${fmtUnit(unit)} used ${fmtItem(itemName)} for ${fmtHeal(healed)} and cured status`
    );
  } else if (healed > 0) {
    appendBattleLogHtml(
      state,
      dom,
      `${fmtUnit(unit)} used ${fmtItem(itemName)} for ${fmtHeal(healed)}`
    );
  } else if (opts.curedStatus) {
    appendBattleLogHtml(
      state,
      dom,
      `${fmtUnit(unit)} used ${fmtItem(itemName)} and cured status`
    );
  } else {
    appendBattleLogHtml(state, dom, `${fmtUnit(unit)} used ${fmtItem(itemName)}`);
  }
}

export function logPhaseStartWish(
  state: BattleRuntimeState,
  dom: BattleDomRefs,
  unit: BattleUnitState,
  healed: number
): void {
  appendBattleLogHtml(
    state,
    dom,
    healed > 0
      ? `${fmtMove('Wish')} healed ${fmtUnit(unit)} for ${fmtHeal(healed)}`
      : `${fmtMove('Wish')} triggered for ${fmtUnit(unit)}`
  );
}

export function logShieldExpired(
  state: BattleRuntimeState,
  dom: BattleDomRefs,
  unit: BattleUnitState,
  moveId: string
): void {
  const moveName = getMoveById(moveId)?.name ?? 'Shield';
  appendBattleLogHtml(state, dom, `${fmtUnit(unit)}'s ${fmtMove(moveName)} wore off`);
}

export function logPhaseStartStatusTick(
  state: BattleRuntimeState,
  dom: BattleDomRefs,
  unit: BattleUnitState,
  opts: {
    chipDamage: number;
    status: StatusCondition | null;
    clearedStatus: StatusCondition | null;
  }
): void {
  if (opts.clearedStatus === 'SLP') {
    appendBattleLogHtml(state, dom, `${fmtUnit(unit)} woke up`);
  } else if (opts.clearedStatus === 'FRZ') {
    appendBattleLogHtml(state, dom, `${fmtUnit(unit)} thawed out`);
  } else if (opts.chipDamage > 0 && (opts.status === 'BRN' || opts.status === 'PSN')) {
    const label = opts.status === 'BRN' ? 'burn' : 'poison';
    appendBattleLogHtml(
      state,
      dom,
      `${fmtUnit(unit)} took ${fmtDmg(opts.chipDamage)} ${fmtStatusWord(opts.status, label)} dmg`
    );
  }
}

export function logParalyzeHealGift(
  state: BattleRuntimeState,
  dom: BattleDomRefs,
  unit: BattleUnitState
): void {
  appendBattleLogHtml(
    state,
    dom,
    `${fmtUnit(unit)} got ${fmtItem('Paralyze Heal')}`
  );
}

export function logWonderTileRecovery(
  state: BattleRuntimeState,
  dom: BattleDomRefs,
  unit: BattleUnitState,
  healed: number,
  curedStatus: boolean
): void {
  if (healed > 0 && curedStatus) {
    appendBattleLogHtml(
      state,
      dom,
      `Wonder Tile healed ${fmtUnit(unit)} for ${fmtHeal(healed)} and cured status`
    );
  } else if (healed > 0) {
    appendBattleLogHtml(
      state,
      dom,
      `Wonder Tile healed ${fmtUnit(unit)} for ${fmtHeal(healed)}`
    );
  } else if (curedStatus) {
    appendBattleLogHtml(state, dom, `Wonder Tile cured ${fmtUnit(unit)}'s status`);
  }
}

export function logSquadFullHeal(state: BattleRuntimeState, dom: BattleDomRefs): void {
  appendBattleLogHtml(state, dom, `Squad fully restored`);
}
