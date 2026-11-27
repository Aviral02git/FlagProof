import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtempSync} from 'node:fs';import {tmpdir} from 'node:os';import path from 'node:path';
import {createDemoLock} from '../src/demo-lock.mjs';
import {createFlagsmithCleanupAdapter} from '../src/demo-cleanup-adapter.mjs';
const mkFetch=store=>{const calls=[];const f=async(url,o)=>{calls.push(`${o.method} ${url}`);const m=url.match(/environments\/([^/]+)\/experiments\/(\d+)\/(pause\/)?$/);
 const e=m&&store[m[1]+':'+m[2]];if(!e)return {status:404,ok:false,text:async()=>''};
 if(m[3]){e.status='paused';return {status:200,ok:true,text:async()=>JSON.stringify(e)};}
 if(o.method==='DELETE'){if(e.status==='running')return {status:400,ok:false,text:async()=>''};delete store[m[1]+':'+m[2]];return {status:204,ok:true,text:async()=>''};}
 return {status:200,ok:true,text:async()=>JSON.stringify(e)};};return {f,calls};};
const setup=store=>{const {f,calls}=mkFetch(store);let t=1e12;
 const lock=createDemoLock({stateFile:path.join(mkdtempSync(path.join(tmpdir(),'ad-')),'s.json'),scope:{environment:'ENV-DEMO',flag:'demo_flag'},now:()=>t,leaseMs:10,perOwnerCooldownMs:0});
 const adapter=createFlagsmithCleanupAdapter({apiUrl:'http://x/api/v1',environmentKey:'ENV-DEMO',managementKey:'k',flagName:'demo_flag',featureId:9,fetchImpl:f});
 return {lock,adapter,calls,adv:()=>{t+=10;}};};
test('running demo experiment is paused first, then deleted, and the demo frees up',async()=>{
 const store={'ENV-DEMO:5':{id:5,status:'running',feature:9}};const {lock,adapter,calls,adv}=setup(store);
 const a=lock.tryAcquire('a');lock.recordExperiment('a',a.token,5);adv();
 const r=await lock.cleanup(adapter);
 assert.equal(r.ok,true);assert.deepEqual(calls.filter(c=>!c.startsWith('GET')),['POST http://x/api/v1/environments/ENV-DEMO/experiments/5/pause/','DELETE http://x/api/v1/environments/ENV-DEMO/experiments/5/']);
 assert.equal(store['ENV-DEMO:5'],undefined);assert.equal(lock.tryAcquire('b').ok,true);
});
test('an experiment on a different flag in the demo environment is refused and never written to',async()=>{
 const store={'ENV-DEMO:6':{id:6,status:'running',feature:1234}};const {lock,adapter,calls,adv}=setup(store);
 const a=lock.tryAcquire('a');lock.recordExperiment('a',a.token,6);adv();
 const r=await lock.cleanup(adapter);
 assert.deepEqual(r.refused,[6]);assert.ok(!calls.some(c=>/^(POST|DELETE)/.test(c)));assert.equal(store['ENV-DEMO:6'].status,'running');
});
test('an id that exists only in another environment is not found there and nothing is written',async()=>{
 const store={'OTHER-ENV:7':{id:7,status:'running',feature:9}};const {lock,adapter,calls,adv}=setup(store);
 const a=lock.tryAcquire('a');lock.recordExperiment('a',a.token,7);adv();
 await lock.cleanup(adapter);
 assert.ok(!calls.some(c=>/^(POST|DELETE)/.test(c)));assert.equal(store['OTHER-ENV:7'].status,'running');
 assert.ok(calls.every(c=>c.includes('environments/ENV-DEMO/')));
});
test('an id never recorded by this server is never touched even if it is in scope',async()=>{
 const store={'ENV-DEMO:8':{id:8,status:'running',feature:9}};const {lock,adapter,calls}=setup(store);
 assert.equal(lock.inScope({id:8,environment_key:'ENV-DEMO',feature_name:'demo_flag'}),false);
 await lock.cleanup(adapter);assert.equal(calls.length,0);
});
