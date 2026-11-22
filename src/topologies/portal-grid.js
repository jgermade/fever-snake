// Grid with paired portals: stepping onto a portal puts the head on its twin,
// keeping the direction.
import { GridTopology } from './grid.js';

export class PortalGridTopology extends GridTopology {
  /**
   * @param {object} opts GridTopology options
   * @param {Array<[[number, number], [number, number]]>} pairs portal pairs
   */
  constructor(opts, pairs) {
    super(opts);
    this.pairs = pairs;
    this.twin = new Map();
    for (const [[ax, ay], [bx, by]] of pairs) {
      this.twin.set(ay * this.width + ax, { x: bx, y: by });
      this.twin.set(by * this.width + bx, { x: ax, y: ay });
    }
  }

  isPortal(x, y) {
    return this.twin.has(y * this.width + x);
  }

  step(cell, dir) {
    const r = super.step(cell, dir);
    if (!r) return null;
    const exit = this.twin.get(this.key(r.cell));
    return exit ? { cell: { ...exit }, dir, warped: true } : r;
  }

  /** Free cells, excluding portals (apples never spawn on them). */
  cells() {
    this._free ??= super.cells().filter((c) => !this.twin.has(this.key(c)));
    return this._free;
  }
}
