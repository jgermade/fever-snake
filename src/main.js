// Game shell: stage, loop, world switching, HUD and overlays.
import { Snake, randomFreeCell } from './snake.js';
import { WORLDS, APPLES_PER_WORLD } from './worlds/index.js';
import { bindInput } from './input.js';
import { sfx } from './audio.js';
import * as THREE from './render/three.js';

const $ = (sel) => document.querySelector(sel);
const BEST_KEY = 'fever-snake.best';
const WARP_MS = 1900;

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
  phase: 'title', // title | playing | paused | warp | over
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

function enterWorld(index, length) {
  game.inst?.dispose();
  stage.beginWorld();
  game.worldIndex = index;
  game.world = WORLDS[index];
  game.inst = game.world.setup(stage);
  game.snake = new Snake(game.inst.topology, game.inst.spawn, length);
  game.apple = randomFreeCell(game.inst.topology, game.snake);
  game.applesInWorld = 0;
  game.acc = 0;
  game.alpha = 0;
  game.worldTime = 0;
  document.body.dataset.world = game.world.id;
  $('#hud').hidden = !game.world.hud;
  updateHud();
}

function startGame(index = 0) {
  sfx.unlock();
  sfx.start();
  game.score = 0;
  game.loop = 0;
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
    warp();
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

function warp() {
  const next = (game.worldIndex + 1) % WORLDS.length;
  const nextLoop = next === 0 ? game.loop + 1 : game.loop;
  const w = WORLDS[next];
  sfx.warp();
  $('#warp-num').textContent = `World ${next + 1} / ${WORLDS.length}${nextLoop ? ` · Loop ${nextLoop + 1}` : ''}`;
  $('#warp-title').textContent = w.title;
  $('#warp-blurb').textContent = w.blurb;
  $('#warp-controls').textContent = w.controls;
  setPhase('warp');
  const length = game.snake.length;
  setTimeout(() => {
    game.loop = nextLoop;
    enterWorld(next, length);
    setPhase('playing');
  }, WARP_MS);
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
    while (game.acc >= ms && game.phase === 'playing') {
      game.acc -= ms;
      tick();
    }
    game.alpha = game.phase === 'playing' ? game.acc / ms : 1;
  }
  stage.ctx.clearRect(0, 0, stage.width, stage.height);
  game.inst?.render({
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
  });
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
