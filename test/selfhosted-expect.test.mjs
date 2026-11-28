import test from 'node:test';
import assert from 'node:assert/strict';
import {judgeRun} from '../scripts/selfhosted-expect.mjs';
const good={status:'completed',cleanup:{status:'verified'},total:9,pass:6,fail:3};
test('a completed run with the planted failures and verified restore passes',()=>{
  assert.equal(judgeRun(good,{confirmed:true}).ok,true);
});
test('the run that errored part-way in CI is rejected',()=>{
  const bad={status:'error',cleanup:{status:'failed',error:'External or partial state change detected.'},total:2,pass:1,fail:0};
  const v=judgeRun(bad,undefined);
  assert.equal(v.ok,false);
  assert.ok(v.problems.length>=4);
});
test('wrong counts, unverified restore or unconfirmed reproduction are each rejected',()=>{
  assert.equal(judgeRun({...good,pass:9,fail:0},{confirmed:true}).ok,false);
  assert.equal(judgeRun({...good,cleanup:{status:'failed'}},{confirmed:true}).ok,false);
  assert.equal(judgeRun(good,{confirmed:false}).ok,false);
});
