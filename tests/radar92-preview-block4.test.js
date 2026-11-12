import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {delayPresentation,formatDelay} from '../public/core.js';
import {feedQuality} from '../public/radar56-logic.mjs';
import {formatStationName,sourceLabel} from '../public/radar92-details.mjs';
import {readFileSync} from 'node:fs';
const read=name=>readFileSync(new URL('../public/'+name,import.meta.url),'utf8');
const sandbox={module:{exports:{}},globalThis:{}};
vm.runInNewContext(read('radar47.js'),sandbox);
const {radar47}=sandbox.module.exports;
const pretty=value=>String(value||'Haltestelle').toLocaleLowerCase('de-DE').replace(/^\p{L}/u,c=>c.toLocaleUpperCase('de-DE'));
const clock=value=>{const m=Math.floor(Number(value)/60);return String(Math.floor(m/60)%24).padStart(2,'0')+':'+String(m%60).padStart(2,'0')};

test('confirmed at-stop location is one combined current and next-stop sentence',()=>{
 const confirmation={rows:[['br',75600,76200,1],['la',76440,76500,2]],index:0,atStop:true,name:'BRONZOLO'};
 assert.equal(radar47.locationSummary(confirmation,{la:['LAIVES']},pretty,clock),'Aktuell: am Halt Bronzolo · nächster Halt Laives 21:14');
});

test('moving vehicle shows one next-stop line and never claims it is at a stop',()=>{
 const confirmation={rows:[['br',75600,76200,1],['la',76440,76500,2]],index:1,atStop:false,name:'LAIVES'};
 assert.equal(radar47.locationSummary(confirmation,{},pretty,clock),'Nächster gemeldeter Halt: Laives');
});

test('delay presentation is explicit and uses the requested severity thresholds',()=>{
 assert.deepEqual(delayPresentation(-60),{minutes:-1,label:'1 Min. früher',className:'delay-ok'});
 assert.equal(delayPresentation(0).label,'pünktlich');
 assert.equal(delayPresentation(0).className,'delay-ok');
 assert.equal(delayPresentation(60).label,'1 Min. verspätet');
 assert.equal(delayPresentation(60).className,'delay-warn');
 assert.equal(delayPresentation(840).className,'delay-warn');
 assert.equal(delayPresentation(900).className,'delay-severe');
 assert.equal(delayPresentation(null).className,'delay-none');
 assert.equal(formatDelay(-60),'1 Min. früher');
});

test('position age is shown in readable relative minutes, not raw seconds',()=>{
 const now=1_700_000_000_000;
 const quality=feedQuality({source:'trains',timestamp:now/1000-218},{trains:'ok'},now);
 assert.equal(quality.label,'Position geschätzt');
 assert.equal(quality.detail,'Position vor 4 Min. gemeldet');
});

test('train station names use normal capitalization and source is Zug',()=>{
 assert.equal(formatStationName('BRONZOLO'),'Bronzolo');
 assert.equal(formatStationName('LAIVES'),'Laives');
 assert.equal(sourceLabel('trains'),'Zug');
});

test('train details remove raw GTFS/RT wording and duplicate current-stop labels',()=>{
 const vehicle=read('radar37.js'),progress=read('radar47.js'),journey=read('radar56.js');
 assert.ok(!vehicle.includes('(Fahrplantag)'));
 assert.ok(!vehicle.includes("bits.push('RT '"));
 assert.ok(!vehicle.includes('Bahnposition kann geschätzt sein'));
 assert.ok(!vehicle.includes("'Position '+age+' alt'"));
 assert.ok(vehicle.includes("p?'Fahrtstatus':'Nächster Halt nicht verifiziert'"));
 assert.ok(progress.includes('U.locationSummary('));
 assert.ok(journey.includes("!document.querySelector('.sr47-progress-next')"));
 assert.ok(journey.includes("mk('strong','','Fahrtverlauf')"));
 assert.ok(!journey.includes('Fahrplanfortschritt'));
});

test('train itinerary uses title-case station names and plain delay text',()=>{
 const itinerary=read('radar54.js');
 assert.ok(itinerary.includes('formatStationName(st?.[0]||'));
 assert.ok(itinerary.includes('delayPresentation(delay).label'));
 assert.ok(itinerary.includes('FAHRTVERLAUF'));
});

test('delay colors are restrained and severity classes remain distinct',()=>{
 const css=read('radar92-preview-block4.css');
 assert.ok(css.includes('#9bc5a7'));
 assert.ok(css.includes('#d5b77f'));
 assert.ok(css.includes('#d88f98'));
});

test('main detail and same-line chips use the shared delay presentation',()=>{
 const app=read('app.js');
 assert.ok(app.includes('delayPresentation(info?.delay??null)'));
 assert.ok(app.includes("delay?delayView.label:'Keine Daten'"));
});
