/**
 * Admin Access Control Configuration
 *
 * The 5-Dungeon Demo is publicly playable by everyone.
 * Google accounts listed in `ADMIN_DEVTOOLS_EMAILS` unlock the top-left `Dev Tools`
 * modal (`Cheats` & `Map Editor`).
 */

export const ADMIN_DEVTOOLS_EMAILS: readonly string[] = [
  'adam.kenawell.family@gmail.com',
];

function normalizeEmail(email: string | null | undefined): string {
  return (email ?? '').trim().toLowerCase();
}

export function hasAdminDevToolsAccess(email: string | null | undefined): boolean {
  const normalized = normalizeEmail(email);
  if (!normalized) {
    return false;
  }
  return ADMIN_DEVTOOLS_EMAILS.some((admin) => normalizeEmail(admin) === normalized);
}
