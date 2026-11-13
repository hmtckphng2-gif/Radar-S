import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {markerDelayState,markerDelayBadge,worstDelayState} from '../public/core.js';
const read=name=>readFileSync(new URL('../public/'+name,import.meta.url),'utf8');

test('marker ring uses only fresh GTFS-RT minutes and the exact requested thresholds',()=>{
 assert.equal(markerDelayState(null),'unknown');
 assert.equal(markerDelayState(undefined),'unknown');
 assert.equal(markerDelayState(''),'unknown');
 assert.equal(markerDelayState(-600),'ontime');
 assert.equal(markerDelayState(0),'ontime');
 assert.equal(markerDelayState(60),'delayed');
 assert.equal(markerDelayState(14*60),'delayed');
 assert.equal(markerDelayState(15*60),'severe');
});

test('the in-ring delay badge starts at five rounded GTFS-RT minutes',()=>{
 assert.equal(markerDelayBadge(null),'');
 assert.equal(markerDelayBadge(4*60+20),'');
 assert.equal(markerDelayBadge(5*60),'+5');
 assert.equal(markerDelayBadge(14*60),'+14');
 assert.equal(markerDelayBadge(15*60),'+15');
});

test('clusters take the worst valid GTFS-RT delay without treating missing values as zero',()=>{
 assert.equal(worstDelayState([null,undefined,'']),'unknown');
 assert.equal(worstDelayState([null,60]),'delayed');
 assert.equal(worstDelayState([60,900,300]),'severe');
 assert.equal(worstDelayState([-600,0]),'ontime');
});

test('vehicle markers have one CSS-only ring and badge, with no outline SVG or extra badge node',()=>{
 const app=read('app.js');
 assert.ok(!app.includes('marker-delay-outline'));
 assert.ok(!app.includes('sr40-delay'));
 assert.ok(app.includes('iconSize:[48,54],iconAnchor:[24,38]'));
});

test('all active legacy gold, selection and favorite rings are deleted rather than hidden',()=>{
 const html=read('index.html');
 const cssFiles=[...html.matchAll(/href="\/([^?"]+\.css)(?:\?|\")/g)].map(m=>m[1]);
 assert.ok(cssFiles.length>0);
 const active=[...new Set(cssFiles)].map(read);
 const joined=active.join('\n');
 for(const forbidden of [
  'marker-delay-outline','sr40-delay','border:2px dashed #e8b76b',
  'outline:2px dashed #c3a98a','outline:2px solid #85beff',
  'outline:2px solid rgba(246,244,237,.8)','filter:drop-shadow(0 0 3px #ffd700)'
 ]) assert.ok(!joined.includes(forbidden),`legacy ring remains: ${forbidden}`);
});

test('live, estimated, stale and unknown rings use separate CSS states and reduced motion',()=>{
 const css=read('radar94-preview-block1.css'),app=read('app.js');
 assert.ok(css.includes('--sr-delay-green:#7f9f86'));
 assert.ok(css.includes('--sr-delay-amber:#c49a55'));
 assert.ok(css.includes('--sr-delay-red:#d66b70'));
 assert.ok(css.includes('delay-unknown .marker-circle::before')&&css.includes('border-style:dashed')&&css.includes('box-shadow:none'));
 assert.ok(css.includes('.sr86-estimated .marker-circle::before'));
 assert.ok(css.includes('.sr43-stale .marker-circle::before'));
 assert.ok(css.includes('.sr86-unconfirmed .marker-circle::before'));
 assert.ok(css.includes('animation:sr-delay-pulse 2s ease-in-out infinite'));
 assert.ok(css.includes('@media(prefers-reduced-motion:reduce)'));
 assert.ok(app.includes('bounds.contains(entry.marker.getLatLng())'));
 assert.ok(app.includes("map.on('movestart'"));
 assert.ok(app.includes('updateVisibleDelayPulses();'));
});

test('cluster rings use the worst delay class and never pulse',()=>{
 const js=read('radar43.js'),css=read('radar94-preview-block1.css');
 assert.ok(js.includes('worstDelayState(delays)'));
 assert.ok(js.includes('const clusterClass=')&&js.includes('position-dashed'));
 assert.ok(css.includes('.sr43-cluster-icon.delay-severe .sr43-cluster-circle'));
 assert.ok(css.includes('.sr43-cluster-icon.position-dashed .sr43-cluster-circle::before'));
 assert.ok(!css.includes('.sr43-cluster-circle::before{animation'));
 assert.ok(js.includes("classList.remove('delay-pulse')"));
});

test('delay legend and its box stay hidden while vehicle delay rings remain available',()=>{
 const css=read('radar94-preview-block1.css'),html=read('index.html');
 assert.ok(css.includes('.sr-delay-legend{display:none!important}'));
 assert.ok(css.includes('.sr-delay-legend__grid'));
 assert.ok(html.includes('radar94-preview-block1.css?v=9.9.5&rev=dark-map-clean-ui-2'));
});

test('stale and estimated quality never grayscale the delay ring itself',()=>{
 const app=read('app.js'),staleCss=read('radar43.css')+read('radar80-map.css')+read('radar671.css');
 assert.ok(app.includes('v?.estimated===true||v?.positionEstimated===true'));
 assert.ok(app.includes('/estimated|estimate|simuliert'));
 assert.ok(app.includes('observationQuality(v).ageSeconds===null'));
 assert.ok(!/\.marker-wrap\.sr43-stale \.marker-circle\{[^}]*filter:grayscale/.test(staleCss));
 assert.ok(staleCss.includes('.marker-wrap.sr43-stale .marker-circle svg{filter:grayscale(.8)!important;'));
});

test('marker delay is sourced from a fresh matching GTFS-RT trip update only',()=>{
 const app=read('app.js');
 const start=app.indexOf('function currentVehicleDelay(v)');
 const end=app.indexOf('// Limited local bridge',start);
 const source=app.slice(start,end);
 assert.ok(source.includes("state.statuses[v.source+'_updates']!=='ok'"));
 assert.ok(source.includes('state.updates.get(v.source+\':\'+v.tripId)'));
 assert.ok(source.includes('vehicleDelayInfo(update,v)'));
 assert.ok(!source.includes('positionDeviation'));
});
