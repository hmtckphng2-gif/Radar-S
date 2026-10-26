import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../worker.js';

test('STA collector API is read-only, normalizes source data, and explicitly reports no persistence', async () => {
  const oldFetch = globalThis.fetch;
  globalThis.fetch = async url => {
    assert.equal(String(url), 'https://gtfs.api.opendatahub.com/v1/realtime/sta-time-tables/vehicle-positions');
    return new Response(JSON.stringify({entity:[{id:'e1',vehicle:{vehicle:{id:'sta-1'},position:{latitude:46.5,longitude:11.35},timestamp:1800000000}}]}), {headers:{'content-type':'application/json'}});
  };
  try {
    const response = await worker.fetch(new Request('https://radar.test/api/v1/collector/sta'), {});
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.schema, 'radar.collector.snapshot.v1');
    assert.equal(body.statistics.accepted, 1);
    assert.equal(body.vehicles[0].source, 'sta-open-data-hub');
    assert.equal(body.storage.enabled, false);
    assert.equal(body.source.persisted, false);
    assert.equal(response.headers.get('cache-control'), 'no-store');
  } finally { globalThis.fetch = oldFetch; }
});

test('STA collector API fails closed for an unsupported source payload', async () => {
  const oldFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({unexpected:true}), {headers:{'content-type':'application/json'}});
  try {
    const response = await worker.fetch(new Request('https://radar.test/api/v1/collector/sta'), {});
    assert.equal(response.status, 502);
    assert.equal((await response.json()).reason, 'format');
  } finally { globalThis.fetch = oldFetch; }
});
