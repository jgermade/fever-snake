import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const sw = readFileSync(join(root, 'sw.js'), 'utf8');
const assets = [...sw.matchAll(/'\.\/([^']*)'/g)].map((m) => m[1]).filter(Boolean);

function walk(dir) {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : [relative(root, p)];
  });
}

test('every precached asset exists', () => {
  for (const a of assets) assert.ok(existsSync(join(root, a)), `missing ${a}`);
});

test('every runtime file is precached (offline play)', () => {
  const runtime = [...walk(join(root, 'src')), ...walk(join(root, 'css')), 'vendor/three.module.min.js'];
  for (const f of runtime) assert.ok(assets.includes(f), `${f} is not in sw.js ASSETS`);
});

test('the cache name carries a build placeholder for the deploy workflow', () => {
  assert.match(sw, /__BUILD__/);
});
