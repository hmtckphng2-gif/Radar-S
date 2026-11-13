import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const recovery = readFileSync('public/radar-recovery.js', 'utf8');

test('classic map is only the recovery path when the primary map is not ready', () => {
  assert.match(recovery, /function primaryMapReady\(\)/);
  assert.match(recovery, /if\(primaryMapReady\(\) \|\| fallback \|\| !window\.L\)return/);
  assert.match(recovery, /data-map-mode','classic-fallback/);
  assert.match(recovery, /KLASSISCHE KARTE · NOTFALL/);
});

test('recovery keeps live API requests uncached', () => {
  assert.match(recovery, /fetch\('\/api\/'\+name,\{cache:'no-store'\}\)/);
});
