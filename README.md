# Fever Snake

A snake game that **mutates every 5 apples**. Eighteen worlds, each with its
own look, topology and controls, played **in a random order** (a new shuffle
every loop, never two 3D worlds in a row), then it loops faster. The change is
seamless: the game never pauses. A portal opens at the snake's head; outside it
the old world keeps running while the snake slides into it, inside it the new
world is already live and the snake comes out at the same spot on screen.
Arrivals are fair: the snake is placed with a long free runway ahead (never
facing a wall or obstacle) and its first moves are slowed down.

| World | What changes |
|-------|--------------|
| Neon Classic | Glowing synthwave grid, deadly borders |
| Retro 95 | Runs inside a beveled 1995-style desktop window |
| The Cube | 3D: crawl over the 6 faces of a cube, the camera rolls over the edges |
| Pocket LCD | 160x144 four-shade green handheld, edges wrap |
| Spreadsheet | The snake fills cells of an office spreadsheet (`=APPLE()`) |
| Tube Maze | 3D: inside an endless tube (a torus) with ring walls to slip through |
| Terminal | ASCII text mode, CRT scanlines, `#` obstacles |
| Portals | Colour-coded portal pairs teleport the head to their twin |
| Tiny Planet | 3D: a cubed-sphere planet you can walk all the way around |
| Isometric Garden | 2.5D floating island; controls rotated 45° |
| Labyrinth | 3D first person: you are the head; left/right turn |
| Lights Out | Pitch dark; only the snake's lantern lights the way |
| Möbius Strip | 3D: a one-sided band; after a lap you ride the other side, left/right swapped |
| Notebook | Boiling pencil doodle on lined paper |
| Deep Space | Vector graphics, wrapping edges, drifting asteroids |
| Vertigo | The board turns 90° every few seconds; arrows follow the screen |
| Checkmate | A giant chessboard; the pieces are obstacles |
| Aquarium | An eel among swaying kelp, coral, bubbles and fish |

Controls: arrows / WASD or swipe, `P`/`Space` pause, `M` mute. On touch screens
you can steer continuously: keep the finger down and draw the path (an "L"
turns twice); each detected turn gives a short vibration where supported. Arrows are
screen-relative in the 3D worlds. On the title screen, click a world to start
there (practice). `?world=N` in the URL also jumps straight to world N.

## Run locally

No build step, no dependencies — just static files.

```sh
npm start          # python3 -m http.server 8080, then open http://localhost:8080
npm test           # node --test (topologies, snake rules, service worker manifest)
```

The service worker is skipped on `localhost` unless the URL has `?sw`.

## Offline / PWA

`sw.js` precaches every file so the game installs as an app and works
offline. It is network-first, so a new deploy shows up on the next load. When adding a runtime file, list it in `ASSETS` in `sw.js`
(`npm test` fails otherwise). The deploy workflow stamps the cache name with
the commit SHA so players get updates.

## Deploy to GitHub Pages

`.github/workflows/pages.yml` runs the tests and publishes the site on every
push to `main` (or manually via *Run workflow*).
One-time setup: **Settings → Pages → Build and deployment → Source: GitHub Actions**.

## Code map

- `src/snake.js` — topology-agnostic snake rules.
- `src/topologies/` — `grid.js` (rectangle / torus when wrapping), `cube.js`
  (also used for the planet), `portal-grid.js`, `mobius.js`.
- `src/worlds/` — one module per world: topology, input mapping and renderer.
  `uvOf(cell)` / `screenOf(cell)` let the snake be carried between worlds;
  `render()` returns the head's screen position (the centre of the portal).
  `index.js` lists them and sets `APPLES_PER_WORLD`; `src/order.js` shuffles
  the order per run (3D worlds, `three: true`, are never adjacent);
  `src/placement.js` picks a fair arrival cell.
- `src/main.js` — loop, world switching, HUD and overlays.
- `vendor/three.module.min.js` — three.js r170 (MIT, see `vendor/three.LICENSE`).

## Repository conventions

- [`AGENTS.md`](AGENTS.md) — rules for agents (`CLAUDE.md` symlinks to it).
- [`ROADMAP/`](ROADMAP/) — project plan by date, with Mermaid Gantt diagrams.
- [`RECORD/`](RECORD/) — project memory (`.WIP` append-only, `.completed` read-only).
