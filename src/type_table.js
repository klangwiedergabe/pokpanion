// Mapeo de id de tipo interno (como se guarda en la estructura de un Pokémon)
// a nombre de tipo. Gen 1 tiene un salto de ids sin usar entre los tipos
// "físicos" y los "especiales" — no es un error, es así en el juego original.
// Fuente: pret/pokeyellow constants/type_constants.asm.
export const TYPE_ID_TO_NAME = {
  0x00: "normal",
  0x01: "fighting",
  0x02: "flying",
  0x03: "poison",
  0x04: "ground",
  0x05: "rock",
  0x06: "bird",
  0x07: "bug",
  0x08: "ghost",
  0x14: "fire",
  0x15: "water",
  0x16: "grass",
  0x17: "electric",
  0x18: "psychic",
  0x19: "ice",
  0x1a: "dragon",
};

// En Gen 1 no existen Ataque Especial/Defensa Especial por separado, y si un
// movimiento usa Ataque o el stat Special único depende exclusivamente de su
// TIPO elemental (no del movimiento individual). Misma fuente que arriba:
// el propio archivo agrupa los tipos bajo "PHYSICAL" y "SPECIAL".
export const PHYSICAL_TYPES = new Set(["normal", "fighting", "flying", "poison", "ground", "rock", "bird", "bug", "ghost"]);
export const SPECIAL_TYPES = new Set(["fire", "water", "grass", "electric", "psychic", "ice", "dragon"]);

export function isSpecialType(typeName) {
  return SPECIAL_TYPES.has(typeName);
}
