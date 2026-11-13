import test from 'node:test';
import assert from 'node:assert/strict';
import {groupJourneyChoices} from '../public/radar705-groups.mjs';
const stop=(lat,lon)=>({lat,lon});
const entry=(name='16720',dep=75120,from=stop(46.23,11.21),suffix='8')=>({trip:{departure:dep,legs:[{type:'train',name,departure:dep,fromStop:from},{type:'bus',name:suffix,departure:dep+1800,fromStop:stop(46.5,11.35)}]}});
test('groups same first train as expandable but unique alternatives',()=>{const groups=groupJourneyChoices([entry(),entry('16720',75120,stop(46.2301,11.2101),'110'),entry('16721')]);assert.equal(groups.length,2);assert.equal(groups[0].alternatives.length,1)});
test('does not group separate departure times or geographic first stops',()=>{const groups=groupJourneyChoices([entry(),entry('16720',75240),entry('16720',75120,stop(46.65,11.15))]);assert.equal(groups.length,3)});
test('original list stays unmodified',()=>{const e=entry();groupJourneyChoices([e,entry()]);assert.equal(e.trip.legs.length,2)});
