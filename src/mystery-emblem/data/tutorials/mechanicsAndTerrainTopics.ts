/**
 * Mystery Emblem - Campaign Mechanics & Dynamic Terrain Topics (`mechanicsAndTerrainTopics.ts`)
 *
 * Non-blocking one-liners with single-screen Field Notes. Zero em dashes.
 */

import type { TutorialTopicDefinition } from './tutorialTypes';

export const MECHANICS_AND_TERRAIN_TOPICS: ReadonlyArray<TutorialTopicDefinition> = [
  {
    id: 'prep_items_and_convoy',
    title: 'Shared Convoy & Gear vs Consumables',
    category: 'prep_pokemon',
    summary: 'Handing out held gear, Berries, and medicine from the shared Convoy.',
    chips: [
      { kind: 'item', itemId: 'muscle_band', label: 'Held Gear' },
      { kind: 'item', itemId: 'x_attack', label: 'X-Item (+3 Stat)' },
    ],
    bullets: [
      'Every teammate draws from one shared Convoy pack in Manage Items or the Overworld Items menu.',
      'Each Pokemon has one item slot: equip either a Held Item (passive gear or auto-Berries) or a Consumable (Potions, status cures, or X-Items).',
      'Tap a teammate first, then tap an item in the Convoy grid to equip or pass it over.',
    ],
    beats: [
      {
        id: 'convoy_beat1',
        emotion: 'Happy',
        dialogue:
          'Our expedition shares one Convoy pack, so you can pass spare gear and medicine to any teammate from Manage Items.',
      },
    ],
  },
  {
    id: 'ch3_stairs_reinforcements',
    title: 'Cave Stairs & Escape Objectives',
    category: 'combat_tactics',
    summary: 'Blocking Stairs reinforcements and guiding your leader to the exit.',
    chips: [
      { kind: 'badge', label: 'Stand On Stairs = Block Spawns', tone: 'gold' },
      { kind: 'badge', label: '+1 Def/SpD · +10% Avo', tone: 'cyan' },
    ],
    bullets: [
      'Wild reinforcements emerge from dungeon Stairs on scheduled turns unless a unit is standing on them.',
      'Parking an ally directly on Stairs grants +1 Def/SpD, +10% Avo, and blocks that spawn.',
      'On Seize / Escape chapters, moving {lord} onto the glowing green exit tiles wins the battle immediately.',
    ],
    beats: [
      {
        id: 'ch3_beat1_stairs',
        emotion: 'Determined',
        dialogue:
          'Stand on dungeon stairs to block reinforcements, and guide {lord} onto the green exit tiles to win!',
      },
    ],
  },
  {
    id: 'ch4_vitamins',
    title: 'Permanent Stat Vitamins & Rare Drops',
    category: 'world_progression',
    summary: 'Winning enemy drops and using Vitamins for permanent stat boosts.',
    chips: [
      { kind: 'item', itemId: 'hp_up', label: 'Permanent +Stat' },
      { kind: 'badge', label: 'Defeat Foe w/ Drop', tone: 'gold' },
    ],
    bullets: [
      'Enemies carrying a green item icon drop their treasure into your Convoy when defeated.',
      'Vitamins like HP Up permanently raise a stat when used from the Units menu.',
      'Check enemy popups to spot valuable drops before finishing a map.',
    ],
    beats: [
      {
        id: 'ch4_beat1_vitamins',
        emotion: 'Happy',
        dialogue:
          'Foes with an item icon drop treasure when defeated, and Vitamins permanently boost stats in Units.',
      },
    ],
  },
  {
    id: 'kecleon_shops_and_tms',
    title: 'Kecleon Shops & Teaching TMs',
    category: 'world_progression',
    summary: 'Shopping at Kecleon stalls and teaching permanent TM moves.',
    chips: [
      { kind: 'species', speciesId: '0352', label: 'Kecleon Shop' },
      { kind: 'item', itemId: 'tm13_scald', label: 'Permanent Move Unlock' },
    ],
    bullets: [
      'Kecleon merchants set up stalls on cleared landmarks to sell medicine, held gear, and TMs.',
      'TMs permanently unlock a compatible move for a teammate when taught from the Units menu.',
      'Equip newly taught TM moves into your 4-move loadout before marching into battle.',
    ],
    beats: [
      {
        id: 'shop_beat1_stalls',
        emotion: 'Happy',
        dialogue:
          'Kecleon stalls carry useful gear, cures, and TMs that permanently unlock new moves from the Units menu.',
      },
    ],
  },
  {
    id: 'ch5_deployment_cap_and_mobile_boss',
    title: 'Deployment Caps & Ferocious Rift Bosses',
    category: 'combat_tactics',
    summary: 'Selecting your active strike team and baiting aggressive bosses.',
    chips: [
      { kind: 'badge', label: 'Rotate Standby Gear', tone: 'gold' },
      { kind: 'species', speciesId: 'great_tusk', label: 'Rift Boss Charges!' },
    ],
    bullets: [
      'When your roster exceeds a chapter deployment cap, choose who deploys in Manage Units ({lord} always deploys).',
      'Pass held items and medicine from benched allies to your active strike team before launching.',
      'Aggressive Rift bosses charge as soon as anyone enters their range, so bait with high Def or SpD.',
    ],
    beats: [
      {
        id: 'ch5_beat1_cap',
        emotion: 'Worried',
        dialogue:
          'Feral Rift bosses charge as soon as anyone enters their range, so lure them in with a sturdy tank.',
      },
    ],
  },
  {
    id: 'status_conditions_and_cures',
    title: 'Status Conditions & Remedies',
    category: 'combat_tactics',
    summary: 'How Burn, Poison, Paralysis, Sleep, and Freeze work, and how to cure them.',
    chips: [
      { kind: 'badge', label: 'BRN: -50% Atk + Chip', tone: 'danger' },
      { kind: 'badge', label: 'PAR: 30% Fizzle', tone: 'gold' },
    ],
    bullets: [
      'Paralysis (PAR) gives a 30% chance to be fully paralyzed and unable to respond; Burn (BRN) halves Physical Attack and deals end-of-turn chip.',
      'Poison (PSN) deals recurring HP damage; Sleep (SLP) and Freeze (FRZ) prevent actions until cured or thawed.',
      'Use a Paralyze Heal, Full Heal, Lum Berry, or stand on a glowing Wonder Tile to cleanse status ailments.',
    ],
    beats: [
      {
        id: 'status_beat1_ailments',
        emotion: 'Worried',
        dialogue:
          'Status ailments like Burn, Poison, and Paralysis can turn a duel quickly, so keep cures or Wonder Tiles in mind.',
      },
    ],
  },
  {
    id: 'terrain_cover_woods_crags',
    title: 'Defensive Cover: Trees & Mountains',
    category: 'combat_tactics',
    summary: 'Trees and Mountains slow movement on foot but grant strong defensive cover.',
    chips: [
      { kind: 'badge', label: 'Trees: +1 Def/SpD · +15% Avo', tone: 'green' },
      { kind: 'badge', label: 'Mountain: +2 Def/SpD · +20% Avo', tone: 'gold' },
    ],
    bullets: [
      'Trees cost extra movement on foot and grant +1 Def, +1 SpD, and +15% Avoid.',
      'Mountains cost more movement on foot and grant +2 Def, +2 SpD, and +20% Avoid.',
      'Flying Pokemon soar smoothly over Trees and Mountains without paying movement penalties or gaining terrain cover.',
    ],
    beats: [
      {
        id: 'terrain_woods_beat1',
        emotion: 'Determined',
        dialogue:
          'It looks like standing in those trees or mountains will give you extra protection from the enemy.',
      },
    ],
  },
  {
    id: 'terrain_wonder_tiles',
    title: 'PMD Wonder Tiles',
    category: 'combat_tactics',
    summary: 'Glowing dungeon tiles that grant cover, restore HP, and cleanse status.',
    chips: [
      { kind: 'badge', label: '+2 Def/SpD · +20% Avo', tone: 'gold' },
      { kind: 'badge', label: '20% Heal + Cleanse', tone: 'green' },
    ],
    bullets: [
      'Standing on a Wonder Tile grants +2 Def, +2 SpD, and +20% Avoid in combat.',
      'At the start of your phase, Wonder Tiles restore 20% max HP and cure any status condition.',
      'Hold Wonder Tiles as anchor points when holding off incoming packs.',
    ],
    beats: [
      {
        id: 'terrain_wonder_beat1',
        emotion: 'Happy',
        dialogue:
          'Spot that glowing Wonder Tile? Holding it boosts your defenses, restores health each turn, and cures status ailments.',
      },
    ],
  },
  {
    id: 'terrain_hazards_lava_void',
    title: 'Lava, Chasms & Levitate Footwork',
    category: 'combat_tactics',
    summary: 'Crossing molten ground and deep chasms safely.',
    chips: [
      { kind: 'type', pokemonType: 'Fire' },
      { kind: 'badge', label: 'Levitate: Void & Barriers', tone: 'gold' },
    ],
    bullets: [
      'Fire types and flyers can cross molten Lava tiles without getting blocked.',
      'Flying and Levitating Pokemon (like Duskull) glide cleanly across Void chasms and barriers.',
      'Check traversal class on a unit card before planning a flank across hazards.',
    ],
    beats: [
      {
        id: 'terrain_hazards_beat1',
        emotion: 'Worried',
        dialogue:
          'Watch your footing near those hazards: only Fire types, flyers, or levitating allies can cross molten ground or chasms.',
      },
    ],
  },
];
