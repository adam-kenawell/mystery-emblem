/**
 * Mystery Emblem - Campaign Mechanics & Dynamic Terrain Topics 7-16 (`mechanicsAndTerrainTopics.ts`)
 *
 * Voiced by Quaquaval for live coaching and Quaquaval's Field Notes. Zero em dashes.
 */

import type { TutorialTopicDefinition } from './tutorialTypes';

export const MECHANICS_AND_TERRAIN_TOPICS: ReadonlyArray<TutorialTopicDefinition> = [
  {
    id: 'prep_items_and_convoy',
    title: 'Shared Convoy & Gear vs Consumables',
    category: 'prep_pokemon',
    summary: 'Handing out gear, Berries, and medicine from the shared Convoy.',
    beats: [
      {
        id: 'convoy_beat1',
        emotion: 'Happy',
        dialogue:
          'Our expedition shares one Convoy pack. Pick a teammate in Manage Items, then tap gear or medicine to hand it over.',
        chips: [
          { kind: 'item', itemId: 'muscle_band', label: 'Held Gear' },
          { kind: 'item', itemId: 'x_attack', label: 'X-Item (+3 Stat)' },
        ],
      },
    ],
  },
  {
    id: 'ch2_boss_and_traversal',
    title: 'Outlaw Leaders & Water / Flying Footwork',
    category: 'combat_tactics',
    summary: 'Crossing water tiles and reading stationary enemy leaders.',
    beats: [
      {
        id: 'ch2_beat1_water_flying',
        emotion: 'Normal',
        dialogue:
          'Most fighters cannot cross deep water, but flyers glide right over it and swimmers like {partner} splash across with ease.',
        chips: [
          { kind: 'type', pokemonType: 'Flying' },
          { kind: 'type', pokemonType: 'Water' },
          { kind: 'badge', label: '1 Mov Across Water', tone: 'cyan' },
        ],
      },
      {
        id: 'ch2_beat2_stationary_boss',
        emotion: 'Determined',
        dialogue:
          'Watch the enemy ringleader carefully! Some bosses hold their ground until you step close, so clear their henchmen first.',
        chips: [
          { kind: 'badge', label: 'Check Danger Area', tone: 'gold' },
          { kind: 'badge', label: 'Clear Escorts First', tone: 'danger' },
        ],
      },
    ],
  },
  {
    id: 'ch3_stairs_reinforcements',
    title: 'Cave Stairs & Escape Objectives',
    category: 'combat_tactics',
    summary: 'Blocking Stairs reinforcements and guiding your leader to the exit.',
    beats: [
      {
        id: 'ch3_beat1_stairs',
        emotion: 'Determined',
        dialogue:
          'Wild foes climb up from dungeon stairs between turns! Park a sturdy ally directly on the stairs to seal them shut.',
        chips: [
          { kind: 'badge', label: 'Stand On Stairs = Block Spawns', tone: 'gold' },
          { kind: 'badge', label: '+1 Def/SpD · +10% Avo', tone: 'cyan' },
        ],
      },
      {
        id: 'ch3_beat2_talk_recruit',
        emotion: 'Normal',
        dialogue:
          'Keep your eyes on the objective banner too. On escape marches, getting {lord} safely onto the exit tile wins the battle right away!',
        chips: [{ kind: 'badge', label: 'Reach Exit Tile = Victory', tone: 'green' }],
      },
    ],
  },
  {
    id: 'ch4_vitamins',
    title: 'Permanent Stat Vitamins & Rare Drops',
    category: 'world_progression',
    summary: 'Winning enemy drops and using Vitamins for permanent stat boosts.',
    beats: [
      {
        id: 'ch4_beat1_vitamins',
        emotion: 'Happy',
        dialogue:
          'Foes marked with an item icon drop their treasure when defeated! Vitamins like HP Up permanently strengthen a teammate from the map Menu.',
        chips: [
          { kind: 'item', itemId: 'hp_up', label: 'Permanent +Stat' },
          { kind: 'badge', label: 'Defeat Foe w/ Drop', tone: 'gold' },
        ],
      },
    ],
  },
  {
    id: 'kecleon_shops_and_tms',
    title: 'Kecleon Shops & Teaching TMs',
    category: 'world_progression',
    summary: 'Shopping at Kecleon stalls and teaching permanent TM moves.',
    beats: [
      {
        id: 'shop_beat1_stalls',
        emotion: 'Happy',
        dialogue:
          'Kecleon merchants set up roadside stalls on cleared landmarks. Visit them to stock up on medicine, gear, and TMs!',
        chips: [
          { kind: 'species', speciesId: '0352', label: 'Kecleon Shop' },
          { kind: 'item', itemId: 'full_heal', label: 'Heals & Gear' },
        ],
      },
      {
        id: 'shop_beat2_tms',
        emotion: 'Normal',
        dialogue:
          'A TM permanently teaches a compatible teammate a brand-new move. Open Menu on the world map to teach one.',
        chips: [{ kind: 'item', itemId: 'tm13_scald', label: 'Permanent Move Unlock' }],
      },
    ],
  },
  {
    id: 'ch5_deployment_cap_and_mobile_boss',
    title: 'Deployment Caps & Ferocious Rift Bosses',
    category: 'combat_tactics',
    summary: 'Selecting your active strike team and baiting aggressive bosses.',
    beats: [
      {
        id: 'ch5_beat1_cap',
        emotion: 'Determined',
        dialogue:
          'Our roster is growing! Choose your active lineup in Manage Units ({lord} always leads) and pass spare gear to whoever deploys.',
        chips: [{ kind: 'badge', label: 'Rotate Standby Gear', tone: 'gold' }],
      },
      {
        id: 'ch5_beat2_mobile_boss',
        emotion: 'Worried',
        dialogue:
          'Careful! Feral Rift beasts charge the moment anyone enters their range, so lure them forward with a high-defense teammate.',
        chips: [{ kind: 'species', speciesId: 'great_tusk', label: 'Rift Boss Charges!' }],
      },
    ],
  },
  {
    id: 'status_conditions_and_cures',
    title: 'Status Conditions & Remedies',
    category: 'combat_tactics',
    summary: 'How Burn, Poison, Paralysis, Sleep, and Freeze work, and how to cure them.',
    beats: [
      {
        id: 'status_beat1_ailments',
        emotion: 'Worried',
        dialogue:
          'Burns and poison sap health each turn, and burns halve physical power. Paralysis slows movement to a crawl, while sleep and ice cost turns!',
        chips: [
          { kind: 'badge', label: 'BRN: -50% Atk + Chip', tone: 'danger' },
          { kind: 'badge', label: 'PAR: 1 Mov · -25% Spe', tone: 'gold' },
        ],
      },
      {
        id: 'status_beat2_cures',
        emotion: 'Happy',
        dialogue:
          'Carry a Paralyze Heal, Full Heal, or Lum Berry, or step onto a glowing Wonder Tile to cleanse any ailment.',
        chips: [
          { kind: 'item', itemId: 'paralyze_heal', label: 'Paralyze Heal' },
          { kind: 'item', itemId: 'full_heal', label: 'Full Heal' },
        ],
      },
    ],
  },
  {
    id: 'terrain_cover_woods_crags',
    title: 'Defensive Cover: Trees & Mountains',
    category: 'combat_tactics',
    summary: 'Trees and Mountains slow movement on foot but grant strong defensive cover.',
    beats: [
      {
        id: 'terrain_woods_beat1',
        emotion: 'Determined',
        dialogue:
          'Trees and rocky crags cost extra steps on foot, yet grant sturdy defense and evasion bonuses. Flyers soar over them without cover.',
        chips: [
          { kind: 'badge', label: 'Trees: +1 Def/SpD · +15% Avo', tone: 'green' },
          { kind: 'badge', label: 'Mountain: +2 Def/SpD · +20% Avo', tone: 'gold' },
        ],
      },
    ],
  },
  {
    id: 'terrain_wonder_tiles',
    title: 'PMD Wonder Tiles',
    category: 'combat_tactics',
    summary: 'Glowing dungeon tiles that grant cover, restore HP, and cleanse status.',
    beats: [
      {
        id: 'terrain_wonder_beat1',
        emotion: 'Happy',
        dialogue:
          'Spot that glowing Wonder Tile? Holding it boosts your defenses, restores health every turn, and cures status ailments!',
        chips: [
          { kind: 'badge', label: '+2 Def/SpD · +20% Avo', tone: 'gold' },
          { kind: 'badge', label: '20% Heal + Cleanse', tone: 'green' },
        ],
      },
    ],
  },
  {
    id: 'terrain_hazards_lava_void',
    title: 'Lava, Chasms & Levitate Footwork',
    category: 'combat_tactics',
    summary: 'Crossing molten ground and deep chasms safely.',
    beats: [
      {
        id: 'terrain_hazards_beat1',
        emotion: 'Worried',
        dialogue:
          'Watch your step near cliffs! Fire types, flyers, and levitating fighters like Honedge can cross hazards where grounded units cannot.',
        chips: [
          { kind: 'type', pokemonType: 'Fire' },
          { kind: 'badge', label: 'Levitate: Void & Barriers', tone: 'gold' },
        ],
      },
    ],
  },
];
