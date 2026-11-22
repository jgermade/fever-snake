// Game shell: stage, loop, world switching, HUD and overlays.
import { Snake, randomFreeCell } from './snake.js';
import { WORLDS, APPLES_PER_WORLD } from './worlds/index.js';
import { bindInput } from './input.js';
import { sfx } from './audio.js';
import * as THREE from './render/three.js';

const $ = (sel) => document.querySelector(sel);
const BEST_KEY = 'fever-snake.best';
const WARP_SECONDS = 1.2; // length of the portal wipe between worlds
const ACTIONS = ['up', 'right', 'down', 'left'];

// ---------------------------------------------------------------- stage ---
const stage = (() => {
  const root = $('#stage');
  const canvas = $('#c2d');
  const glCanvas = $('#c3d');
  const ctx = canvas.getContext('2d');
  let gl = null;
  const s = {
    root,
    canvas,
    glCanvas,
    ctx,
    width: 0,
    height: 0,
    dpr: 1,
    /** Shared WebGL renderer; shows the 3D canvas while a 3D world is active. */
    getGL() {
      if (!gl) {
        gl = new THREE.WebGLRenderer({ canvas: glCanvas, antialias: true });
        gl.setPixelRatio(s.dpr);
        gl.setSize(s.width, s.height, false);
      }
      glCanvas.hidden = false;
      return gl;
    },
    beginWorld() {
      glCanvas.hidden = true;
    },
    resize() {
      s.dpr = Math.min(window.devicePixelRatio || 1, 2);
      s.width = root.clientWidth;
      s.height = root.clientHeight;
      canvas.width = Math.round(s.width * s.dpr);
      canvas.height = Math.round(s.height * s.dpr);
      ctx.setTransform(s.dpr, 0, 0, s.dpr, 0, 0);
      if (gl) {
        gl.setPixelRatio(s.dpr);
        gl.setSize(s.width, s.height, false);
      }
    },
  };
  return s;
})();

// ----------------------------------------------------------------- state ---
const game = {
  phase: 'title', // title | playing | paused | dying | over
  worldIndex: 0,
  loop: 0,
  world: null,
  inst: null,
  snake: null,
  apple: null,
  score: 0,
  applesInWorld: 0,
  acc: 0,
  alpha: 0,
  time: 0,
  worldTime: 0,
  best: readBest(),
  pendingWarp: false,
  headScreen: null,
  // Portal wipe: a snapshot of the previous world that is cut open from the head.
  transition: { active: false, elapsed: 0, snap: document.createElement('canvas'), mask: document.createElement('canvas') },
};

function readBest() {
  try {
    return Number(localStorage.getItem(BEST_KEY)) || 0;
  } catch {
    return 0;
  }
}

function saveBest() {
  if (game.score <= game.best) return false;
  game.best = game.score;
  try {
    localStorage.setItem(BEST_KEY, String(game.best));
  } catch {
    /* ignore */
  }
  return true;
}

function tickMs() {
  const base = game.world.tickMs * Math.pow(0.97, game.applesInWorld) * Math.pow(0.88, game.loop);
  return Math.max(55, base);
}

/** Which arrow key the snake is currently heading along, on screen. */
function screenAction(inst, snake) {
  const map = inst.placeMap ?? inst.mapAction;
  for (const a of ACTIONS) {
    const d = map(a, snake);
    if (d != null && inst.topology.sameDir(d, snake.dir)) return a;
  }
  return 'right';
}

/**
 * Finds where a snake arriving from another world should appear: the free
 * cell closest to the same spot on the board, heading the same way on screen,
 * with a few free cells ahead so the arrival is never an instant crash.
 */
function placeSnake(inst, carry) {
  if (!carry || !inst.uvOf) return inst.spawn;
  const topo = inst.topology;
  const map = inst.placeMap ?? inst.mapAction;
  const near = (inst.placeCells ?? topo.cells())
    .map((cell) => {
      const p = inst.uvOf(cell);
      return [cell, (p.u - carry.u) ** 2 + (p.v - carry.v) ** 2];
    })
    .sort((a, b) => a[1] - b[1])
    .slice(0, 80);
  for (const action of [carry.action, ...ACTIONS.filter((a) => a !== carry.action)]) {
    for (const [cell] of near) {
      const dir = map(action, { head: cell, dir: null });
      if (dir == null) continue;
      let c = cell;
      let d = dir;
      let ok = true;
      for (let k = 0; k < 4 && ok; k++) {
        const r = topo.step(c, d);
        if (!r) ok = false;
        else [c, d] = [r.cell, r.dir];
      }
      if (ok) return { cell, dir };
    }
  }
  return inst.spawn;
}

function enterWorld(index, length, carry = null) {
  game.inst?.dispose();
  stage.beginWorld();
  game.worldIndex = index;
  game.world = WORLDS[index];
  game.inst = game.world.setup(stage);
  game.snake = new Snake(game.inst.topology, placeSnake(game.inst, carry), length);
  game.apple = randomFreeCell(game.inst.topology, game.snake);
  game.applesInWorld = 0;
  game.acc = 0;
  game.alpha = 0;
  // Arriving through a portal: no "get ready" pause, keep moving.
  game.worldTime = carry ? (game.world.startDelay ?? 0.7) : 0;
  game.pendingWarp = false;
  game.headScreen = null;
  document.body.dataset.world = game.world.id;
  $('#hud').hidden = !game.world.hud;
  updateHud();
}

function startGame(index = 0) {
  sfx.unlock();
  sfx.start();
  game.score = 0;
  game.loop = 0;
  game.transition.active = false;
  enterWorld(index, 3);
  setPhase('playing');
}

function setPhase(phase) {
  game.phase = phase;
  for (const el of document.querySelectorAll('.overlay')) el.hidden = el.dataset.phase !== phase;
  document.body.dataset.phase = phase;
}

function tick() {
  const { snake, inst } = game;
  const appleKey = game.apple ? inst.topology.key(game.apple) : null;
  const res = snake.step(appleKey, inst.mapAction, inst.afterStep);
  if (res === 'dead') return gameOver();
  if (res !== 'ate') return;

  game.score += 1 + game.loop;
  game.applesInWorld += 1;
  sfx.eat(game.world.sfx, game.applesInWorld);
  if (game.applesInWorld >= APPLES_PER_WORLD) {
    game.apple = null;
    game.pendingWarp = true; // switched after this frame is drawn
  } else {
    game.apple = randomFreeCell(inst.topology, snake);
  }
  updateHud();
}

function gameOver() {
  sfx.die();
  const record = saveBest();
  $('#over-title').textContent = game.world.deathTitle ?? 'Game over';
  $('#over-msg').textContent = game.world.deathMessage ?? 'The snake crashed.';
  $('#over-score').textContent = game.score;
  $('#over-best').textContent = game.best;
  $('#over-record').hidden = !record;
  setTimeout(() => game.phase === 'dying' && setPhase('over'), 650);
  game.phase = 'dying';
  updateHud();
}

/** Swaps to the next world without stopping the game. */
function warp() {
  const next = (game.worldIndex + 1) % WORLDS.length;
  const w = WORLDS[next];
  if (next === 0) game.loop += 1;
  sfx.warp();

  // Freeze the last frame of the old world (3D canvas below, 2D on top).
  const t = game.transition;
  t.snap.width = t.mask.width = stage.canvas.width;
  t.snap.height = t.mask.height = stage.canvas.height;
  const g = t.snap.getContext('2d');
  if (!stage.glCanvas.hidden) g.drawImage(stage.glCanvas, 0, 0, t.snap.width, t.snap.height);
  g.drawImage(stage.canvas, 0, 0);
  t.from = game.headScreen;
  t.elapsed = 0;
  t.active = true;

  const head = game.snake.head;
  const carry = game.inst.uvOf ? { ...game.inst.uvOf(head), action: screenAction(game.inst, game.snake) } : null;
  enterWorld(next, game.snake.length, carry);

  $('#toast-num').textContent = `World ${next + 1} / ${WORLDS.length}${game.loop ? ` · Loop ${game.loop + 1}` : ''}`;
  $('#toast-title').textContent = w.title;
  $('#toast-controls').textContent = w.controls;
  const toast = $('#toast');
  toast.classList.remove('show');
  void toast.offsetWidth; // restart the CSS animation
  toast.classList.add('show');
}

/** Draws the old world's snapshot with a growing hole centred on the head. */
function drawTransition(dt) {
  const t = game.transition;
  if (!t.active) return;
  if (game.phase === 'playing') t.elapsed += dt;
  const k = Math.min(1, t.elapsed / WARP_SECONDS);
  if (k >= 1) {
    t.active = false;
    return;
  }
  const { width, height, dpr, ctx } = stage;
  const c = game.headScreen ?? t.from ?? { x: width / 2, y: height / 2 };
  const maxR = Math.hypot(Math.max(c.x, width - c.x), Math.max(c.y, height - c.y));
  const ease = k * k * (3 - 2 * k);
  const r = 18 + ease * maxR;
  const wobble = (a) => 1 + 0.06 * Math.sin(a * 7 + t.elapsed * 14);

  const m = t.mask.getContext('2d');
  m.globalCompositeOperation = 'source-over';
  m.clearRect(0, 0, t.mask.width, t.mask.height);
  m.drawImage(t.snap, 0, 0);
  m.globalCompositeOperation = 'destination-out';
  m.beginPath();
  for (let i = 0; i <= 48; i++) {
    const a = (i / 48) * Math.PI * 2;
    const rr = r * wobble(a) * dpr;
    const x = c.x * dpr + Math.cos(a) * rr;
    const y = c.y * dpr + Math.sin(a) * rr;
    if (i) m.lineTo(x, y);
    else m.moveTo(x, y);
  }
  m.fill();

  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1 - ease * 0.35;
  ctx.drawImage(t.mask, 0, 0);
  ctx.restore();

  // Glowing portal rim
  ctx.save();
  ctx.globalAlpha = 1 - k;
  ctx.lineWidth = 6;
  ctx.shadowBlur = 24;
  for (const [color, scale] of [['#00f0ff', 1], ['#ff2fb9', 0.96]]) {
    ctx.strokeStyle = color;
    ctx.shadowColor = color;
    ctx.beginPath();
    for (let i = 0; i <= 48; i++) {
      const a = (i / 48) * Math.PI * 2;
      const rr = r * scale * wobble(a);
      const x = c.x + Math.cos(a) * rr;
      const y = c.y + Math.sin(a) * rr;
      if (i) ctx.lineTo(x, y);
      else ctx.moveTo(x, y);
    }
    ctx.stroke();
  }
  ctx.restore();
}

function togglePause() {
  if (game.phase === 'playing') setPhase('paused');
  else if (game.phase === 'paused') setPhase('playing');
}

// ------------------------------------------------------------------- HUD ---
function updateHud() {
  $('#hud-world').textContent = `${game.worldIndex + 1}. ${game.world.title}`;
  $('#hud-score').textContent = game.score;
  $('#hud-best').textContent = Math.max(game.best, game.score);
  const dots = $('#hud-apples');
  dots.replaceChildren(
    ...Array.from({ length: APPLES_PER_WORLD }, (_, i) => {
      const d = document.createElement('span');
      d.className = i < game.applesInWorld ? 'dot on' : 'dot';
      return d;
    }),
  );
  $('#btn-mute').textContent = sfx.muted ? '🔇' : '🔊';
}

// ----------------------------------------------------------------- input ---
function onAction(action) {
  sfx.unlock();
  if (action === 'mute') return void (sfx.toggleMute(), updateHud());
  switch (game.phase) {
    case 'title':
      if (action === 'confirm' || action === 'tap' || action === 'up') startGame(0);
      break;
    case 'over':
      if (action === 'confirm' || action === 'tap' || action === 'pause') startGame(0);
      break;
    case 'paused':
      if (action === 'pause' || action === 'confirm' || action === 'tap') togglePause();
      break;
    case 'playing':
      if (action === 'pause') togglePause();
      else if (['up', 'down', 'left', 'right'].includes(action)) game.snake.enqueue(action);
      break;
  }
}

// ------------------------------------------------------------------ loop ---
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  game.time += dt;
  if (game.phase === 'playing') {
    game.worldTime += dt;
    if (game.worldTime > (game.world.startDelay ?? 0.7)) game.acc += dt * 1000;
    const ms = tickMs();
    while (game.acc >= ms && game.phase === 'playing' && !game.pendingWarp) {
      game.acc -= ms;
      tick();
    }
    game.alpha = game.phase === 'playing' ? game.acc / ms : 1;
  }
  stage.ctx.clearRect(0, 0, stage.width, stage.height);
  game.headScreen = game.inst?.render({
    snake: game.snake,
    apple: game.apple,
    alpha: game.snake.alive ? game.alpha : 1,
    time: game.time,
    worldTime: game.worldTime,
    dt,
    score: game.score,
    best: Math.max(game.best, game.score),
    applesInWorld: game.applesInWorld,
    applesPerWorld: APPLES_PER_WORLD,
    worldIndex: game.worldIndex,
    worldCount: WORLDS.length,
    phase: game.phase,
  }) ?? null;
  drawTransition(dt);
  if (game.pendingWarp && game.phase === 'playing') warp();
  requestAnimationFrame(frame);
}

// ------------------------------------------------------------------ boot ---
function boot() {
  stage.resize();
  window.addEventListener('resize', () => stage.resize());

  bindInput(stage.root, onAction);
  $('#btn-mute').addEventListener('click', () => onAction('mute'));
  $('#btn-pause').addEventListener('click', () => onAction('pause'));
  document.addEventListener('visibilitychange', () => document.hidden && game.phase === 'playing' && setPhase('paused'));
  window.addEventListener('blur', () => game.phase === 'playing' && setPhase('paused'));

  const list = $('#world-list');
  WORLDS.forEach((w, i) => {
    const b = document.createElement('button');
    b.className = 'chip';
    b.innerHTML = `<b>${i + 1}</b> ${w.title}`;
    b.title = `Practice: start in ${w.title}`;
    b.addEventListener('click', (e) => {
      e.stopPropagation();
      startGame(i);
    });
    list.append(b);
  });
  for (const b of document.querySelectorAll('[data-start]')) {
    b.addEventListener('click', (e) => {
      e.stopPropagation();
      startGame(0);
    });
  }
  $('#title-best').textContent = game.best;

  const params = new URLSearchParams(location.search);
  const startWorld = Number(params.get('world')) - 1;
  if (startWorld >= 0 && startWorld < WORLDS.length) {
    startGame(startWorld);
  } else {
    enterWorld(0, 3);
    setPhase('title');
  }
  requestAnimationFrame(frame);
  registerServiceWorker();
}

function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  const local = ['localhost', '127.0.0.1'].includes(location.hostname);
  if (local && !new URLSearchParams(location.search).has('sw')) return;
  navigator.serviceWorker.register('./sw.js').catch((err) => console.warn('Service worker failed', err));
}

// Expose for debugging and automated tests.
window.__feverSnake = { game, WORLDS, startGame, onAction };

boot();
