// Möbius strip (and Klein bottle with wrapX): a W x L grid that wraps along its length with a half twist.
// Crossing the seam mirrors the across coordinate (x -> W - 1 - x); the long
// edges are deadly. Directions as in grid.js (0 up/-y, 1 +x, 2 down/+y, 3 -x).
import { GridTopology } from './grid.js';

export class MobiusTopology extends GridTopology {
  /** @param {{wrapX?: boolean}} opts wrapX glues the long edges too: a Klein bottle. */
  constructor({ width, height, walls = [], wrapX = false }) {
    super({ width, height, walls });
    this.wrapX = wrapX;
  }

  step(cell, dir) {
    let x = cell.x + [0, 1, 0, -1][dir];
    let y = cell.y + [-1, 0, 1, 0][dir];
    if (x < 0 || x >= this.width) {
      if (!this.wrapX) return null;
      x = (x + this.width) % this.width;
    }
    let seam = false;
    if (y < 0 || y >= this.height) {
      y = (y + this.height) % this.height;
      x = this.width - 1 - x;
      seam = true;
    }
    if (this.isWall(x, y)) return null;
    return { cell: { x, y }, dir, seam };
  }
}
