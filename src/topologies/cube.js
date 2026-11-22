// Surface of an N x N x N cube.
//
// A cell is { p, n }: `p` is the cell centre in *doubled* integer coordinates
// (faces lie on the planes ±N, cell centres sit on odd values) and `n` is the
// outward face normal. A direction is an integer unit vector perpendicular to `n`.

const z = (v) => v + 0; // turns -0 into 0

export const vec = {
  add: (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]],
  sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
  scale: (a, s) => [z(a[0] * s), z(a[1] * s), z(a[2] * s)],
  neg: (a) => [z(-a[0]), z(-a[1]), z(-a[2])],
  dot: (a, b) => z(a[0] * b[0] + a[1] * b[1] + a[2] * b[2]),
  cross: (a, b) => [
    z(a[1] * b[2] - a[2] * b[1]),
    z(a[2] * b[0] - a[0] * b[2]),
    z(a[0] * b[1] - a[1] * b[0]),
  ],
  eq: (a, b) => a[0] === b[0] && a[1] === b[1] && a[2] === b[2],
};

/** Rotates `v` by +90 degrees around the unit axis `a` (Rodrigues, cos=0, sin=1). */
export function rotate90(v, a) {
  const c = vec.cross(a, v);
  return vec.add(c, vec.scale(a, vec.dot(a, v)));
}

const AXES = [
  [1, 0, 0], [-1, 0, 0],
  [0, 1, 0], [0, -1, 0],
  [0, 0, 1], [0, 0, -1],
];

export class CubeTopology {
  constructor(n) {
    if (n % 2 !== 0) throw new Error('Cube size must be even');
    this.n = n;
    this._cells = [];
    for (const normal of AXES) {
      const axis = normal.findIndex((v) => v !== 0);
      const [u, w] = [0, 1, 2].filter((i) => i !== axis);
      for (let i = -(n - 1); i <= n - 1; i += 2) {
        for (let j = -(n - 1); j <= n - 1; j += 2) {
          const p = [0, 0, 0];
          p[axis] = normal[axis] * n;
          p[u] = i;
          p[w] = j;
          this._cells.push({ p, n: normal });
        }
      }
    }
  }

  key(cell) {
    return cell.p.join(',');
  }

  step(cell, dir) {
    const p = vec.add(cell.p, vec.scale(dir, 2));
    if (Math.abs(vec.dot(p, dir)) <= this.n - 1) {
      return { cell: { p, n: cell.n }, dir };
    }
    // Fold over the edge: walk half a cell to the edge, then half a cell down
    // the neighbouring face. The old direction becomes the new normal.
    const q = vec.sub(vec.add(cell.p, dir), cell.n);
    return { cell: { p: q, n: dir }, dir: vec.neg(cell.n) };
  }

  isReverse(a, b) {
    return vec.eq(a, vec.neg(b));
  }

  sameDir(a, b) {
    return vec.eq(a, b);
  }

  cells() {
    return this._cells;
  }
}
