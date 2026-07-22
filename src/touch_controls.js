import { setButtonState } from "./emulator.js";

export function isTouchDevice() {
  return "ontouchstart" in window || navigator.maxTouchPoints > 0;
}

// Un botón puede recibir tanto punteros táctiles como de mouse; lo que
// importa es que press/release siempre se emparejen, incluso si el dedo se
// desliza fuera del botón sin soltar (pointerleave) o el gesto se cancela
// (pointercancel) — si no, un botón queda "trabado" presionado.
function bindPressable(el) {
  const button = el.dataset.button;
  const press = (e) => {
    e.preventDefault();
    el.classList.add("pressed");
    setButtonState(button, true);
  };
  const release = (e) => {
    e.preventDefault();
    el.classList.remove("pressed");
    setButtonState(button, false);
  };
  el.addEventListener("pointerdown", press);
  el.addEventListener("pointerup", release);
  el.addEventListener("pointercancel", release);
  el.addEventListener("pointerleave", release);
}

// Solo tiene sentido en pantallas táctiles sin teclado — el llamador decide
// si mostrar el contenedor según isTouchDevice(); acá solo conectamos los
// botones (no hace daño dejarlos conectados aunque el contenedor esté oculto).
export function initTouchControls(container) {
  container.querySelectorAll("[data-button]").forEach(bindPressable);
}
