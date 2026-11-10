/**
 * Mystery Emblem — Campaign Mechanics & Dynamic Terrain Topics 7–16 (`mechanicsAndTerrainTopics.ts`)
 *
 * Covers Convoy gear, Bosses & Water/Flying, Dungeon Stairs & Talk Recruitment, Vitamins & Drops,
 * Kecleon Shops & TMs, Deployment Caps & Mobile Bosses, Status Conditions, and Special Terrain.
 *
 * Copy rule: 1–2 short sentences per beat in Wimpod's nervous, friendly voice. Explain rules in
 * plain words (no shorthand like R1/R2, `[E]`, BOSS, DROP, KO or stat notation).
 */

import type { TutorialTopicDefinition } from './tutorialTypes';

export const MECHANICS_AND_TERRAIN_TOPICS: ReadonlyArray<TutorialTopicDefinition> = [
  {
    id: 'prep_items_and_convoy',
    title: 'Shared Convoy & Gear vs Consumables',
    category: 'prep_pokemon',
    summary: 'Handing out gear, Berries, and Potions from the shared Convoy.',
    beats: [
      {
        id: 'convoy_beat1',
        emotion: 'Happy',
        dialogue:
          'We all share one bag. Pick a teammate, then tap an item to hand it over. Whatever they had goes back in the bag.',
        chips: [
          { kind: 'item', itemId: 'muscle_band', label: 'Held Gear' },
          { kind: 'item', itemId: 'x_attack', label: 'X-Item (+3 Stat)' },
        ],
      },
    ],
  },
  {
    id: 'ch2_boss_and_traversal',
    title: 'Boss Battles & Water / Flying Traversal',
    category: 'combat_tactics',
    summary: 'Defeat Boss maps, bosses that stay put, and crossing water.',
    beats: [
      {
        id: 'ch2_beat1_water_flying',
        emotion: 'Surprised',
        dialogue:
          'Most of us can’t cross water. Flyers go right over it, and swimmers like {partner} just paddle across.',
        chips: [
          { kind: 'type', pokemonType: 'Flying' },
          { kind: 'type', pokemonType: 'Water' },
          { kind: 'badge', label: '1 Mov Across Water', tone: 'cyan' },
        ],
      },
      {
        id: 'ch2_beat2_stationary_boss',
        emotion: 'Happy',
        dialogue:
          'See Captain Aron? Beat him and his whole squad will run. He won’t leave his post, so there’s no rush.',
        chips: [
          { kind: 'badge', label: 'Defeat Boss = Instant Win', tone: 'gold' },
          { kind: 'badge', label: '0 Mov Stationary', tone: 'danger' },
        ],
      },
    ],
  },
  {
    id: 'ch3_stairs_reinforcements',
    title: 'Talk Recruitment & Dungeon Stairs',
    category: 'combat_tactics',
    summary: 'Blocking Stairs reinforcements and recruiting foes with Talk.',
    beats: [
      {
        id: 'ch3_beat1_stairs',
        emotion: 'Shouting',
        dialogue: 'More enemies come up those stairs! If one of us stands on them, nobody gets through.',
        chips: [
          { kind: 'badge', label: 'Stand On Stairs = Block Spawns', tone: 'gold' },
          { kind: 'badge', label: '+1 Def/SpD · +10% Avo', tone: 'cyan' },
        ],
      },
      {
        id: 'ch3_beat2_talk_recruit',
        emotion: 'Surprised',
        dialogue:
          'Some foes don’t really want to fight. Walk {lord} right up to one and tap Talk. They might join us!',
        chips: [{ kind: 'badge', label: 'Adjacent Lord -> Talk!', tone: 'green' }],
      },
    ],
  },
  {
    id: 'ch4_vitamins',
    title: 'Permanent Stat Vitamins & Rare Drops',
    category: 'world_progression',
    summary: 'Winning DROP items and using Vitamins for permanent stat boosts.',
    beats: [
      {
        id: 'ch4_beat1_vitamins',
        emotion: 'Surprised',
        dialogue:
          'Some enemies carry items. Beat them and it’s ours! Vitamins like Protein make someone stronger for good. Use them from the map Menu.',
        chips: [
          { kind: 'item', itemId: 'protein', label: 'Permanent +Stat' },
          { kind: 'badge', label: 'KO Enemy w/ DROP', tone: 'gold' },
        ],
      },
    ],
  },
  {
    id: 'kecleon_shops_and_tms',
    title: 'Kecleon Shops & Teaching TMs',
    category: 'world_progression',
    summary: 'Shopping at Kecleon stalls and teaching TM moves.',
    beats: [
      {
        id: 'shop_beat1_stalls',
        emotion: 'Happy',
        dialogue:
          'Kecleon’s stalls are popping up in places we’ve cleared. Walk onto one to buy new moves, gear, and medicine!',
        chips: [
          { kind: 'species', speciesId: '0352', label: 'Kecleon Shop' },
          { kind: 'item', itemId: 'full_heal', label: 'Heals & Gear' },
        ],
      },
      {
        id: 'shop_beat2_tms',
        emotion: 'Normal',
        dialogue: 'A TM teaches someone a new move for good. Use it from Menu, under Units or Items.',
        chips: [{ kind: 'item', itemId: 'tm13_scald', label: 'Permanent Move Unlock' }],
      },
    ],
  },
  {
    id: 'ch5_deployment_cap_and_mobile_boss',
    title: 'Deployment Caps & Mobile Bosses',
    category: 'combat_tactics',
    summary: 'Picking who fights and baiting bosses that move.',
    beats: [
      {
        id: 'ch5_beat1_cap',
        emotion: 'Worried',
        dialogue:
          'Only some of us can fight here. Pick your team in Manage Units ({lord} always comes) and give them the best gear.',
        chips: [{ kind: 'badge', label: 'Rotate Standby Gear', tone: 'gold' }],
      },
      {
        id: 'ch5_beat2_mobile_boss',
        emotion: 'Teary-Eyed',
        dialogue:
          'Commander Deino doesn’t stay put. He charges anyone who gets close, so lure him out with someone sturdy.',
        chips: [{ kind: 'species', speciesId: '0633', label: 'Mobile Boss Charges!' }],
      },
    ],
  },
  {
    id: 'status_conditions_and_cures',
    title: 'Status Conditions & Full Heals',
    category: 'combat_tactics',
    summary: 'What Burn, Poison, Paralysis, Sleep, and Freeze do—and how to cure them.',
    beats: [
      {
        id: 'status_beat1_ailments',
        emotion: 'Dizzy',
        dialogue:
          'Burns and poison hurt a little every turn, and burns weaken physical hits. Paralysis slows you down, and sleep or ice makes you lose turns!',
        chips: [
          { kind: 'badge', label: 'BRN: -50% Atk + Chip', tone: 'danger' },
          { kind: 'badge', label: 'PAR: 1 Mov · -25% Spe', tone: 'gold' },
        ],
      },
      {
        id: 'status_beat2_cures',
        emotion: 'Happy',
        dialogue: 'A Full Heal, a Lum Berry, or a rest on a Wonder Tile will cure any of that.',
        chips: [
          { kind: 'item', itemId: 'full_heal', label: 'Full Heal' },
          { kind: 'item', itemId: 'lum_berry', label: 'Lum Berry (Auto)' },
        ],
      },
    ],
  },
  {
    id: 'terrain_cover_woods_crags',
    title: 'Defensive Cover: Trees & Mountains',
    category: 'combat_tactics',
    summary: 'Trees and Mountains slow you down but give great cover.',
    beats: [
      {
        id: 'terrain_woods_beat1',
        emotion: 'Happy',
        dialogue:
          'Trees and mountains are slow to cross but great to hide in. Flyers and floaters drift right over them, but get no cover.',
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
    summary: 'Glowing tiles that give cover, heal HP, and cure status.',
    beats: [
      {
        id: 'terrain_wonder_beat1',
        emotion: 'Surprised',
        dialogue:
          'A Wonder Tile! Standing on it protects you, heals you a bit each turn, and cures ailments. Don’t let enemies hog it.',
        chips: [
          { kind: 'badge', label: '+2 Def/SpD · +20% Avo', tone: 'gold' },
          { kind: 'badge', label: '20% Heal + Cleanse', tone: 'green' },
        ],
      },
    ],
  },
  {
    id: 'terrain_hazards_lava_void',
    title: 'Lava, Chasms & Levitate Shortcuts',
    category: 'combat_tactics',
    summary: 'Who can cross Lava, and why only Levitate crosses chasms.',
    beats: [
      {
        id: 'terrain_hazards_beat1',
        emotion: 'Dizzy',
        dialogue:
          'Don’t look down! Fire types, flyers, and floaters can cross lava, but only floaters like Duskull can cross a chasm.',
        chips: [
          { kind: 'type', pokemonType: 'Fire' },
          { kind: 'badge', label: 'Levitate Only: Void & Barriers', tone: 'gold' },
        ],
      },
    ],
  },
];
