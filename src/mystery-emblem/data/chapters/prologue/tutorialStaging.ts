/**
 * Mystery Emblem — Prologue Sparring Tutorial Staging (`tutorialStaging.ts`)
 *
 * Turn 1: the lord must walk to `PROLOGUE_LORD_TUTORIAL_TILE`, which sits just inside Sir
 * Empoleon's real Mov 5 + Range 1 reach, so on Enemy Phase he advances and strikes the lord.
 */

export const PROLOGUE_LEVEL_ID = 'prologue';

export const PROLOGUE_LORD_TUTORIAL_TILE: Readonly<{ x: number; y: number }> = { x: 8, y: 5 };
