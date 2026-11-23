import test from 'node:test';
import assert from 'node:assert/strict';
import {actualStopTimes,normalizeTrain} from '../public/train-platforms-logic.mjs';

test('normalizes official actual arrival and departure timestamps separately from platform tracks',()=>{
 const arrival=Date.parse('2026-11-23T12:05:00Z');
 const departure=Date.parse('2026-11-23T12:06:30Z');
 const raw={numeroTreno:758,fermate:[{
  id:'S0685',stazione:'BOLZANO',tipoFermata:'F',
  arrivo_teorico:Date.parse('2026-11-23T12:00:00Z'),
  partenza_teorica:Date.parse('2026-11-23T12:01:00Z'),
  arrivoReale:arrival,partenzaReale:departure,
  binarioProgrammatoArrivoDescrizione:'3',
  binarioEffettivoArrivoDescrizione:'4',
  binarioProgrammatoPartenzaDescrizione:'3',
  binarioEffettivoPartenzaDescrizione:'5'
 }]};
 const normalized=normalizeTrain(raw,'758','2026-11-23',Date.parse('2026-11-23T12:07:00Z'));
 assert.equal(normalized.stops[0].actualArrivalAt,arrival);
 assert.equal(normalized.stops[0].actualDepartureAt,departure);
 assert.equal(normalized.stops[0].plannedArrival,'3');
 assert.equal(normalized.stops[0].actualArrival,'4');
 assert.equal(normalized.stops[0].actualDeparture,'5');
});

test('does not invent an actual intermediate arrival from the generic effective event',()=>{
 const times=actualStopTimes({tipoFermata:'F',effettiva:Date.parse('2026-11-23T12:06:30Z')});
 assert.equal(times.actualArrivalAt,null);
 assert.equal(times.actualDepartureAt,Date.parse('2026-11-23T12:06:30Z'));
});

test('uses the generic effective event only for a terminal arrival or origin departure',()=>{
 const stamp=Date.parse('2026-11-23T12:06:30Z');
 assert.deepEqual(actualStopTimes({tipoFermata:'A',effettiva:stamp}),{actualArrivalAt:stamp,actualDepartureAt:null});
 assert.deepEqual(actualStopTimes({tipoFermata:'P',effettiva:stamp}),{actualArrivalAt:null,actualDepartureAt:stamp});
});

test('leaves absent actual times null and rejects non-timestamp values',()=>{
 assert.deepEqual(actualStopTimes({tipoFermata:'A',effettiva:'17:06'}),{actualArrivalAt:null,actualDepartureAt:null});
});
