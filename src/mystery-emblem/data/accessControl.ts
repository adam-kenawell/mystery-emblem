/**
 * Preview & Admin Access Control Configuration
 *
 * While Mystery Emblem is in active development, only Google accounts listed in
 * `ALLOWED_PREVIEW_EMAILS` can view and play the live site. Anyone who is logged out
 * (or signed into an unlisted Google account) sees the "In Development" page instead.
 *
 * How to let friends or family try the game:
 * - Add their Google email address to `ALLOWED_PREVIEW_EMAILS` below.
 * - They will see the full player build without seeing admin-only `Dev Tools`.
 *
 * How to open the site to everyone later:
 * - Change `DEV_PREVIEW_GATE_ENABLED` to `false`.
 */

export const DEV_PREVIEW_GATE_ENABLED = true;

/**
 * Google account emails allowed past the "In Development" screen to access the site.
 * Matched case-insensitively.
 */
export const ALLOWED_PREVIEW_EMAILS: readonly string[] = [
  'adam.kenawell.family@gmail.com',
  // Add additional playtester Google accounts below (e.g., family/friends):
  // 'brother@gmail.com',
];

/**
 * Google account emails granted access to the top-left `Dev Tools` button & admin panels.
 * Matched case-insensitively.
 */
export const ADMIN_DEVTOOLS_EMAILS: readonly string[] = [
  'adam.kenawell.family@gmail.com',
];

function normalizeEmail(email: string | null | undefined): string {
  return (email ?? '').trim().toLowerCase();
}

export function hasPreviewSiteAccess(
  email: string | null | undefined,
  extraAllowedEmails?: ReadonlyArray<string>
): boolean {
  if (!DEV_PREVIEW_GATE_ENABLED) {
    return true;
  }
  const normalized = normalizeEmail(email);
  if (!normalized) {
    return false;
  }
  if (ALLOWED_PREVIEW_EMAILS.some((allowed) => normalizeEmail(allowed) === normalized)) {
    return true;
  }
  if (ADMIN_DEVTOOLS_EMAILS.some((admin) => normalizeEmail(admin) === normalized)) {
    return true;
  }
  if (extraAllowedEmails?.some((extra) => normalizeEmail(extra) === normalized)) {
    return true;
  }
  return false;
}

export function hasAdminDevToolsAccess(email: string | null | undefined): boolean {
  const normalized = normalizeEmail(email);
  if (!normalized) {
    return false;
  }
  return ADMIN_DEVTOOLS_EMAILS.some((admin) => normalizeEmail(admin) === normalized);
}
