// Topology-agnostic snake. A topology provides key/step/isReverse/sameDir/cells,
// a world provides mapAction (input -> direction) and an optional afterStep hook.

export class Snake {
  /**
   * @param {object} topology
   * @param {{cell: object, dir: any}} spawn
   * @param {number} length target length; the snake starts as a single cell
   *   and unrolls from the spawn point while it moves.
   */
  constructor(topology, spawn, length = 3) {
    this.topo = topology;
    this.body = [spawn.cell];
    this.prevBody = [spawn.cell];
    this.dir = spawn.dir;
    this.prevDir = spawn.dir;
    this.grow = Math.max(0, length - 1);
    this.queue = [];
    this.alive = true;
  }

  get head() {
    return this.body[0];
  }

  /** Target length including pending growth. */
  get length() {
    return this.body.length + this.grow;
  }

  occupies(cell) {
    const k = this.topo.key(cell);
    return this.body.some((c) => this.topo.key(c) === k);
  }

  enqueue(action) {
    if (this.queue.length < 3) this.queue.push(action);
  }

  /**
   * Applies the first queued action that produces a valid turn.
   *
   * A reverse turn cannot be applied now, but it is kept for the next tick if
   * a valid turn follows it: pressing "right" + "down" almost together while
   * heading left (right registered first) becomes down, then right — a quick
   * U-turn instead of a lost key press.
   */
  consumeInput(mapAction) {
    const deferred = [];
    while (this.queue.length) {
      const action = this.queue.shift();
      const d = mapAction(action, this);
      if (d == null || this.topo.sameDir(d, this.dir)) continue;
      if (this.topo.isReverse(d, this.dir)) {
        deferred.push(action);
        continue;
      }
      this.dir = d;
      this.queue = [...deferred, ...this.queue];
      return;
    }
  }

  /**
   * Advances one tick.
   * @returns {'moved' | 'ate' | 'dead'}
   */
  step(appleKey, mapAction, afterStep) {
    if (!this.alive) return 'dead';
    this.consumeInput(mapAction);
    const from = this.head;
    const fromDir = this.dir;
    const res = this.topo.step(from, this.dir);
    this.prevDir = fromDir;
    if (!res) return this.die();

    const k = this.topo.key(res.cell);
    const ate = k === appleKey;
    if (ate) this.grow += 1;
    const grows = this.grow > 0;
    // The tail leaves its cell this tick unless the snake is growing.
    const limit = grows ? this.body.length : this.body.length - 1;
    for (let i = 0; i < limit; i++) {
      if (this.topo.key(this.body[i]) === k) return this.die();
    }

    this.prevBody = this.body;
    this.body = [res.cell, ...this.body];
    if (grows) this.grow -= 1;
    else this.body.pop();
    this.dir = res.dir;
    if (afterStep) afterStep(this, from, res.cell, fromDir, res.dir);
    return ate ? 'ate' : 'moved';
  }

  die() {
    this.alive = false;
    this.prevBody = this.body;
    return 'dead';
  }

  /** Previous position of segment i (for interpolation). */
  prevOf(i) {
    return this.prevBody[i] ?? this.body[i];
  }
}

/** Picks a random free cell that is not part of the snake. */
export function randomFreeCell(topology, snake, rand = Math.random) {
  const taken = new Set(snake.body.map((c) => topology.key(c)));
  const free = topology.cells().filter((c) => !taken.has(topology.key(c)));
  if (!free.length) return null;
  return free[Math.floor(rand() * free.length)];
}
