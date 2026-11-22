import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compose } from '../src/music.js';
import { WORLDS } from '../src/worlds/index.js';

test('every world gets a deterministic, distinct loop', () => {
  const songs = WORLDS.map((w) => JSON.stringify(compose(w)));
  assert.deepEqual(WORLDS.map((w) => JSON.stringify(compose(w))), songs, 'deterministic');
  assert.equal(new Set(songs).size, WORLDS.length, 'distinct per world');
  for (const w of WORLDS) {
    const s = compose(w);
    assert.ok(s.bpm >= 88 && s.bpm <= 150);
    assert.equal(s.bass.length, 16);
    assert.ok(s.lead.some((n) => n != null));
  }
});
