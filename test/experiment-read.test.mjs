import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseInterval,readIntervals,readThreshold,checkValidity,readExperimentResult} from '../src/experiment-read.mjs';

const record=JSON.parse(readFileSync(new URL('./fixtures/run-report-399.json',import.meta.url),'utf8'));

test('experiment-399 record: both intervals clear zero, threshold not established, validity evidence-bounded',()=>{
 const read=readExperimentResult(record,{thresholdAbsPoints:10});
 assert.equal(read.summary.positiveLiftOverControl,true);
 assert.equal(read.intervals.variations.length,2);
 for(const v of read.intervals.variations)assert.equal(v.clearsZero,true);
 for(const v of read.threshold.perVariation)assert.equal(v.status,'unknown');
 const byId=Object.fromEntries(read.validityChecks.map(c=>[c.id,c.status]));
 assert.equal(byId['balanced-exposures'],'pass');
 assert.equal(byId['conversions-firing'],'pass');
 // No assignment log or flag-creation record exists, so these must not be claimed.
 assert.equal(byId['stable-identifier'],'unknown');
 assert.equal(byId['multivariate-from-start'],'unknown');
 assert.ok(read.summary.caveats.some(c=>c.includes('pairwise against control')));
});

test('parseInterval rejects missing or malformed intervals',()=>{
 assert.equal(parseInterval('[5.5, 89.3]').low,5.5);
 assert.equal(parseInterval('Baseline'),null);
 assert.equal(parseInterval(undefined),null);
 assert.equal(parseInterval('[1,2,3]'),null);
});

test('missing interval makes the read unknown, never a silent pass',()=>{
 const analysis={variations:[
  {key:'control',occurrenceRatePct:30,deltaPct:'Baseline',credibleInterval95Pct:'Baseline',winProbabilityPct:'<1'},
  {key:'a',occurrenceRatePct:40,deltaPct:'+33.3',credibleInterval95Pct:'pending',winProbabilityPct:90}
 ]};
 const intervals=readIntervals(analysis);
 assert.equal(intervals.variations[0].clearsZero,null);
 const threshold=readThreshold(analysis,{thresholdAbsPoints:10});
 assert.equal(threshold.perVariation[0].status,'unknown');
 const read=readExperimentResult({analysis},{thresholdAbsPoints:10});
 assert.equal(read.summary.positiveLiftOverControl,null);
});

test('interval not clearing zero reads as not callable, threshold support unknown',()=>{
 const analysis={variations:[
  {key:'control',occurrenceRatePct:30,deltaPct:'Baseline'},
  {key:'a',occurrenceRatePct:33,deltaPct:'+10',credibleInterval95Pct:'[-4.0, 26.0]',winProbabilityPct:80}
 ]};
 assert.equal(readIntervals(analysis).variations[0].clearsZero,false);
 assert.equal(readThreshold(analysis,{thresholdAbsPoints:10}).perVariation[0].status,'unknown');
});

test('relative intervals never establish an absolute threshold, however high',()=>{
 const analysis={variations:[
  {key:'control',occurrenceRatePct:30,deltaPct:'Baseline'},
  {key:'a',occurrenceRatePct:45,deltaPct:'+50',credibleInterval95Pct:'[40.0, 60.0]',winProbabilityPct:100}
 ]};
 const t=readThreshold(analysis,{thresholdAbsPoints:10});
 assert.equal(t.perVariation[0].status,'unknown');
 assert.equal(t.perVariation[0].illustrativeImpliedLowerBoundPoints,12);
});

test('absolute-effect posterior evidence drives threshold established/not-established',()=>{
 const analysis={variations:[
  {key:'control',occurrenceRatePct:30,deltaPct:'Baseline'},
  {key:'a',occurrenceRatePct:45,deltaPct:'+50',credibleInterval95Pct:'[40.0, 60.0]',credibleInterval95AbsPoints:'[12.0, 18.0]'},
  {key:'b',occurrenceRatePct:40,deltaPct:'+33',credibleInterval95Pct:'[30.0, 37.0]',credibleInterval95AbsPoints:'[2.0, 15.0]'}
 ]};
 const t=readThreshold(analysis,{thresholdAbsPoints:10});
 assert.equal(t.perVariation[0].status,'established');
 assert.equal(t.perVariation[1].status,'not-established');
});

test('conversion check fails on inconsistent totals and on zero conversions',()=>{
 const base=record.trafficRun;
 const badTotal={...record,trafficRun:{...base,totalEventsSent:999}};
 assert.equal(checkValidity(badTotal).find(c=>c.id==='conversions-firing').status,'fail');
 const noConv={...record,trafficRun:{...base,sentCounts:{control:{exposures:150,conversions:0},buy_now:{exposures:150,conversions:0},get_it_today:{exposures:150,conversions:0}},totalEventsSent:450}};
 // Zero conversions can be a valid outcome: unknown, not fail.
 assert.equal(checkValidity(noConv).find(c=>c.id==='conversions-firing').status,'unknown');
});

test('stable identifier passes only with a clean recorded assignment map, fails on conflicts',()=>{
 const clean={...record,trafficRun:{...record.trafficRun,assignments:{a:'control',b:'buy_now',c:'get_it_today'}}};
 assert.equal(checkValidity(clean).find(c=>c.id==='stable-identifier').status,'pass');
 const conflict={...record,trafficRun:{...record.trafficRun,assignments:{a:['control','buy_now'],b:'control'}}};
 assert.equal(checkValidity(conflict).find(c=>c.id==='stable-identifier').status,'fail');
});

test('multivariate-from-start needs a recorded creation time at or before the run',()=>{
 const ok={...record,experiment:{...record.experiment,flagCreatedMultivariate:true,flagCreatedAt:'2026-11-23T20:00:00+05:30'}};
 assert.equal(checkValidity(ok).find(c=>c.id==='multivariate-from-start').status,'pass');
 const late={...record,experiment:{...record.experiment,flagCreatedMultivariate:true,flagCreatedAt:'2026-11-24T20:00:00+05:30'}};
 assert.equal(checkValidity(late).find(c=>c.id==='multivariate-from-start').status,'fail');
 const converted={...record,experiment:{...record.experiment,flagCreatedMultivariate:false}};
 assert.equal(checkValidity(converted).find(c=>c.id==='multivariate-from-start').status,'fail');
});

test('exposure imbalance against the configured weights fails',()=>{
 const skewed={...record,trafficRun:{...record.trafficRun,sentCounts:{control:{exposures:300,conversions:96},buy_now:{exposures:100,conversions:46},get_it_today:{exposures:50,conversions:21}},totalEventsSent:613}};
 assert.equal(checkValidity(skewed).find(c=>c.id==='balanced-exposures').status,'fail');
});
