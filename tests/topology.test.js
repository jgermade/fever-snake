import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CubeTopology, rotate90, vec } from '../src/topologies/cube.js';
import { GridTopology, isFullyConnected } from '../src/topologies/grid.js';

test('cube: walking straight 4N steps returns to the start', () => {
  const N = 8;
  const cube = new CubeTopology(N);
  for (const dir of [[0, 1, 0], [1, 0, 0], [0, -1, 0], [-1, 0, 0]]) {
    let cell = { p: [-1, -1, N], n: [0, 0, 1] };
    let d = dir;
    const seen = new Set();
    for (let i = 0; i < 4 * N; i++) {
      const r = cube.step(cell, d);
      assert.ok(r, 'cube never blocks');
      cell = r.cell;
      d = r.dir;
      seen.add(cube.key(cell));
      // every visited cell is a real cell of the cube
      assert.ok(cube.cells().some((c) => cube.key(c) === cube.key(cell)), `unknown cell ${cube.key(cell)}`);
      assert.equal(vec.dot(d, cell.n), 0, 'direction stays tangent');
    }
    assert.deepEqual(cell.p, [-1, -1, N]);
    assert.deepEqual(d, dir);
    assert.equal(seen.size, 4 * N);
  }
});

test('cube: has 6*N*N unique cells', () => {
  const cube = new CubeTopology(6);
  const keys = new Set(cube.cells().map((c) => cube.key(c)));
  assert.equal(keys.size, 6 * 36);
});

test('cube: rotate90 maps normal onto the travel direction', () => {
  const n0 = [0, 0, 1];
  const n1 = [0, 1, 0];
  const axis = vec.cross(n0, n1);
  assert.deepEqual(rotate90(n0, axis), n1);
  assert.deepEqual(rotate90(n1, axis), vec.neg(n0));
});

test('grid: borders kill, wrap wraps', () => {
  const g = new GridTopology({ width: 3, height: 3 });
  assert.equal(g.step({ x: 0, y: 0 }, 3), null);
  const w = new GridTopology({ width: 3, height: 3, wrap: true });
  assert.deepEqual(w.step({ x: 0, y: 0 }, 3).cell, { x: 2, y: 0 });
  assert.deepEqual(w.step({ x: 1, y: 2 }, 2).cell, { x: 1, y: 0 });
});

test('grid: walls block and connectivity check works', () => {
  const g = new GridTopology({ width: 3, height: 3, walls: [[1, 0], [1, 1], [1, 2]] });
  assert.equal(g.step({ x: 0, y: 0 }, 1), null);
  assert.equal(isFullyConnected(g, { x: 0, y: 0 }), false);
  const h = new GridTopology({ width: 3, height: 3, walls: [[1, 0], [1, 1]] });
  assert.equal(isFullyConnected(h, { x: 0, y: 0 }), true);
});

import { MobiusTopology } from '../src/topologies/mobius.js';

test('mobius: crossing the seam mirrors x; two laps return to the start', () => {
  const m = new MobiusTopology({ width: 5, height: 6 });
  const r = m.step({ x: 1, y: 5 }, 2);
  assert.deepEqual(r.cell, { x: 3, y: 0 });
  assert.ok(r.seam);
  assert.equal(m.step({ x: 4, y: 2 }, 1), null, 'long edges are deadly');
  let c = { x: 1, y: 0 };
  for (let i = 0; i < 12; i++) c = m.step(c, 2).cell;
  assert.deepEqual(c, { x: 1, y: 0 });
});

test('klein bottle: x wraps plainly, y wraps with a mirror', () => {
  const k = new MobiusTopology({ width: 6, height: 4, wrapX: true });
  assert.deepEqual(k.step({ x: 5, y: 1 }, 1).cell, { x: 0, y: 1 });
  assert.deepEqual(k.step({ x: 1, y: 0 }, 0).cell, { x: 4, y: 3 });
});
