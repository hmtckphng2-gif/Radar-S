import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const root=new URL('../',import.meta.url);
test('preview Wrangler config declares the exact fail-closed rate-limit binding',()=>{
 const config=JSON.parse(readFileSync(new URL('../wrangler.jsonc',import.meta.url),'utf8'));
 const binding=config.ratelimits?.find(x=>x.name==='AI_JOURNEY_LIMITER');assert.ok(binding);assert.match(binding.namespace_id,/^[1-9][0-9]*$/);assert.deepEqual(binding.simple,{limit:5,period:60});assert.equal(config.name,'suedtirol-radar-preview');
});
test('preview deployment pins Wrangler with support for ratelimits bindings',()=>{
 const workflow=readFileSync(new URL('../.github/workflows/radar-preview.yml',import.meta.url),'utf8');assert.match(workflow,/wranglerVersion:\s*["']4\.36\.0["']/);assert.match(workflow,/deploy worker\.js --config wrangler\.jsonc/);
});
