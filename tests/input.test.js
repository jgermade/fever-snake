import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SwipeTracker } from '../src/input.js';

/** Feeds a path of points (1px apart) and returns the emitted actions. */
function trace(points, opts) {
  const t = new SwipeTracker(opts);
  const out = [];
  t.start(...points[0]);
  for (const p of points.slice(1)) {
    const a = t.move(...p);
    if (a) out.push(a);
  }
  const tap = t.end();
  if (tap) out.push(tap);
  return out;
}

const line = (from, to) => {
  const n = Math.max(Math.abs(to[0] - from[0]), Math.abs(to[1] - from[1]));
  return Array.from({ length: n + 1 }, (_, i) => [from[0] + ((to[0] - from[0]) * i) / n, from[1] + ((to[1] - from[1]) * i) / n]);
};

test('an L-shaped stroke turns twice without lifting the finger', () => {
  const path = [...line([0, 0], [0, 60]), ...line([0, 60], [60, 60])];
  assert.deepEqual(trace(path), ['down', 'right']);
});

test('a zig-zag stroke steers every leg', () => {
  const path = [...line([0, 0], [40, 0]), ...line([40, 0], [40, 40]), ...line([40, 40], [80, 40]), ...line([80, 40], [80, 0])];
  assert.deepEqual(trace(path), ['right', 'down', 'right', 'up']);
});

test('a long straight stroke does not spam the same action', () => {
  assert.deepEqual(trace(line([0, 0], [0, 60])), ['down']);
});

test('keeping on in the same direction repeats after a longer stroke (relative controls)', () => {
  assert.deepEqual(trace(line([0, 0], [-120, 0])), ['left', 'left']);
});

test('a short touch is a tap', () => {
  assert.deepEqual(trace([[10, 10], [14, 12]]), ['tap']);
});

test('slight sideways wobble does not trigger a turn', () => {
  const path = line([0, 0], [0, 70]).map(([x, y], i) => [x + (i % 2 ? 4 : -4), y]);
  assert.deepEqual(trace(path), ['down']);
});
