// i18n mínimo, sin dependencias: un diccionario plano por idioma + t(key,
// vars) con interpolación {var}. Los nombres de especies/movimientos/items
// del juego NO se traducen acá — son los nombres en inglés del cartucho
// real, iguales sea cual sea el idioma de la interfaz.
const STORAGE_KEY = "gbc-web-player-lang";

const dict = {
  es: {
    // UI estática (index.html)
    teamHeading: "Tu equipo",
    companionEmpty: "Cargá una partida para ver tu equipo.",
    romLabel: "ROM (.gb / .gbc) — obligatorio",
    savLabel: "Guardado (.sav) — opcional",
    savHint: "Si no elegís un .sav, arranca una partida nueva desde cero.",
    btnStart: "Comenzar",
    controlsMoveDesc: "Moverte / elegir en menús",
    controlsADesc: "A — confirmar, hablar, avanzar diálogo",
    controlsBDesc: "B — cancelar, cerrar menú, acelerar texto",
    controlsStartDesc: "Start — abrir menú principal",
    controlsSelectDesc: "Select — casi sin uso en este juego",
    savPortableLabel: "Guardado portable (.sav — funciona en cualquier emulador)",
    btnExportSav: "Descargar .sav",
    savReloadHint: "Para cargar otro save: recargá la página (F5) y adjuntalo acá.",
    languageLabel: "Idioma",
    menuToggleOpen: "Abrir menú",
    menuToggleClose: "Cerrar menú",
    dpadUp: "Arriba",
    dpadDown: "Abajo",
    dpadLeft: "Izquierda",
    dpadRight: "Derecha",

    // Estado (main.js)
    statusInitial: "Elegí tu ROM (y opcionalmente un .sav) para empezar.",
    statusLoadingWithSav: "Cargando {rom} con {sav}…",
    statusLoading: "Cargando {rom}…",
    statusPlaying: "Jugando {rom}",
    statusError: "Error al cargar: {msg}",
    statusDownloadingSav: "Descargando .sav…",
    genericError: "algo salió mal (revisá la consola para más detalle)",

    // Companion — tabla de equipo
    tableHeadPokemon: "Pokémon",
    tableHeadLevel: "Nv.",
    tableHeadToLevelUp: "Para subir",
    tableHeadNextMove: "Próx. movimiento",
    tableHeadNextEvo: "Próx. evolución",
    maxLevel: "Nv. máx.",
    expSuffix: "{n} EXP",
    statusPAR: "PAR",
    statusBRN: "QUE",
    statusPSN: "VEN",
    statusFRZ: "CON",
    statusSLP: "DRM",
    learnsMoveAt: "aprende {move} en Nv. {level}",
    evolvesAt: "evoluciona en Nv. {level}",
    evoByItem: "{name} (objeto)",
    evoByTrade: "{name} (intercambio)",
    evoByLevel: "{name} (Nv. {level})",

    // Companion — batalla
    effNone: "sin efecto",
    effNotVery: "poco efectivo",
    effSuper: "súper efectivo",
    effNormal: "efectivo",
    battleHeading: "⚔ {active} vs {enemy} Nv.{level}",
    useMove: "Usá <b>{move}</b> — {eff}",
    noDamagingMoves: "No tiene movimientos de daño disponibles ahora (¿sin PP?).",
    saveYourPp: "Es mucho más débil (Nv. {enemyLv} vs tu Nv. {yourLv}) — con <b>{move}</b> alcanza, guardá PP de {strong}.",
    switchSuggestion: "El que más te ayudaría acá: {name} ({move}).",
    nextEnemyMon: "Después probablemente manden a: {name} (Nv. {level}).",

    // Companion — fuera de batalla
    leadSuggestion: "Llevá a la cabeza a <b>{name}</b> — {milestone}",
    alreadyLeading: "<b>{name}</b> (ya a la cabeza) — {milestone}",
    noUpcomingMilestones: "Tu equipo no tiene movimientos ni evoluciones cerca por ahora.",
    justGotSomething: "Acabás de conseguir algo",
    inYourBag: "Tenés esto en la mochila",

    // Companion — consejos de TM
    tmTeach: "{label} — enseñásela a {mon}, {replaceText}.",
    tmReplacing: "reemplazando {old}",
    tmEmptySlot: "en un espacio libre",
    tmSell: "{label} no mejora a nadie de tu equipo ahora — mejor vendela (₽{price}).",
    tmNotUseful: "{label}: no parece útil para tu equipo actual.",

    // Companion — diagnóstico
    diagNoTeam: "No se encontró un equipo válido todavía.{errNote}",
    diagErrNote: " (error al leer)",
    diagCore: "core: <b>{core}</b> {warn}",
    diagCoreWarn: "⚠ no es el núcleo WASM, la memoria no está donde se espera",
    diagBlockSize: "tamaño leído: {n} bytes (esperado 8192)",
    diagOffset: "offset usado: 0x{offset}",
    diagPartyByte: "byte en wPartyCount (D163): {byte} {status}",
    diagByteOk: "✓ parece válido",
    diagByteBad: "✗ fuera de rango 1-6",
    diagWindow: "bytes D160-D190: {hex}",
    diagEmpty: "(vacío)",
    diagFirstBytes: "primeros 32 bytes del bloque: {hex}{zeroNote}",
    diagAllZero: " ← todo cero, la región está mal",
    diagCantDiagnose: "No se pudo ni siquiera diagnosticar: {msg}",
  },
  en: {
    teamHeading: "Your team",
    companionEmpty: "Load a save to see your team.",
    romLabel: "ROM (.gb / .gbc) — required",
    savLabel: "Save file (.sav) — optional",
    savHint: "If you don't pick a .sav, it starts a fresh new game.",
    btnStart: "Start",
    controlsMoveDesc: "Move / navigate menus",
    controlsADesc: "A — confirm, talk, advance text",
    controlsBDesc: "B — cancel, close menu, speed up text",
    controlsStartDesc: "Start — open main menu",
    controlsSelectDesc: "Select — barely used in this game",
    savPortableLabel: "Portable save (.sav — works in any emulator)",
    btnExportSav: "Download .sav",
    savReloadHint: "To load a different save: reload the page (F5) and attach it here.",
    languageLabel: "Language",
    menuToggleOpen: "Open menu",
    menuToggleClose: "Close menu",
    dpadUp: "Up",
    dpadDown: "Down",
    dpadLeft: "Left",
    dpadRight: "Right",

    statusInitial: "Choose your ROM (and optionally a .sav) to get started.",
    statusLoadingWithSav: "Loading {rom} with {sav}…",
    statusLoading: "Loading {rom}…",
    statusPlaying: "Playing {rom}",
    statusError: "Failed to load: {msg}",
    statusDownloadingSav: "Downloading .sav…",
    genericError: "something went wrong (check the console for details)",

    tableHeadPokemon: "Pokémon",
    tableHeadLevel: "Lv.",
    tableHeadToLevelUp: "To level up",
    tableHeadNextMove: "Next move",
    tableHeadNextEvo: "Next evolution",
    maxLevel: "Max level",
    expSuffix: "{n} EXP",
    statusPAR: "PAR",
    statusBRN: "BRN",
    statusPSN: "PSN",
    statusFRZ: "FRZ",
    statusSLP: "SLP",
    learnsMoveAt: "learns {move} at Lv. {level}",
    evolvesAt: "evolves at Lv. {level}",
    evoByItem: "{name} (item)",
    evoByTrade: "{name} (trade)",
    evoByLevel: "{name} (Lv. {level})",

    effNone: "no effect",
    effNotVery: "not very effective",
    effSuper: "super effective",
    effNormal: "effective",
    battleHeading: "⚔ {active} vs {enemy} Lv.{level}",
    useMove: "Use <b>{move}</b> — {eff}",
    noDamagingMoves: "No damaging moves available right now (out of PP?).",
    saveYourPp: "It's much weaker (Lv. {enemyLv} vs your Lv. {yourLv}) — <b>{move}</b> is enough, save PP on {strong}.",
    switchSuggestion: "Your best bet here: {name} ({move}).",
    nextEnemyMon: "They'll probably send out next: {name} (Lv. {level}).",

    leadSuggestion: "Put <b>{name}</b> in the lead — {milestone}",
    alreadyLeading: "<b>{name}</b> (already leading) — {milestone}",
    noUpcomingMilestones: "Your team has no moves or evolutions coming up soon.",
    justGotSomething: "You just got something",
    inYourBag: "In your bag",

    tmTeach: "{label} — teach it to {mon}, {replaceText}.",
    tmReplacing: "replacing {old}",
    tmEmptySlot: "in an empty slot",
    tmSell: "{label} won't improve anyone on your team right now — better to sell it (₽{price}).",
    tmNotUseful: "{label}: doesn't seem useful for your current team.",

    diagNoTeam: "No valid team found yet.{errNote}",
    diagErrNote: " (read error)",
    diagCore: "core: <b>{core}</b> {warn}",
    diagCoreWarn: "⚠ not the WASM core, memory isn't where we expect it",
    diagBlockSize: "bytes read: {n} (expected 8192)",
    diagOffset: "offset used: 0x{offset}",
    diagPartyByte: "byte at wPartyCount (D163): {byte} {status}",
    diagByteOk: "✓ looks valid",
    diagByteBad: "✗ out of range 1-6",
    diagWindow: "bytes D160-D190: {hex}",
    diagEmpty: "(empty)",
    diagFirstBytes: "first 32 bytes of the block: {hex}{zeroNote}",
    diagAllZero: " ← all zero, wrong region",
    diagCantDiagnose: "Couldn't even run diagnostics: {msg}",
  },
};

function detectDefaultLang() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "es" || saved === "en") return saved;
  } catch {
    // localStorage puede fallar en modo privado — seguimos sin persistir.
  }
  return navigator.language && navigator.language.toLowerCase().startsWith("es") ? "es" : "en";
}

let currentLang = detectDefaultLang();
const listeners = new Set();

export function t(key, vars) {
  const template = dict[currentLang]?.[key] ?? dict.en[key] ?? key;
  if (!vars) return template;
  return Object.entries(vars).reduce((s, [k, v]) => s.replaceAll(`{${k}}`, String(v)), template);
}

export function getLang() {
  return currentLang;
}

export function setLang(lang) {
  if (lang !== "es" && lang !== "en") return;
  if (lang === currentLang) return;
  currentLang = lang;
  try {
    localStorage.setItem(STORAGE_KEY, lang);
  } catch {
    // sin persistencia disponible, el idioma igual cambia para esta sesión.
  }
  listeners.forEach((fn) => fn(lang));
}

// Devuelve una función para dejar de escuchar.
export function onLangChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
