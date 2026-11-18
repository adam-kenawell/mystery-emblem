/**
 * Turn-by-Turn Attack / Heal / Hex Forecast Modal DOM Builder
 *
 * Layout: per side Determined portrait + HIT/CRT + HP bar -> divider -> "Battle Sequence" log ->
 * footer (`Using: [move]` picker toggle + confirm). Back sits top-right; tapping outside closes.
 */

export interface BattleForecastDomRefs {
  forecastModalBackdropEl: HTMLElement;
}

export function createBattleForecastDom(): BattleForecastDomRefs {
  const forecastModalBackdropEl = document.createElement('div');
  forecastModalBackdropEl.className = 'pmd-battle-modal-backdrop pmd-forecast-backdrop';
  forecastModalBackdropEl.dataset.testid = 'battle-forecast-modal';
  forecastModalBackdropEl.hidden = true;
  forecastModalBackdropEl.innerHTML = `
    <button type="button" class="pmd-window pmd-window--compact pmd-forecast-back-btn" data-testid="forecast-back-btn" aria-label="Back">Back</button>
    <div class="pmd-window pmd-battle-forecast-dialog pmd-fe-forecast-frame" role="dialog" aria-modal="true" aria-label="Combat Forecast">
      <div class="pmd-fe-title">Battle Forecast</div>
      <div class="pmd-fe-body" data-forecast-body>
        <div class="pmd-fe-sides">
          <div class="pmd-fe-side is-left" data-testid="forecast-attacker-card">
            <span class="pmd-fe-side-portrait" data-attacker-portrait></span>
            <div class="pmd-fe-side-info">
              <div class="pmd-fe-side-stats" data-attacker-stats>
                <span data-attacker-hit-wrap>HIT <strong data-testid="forecast-attacker-hit">-</strong></span>
                <span data-attacker-crit-wrap>CRT <strong data-testid="forecast-attacker-crit">-</strong></span>
                <span class="pmd-fe-side-note" data-testid="forecast-attacker-note" data-attacker-note hidden></span>
              </div>
              <div class="pmd-forecast-hp-bar-track">
                <div class="pmd-forecast-hp-bar-ghost" data-attacker-hp-cur-bar></div>
                <div class="pmd-forecast-hp-bar-fill" data-attacker-hp-proj-bar></div>
              </div>
            </div>
          </div>
          <div class="pmd-fe-side is-right" data-testid="forecast-defender-card">
            <span class="pmd-fe-side-portrait" data-defender-portrait></span>
            <div class="pmd-fe-side-info">
              <div class="pmd-fe-side-stats" data-defender-stats>
                <span data-defender-hit-wrap>HIT <strong data-testid="forecast-defender-hit">-</strong></span>
                <span data-defender-crit-wrap>CRT <strong data-testid="forecast-defender-crit">-</strong></span>
                <span class="pmd-fe-side-note" data-testid="forecast-defender-note" data-defender-note hidden></span>
              </div>
              <div class="pmd-forecast-hp-bar-track">
                <div class="pmd-forecast-hp-bar-ghost" data-defender-hp-cur-bar></div>
                <div class="pmd-forecast-hp-bar-fill" data-defender-hp-proj-bar></div>
              </div>
            </div>
          </div>
        </div>
        <div class="pmd-fe-divider" role="separator"></div>
        <div class="pmd-fe-section-label">Battle Sequence</div>
        <div class="pmd-fe-log" data-testid="forecast-log" data-forecast-log></div>
      </div>

      <div class="pmd-fe-move-picker" data-forecast-move-picker hidden>
        <div class="pmd-fe-move-list pmd-menu-list" data-testid="forecast-move-list" data-forecast-moves></div>
      </div>

      <div class="pmd-fe-footer">
        <button type="button" class="pmd-btn pmd-fe-using-btn" data-testid="forecast-move-switch-btn">Using: -</button>
        <button type="button" class="pmd-btn pmd-btn-primary pmd-fe-confirm-btn" data-testid="forecast-attack-btn">Attack!</button>
      </div>
    </div>
  `;

  return { forecastModalBackdropEl };
}
