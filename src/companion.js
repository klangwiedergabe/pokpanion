import {
  readPartyFromMemory,
  readDebugSnapshot,
  readBattleState,
  readCurrentMap,
  readBadges,
  readEnemyPartyFromMemory,
  readBagFromMemory,
} from "./memory.js";
import { SPECIES_INDEX_TO_NAME } from "./species_table.js";
import { MOVE_DATA } from "./moves_table.js";
import { TYPE_ID_TO_NAME, isSpecialType } from "./type_table.js";
import { typeEffectiveness } from "./type_chart.js";
import { GROWTH_RATE, totalExpForLevel } from "./growth_data.js";
import { EVOLUTION_DATA, LEVELUP_MOVES } from "./evolution_movepool.js";
import { MAP_ID_TO_NAME } from "./map_table.js";
import { LOCATION_TIPS, MAP_ID_TO_BADGE_BIT } from "./location_tips.js";
import { TM_DATA, TM_ITEM_ID_START, TM_ITEM_ID_END } from "./tm_table.js";
import { MEMORY_POLL_INTERVAL_MS } from "./config.js";
import { isReady, getCoreType } from "./emulator.js";
import { t, getLang, onLangChange } from "./i18n.js";

// Cuánto dura en pantalla el aviso de "acabás de conseguir esto" antes de
// volver al consejo normal de ubicación (pedido explícito: una ventana
// breve, no para siempre).
const ITEM_ADVICE_WINDOW_MS = 60_000;
// A partir de cuántos niveles de diferencia consideramos al rival "mucho
// más débil" como para sugerir ahorrar PP del movimiento más fuerte.
const LEVEL_GAP_THRESHOLD = 5;
// Umbral de utilidad mínima para recomendar enseñar una TM en vez de venderla.
const TM_TEACH_THRESHOLD = 15;

// Bits del byte de estado (macros/ram.asm + constants/battle_constants.asm):
// 0-2 sueño (turnos restantes), 3 veneno, 4 quemado, 5 congelado, 6 paralizado.
function statusLabel(status) {
  if (status === 0) return "";
  if (status & 0x40) return t("statusPAR");
  if (status & 0x20) return t("statusFRZ");
  if (status & 0x10) return t("statusBRN");
  if (status & 0x08) return t("statusPSN");
  if (status & 0x07) return t("statusSLP");
  return "";
}

// Cuánta EXP le falta para el próximo nivel (null si ya es nivel 100).
function expToNextLevel(mon) {
  if (mon.level >= 100) return null;
  const rate = GROWTH_RATE[mon.speciesIndex] || "medium_fast";
  const needed = totalExpForLevel(rate, mon.level + 1);
  return Math.max(0, needed - mon.exp);
}

// Próximo movimiento que aprende por nivel (no incluye TMs/HMs ni el
// moveset inicial, que ya lo tiene). El nombre del movimiento es el del
// cartucho (inglés) — no se traduce.
function nextLevelUpMove(mon) {
  const learnset = LEVELUP_MOVES[mon.speciesIndex] || [];
  const next = learnset.find((entry) => entry.level > mon.level);
  if (!next) return null;
  const move = MOVE_DATA[next.moveId];
  return { level: next.level, name: move ? move.name : `#${next.moveId}` };
}

// Próxima evolución: prioriza la que es por nivel (para poder decir "en
// cuánto"); si solo evoluciona por objeto/intercambio, lo aclara igual.
function nextEvolution(mon) {
  const evos = EVOLUTION_DATA[mon.speciesIndex];
  if (!evos || !evos.length) return null;
  const evo = evos.find((e) => e.method === "level") || evos[0];
  const targetName = SPECIES_INDEX_TO_NAME[evo.into] || `#${evo.into}`;
  if (evo.method === "level") return { text: t("evoByLevel", { name: targetName, level: evo.level }), level: evo.level };
  if (evo.method === "item") return { text: t("evoByItem", { name: targetName }), level: null };
  return { text: t("evoByTrade", { name: targetName }), level: null };
}

function typeNamesFromRaw(type1, type2) {
  const t1 = TYPE_ID_TO_NAME[type1];
  const t2 = type1 === type2 ? null : TYPE_ID_TO_NAME[type2];
  return [t1, t2].filter(Boolean);
}

function effLabel(mult) {
  if (mult === 0) return t("effNone");
  if (mult < 1) return t("effNotVery");
  if (mult > 1) return t("effSuper");
  return t("effNormal");
}

// Mejor movimiento de daño de `mon` contra `enemyTypes`. Si `mon` trae
// stats (attack/special, como los que da readPartyFromMemory), pondera por
// el stat real correspondiente al tipo del movimiento; si no (fallback con
// datos más flacos), lo ignora sin romper el cálculo. Nunca recomienda un
// movimiento sin PP — antes se quedaba sugiriendo uno ya gastado.
function bestMoveAgainst(mon, enemyTypes, excludeMoveId) {
  const monTypes = typeNamesFromRaw(mon.type1, mon.type2);
  let best = null;
  mon.moves.forEach((id, idx) => {
    if (id === 0 || id === excludeMoveId) return;
    if (mon.pp && mon.pp[idx] === 0) return;
    const move = MOVE_DATA[id];
    if (!move || !move.power) return; // movidas de estado: no hay "efectividad" que calcular
    const stab = monTypes.includes(move.type) ? 1.5 : 1;
    const statFactor = (isSpecialType(move.type) ? mon.special : mon.attack) ?? 1;
    const mult = typeEffectiveness(move.type, enemyTypes);
    const score = move.power * (move.accuracy / 100) * stab * mult * statFactor;
    if (!best || score > best.score) best = { moveId: id, move, score, mult };
  });
  return best;
}

// El movimiento MÁS FLOJO que igual alcanza (neutral o mejor) contra este
// rival, para gastar PP del más fuerte solo cuando realmente hace falta.
function weakestAdequateMove(mon, enemyTypes, excludeMoveId) {
  let weakest = null;
  mon.moves.forEach((id, idx) => {
    if (id === 0 || id === excludeMoveId) return;
    if (mon.pp && mon.pp[idx] === 0) return;
    const move = MOVE_DATA[id];
    if (!move || !move.power) return;
    const mult = typeEffectiveness(move.type, enemyTypes);
    if (mult < 1) return; // tiene que alcanzar igual, no resistido ni inmune
    if (!weakest || move.power < weakest.move.power) weakest = { moveId: id, move, mult };
  });
  return weakest;
}

// El próximo hito relevante para este Pokémon (lo que "se viene" antes):
// aprender un movimiento por nivel o evolucionar por nivel. Ignora
// evoluciones por objeto/intercambio para este cálculo — no tienen un
// "en cuántos niveles" predecible.
function nextMilestone(mon) {
  const candidates = [];
  const nm = nextLevelUpMove(mon);
  if (nm) candidates.push({ levelsAway: nm.level - mon.level, text: t("learnsMoveAt", { move: nm.name, level: nm.level }) });
  const ne = nextEvolution(mon);
  if (ne && ne.level) candidates.push({ levelsAway: ne.level - mon.level, text: t("evolvesAt", { level: ne.level }) });
  if (!candidates.length) return null;
  candidates.sort((a, b) => a.levelsAway - b.levelsAway);
  return candidates[0];
}

// Qué Pokémon conviene llevar a la cabeza del equipo pensando en lo que se
// viene (aprender un movimiento bueno, evolucionar), no en el combate
// puntual de ahora.
function bestLeadPick(party) {
  const withMilestones = party
    .filter((m) => m.currentHp > 0)
    .map((mon) => ({ mon, milestone: nextMilestone(mon) }))
    .filter((c) => c.milestone && c.milestone.levelsAway > 0);
  if (!withMilestones.length) return null;
  withMilestones.sort((a, b) => a.milestone.levelsAway - b.milestone.levelsAway);
  return withMilestones[0];
}

function isTmItem(itemId) {
  return itemId >= TM_ITEM_ID_START && itemId <= TM_ITEM_ID_END;
}

function tmNumberFromItemId(itemId) {
  return itemId - TM_ITEM_ID_START + 1;
}

// Utilidad genérica de un movimiento para un Pokémon (sin rival puntual en
// mente) — para comparar "esta TM ¿es mejor que lo que ya tiene?".
function moveUtility(mon, moveId) {
  const move = MOVE_DATA[moveId];
  if (!move || !move.power) return -1; // movidas de estado quedan como "siempre reemplazables"
  const monTypes = typeNamesFromRaw(mon.type1, mon.type2);
  const stab = monTypes.includes(move.type) ? 1.5 : 1;
  return move.power * (move.accuracy / 100) * stab;
}

// Para una TM, busca en qué Pokémon del equipo (vivo, que no la sepa ya)
// conviene más enseñarla, reemplazando su movimiento actual más flojo.
function bestTmFit(tmMoveId, party) {
  let best = null;
  for (const mon of party) {
    if (mon.currentHp <= 0) continue;
    if (mon.moves.includes(tmMoveId)) continue;
    const newUtil = moveUtility(mon, tmMoveId);
    let weakestIdx = -1;
    let weakestUtil = Infinity;
    mon.moves.forEach((mvId, idx) => {
      if (mvId === 0) {
        weakestIdx = idx;
        weakestUtil = -1;
        return;
      }
      const u = moveUtility(mon, mvId);
      if (u < weakestUtil) {
        weakestUtil = u;
        weakestIdx = idx;
      }
    });
    const delta = newUtil - weakestUtil;
    if (!best || delta > best.delta) {
      best = { mon, replaceMoveId: mon.moves[weakestIdx], delta };
    }
  }
  return best;
}

// Consejo de bolsillo para una TM concreta: a quién enseñársela, o si
// conviene mejor venderla porque no mejora a nadie del equipo actual.
function tmAdvice(tmNumber, party) {
  const tm = TM_DATA[tmNumber];
  if (!tm) return null;
  const move = MOVE_DATA[tm.moveId];
  if (!move) return null;
  const label = `TM${String(tmNumber).padStart(2, "0")} (${move.name})`;
  const fit = bestTmFit(tm.moveId, party);
  if (fit && fit.delta > TM_TEACH_THRESHOLD) {
    const monName = SPECIES_INDEX_TO_NAME[fit.mon.speciesIndex] || `#${fit.mon.speciesIndex}`;
    const oldName = fit.replaceMoveId ? MOVE_DATA[fit.replaceMoveId]?.name || `#${fit.replaceMoveId}` : null;
    const replaceText = oldName ? t("tmReplacing", { old: oldName }) : t("tmEmptySlot");
    return t("tmTeach", { label, mon: monName, replaceText });
  }
  if (tm.sellPrice > 0) {
    return t("tmSell", { label, price: tm.sellPrice });
  }
  return t("tmNotUseful", { label });
}

// Panel simplificado: tabla de equipo en el sidebar + un único consejero de
// pocas líneas debajo de la pantalla (batalla si hay una en curso, aviso de
// un ítem recién conseguido, o ubicación + sugerencia de líder/mochila
// cuando estás caminando). Si no encuentra datos válidos, muestra un
// volcado crudo de memoria en el mismo panel para diagnosticar de un vistazo.
export class Companion {
  constructor({ container, advisorContainer, readMemory }) {
    this.container = container;
    this.advisorContainer = advisorContainer;
    this.readMemory = readMemory;
    this.pollHandle = null;
    this.previousBag = null;
    this.pickupAdviceText = null;
    this.pickupAdviceUntil = 0;
    this.idleTick = 0;
    // Si cambiás el idioma a mitad de partida, no esperamos al próximo
    // poll (hasta 500ms) — se re-renderiza al toque.
    onLangChange(() => this.poll());
  }

  start() {
    this.stop();
    this.pollHandle = setInterval(() => this.poll(), MEMORY_POLL_INTERVAL_MS);
    this.poll();
  }

  stop() {
    if (this.pollHandle) clearInterval(this.pollHandle);
    this.pollHandle = null;
  }

  async poll() {
    if (!isReady()) {
      this.renderMessage(t("companionEmpty"));
      this.advisorContainer.innerHTML = "";
      return;
    }

    let party = [];
    try {
      party = await readPartyFromMemory(this.readMemory);
    } catch (err) {
      console.error("Companion: error leyendo el equipo", err);
      await this.renderDiagnostic(err);
      return;
    }

    if (!party.length) {
      await this.renderDiagnostic(null);
      return;
    }

    try {
      this.renderTable(party);
    } catch (err) {
      console.error("Companion: error renderizando la tabla", err);
    }

    let bag = [];
    try {
      bag = await readBagFromMemory(this.readMemory);
      this.detectPickup(bag, party);
    } catch (err) {
      console.error("Companion: error leyendo la mochila", err);
    }

    try {
      const battleState = await readBattleState(this.readMemory);
      if (battleState && battleState.active) {
        await this.renderBattleAdvice(battleState, party);
      } else {
        const [mapId, badgeMask] = await Promise.all([readCurrentMap(this.readMemory), readBadges(this.readMemory)]);
        this.renderIdleAdvice(party, mapId, bag, badgeMask);
      }
    } catch (err) {
      console.error("Companion: error en el consejero", err);
    }
  }

  // Compara la mochila contra la lectura anterior: si algo nuevo apareció o
  // aumentó de cantidad, lo tratamos como "recién conseguido" y —si es una
  // TM— abrimos una ventana de 60s con el consejo de enseñarla o venderla.
  detectPickup(bag, party) {
    if (this.previousBag) {
      const prevMap = new Map(this.previousBag.map((it) => [it.itemId, it.quantity]));
      for (const item of bag) {
        const prevQty = prevMap.get(item.itemId) || 0;
        if (item.quantity > prevQty) {
          if (isTmItem(item.itemId)) {
            this.pickupTmNumber = tmNumberFromItemId(item.itemId);
            this.pickupAdviceUntil = Date.now() + ITEM_ADVICE_WINDOW_MS;
          }
          break;
        }
      }
    }
    this.previousBag = bag;
  }

  renderMessage(text) {
    this.container.innerHTML = "";
    const div = document.createElement("div");
    div.style.color = "#777";
    div.style.fontSize = "12px";
    div.textContent = text;
    this.container.appendChild(div);
  }

  // Ordenada por quién está más cerca de subir de nivel (menos EXP le
  // falta primero). No muestra los movimientos actuales (eso ya se ve en
  // cada batalla) — muestra hacia dónde va: próximo movimiento a aprender
  // y próxima evolución.
  renderTable(party) {
    const enriched = party.map((mon) => ({
      mon,
      remainingExp: expToNextLevel(mon),
      nextMove: nextLevelUpMove(mon),
      nextEvo: nextEvolution(mon),
    }));

    enriched.sort((a, b) => {
      if (a.remainingExp === null) return 1; // Nv. 100 al final
      if (b.remainingExp === null) return -1;
      return a.remainingExp - b.remainingExp;
    });

    const rows = enriched
      .map(({ mon, remainingExp, nextMove, nextEvo }) => {
        const name = SPECIES_INDEX_TO_NAME[mon.speciesIndex] || `#${mon.speciesIndex}`;
        const status = statusLabel(mon.status);
        const expText = remainingExp === null ? t("maxLevel") : t("expSuffix", { n: remainingExp });
        const moveText = nextMove ? t("learnsMoveAt", { move: nextMove.name, level: nextMove.level }) : "—";
        const evoText = nextEvo ? nextEvo.text : "—";
        return `<tr>
          <td>${name}${status ? ` <span style="color:#e0b34c">${status}</span>` : ""}</td>
          <td>${mon.level}</td>
          <td>${expText}</td>
          <td>${moveText}</td>
          <td>${evoText}</td>
        </tr>`;
      })
      .join("");

    this.container.innerHTML = `
      <table style="width:100%; border-collapse: collapse; font-size: 12px">
        <thead>
          <tr style="text-align:left; opacity:.7">
            <th>${t("tableHeadPokemon")}</th><th>${t("tableHeadLevel")}</th><th>${t("tableHeadToLevelUp")}</th><th>${t("tableHeadNextMove")}</th><th>${t("tableHeadNextEvo")}</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    `;
  }

  // Un consejito de entrenador, no una planilla: qué movimiento usar con
  // el Pokémon que está REALMENTE peleando ahora mismo. Recolecta mucho
  // (PP disponible, diferencia de nivel, equipo completo del rival si es
  // entrenador) pero solo muestra UNA línea secundaria — la más relevante,
  // no todo lo que calculó.
  async renderBattleAdvice(battleState, party) {
    const { enemy, active, isTrainerBattle } = battleState;
    const enemyName = SPECIES_INDEX_TO_NAME[enemy.speciesIndex] || `#${enemy.speciesIndex}`;
    const enemyTypes = typeNamesFromRaw(enemy.type1, enemy.type2);

    // El Pokémon activo trae stats y PP reales si lo encontramos en el
    // equipo (mismo especie+nivel); si no, seguimos con los datos más
    // flacos de la estructura de batalla en vez de no decir nada.
    const activeFull = party.find((m) => m.speciesIndex === active.speciesIndex && m.level === active.level);
    const activeMon = activeFull || active;
    const activeName = SPECIES_INDEX_TO_NAME[activeMon.speciesIndex] || `#${activeMon.speciesIndex}`;

    const activeBest = bestMoveAgainst(activeMon, enemyTypes);
    const mainAdvice = activeBest ? t("useMove", { move: activeBest.move.name, eff: effLabel(activeBest.mult) }) : t("noDamagingMoves");

    // Elegimos UNA sola línea secundaria, por prioridad: ahorrar PP >
    // cambiar de Pokémon > a quién mandará el rival después. Recolectamos
    // las tres pero solo mostramos la más útil para no saturar el mensaje.
    let secondaryLine = "";

    if (activeBest && activeMon.level - enemy.level >= LEVEL_GAP_THRESHOLD && activeBest.mult >= 1) {
      const cheaper = weakestAdequateMove(activeMon, enemyTypes, activeBest.moveId);
      if (cheaper && cheaper.move.power < activeBest.move.power * 0.7) {
        secondaryLine = t("saveYourPp", {
          enemyLv: enemy.level,
          yourLv: activeMon.level,
          move: cheaper.move.name,
          strong: activeBest.move.name,
        });
      }
    }

    if (!secondaryLine && activeBest) {
      const alternatives = party
        .filter((m) => m.currentHp > 0 && m.speciesIndex !== activeMon.speciesIndex)
        .map((m) => ({ mon: m, best: bestMoveAgainst(m, enemyTypes) }))
        .filter((c) => c.best && c.best.score > activeBest.score * 1.3)
        .sort((a, b) => b.best.score - a.best.score);
      if (alternatives.length) {
        const top = alternatives[0];
        const name = SPECIES_INDEX_TO_NAME[top.mon.speciesIndex] || `#${top.mon.speciesIndex}`;
        secondaryLine = t("switchSuggestion", { name, move: top.best.move.name });
      }
    }

    if (!secondaryLine && isTrainerBattle) {
      try {
        const enemyParty = await readEnemyPartyFromMemory(this.readMemory);
        const next = enemyParty.find(
          (m) => m.currentHp > 0 && !(m.speciesIndex === enemy.speciesIndex && m.level === enemy.level)
        );
        if (next) {
          const nextName = SPECIES_INDEX_TO_NAME[next.speciesIndex] || `#${next.speciesIndex}`;
          secondaryLine = t("nextEnemyMon", { name: nextName, level: next.level });
        }
      } catch (err) {
        console.error("Companion: error leyendo equipo rival", err);
      }
    }

    this.advisorContainer.innerHTML = `
      <div style="font-size:12px; background:#241c1c; border:1px solid #4a2f2f; border-radius:6px; padding:8px">
        <div style="opacity:.7">${t("battleHeading", { active: activeName, enemy: enemyName, level: enemy.level })}</div>
        <div style="margin-top:4px; font-size:13px">${mainAdvice}</div>
        ${secondaryLine ? `<div style="margin-top:6px; font-size:10px; opacity:.6">${secondaryLine}</div>` : ""}
      </div>
    `;
  }

  // Fuera de batalla: por defecto, dónde estás y a quién conviene llevar a
  // la cabeza pensando en lo que se viene. Pero no es la única voz posible
  // acá — rota con el aviso de un ítem recién conseguido (60s) o, si no hay
  // nada reciente, con una TM que ya tenés guardada y no usaste.
  renderIdleAdvice(party, mapId, bag, badgeMask) {
    const rotation = this.pickIdleContent(party, bag);
    if (rotation) {
      this.advisorContainer.innerHTML = `
        <div style="font-size:12px; background:#1c2430; border:1px solid #2f3a4a; border-radius:6px; padding:8px">
          <div style="opacity:.7">🎒 ${rotation.heading}</div>
          <div style="margin-top:4px; font-size:13px">${rotation.text}</div>
        </div>
      `;
      return;
    }

    const locationName = MAP_ID_TO_NAME[mapId] || `#${mapId}`;
    const badgeBit = MAP_ID_TO_BADGE_BIT[mapId];
    const alreadyBeaten = badgeBit !== undefined && ((badgeMask >> badgeBit) & 1) === 1;
    const gymTip = !alreadyBeaten ? LOCATION_TIPS[mapId]?.[getLang()] : null;

    const lead = bestLeadPick(party);
    let leadLine = t("noUpcomingMilestones");
    if (lead) {
      const name = SPECIES_INDEX_TO_NAME[lead.mon.speciesIndex] || `#${lead.mon.speciesIndex}`;
      const isAlreadyLead = party.indexOf(lead.mon) === 0;
      leadLine = isAlreadyLead
        ? t("alreadyLeading", { name, milestone: lead.milestone.text })
        : t("leadSuggestion", { name, milestone: lead.milestone.text });
    }

    this.advisorContainer.innerHTML = `
      <div style="font-size:12px; background:#1c2430; border:1px solid #2f3a4a; border-radius:6px; padding:8px">
        <div style="opacity:.7">📍 ${locationName}</div>
        <div style="margin-top:4px; font-size:13px">${leadLine}</div>
        ${gymTip ? `<div style="margin-top:6px; font-size:10px; opacity:.65">${gymTip}</div>` : ""}
      </div>
    `;
  }

  // Devuelve { heading, text } si toca mostrar algo de mochila en vez del
  // consejo de ubicación, o null si le toca el turno a la ubicación.
  pickIdleContent(party, bag) {
    if (this.pickupTmNumber && Date.now() < this.pickupAdviceUntil) {
      const advice = tmAdvice(this.pickupTmNumber, party);
      if (advice) return { heading: t("justGotSomething"), text: advice };
    }
    this.pickupTmNumber = null;

    // Cada ~10s (a 500ms por poll), si hay TMs sin usar en la mochila,
    // mostramos una de esas en vez de la ubicación — para no depender de
    // un único mensaje fijo todo el rato.
    this.idleTick += 1;
    const ownedTms = bag.filter((it) => isTmItem(it.itemId));
    if (ownedTms.length && this.idleTick % 20 >= 14) {
      const idx = Math.floor(this.idleTick / 20) % ownedTms.length;
      const advice = tmAdvice(tmNumberFromItemId(ownedTms[idx].itemId), party);
      if (advice) return { heading: t("inYourBag"), text: advice };
    }

    return null;
  }

  // Volcado crudo de la zona de memoria donde debería estar el equipo, para
  // poder ver a ojo si estamos apuntando al lugar correcto sin necesidad de
  // abrir la consola del navegador.
  async renderDiagnostic(err) {
    let snapshot;
    let coreType;
    try {
      snapshot = await readDebugSnapshot(this.readMemory);
      coreType = await getCoreType();
    } catch (diagErr) {
      this.renderMessage(t("diagCantDiagnose", { msg: diagErr.message }));
      return;
    }

    const allZero = snapshot.firstBytesHex && /^(00 )+00$/.test(snapshot.firstBytesHex.trim());
    const partyByteOk = snapshot.partyCountByte >= 1 && snapshot.partyCountByte <= 6;

    this.container.innerHTML = `
      <div style="font-size: 11px; line-height: 1.6; font-family: monospace">
        <div style="color:#e0b34c">${t("diagNoTeam", { errNote: err ? t("diagErrNote") : "" })}</div>
        <div>${t("diagCore", { core: coreType, warn: coreType !== "wasm" ? t("diagCoreWarn") : "" })}</div>
        <div>${t("diagBlockSize", { n: snapshot.blockLength })}</div>
        <div>${t("diagOffset", { offset: (snapshot.offsetUsed ?? 0).toString(16) })}</div>
        <div>${t("diagPartyByte", { byte: snapshot.partyCountByte, status: partyByteOk ? t("diagByteOk") : t("diagByteBad") })}</div>
        <div style="margin-top:4px; word-break: break-all">${t("diagWindow", { hex: snapshot.windowHex || t("diagEmpty") })}</div>
        <div style="margin-top:4px; word-break: break-all">${t("diagFirstBytes", { hex: snapshot.firstBytesHex || t("diagEmpty"), zeroNote: allZero ? t("diagAllZero") : "" })}</div>
      </div>
    `;
  }
}
