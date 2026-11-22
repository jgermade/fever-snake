import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GridTopology } from '../src/topologies/grid.js';
import { CubeTopology } from '../src/topologies/cube.js';
import { MIN_RUNWAY, placeSnake, runway } from '../src/placement.js';
import { absoluteGrid, gridUV } from '../src/worlds/grid-input.js';
import { rng } from '../src/render/util.js';

const gridWorld = (topology) => ({
  topology,
  mapAction: absoluteGrid,
  uvOf: gridUV(topology.width, topology.height),
  spawn: { cell: { x: 0, y: 0 }, dir: 1 },
});

test('does not drop the snake in front of a wall', () => {
  // Wall right in front of the exact carried position, heading right.
  const topo = new GridTopology({ width: 20, height: 12, walls: [[11, 6], [11, 5], [11, 7]] });
  const inst = gridWorld(topo);
  const carry = { ...inst.uvOf({ x: 10, y: 6 }), action: 'right' };
  const { cell, dir } = placeSnake(inst, carry);
  assert.ok(runway(topo, cell, dir) >= MIN_RUNWAY, `runway ${runway(topo, cell, dir)} at ${JSON.stringify(cell)} dir ${dir}`);
});

test('does not drop the snake heading into the border', () => {
  const topo = new GridTopology({ width: 20, height: 12 });
  const inst = gridWorld(topo);
  const { cell, dir } = placeSnake(inst, { ...inst.uvOf({ x: 19, y: 6 }), action: 'right' });
  assert.ok(runway(topo, cell, dir) >= MIN_RUNWAY);
});

test('keeps the heading and spot when there is room', () => {
  const topo = new GridTopology({ width: 20, height: 12 });
  const inst = gridWorld(topo);
  const res = placeSnake(inst, { ...inst.uvOf({ x: 5, y: 6 }), action: 'right' });
  assert.equal(res.dir, 1);
  assert.ok(Math.abs(res.cell.x - 5) <= 2 && Math.abs(res.cell.y - 6) <= 2, JSON.stringify(res.cell));
});

test('random cluttered boards: arrival always has a long runway', () => {
  const r = rng(7);
  for (let i = 0; i < 200; i++) {
    const walls = [];
    for (let k = 0; k < 40; k++) walls.push([Math.floor(r() * 24), Math.floor(r() * 16)]);
    const topo = new GridTopology({ width: 24, height: 16, walls });
    const inst = gridWorld(topo);
    const carry = { u: r(), v: r(), action: ['up', 'right', 'down', 'left'][Math.floor(r() * 4)] };
    const { cell, dir } = placeSnake(inst, carry);
    assert.ok(!topo.isWall(cell.x, cell.y));
    assert.ok(runway(topo, cell, dir) >= MIN_RUNWAY, `case ${i}: runway ${runway(topo, cell, dir)}`);
  }
});

test('works on non-grid topologies (cube)', () => {
  const topo = new CubeTopology(8);
  const res = placeSnake({ topology: topo, mapAction: (a) => ({ up: [0, 1, 0], down: [0, -1, 0], right: [1, 0, 0], left: [-1, 0, 0] })[a], uvOf: () => ({ u: 0.5, v: 0.5 }), placeCells: topo.cells().filter((c) => c.n[2] === 1), spawn: null }, { u: 0.5, v: 0.5, action: 'up' });
  assert.ok(res && res.cell.n[2] === 1);
});
