// Game shell: stage, loop, world switching, HUD and overlays.
import { Snake, randomFreeCell } from './snake.js';
import { WORLDS, APPLES_PER_WORLD } from './worlds/index.js';
import { makeOrder } from './order.js';
import { MIN_RUNWAY, placeSnake, runway, screenAction } from './placement.js';
import { bindInput } from './input.js';
import { sfx } from './audio.js';
import { music } from './music.js';
import { addShake, burst, clearJuice, drawGoldenSparkle, drawJuice, popup, rainbowBurst, shakeOffset } from './juice.js';
import * as THREE from './render/three.js';

const $ = (sel) => document.querySelector(sel);
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const BEST_KEY = 'fever-snake.best';
const WARP_SECONDS = 1.6; // length of the portal wipe between worlds
const ARRIVAL_TICKS = 6; // slower first ticks after arriving in a new world
const COMBO_WINDOW = 3.5; // seconds between apples to keep a combo going
const FEVER_COMBO = 3; // apples in a row that trigger FEVER
const FEVER_SECONDS = 7;
const GOLDEN_CHANCE = 0.12;

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
    /** Screen shake: offsets both canvases. */
    shake(x, y) {
      if (reducedMotion.matches) x = y = 0;
      const t = x || y ? `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)` : '';
      canvas.style.transform = t;
      glCanvas.style.transform = t;
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
  worldIndex: 0, // index into WORLDS
  arrival: 0, // remaining slow ticks after a world change
  combo: 0,
  lastEat: -99,
  fever: 0, // seconds of FEVER left
  golden: false, // the current apple is golden
  order: [], // shuffled WORLDS indices for the current loop
  stage: 0, // position in `order` (shown as "World k / N")
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
  // Portal between two live worlds: the previous world keeps running outside
  // the portal while its snake drains into it; the new world shows inside.
  transition: { active: false, elapsed: 0, oldInst: null, oldWorld: null, oldBody: [], drained: 0 },
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

function spawnApple() {
  game.apple = randomFreeCell(game.inst.topology, game.snake);
  game.golden = Math.random() < GOLDEN_CHANCE;
}

/** Keys that count as eating the apple (a world may add more, e.g. a mirror). */
function appleKeys() {
  if (!game.apple) return null;
  const { inst } = game;
  return inst.appleCells ? new Set(inst.appleCells(game.apple).map((c) => inst.topology.key(c))) : inst.topology.key(game.apple);
}

function setFever(seconds) {
  const was = game.fever > 0;
  game.fever = Math.max(0, seconds);
  const on = game.fever > 0;
  document.body.classList.toggle('fever', on);
  music.setFever(on);
  if (on && !was) {
    sfx.warp();
    addShake(10);
    rainbowBurst(game.headScreen, 60);
    popup(game.headScreen, 'FEVER!', '#ffec27');
  }
}

function tickMs() {
  const base = game.world.tickMs * Math.pow(0.97, game.applesInWorld) * Math.pow(0.88, game.loop);
  // Arriving through a portal: start at ~1.9x the tick time and ease back.
  const arrival = 1 + 0.9 * (game.arrival / ARRIVAL_TICKS);
  const fever = game.fever > 0 ? 0.85 : 1;
  const world = game.inst.tickScale?.(game.snake) ?? 1; // e.g. time dilation
  return Math.max(55, base * fever) * arrival * world;
}

function makeView(snake, apple, alpha, dt = 0) {
  return {
    snake,
    apple,
    alpha,
    time: game.time,
    worldTime: game.worldTime,
    dt,
    score: game.score,
    best: Math.max(game.best, game.score),
    applesInWorld: game.applesInWorld,
    applesPerWorld: APPLES_PER_WORLD,
    worldIndex: game.stage,
    worldCount: WORLDS.length,
    phase: game.phase,
  };
}

/** Renders a world without showing anything, so its layout (screenOf) is known. */
function layoutPass(inst, snake) {
  const { ctx } = stage;
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, 0, 0);
  ctx.clip();
  inst.render(makeView(snake, null, 0));
  ctx.restore();
}

/**
 * @param carry when set, the snake arrives from the previous world (portal):
 *   the previous world instance is kept alive by the transition.
 */
function enterWorld(index, length, carry = null) {
  if (!carry) {
    endTransition();
    game.inst?.dispose();
    stage.beginWorld();
  }
  game.worldIndex = index;
  game.world = WORLDS[index];
  game.inst = game.world.setup(stage);
  let spawn = placeSnake(game.inst, carry);
  // Worlds with random walls: if the authored spawn is too tight, find a better one nearby.
  if (!carry && game.inst.uvOf && runway(game.inst.topology, spawn.cell, spawn.dir) < MIN_RUNWAY) {
    spawn = placeSnake(game.inst, { ...game.inst.uvOf(spawn.cell), action: 'right' });
  }
  if (carry?.screen && game.inst.screenOf) {
    layoutPass(game.inst, new Snake(game.inst.topology, spawn, 1));
    spawn = placeSnake(game.inst, carry);
  }
  game.snake = new Snake(game.inst.topology, spawn, length);
  spawnApple();
  music.play(game.world);
  game.applesInWorld = 0;
  if (!carry) game.acc = 0; // through a portal the tick rhythm carries on
  game.arrival = carry ? ARRIVAL_TICKS : 0;
  game.alpha = 0;
  // Arriving through a portal: no "get ready" pause, keep moving.
  game.worldTime = carry ? (game.world.startDelay ?? 0.7) : 0;
  game.pendingWarp = false;
  game.headScreen = null;
  document.body.dataset.world = game.world.id;
  $('#hud').hidden = !game.world.hud;
  updateHud();
}

/** @param {number|null} index start in this world (practice), else random */
function startGame(index = null) {
  sfx.unlock();
  sfx.start();
  game.score = 0;
  game.loop = 0;
  game.combo = 0;
  game.lastEat = -99;
  clearJuice();
  setFever(0);
  game.order = makeOrder(WORLDS, Math.random, { first: index });
  game.stage = 0;
  enterWorld(game.order[0], 3);
  setPhase('playing');
}

function setPhase(phase) {
  game.phase = phase;
  for (const el of document.querySelectorAll('.overlay')) el.hidden = el.dataset.phase !== phase;
  document.body.dataset.phase = phase;
}

function tick() {
  const { snake, inst } = game;
  const res = snake.step(appleKeys(), inst.mapAction, inst.afterStep, inst.collides);
  if (res === 'dead') return gameOver();
  if (game.transition.active) game.transition.drained += 1;
  if (game.arrival > 0) game.arrival -= 1;
  if (res !== 'ate') return;

  // Combo / FEVER bookkeeping
  game.combo = game.time - game.lastEat <= COMBO_WINDOW ? game.combo + 1 : 1;
  game.lastEat = game.time;
  const golden = game.golden;
  const mult = game.fever > 0 ? 3 : 1;
  const points = (1 + game.loop) * mult + (golden ? 5 : 0);
  game.score += points;
  game.applesInWorld += 1;
  sfx.eat(game.world.sfx, game.applesInWorld + game.combo);
  const at = game.headScreen;
  if (golden) {
    burst(at, { count: 40, colors: ['#ffd700', '#fff4b0', '#ffae00'], speed: 300, size: 5 });
    setFever(Math.max(game.fever, FEVER_SECONDS));
  } else if (game.fever > 0) {
    rainbowBurst(at);
    game.fever = Math.min(12, game.fever + 1.5);
  } else {
    burst(at);
  }
  if (game.combo >= FEVER_COMBO && game.fever <= 0) setFever(FEVER_SECONDS);
  addShake(game.fever > 0 ? 7 : 3);
  popup(at, `+${points}${game.combo > 1 ? `  x${game.combo}` : ''}`, golden ? '#ffd700' : game.fever > 0 ? '#ffec27' : '#ffffff');
  if (game.applesInWorld >= APPLES_PER_WORLD) {
    game.apple = null;
    game.pendingWarp = true; // switched after this frame is drawn
  } else {
    spawnApple();
  }
  updateHud();
}

function gameOver() {
  sfx.die();
  music.stop();
  setFever(0);
  addShake(14);
  burst(game.headScreen, { count: 30, colors: ['#ff3355', '#ffffff', '#ff9f1c'], speed: 260 });
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
  const oldStage = game.stage;
  game.stage += 1;
  if (game.stage >= game.order.length) {
    game.loop += 1;
    game.stage = 0;
    game.order = makeOrder(WORLDS, Math.random, { after: game.worldIndex });
  }
  const next = game.order[game.stage];
  const w = WORLDS[next];
  sfx.warp();
  endTransition();

  const { snake, inst } = game;
  const t = game.transition;
  Object.assign(t, {
    active: true,
    elapsed: 0,
    oldInst: inst,
    oldWorld: game.world,
    oldStage,
    oldBody: [...snake.body],
    oldDir: snake.dir,
    drained: 0,
    from: game.headScreen,
  });
  const carry = {
    ...(inst.uvOf ? inst.uvOf(snake.head) : { u: 0.5, v: 0.5 }),
    action: screenAction(inst, snake),
    screen: game.headScreen,
  };
  enterWorld(next, snake.length, carry);

  $('#toast-num').textContent = `World ${game.stage + 1} / ${WORLDS.length}${game.loop ? ` · Loop ${game.loop + 1}` : ''}`;
  $('#toast-title').textContent = w.title;
  $('#toast-controls').textContent = w.controls;
  const toast = $('#toast');
  toast.classList.remove('show');
  void toast.offsetWidth; // restart the CSS animation
  toast.classList.add('show');
}

function endTransition() {
  const t = game.transition;
  t.oldInst?.dispose();
  t.oldInst = null;
  t.active = false;
}

/**
 * The old snake as seen in the old world: it keeps crawling along its own
 * path into the portal (at its last head cell), one segment per tick.
 */
function drainingSnake(t) {
  const P = t.oldBody;
  const n = Math.max(1, P.length - t.drained);
  return {
    body: P.slice(0, n),
    head: P[0],
    dir: t.oldDir,
    alive: true,
    prevOf: (j) => (t.drained === 0 || j === 0 ? P[j] : P[j + 1] ?? P[j]),
  };
}

function portalPath(ctx, c, r, elapsed, scale = 1) {
  for (let i = 0; i <= 48; i++) {
    const a = (i / 48) * Math.PI * 2;
    const rr = r * scale * (1 + 0.06 * Math.sin(a * 7 + elapsed * 14));
    const x = c.x + Math.cos(a) * rr;
    const y = c.y + Math.sin(a) * rr;
    if (i) ctx.lineTo(x, y);
    else ctx.moveTo(x, y);
  }
  ctx.closePath();
}

/** Renders both worlds live, the new one inside a growing portal. */
function renderTransition(view, dt) {
  const t = game.transition;
  const { ctx, width, height } = stage;
  if (game.phase === 'playing') t.elapsed += dt;
  const k = Math.min(1, t.elapsed / WARP_SECONDS);
  const ease = k * k * (3 - 2 * k);
  const from = t.from ?? { x: width / 2, y: height / 2 };
  const to = game.headScreen ?? from;
  const c = { x: from.x + (to.x - from.x) * ease, y: from.y + (to.y - from.y) * ease };
  const maxR = Math.hypot(Math.max(c.x, width - c.x), Math.max(c.y, height - c.y));
  const r = 6 + ease * maxR * 1.1;
  const oldView = { ...view, snake: drainingSnake(t), apple: null, worldIndex: t.oldStage, applesInWorld: APPLES_PER_WORLD };
  let head;

  stage.glCanvas.hidden = !(game.world.three || t.oldWorld.three);
  if (t.oldWorld.three && !game.world.three) {
    // old world on the WebGL canvas below, new 2D world inside the portal on top
    t.oldInst.render(oldView);
    ctx.save();
    ctx.beginPath();
    portalPath(ctx, c, r, t.elapsed);
    ctx.clip();
    head = game.inst.render(view);
    ctx.restore();
  } else {
    // new world first, then the old 2D world everywhere outside the portal
    head = game.inst.render(view);
    if (!t.oldWorld.three) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, width, height);
      portalPath(ctx, c, r, t.elapsed);
      ctx.clip('evenodd');
      t.oldInst.render(oldView);
      ctx.restore();
    }
  }

  // Glowing portal rim
  ctx.save();
  ctx.globalAlpha = Math.min(1, (1 - k) * 2);
  ctx.lineWidth = 5;
  ctx.shadowBlur = 22;
  for (const [color, scale] of [['#00f0ff', 1], ['#ff2fb9', 0.97]]) {
    ctx.strokeStyle = color;
    ctx.shadowColor = color;
    ctx.beginPath();
    portalPath(ctx, c, r, t.elapsed, scale);
    ctx.stroke();
  }
  ctx.restore();

  if (k >= 1) {
    endTransition();
    stage.glCanvas.hidden = !game.world.three;
  }
  return head;
}

function togglePause() {
  if (game.phase === 'playing') {
    setPhase('paused');
    music.stop();
  } else if (game.phase === 'paused') {
    setPhase('playing');
    music.play(game.world);
  }
}

// ------------------------------------------------------------------- HUD ---
function updateHud() {
  $('#hud-world').textContent = `${game.stage + 1}. ${game.world.title}`;
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
  dots.classList.toggle('golden', Boolean(game.golden && game.apple));
  const combo = $('#hud-combo');
  combo.textContent = game.combo > 1 ? `x${game.combo}` : '';
}

// ----------------------------------------------------------------- input ---
function onAction(action) {
  sfx.unlock();
  if (action === 'mute') return void (sfx.toggleMute(), updateHud());
  switch (game.phase) {
    case 'title':
      if (action === 'confirm' || action === 'tap' || action === 'up') startGame();
      break;
    case 'over':
      if (action === 'confirm' || action === 'tap' || action === 'pause') startGame();
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
  // rAF timestamps can be earlier than the time the script started: clamp at 0.
  const dt = Math.max(0, Math.min(0.1, (now - last) / 1000));
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
    if (game.fever > 0) {
      game.fever -= dt;
      if (game.fever <= 0) setFever(0);
    }
    if (game.combo > 0 && game.time - game.lastEat > COMBO_WINDOW) {
      game.combo = 0;
      updateHud();
    }
  }
  const meter = $('#fever-meter');
  meter.style.setProperty('--fever', String(Math.min(1, game.fever / FEVER_SECONDS)));
  const off = shakeOffset(dt);
  stage.shake(off.x, off.y);
  stage.ctx.clearRect(0, 0, stage.width, stage.height);
  const view = makeView(game.snake, game.apple, game.snake.alive ? game.alpha : 1, dt);
  try {
    const head = game.transition.active ? renderTransition(view, dt) : game.inst?.render(view);
    game.headScreen = head ?? null;
    if (game.golden && game.apple && game.inst.screenOf && !game.transition.active) {
      drawGoldenSparkle(stage.ctx, game.inst.screenOf(game.apple), game.time);
    }
    drawJuice(stage.ctx, dt);
    if (game.pendingWarp && game.phase === 'playing') warp();
  } catch (err) {
    // A rendering bug must never freeze the game loop.
    console.error(err);
  } finally {
    requestAnimationFrame(frame);
  }
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
    b.textContent = w.title;
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
      startGame();
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
window.__feverSnake = { game, WORLDS, startGame, onAction, warp };

boot();
