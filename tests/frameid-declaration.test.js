import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(resolve(here, '../public/app.js'), 'utf8');

describe('frameId declaration', () => {
  it('declares frameId before requestMotionFrame and animationLoop', () => {
    const declIdx = src.indexOf('let frameId = 0;');
    const reqIdx = src.indexOf('function requestMotionFrame()');
    const animIdx = src.indexOf('function animationLoop(');
    assert.ok(declIdx >= 0, 'let frameId = 0; fehlt');
    assert.ok(reqIdx >= 0, 'requestMotionFrame fehlt');
    assert.ok(animIdx >= 0, 'animationLoop fehlt');
    assert.ok(declIdx < reqIdx, 'frameId muss vor requestMotionFrame stehen');
    assert.ok(declIdx < animIdx, 'frameId muss vor animationLoop stehen');
  });
});
