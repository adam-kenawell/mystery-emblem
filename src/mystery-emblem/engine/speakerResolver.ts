/**
 * Central Speaker, Portrait, Nickname & Advisor Lifecycle Resolver (`speakerResolver.ts`)
 *
 * Single source of truth used across `DialogueOverlay`, `CutsceneScene`, `TutorialOverlay`,
 * `CreditsScene`, and chapter scripts:
 * - Resolves `{lord | partner | healer | mentor | advisor | quiz_slot | unit | species | npc}`
 * - Honors custom nicknames and live Stage 1 -> Stage 2 -> Stage 3 evolved `speciesId`
 * - Automatically maps 1-to-1 Lord -> Flabébé flower `cosmeticForm` (`0669/000X`..`0671/000X`)
 * - Automatically transitions `{ kind: 'advisor' }` from sideline NPC Wimpod (`0767`) to playable
 *   roster Golisopod (`0768`, w/ custom nickname) once `advisorInstanceId` / `wimpod_line` joins `save.roster`
 */

import {
  WIMPOD_PMD_ASSET_ID,
  getFlabebeFlowerColorForLord,
  resolveSpeciesAssetTarget,
  resolveUnitVisualAssetId,
} from '../assets/pmdAssetLoader';
import { MENTOR_JAGEN_SPECIES_ID } from '../data/campaignConfig';
import { getSpeciesById } from '../data/index';
import type {
  OwnedPokemonInstance,
  QuizSeedSlotKey,
  SaveData,
  UnitCosmeticForm,
} from '../types/schemas';

export type DialogueSpeakerRef =
  | { kind: 'lord'; fallbackSpeciesId?: string }
  | { kind: 'partner'; fallbackSpeciesId?: string }
  | { kind: 'healer'; fallbackSpeciesId?: string }
  | { kind: 'mentor'; fallbackSpeciesId?: string }
  | { kind: 'advisor'; nickname?: string }
  | { kind: 'quiz_slot'; slot: QuizSeedSlotKey; index?: number; fallbackSpeciesId?: string }
  /** A fixed story recruit: the roster unit of that species line once recruited, else the species */
  | { kind: 'recruit'; speciesId: string }
  | { kind: 'unit'; instanceId: string; fallbackSpeciesId?: string }
  | { kind: 'species'; speciesId: string; nickname?: string; cosmeticForm?: UnitCosmeticForm }
  | { kind: 'npc'; pmdAssetId: string; speciesName: string; nickname: string };

export interface ResolvedSpeakerIdentity {
  nickname: string;
  speciesName: string;
  speciesId?: string;
  visualAssetId?: string;
  pmdAssetId: string;
  instanceId?: string;
}

export function findLordRosterUnit(save: SaveData | null): OwnedPokemonInstance | undefined {
  if (!save) return undefined;
  return (
    save.roster.find((u) => u.instanceId === save.campaign.lordInstanceId) ??
    save.roster.find((u) => u.isLord) ??
    save.roster[0]
  );
}

export function findPartnerRosterUnit(save: SaveData | null): OwnedPokemonInstance | undefined {
  if (!save) return undefined;
  return (
    save.roster.find((u) => u.instanceId === save.campaign.partnerInstanceId) ??
    save.roster[1]
  );
}

export function findHealerRosterUnit(save: SaveData | null): OwnedPokemonInstance | undefined {
  if (!save) return undefined;
  if (save.campaign.healerInstanceId) {
    const byId = save.roster.find((u) => u.instanceId === save.campaign.healerInstanceId);
    if (byId) return byId;
  }
  const byLine = save.roster.find((u) => getSpeciesById(u.speciesId)?.lineId === 'flabebe_line');
  return byLine ?? save.roster[2];
}

export function findMentorRosterUnit(save: SaveData | null): OwnedPokemonInstance | undefined {
  if (!save) return undefined;
  return save.roster.find(
    (u) =>
      u.speciesId === MENTOR_JAGEN_SPECIES_ID ||
      getSpeciesById(u.speciesId)?.lineId === 'sir_empoleon_line'
  );
}

export function findAdvisorRosterUnit(save: SaveData | null): OwnedPokemonInstance | undefined {
  if (!save) return undefined;
  if (save.campaign.advisorInstanceId) {
    const byId = save.roster.find((u) => u.instanceId === save.campaign.advisorInstanceId);
    if (byId) return byId;
  }
  return save.roster.find((u) => getSpeciesById(u.speciesId)?.lineId === 'wimpod_line');
}

export function isAdvisorInPlayableRoster(save: SaveData | null): boolean {
  return Boolean(findAdvisorRosterUnit(save));
}

export function findRosterUnitOfSpeciesLine(
  save: SaveData | null,
  speciesId: string
): OwnedPokemonInstance | undefined {
  if (!save) return undefined;
  const target = getSpeciesById(speciesId);
  return save.roster.find((u) => {
    if (u.speciesId === speciesId) return true;
    const uSp = getSpeciesById(u.speciesId);
    return Boolean(target && uSp && uSp.lineId === target.lineId);
  });
}

export function resolveRecruitCameoUnits(save: SaveData | null): OwnedPokemonInstance[] {
  if (!save) return [];
  const coreIds = new Set<string>();
  const lord = findLordRosterUnit(save);
  const partner = findPartnerRosterUnit(save);
  const healer = findHealerRosterUnit(save);
  const mentor = findMentorRosterUnit(save);
  const advisor = findAdvisorRosterUnit(save);
  if (lord) coreIds.add(lord.instanceId);
  if (partner) coreIds.add(partner.instanceId);
  if (healer) coreIds.add(healer.instanceId);
  if (mentor) coreIds.add(mentor.instanceId);
  if (advisor) coreIds.add(advisor.instanceId);
  return save.roster.filter((u) => !coreIds.has(u.instanceId));
}

function buildIdentityFromUnit(unit: OwnedPokemonInstance): ResolvedSpeakerIdentity {
  const sp = getSpeciesById(unit.speciesId);
  const speciesName = sp?.name ?? unit.speciesId;
  const visualAssetId = resolveUnitVisualAssetId(unit.speciesId, unit.cosmeticForm);
  const resolvedTarget = resolveSpeciesAssetTarget(visualAssetId);
  return {
    nickname: unit.nickname,
    speciesName,
    speciesId: unit.speciesId,
    visualAssetId,
    pmdAssetId: resolvedTarget.pmdAssetId,
    instanceId: unit.instanceId,
  };
}

function resolveImplicitCosmeticForm(
  speciesId: string,
  save: SaveData | null,
  explicitForm?: UnitCosmeticForm
): UnitCosmeticForm | undefined {
  if (explicitForm) return explicitForm;
  const sp = getSpeciesById(speciesId);
  if (sp?.lineId === 'flabebe_line') {
    const healer = findHealerRosterUnit(save);
    if (healer?.cosmeticForm) return healer.cosmeticForm;
    const lord = findLordRosterUnit(save);
    if (lord) return getFlabebeFlowerColorForLord(lord.speciesId);
  }
  return undefined;
}

export function resolveSpeakerIdentity(
  speaker: DialogueSpeakerRef,
  save: SaveData | null
): ResolvedSpeakerIdentity {
  if (speaker.kind === 'advisor') {
    const promotedAdvisor = findAdvisorRosterUnit(save);
    if (promotedAdvisor) {
      return buildIdentityFromUnit(promotedAdvisor);
    }
    return {
      nickname: speaker.nickname?.trim() || 'Wimpod',
      speciesName: 'Wimpod',
      speciesId: 'wimpod',
      visualAssetId: WIMPOD_PMD_ASSET_ID,
      pmdAssetId: WIMPOD_PMD_ASSET_ID,
    };
  }

  if (speaker.kind === 'npc') {
    return {
      nickname: speaker.nickname,
      speciesName: speaker.speciesName,
      visualAssetId: speaker.pmdAssetId,
      pmdAssetId: speaker.pmdAssetId,
    };
  }

  if (speaker.kind === 'species') {
    const sp = getSpeciesById(speaker.speciesId);
    const speciesName = sp?.name ?? speaker.speciesId;
    const canonicalId = sp?.id ?? speaker.speciesId;
    const form = resolveImplicitCosmeticForm(canonicalId, save, speaker.cosmeticForm);
    const visualAssetId = sp ? resolveUnitVisualAssetId(sp.id, form) : speaker.speciesId;
    const target = resolveSpeciesAssetTarget(visualAssetId);
    return {
      nickname: speaker.nickname?.trim() || speciesName,
      speciesName,
      speciesId: sp?.id,
      visualAssetId,
      pmdAssetId: target.pmdAssetId || sp?.pmdAssetId || '0610',
    };
  }

  let unit: OwnedPokemonInstance | undefined;
  let fallbackSpeciesId = 'axew';

  switch (speaker.kind) {
    case 'lord':
      unit = findLordRosterUnit(save);
      fallbackSpeciesId = speaker.fallbackSpeciesId ?? 'axew';
      break;
    case 'partner':
      unit = findPartnerRosterUnit(save);
      fallbackSpeciesId = speaker.fallbackSpeciesId ?? 'piplup';
      break;
    case 'healer':
      unit = findHealerRosterUnit(save);
      fallbackSpeciesId = speaker.fallbackSpeciesId ?? 'flabebe';
      break;
    case 'mentor':
      unit = findMentorRosterUnit(save);
      fallbackSpeciesId = speaker.fallbackSpeciesId ?? MENTOR_JAGEN_SPECIES_ID;
      break;
    case 'unit':
      unit = save?.roster.find((u) => u.instanceId === speaker.instanceId);
      fallbackSpeciesId = speaker.fallbackSpeciesId ?? 'axew';
      break;
    case 'quiz_slot': {
      const seedIds = save?.campaign.quizSeeds?.[speaker.slot] ?? [];
      const seededSpId = seedIds[speaker.index ?? 0] ?? speaker.fallbackSpeciesId ?? 'starly';
      fallbackSpeciesId = seededSpId;
      unit = findRosterUnitOfSpeciesLine(save, seededSpId);
      break;
    }
    case 'recruit':
      fallbackSpeciesId = speaker.speciesId;
      unit = findRosterUnitOfSpeciesLine(save, speaker.speciesId);
      break;
  }

  if (unit) {
    return buildIdentityFromUnit(unit);
  }

  const fallbackSp = getSpeciesById(fallbackSpeciesId);
  const fallbackName = fallbackSp?.name ?? fallbackSpeciesId;
  const fallbackForm = resolveImplicitCosmeticForm(fallbackSpeciesId, save);
  const visualAssetId = fallbackSp
    ? resolveUnitVisualAssetId(fallbackSp.id, fallbackForm)
    : fallbackSpeciesId;
  const resolvedTarget = resolveSpeciesAssetTarget(visualAssetId);
  return {
    nickname: fallbackName,
    speciesName: fallbackName,
    speciesId: fallbackSp?.id ?? fallbackSpeciesId,
    visualAssetId,
    pmdAssetId: resolvedTarget.pmdAssetId || fallbackSp?.pmdAssetId || '0147',
  };
}

export function interpolateCampaignText(
  rawText: string,
  save: SaveData | null,
  activeSpeakerNickname?: string
): string {
  const lordName = resolveSpeakerIdentity({ kind: 'lord' }, save).nickname;
  const partnerName = resolveSpeakerIdentity({ kind: 'partner' }, save).nickname;
  const healerName = resolveSpeakerIdentity({ kind: 'healer' }, save).nickname;
  const mentorName = resolveSpeakerIdentity({ kind: 'mentor' }, save).nickname;
  const advisorName = resolveSpeakerIdentity({ kind: 'advisor' }, save).nickname;

  let out = rawText
    .replace(/\{lord\}/g, lordName)
    .replace(/\{partner\}/g, partnerName)
    .replace(/\{healer\}/g, healerName)
    .replace(/\{mentor\}/g, mentorName)
    .replace(/\{advisor\}/g, advisorName);

  if (activeSpeakerNickname !== undefined) {
    out = out.replace(/\{speaker\}/g, activeSpeakerNickname);
  }
  return out;
}
