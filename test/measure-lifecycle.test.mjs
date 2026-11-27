import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import os from 'node:os';
process.env.FLAGPROOF_RESULT_HOLD_MS='1500';
const {createExperimentFlow,plannedIdentities}=await import('../src/experiment-flow.mjs');
const {createLedger}=await import('../src/demo-ledger.mjs');
const {generateExperimentProposal}=await import('../src/experiment-plan.mjs');
// Real flow, real traffic worker over IPC, local stub for Flagsmith management + SDK. No network.
const stub=async({inference})=>{
 const c={identities:0,refresh:0,starts:0};let i=0;
 const server=http.createServer((q,r)=>{let b='';q.on('data',d=>b+=d);q.on('end',()=>{r.setHeader('content-type','application/json');const u=q.url.split('?')[0];
  if(u.includes('identities')){c.identities++;return r.end(JSON.stringify({traits:[],flags:[{feature:{id:1,name:'checkout_cta_copy',type:'MULTIVARIATE'},enabled:true,feature_state_value:['control','buy_now','get_it_today'][i++%3]}]}));}
  if(u.endsWith('/start/')){c.starts++;return r.end('{}');}
  if(u.includes('refresh'))c.refresh++;
  if(u.endsWith('/results/')){const v=k=>({n:100,sum:30});const m={variants:{control:v(),buy_now:v(),get_it_today:v()}};if(inference)m.inference={buy_now:{lift:.1,ci_low:.01,ci_high:.2,chance_to_win:.9},get_it_today:{lift:.1,ci_low:.01,ci_high:.2,chance_to_win:.8}};return r.end(JSON.stringify({results:{as_of:'now',payload:{metrics:[m]}}}));}
  r.end('{}');});});
 await new Promise(res=>server.listen(0,'127.0.0.1',res));return {server,c,port:server.address().port};
};
const world=()=>({exps:[],released:[],ledger:JSON.stringify({month:new Date().toISOString().slice(0,7),identities:300,runs:2,seed:'t'})});
const build=(st,w)=>createExperimentFlow({publicMode:false,artifactRoot:os.tmpdir(),
 env:{...process.env,FLAGPROOF_EXPERIMENT_EXECUTOR:'flagsmith',FLAGPROOF_EXPERIMENT_MEASURE:'1',FLAGPROOF_SETTLE_MS:'100',FLAGSMITH_API_URL:`http://127.0.0.1:${st.port}/api/v1/`,FLAGSMITH_MANAGEMENT_KEY:'k',FLAGSMITH_ENVIRONMENT_KEY:'E'},
 execute:async r=>{const e={id:7,name:r.proposal.name,deleted:false};w.exps.push(e);return {mode:'flagsmith-api',experimentId:7,started:false,proposal:r.proposal};},
 gate:{sweep:async()=>[],check:async()=>w.exps.some(e=>!e.deleted)?{ok:false,reason:'busy',retryAfterSec:30}:{ok:true},release:async id=>{w.released.push(id);w.exps.forEach(e=>{if(e.id===id)e.deleted=true;});return true;},owns:async id=>w.exps.some(e=>e.id===id&&!e.deleted)},
 ledger:createLedger({store:{read:async()=>w.ledger,write:async x=>{w.ledger=x;}},monthlyIdentityCeiling:10000})});
const go=async(flow,request='')=>{const r=await flow.propose({owner:'a',ip:'x',request});await flow.approve(r.id,'a',{hash:r.hash,start:true});return r;};
test('plannedIdentities is the one number for reservation and enforcement, for every rollout',()=>{
 assert.equal(plannedIdentities({rolloutPct:100}),300);assert.equal(plannedIdentities({rolloutPct:50}),600);assert.equal(plannedIdentities({rolloutPct:10}),600);assert.equal(plannedIdentities({rolloutPct:100},60),150);assert.equal(plannedIdentities({rolloutPct:100},1),150);
 assert.equal(plannedIdentities({}),300);
});
test('measure: identities sent never exceed the reservation; finished analysis frees the slot at once',async()=>{
 const st=await stub({inference:true});const w=world();const flow=build(st,w);
 const r=await go(flow);const before=JSON.parse(w.ledger).identities;assert.equal(before,300+300);
 const m=await flow.measure(r.id,'a',{visitors:300});
 assert.ok(st.c.identities<=300,`sent ${st.c.identities}`);assert.equal(st.c.identities,300);
 assert.equal(m.measurement.analysis.hasInference,true);assert.deepEqual(w.released,[7]);
 await assert.rejects(()=>flow.measure(r.id,'a',{readOnly:true}),e=>e.status===409&&/results window/.test(e.message));
 st.server.close();
});
test('measure: the worker is capped at the reservation even if the plan would allow more',async()=>{
 const st=await stub({inference:true});const w=world();const flow=build(st,w);
 const r=await go(flow);r.reservedIdentities=200;
 await flow.measure(r.id,'a',{visitors:300});
 assert.ok(st.c.identities<=200,`sent ${st.c.identities}`);assert.equal(st.c.identities,200);
 st.server.close();
});
test('measure: no inference yet keeps the experiment for a bounded window, a re-check reads real results then frees it',async()=>{
 const st=await stub({inference:false});const w=world();const flow=build(st,w);
 const r=await go(flow);const m=await flow.measure(r.id,'a',{visitors:300});
 assert.equal(m.measurement.analysis.hasInference,false);assert.deepEqual(w.released,[]);
 assert.doesNotThrow(()=>JSON.stringify(m),'the record returned over HTTP must serialize with the hold timer set');assert.ok(!('holdTimer' in JSON.parse(JSON.stringify(m))));
 const other=await flow.propose({owner:'b',ip:'y',request:''});await assert.rejects(()=>flow.approve(other.id,'b',{hash:other.hash,start:true}),e=>e.status===429&&/Another visitor/.test(e.message));
 const idsBefore=st.c.identities;const again=await flow.measure(r.id,'a',{readOnly:true});
 assert.equal(st.c.identities,idsBefore,'re-check sends no traffic');assert.ok(again.measurement.analysis.ready);assert.deepEqual(w.released,[7]);
 st.server.close();
});
test('measure: if nobody re-checks, the timer frees the slot after the hold window',async()=>{
 const st=await stub({inference:false});const w=world();const flow=build(st,w);
 const r=await go(flow);await flow.measure(r.id,'a',{visitors:300});assert.deepEqual(w.released,[]);
 await new Promise(res=>setTimeout(res,2200));assert.deepEqual(w.released,[7]);
 await assert.rejects(()=>flow.measure(r.id,'a',{readOnly:true}),e=>e.status===409);
 st.server.close();
});
