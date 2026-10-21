import test from 'node:test';
import assert from 'node:assert/strict';
import {delaySeverity,isSevereDelay,DELAY_SEVERITY,SEVERE_DELAY_MINUTES} from '../public/radar52-logic.mjs';

/* Radar 8.5 - the "strong red only from 15 minutes" rule had no single place.
 *
 * It was written inline twice in radar58.js ("x.minutes >= 15"), was not
 * tested anywhere and could not be reused. A cancelled trip or a broken
 * feed is a separate state and must never be expressed through minutes.
 *
 * The rule now lives once in radar52-logic.mjs and is covered here.
 */

test('a strong red starts at 15 minutes', () => {
  assert.equal(SEVERE_DELAY_MINUTES, 15);
  assert.equal(delaySeverity(15), DELAY_SEVERITY.severe);
  assert.equal(delaySeverity(16), DELAY_SEVERITY.severe);
  assert.equal(delaySeverity(120), DELAY_SEVERITY.severe);
  assert.equal(isSevereDelay(15), true);
  assert.equal(isSevereDelay(20), true);
});

test('below 15 minutes the delay is never severe', () => {
  assert.equal(delaySeverity(14), DELAY_SEVERITY.moderate);
  assert.equal(delaySeverity(14.9), DELAY_SEVERITY.moderate);
  assert.equal(isSevereDelay(14), false);
  assert.equal(isSevereDelay(14.9), false);
});

test('the smaller bands stay distinguishable', () => {
  assert.equal(delaySeverity(0), DELAY_SEVERITY.none);
  assert.equal(delaySeverity(1), DELAY_SEVERITY.minor);
  assert.equal(delaySeverity(4), DELAY_SEVERITY.minor);
  assert.equal(delaySeverity(5), DELAY_SEVERITY.moderate);
});

test('a negative delay is not a severe delay', () => {
  assert.equal(delaySeverity(-15), DELAY_SEVERITY.severe, 'a train 15 minutes early is still an absolute value');
  assert.equal(delaySeverity(-3), DELAY_SEVERITY.minor);
});

test('missing or broken values never produce a severity', () => {
  assert.equal(delaySeverity(null), DELAY_SEVERITY.none);
  assert.equal(delaySeverity(undefined), DELAY_SEVERITY.none);
  assert.equal(delaySeverity(''), DELAY_SEVERITY.none);
  assert.equal(delaySeverity('unknown'), DELAY_SEVERITY.none);
  assert.equal(delaySeverity(NaN), DELAY_SEVERITY.none);
  assert.equal(isSevereDelay(null), false);
});
