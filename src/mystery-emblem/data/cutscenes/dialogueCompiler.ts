/**
 * Cast Resolution, Show-If Conditions & Dialogue Compiler (`dialogueCompiler.ts`)
 *
 * Turns editor documents into the `DialogueScript` shape the existing `DialogueOverlay`
 * plays, resolving cast identities, `{name:castId}` tokens, auto sides, music and sounds
 * against a save.
 */

import { getSpeciesById } from '../index';
import {
  findLordRosterUnit,
  findMentorRosterUnit,
  findRosterUnitOfSpeciesLine,
  resolveRecruitCameoUnits,
  resolveSpeakerIdentity,
  type DialogueSpeakerRef,
} from '../../engine/speakerResolver';
import type { SaveData } from '../../types/schemas';
import type { DialogueLine, DialogueScript, DialogueSide } from '../../ui/DialogueOverlay';
import {
  NARRATOR_SPEAKER_ID,
  type Beat,
  type CastIdentity,
  type CastMember,
  type DialogueDoc,
  type MusicChange,
  type ShowIfCondition,
} from './cutsceneDocTypes';
import { resolveMediaUrl } from './mediaLibrary';

const NARRATOR_PLACEHOLDER: DialogueSpeakerRef = {
  kind: 'npc',
  pmdAssetId: '0000',
  speciesName: '',
  nickname: '',
};

/** Speaker ref for a cast identity; `null` when that party member doesn't exist in this save. */
export function castIdentityToSpeakerRef(
  who: CastIdentity,
  save: SaveData | null
): DialogueSpeakerRef | null {
  switch (who.kind) {
    case 'lord':
    case 'partner':
    case 'healer':
    case 'mentor':
    case 'advisor':
      return { kind: who.kind };
    case 'quiz_slot':
      return {
        kind: 'quiz_slot',
        slot: who.slot,
        ...(who.index !== undefined ? { index: who.index } : {}),
        ...(who.fallbackSpeciesId ? { fallbackSpeciesId: who.fallbackSpeciesId } : {}),
      };
    case 'recruit':
      return { kind: 'recruit', speciesId: who.speciesId };
    case 'party_extra': {
      const unit = resolveRecruitCameoUnits(save)[who.slotIndex];
      return unit ? { kind: 'unit', instanceId: unit.instanceId, fallbackSpeciesId: unit.speciesId } : null;
    }
    case 'npc':
      return {
        kind: 'npc',
        pmdAssetId: who.pokemon,
        speciesName: who.speciesName ?? who.name,
        nickname: who.name,
      };
  }
}

export function isCastIdentityInParty(who: CastIdentity, save: SaveData | null): boolean {
  switch (who.kind) {
    case 'lord':
    case 'partner':
    case 'healer':
    case 'advisor':
    case 'npc':
      return true;
    case 'mentor':
      return Boolean(findMentorRosterUnit(save));
    case 'quiz_slot': {
      const seeded = save?.campaign.quizSeeds?.[who.slot]?.[who.index ?? 0] ?? who.fallbackSpeciesId;
      return Boolean(seeded && findRosterUnitOfSpeciesLine(save, seeded));
    }
    case 'recruit':
      return Boolean(findRosterUnitOfSpeciesLine(save, who.speciesId));
    case 'party_extra':
      return Boolean(resolveRecruitCameoUnits(save)[who.slotIndex]);
  }
}

export function showIfPasses(
  conditions: ReadonlyArray<ShowIfCondition> | undefined,
  cast: ReadonlyArray<CastMember>,
  save: SaveData | null
): boolean {
  if (!conditions || conditions.length === 0) return true;
  return conditions.every((cond) => {
    let result: boolean;
    switch (cond.kind) {
      case 'in_party': {
        const member = cast.find((c) => c.id === cond.cast);
        result = member ? isCastIdentityInParty(member.who, save) : false;
        break;
      }
      case 'hero_is': {
        const lord = findLordRosterUnit(save);
        const lineId = lord ? getSpeciesById(lord.speciesId)?.lineId : undefined;
        const heroSpeciesId = lord?.speciesId ?? 'axew';
        result = cond.species.some(
          (sp) => sp === heroSpeciesId || (lineId && getSpeciesById(sp)?.lineId === lineId)
        );
        break;
      }
      case 'chapter_cleared':
        result = Boolean(save?.campaign.completedChapterIds?.includes(cond.chapter));
        break;
    }
    return cond.negate ? !result : result;
  });
}

/** Replaces `{name:castId}` tokens with that cast member's current name. */
export function interpolateCastNames(
  text: string,
  cast: ReadonlyArray<CastMember>,
  save: SaveData | null
): string {
  return text.replace(/\{name:([a-z0-9_]+)\}/gi, (match, id: string) => {
    const member = cast.find((c) => c.id === id);
    if (!member) return match;
    const ref = castIdentityToSpeakerRef(member.who, save);
    return ref ? resolveSpeakerIdentity(ref, save).nickname : match;
  });
}

/** Display info for a cast member (editor lists, stage labels). */
export function describeCastMember(
  member: CastMember,
  save: SaveData | null
): { name: string; speciesName: string; visualAssetKey: string; available: boolean } {
  const ref = castIdentityToSpeakerRef(member.who, save);
  if (!ref) return { name: `Party member #${(member.who as { slotIndex: number }).slotIndex + 1}`, speciesName: '', visualAssetKey: 'starly', available: false };
  const id = resolveSpeakerIdentity(ref, save);
  return {
    name: id.nickname,
    speciesName: id.speciesName,
    visualAssetKey: id.visualAssetId ?? id.speciesId ?? id.pmdAssetId,
    available: true,
  };
}

/**
 * Assigns `auto` sides: a speaker keeps the side they last spoke on; a new speaker goes on
 * the side opposite the previous speaker (the first speaker starts on the left).
 */
export function resolveBeatSides(beats: ReadonlyArray<Beat>): Map<string, DialogueSide> {
  const out = new Map<string, DialogueSide>();
  const lastSideOf = new Map<string, DialogueSide>();
  let previousSide: DialogueSide | null = null;
  for (const beat of beats) {
    const say = beat.say;
    if (!say || say.speaker === NARRATOR_SPEAKER_ID) continue;
    let side: DialogueSide;
    if (say.side === 'left' || say.side === 'right') side = say.side;
    else side = lastSideOf.get(say.speaker) ?? (previousSide === 'left' ? 'right' : 'left');
    lastSideOf.set(say.speaker, side);
    previousSide = side;
    out.set(beat.id, side);
  }
  return out;
}

export function musicChangeToBgm(
  change: MusicChange | undefined,
  mainSong: string | null | undefined
): string | null | undefined {
  if (!change) return undefined;
  if (change.kind === 'song') return change.song;
  if (change.kind === 'silence') return null;
  return mainSong === undefined ? undefined : mainSong;
}

export function buildBeatDialogueLine(params: {
  beat: Beat;
  side: DialogueSide;
  cast: ReadonlyArray<CastMember>;
  save: SaveData | null;
  mainSong?: string | null;
  includeMusicAndSound?: boolean;
}): DialogueLine | null {
  const { beat, cast, save } = params;
  const say = beat.say;
  if (!say) return null;
  const includeAudio = params.includeMusicAndSound !== false;
  const bgm = includeAudio ? musicChangeToBgm(beat.music, params.mainSong) : undefined;
  const sfxUrl = includeAudio ? resolveMediaUrl('sfx', beat.sound) : null;
  const audio = {
    ...(bgm !== undefined ? { bgm } : {}),
    ...(sfxUrl ? { sfxUrl } : {}),
  };
  const text = interpolateCastNames(say.text, cast, save);

  if (say.speaker === NARRATOR_SPEAKER_ID) {
    return { speaker: NARRATOR_PLACEHOLDER, side: params.side, emotion: 'Normal', text, narrator: true, ...audio };
  }
  const member = cast.find((c) => c.id === say.speaker);
  const ref = member ? castIdentityToSpeakerRef(member.who, save) : null;
  if (!ref) return null;
  return {
    speaker: ref,
    side: params.side,
    emotion: say.emotion,
    text,
    ...(say.hideOtherPortrait ? { clearOppositePortrait: true } : {}),
    ...audio,
  };
}

export function compileDialogueDoc(doc: DialogueDoc, save: SaveData | null): DialogueScript {
  const sides = resolveBeatSides(doc.beats);
  const lines: DialogueLine[] = [];
  for (const beat of doc.beats) {
    if (!showIfPasses(beat.showIf, doc.cast, save)) continue;
    const line = buildBeatDialogueLine({
      beat,
      side: sides.get(beat.id) ?? 'left',
      cast: doc.cast,
      save,
      mainSong: doc.music,
    });
    if (line) lines.push(line);
  }
  return {
    id: `${doc.chapter}_${doc.id}`,
    ...(doc.title ? { title: doc.title } : {}),
    ...(doc.music !== undefined ? { bgm: doc.music } : {}),
    lines,
  };
}
