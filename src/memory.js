// Direcciones de WRAM para Pokémon Rojo/Azul/Amarillo (Gen 1).
// Fuente: direcciones ampliamente documentadas por la comunidad de romhacking
// (usadas en GameShark codes, TAS tools, randomizers) + estructura de datos
// verificada contra la macro party_struct de pret/pokeyellow.
// Esto es ingeniería inversa pública, no contenido de la ROM.

// OJO — esto costó encontrarlo: `_getWasmMemorySection(start, end)` de
// wasmboy NO indexa las direcciones del Game Boy (0x0000-0xFFFF) tal cual.
// Indexa la memoria lineal INTERNA del núcleo WASM, que tiene su propio
// mapa donde ROM, VRAM, WRAM, paletas, audio, etc. están todos concatenados
// en un único buffer grande. El WRAM del Game Boy (0xC000-0xDFFF) arranca
// en un offset fijo dentro de ese buffer (Gen 1 es DMG, sin banking de WRAM
// de GBC, así que el corrimiento es constante).
//
// Probamos pedirle este número al núcleo en runtime dos formas distintas
// (_getWasmConstant("WORK_RAM_LOCATION") y _runWasmExport de
// getWasmBoyOffsetFromGameBoyOffset) — ambas fallaron en el navegador real
// (devolvían undefined), aparentemente por un problema en la mensajería
// interna worker↔worker de wasmboy para esas llamadas de diagnóstico
// puntuales, no porque el dato no exista.
//
// Para confirmarlo sin seguir adivinando, se instanció el .wasm real —el
// mismo binario instalado en node_modules/wasmboy/dist/core/core.untouched.wasm—
// directo con Node (sin pasar por wasmboy ni por el navegador) y se llamó
// tanto el export WORK_RAM_LOCATION como getWasmBoyOffsetFromGameBoyOffset(0xC000):
// ambos devolvieron 18432 (0x4800), coincidiendo entre sí. Ese valor queda
// hardcodeado acá — ya no es una suposición leída de GitHub, es el
// resultado de ejecutar el binario real que usa esta app.
const GB_WORK_RAM_START = 0xc000;
// 0x4800 es lo que da el .wasm ejecutado en Node, pero contra datos reales
// (equipo con Gyarados, índice interno $16=22, confirmado en el byte 3 de
// la lista de especies) el dato real aparece corrido 1 byte más abajo. Se
// corrige acá con el -1 — verificado contra una partida real, no adivinado.
const WASM_WORK_RAM_LOCATION = 0x4800 - 1;
const WORK_RAM_OFFSET = WASM_WORK_RAM_LOCATION - GB_WORK_RAM_START;

// Envoltorio que traduce un rango de direcciones del Game Boy antes de
// pedirlo al worker. Usar esto en vez de llamar getWasmMemorySection directo.
async function readGbMemory(getWasmMemorySection, gbStart, gbEnd) {
  return getWasmMemorySection(gbStart + WORK_RAM_OFFSET, gbEnd + WORK_RAM_OFFSET);
}

export const ADDR = {
  PARTY_COUNT: 0xd163,
  PARTY_MON_BASE: 0xd16b, // wPartyMon1
  IS_IN_BATTLE: 0xd057,
  CUR_MAP: 0xd35e,
  PLAYER_Y: 0xd361,
  PLAYER_X: 0xd362,
  BAG_COUNT: 0xd31d, // wNumBagItems
  BAG_ITEMS: 0xd31e, // wBagItems: pares (id, cantidad), termina en 0xFF
  OBTAINED_BADGES: 0xd356, // wObtainedBadges: 1 byte, bit por medalla
  ENEMY_PARTY_COUNT: 0xd7c6, // wEnemyPartyCount (solo entrenadores, no salvajes)
  ENEMY_PARTY_MON_BASE: 0xd7ce, // wEnemyMon1 (mismo layout que wPartyMon1)
};

// wObtainedBadges/wEnemyPartyCount/wEnemyMon1 NO se verificaron contra una
// partida real como las demás direcciones de este archivo — se derivaron
// re-implementando en Python el layout secuencial de ram/wram.asm de
// pret/pokeyellow (mismas macros party_struct/flag_array que usa el juego)
// y cruzando el resultado contra 6 direcciones YA verificadas en vivo
// (wPartyMon1, wCurMap, wYCoord, wXCoord, wNumBagItems, wBagItems), todas
// exactas. Alta confianza, pero si algo da datos raros en batallas de
// entrenador o con medallas, es lo primero a revisar.

// Lee un pedazo crudo de WRAM y lo devuelve en hexadecimal, sin parsear
// nada. Sirve para verificar a ojo si estamos apuntando al lugar correcto
// cuando el parseo normal no encuentra un equipo válido.
function toHex(bytes) {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join(" ");
}

export async function readDebugSnapshot(getWasmMemorySection) {
  const block = await readGbMemory(getWasmMemorySection, 0xc000, 0xe000);
  if (!block) {
    return { blockLength: 0, partyCountByte: undefined, windowHex: "", firstBytesHex: "" };
  }
  const i = ADDR.PARTY_COUNT - 0xc000;
  return {
    blockLength: block.length,
    offsetUsed: WORK_RAM_OFFSET,
    partyCountByte: block[i],
    windowHex: toHex(block.slice(Math.max(0, i - 3), i + 45)),
    firstBytesHex: toHex(block.slice(0, 32)),
  };
}

export const BAG_CAPACITY = 20;

export const MON_STRUCT_SIZE = 44;
const PARTY_BLOCK_END = ADDR.PARTY_MON_BASE + 6 * MON_STRUCT_SIZE;

// Offsets dentro de cada estructura de Pokémon del equipo (party_struct),
// relativos al inicio de esa estructura.
export const MON_OFFSET = {
  SPECIES: 0,
  CURRENT_HP: 1, // 2 bytes, big-endian
  STATUS: 4,
  TYPE1: 5,
  TYPE2: 6,
  MOVES: 8, // 4 bytes, uno por slot
  EXP: 14, // 3 bytes, big-endian — experiencia total acumulada
  PP: 29, // 4 bytes, bits 0-5 = PP actual, bits 6-7 = PP Up aplicados
  LEVEL: 33,
  MAX_HP: 34, // 2 bytes, big-endian
  ATTACK: 36, // 2 bytes, big-endian
  DEFENSE: 38, // 2 bytes, big-endian
  SPEED: 40, // 2 bytes, big-endian
  SPECIAL: 42, // 2 bytes, big-endian — en Gen 1 es un único stat, no hay Sp.Atk/Sp.Def separados
};

function readBigEndian16(bytes, offset) {
  return (bytes[offset] << 8) | bytes[offset + 1];
}

function readBigEndian24(bytes, offset) {
  return (bytes[offset] << 16) | (bytes[offset + 1] << 8) | bytes[offset + 2];
}

// Parsea un bloque crudo con N party_struct consecutivos (mismo layout para
// el equipo propio y, en batallas de entrenador, el del rival).
function parsePartyBlock(block, monsOffset, count) {
  const party = [];
  for (let i = 0; i < count; i++) {
    const base = monsOffset + i * MON_STRUCT_SIZE;

    const moves = [];
    const pp = [];
    for (let m = 0; m < 4; m++) {
      moves.push(block[base + MON_OFFSET.MOVES + m]);
      pp.push(block[base + MON_OFFSET.PP + m] & 0b0011_1111);
    }

    party.push({
      slot: i,
      speciesIndex: block[base + MON_OFFSET.SPECIES],
      level: block[base + MON_OFFSET.LEVEL],
      exp: readBigEndian24(block, base + MON_OFFSET.EXP),
      currentHp: readBigEndian16(block, base + MON_OFFSET.CURRENT_HP),
      maxHp: readBigEndian16(block, base + MON_OFFSET.MAX_HP),
      attack: readBigEndian16(block, base + MON_OFFSET.ATTACK),
      defense: readBigEndian16(block, base + MON_OFFSET.DEFENSE),
      speed: readBigEndian16(block, base + MON_OFFSET.SPEED),
      special: readBigEndian16(block, base + MON_OFFSET.SPECIAL),
      status: block[base + MON_OFFSET.STATUS],
      type1: block[base + MON_OFFSET.TYPE1],
      type2: block[base + MON_OFFSET.TYPE2],
      moves,
      pp,
    });
  }
  return party;
}

// Lee todo el bloque de datos del equipo en una sola llamada al worker y lo
// parsea localmente. Gen 1 guarda los valores de 2 bytes en big-endian.
export async function readPartyFromMemory(getWasmMemorySection) {
  const block = await readGbMemory(getWasmMemorySection, ADDR.PARTY_COUNT, PARTY_BLOCK_END);
  const count = block[0];
  if (count < 1 || count > 6) return [];
  const monsOffset = ADDR.PARTY_MON_BASE - ADDR.PARTY_COUNT;
  return parsePartyBlock(block, monsOffset, count);
}

// El equipo COMPLETO del entrenador rival (no solo el que está peleando
// ahora) — solo tiene datos válidos en batallas de entrenador, no en
// salvajes. Sirve para adivinar a quién mandará después: el próximo con
// currentHp > 0 en el orden del equipo que no sea el que ya está afuera.
const ENEMY_PARTY_BLOCK_END = ADDR.ENEMY_PARTY_COUNT + 1 + 6 * MON_STRUCT_SIZE;
export async function readEnemyPartyFromMemory(getWasmMemorySection) {
  const block = await readGbMemory(getWasmMemorySection, ADDR.ENEMY_PARTY_COUNT, ENEMY_PARTY_BLOCK_END);
  const count = block[0];
  if (count < 1 || count > 6) return [];
  const monsOffset = ADDR.ENEMY_PARTY_MON_BASE - ADDR.ENEMY_PARTY_COUNT;
  return parsePartyBlock(block, monsOffset, count);
}

// Bitmask de 8 medallas (bit 0=Boulder/Pewter ... bit 7=Earth/Viridian).
export async function readBadges(getWasmMemorySection) {
  const bytes = await readGbMemory(getWasmMemorySection, ADDR.OBTAINED_BADGES, ADDR.OBTAINED_BADGES + 1);
  return bytes[0];
}

// wIsInBattle: 0 = no hay batalla, 1 = salvaje, 2 = entrenador, $FF = la perdiste.
export async function readBattleKind(getWasmMemorySection) {
  const bytes = await readGbMemory(getWasmMemorySection, ADDR.IS_IN_BATTLE, ADDR.IS_IN_BATTLE + 1);
  return bytes[0];
}

export async function readIsInBattle(getWasmMemorySection) {
  const kind = await readBattleKind(getWasmMemorySection);
  return kind !== 0;
}

export async function readCurrentMap(getWasmMemorySection) {
  const bytes = await readGbMemory(getWasmMemorySection, ADDR.CUR_MAP, ADDR.CUR_MAP + 1);
  return bytes[0];
}

// wBattleMon (el Pokémon propio activo en batalla) y wEnemyMon (el rival):
// ambas bases verificadas contra una batalla real — no adivinadas. Se
// buscaron a ojo en un volcado de memoria hasta encontrar un patrón que
// coincidiera con TODOS los datos visibles en pantalla a la vez (especie,
// nivel, tipo, e incluso la tasa de captura real de Blastoise = 45), lo
// que descarta que sea casualidad. Mismo layout battle_struct que ya
// usábamos, offsets relativos al inicio de cada estructura.
const BATTLE_MON_OFFSET = {
  SPECIES: 0,
  CURRENT_HP: 1, // 2 bytes, big-endian
  TYPE1: 5,
  TYPE2: 6,
  MOVES: 8, // 4 bytes
  LEVEL: 14,
  MAX_HP: 15, // 2 bytes, big-endian
};
const BATTLE_MON_STRUCT_SIZE = 29;
const PLAYER_BATTLE_MON_BASE = 0xd014;
const ENEMY_MON_BASE = 0xcfe5;

async function readBattleStruct(getWasmMemorySection, base) {
  const block = await readGbMemory(getWasmMemorySection, base, base + BATTLE_MON_STRUCT_SIZE);
  const speciesIndex = block[BATTLE_MON_OFFSET.SPECIES];
  if (speciesIndex === 0) return null;
  return {
    speciesIndex,
    level: block[BATTLE_MON_OFFSET.LEVEL],
    currentHp: readBigEndian16(block, BATTLE_MON_OFFSET.CURRENT_HP),
    maxHp: readBigEndian16(block, BATTLE_MON_OFFSET.MAX_HP),
    type1: block[BATTLE_MON_OFFSET.TYPE1],
    type2: block[BATTLE_MON_OFFSET.TYPE2],
    moves: [0, 1, 2, 3].map((m) => block[BATTLE_MON_OFFSET.MOVES + m]),
  };
}

// Devuelve { enemy, active, isTrainerBattle } o null si no hay batalla en
// curso. "active" es cuál de los 6 Pokémon del jugador está realmente
// peleando ahora mismo (no hace falta adivinar cruzando contra la lista del
// equipo). isTrainerBattle distingue de una salvaje, para saber si tiene
// sentido mirar el equipo completo del rival (wEnemyMons solo es válido en
// batallas de entrenador).
export async function readBattleState(getWasmMemorySection) {
  const kind = await readBattleKind(getWasmMemorySection);
  if (kind === 0) return null;

  const [enemy, active] = await Promise.all([
    readBattleStruct(getWasmMemorySection, ENEMY_MON_BASE),
    readBattleStruct(getWasmMemorySection, PLAYER_BATTLE_MON_BASE),
  ]);
  if (!enemy) return null;
  return { enemy, active, isTrainerBattle: kind === 2 };
}

// Lee la mochila: pares (item id, cantidad) hasta el conteo declarado o un
// terminador 0xFF, lo que ocurra primero.
export async function readBagFromMemory(getWasmMemorySection) {
  const block = await readGbMemory(getWasmMemorySection, ADDR.BAG_COUNT, ADDR.BAG_ITEMS + BAG_CAPACITY * 2);
  const count = block[0];
  if (count < 0 || count > BAG_CAPACITY) return [];

  const items = [];
  for (let i = 0; i < count; i++) {
    const itemId = block[1 + i * 2];
    const quantity = block[1 + i * 2 + 1];
    if (itemId === 0xff) break;
    items.push({ itemId, quantity });
  }
  return items;
}
