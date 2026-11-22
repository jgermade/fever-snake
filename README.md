# Fever Snake

A snake game that **mutates every 5 apples**. Eight worlds, each with its own
look, topology and controls, then it loops faster. The change is seamless: the
game never pauses. A portal opens at the snake's head; outside it the old world
keeps running while the snake slides into the portal, inside it the new world
is already live and the snake comes out at the same spot on screen, heading the
same way.

| # | World | What changes |
|---|-------|--------------|
| 1 | Neon Classic | Glowing synthwave grid, deadly borders |
| 2 | Retro 95 | Runs inside a beveled 1995-style desktop window |
| 3 | The Cube | 3D: crawl over the 6 faces of a cube, the camera rolls over the edges |
| 4 | Pocket LCD | 160x144 four-shade green handheld, edges wrap |
| 5 | Tube Maze | 3D: inside an endless tube (a torus) with ring walls to slip through |
| 6 | Terminal | ASCII text mode, CRT scanlines, `#` obstacles |
| 7 | Labyrinth | 3D first person: you are the head; left/right turn |
| 8 | Notebook | Boiling pencil doodle on lined paper |

Controls: arrows / WASD or swipe, `P`/`Space` pause, `M` mute. On touch screens
you can steer continuously: keep the finger down and draw the path (an "L"
turns twice). Arrows are
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
offline. When adding a runtime file, list it in `ASSETS` in `sw.js`
(`npm test` fails otherwise). The deploy workflow stamps the cache name with
the commit SHA so players get updates.

## Deploy to GitHub Pages

`.github/workflows/pages.yml` runs the tests and publishes the site on every
push to `main` (or manually via *Run workflow*).
One-time setup: **Settings → Pages → Build and deployment → Source: GitHub Actions**.

## Code map

- `src/snake.js` — topology-agnostic snake rules.
- `src/topologies/` — `grid.js` (rectangle / torus when wrapping), `cube.js`.
- `src/worlds/` — one module per world: topology, input mapping and renderer.
  `uvOf(cell)` / `screenOf(cell)` let the snake be carried between worlds;
  `render()` returns the head's screen position (the centre of the portal).
  `index.js` sets the order and `APPLES_PER_WORLD`.
- `src/main.js` — loop, world switching, HUD and overlays.
- `vendor/three.module.min.js` — three.js r170 (MIT, see `vendor/three.LICENSE`).

## Repository conventions

- [`AGENTS.md`](AGENTS.md) — rules for agents (`CLAUDE.md` symlinks to it).
- [`ROADMAP/`](ROADMAP/) — project plan by date, with Mermaid Gantt diagrams.
- [`RECORD/`](RECORD/) — project memory (`.WIP` append-only, `.completed` read-only).
