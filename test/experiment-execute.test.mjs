import test from 'node:test';
import assert from 'node:assert/strict';
import {executeExperimentProposalApi,createAdapterProbeFeature,cleanupAdapterProbe} from '../src/experiment-execute.mjs';
import {makeExperimentProposal,reviewExperimentProposal} from '../src/experiment-plan.mjs';

function approvedRecord(){
 return reviewExperimentProposal(makeExperimentProposal());
}
const ENV={FLAGSMITH_MANAGEMENT_KEY:'test-management-key',FLAGSMITH_ENVIRONMENT_KEY:'test-env-key'};

// Scripted management-API stub: records calls and answers per method+path.
function stubFetch(overrides={}){
 const calls=[];
 const routes={
  'GET environments/test-env-key/':{project:42},
  'GET projects/42/features/?search=checkout_cta_copy':{results:[{id:7,name:'checkout_cta_copy',multivariate_options:[{id:71,string_value:'buy_now'},{id:72,string_value:'get_it_today'}]}]},
  'GET environments/test-env-key/experiment-metrics/':{results:[]},
  'POST environments/test-env-key/experiment-metrics/':{id:501},
  'GET environments/test-env-key/experiments/':{results:[]},
  'POST environments/test-env-key/experiments/':{id:601},
  'POST environments/test-env-key/experiments/601/start/':{},
  ...overrides,
 };
 const fetchImpl=async(url,init)=>{
  const path=url.replace('https://api.flagsmith.com/api/v1/','');
  const key=`${init.method} ${path}`;
  calls.push({key,body:init.body?JSON.parse(init.body):undefined,auth:init.headers.Authorization});
  const route=routes[key];
  if(!route)return new Response(JSON.stringify({detail:'not found'}),{status:404});
  if(route.__sequence){const item=route.__sequence.length>1?route.__sequence.shift():route.__sequence[0];return new Response(JSON.stringify(item),{status:200});}
  if(route.__throw)return Promise.reject(new TypeError('fetch failed: socket hangup'));
  if(route.__status)return new Response(JSON.stringify(route.body||{}),{status:route.__status});
  return new Response(JSON.stringify(route),{status:200});
 };
 return {calls,fetchImpl};
}

test('live adapter creates metric and experiment for an approved proposal, without starting by default',async()=>{
 const record=approvedRecord();
 const {calls,fetchImpl}=stubFetch();
 const result=await executeExperimentProposalApi(record,{env:ENV,fetchImpl});
 assert.equal(result.mode,'flagsmith-api');
 assert.equal(result.experimentId,601);
 assert.equal(result.metricId,501);
 assert.equal(result.started,false);
 assert.deepEqual(calls.map(c=>c.key),[
  'GET environments/test-env-key/',
  'GET projects/42/features/?search=checkout_cta_copy',
  'GET environments/test-env-key/experiment-metrics/',
  'POST environments/test-env-key/experiment-metrics/',
  'POST environments/test-env-key/experiments/',
 ]);
 assert.equal(result.metricReused,false);
 for(const c of calls)assert.equal(c.auth,'Api-Key test-management-key');
 const metricBody=calls[3].body;
 assert.equal(metricBody.aggregation,'occurrence');
 assert.equal(metricBody.direction,'up');
 assert.deepEqual(metricBody.definition,{version:1,event:'checkout_completed'});
 const expBody=calls[4].body;
 assert.equal(expBody.feature,7);
 assert.equal(expBody.name,record.proposal.name);
 assert.equal(expBody.hypothesis,record.proposal.hypothesis);
 assert.deepEqual(expBody.metrics,[{metric:501,expected_direction:'increase'}]);
 assert.equal(expBody.experiment_rollout.rollout_percentage,100);
 assert.equal(expBody.experiment_rollout.feature_state_value.value,'control');
 const mv=expBody.experiment_rollout.multivariate_feature_state_values;
 assert.deepEqual(mv,[
  {multivariate_feature_option:71,percentage_allocation:33},
  {multivariate_feature_option:72,percentage_allocation:33},
 ]);
});

test('live adapter starts the experiment only when start:true',async()=>{
 const record=approvedRecord();
 const {calls,fetchImpl}=stubFetch();
 const result=await executeExperimentProposalApi(record,{env:ENV,fetchImpl,start:true});
 assert.equal(result.started,true);
 assert.equal(calls.at(-1).key,'POST environments/test-env-key/experiments/601/start/');
});

test('live adapter refuses without a management key',async()=>{
 const record=approvedRecord();
 const {calls,fetchImpl}=stubFetch();
 await assert.rejects(()=>executeExperimentProposalApi(record,{env:{FLAGSMITH_ENVIRONMENT_KEY:'x'},fetchImpl}),/FLAGSMITH_MANAGEMENT_KEY/);
 assert.equal(calls.length,0);
});

test('live adapter stops cleanly when the flag is missing',async()=>{
 const record=approvedRecord();
 const {calls,fetchImpl}=stubFetch({'GET projects/42/features/?search=checkout_cta_copy':{results:[]}});
 await assert.rejects(()=>executeExperimentProposalApi(record,{env:ENV,fetchImpl}),/not found.*nothing was changed/);
 assert.deepEqual(calls.map(c=>c.key),['GET environments/test-env-key/','GET projects/42/features/?search=checkout_cta_copy']);
});

test('live adapter stops cleanly when a keyed variation is missing',async()=>{
 const record=approvedRecord();
 const {calls,fetchImpl}=stubFetch({'GET projects/42/features/?search=checkout_cta_copy':{results:[{id:7,name:'checkout_cta_copy',multivariate_options:[{id:71,string_value:'buy_now'}]}]}});
 await assert.rejects(()=>executeExperimentProposalApi(record,{env:ENV,fetchImpl}),/missing keyed variation\(s\): get_it_today/);
 assert.equal(calls.some(c=>c.key.startsWith('POST')),false);
});

test('live adapter surfaces API errors with status',async()=>{
 const record=approvedRecord();
 const {fetchImpl}=stubFetch({'POST environments/test-env-key/experiment-metrics/':{__status:403,body:{detail:'forbidden'}}});
 await assert.rejects(()=>executeExperimentProposalApi(record,{env:ENV,fetchImpl}),/HTTP 403/);
});

test('live adapter reuses an existing metric for the same event instead of creating a redundant one',async()=>{
 const record=approvedRecord();
 const {calls,fetchImpl}=stubFetch({'GET environments/test-env-key/experiment-metrics/':{results:[{id:88,name:'Checkout completion rate',aggregation:'occurrence',direction:'up',definition:{version:1,event:'checkout_completed'}}]}});
 const result=await executeExperimentProposalApi(record,{env:ENV,fetchImpl});
 assert.equal(result.metricId,88);
 assert.equal(result.metricReused,true);
 assert.equal(calls.some(c=>c.key==='POST environments/test-env-key/experiment-metrics/'),false);
 const expBody=calls.at(-1).body;
 assert.deepEqual(expBody.metrics,[{metric:88,expected_direction:'increase'}]);
});

test('experiment-creation failure after metric creation reports the created metric, no false "nothing changed" claim',async()=>{
 const record=approvedRecord();
 const {fetchImpl}=stubFetch({'POST environments/test-env-key/experiments/':{__status:400,body:{detail:'boom'}}});
 await assert.rejects(
  ()=>executeExperimentProposalApi(record,{env:ENV,fetchImpl}),
  /Experiment creation failed after metric 501 WAS CREATED before the failure:.*HTTP 400/
 );
});

test('experiment-creation failure with a reused metric says reused, not created',async()=>{
 const record=approvedRecord();
 const {fetchImpl}=stubFetch({
  'GET environments/test-env-key/experiment-metrics/':{results:[{id:88,name:'m',aggregation:'occurrence',definition:{version:1,event:'checkout_completed'}}]},
  'POST environments/test-env-key/experiments/':{__status:400,body:{detail:'boom'}},
 });
 await assert.rejects(
  ()=>executeExperimentProposalApi(record,{env:ENV,fetchImpl}),
  /Experiment creation failed after reused existing metric 88:/
 );
});

test('over-100% total weight is rejected before any write',async()=>{
 const record=approvedRecord();
 record.proposal={...record.proposal,variations:record.proposal.variations.map(v=>({...v,weightPct:60}))};
 const {calls,fetchImpl}=stubFetch();
 await assert.rejects(()=>executeExperimentProposalApi(record,{env:ENV,fetchImpl}),/add to 180%.*Nothing was changed/);
 assert.equal(calls.length,0);
});

test('ambiguous metric POST (no response) triggers a recovery read, reports found metric, never retries',async()=>{
 const record=approvedRecord();
 const {calls,fetchImpl}=stubFetch({
  'POST environments/test-env-key/experiment-metrics/':{__throw:true},
  'GET environments/test-env-key/experiment-metrics/':{__sequence:[{results:[]},{results:[{id:90,name:'Checkout CTA copy test',aggregation:'occurrence',definition:{version:1,event:'checkout_completed'}}]}]},
 });
 await assert.rejects(
  ()=>executeExperimentProposalApi(record,{env:ENV,fetchImpl}),
  /Metric creation outcome unknown.*recovery read FOUND the metric with id 90.*no blind retry/
 );
 const metricPosts=calls.filter(c=>c.key==='POST environments/test-env-key/experiment-metrics/');
 assert.equal(metricPosts.length,1);
 assert.equal(calls.some(c=>c.key==='POST environments/test-env-key/experiments/'),false);
});

test('ambiguous metric POST with empty recovery read does not claim nothing-changed',async()=>{
 const record=approvedRecord();
 const {fetchImpl}=stubFetch({'POST environments/test-env-key/experiment-metrics/':{__throw:true}});
 await assert.rejects(
  ()=>executeExperimentProposalApi(record,{env:ENV,fetchImpl}),
  /outcome unknown.*recovery read found NO matching metric.*not verified/
 );
});

test('ambiguous experiment POST triggers recovery read and reports exact partial state',async()=>{
 const record=approvedRecord();
 const {calls,fetchImpl}=stubFetch({
  'POST environments/test-env-key/experiments/':{__throw:true},
  'GET environments/test-env-key/experiments/':{results:[{id:777,name:'Checkout CTA copy test'}]},
 });
 await assert.rejects(
  ()=>executeExperimentProposalApi(record,{env:ENV,fetchImpl}),
  /Experiment creation outcome unknown.*FOUND experiment "Checkout CTA copy test" with id 777 after metric 501 WAS CREATED/
 );
 const expPosts=calls.filter(c=>c.key==='POST environments/test-env-key/experiments/');
 assert.equal(expPosts.length,1);
});

test('probe feature helper creates flag and keyed variations with weight 0',async()=>{
 const calls=[];
 const fetchImpl=async(url,init)=>{
  const path=url.replace('https://api.flagsmith.com/api/v1/','');
  calls.push({key:`${init.method} ${path}`,body:init.body?JSON.parse(init.body):undefined});
  if(path==='environments/test-env-key/')return new Response(JSON.stringify({project:42}),{status:200});
  if(path===`projects/42/features/?search=flagproof_adapter_probe`)return new Response(JSON.stringify({results:[]}),{status:200});
  if(path==='projects/42/features/')return new Response(JSON.stringify({id:900}),{status:200});
  if(path==='projects/42/features/900/mv-options/'){const b=JSON.parse(init.body);return new Response(JSON.stringify({id:b.string_value==='probe_a'?901:902,key:b.key}),{status:200});}
  return new Response('{}',{status:404});
 };
 const result=await createAdapterProbeFeature({env:ENV,fetchImpl});
 assert.deepEqual(result,{projectId:42,featureId:900,options:[{id:901,key:'probe_a'},{id:902,key:'probe_b'}]});
 const mvCalls=calls.filter(c=>c.key==='POST projects/42/features/900/mv-options/');
 assert.equal(mvCalls.length,2);
 for(const c of mvCalls){assert.equal(c.body.default_percentage_allocation,0);assert.match(c.body.key,/^probe_[ab]$/);}
});

test('probe feature helper refuses when the probe flag already exists',async()=>{
 const fetchImpl=async(url)=>{
  if(url.endsWith('environments/test-env-key/'))return new Response(JSON.stringify({project:42}),{status:200});
  return new Response(JSON.stringify({results:[{id:900,name:'flagproof_adapter_probe'}]}),{status:200});
 };
 await assert.rejects(()=>createAdapterProbeFeature({env:ENV,fetchImpl}),/already exists \(id 900\).*Nothing was changed/);
});

test('cleanup deletes experiment then feature and reports per-resource failures',async()=>{
 const calls=[];
 const fetchImpl=async(url,init)=>{
  const path=url.replace('https://api.flagsmith.com/api/v1/','');
  calls.push(`${init.method} ${path}`);
  if(path==='environments/test-env-key/')return new Response(JSON.stringify({project:42}),{status:200});
  if(path==='environments/test-env-key/experiments/601/')return new Response(null,{status:204});
  if(path==='projects/42/features/900/')return new Response(JSON.stringify({detail:'nope'}),{status:409});
  return new Response('{}',{status:404});
 };
 const result=await cleanupAdapterProbe({env:ENV,fetchImpl,experimentId:601,featureId:900});
 assert.deepEqual(result.removed,['experiment 601']);
 assert.equal(result.failures.length,1);
 assert.match(result.failures[0],/feature 900:.*HTTP 409/);
});

test('5xx on experiment POST is treated as ambiguous: recovery read, no definitive-absence claim',async()=>{
 const record=approvedRecord();
 const {calls,fetchImpl}=stubFetch({'POST environments/test-env-key/experiments/':{__status:503,body:{detail:'upstream'}}});
 await assert.rejects(
  ()=>executeExperimentProposalApi(record,{env:ENV,fetchImpl}),
  /Experiment creation outcome unknown.*HTTP 503.*recovery read found NO experiment named "Checkout CTA copy test".*no blind retry/
 );
 const expPosts=calls.filter(c=>c.key==='POST environments/test-env-key/experiments/');
 assert.equal(expPosts.length,1);
});

test('5xx on probe flag creation is ambiguous with a recovery read',async()=>{
 let featureGetCount=0;
 const fetchImpl=async(url,init)=>{
  const path=url.replace('https://api.flagsmith.com/api/v1/','');
  if(path==='environments/test-env-key/')return new Response(JSON.stringify({project:42}),{status:200});
  if(path==='projects/42/features/?search=flagproof_adapter_probe'){
   featureGetCount+=1;
   return new Response(JSON.stringify({results:featureGetCount>1?[{id:900,name:'flagproof_adapter_probe'}]:[]}),{status:200});
  }
  if(path==='projects/42/features/')return new Response(JSON.stringify({detail:'boom'}),{status:500});
  return new Response('{}',{status:404});
 };
 await assert.rejects(
  ()=>createAdapterProbeFeature({env:ENV,fetchImpl}),
  /Probe flag creation outcome unknown.*recovery read FOUND it with id 900.*no blind retry/
 );
});

test('runAdapterVerification end to end against a stub: create, read-back (nested feature object), cleanup',async()=>{
 const {runAdapterVerification}=await import('../src/experiment-execute.mjs');
 const calls=[];
 const state={featureCreated:false,expCreated:false};
 const fetchImpl=async(url,init)=>{
  const path=url.replace('https://api.flagsmith.com/api/v1/','');
  const key=`${init.method} ${path}`;
  calls.push(key);
  const ok=(body,status=200)=>new Response(body===null?null:JSON.stringify(body),{status});
  if(key==='GET environments/test-env-key/')return ok({project:42});
  if(key==='GET projects/42/features/?search=flagproof_adapter_probe')return ok({results:[]});
  if(key==='POST projects/42/features/'){state.featureCreated=true;return ok({id:900});}
  if(key==='POST projects/42/features/900/mv-options/'){const b=JSON.parse(init.body);return ok({id:b.string_value==='probe_a'?901:902,key:b.key});}
  if(key==='GET environments/test-env-key/experiment-metrics/')return ok({results:[{id:88,aggregation:'occurrence',definition:{version:1,event:'checkout_completed'}}]});
  if(key==='POST environments/test-env-key/experiments/'){state.expCreated=true;return ok({id:601});}
  if(key==='GET environments/test-env-key/experiments/601/')return ok({id:601,status:'created',name:'FlagProof adapter verification (synthetic)',feature:{id:900,name:'flagproof_adapter_probe'},metrics:[{metric:88}]});
  if(key==='DELETE environments/test-env-key/experiments/601/')return ok(null,204);
  if(key==='DELETE projects/42/features/900/')return ok(null,204);
  return ok({detail:'not found'},404);
 };
 const report=await runAdapterVerification({env:ENV,fetchImpl});
 assert.equal(report.verified,true);
 assert.deepEqual(report.readback,{status:'created',featureId:900,reason:'id, feature, name, status and metric link all match'});
 assert.equal(report.metric.reused,true);
 assert.equal(report.metric.id,88);
 assert.equal(report.experiment.id,601);
 assert.equal(report.experiment.started,false);
 assert.deepEqual(report.cleanup.removed,['experiment 601','feature 900']);
 assert.deepEqual(report.cleanup.failures,[]);
 assert.deepEqual(report.leftovers,[]);
 // No experiment start call, no metric creation.
 assert.equal(calls.some(c=>c==='POST environments/test-env-key/experiment-metrics/'),false);
 assert.equal(calls.some(c=>c.includes('/start/')),false);
});

test('verifyExperimentReadback accepts a schema-faithful stopped probe response and rejects the real running 399 shape',async()=>{
 const {verifyExperimentReadback}=await import('../src/experiment-execute.mjs');
 const {readFile}=await import('node:fs/promises');
 // Actual Flagsmith API response for experiment 399, captured 24 Nov 2026 (trimmed; nested feature object is the real shape).
 const real399=JSON.parse(await readFile(new URL('./fixtures/flagsmith-experiment-399-detail.json',import.meta.url),'utf8'));

 // Acceptance: constructed from the real captured shape (the actual 405 body
 // was not persisted before deletion; fields match what the create + 200 read
 // established: id 405, probe feature, synthetic name, stopped status).
 const probe405={id:405,name:'FlagProof adapter verification (synthetic)',status:'created',feature:{id:301616,name:'flagproof_adapter_probe'},metrics:[{metric:346,expected_direction:'increase'}]};
 const accept=verifyExperimentReadback(probe405,{experimentId:405,featureId:301616,name:'FlagProof adapter verification (synthetic)',metricId:346});
 assert.deepEqual(accept,{verified:true,reason:'id, feature, name, status and metric link all match'});

 // Rejections against the REAL captured 399 response, field by field.
 assert.equal(verifyExperimentReadback(real399,{experimentId:405,featureId:301430}).verified,false);
 const byFeature=verifyExperimentReadback(real399,{experimentId:399,featureId:301616});
 assert.match(byFeature.reason,/feature mismatch: expected 301616, got 301430/);
 const byName=verifyExperimentReadback(real399,{experimentId:399,featureId:301430,name:'FlagProof adapter verification (synthetic)'});
 assert.match(byName.reason,/name mismatch/);
 const byStatus=verifyExperimentReadback(real399,{experimentId:399,featureId:301430,name:'Checkout CTA copy test'});
 assert.match(byStatus.reason,/unexpected status: running/);
 // Derived from the real 399 response with only status changed, to reach the metric branch.
 const byMetric=verifyExperimentReadback({...real399,status:'created'},{experimentId:399,featureId:301430,name:'Checkout CTA copy test',metricId:346});
 assert.match(byMetric.reason,/metric 346 not linked/);
});
