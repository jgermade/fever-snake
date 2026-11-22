// Input mappings shared by grid-based worlds.

const ABSOLUTE = { up: 0, right: 1, down: 2, left: 3 };

/** Screen-space arrows map directly to grid directions. */
export function absoluteGrid(action) {
  return ABSOLUTE[action] ?? null;
}

/** Left/right turn relative to the current heading; up/down do nothing. */
export function relativeGrid(action, snake) {
  if (action === 'left') return (snake.dir + 3) % 4;
  if (action === 'right') return (snake.dir + 1) % 4;
  return null;
}
