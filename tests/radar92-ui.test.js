import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=name=>readFileSync(new URL('../public/'+name,import.meta.url),'utf8');
test('vehicle details separate reported minutes from spatial distance and isolate raw IDs',()=>{
 const app=read('app.js');
 assert.match(app,/detail\('Gemeldete Verspätung'/);
 assert.match(app,/detail\('Abstand zum Fahrplanpunkt'/);
 assert.match(app,/technicalDetails\(\{tripId:v\.tripId,vehicleId:v\.vehicleId\}\)/);
 assert.match(app,/Die gemeldete Verspätung stammt aus der Echtzeitmeldung/);
});
test('stop list styles passed, current and upcoming stops with plan time secondary',()=>{
 const app=read('app.js'),logic=read('radar37.js'),css=read('radar37.css');
 assert.match(logic,/stop-past/);assert.match(logic,/stop-current/);assert.match(logic,/stop-future/);
 assert.match(css,/#stops \.stop-past/);assert.match(css,/#stops \.stop-current/);assert.match(css,/#stops \.stop-future/);
 assert.match(app,/expectedStopTime\(plannedSeconds,event\)/);
 assert.match(app,/stop-plan-time/);
});
test('confirmed current and next stop are combined and the timetable duplicate is suppressed',()=>{
 const feed=read('radar37.js'),progress=read('radar47.js'),schedule=read('radar56.js');
 assert.match(feed,/Fahrtstatus/);
 assert.match(progress,/Aktuell: am Halt/);
 assert.match(schedule,/!document.querySelector\('.sr47-progress-next'\)/);
});
test('raw trip IDs are not displayed in 3D metadata',()=>{
 const logic=read('radar83-logic.mjs');
 assert.doesNotMatch(logic,/tripId/);
 assert.match(logic,/Datenquelle: /);
});
