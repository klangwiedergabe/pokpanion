import { CANVAS_ID } from "./config.js";
import {
  initEmulator,
  loadRomWithOptionalSave,
  playEmulator,
  pauseEmulator,
  resetEmulator,
  persistCartridgeRam,
  exportRawSav,
  readMemorySection,
  resumeAudio,
  isReady,
} from "./emulator.js";
import { Companion } from "./companion.js";
import { initTouchControls, isTouchDevice } from "./touch_controls.js";
import { t, getLang, setLang, onLangChange } from "./i18n.js";

const canvas = document.getElementById(CANVAS_ID);
const romInput = document.getElementById("rom-input");
const savInput = document.getElementById("sav-input");
const btnStart = document.getElementById("btn-start");
const setupPanel = document.getElementById("setup-panel");
const playControls = document.getElementById("play-controls");
const advisorEl = document.getElementById("advisor");
const btnPlay = document.getElementById("btn-play");
const btnPause = document.getElementById("btn-pause");
const btnReset = document.getElementById("btn-reset");
const btnExportSav = document.getElementById("btn-export-sav");
const statusEl = document.getElementById("status");
const menuToggle = document.getElementById("menu-toggle");
const menuPanel = document.getElementById("menu-panel");
const touchControlsEl = document.getElementById("touch-controls");
const langButtons = document.querySelectorAll("#lang-switch [data-lang]");

let currentRomName = null;
// Distingue "el usuario tocó Pause a propósito" de "el navegador puso el
// audio en pausa solo al perder foco la pestaña" — solo queremos
// reanudar automáticamente en el segundo caso.
let userPaused = false;
// Para poder reconstruir el texto de estado correcto si cambiás de idioma
// a mitad de partida (en vez de perder el "Jugando X" y volver al inicial).
let gameStarted = false;

function setStatus(text) {
  statusEl.textContent = text;
}

function openMenu() {
  menuPanel.classList.add("open");
  menuToggle.classList.add("open");
  menuToggle.setAttribute("aria-expanded", "true");
  menuToggle.setAttribute("aria-label", t("menuToggleClose"));
}

function closeMenu() {
  menuPanel.classList.remove("open");
  menuToggle.classList.remove("open");
  menuToggle.setAttribute("aria-expanded", "false");
  menuToggle.setAttribute("aria-label", t("menuToggleOpen"));
}

// Traduce todo lo estático (atributos data-i18n[-aria-label]) y recompone
// el texto de estado según en qué parte del flujo estemos — se llama al
// arrancar y cada vez que se cambia de idioma.
function applyTranslations() {
  document.documentElement.lang = getLang();
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    el.textContent = t(el.dataset.i18n);
  });
  document.querySelectorAll("[data-i18n-aria-label]").forEach((el) => {
    el.setAttribute("aria-label", t(el.dataset.i18nAriaLabel));
  });
  menuToggle.setAttribute("aria-label", t(menuPanel.classList.contains("open") ? "menuToggleClose" : "menuToggleOpen"));
  langButtons.forEach((btn) => btn.classList.toggle("active", btn.dataset.lang === getLang()));
  setStatus(gameStarted ? t("statusPlaying", { rom: currentRomName }) : t("statusInitial"));
}

langButtons.forEach((btn) => {
  btn.addEventListener("click", () => setLang(btn.dataset.lang));
});
onLangChange(applyTranslations);
applyTranslations();

menuToggle.addEventListener("click", (e) => {
  e.stopPropagation();
  if (menuPanel.classList.contains("open")) {
    closeMenu();
  } else {
    openMenu();
  }
});

// Cerrar al tocar afuera del menú (y no en el botón que lo abre/cierra).
// En fase de "captura": el canvas de wasmboy tiene su propio listener de
// clic (para desbloquear audio) que llama stopPropagation, así que un
// listener en fase de burbuja normal nunca se enteraría de esos clics.
document.addEventListener(
  "click",
  (e) => {
    if (!menuPanel.classList.contains("open")) return;
    if (menuPanel.contains(e.target) || menuToggle.contains(e.target)) return;
    closeMenu();
  },
  { capture: true }
);

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeMenu();
});

// Algunas promesas internas de wasmboy a veces rechazan con `undefined` en
// vez de un Error real (p.ej. cuando el worker "descarta" un mensaje). Sin
// esto, `err.message` explota con un segundo error y tapa el original.
function describeError(err) {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  return t("genericError");
}

async function boot() {
  await initEmulator(canvas);
  initTouchControls(touchControlsEl);

  const companion = new Companion({
    container: document.getElementById("party-list"),
    advisorContainer: advisorEl,
    readMemory: readMemorySection,
  });
  companion.start();

  // El compañero lee memoria en vivo cada poco tiempo. Mientras el ROM se
  // (re)carga o se resetea, el worker interno de wasmboy pasa por estados
  // intermedios (memoria reasignada, ROM recargándose) donde esa lectura
  // puede fallar de forma rara. Frenamos el polling durante esas
  // operaciones y lo retomamos siempre al final, pase lo que pase.
  async function withCompanionPaused(task) {
    companion.stop();
    try {
      await task();
    } finally {
      companion.start();
    }
  }

  // El botón "Comenzar" solo se habilita cuando hay una ROM elegida; el
  // .sav es opcional (arranca de cero si no se adjunta ninguno).
  romInput.addEventListener("change", () => {
    btnStart.disabled = !romInput.files[0];
  });

  btnStart.addEventListener("click", () => {
    // Tiene que ser lo primero, sin ningún await antes: es lo único que
    // queda "pegado" al gesto del clic para que Safari acepte reanudar el
    // audio. Todo lo demás (leer archivos, cargar la ROM) va después.
    resumeAudio();
    userPaused = false;
    withCompanionPaused(async () => {
      const romFile = romInput.files[0];
      if (!romFile) return;
      const savFile = savInput.files[0] || null;
      currentRomName = romFile.name;
      setStatus(
        savFile ? t("statusLoadingWithSav", { rom: romFile.name, sav: savFile.name }) : t("statusLoading", { rom: romFile.name })
      );
      try {
        await loadRomWithOptionalSave(romFile, savFile);
        setupPanel.style.display = "none";
        playControls.style.display = "flex";
        advisorEl.style.display = "block";
        if (isTouchDevice()) touchControlsEl.style.display = "flex";
        gameStarted = true;
        setStatus(t("statusPlaying", { rom: romFile.name }));
        closeMenu();
      } catch (err) {
        console.error(err);
        setStatus(t("statusError", { msg: describeError(err) }));
      }
    });
  });

  btnPlay.addEventListener("click", () => {
    userPaused = false;
    resumeAudio();
    playEmulator();
  });
  btnPause.addEventListener("click", () => {
    userPaused = true;
    pauseEmulator();
  });
  btnReset.addEventListener("click", () => {
    userPaused = false;
    withCompanionPaused(() => resetEmulator());
  });

  btnExportSav.addEventListener("click", async () => {
    setStatus(t("statusDownloadingSav"));
    await exportRawSav(currentRomName);
    setStatus(t("statusPlaying", { rom: currentRomName }));
  });

  // Autoguardado silencioso de la RAM de cartucho (el .sav) a IndexedDB,
  // sin intervención del usuario. Así se puede cerrar la pestaña y volver
  // más tarde: al recargar la misma ROM (desde la pantalla de inicio),
  // wasmboy la restaura sola.
  setInterval(() => {
    if (isReady()) persistCartridgeRam();
  }, 10_000);
  window.addEventListener("beforeunload", () => {
    if (isReady()) persistCartridgeRam();
  });
  document.addEventListener("visibilitychange", () => {
    if (!isReady()) return;
    if (document.visibilityState === "hidden") {
      persistCartridgeRam();
    } else if (document.visibilityState === "visible" && !userPaused) {
      // Los navegadores suspenden el audio de pestañas en segundo plano
      // por su cuenta. Si el usuario no pausó a propósito, reconectamos
      // audio y juego al volver — sin esto, quedaba mudo hasta que se
      // tocara Play manualmente.
      resumeAudio();
      playEmulator();
    }
  });
}

boot();
