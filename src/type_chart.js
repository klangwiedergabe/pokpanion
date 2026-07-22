// Tabla de efectividad de tipos de Gen 1 (incluye las peculiaridades reales
// de esa generación, como que Fantasma no afecta a Psíquico por un bug del
// juego original que recién se corrigió en Gen 2 — usamos la tabla real de
// Gen 1, no la "corregida" de juegos posteriores).
// Fuente: pret/pokeyellow data/types/type_matchups.asm
// Multiplicador no listado = 1 (efectividad normal).
export const TYPE_CHART = {
  "water": {
    "fire": 2,
    "rock": 2,
    "water": 0.5,
    "grass": 0.5,
    "ground": 2,
    "dragon": 0.5
  },
  "fire": {
    "grass": 2,
    "ice": 2,
    "fire": 0.5,
    "water": 0.5,
    "bug": 2,
    "rock": 0.5,
    "dragon": 0.5
  },
  "grass": {
    "water": 2,
    "grass": 0.5,
    "fire": 0.5,
    "ground": 2,
    "bug": 0.5,
    "poison": 0.5,
    "rock": 2,
    "flying": 0.5,
    "dragon": 0.5
  },
  "electric": {
    "water": 2,
    "electric": 0.5,
    "grass": 0.5,
    "ground": 0,
    "flying": 2,
    "dragon": 0.5
  },
  "ground": {
    "flying": 0,
    "fire": 2,
    "electric": 2,
    "grass": 0.5,
    "bug": 0.5,
    "rock": 2,
    "poison": 2
  },
  "ice": {
    "ice": 0.5,
    "water": 0.5,
    "grass": 2,
    "ground": 2,
    "flying": 2,
    "dragon": 2
  },
  "psychic": {
    "psychic": 0.5,
    "fighting": 2,
    "poison": 2
  },
  "normal": {
    "rock": 0.5,
    "ghost": 0
  },
  "ghost": {
    "ghost": 2,
    "normal": 0,
    "psychic": 0
  },
  "fighting": {
    "normal": 2,
    "poison": 0.5,
    "flying": 0.5,
    "psychic": 0.5,
    "bug": 0.5,
    "rock": 2,
    "ice": 2,
    "ghost": 0
  },
  "poison": {
    "grass": 2,
    "poison": 0.5,
    "ground": 0.5,
    "bug": 2,
    "rock": 0.5,
    "ghost": 0.5
  },
  "flying": {
    "electric": 0.5,
    "fighting": 2,
    "bug": 2,
    "grass": 2,
    "rock": 0.5
  },
  "bug": {
    "fire": 0.5,
    "grass": 2,
    "fighting": 0.5,
    "flying": 0.5,
    "psychic": 2,
    "ghost": 0.5,
    "poison": 2
  },
  "rock": {
    "fire": 2,
    "fighting": 0.5,
    "ground": 0.5,
    "flying": 2,
    "bug": 2,
    "ice": 2
  },
  "dragon": {
    "dragon": 2
  }
};

export function typeEffectiveness(attackType, defenderTypes) {
  let mult = 1;
  for (const def of defenderTypes) {
    const m = TYPE_CHART[attackType]?.[def];
    mult *= m === undefined ? 1 : m;
  }
  return mult;
}
