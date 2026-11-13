import test from 'node:test';
import assert from 'node:assert/strict';
import {trainReplayDuration} from '../public/radar705-motion.mjs';
const NOW=1700000500000,position={kind:'train',stale:false,timestamp:1700000490};
test('30-second report has long but bounded continuous replay',()=>{const n=trainReplayDuration(position,1700000460,900,NOW);assert.ok(n>=20000&&n<=24000)});
test('never extrapolates unchanged, old or stale train reports',()=>{assert.equal(trainReplayDuration(position,position.timestamp,900,NOW),0);assert.equal(trainReplayDuration({...position,stale:true},1700000460,900,NOW),0);assert.equal(trainReplayDuration({...position,timestamp:1700000000},1699999970,900,NOW),0)});
test('implausible speed and large jumps do not get replayed',()=>{assert.equal(trainReplayDuration(position,1700000480,1500,NOW),0);assert.equal(trainReplayDuration(position,1700000460,3100,NOW),0)});
test('accessibility motion preference and buses are respected',()=>{assert.equal(trainReplayDuration(position,1700000460,900,NOW,true),0);assert.equal(trainReplayDuration({...position,kind:'bus'},1700000460,900,NOW),0)});
