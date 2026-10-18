import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
const root = new URL('../', import.meta.url).pathname;
for (const path of ['public/radar57.js', 'public/radar58.js']){
 test(path+' has valid JS syntax', ()=>{
  const result=spawnSync(process.execPath,['--check',path],{cwd:root,encoding:'utf8'});
  assert.equal(result.status,0,result.stderr);
 });
}
test('all new feature modules link correctly',async()=>{
 globalThis.document={readyState:'loading',addEventListener(){}};
 globalThis.window={};
 await import('../public/radar57.js');
 await import('../public/radar58.js');
});
