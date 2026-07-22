import { WasmBoy } from "wasmboy";
import { KEY_MAP } from "./config.js";

let joypadState = {
  up: false,
  down: false,
  left: false,
  right: false,
  a: false,
  b: false,
  start: false,
  select: false,
};

export async function initEmulator(canvas) {
  await WasmBoy.config(
    {
      headless: false,
      isAudioEnabled: true,
      isGbcColorizeEnabled: true,
      gameboyFPSCap: 60,
    },
    canvas
  );
  await WasmBoy.disableDefaultJoypad();
  setupKeyboard();
  // Para poder diagnosticar desde la consola del navegador si algo falla.
  window.WasmBoy = WasmBoy;
}

function setupKeyboard() {
  window.addEventListener("keydown", (e) => {
    const button = KEY_MAP[e.key.toLowerCase()];
    if (!button) return;
    e.preventDefault();
    setButtonState(button, true);
  });
  window.addEventListener("keyup", (e) => {
    const button = KEY_MAP[e.key.toLowerCase()];
    if (!button) return;
    e.preventDefault();
    setButtonState(button, false);
  });
}

// Compartido con el joystick táctil (touch_controls.js): mismo estado, misma
// llamada a WasmBoy, para que teclado y pantalla puedan combinarse sin pisarse
// (p.ej. mantener una dirección con el dedo y tocar A con otro dedo).
export function setButtonState(button, pressed) {
  joypadState = { ...joypadState, [button]: pressed };
  WasmBoy.setJoypadState(joypadState);
}

export async function playEmulator() {
  await WasmBoy.play();
}

// Safari (y otros navegadores) exigen que reanudar el audio esté
// "pegado" a un gesto real del usuario (clic/tap). Si en el medio hay
// varios pasos asíncronos (leer archivos, IndexedDB) antes de llamar a
// play(), el navegador a veces ya no lo considera parte del mismo gesto y
// el audio queda mudo — de forma errática, según cuánto haya tardado todo
// lo demás. Por eso esto se llama aparte, ANTES de cualquier otra cosa,
// directo desde el handler del clic.
export async function resumeAudio() {
  await WasmBoy.resumeAudioContext();
}

export async function pauseEmulator() {
  await WasmBoy.pause();
}

export async function resetEmulator() {
  await WasmBoy.reset();
  await WasmBoy.play();
}

// Autoguardado invisible: la RAM de cartucho (el equivalente al .sav) se
// persiste sola en la IndexedDB propia de wasmboy, y esa misma librería la
// restaura sola la próxima vez que se cargue la misma ROM (el juego
// arranca directo mostrando "Continuar", como con una pila real). Nada de
// esto pasa por saveState()/loadState() — resultó ser mucho más frágil
// (ver notas en importRawSav más abajo) y no hace falta para este caso: un
// save de cartucho es todo lo que se necesita para no perder avance.
export async function persistCartridgeRam() {
  if (!WasmBoy.isLoadedAndStarted()) return;
  await WasmBoy.saveLoadedCartridge();
}

export async function readMemorySection(start, end) {
  return WasmBoy._getWasmMemorySection(start, end);
}

export function isReady() {
  return WasmBoy.isLoadedAndStarted();
}

// "wasm" o un fallback en JS puro si el navegador no soportó WebAssembly.
// Si es el fallback, la memoria no vive donde esperamos y hay que saberlo.
export function getCoreType() {
  return WasmBoy.getCoreType();
}

// --- Guardado portable (.sav) ---
// El .sav es la RAM de cartucho cruda: el mismo formato que usan VBA, mGBA,
// BGB, RetroArch, hardware real, etc. Se lee/escribe directo en la misma
// IndexedDB ("wasmboy" / store "keyval") que usa la librería para
// persistir el cartucho, bajo la clave que ella misma calcula
// (_getCartridgeInfo().header) — así aprovechamos su propio mecanismo de
// restauración en vez de reinventar uno.
//
// Por qué NO usamos saveState()/loadState() para esto (como se intentó
// antes): esa API resultó tener demasiadas trampas para este caso —
// necesita 4 campos que solo se completan si el juego corrió frames
// recientes, pausa el emulador sin avisar, y su propio reset() vuelve a
// pisar lo que se acaba de cargar si no se hace en el orden exacto. La RAM
// de cartucho sola alcanza para lo que necesitamos (traer un save de otro
// emulador) sin ninguna de esas complicaciones.
const WASMBOY_DB_NAME = "wasmboy";
const WASMBOY_STORE_NAME = "keyval";

function openWasmBoyDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(WASMBOY_DB_NAME, 1);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function idbGet(db, key) {
  return new Promise((resolve, reject) => {
    const req = db.transaction(WASMBOY_STORE_NAME, "readonly").objectStore(WASMBOY_STORE_NAME).get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function idbPut(db, key, value) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(WASMBOY_STORE_NAME, "readwrite");
    tx.objectStore(WASMBOY_STORE_NAME).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// Descarga la RAM de cartucho actual como .sav crudo, compatible con
// cualquier otro emulador (o para llevarla a otro dispositivo).
export async function exportRawSav(romName) {
  const info = await WasmBoy._getCartridgeInfo();
  const blob = new Blob([info.RAM], { type: "application/octet-stream" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${(romName || "partida").replace(/\.(gb|gbc)$/i, "")}.sav`;
  a.click();
  URL.revokeObjectURL(url);
}

// Umbral mínimo para descartar archivos que claramente no son un .sav de
// Game Boy (ej. subiste otra cosa por error). Cualquier cartucho con
// batería real tiene al menos un banco de RAM de 2KB.
const MIN_PLAUSIBLE_SAV_BYTES = 2048;

// El header del cartucho (usado como clave en la IndexedDB de wasmboy) son
// simplemente los bytes 0x134-0x14F de la ROM — región estándar y fija del
// hardware Game Boy (gbdev.gg8.se/wiki/articles/The_Cartridge_Header), no
// algo que dependa de tener el core cargado. El tamaño esperado de RAM
// tampoco: sale del byte 0x147 (tipo de cartucho/MBC), replicando la misma
// tabla que usa el propio núcleo de wasmboy (lib/wasmboy/worker/memory/ram.js).
// Poder calcular ambos a partir del archivo ROM crudo, SIN cargarlo antes,
// es lo que permite escribir el save correcto antes de la primera carga —
// evitando por completo el problema de "reset() pisa lo recién escrito"
// que tienen los intentos de inyectar un save a mitad de sesión.
function cartridgeHeaderFromRom(romBytes) {
  return romBytes.slice(0x134, 0x14f);
}

function expectedRamSizeFromRom(romBytes) {
  const cartridgeType = romBytes[0x147];
  if (cartridgeType === 0x00) return 0;
  if (cartridgeType >= 0x01 && cartridgeType <= 0x03) return 0x8000; // MBC1
  if (cartridgeType >= 0x05 && cartridgeType <= 0x06) return 0x800; // MBC2
  if (cartridgeType >= 0x0f && cartridgeType <= 0x13) return 0x8000; // MBC3 (Pokémon R/B/Y)
  if (cartridgeType >= 0x19 && cartridgeType <= 0x1e) return 0x20000; // MBC5
  return 0;
}

// wasmboy tiene un SEGUNDO mecanismo de guardado, aparte de la IndexedDB:
// ante beforeunload/unload/pagehide/pestaña oculta, guarda una copia de
// emergencia de la RAM de cartucho en localStorage (clave
// "WASMBOY_UNLOAD_STORAGE") para no perder progreso si la pestaña se
// cierra de golpe, y la primera vez que se carga cualquier ROM en una
// pestaña, si encuentra algo ahí lo restaura a la IndexedDB. Esa
// protección es buena y la dejamos activa tal cual.
//
// El problema es solo cuando el usuario sube un .sav explícitamente: ahí
// SÍ queremos que ese archivo mande, y que el guardado de emergencia
// arranque de cero a partir de él — no que una copia vieja (de una
// sesión anterior, en la misma pestaña) se cuele y pise lo que el usuario
// acaba de subir a propósito. Por eso el borrado de esta protección es
// condicional: solo cuando hay un .sav adjunto, nunca cuando se arranca
// "tal cual estaba" sin adjuntar nada.
const WASMBOY_UNLOAD_STORAGE_KEY = "WASMBOY_UNLOAD_STORAGE";

// Carga una ROM por primera vez en la sesión, con un .sav opcional ya
// aplicado desde el arranque (si no se pasa, sigue tal cual estaba /
// empieza una partida nueva, según lo que ya haya guardado).
export async function loadRomWithOptionalSave(romFile, savFile) {
  const romBytes = new Uint8Array(await romFile.arrayBuffer());

  if (savFile) {
    const uploadedBytes = new Uint8Array(await savFile.arrayBuffer());
    if (uploadedBytes.length < MIN_PLAUSIBLE_SAV_BYTES) {
      throw new Error(`El .sav tiene solo ${uploadedBytes.length} bytes — no parece un guardado de Game Boy.`);
    }

    const expectedLength = expectedRamSizeFromRom(romBytes);
    let cartridgeRam = uploadedBytes;
    if (expectedLength && uploadedBytes.length !== expectedLength) {
      console.warn(
        `[gbc-web-player] .sav de ${uploadedBytes.length} bytes, esta ROM espera ${expectedLength} — ajustando tamaño.`
      );
      cartridgeRam = new Uint8Array(expectedLength);
      cartridgeRam.set(uploadedBytes.subarray(0, Math.min(uploadedBytes.length, expectedLength)));
    }

    // Recién acá, porque el usuario pidió explícitamente usar ESTE
    // archivo: cualquier copia de emergencia vieja queda descartada para
    // que no vuelva a colarse, y de acá en adelante el autoguardado
    // (emergencia + el de cada 10s) arranca de cero desde este .sav.
    localStorage.removeItem(WASMBOY_UNLOAD_STORAGE_KEY);

    const header = cartridgeHeaderFromRom(romBytes);
    const db = await openWasmBoyDb();
    await idbPut(db, header, { cartridgeRam });
    db.close();
  }

  await WasmBoy.loadROM(romFile);
  await WasmBoy.play();
}
