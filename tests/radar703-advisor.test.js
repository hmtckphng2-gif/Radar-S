import test from 'node:test';
import assert from 'node:assert/strict';
import {assessJourneys,orderJourneys,explainRecommendation,answerLocally,summarizeJourneyOptions} from '../public/radar703-advisor.mjs';
const trip=(departure,arrival,changes=0,status='possible')=>({departure,arrival,legs:Array.from({length:changes+1},(_,i)=>({name:'Line '+i,type:'train',fromStop:{name:'A'},toStop:{name:'B'}})),transfers:Array.from({length:changes},()=>({status,meters:20}))});
test('keeps every itinerary, even a risky connection',()=>{const j=[trip(3600,4500),trip(3700,4400,1,'risk'),trip(3800,4200)];const a=assessJourneys(j);assert.equal(a.length,3);assert.equal(new Set(a.map(x=>x.index)).size,3)});
test('explains scored recommendation as timetable-based',()=>{const e=assessJourneys([trip(3600,4200)])[0];assert.match(explainRecommendation(e),/Fahrplandaten/);assert.match(answerLocally('welche ist am besten',[trip(3600,4200)]),/keine Antwort eines KI-Modells/)});
test('respects departure, duration and transfer filters',()=>{const rows=[trip(4000,4800),trip(3700,4900,1),trip(4500,4700)];assert.equal(orderJourneys(rows,'departure')[0].index,1);assert.equal(orderJourneys(rows,'fastest')[0].index,2);assert.equal(orderJourneys(rows,'fewest')[0].changes,0)});
test('AI payload contains only summary, not raw trip data',()=>{const x=summarizeJourneyOptions([trip(3600,4200)])[0];assert.deepEqual(Object.keys(x).includes('tripId'),false);assert.equal(x.durationMinutes,10)});
