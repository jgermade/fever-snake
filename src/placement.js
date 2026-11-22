// Where a snake arriving from another world appears.
//
// The arrival must be fair: never right in front of a wall. Every candidate
// cell near the old on-screen position gets a score based on how much free
// runway it has ahead and how many safe turns it offers; distance from the
// old position and a change of heading only cost a little.

export const ACTIONS = ['up', 'right', 'down', 'left'];
const MAX_RUNWAY = 10; // cells of free path that count toward the score
export const MIN_RUNWAY = 7; // below this a cell is only used as a last resort

/** Which arrow key the snake is currently heading along, on screen. */
export function screenAction(inst, snake) {
  const map = inst.placeMap ?? inst.mapAction;
  for (const a of ACTIONS) {
    const d = map(a, snake);
    if (d != null && inst.topology.sameDir(d, snake.dir)) return a;
  }
  return 'right';
}

/** Free cells straight ahead of `cell` heading `dir` (capped). */
export function runway(topo, cell, dir, max = MAX_RUNWAY) {
  let c = cell;
  let d = dir;
  const seen = new Set([topo.key(cell)]);
  for (let k = 0; k < max; k++) {
    const r = topo.step(c, d);
    if (!r || seen.has(topo.key(r.cell))) return k;
    seen.add(topo.key(r.cell));
    [c, d] = [r.cell, r.dir];
  }
  return max;
}

/** How many of the perpendicular turns from `cell` lead to at least 3 free cells. */
function escapes(topo, cell, dir, map) {
  let n = 0;
  for (const a of ACTIONS) {
    const d = map(a, { head: cell, dir });
    if (d == null || topo.sameDir(d, dir) || topo.isReverse(d, dir)) continue;
    if (runway(topo, cell, d, 3) >= 3) n += 1;
  }
  return n;
}

/**
 * @param inst world instance (topology, mapAction/placeMap, uvOf, screenOf?, placeCells?, spawn)
 * @param carry { u, v, action, screen? } from the previous world, or null
 * @returns {{cell, dir}}
 */
export function placeSnake(inst, carry) {
  if (!carry || !inst.uvOf) return inst.spawn;
  const topo = inst.topology;
  const map = inst.placeMap ?? inst.mapAction;
  const cells = inst.placeCells ?? topo.cells();
  // Same spot on screen when the world can tell (2D layouts), else same spot on the board.
  const byScreen = carry.screen && inst.screenOf?.(cells[0]);
  const near = cells
    .map((cell) => {
      if (byScreen) {
        const p = inst.screenOf(cell);
        return [cell, Math.hypot(p.x - carry.screen.x, p.y - carry.screen.y)];
      }
      const p = inst.uvOf(cell);
      return [cell, Math.hypot(p.u - carry.u, p.v - carry.v)];
    })
    .sort((a, b) => a[1] - b[1])
    .slice(0, 160);

  let best = null;
  near.forEach(([cell], rank) => {
    for (const action of ACTIONS) {
      const dir = map(action, { head: cell, dir: null });
      if (dir == null) continue;
      const run = runway(topo, cell, dir);
      if (run < 2) continue;
      const score =
        Math.min(run, MAX_RUNWAY) * 2 +
        (run >= MIN_RUNWAY ? 10 : 0) +
        escapes(topo, cell, dir, map) * 1.5 +
        (action === carry.action ? 2 : 0) -
        (rank / near.length) * 4;
      if (!best || score > best.score) best = { score, cell, dir };
    }
  });
  return best ? { cell: best.cell, dir: best.dir } : inst.spawn;
}
