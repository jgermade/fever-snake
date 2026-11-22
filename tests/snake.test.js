import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GridTopology } from '../src/topologies/grid.js';
import { Snake, randomFreeCell } from '../src/snake.js';
import { absoluteGrid, relativeGrid } from '../src/worlds/grid-input.js';

const grid = () => new GridTopology({ width: 10, height: 10 });

test('snake unrolls from a single cell to its target length', () => {
  const s = new Snake(grid(), { cell: { x: 1, y: 5 }, dir: 1 }, 4);
  assert.equal(s.body.length, 1);
  for (let i = 0; i < 5; i++) s.step(null, absoluteGrid);
  assert.equal(s.body.length, 4);
  assert.deepEqual(s.head, { x: 6, y: 5 });
});

test('eating grows by one', () => {
  const g = grid();
  const s = new Snake(g, { cell: { x: 1, y: 5 }, dir: 1 }, 1);
  assert.equal(s.step(g.key({ x: 2, y: 5 }), absoluteGrid), 'ate');
  s.step(null, absoluteGrid);
  assert.equal(s.body.length, 2);
});

test('reverse input is ignored, perpendicular input turns', () => {
  const s = new Snake(grid(), { cell: { x: 5, y: 5 }, dir: 1 }, 3);
  s.enqueue('left');
  s.step(null, absoluteGrid);
  assert.equal(s.dir, 1);
  s.enqueue('up');
  s.step(null, absoluteGrid);
  assert.equal(s.dir, 0);
});

test('quick U-turn: perpendicular + reverse pressed together, in either order', () => {
  for (const keys of [['down', 'right'], ['right', 'down']]) {
    const s = new Snake(grid(), { cell: { x: 5, y: 5 }, dir: 3 }, 3); // heading left
    for (const k of keys) s.enqueue(k);
    s.step(null, absoluteGrid);
    assert.equal(s.dir, 2, `${keys}: turns down first`);
    s.step(null, absoluteGrid);
    assert.equal(s.dir, 1, `${keys}: then right`);
  }
});

test('a lone reverse press is dropped, not kept for later', () => {
  const s = new Snake(grid(), { cell: { x: 5, y: 5 }, dir: 3 }, 3);
  s.enqueue('right');
  s.step(null, absoluteGrid);
  assert.equal(s.dir, 3);
  assert.equal(s.queue.length, 0);
});

test('relative input turns from the current heading', () => {
  const s = new Snake(grid(), { cell: { x: 5, y: 5 }, dir: 0 }, 1);
  s.enqueue('right');
  s.step(null, relativeGrid);
  assert.equal(s.dir, 1);
  s.enqueue('right');
  s.step(null, relativeGrid);
  assert.equal(s.dir, 2);
});

test('hitting the border or itself kills', () => {
  const s = new Snake(grid(), { cell: { x: 8, y: 5 }, dir: 1 }, 1);
  s.step(null, absoluteGrid);
  assert.equal(s.step(null, absoluteGrid), 'dead');
  assert.equal(s.alive, false);

  const t = new Snake(grid(), { cell: { x: 1, y: 1 }, dir: 1 }, 6);
  for (let i = 0; i < 4; i++) t.step(null, absoluteGrid);
  for (const a of ['down', 'left', 'up']) {
    t.enqueue(a);
    var r = t.step(null, absoluteGrid);
  }
  assert.equal(r, 'dead');
});

test('moving into the cell the tail just left is allowed', () => {
  const s = new Snake(grid(), { cell: { x: 1, y: 1 }, dir: 1 }, 4);
  for (let i = 0; i < 3; i++) s.step(null, absoluteGrid); // body: (4,1)..(1,1)
  // square loop of length 4: down, left, up
  for (const a of ['down', 'left', 'up']) {
    s.enqueue(a);
    assert.notEqual(s.step(null, absoluteGrid), 'dead');
  }
});

test('randomFreeCell never picks the snake', () => {
  const g = new GridTopology({ width: 2, height: 1 });
  const s = new Snake(g, { cell: { x: 0, y: 0 }, dir: 1 }, 1);
  for (let i = 0; i < 20; i++) assert.deepEqual(randomFreeCell(g, s), { x: 1, y: 0 });
});
