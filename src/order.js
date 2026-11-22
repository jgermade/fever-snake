// Random world order for a run.
//
// Constraint: two 3D worlds are never back to back (the live portal
// transition renders both worlds at once and there is a single WebGL canvas).
// That also applies across loops: `after` is the last world of the previous
// loop.

const is3d = (worlds, i) => Boolean(worlds[i].three);

export function isValidOrder(worlds, order, after = null) {
  if (after != null && (order[0] === after || (is3d(worlds, after) && is3d(worlds, order[0])))) return false;
  for (let i = 1; i < order.length; i++) {
    if (is3d(worlds, order[i]) && is3d(worlds, order[i - 1])) return false;
  }
  return true;
}

/**
 * @param {Array<{three?: boolean}>} worlds
 * @param {() => number} rand
 * @param {{first?: number|null, after?: number|null}} [opts]
 *   first: force the run to start in this world (practice mode);
 *   after: the world played just before this order starts.
 * @returns {number[]} a permutation of world indices
 */
export function makeOrder(worlds, rand = Math.random, { first = null, after = null } = {}) {
  const n = worlds.length;
  for (let attempt = 0; attempt < 5000; attempt++) {
    const order = [...Array(n).keys()];
    for (let i = n - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    if (first != null) {
      const k = order.indexOf(first);
      [order[0], order[k]] = [order[k], order[0]];
    }
    if (isValidOrder(worlds, order, after)) return order;
  }
  // Practically unreachable; the authored order is valid (see tests).
  return [...Array(n).keys()];
}
