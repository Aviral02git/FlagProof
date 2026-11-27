import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,readFileSync,chmodSync} from 'node:fs';import {tmpdir} from 'node:os';import path from 'node:path';
import {createDemoLock} from '../src/demo-lock.mjs';
const scope={environment:'ENV-DEMO',flag:'demo_flag'};
const mk=(o={})=>{const f=path.join(mkdtempSync(path.join(tmpdir(),'dl-')),'s.json');let t=1e12;const clock={t:()=>t,adv:ms=>{t+=ms;}};
 const make=(x={})=>createDemoLock({stateFile:f,scope,now:clock.t,leaseMs:1000,perOwnerCooldownMs:0,...o,...x});return {f,clock,make,l:make()};};
test('one visitor at a time; same owner reuses',()=>{
 const {l}=mk();const a=l.tryAcquire('a');assert.equal(a.ok,true);
 assert.equal(l.tryAcquire('b').reason,'busy');assert.equal(l.tryAcquire('a').reused,true);
});
test('ownership-safe release: wrong owner or wrong token refused',()=>{
 const {l}=mk();const a=l.tryAcquire('a');
 assert.equal(l.release('b',a.token).reason,'not-holder');assert.equal(l.release('a','bad').reason,'not-holder');
 assert.equal(l.release('a',a.token).ok,true);assert.equal(l.tryAcquire('b').ok,true);
});
test('stale owner still executing is fenced out and its experiment goes to pending cleanup',()=>{
 const {l,clock}=mk();const a=l.tryAcquire('a');l.recordExperiment('a',a.token,101);
 clock.adv(1000);
 assert.equal(l.holds('a',a.token),false);
 assert.equal(l.recordExperiment('a',a.token,102),false);
 const b=l.tryAcquire('b');assert.equal(b.ok,false);assert.equal(b.reason,'cleanup-pending');
});
test('cleanup frees the demo only after the recorded experiment is completed and deleted',async()=>{
 const {l,clock}=mk();const a=l.tryAcquire('a');l.recordExperiment('a',a.token,101);clock.adv(1000);
 const calls=[];const exp={id:101,environment_key:'ENV-DEMO',feature_name:'demo_flag'};
 const res=await l.cleanup({get:async()=>exp,complete:async id=>calls.push('c'+id),remove:async id=>calls.push('d'+id)});
 assert.deepEqual(calls,['c101','d101']);assert.equal(res.ok,true);assert.equal(l.tryAcquire('b').ok,true);
});
test('failed cleanup keeps it pending (no new visitor)',async()=>{
 const {l,clock}=mk();const a=l.tryAcquire('a');l.recordExperiment('a',a.token,101);clock.adv(1000);
 const res=await l.cleanup({get:async()=>({id:101,environment_key:'ENV-DEMO',feature_name:'demo_flag'}),complete:async()=>{throw new Error('boom');},remove:async()=>{}});
 assert.equal(res.ok,false);assert.equal(l.tryAcquire('b').reason,'cleanup-pending');
});
test('foreign or out-of-scope resources are never touched, even if in pending',async()=>{
 const {l,clock,f}=mk();const a=l.tryAcquire('a');l.recordExperiment('a',a.token,101);clock.adv(1000);
 const calls=[];
 const res=await l.cleanup({get:async()=>({id:101,environment_key:'OTHER-ENV',feature_name:'checkout_cta_copy'}),complete:async()=>calls.push('x'),remove:async()=>calls.push('y')});
 assert.deepEqual(calls,[]);assert.deepEqual(res.refused,[101]);
 assert.equal(l.inScope({id:999,environment_key:'ENV-DEMO',feature_name:'demo_flag'}),false);// not in ledger
 assert.equal(l.inScope({id:101,environment_key:'ENV-DEMO',feature_name:'checkout_cta_copy'}),false);// wrong flag
 assert.equal(l.inScope({id:101,environment_key:'ENV-DEMO',feature_name:'demo_flag'}),true);
});
test('restart: state and quota persist across a new instance',()=>{
 const {l,clock,make}=mk({dailyCap:2});const a=l.tryAcquire('a');l.release('a',a.token);const b=l.tryAcquire('b');assert.equal(b.ok,true);l.release('b',b.token);
 const l2=make();assert.equal(l2.tryAcquire('c').reason,'daily-cap');
 clock.adv(86400000);assert.equal(make().tryAcquire('c').ok,true);
});
test('restart mid-run: holder and pending survive',()=>{
 const {l,make}=mk();const a=l.tryAcquire('a');l.recordExperiment('a',a.token,7);
 const l2=make();assert.equal(l2.tryAcquire('b').reason,'busy');assert.equal(l2.holds('a',a.token),true);
});
test('corrupt state file fails closed',()=>{
 const {l,f}=mk();writeFileSync(f,'{not json');assert.equal(l.tryAcquire('a').reason,'state-unavailable');assert.equal(l.status().failClosed,true);
});
test('unwritable state fails closed',()=>{
 const {make,f}=mk();writeFileSync(f+'.blocker','x');const l=make({stateFile:f+'.blocker/s.json'});assert.equal(l.tryAcquire('a').reason,'state-unavailable');
});
test('daily cap and per-owner cooldown',()=>{
 const {l,clock}=mk({perOwnerCooldownMs:100,dailyCap:5});const a=l.tryAcquire('a');l.release('a',a.token);
 assert.equal(l.tryAcquire('a').reason,'cooldown');clock.adv(100);assert.equal(l.tryAcquire('a').ok,true);
});
test('orphan created after the lease was lost is adopted into pending and cleaned',async()=>{
 const {l,clock}=mk();const a=l.tryAcquire('a');clock.adv(1000);
 assert.equal(l.adoptOrphan(88),true);assert.equal(l.tryAcquire('b').reason,'cleanup-pending');
 const calls=[];await l.cleanup({get:async()=>({id:88,environment_key:'ENV-DEMO',feature_name:'demo_flag'}),complete:async()=>calls.push('c'),remove:async()=>calls.push('d')});
 assert.deepEqual(calls,['c','d']);assert.equal(l.tryAcquire('b').ok,true);
});
const exp=(id,flag='demo_flag',env='ENV-DEMO')=>({id,environment_key:env,feature_name:flag});
test('release after measure keeps the experiment in ledger and pending; next visitor is blocked until cleanup',async()=>{
 const {l}=mk();const a=l.tryAcquire('a');l.recordExperiment('a',a.token,31);
 assert.equal(l.release('a',a.token).pending,1);
 assert.equal(l.tryAcquire('b').reason,'cleanup-pending');assert.equal(l.inScope(exp(31)),true);
});
test('failed create/start released as uncertain blocks everyone until a listing reconciles it',async()=>{
 const {l}=mk();const a=l.tryAcquire('a');l.release('a',a.token,{uncertain:true});
 assert.equal(l.tryAcquire('b').reason,'cleanup-pending');
 const calls=[];
 const bad=await l.cleanup({listActive:async()=>{throw new Error('down');},get:async()=>null,complete:async()=>{},remove:async()=>{}});
 assert.equal(bad.ok,false);assert.equal(l.tryAcquire('b').reason,'cleanup-pending');// listing failed: still blocked
 const res=await l.cleanup({listActive:async()=>[exp(40),exp(41,'checkout_cta_copy'),exp(42,'demo_flag','OTHER')],get:async id=>exp(id),complete:async id=>calls.push('c'+id),remove:async id=>calls.push('d'+id)});
 assert.deepEqual(calls,['c40','d40']);assert.equal(res.ok,true);assert.equal(l.tryAcquire('b').ok,true);
});
test('uncertain reconcile with an empty listing frees the demo (nothing was created)',async()=>{
 const {l}=mk();const a=l.tryAcquire('a');l.release('a',a.token,{uncertain:true});
 assert.equal((await l.cleanup({listActive:async()=>[],get:async()=>null,complete:async()=>{},remove:async()=>{}})).ok,true);
 assert.equal(l.tryAcquire('b').ok,true);
});
test('renew extends only for the current valid holder and is capped at 3x the lease',()=>{
 const {l,clock}=mk();const a=l.tryAcquire('a');
 assert.equal(l.renew('b',a.token),false);assert.equal(l.renew('a','bad'),false);
 clock.adv(900);assert.equal(l.renew('a',a.token),true);assert.equal(l.holds('a',a.token),true);
 clock.adv(900);assert.equal(l.renew('a',a.token),true);clock.adv(900);assert.equal(l.renew('a',a.token),true);
 clock.adv(900);assert.equal(l.renew('a',a.token),false);// past 3x cap
 clock.adv(1000);assert.equal(l.holds('a',a.token),false);
});
