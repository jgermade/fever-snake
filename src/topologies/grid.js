// Rectangular grid topology. Also used for the tube world: a grid that wraps
// on both axes is a torus.
//
// Directions are integers: 0 = up (-y), 1 = right (+x), 2 = down (+y), 3 = left (-x).

export const DX = [0, 1, 0, -1];
export const DY = [-1, 0, 1, 0];

export class GridTopology {
  /**
   * @param {object} opts
   * @param {number} opts.width
   * @param {number} opts.height
   * @param {boolean} [opts.wrap] wrap around the edges instead of dying on them
   * @param {Array<[number, number]>} [opts.walls] blocked cells
   */
  constructor({ width, height, wrap = false, walls = [] }) {
    this.width = width;
    this.height = height;
    this.wrap = wrap;
    this.blocked = new Set();
    for (const [x, y] of walls) this.blocked.add(y * width + x);
    this._cells = null;
  }

  key(cell) {
    return cell.y * this.width + cell.x;
  }

  isWall(x, y) {
    return this.blocked.has(y * this.width + x);
  }

  inside(x, y) {
    return x >= 0 && y >= 0 && x < this.width && y < this.height;
  }

  /** Returns the next {cell, dir} or null if the move hits a border or a wall. */
  step(cell, dir) {
    let x = cell.x + DX[dir];
    let y = cell.y + DY[dir];
    if (this.wrap) {
      x = (x + this.width) % this.width;
      y = (y + this.height) % this.height;
    } else if (!this.inside(x, y)) {
      return null;
    }
    if (this.isWall(x, y)) return null;
    return { cell: { x, y }, dir };
  }

  isReverse(a, b) {
    return (a + 2) % 4 === b;
  }

  sameDir(a, b) {
    return a === b;
  }

  /** All free (non-wall) cells. */
  cells() {
    if (!this._cells) {
      this._cells = [];
      for (let y = 0; y < this.height; y++) {
        for (let x = 0; x < this.width; x++) {
          if (!this.isWall(x, y)) this._cells.push({ x, y });
        }
      }
    }
    return this._cells;
  }
}

/** Breadth-first check that every free cell is reachable from `start`. */
export function isFullyConnected(topology, start) {
  const seen = new Set([topology.key(start)]);
  const queue = [start];
  while (queue.length) {
    const c = queue.shift();
    for (let d = 0; d < 4; d++) {
      const n = topology.step(c, d);
      if (n && !seen.has(topology.key(n.cell))) {
        seen.add(topology.key(n.cell));
        queue.push(n.cell);
      }
    }
  }
  return seen.size === topology.cells().length;
}
