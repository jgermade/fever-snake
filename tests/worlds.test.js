import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WORLDS } from '../src/worlds/index.js';
import { isValidOrder, makeOrder } from '../src/order.js';
import { rng } from '../src/render/util.js';
import { PortalGridTopology } from '../src/topologies/portal-grid.js';

test('worlds have unique ids and the fields the game needs', () => {
  const ids = new Set();
  for (const w of WORLDS) {
    assert.ok(w.id && w.title && w.controls && w.tickMs > 0 && typeof w.setup === 'function', w.id);
    assert.ok(!ids.has(w.id), `duplicate id ${w.id}`);
    ids.add(w.id);
  }
  assert.ok(WORLDS.length >= 13);
});

test('the authored order never puts two 3D worlds back to back (also when looping)', () => {
  const order = WORLDS.map((_, i) => i);
  assert.ok(isValidOrder(WORLDS, order, order.at(-1)));
});

test('random orders are valid permutations, honour first/after and vary', () => {
  const rand = rng(42);
  const seen = new Set();
  let prev = null;
  for (let i = 0; i < 300; i++) {
    const first = i % 3 === 0 ? i % WORLDS.length : null;
    const order = makeOrder(WORLDS, rand, { first, after: first == null ? prev : null });
    assert.deepEqual([...order].sort((a, b) => a - b), WORLDS.map((_, k) => k));
    assert.ok(isValidOrder(WORLDS, order, first == null ? prev : null));
    if (first != null) assert.equal(order[0], first);
    seen.add(order.join(','));
    prev = order.at(-1);
  }
  assert.ok(seen.size > 250, 'orders are shuffled');
});

test('portals teleport the head to the twin, keeping the direction', () => {
  const t = new PortalGridTopology({ width: 8, height: 4 }, [[[2, 1], [6, 2]]]);
  const r = t.step({ x: 1, y: 1 }, 1);
  assert.deepEqual(r.cell, { x: 6, y: 2 });
  assert.equal(r.dir, 1);
  assert.deepEqual(t.step({ x: 6, y: 1 }, 2).cell, { x: 2, y: 1 });
  assert.ok(t.cells().every((c) => !t.isPortal(c.x, c.y)), 'apples never spawn on portals');
});
