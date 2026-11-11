import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=name=>readFileSync(new URL('../public/'+name,import.meta.url),'utf8');

test('detail sheet close controls render one CSS X and have a 44px touch target',()=>{
 const html=read('index.html'),css=read('radar90-preview-block1.css');
 assert.ok(html.includes('title="Schließen"></button>'));
 assert.ok(html.includes('data-t-aria-label="stationSheet.close"></button>'));
 assert.ok(css.includes('font-size:0!important'));
 assert.ok(css.includes('width:44px!important')&&css.includes('height:44px!important'));
 assert.ok(css.includes('content:"×"'));
});

test('hidden empty model card cannot be forced visible by the global flex rule',()=>{
 const css=read('radar90-preview-block1.css'),base=read('radar-ui-v10.css');
 assert.ok(base.includes('.model-card { display:flex !important')) ;
 assert.ok(css.includes('.model-card[hidden] { display:none!important; }'));
});

test('3D vehicle metadata is contained in the sheet and hidden outside active 3D',()=>{
 const css=read('radar90-preview-block1.css');
 assert.ok(css.includes('body:not(.sr83-cinematic) #sr50MapTab #sheet .sr83-info-card'));
 assert.ok(css.includes('position:static!important'));
 assert.ok(css.includes('display:none!important'));
});

test('model attribution is concise and is only rendered inside the Quellen disclosure',()=>{
 const map=read('radar83-map.mjs'),model=read('radar83-model.mjs'),css=read('radar90-preview-block1.css');
 assert.ok(map.includes('sources.append(credit)'));
 assert.ok(!model.includes('Ziehen zum Schwenken'));
 assert.ok(css.includes('#sr50MapTab .sr83-credit { position:static!important'));
});

test('MapLibre attribution stays at the lower map edge rather than over the vehicle',()=>{
 const css=read('radar90-preview-block1.css');
 assert.ok(css.includes('bottom:calc(env(safe-area-inset-bottom,0px) + 88px)!important'));
});

test('changed 3D assets use fresh cache keys while release version remains unchanged',()=>{
 const html=read('index.html'),map=read('radar83-map.mjs'),camera=read('radar71-camera.mjs');
 assert.ok(html.includes('radar90-preview-block1.css?v=9.9.5&rev=block1-fixes-2'));
 assert.ok(html.includes('radar71-camera.mjs?v=9.9.5&rev=straight-up-exit-7'));
 assert.ok(map.includes('rev=credits-2')&&camera.includes('rev=straight-up-exit-7'));
 assert.ok(html.includes('radar83.css?v=9.9.5&rev=x-force-remove-2'));
 assert.ok(map.includes('rev=credits-2'));
});
