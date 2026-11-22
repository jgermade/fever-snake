// Input mappings shared by grid-based worlds.

const ABSOLUTE = { up: 0, right: 1, down: 2, left: 3 };

/** Screen-space arrows map directly to grid directions. */
export function absoluteGrid(action) {
  return ABSOLUTE[action] ?? null;
}

/** Normalised board coordinates of a grid cell (used to carry the snake between worlds). */
export function gridUV(width, height) {
  return (c) => ({ u: (c.x + 0.5) / width, v: (c.y + 0.5) / height });
}

/** Left/right turn relative to the current heading; up/down do nothing. */
export function relativeGrid(action, snake) {
  if (action === 'left') return (snake.dir + 3) % 4;
  if (action === 'right') return (snake.dir + 1) % 4;
  return null;
}
