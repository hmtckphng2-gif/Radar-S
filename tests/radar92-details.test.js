import test from 'node:test';
import assert from 'node:assert/strict';
import {formatStationName,sameStationName,sourceLabel,formatRelativeAge,hasKnownPlatform,expectedStopTime} from '../public/radar92-details.mjs';
test('station names use normal case without changing accents or hyphens',()=>{
 assert.equal(formatStationName("MAGRÈ'-CORTACCIA"),'Magrè-Cortaccia');
 assert.equal(formatStationName("PC DOLCE'"),'PC Dolce');
 assert.equal(sameStationName("MAGRÈ'-CORTACCIA",'Magrè-Cortaccia'),true);
});
test('data sources use German labels',()=>{
 assert.equal(sourceLabel('trains'),'Zug');
 assert.equal(sourceLabel('sta_direct'),'STA direkt');
 assert.equal(sourceLabel('trentino'),'Trentino Trasporti');
});
test('position age is relative and missing values stay unknown',()=>{
 assert.equal(formatRelativeAge(262),'vor 4 Min.');
 assert.equal(formatRelativeAge(null),'Unbekannt');
});
test('unknown platform placeholders are not displayed',()=>{
 for(const value of ['',null,'—','unbekannt','unknown','n/a'])assert.equal(hasKnownPlatform(value),false);
 assert.equal(hasKnownPlatform('2'),true);
});

test('expected stop time uses only a supplied live delay and otherwise stays unknown',()=>{
 assert.equal(expectedStopTime(36000,{delay:660}),'10:11');
 assert.equal(expectedStopTime(36000,{delay:0}),'10:00');
 assert.equal(expectedStopTime(36000,{}),null);
 assert.equal(expectedStopTime(36000,{delay:null}),null);
});
