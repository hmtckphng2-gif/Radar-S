import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=name=>readFileSync(new URL('../public/'+name,import.meta.url),'utf8');
test('vehicle details distinguish schedule-point distance from reported delay and show data age/source',()=>{
 const app=read('app.js');
 assert.ok(app.includes("import {trainScheduledPosition,buildDepartureRows,romeSeconds}"));
 assert.ok(app.includes("detail('Abstand zum Fahrplanpunkt'"));
 assert.ok(app.includes("detail('Positionsalter',formatRelativeAge(feedAgeSeconds(v)))"));
 assert.ok(app.includes("detail('Datenquelle',sourceLabel(v.source)+' · Echtzeitdaten')"));
 assert.ok(app.includes("detail('Unterschied der Angaben'"));
 assert.ok(app.includes('trainScheduledPosition(v,state.indexes,state.details,state.shapes)'));
});

test('vehicle note explains feed position quality without presenting it as confirmed GPS',()=>{
 const app=read('app.js');
 assert.ok(app.includes('Die Kartenposition stammt aus dem jeweiligen Echtzeitfeed'));
 assert.ok(app.includes('GPS-Genauigkeit ist nicht bestätigt'));
 assert.ok(app.includes('Ist/Soll beschreibt die Ortsabweichung zum Fahrplanpunkt'));
 assert.ok(app.includes("$('sheetNote').textContent=note;$('sheetNote').hidden=false"));
});

test('schedule panels show a loading message while timetable details are fetched',()=>{
 const app=read('app.js');
 assert.equal((app.match(/emptySchedule'\)\.textContent=t\('journey\.loadingStops'\)/g)||[]).length,2);
});

test('production stop deduplication, STA direct mapping and freshness gate are preserved',()=>{
 const app=read('app.js');
 assert.ok(app.includes('const rawRows=stopRows(details,v.tripId),seenRows=new Set()'));
 assert.ok(app.includes("const updateSource=v.source==='sta_direct'?'sta':v.source"));
 assert.ok(app.includes("Number.isFinite(Number(update.fetchedAt))"));
 assert.ok(app.includes("txt(u.stopId??u.stop_id).toLowerCase()"));
 assert.ok(app.includes("expectedStopTime(plannedSeconds,event)"));
});
