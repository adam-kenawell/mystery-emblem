/**
 * 18-Type Pokémon Tactical Effectiveness Chart (`0x`, `0.5x`, `0.75x`, `1x`, `1.25x`, `1.5x`)
 */

import type { PokemonType } from '../../types/schemas';

export type TypeEffectivenessMultiplier = 0 | 0.5 | 0.75 | 1 | 1.25 | 1.5;

export type TypeEffectivenessLabel =
  | 'Immune'
  | 'Mostly Ineffective'
  | 'Not Very Effective'
  | 'Neutral'
  | 'Super Effective'
  | 'Extremely Effective';

interface TypeMatchupEntry {
  strongAgainst: ReadonlyArray<PokemonType>;
  resistedBy: ReadonlyArray<PokemonType>;
  immuneBy: ReadonlyArray<PokemonType>;
}

const TYPE_CHART: Readonly<Record<PokemonType, TypeMatchupEntry>> = {
  Normal: { strongAgainst: [], resistedBy: ['Rock', 'Steel'], immuneBy: ['Ghost'] },
  Fire: {
    strongAgainst: ['Grass', 'Ice', 'Bug', 'Steel'],
    resistedBy: ['Fire', 'Water', 'Rock', 'Dragon'],
    immuneBy: [],
  },
  Water: {
    strongAgainst: ['Fire', 'Ground', 'Rock'],
    resistedBy: ['Water', 'Grass', 'Dragon'],
    immuneBy: [],
  },
  Grass: {
    strongAgainst: ['Water', 'Ground', 'Rock'],
    resistedBy: ['Fire', 'Grass', 'Poison', 'Flying', 'Bug', 'Dragon', 'Steel'],
    immuneBy: [],
  },
  Electric: {
    strongAgainst: ['Water', 'Flying'],
    resistedBy: ['Electric', 'Grass', 'Dragon'],
    immuneBy: ['Ground'],
  },
  Ice: {
    strongAgainst: ['Grass', 'Ground', 'Flying', 'Dragon'],
    resistedBy: ['Fire', 'Water', 'Ice', 'Steel'],
    immuneBy: [],
  },
  Fighting: {
    strongAgainst: ['Normal', 'Ice', 'Rock', 'Dark', 'Steel'],
    resistedBy: ['Poison', 'Flying', 'Psychic', 'Bug', 'Fairy'],
    immuneBy: ['Ghost'],
  },
  Poison: {
    strongAgainst: ['Grass', 'Fairy'],
    resistedBy: ['Poison', 'Ground', 'Rock', 'Ghost'],
    immuneBy: ['Steel'],
  },
  Ground: {
    strongAgainst: ['Fire', 'Electric', 'Poison', 'Rock', 'Steel'],
    resistedBy: ['Grass', 'Bug'],
    immuneBy: ['Flying'],
  },
  Flying: {
    strongAgainst: ['Grass', 'Fighting', 'Bug'],
    resistedBy: ['Electric', 'Rock', 'Steel'],
    immuneBy: [],
  },
  Psychic: {
    strongAgainst: ['Fighting', 'Poison'],
    resistedBy: ['Psychic', 'Steel'],
    immuneBy: ['Dark'],
  },
  Bug: {
    strongAgainst: ['Grass', 'Psychic', 'Dark'],
    resistedBy: ['Fire', 'Fighting', 'Poison', 'Flying', 'Ghost', 'Steel', 'Fairy'],
    immuneBy: [],
  },
  Rock: {
    strongAgainst: ['Fire', 'Ice', 'Flying', 'Bug'],
    resistedBy: ['Fighting', 'Ground', 'Steel'],
    immuneBy: [],
  },
  Ghost: { strongAgainst: ['Psychic', 'Ghost'], resistedBy: ['Dark'], immuneBy: ['Normal'] },
  Dragon: { strongAgainst: ['Dragon'], resistedBy: ['Steel'], immuneBy: ['Fairy'] },
  Dark: {
    strongAgainst: ['Psychic', 'Ghost'],
    resistedBy: ['Fighting', 'Dark', 'Fairy'],
    immuneBy: [],
  },
  Steel: {
    strongAgainst: ['Ice', 'Rock', 'Fairy'],
    resistedBy: ['Fire', 'Water', 'Electric', 'Steel'],
    immuneBy: [],
  },
  Fairy: {
    strongAgainst: ['Fighting', 'Dragon', 'Dark'],
    resistedBy: ['Fire', 'Poison', 'Steel'],
    immuneBy: [],
  },
};

export function getTypeEffectiveness(
  attackType: PokemonType,
  defenderTypes: ReadonlyArray<PokemonType>
): {
  multiplier: TypeEffectivenessMultiplier;
  label: TypeEffectivenessLabel;
} {
  const row = TYPE_CHART[attackType];
  let stepScore = 0;

  for (const defType of defenderTypes) {
    if (row.immuneBy.includes(defType)) {
      return { multiplier: 0, label: 'Immune' };
    }
    if (row.strongAgainst.includes(defType)) {
      stepScore += 1;
    } else if (row.resistedBy.includes(defType)) {
      stepScore -= 1;
    }
  }

  if (stepScore >= 2) return { multiplier: 1.5, label: 'Extremely Effective' };
  if (stepScore === 1) return { multiplier: 1.25, label: 'Super Effective' };
  if (stepScore === -1) return { multiplier: 0.75, label: 'Not Very Effective' };
  if (stepScore <= -2) return { multiplier: 0.5, label: 'Mostly Ineffective' };
  return { multiplier: 1, label: 'Neutral' };
}
