/**
 * Shared Dialogue Speaker Helpers for Chapter Intro/Outro & Story Cutscene Scripts (`scriptHelpers.ts`)
 */

import {
  COMMANDER_DEINO_PMD_ASSET_ID,
  KECLEON_PMD_ASSET_ID,
  KING_SERPERIOR_PMD_ASSET_ID,
  LADY_MILOTIC_PMD_ASSET_ID,
} from '../campaignConfig';
import { getSpeciesById } from '../index';
import type { DialogueSpeakerRef } from '../../engine/speakerResolver';
import type { SaveData } from '../../types/schemas';

export const SERPERIOR_SPEAKER: DialogueSpeakerRef = {
  kind: 'npc',
  pmdAssetId: KING_SERPERIOR_PMD_ASSET_ID,
  speciesName: 'Serperior',
  nickname: 'King Serperior',
};

export const MILOTIC_SPEAKER: DialogueSpeakerRef = {
  kind: 'npc',
  pmdAssetId: LADY_MILOTIC_PMD_ASSET_ID,
  speciesName: 'Milotic',
  nickname: 'Lady Milotic',
};

export const SIR_EMPOLEON_SPEAKER: DialogueSpeakerRef = {
  kind: 'mentor',
};

export const KECLEON_SPEAKER: DialogueSpeakerRef = {
  kind: 'npc',
  pmdAssetId: KECLEON_PMD_ASSET_ID,
  speciesName: 'Kecleon',
  nickname: 'Kecleon',
};

export const ARON_SPEAKER: DialogueSpeakerRef = {
  kind: 'npc',
  pmdAssetId: '0304',
  speciesName: 'Aron',
  nickname: 'Captain Aron',
};

export const LAIRON_SPEAKER: DialogueSpeakerRef = {
  kind: 'npc',
  pmdAssetId: '0305',
  speciesName: 'Lairon',
  nickname: 'Commander Lairon',
};

export const DEINO_SPEAKER: DialogueSpeakerRef = {
  kind: 'npc',
  pmdAssetId: COMMANDER_DEINO_PMD_ASSET_ID,
  speciesName: 'Deino',
  nickname: 'Commander Deino',
};

export const MORGREM_SPEAKER: DialogueSpeakerRef = {
  kind: 'npc',
  pmdAssetId: '0860',
  speciesName: 'Morgrem',
  nickname: 'Raider Morgrem',
};

export const GOTHITA_SPEAKER: DialogueSpeakerRef = {
  kind: 'npc',
  pmdAssetId: '0574',
  speciesName: 'Gothita',
  nickname: 'Hexer Gothita',
};

export const SPIRITOMB_SPEAKER: DialogueSpeakerRef = {
  kind: 'npc',
  pmdAssetId: '0442',
  speciesName: 'Spiritomb',
  nickname: 'ShadowBinder Spiritomb',
};

export function findRecruitSpeaker(
  save: SaveData | null,
  fallbackSpeciesId: string
): DialogueSpeakerRef {
  if (save) {
    const fallbackSp = getSpeciesById(fallbackSpeciesId);
    const matched = save.roster.find((u) => {
      if (u.speciesId === fallbackSpeciesId) return true;
      const sp = getSpeciesById(u.speciesId);
      return Boolean(fallbackSp && sp && sp.lineId === fallbackSp.lineId);
    });
    if (matched) {
      return {
        kind: 'unit',
        instanceId: matched.instanceId,
        fallbackSpeciesId,
      };
    }
  }
  return {
    kind: 'species',
    speciesId: fallbackSpeciesId,
  };
}
