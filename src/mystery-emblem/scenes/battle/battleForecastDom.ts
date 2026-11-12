/**
 * Fire Emblem Interlocking 'L'-Shape Attack & Heal Forecast Modal DOM Builder
 */

import { PmdPortraitView } from '../../ui/PmdSpriteCanvas';

export interface BattleForecastDomRefs {
  forecastModalBackdropEl: HTMLElement;
  attackerPortraitView: PmdPortraitView;
  defenderPortraitView: PmdPortraitView;
}

export function createBattleForecastDom(): BattleForecastDomRefs {
  const attackerPortraitView = new PmdPortraitView({
    pixelScale: 1,
    testId: 'forecast-attacker-portrait',
  });
  const defenderPortraitView = new PmdPortraitView({
    pixelScale: 1,
    testId: 'forecast-defender-portrait',
  });

  const forecastModalBackdropEl = document.createElement('div');
  forecastModalBackdropEl.className = 'pmd-battle-modal-backdrop';
  forecastModalBackdropEl.dataset.testid = 'battle-forecast-modal';
  forecastModalBackdropEl.hidden = true;
  forecastModalBackdropEl.innerHTML = `
    <div class="pmd-window pmd-battle-forecast-dialog pmd-fe-forecast-frame" role="dialog" aria-modal="true" aria-label="Combat Forecast">
      <span class="pmd-sr-only" data-forecast-title>COMBAT FORECAST</span>
      <div class="pmd-fe-targets-bar" data-forecast-targets-wrap hidden>
        <div class="pmd-inline-btns" data-forecast-targets></div>
      </div>

      <div class="pmd-fe-l-grid">
        <div class="pmd-fe-player-stem" data-testid="forecast-attacker-card">
          <div class="pmd-forecast-unit-head">
            <div class="pmd-forecast-portrait-slot" data-attacker-portrait-slot></div>
            <div class="pmd-forecast-unit-id">
              <strong class="pmd-forecast-unit-name" data-testid="forecast-attacker-name">-</strong>
              <div class="pmd-fe-stem-move-line">
                <span class="pmd-forecast-move-line" data-testid="forecast-attacker-weapon">-</span>
                <span class="pmd-forecast-eff-badge" data-testid="forecast-effectiveness-badge" hidden>1x</span>
              </div>
            </div>
          </div>
          <div class="pmd-fe-enemy-hp-row">
            <span class="pmd-fe-hp-num" data-testid="forecast-attacker-hp">-</span>
          </div>
          <div class="pmd-forecast-hp-bar-track">
            <div class="pmd-forecast-hp-bar-ghost" data-attacker-hp-cur-bar></div>
            <div class="pmd-forecast-hp-bar-fill" data-attacker-hp-proj-bar></div>
          </div>
          <div class="pmd-fe-stats-strip">
            <div class="pmd-forecast-stat">
              <span data-atk-stat2-label>DMG</span>
              <strong data-testid="forecast-attacker-dmg">-</strong>
            </div>
            <div class="pmd-forecast-stat">
              <span data-atk-stat3-label>HIT</span>
              <strong data-testid="forecast-attacker-hit">-</strong>
            </div>
            <div class="pmd-forecast-stat">
              <span data-atk-stat4-label>CRT</span>
              <strong data-testid="forecast-attacker-crit">-</strong>
            </div>
          </div>
        </div>

        <div class="pmd-fe-enemy-box is-defender" data-testid="forecast-defender-card">
          <div class="pmd-forecast-unit-head">
            <div class="pmd-forecast-portrait-slot" data-defender-portrait-slot></div>
            <div class="pmd-forecast-unit-id">
              <strong class="pmd-forecast-unit-name" data-testid="forecast-defender-name">-</strong>
              <span class="pmd-forecast-move-line" data-testid="forecast-defender-weapon">-</span>
              <span class="pmd-forecast-unit-meta" data-defender-meta hidden></span>
            </div>
          </div>
          <div class="pmd-fe-enemy-hp-row">
            <span class="pmd-fe-hp-num" data-testid="forecast-defender-hp">-</span>
          </div>
          <div class="pmd-forecast-hp-bar-track">
            <div class="pmd-forecast-hp-bar-ghost" data-defender-hp-cur-bar></div>
            <div class="pmd-forecast-hp-bar-fill is-enemy" data-defender-hp-proj-bar></div>
          </div>
          <div class="pmd-fe-stats-strip">
            <div class="pmd-forecast-stat">
              <span data-def-stat2-label>DMG</span>
              <strong data-testid="forecast-defender-dmg">-</strong>
            </div>
            <div class="pmd-forecast-stat">
              <span data-def-stat3-label>HIT</span>
              <strong data-testid="forecast-defender-hit">-</strong>
            </div>
            <div class="pmd-forecast-stat">
              <span data-def-stat4-label>CRT</span>
              <strong data-testid="forecast-defender-crit">-</strong>
            </div>
          </div>
        </div>

        <div class="pmd-fe-player-foot">
          <div class="pmd-fe-move-list pmd-menu-list" data-testid="forecast-move-list" data-forecast-moves></div>
          <div class="pmd-forecast-actions">
            <button type="button" class="pmd-btn pmd-btn-primary" data-testid="forecast-attack-btn">Attack!</button>
            <button type="button" class="pmd-btn" data-testid="forecast-cancel-btn">Cancel</button>
          </div>
        </div>
      </div>
    </div>
  `;

  forecastModalBackdropEl
    .querySelector('[data-attacker-portrait-slot]')
    ?.appendChild(attackerPortraitView.canvas);
  forecastModalBackdropEl
    .querySelector('[data-defender-portrait-slot]')
    ?.appendChild(defenderPortraitView.canvas);

  return {
    forecastModalBackdropEl,
    attackerPortraitView,
    defenderPortraitView,
  };
}
