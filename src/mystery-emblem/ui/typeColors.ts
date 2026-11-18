/**
 * Elemental Type Color Palette & DOM/HTML Helpers
 *
 * High-contrast pixel-RPG elemental colors tuned for legibility against PMD
 * `#204868` cobalt, `#081018` navy, and `#3b1526` enemy crimson window interiors.
 */

import type { PokemonType } from '../types/schemas';

export const ELEMENTAL_TYPE_COLORS: Readonly<Record<PokemonType, string>> = {
  Normal: '#e0dcd0',
  Fire: '#ff6048',
  Water: '#50b8ff',
  Grass: '#58e868',
  Electric: '#ffe038',
  Ice: '#78f0ff',
  Fighting: '#ff8848',
  Poison: '#d878ff',
  Ground: '#e8b858',
  Flying: '#98c8ff',
  Psychic: '#ff70b8',
  Bug: '#b8e840',
  Rock: '#d8c070',
  Ghost: '#a888ff',
  Dragon: '#8888ff',
  Dark: '#c09880',
  Steel: '#b8d4e8',
  Fairy: '#ffa8e8',
};

export function escapeHtml(raw: string): string {
  return raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function getElementalTypeColor(type: PokemonType | string): string {
  return (ELEMENTAL_TYPE_COLORS as Record<string, string>)[type] ?? '#f8f8f8';
}

export function renderColoredTypeHtml(type: PokemonType | string, extraClass = ''): string {
  const color = getElementalTypeColor(type);
  const safeType = escapeHtml(String(type));
  const cls = extraClass ? `pmd-type-text ${escapeHtml(extraClass)}` : 'pmd-type-text';
  return `<span class="${cls}" data-el-type="${safeType}" style="color:${color};">${safeType}</span>`;
}

export function renderColoredTypesHtml(
  types: ReadonlyArray<PokemonType | string>,
  separator = '/'
): string {
  if (!types || types.length === 0) return '';
  const sepHtml = `<span class="pmd-type-sep">${escapeHtml(separator)}</span>`;
  return types.map((t) => renderColoredTypeHtml(t)).join(sepHtml);
}

export function createColoredTypeSpan(
  type: PokemonType | string,
  extraClass = ''
): HTMLSpanElement {
  const span = document.createElement('span');
  span.className = extraClass ? `pmd-type-text ${extraClass}` : 'pmd-type-text';
  span.dataset.elType = String(type);
  span.style.color = getElementalTypeColor(type);
  span.textContent = String(type);
  return span;
}
