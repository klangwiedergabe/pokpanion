# pokpanion

A web-based Game Boy Color player (built on [wasmboy](https://github.com/torch2424/wasmboy)) with a live "companion" panel that reads the emulator's memory while you play a Gen 1 Pokémon game and gives you short, practical advice — your team's status, what to do next, and battle suggestions — without spoiling anything you can already see on screen.

**This project does not include, host, or distribute any ROM.** You bring your own legally-owned `.gb`/`.gbc` file; it's read entirely in your browser (via the File API) and never uploaded anywhere.

## Features

- Play any Game Boy / Game Boy Color ROM in the browser, with keyboard controls and an on-screen touch joystick on touch devices.
- Attach an existing `.sav` on load to continue a save from another emulator, or start fresh.
- Silent auto-save (cartridge RAM persisted to IndexedDB) plus a one-click `.sav` export, portable to any other emulator.
- A companion panel for Gen 1 Pokémon games (Red/Blue/Yellow) that reads live game memory to show:
  - Your team, sorted by who's closest to their next level-up move or evolution.
  - A one-line battle recommendation (best move for your active Pokémon against the current enemy), including PP-awareness and "this enemy is much weaker, save your strong move's PP" advice, plus — for trainer battles — a guess at who they'll send out next.
  - Location-aware tips (which gym you're near and what to bring), automatically suppressed once you've already beaten that gym.
  - Bag-aware TM advice: when you pick up a new TM, a short window suggesting who to teach it to (or whether to just sell it), plus periodic reminders for TMs already sitting unused in your bag.
- English/Spanish UI switcher (persisted locally), reachable from the floating menu.

## Legal / data sources

No copyrighted game data (ROM bytes, sprites, text) is included. The static reference tables (species/move/item names, type chart, evolution and level-up data, WRAM addresses) were derived from the public [pret/pokeyellow](https://github.com/pret/pokeyellow) disassembly project (a reverse-engineering/documentation project, not ROM distribution) and cross-validated empirically against a live game session. Gym leader types/names are common public game knowledge.

## Setup

```bash
npm install
npm run dev
```

Open the printed local URL, then in the floating menu (bottom-right pokéball button) choose your ROM (and optionally a `.sav`) and hit Start.

## Build

```bash
npm run build
```

## Stack

Vite + vanilla JS, [wasmboy](https://github.com/torch2424/wasmboy) for emulation. No backend — everything runs client-side.
