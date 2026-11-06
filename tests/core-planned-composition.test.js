import test from 'node:test';
import assert from 'node:assert/strict';
import {plannedTrainComposition, parseVehicles, PLANNED_TRAIN_COMPOSITION_URL} from '../public/core.js';

test('official 2026 Trentino timetable exposes only exact, unambiguous daily train numbers',()=>{
  const flirt=plannedTrainComposition('16685','trains','2026-11-06');
  assert.equal(flirt.type,'FLIRT');
  assert.equal(flirt.composition,'ETR170 · 6 casse');
  assert.equal(flirt.confidence,'planned');
  assert.equal(flirt.sourceUrl,PLANNED_TRAIN_COMPOSITION_URL);
  assert.equal(plannedTrainComposition('16673','trains','2026-11-06').composition,'ETR526 · 6 casse');
  assert.equal(plannedTrainComposition('16701','trains','2026-11-06').composition,'ETR526 · 6 casse');
});

test('ambiguous or unsupported numbers are never assigned a planned composition',()=>{
  assert.equal(plannedTrainComposition('16039','trains','2026-11-06'),null);
  for (const number of ['16053','16054','16062','16063','16070','16071','16072','16073'])
    assert.equal(plannedTrainComposition(number,'trains','2026-11-06'),null);
  assert.equal(plannedTrainComposition('16685','trains','2027-01-01'),null);
});

test('planned composition never leaks to other feeds or outside the 2026 timetable year',()=>{
  assert.equal(plannedTrainComposition('16685','sta','2026-11-06'),null);
  assert.equal(plannedTrainComposition('16685','trentino','2026-11-06'),null);
  assert.equal(plannedTrainComposition('16685','trains',''),null);
});

test('vehicle parser attaches the planned composition using GTFS commercial short name and service date',()=>{
  const staticData={trains:{trips:{'trip-16685':['route-1','Verona','shape-1','16685']},routes:{'route-1':['REG','Regionale','2']}}};
  const feed={entity:[{id:'entity-1',vehicle:{trip:{tripId:'trip-16685',routeId:'route-1',startDate:'20261106'},vehicle:{id:'fleet-unknown'},position:{latitude:46.5,longitude:11.35}}}]};
  const parsed=parseVehicles(feed,'trains',staticData,Date.parse('2026-11-06T10:00:00Z'));
  assert.equal(parsed.vehicles.length,1);
  assert.equal(parsed.vehicles[0].plannedComposition.type,'FLIRT');
  assert.equal(parsed.vehicles[0].plannedComposition.confidence,'planned');
  assert.equal(parsed.vehicles[0].vehicleId,'fleet-unknown');
});

test('no GTFS service date means no time-limited planned composition is attached',()=>{
  const staticData={trains:{trips:{'trip-16685':['route-1','Verona','shape-1','16685']},routes:{'route-1':['REG','Regionale','2']}}};
  const feed={entity:[{id:'entity-1',vehicle:{trip:{tripId:'trip-16685',routeId:'route-1'},vehicle:{id:'fleet-unknown'},position:{latitude:46.5,longitude:11.35}}}]};
  const parsed=parseVehicles(feed,'trains',staticData,Date.now());
  assert.equal(parsed.vehicles[0].plannedComposition,null);
});
