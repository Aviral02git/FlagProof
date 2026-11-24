// Offline decision-read of a recorded Flagsmith experiment run.
// Input: a run record JSON (example: test/fixtures/run-report-399.json).
// Output: a structured read that separates what the record establishes from
// what it does not. Validity checks report 'unknown' wherever the recorded
// evidence is insufficient: a documented checklist is not machine-verified
// proof.

function parseNumber(value){
 if(typeof value==='number'&&Number.isFinite(value))return value;
 if(typeof value==='string'){
  const m=value.replace('<','').trim();
  const n=Number(m);
  if(Number.isFinite(n))return n;
 }
 return null;
}

export function parseInterval(value){
 if(typeof value!=='string')return null;
 const m=value.match(/^\[\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*\]$/);
 if(!m)return null;
 return {low:Number(m[1]),high:Number(m[2])};
}

function isBaseline(entry){
 return entry.key==='control'||entry.deltaPct==='Baseline';
}

export function readIntervals(analysis){
 if(!analysis||!Array.isArray(analysis.variations))return null;
 const control=analysis.variations.find(isBaseline);
 const challengers=analysis.variations.filter(v=>!isBaseline(v));
 return {
  controlKey:control?control.key:null,
  variations:challengers.map(v=>{
   const interval=parseInterval(v.credibleInterval95Pct);
   return {
    key:v.key,
    deltaPct:parseNumber(v.deltaPct),
    interval,
    clearsZero:interval?interval.low>0:null,
    winProbabilityPct:parseNumber(v.winProbabilityPct)
   };
  })
 };
}

export function readThreshold(analysis,{thresholdAbsPoints=null}={}){
 if(!analysis||!Array.isArray(analysis.variations))return null;
 const control=analysis.variations.find(isBaseline);
 const baselineRatePct=control?parseNumber(control.occurrenceRatePct):null;
 if(thresholdAbsPoints==null||baselineRatePct==null)return null;
 return {
  thresholdAbsPoints,
  baselineRatePct,
  perVariation:analysis.variations.filter(v=>!isBaseline(v)).map(v=>{
   // Only actual absolute-effect posterior evidence can establish an absolute
   // threshold. Multiplying a relative credible bound by the observed baseline
   // is illustrative arithmetic (the baseline carries its own uncertainty), so
   // relative intervals alone always read as unknown here.
   const absInterval=parseInterval(v.credibleInterval95AbsPoints);
   if(absInterval){
    return {key:v.key,status:absInterval.low>=thresholdAbsPoints?'established':'not-established',absoluteInterval:absInterval,evidence:'absolute-effect posterior interval recorded'};
   }
   const relInterval=parseInterval(v.credibleInterval95Pct);
   const implied=relInterval?Math.round(baselineRatePct*relInterval.low/100*100)/100:null;
   return {key:v.key,status:'unknown',illustrativeImpliedLowerBoundPoints:implied,evidence:'only a relative-delta interval recorded; baseline x relative bound is illustrative, not a calibrated absolute-lift bound'};
  })
 };
}

export function comparePresetVsRealized(record){
 const presets=record?.trafficRun?.presetConversionRates;
 const realized=record?.analysis?.variations;
 const wholePool=record?.reproducibility?.wholePoolRealizedRates;
 if(!presets||!Array.isArray(realized))return null;
 return realized.map(v=>{
  const preset=presets[v.key];
  const realizedRatePct=parseNumber(v.occurrenceRatePct);
  return {
   key:v.key,
   presetRate:preset??null,
   wholePoolDrawRate:wholePool?wholePool[v.key]??null:null,
   realizedRatePct,
   note:'The deterministic draw is reproducible from the committed code; the per-variation realized rate is conditional on this run\u2019s recorded bucketing assignments, which are external to the repo.'
  };
 });
}

export function checkValidity(record){
 const checks=[];
 const run=record?.trafficRun??null;
 const experiment=record?.experiment??null;

 // 1. Stable identifier: only a recorded per-identity assignment map proves it.
 const assignments=run?.assignments;
 if(assignments&&typeof assignments==='object'){
  const conflicts=Object.entries(assignments).filter(([,v])=>Array.isArray(v)&&new Set(v).size>1);
  const single=Object.values(assignments).every(v=>!Array.isArray(v)||new Set(v).size===1);
  if(conflicts.length>0||!single){
   checks.push({id:'stable-identifier',label:'Stable identifier (one variation per identity)',status:'fail',evidence:`${conflicts.length} identities recorded with more than one variation`});
  }else{
   checks.push({id:'stable-identifier',label:'Stable identifier (one variation per identity)',status:'pass',evidence:`${Object.keys(assignments).length} identities each recorded against exactly one variation`});
  }
 }else{
  checks.push({id:'stable-identifier',label:'Stable identifier (one variation per identity)',status:'unknown',evidence:'no per-identity assignment log in the record; the documented identity scheme is not machine-verified proof'});
 }

 // 2. Balanced exposures against configured weights.
 const counts=run?.sentCounts;
 const weights=experiment?.variations;
 if(counts&&Array.isArray(weights)&&weights.length>0){
  const total=weights.reduce((s,w)=>s+(counts[w.key]?.exposures??0),0);
  if(total>0){
   const deviations=weights.map(w=>({key:w.key,deviation:Math.abs(((counts[w.key]?.exposures??0)/total)*100-w.weightPct)}));
   const worst=deviations.reduce((a,b)=>a.deviation>=b.deviation?a:b);
   const status=deviations.every(d=>d.deviation<=5)?'pass':'fail';
   checks.push({id:'balanced-exposures',label:'Balanced exposures against configured weights',status,evidence:`largest deviation ${worst.deviation.toFixed(1)} points (${worst.key}) against tolerance 5`});
  }else{
   checks.push({id:'balanced-exposures',label:'Balanced exposures against configured weights',status:'unknown',evidence:'zero exposures recorded'});
  }
 }else{
  checks.push({id:'balanced-exposures',label:'Balanced exposures against configured weights',status:'unknown',evidence:'sent counts or configured weights missing from the record'});
 }

 // 3. Conversions firing and event-count consistency.
 if(counts){
  const exposures=Object.values(counts).reduce((s,c)=>s+(c.exposures??0),0);
  const conversions=Object.values(counts).reduce((s,c)=>s+(c.conversions??0),0);
  if(run?.totalEventsSent!=null&&run.totalEventsSent!==exposures+conversions){
   checks.push({id:'conversions-firing',label:'Conversion event-count consistency',status:'fail',evidence:`recorded total ${run.totalEventsSent} does not equal exposures + conversions (${exposures + conversions})`});
  }else if(conversions<=0){
   checks.push({id:'conversions-firing',label:'Conversion event-count consistency',status:'unknown',evidence:'zero conversions recorded, which can be a valid outcome; firing cannot be confirmed from counts alone'});
  }else{
   checks.push({id:'conversions-firing',label:'Conversion event-count consistency',status:'pass',evidence:`${conversions} conversions recorded and counts internally consistent${run?.totalEventsSent!=null?' with the recorded total':''}; count consistency only, firing at the correct action is not verifiable from the record`});
  }
 }else{
  checks.push({id:'conversions-firing',label:'Conversion event-count consistency',status:'unknown',evidence:'sent counts missing from the record'});
 }

 // 4. Multivariate from the start: needs a recorded flag-creation time at or before the run.
 const createdFlag=experiment?.flagCreatedMultivariate;
 const createdAt=experiment?.flagCreatedAt?Date.parse(experiment.flagCreatedAt):null;
 const executedAt=run?.executedAt?Date.parse(run.executedAt):null;
 if(createdFlag===false){
  checks.push({id:'multivariate-from-start',label:'Multivariate flag from the start',status:'fail',evidence:'record states the flag was not created multivariate'});
 }else if(createdFlag===true&&createdAt!=null&&executedAt!=null){
  checks.push({id:'multivariate-from-start',label:'Multivariate flag from the start',status:createdAt<=executedAt?'pass':'fail',evidence:createdAt<=executedAt?'flag recorded multivariate before traffic':'flag creation time recorded after the traffic run'});
 }else{
  checks.push({id:'multivariate-from-start',label:'Multivariate flag from the start',status:'unknown',evidence:'no flag creation record in the run record; creation order is documented but not machine-verified'});
 }
 return checks;
}

export function readExperimentResult(record,{thresholdAbsPoints=null}={}){
 const intervals=readIntervals(record?.analysis);
 const threshold=readThreshold(record?.analysis,{thresholdAbsPoints});
 const validityChecks=checkValidity(record);
 const presetVsRealized=comparePresetVsRealized(record);
 const positiveLift=intervals==null?null:(intervals.variations.length>0&&intervals.variations.every(v=>v.clearsZero===true)?true:(intervals.variations.some(v=>v.clearsZero===null)?null:false));
 const caveats=[
  'Win probability is pairwise against control, not a ranking across challengers.',
  'No direct challenger-vs-challenger comparison is established by this record.'
 ];
 if(record?.trafficRun?.syntheticData){
  caveats.push('All visitor data is synthetic demo traffic with preset conversion probabilities: no rollout or efficacy conclusion follows.');
 }
 return {
  experiment:{name:record?.experiment?.name??null,flag:record?.experiment?.flag??null,hypothesis:record?.experiment?.hypothesis??null},
  synthetic:record?.trafficRun?.syntheticData===true,
  intervals,
  threshold,
  presetVsRealized,
  validityChecks,
  summary:{positiveLiftOverControl:positiveLift,caveats}
 };
}
