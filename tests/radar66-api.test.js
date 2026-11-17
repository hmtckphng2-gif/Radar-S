import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeSnapshot} from '../public/radar66-api.mjs';

test('normalizeSnapshot: simulated Trenitalia positions are not published as live train markers', () => {
  const now=Date.now(), stamp=Math.floor(now/1000);
  const feeds={trains:{data:{header:{timestamp:stamp},entity:[{id:'train-1',vehicle:{trip:{tripId:'trip-1'},vehicle:{id:'t1',label:'REG 12345'},position:{latitude:46.5,longitude:11.35},timestamp:stamp}}]}},sta:{status:'error'},sta_direct:{status:'error'},trentino:{status:'error'}};
  const snapshot=normalizeSnapshot(feeds,now);
  assert.equal(snapshot.sources.trains,'simulated');
  assert.equal(snapshot.vehicles.length,0);
  assert.equal(snapshot.diagnostics.trains,0);
  assert.match(snapshot.positionDisclaimer,/geschätzt/);
});
