/**
 * Mystery Emblem - Prologue Sparring Tutorial Staging (`tutorialStaging.ts`)
 *
 * Turn 1: {partner} (Quaxly) walks to `PROLOGUE_PARTNER_TUTORIAL_TILE`, sitting inside
 * Quaquaval's Mov 6 + Range 1 reach so Quaquaval advances and strikes Quaxly on Enemy Phase 1.
 */

export const PROLOGUE_LEVEL_ID = 'prologue';

export const PROLOGUE_PARTNER_TUTORIAL_TILE: Readonly<{ x: number; y: number }> = { x: 8, y: 5 };

/** Alias retained for backward compatibility with any external helpers */
export const PROLOGUE_LORD_TUTORIAL_TILE = PROLOGUE_PARTNER_TUTORIAL_TILE;
