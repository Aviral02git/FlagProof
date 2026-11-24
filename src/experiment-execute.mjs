import {ExperimentProposalSchema} from './experiment-plan.mjs';
import {EXPERIMENT_EVENT} from './experiment-config.mjs';

// Track 02 live execution adapter: turns a human-approved experiment proposal
// into a real Flagsmith experiment through the documented management REST
// endpoints (https://docs.flagsmith.com/experimentation/set-up-with-a-coding-agent):
//   POST /api/v1/environments/{env}/experiment-metrics/
//   POST /api/v1/environments/{env}/experiments/
//   POST /api/v1/environments/{env}/experiments/{id}/start/   (only when start:true)
// It is never the default path: propose-experiment.mjs executes the local
// fixture unless the operator explicitly opts into live mode with the proposal
// hash approved. The multivariate flag with keyed variations must already
// exist (dashboard or CLI); this adapter reports what is missing instead of
// silently creating partial state.

const API_BASE_DEFAULT='https://api.flagsmith.com/api/v1/';

// A response with an HTTP error status is a DEFINITIVE failure. A network
// error or timeout is AMBIGUOUS: the request may have landed. Ambiguous write
// failures must trigger a recovery read, never a blind retry, and must never
// be reported as "nothing was changed".
export class AmbiguousOutcomeError extends Error{
 constructor(message,{cause}={}){super(message,{cause});this.ambiguous=true;}
}

async function apiCall(fetchImpl,base,method,path,key,body){
 let response;
 try{
  response=await fetchImpl(`${base}${path}`,{
   method,
   headers:{Authorization:`Api-Key ${key}`,'Content-Type':'application/json'},
   body:body===undefined?undefined:JSON.stringify(body),
   signal:AbortSignal.timeout(15000),
  });
 }catch(error){
  throw new AmbiguousOutcomeError(`Flagsmith API ${method} ${path}: no response received (network error or timeout); the request may or may not have landed`,{cause:error});
 }
 const text=await response.text();
 if(!response.ok){
  // 4xx: definitive rejection, the request was not accepted. 5xx: AMBIGUOUS,
  // the server may have processed the write before failing to respond, so
  // callers must recover by read before concluding or retrying anything.
  const detail=`HTTP ${response.status} ${text.slice(0,200)}`;
  if(response.status>=500)throw new AmbiguousOutcomeError(`Flagsmith API ${method} ${path}: ${detail}; a 5xx may mean the server processed the write before failing to respond`);
  throw new Error(`Flagsmith API ${method} ${path} failed: ${detail}`);
 }
 return text?JSON.parse(text):{};
}

export async function executeExperimentProposalApi(record,{env=process.env,fetchImpl=fetch,start=false}={}){
 const proposal=ExperimentProposalSchema.parse(record.proposal);
 const key=env.FLAGSMITH_MANAGEMENT_KEY;
 const environment=env.FLAGSMITH_ENVIRONMENT_KEY;
 if(!key)throw new Error('Live execution needs FLAGSMITH_MANAGEMENT_KEY in .env. Without it, use the fixture path.');
 if(!environment)throw new Error('Live execution needs FLAGSMITH_ENVIRONMENT_KEY in .env. Run npm run setup:flagsmith first.');
 const base=(env.FLAGSMITH_API_URL||API_BASE_DEFAULT).replace(/\/?$/,'/');
 const call=(method,path,body)=>apiCall(fetchImpl,base,method,path,key,body);

 const totalWeight=proposal.variations.reduce((n,v)=>n+v.weightPct,0);
 if(totalWeight>100)throw new Error(`Variation weights add to ${totalWeight}%; must be at most 100. Nothing was changed.`);

 // Resolve project from the environment.
 const envDetail=await call('GET',`environments/${environment}/`);
 const projectId=envDetail.project;
 if(!projectId)throw new Error('Could not resolve the project for this environment.');

 // The multivariate flag must already exist with one keyed variation per
 // proposal variation (control is the flag value, not a variation option).
 const featureList=await call('GET',`projects/${projectId}/features/?search=${encodeURIComponent(proposal.flag)}`);
 const feature=(featureList.results||[]).find(f=>f.name===proposal.flag);
 if(!feature)throw new Error(`Multivariate flag "${proposal.flag}" not found in project ${projectId}. Create it in the dashboard (or flagsmith CLI) with keyed variations first; nothing was changed.`);
 const nonControl=proposal.variations.filter(v=>v.key!=='control');
 const options=feature.multivariate_options||[];
 const optionByValue=new Map(options.map(o=>[o.string_value??o.value,o]));
 const missing=nonControl.filter(v=>!optionByValue.has(v.key)).map(v=>v.key);
 if(missing.length)throw new Error(`Flag "${proposal.flag}" is missing keyed variation(s): ${missing.join(', ')}. Add them in the dashboard first; nothing was changed.`);

 // Reuse an existing metric for the same event and aggregation when one
 // exists, so reruns do not pile up redundant metrics.
 const metricList=await call('GET',`environments/${environment}/experiment-metrics/`);
 const existingMetrics=Array.isArray(metricList)?metricList:metricList.results||[];
 let metric=existingMetrics.find(m=>m.aggregation===proposal.metricAggregation&&m.definition?.event===proposal.metricEvent);
 let metricReused=Boolean(metric);
 if(!metric){
  try{
   metric=await call('POST',`environments/${environment}/experiment-metrics/`,{
    name:proposal.name,
    aggregation:proposal.metricAggregation,
    direction:'up',
    definition:{version:1,event:proposal.metricEvent},
   });
  }catch(error){
   if(!error.ambiguous)throw error;
   // Recovery read: did the metric land despite the missing response?
   const reread=await call('GET',`environments/${environment}/experiment-metrics/`);
   const list=Array.isArray(reread)?reread:reread.results||[];
   const found=list.find(m=>m.aggregation===proposal.metricAggregation&&m.definition?.event===proposal.metricEvent);
   throw new Error(found
    ?`Metric creation outcome unknown (${error.message}); recovery read FOUND the metric with id ${found.id}. Treat it as created; verify in the dashboard before any rerun, no blind retry was attempted.`
    :`Metric creation outcome unknown (${error.message}); recovery read found NO matching metric. The write likely did not land, but this is not verified; check the dashboard before any rerun, no blind retry was attempted.`);
  }
 }

 // Create the experiment. Control gets the rollout remainder, per the docs.
 const mvValues=nonControl.map(v=>({
  multivariate_feature_option:optionByValue.get(v.key).id,
  percentage_allocation:v.weightPct,
 }));
 let experiment;
 try{
  experiment=await call('POST',`environments/${environment}/experiments/`,{
  feature:feature.id,
  name:proposal.name,
  hypothesis:proposal.hypothesis,
  metrics:[{metric:metric.id,expected_direction:'increase'}],
   experiment_rollout:{
    enabled:true,
    rollout_percentage:proposal.rolloutPct,
    feature_state_value:{type:'string',value:'control'},
    multivariate_feature_state_values:mvValues,
   },
  });
 }catch(error){
  // Partial-write honesty: by this point the flag lookup is read-only, but a
  // metric may have been created. Say exactly what exists.
  const metricState=metricReused?`reused existing metric ${metric.id}`:`metric ${metric.id} WAS CREATED before the failure`;
  if(!error.ambiguous)throw new Error(`Experiment creation failed after ${metricState}: ${error.message}`);
  // Ambiguous write: recovery read instead of a blind retry.
  const reread=await call('GET',`environments/${environment}/experiments/`);
  const list=Array.isArray(reread)?reread:reread.results||[];
  const found=list.find(e=>e.name===proposal.name);
  throw new Error((found
   ?`Experiment creation outcome unknown (${error.message}); recovery read FOUND experiment "${proposal.name}" with id ${found.id}`
   :`Experiment creation outcome unknown (${error.message}); recovery read found NO experiment named "${proposal.name}"`)
   +` after ${metricState}. Verify in the dashboard before any rerun; no blind retry was attempted.`);
 }

 let started=false;
 if(start){
  await call('POST',`environments/${environment}/experiments/${experiment.id}/start/`);
  started=true;
 }

 return {
  executedAt:new Date().toISOString(),
  approvedHash:record.hash,
  proposal,
  mode:'flagsmith-api',
  metricReused,
  projectId,
  featureId:feature.id,
  metricId:metric.id,
  experimentId:experiment.id,
  started,
  note:'Live Flagsmith execution of the approved proposal. Results still reflect whatever traffic the environment actually receives; synthetic traffic stays labelled synthetic.',
 };
}

// Bounded verification helpers: a disposable probe flag with keyed variations,
// and grounded cleanup (DELETE experiment 204, DELETE feature removes options).
// Only used by the separately approved verification flow, never by default.

export const PROBE_FLAG='flagproof_adapter_probe';
export const PROBE_VARIATIONS=Object.freeze([
 {key:'probe_a',string_value:'probe_a'},
 {key:'probe_b',string_value:'probe_b'},
]);

export async function createAdapterProbeFeature({env=process.env,fetchImpl=fetch}={}){
 const key=env.FLAGSMITH_MANAGEMENT_KEY;
 const environment=env.FLAGSMITH_ENVIRONMENT_KEY;
 if(!key||!environment)throw new Error('Probe creation needs FLAGSMITH_MANAGEMENT_KEY and FLAGSMITH_ENVIRONMENT_KEY.');
 const base=(env.FLAGSMITH_API_URL||API_BASE_DEFAULT).replace(/\/?$/,'/');
 const call=(method,path,body)=>apiCall(fetchImpl,base,method,path,key,body);
 const envDetail=await call('GET',`environments/${environment}/`);
 const projectId=envDetail.project;
 if(!projectId)throw new Error('Could not resolve the project for this environment.');
 const existing=await call('GET',`projects/${projectId}/features/?search=${PROBE_FLAG}`);
 const found=(existing.results||[]).find(f=>f.name===PROBE_FLAG);
 if(found)throw new Error(`Probe flag "${PROBE_FLAG}" already exists (id ${found.id}). Refusing to reuse or overwrite; inspect and clean up first. Nothing was changed.`);
 let feature;
 try{
  feature=await call('POST',`projects/${projectId}/features/`,{
   name:PROBE_FLAG,
   description:'Disposable probe for FlagProof adapter verification (synthetic). Safe to delete.',
   default_enabled:true,
   initial_value:'control',
   is_archived:false,
  });
 }catch(error){
  if(!error.ambiguous)throw error;
  const reread=await call('GET',`projects/${projectId}/features/?search=${PROBE_FLAG}`);
  const landed=(reread.results||[]).find(f=>f.name===PROBE_FLAG);
  throw new Error(landed
   ?`Probe flag creation outcome unknown (${error.message}); recovery read FOUND it with id ${landed.id}. Verify before any rerun; no blind retry was attempted.`
   :`Probe flag creation outcome unknown (${error.message}); recovery read found nothing. Not verified as unchanged; no blind retry was attempted.`);
 }
 const options=[];
 for(const v of PROBE_VARIATIONS){
  const option=await call('POST',`projects/${projectId}/features/${feature.id}/mv-options/`,{
   type:'unicode',
   string_value:v.string_value,
   key:v.key,
   default_percentage_allocation:0,
   feature:feature.id,
  });
  options.push(option);
 }
 return {projectId,featureId:feature.id,options:options.map(o=>({id:o.id,key:o.key}))};
}

export async function cleanupAdapterProbe({env=process.env,fetchImpl=fetch,experimentId,featureId}={}){
 const key=env.FLAGSMITH_MANAGEMENT_KEY;
 const environment=env.FLAGSMITH_ENVIRONMENT_KEY;
 if(!key||!environment)throw new Error('Cleanup needs FLAGSMITH_MANAGEMENT_KEY and FLAGSMITH_ENVIRONMENT_KEY.');
 const base=(env.FLAGSMITH_API_URL||API_BASE_DEFAULT).replace(/\/?$/,'/');
 const call=(method,path,body)=>apiCall(fetchImpl,base,method,path,key,body);
 const removed=[];
 const failures=[];
 if(experimentId){
  try{await call('DELETE',`environments/${environment}/experiments/${experimentId}/`);removed.push(`experiment ${experimentId}`);}
  catch(error){failures.push(`experiment ${experimentId}: ${error.message}`);}
 }
 if(featureId){
  const envDetail=await call('GET',`environments/${environment}/`);
  try{await call('DELETE',`projects/${envDetail.project}/features/${featureId}/`);removed.push(`feature ${featureId}`);}
  catch(error){failures.push(`feature ${featureId}: ${error.message}`);}
 }
 return {removed,failures};
}

// Bounded live verification of the whole adapter flow, as approved per-run:
// create a disposable probe flag -> reuse (or create uniquely named) metric ->
// create a STOPPED experiment with a unique synthetic name -> read back ->
// clean up everything created (grounded DELETEs). Cleanup always runs, even on
// mid failure, and leftover resource ids are reported explicitly.

export const VERIFICATION_EXPERIMENT_NAME='FlagProof adapter verification (synthetic)';

// Pure read-back check, exercised offline against captured API shapes. Compares
// the required fields, not just HTTP 200 and an id.
export function verifyExperimentReadback(reread,{experimentId,featureId,name,metricId}){
 if(!reread||reread.id!==experimentId)return {verified:false,reason:'experiment id mismatch or response missing'};
 const fid=reread.feature&&typeof reread.feature==='object'?reread.feature.id:reread.feature;
 if(String(fid)!==String(featureId))return {verified:false,reason:`feature mismatch: expected ${featureId}, got ${fid}`};
 if(name&&reread.name!==name)return {verified:false,reason:`name mismatch: expected "${name}", got "${reread.name}"`};
 const status=String(reread.status||'').toLowerCase();
 if(status==='running')return {verified:false,reason:`unexpected status: ${status||'missing'}`};
 if(metricId!==undefined){
  const ids=(reread.metrics||[]).map(m=>String(m.metric??m.metric_id??m.id));
  if(!ids.includes(String(metricId)))return {verified:false,reason:`metric ${metricId} not linked (found: ${ids.join(',')||'none'})`};
 }
 return {verified:true,reason:'id, feature, name, status and metric link all match'};
}
export const VERIFICATION_METRIC_NAME='FlagProof adapter verification metric (synthetic)';

export async function runAdapterVerification({env=process.env,fetchImpl=fetch}={}){
 const key=env.FLAGSMITH_MANAGEMENT_KEY;
 const environment=env.FLAGSMITH_ENVIRONMENT_KEY;
 if(!key||!environment)throw new Error('Verification needs FLAGSMITH_MANAGEMENT_KEY and FLAGSMITH_ENVIRONMENT_KEY in .env.');
 const base=(env.FLAGSMITH_API_URL||API_BASE_DEFAULT).replace(/\/?$/,'/');
 const call=(method,path,body)=>apiCall(fetchImpl,base,method,path,key,body);
 const report={probe:null,metric:null,experiment:null,verified:false,cleanup:null,leftovers:[]};
 let experimentId=null;let featureId=null;let metricCreatedId=null;

 try{
  report.probe=await createAdapterProbeFeature({env,fetchImpl});
  featureId=report.probe.featureId;

  const metricList=await call('GET',`environments/${environment}/experiment-metrics/`);
  const existing=(Array.isArray(metricList)?metricList:metricList.results||[]);
  let metric=existing.find(m=>m.aggregation==='occurrence'&&m.definition?.event===EXPERIMENT_EVENT);
  if(metric){report.metric={id:metric.id,reused:true};}
  else{
   metric=await call('POST',`environments/${environment}/experiment-metrics/`,{name:VERIFICATION_METRIC_NAME,aggregation:'occurrence',direction:'up',definition:{version:1,event:EXPERIMENT_EVENT}});
   metricCreatedId=metric.id;report.metric={id:metric.id,reused:false};
  }

  const exp=await call('POST',`environments/${environment}/experiments/`,{
   feature:featureId,
   name:VERIFICATION_EXPERIMENT_NAME,
   hypothesis:'Adapter verification only: a synthetic probe experiment, created stopped and deleted immediately after read-back. Not a real test.',
   metrics:[{metric:metric.id,expected_direction:'increase'}],
   experiment_rollout:{
    enabled:true,
    rollout_percentage:100,
    feature_state_value:{type:'string',value:'control'},
    multivariate_feature_state_values:report.probe.options.map(o=>({multivariate_feature_option:o.id,percentage_allocation:50})),
   },
  });
  experimentId=exp.id;
  report.experiment={id:exp.id,started:false};

  // Read-back verification: the experiment exists, is stopped, points at the
  // probe flag and the expected metric.
  const reread=await call('GET',`environments/${environment}/experiments/${experimentId}/`);
  const check=verifyExperimentReadback(reread,{experimentId,featureId,name:VERIFICATION_EXPERIMENT_NAME,metricId:report.metric.id});
  report.readback={status:reread.status,featureId:check.verified?featureId:(reread.feature?.id??reread.feature),reason:check.reason};
  report.verified=check.verified;
 }finally{
  const cleanupResult=await cleanupAdapterProbe({env,fetchImpl,experimentId,featureId});
  if(metricCreatedId){
   try{await call('DELETE',`environments/${environment}/experiment-metrics/${metricCreatedId}/`);cleanupResult.removed.push(`metric ${metricCreatedId}`);}
   catch(error){cleanupResult.failures.push(`metric ${metricCreatedId}: ${error.message}`);}
  }
  report.cleanup=cleanupResult;
  if(cleanupResult.failures.length){
   if(experimentId&&cleanupResult.failures.some(f=>f.startsWith('experiment')))report.leftovers.push(`experiment ${experimentId}`);
   if(featureId&&cleanupResult.failures.some(f=>f.startsWith('feature')))report.leftovers.push(`feature ${featureId}`);
   if(metricCreatedId&&cleanupResult.failures.some(f=>f.startsWith('metric')))report.leftovers.push(`metric ${metricCreatedId}`);
  }
 }
 return report;
}
