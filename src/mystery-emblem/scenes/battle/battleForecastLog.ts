/**
 * Turn-by-Turn Forecast Log: pure strike-order builder + shared DOM renderer
 * for the Attack / Heal / Hex forecast modal (`battleForecastDom.ts`).
 */

import type { PmdPortraitEmotion } from '../../assets/pmdAssetLoader';
import type {
  BattleUnitState,
  CombatForecast,
  CombatSideForecast,
  HealForecast,
  StatusMoveForecast,
} from '../../engine/combatEngine';
import { createMiniSpeciesPortrait } from '../../ui/PmdUnitPortraitGrid';
import { getUnitVisualKey, resolveAwakeningHpBarColors } from './battleUnitQueries';

export type ForecastLineTone = 'super' | 'neutral' | 'resisted' | 'immune' | 'heal' | 'blocked';

export interface ForecastLogLine {
  side: 'left' | 'right';
  /** The unit on the receiving end (shown as the step's portrait). */
  unit: BattleUnitState;
  /** Damage or effect text; shown in parentheses after hp when present. */
  text: string;
  /** Target HP before -> after this strike (null for shield / hex). */
  hp: { before: number; after: number } | null;
  tone: ForecastLineTone;
  bold: boolean;
  ko: boolean;
  emotion: PmdPortraitEmotion;
}

function toneForSide(side: CombatSideForecast): ForecastLineTone {
  if (side.typeMultiplier === 0) return 'immune';
  if (side.typeMultiplier > 1) return 'super';
  if (side.typeMultiplier < 1) return 'resisted';
  return 'neutral';
}

/**
 * Mirrors the strike order in `computeCombatForecast` (priority counter -> attack -> counter ->
 * attacker double -> defender double), stopping after any projected KO.
 */
export function buildAttackForecastLines(
  attacker: BattleUnitState,
  defender: BattleUnitState,
  forecast: CombatForecast
): ForecastLogLine[] {
  const hpFloor = attacker.sparring || defender.sparring ? 1 : 0;
  const applyHit = (hp: number, dmg: number) => Math.max(Math.min(hpFloor, hp), hp - dmg);
  let atkHp = attacker.currentHp;
  let defHp = defender.currentHp;
  const lines: ForecastLogLine[] = [];
  const atkSide = forecast.attackerSide;
  const defSide = forecast.defenderCanCounter ? forecast.defenderSide : null;

  const strike = (by: 'attacker' | 'defender') => {
    const side = by === 'attacker' ? atkSide : defSide!;
    const unit = by === 'attacker' ? defender : attacker;
    const before = by === 'attacker' ? defHp : atkHp;
    if (by === 'attacker') defHp = applyHit(defHp, side.damage);
    else atkHp = applyHit(atkHp, side.damage);
    const after = by === 'attacker' ? defHp : atkHp;
    lines.push({
      side: by === 'attacker' ? 'left' : 'right',
      unit,
      text: `${side.damage}`,
      hp: { before, after },
      tone: toneForSide(side),
      bold: side.hasStab,
      ko: by === 'attacker' ? defHp <= 0 : atkHp <= 0,
      emotion: 'Pain',
    });
  };
  const bothAlive = () => atkHp > 0 && defHp > 0;

  if (defSide && forecast.defenderStrikesFirst) strike('defender');
  if (bothAlive()) strike('attacker');
  if (defSide && !forecast.defenderStrikesFirst && bothAlive()) strike('defender');
  if (atkSide.strikes === 2 && bothAlive()) strike('attacker');
  if (defSide && defSide.strikes === 2 && bothAlive()) strike('defender');
  return lines;
}

export function buildHealForecastLines(
  target: BattleUnitState,
  forecast: Pick<HealForecast, 'actualHeal' | 'shield' | 'projectedTargetHp'>
): ForecastLogLine[] {
  const { shield } = forecast;
  const text = shield ? `-${shield.reduction} DMG` : `+${forecast.actualHeal}`;
  const hp = shield ? null : { before: target.currentHp, after: forecast.projectedTargetHp };
  return [{ side: 'left', unit: target, text, hp, tone: 'heal', bold: false, ko: false, emotion: 'Happy' }];
}

export function buildHexForecastLines(
  target: BattleUnitState,
  forecast: Pick<StatusMoveForecast, 'inflictStatus' | 'hitRate' | 'blockedReason'>
): ForecastLogLine[] {
  const blocked = forecast.blockedReason;
  return [
    {
      side: 'left',
      unit: target,
      text: blocked ?? `${forecast.inflictStatus} ${forecast.hitRate}%`,
      hp: null,
      tone: blocked ? 'blocked' : 'neutral',
      bold: false,
      ko: false,
      emotion: blocked ? 'Normal' : 'Pain',
    },
  ];
}

/**
 * Renders all strikes on one wrapping row. Each step is a card (the hit unit's large portrait with
 * a damage plate attached underneath) followed by a mini HP bar showing HP left after that strike.
 * Steps without an HP change (shield / hex) show their text beside the portrait instead.
 */
export function renderForecastLog(backdrop: HTMLElement, lines: ReadonlyArray<ForecastLogLine>): void {
  const logEl = backdrop.querySelector<HTMLElement>('[data-forecast-log]');
  if (!logEl) return;
  logEl.innerHTML = '';
  const el = (tag: string, className: string, text = '') => {
    const node = document.createElement(tag);
    node.className = className;
    node.textContent = text;
    return node;
  };
  lines.forEach((line, i) => {
    if (i > 0) logEl.appendChild(el('span', 'pmd-fe-log-sep', '\u25B8'));
    const toneCls = `pmd-fe-log-num is-${line.tone}${line.bold ? ' is-stab' : ''}${line.ko ? ' is-ko' : ''}`;
    const portrait = createMiniSpeciesPortrait(getUnitVisualKey(line.unit), {
      sizePx: 48,
      emotion: line.emotion,
    });
    const step = el('span', `pmd-fe-log-step is-${line.side}`);
    step.dataset.testid = `forecast-log-line-${i}`;

    if (!line.hp) {
      step.classList.add('is-text');
      step.append(portrait, el('span', toneCls, line.text));
      logEl.appendChild(step);
      return;
    }

    const dmgText = line.tone === 'heal' || line.text === '0' ? line.text : `-${line.text}`;

    const pct = (hp: number) => `${Math.round((Math.max(0, hp) / line.unit.maxHp) * 100)}%`;
    const track = el('span', 'pmd-forecast-hp-bar-track pmd-fe-log-bar');
    const ghost = el('span', 'pmd-forecast-hp-bar-ghost');
    const fill = el('span', 'pmd-forecast-hp-bar-fill');
    ghost.style.width = pct(Math.max(line.hp.before, line.hp.after));
    fill.style.width = pct(line.hp.after);
    fill.style.background = resolveAwakeningHpBarColors(line.unit.maxHp).cssGradient;
    track.append(ghost, fill);

    // Portrait + damage plate share one frame so the number reads as part of the card.
    const card = el('span', 'pmd-fe-log-card');
    card.append(portrait, el('span', `pmd-fe-log-dmg ${toneCls}`, dmgText));
    step.append(card, track);
    logEl.appendChild(step);
  });
}

export function setForecastHpBars(
  backdrop: HTMLElement,
  which: 'attacker' | 'defender',
  unit: BattleUnitState,
  projectedHp: number,
  fill: 'player' | 'enemy' | 'heal'
): void {
  const cur = backdrop.querySelector<HTMLElement>(`[data-${which}-hp-cur-bar]`);
  const proj = backdrop.querySelector<HTMLElement>(`[data-${which}-hp-proj-bar]`);
  const pct = (hp: number) => `${Math.round((Math.max(0, hp) / unit.maxHp) * 100)}%`;
  if (cur) cur.style.width = pct(unit.currentHp);
  if (proj) {
    proj.className = `pmd-forecast-hp-bar-fill${fill === 'player' ? '' : ` is-${fill}`}`;
    proj.style.width = pct(projectedHp);
    proj.style.background = resolveAwakeningHpBarColors(unit.maxHp).cssGradient;
  }
}

/** Fills one side's header portrait (Determined) so each HP bar is tied to a face. */
export function setForecastSidePortrait(
  backdrop: HTMLElement,
  which: 'attacker' | 'defender',
  unit: BattleUnitState
): void {
  const slot = backdrop.querySelector<HTMLElement>(`[data-${which}-portrait]`);
  if (!slot) return;
  slot.replaceChildren(
    createMiniSpeciesPortrait(getUnitVisualKey(unit), { sizePx: 40, emotion: 'Determined' })
  );
}

/** Hides one side's stats + bar column entirely (self-target heals). */
export function setForecastSideVisible(
  backdrop: HTMLElement,
  which: 'attacker' | 'defender',
  visible: boolean
): void {
  const card = backdrop.querySelector<HTMLElement>(`[data-testid="forecast-${which}-card"]`);
  if (card) card.hidden = !visible;
}

/**
 * Sets one side's stats row: HIT/CRT values, a gray note in their place (e.g. `No Counter`),
 * or `null` to hide the row.
 */
export function setForecastSideStats(
  backdrop: HTMLElement,
  which: 'attacker' | 'defender',
  stats: { hit: string; crit: string | null } | { note: string } | null
): void {
  const row = backdrop.querySelector<HTMLElement>(`[data-${which}-stats]`);
  if (row) row.style.visibility = stats ? 'visible' : 'hidden';
  if (!stats) return;
  const q = (sel: string) => backdrop.querySelector<HTMLElement>(sel);
  const hitWrap = q(`[data-${which}-hit-wrap]`);
  const critWrap = q(`[data-${which}-crit-wrap]`);
  const noteEl = q(`[data-${which}-note]`);
  if ('note' in stats) {
    if (hitWrap) hitWrap.hidden = true;
    if (critWrap) critWrap.hidden = true;
    if (noteEl) {
      noteEl.textContent = stats.note;
      noteEl.hidden = false;
    }
    return;
  }
  if (noteEl) noteEl.hidden = true;
  if (hitWrap) hitWrap.hidden = false;
  const hitEl = q(`[data-testid="forecast-${which}-hit"]`);
  const critEl = q(`[data-testid="forecast-${which}-crit"]`);
  if (hitEl) hitEl.textContent = stats.hit;
  if (critEl) critEl.textContent = stats.crit ?? '';
  if (critWrap) critWrap.hidden = stats.crit === null;
}

export function setForecastConfirm(backdrop: HTMLElement, label: string, disabled: boolean): void {
  const btn = backdrop.querySelector<HTMLButtonElement>('[data-testid="forecast-attack-btn"]');
  if (!btn) return;
  btn.textContent = label;
  btn.disabled = disabled;
}
