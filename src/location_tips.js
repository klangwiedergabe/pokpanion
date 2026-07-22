// Tips de gimnasio por mapa (ciudad y, más específico, el interior del
// gimnasio). IDs y layout salen de constants/map_constants.asm de
// pret/pokeyellow; los tipos/líderes son datos de juego de conocimiento
// público (iguales en cualquier guía). No es texto de la ROM.
//
// El tip de Sabrina aclara el bug real de Gen 1: Ghost no le hace NADA a
// Psychic (a diferencia de generaciones posteriores) — vale la pena
// avisarlo porque es contraintuitivo y arruina un plan si no se sabe.
export const LOCATION_TIPS = {
  1: {
    es: "Gimnasio Tierra de Giovanni en esta ciudad — llevá movidas de Agua, Hielo o Planta.",
    en: "Giovanni's Ground gym is in this city — bring Water, Ice, or Grass moves.",
  },
  2: {
    es: "Gimnasio Roca de Brock en esta ciudad — llevá movidas de Agua, Planta o Lucha.",
    en: "Brock's Rock gym is in this city — bring Water, Grass, or Fighting moves.",
  },
  3: {
    es: "Gimnasio Agua de Misty en esta ciudad — llevá movidas de Planta o Eléctricas.",
    en: "Misty's Water gym is in this city — bring Grass or Electric moves.",
  },
  5: {
    es: "Gimnasio Eléctrico de Lt. Surge en esta ciudad — llevá movidas de Tierra.",
    en: "Lt. Surge's Electric gym is in this city — bring Ground moves.",
  },
  6: {
    es: "Gimnasio Planta de Erika en esta ciudad — Fuego, Volador, Bicho, Veneno o Hielo.",
    en: "Erika's Grass gym is in this city — Fire, Flying, Bug, Poison, or Ice moves.",
  },
  7: {
    es: "Gimnasio Veneno de Koga en esta ciudad — movidas Psíquicas o de Tierra.",
    en: "Koga's Poison gym is in this city — Psychic or Ground moves.",
  },
  8: {
    es: "Gimnasio Fuego de Blaine en esta ciudad — llevá movidas de Agua, Tierra o Roca.",
    en: "Blaine's Fire gym is in this city — bring Water, Ground, or Rock moves.",
  },
  10: {
    es: "Gimnasio Psíquico de Sabrina en esta ciudad — solo Bicho pega bien (en Gen 1, Fantasma no le hace nada a Psíquico).",
    en: "Sabrina's Psychic gym is in this city — only Bug hits well (in Gen 1, Ghost does nothing to Psychic).",
  },
  45: {
    es: "Estás en el Gimnasio de Giovanni — llevá movidas de Agua, Hielo o Planta.",
    en: "You're in Giovanni's gym — bring Water, Ice, or Grass moves.",
  },
  54: {
    es: "Estás en el Gimnasio de Brock — llevá movidas de Agua, Planta o Lucha.",
    en: "You're in Brock's gym — bring Water, Grass, or Fighting moves.",
  },
  65: {
    es: "Estás en el Gimnasio de Misty — llevá movidas de Planta o Eléctricas.",
    en: "You're in Misty's gym — bring Grass or Electric moves.",
  },
  92: {
    es: "Estás en el Gimnasio de Lt. Surge — llevá movidas de Tierra.",
    en: "You're in Lt. Surge's gym — bring Ground moves.",
  },
  134: {
    es: "Estás en el Gimnasio de Erika — Fuego, Volador, Bicho, Veneno o Hielo.",
    en: "You're in Erika's gym — Fire, Flying, Bug, Poison, or Ice moves.",
  },
  157: {
    es: "Estás en el Gimnasio de Koga — movidas Psíquicas o de Tierra.",
    en: "You're in Koga's gym — Psychic or Ground moves.",
  },
  166: {
    es: "Estás en el Gimnasio de Blaine — llevá movidas de Agua, Tierra o Roca.",
    en: "You're in Blaine's gym — bring Water, Ground, or Rock moves.",
  },
  178: {
    es: "Estás en el Gimnasio de Sabrina — solo Bicho pega bien (Fantasma no le hace nada a Psíquico en Gen 1).",
    en: "You're in Sabrina's gym — only Bug hits well (Ghost does nothing to Psychic in Gen 1).",
  },
};

// A qué bit de wObtainedBadges corresponde cada ciudad/gimnasio de arriba.
// Con esto el consejero puede darse cuenta de que ya derrotaste a ese líder
// y dejar de sugerirte tipos para una pelea que ya pasó.
export const MAP_ID_TO_BADGE_BIT = {
  1: 7, // Viridian — Earth (Giovanni)
  2: 0, // Pewter — Boulder (Brock)
  3: 1, // Cerulean — Cascade (Misty)
  5: 2, // Vermilion — Thunder (Lt. Surge)
  6: 3, // Celadon — Rainbow (Erika)
  7: 4, // Fuchsia — Soul (Koga)
  8: 6, // Cinnabar — Volcano (Blaine)
  10: 5, // Saffron — Marsh (Sabrina)
  45: 7,
  54: 0,
  65: 1,
  92: 2,
  134: 3,
  157: 4,
  166: 6,
  178: 5,
};
