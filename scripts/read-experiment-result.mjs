#!/usr/bin/env node
// Offline decision-read of a recorded experiment run.
// Usage: node scripts/read-experiment-result.mjs <run-record.json>
// No network calls; the run record is produced by scripts/record-results.mjs.
import {readFileSync} from 'node:fs';
import {readExperimentResult} from '../src/experiment-read.mjs';

const path=process.argv[2];
if(!path){
 console.error('Usage: node scripts/read-experiment-result.mjs <run-record.json>');
 console.error('Reads a recorded experiment run offline and reports what the record establishes. No network calls.');
 process.exit(2);
}
const record=JSON.parse(readFileSync(path,'utf8'));

function thresholdFromHypothesis(h){
 const m=typeof h==='string'?h.match(/at least (\d+(?:\.\d+)?) percentage points/):null;
 return m?Number(m[1]):null;
}

const read=readExperimentResult(record,{thresholdAbsPoints:thresholdFromHypothesis(record?.experiment?.hypothesis)});

console.log(`Experiment: ${read.experiment.name??'(unnamed)'} (flag ${read.experiment.flag??'?'})`);
if(read.synthetic)console.log('Synthetic demo traffic: fixtures, not evidence about real users.');
console.log('');
if(read.intervals){
 console.log(`Interval read (pairwise vs control "${read.intervals.controlKey??'?'}"):`);
 for(const v of read.intervals.variations){
  const iv=v.interval?`[${v.interval.low}, ${v.interval.high}]`:'not recorded';
  const verdict=v.clearsZero===null?'unknown':v.clearsZero?'clears zero':'does not clear zero';
  console.log(`  ${v.key}: delta ${v.deltaPct??'?'}%, 95% CI ${iv} -> ${verdict}`);
 }
}else{
 console.log('Interval read: no analysis recorded.');
}
console.log('');
if(read.threshold){
 console.log(`Hypothesis threshold (${read.threshold.thresholdAbsPoints} absolute points on a ${read.threshold.baselineRatePct}% observed baseline):`);
 for(const v of read.threshold.perVariation){
  if(v.absoluteInterval){
   console.log(`  ${v.key}: absolute-effect 95% interval [${v.absoluteInterval.low}, ${v.absoluteInterval.high}] points -> ${v.status}`);
  }else{
   const imp=v.illustrativeImpliedLowerBoundPoints==null?'n/a':`${v.illustrativeImpliedLowerBoundPoints} points`;
   console.log(`  ${v.key}: status unknown - only a relative-delta interval recorded; illustrative implied lower bound ${imp} (not a calibrated absolute bound)`);
  }
 }
}else{
 console.log('Hypothesis threshold: not evaluated (no threshold in hypothesis or no baseline rate recorded).');
}
console.log('');
if(read.presetVsRealized){
 console.log('Preset vs realized (synthetic fixtures):');
 for(const v of read.presetVsRealized){
  console.log(`  ${v.key}: preset ${v.presetRate??'?'}, whole-pool draw ${v.wholePoolDrawRate??'?'}, realized ${v.realizedRatePct??'?'}%`);
 }
 console.log('  Note: per-variation realized rates are conditional on this run\u2019s recorded bucketing assignments.');
 console.log('');
}
console.log('Validity checks (evidence-bounded):');
for(const c of read.validityChecks){
 console.log(`  [${c.status}] ${c.label} - ${c.evidence}`);
}
console.log('');
const lift=read.summary.positiveLiftOverControl;
console.log(`Positive lift over control: ${lift===null?'unknown':lift?'yes, under the model on this data':'no'}`);
for(const c of read.summary.caveats)console.log(`  - ${c}`);
