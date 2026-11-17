/**
 * Support Matrix, Combat Bonus & Sharded Conversation Document Types (`supportTypes.ts`)
 */

import type { SupportRank, UnlockedSupportRank } from '../../types/saveSchemas';
import type { Beat, CastMember } from '../cutscenes/cutsceneDocTypes';

/** Canonical actor identifier: `'lord'` for any Dragon Lord, otherwise species `lineId`. */
export type SupportActorId = 'lord' | (string & {});

export interface SupportStatBonus {
  atk?: number;
  def?: number;
  spa?: number;
  spd?: number;
  spe?: number;
}

export type ResolvedSupportStatBonus = Required<SupportStatBonus>;

export type SupportLineBonusProfile = Readonly<Record<SupportRank, SupportStatBonus>>;

export type SupportMaxRank = 'B' | 'A' | 'S';

export interface SupportPairDefinition {
  pairKey: string;
  actorA: SupportActorId;
  actorB: SupportActorId;
  maxRank: SupportMaxRank;
}

export interface SupportConversationDoc {
  pairKey: string;
  actorA: SupportActorId;
  actorB: SupportActorId;
  rank: SupportRank;
  title?: string;
  music?: string;
  cast: CastMember[];
  beats: Beat[];
}

export interface ActiveSupportPartnerEntry {
  unitId: string;
  nickname: string;
  speciesId: string;
  rank: SupportRank;
  bonus: ResolvedSupportStatBonus;
}

export interface AdjacentSupportSummary {
  totalBonus: ResolvedSupportStatBonus;
  activePartners: ActiveSupportPartnerEntry[];
}

export type { SupportRank, UnlockedSupportRank };
