/**
 * Playable Unit Faint Dialogue Registry (`faintMessages.ts`)
 *
 * Looks up personality-matched parting lines by species ID (for evolution-specific
 * voices like Vespiquen) or species `lineId`, then appends the narrated
 * `"{nickname} fainted..."` closing line over sad BGM.
 */

import type { PmdPortraitEmotion } from '../assets/pmdAssetTypes';
import type { BattleUnitState } from '../engine/combatEngine';
import type { DialogueLine, DialogueScript, DialogueSpeakerRef } from '../ui/DialogueOverlay';
import faintMessagesRaw from './faintMessages.json';
import { getSpeciesById } from './index';

export interface UnitFaintLineEntry {
  emotion: PmdPortraitEmotion;
  text: string;
}

export const UNIT_FAINT_BGM_CUE = 'sympathy';

const FAINT_MESSAGES_BY_KEY: Readonly<Record<string, ReadonlyArray<UnitFaintLineEntry>>> =
  faintMessagesRaw as Record<string, UnitFaintLineEntry[]>;

const FALLBACK_FAINT_LINES: ReadonlyArray<UnitFaintLineEntry> = [
  { emotion: 'Pain', text: "Ngh... I can't keep going..." },
  { emotion: 'Sad', text: "I have to fall back for now... Please stay safe, everyone." },
];

export function isPlayableFaintUnit(
  unit: Pick<BattleUnitState, 'faction' | 'speciesId'>
): boolean {
  if (unit.faction === 'player') return true;
  if (unit.faction !== 'npc') return false;
  const species = getSpeciesById(unit.speciesId);
  return Boolean(species && (species.faction === 'playable' || species.faction === 'convertible'));
}

export function getUnitFaintMessageLines(speciesId: string): ReadonlyArray<UnitFaintLineEntry> {
  const bySpecies = FAINT_MESSAGES_BY_KEY[speciesId];
  if (bySpecies && bySpecies.length > 0) return bySpecies;

  const lineId = getSpeciesById(speciesId)?.lineId;
  if (lineId) {
    const byLine = FAINT_MESSAGES_BY_KEY[lineId];
    if (byLine && byLine.length > 0) return byLine;
  }

  return FALLBACK_FAINT_LINES;
}

export function buildUnitFaintDialogueScript(
  unit: Pick<BattleUnitState, 'id' | 'speciesId' | 'nickname' | 'cosmeticForm'>,
  opts?: { restorePreviousBgmOnClose?: boolean; turnNumber?: number }
): DialogueScript {
  const speaker: DialogueSpeakerRef = {
    kind: 'species',
    speciesId: unit.speciesId,
    nickname: unit.nickname,
    cosmeticForm: unit.cosmeticForm,
  };

  const characterLines: DialogueLine[] = getUnitFaintMessageLines(unit.speciesId).map((entry) => ({
    speaker,
    side: 'left',
    emotion: entry.emotion,
    text: entry.text,
  }));

  characterLines.push({
    speaker,
    side: 'left',
    emotion: 'Pain',
    narrator: true,
    text: `${unit.nickname} fainted...`,
  });

  return {
    id: `unit_faint_${unit.id}_${opts?.turnNumber ?? 0}`,
    bgm: UNIT_FAINT_BGM_CUE,
    restorePreviousBgmOnClose: opts?.restorePreviousBgmOnClose ?? true,
    lines: characterLines,
  };
}
