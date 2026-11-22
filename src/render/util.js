// Small shared helpers for renderers and worlds.

/** Deterministic PRNG (mulberry32). */
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const lerp = (a, b, t) => a + (b - a) * t;

/** Lerp on a ring of size `size` (shortest way round). */
export function lerpWrap(a, b, t, size) {
  let d = b - a;
  if (d > size / 2) d -= size;
  if (d < -size / 2) d += size;
  return a + d * t;
}

/** Frame-rate independent exponential smoothing factor. */
export const damp = (rate, dt) => 1 - Math.exp(-rate * dt);

/** Interpolated grid position of segment i: returns {x, y}. */
export function segPos(snake, i, alpha, wrapW = 0, wrapH = 0) {
  const a = snake.prevOf(i);
  const b = snake.body[i];
  return {
    x: wrapW ? lerpWrap(a.x, b.x, alpha, wrapW) : lerp(a.x, b.x, alpha),
    y: wrapH ? lerpWrap(a.y, b.y, alpha, wrapH) : lerp(a.y, b.y, alpha),
  };
}

/** Fits a cols x rows board into a box; returns cell size and origin. */
export function fitBoard(boxW, boxH, cols, rows, { integer = false, max = 64 } = {}) {
  let cell = Math.min(boxW / cols, boxH / rows, max);
  if (integer) cell = Math.max(1, Math.floor(cell));
  return {
    cell,
    w: cell * cols,
    h: cell * rows,
    ox: Math.floor((boxW - cell * cols) / 2),
    oy: Math.floor((boxH - cell * rows) / 2),
  };
}

export function pad(n, len) {
  return String(n).padStart(len, '0');
}
