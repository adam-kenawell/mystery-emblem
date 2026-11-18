/**
 * Global UI scale helpers (`--pmd-ui-scale`, applied via CSS `zoom` in `29-ui-scale.css`).
 */

/**
 * Effective CSS zoom of `el` (product of its own and every ancestor's `zoom`).
 * JS that positions a zoomed element in screen px must divide `left`/`top` by this,
 * because `zoom` multiplies the element's own px lengths.
 */
export function getElementZoom(el: HTMLElement): number {
  let zoom = 1;
  for (let node: HTMLElement | null = el; node; node = node.parentElement) {
    const z = parseFloat(getComputedStyle(node).zoom);
    if (Number.isFinite(z) && z > 0) zoom *= z;
  }
  return zoom;
}
