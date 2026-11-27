import test from 'node:test';import assert from 'node:assert/strict';
import {createDurableGate} from '../src/demo-durable.mjs';
const mk=({exps=[],usage={billableAPICalls:100},fail=false,t=Date.parse('2026-11-27T12:00:00Z')}={})=>{const calls=[];
 const f=async(url,o)=>{calls.push(`${o.method} ${url}`);if(fail)return {status:500,ok:false,text:async()=>''};
  if(/usage-data/.test(url))return {status:200,ok:true,text:async()=>JSON.stringify(usage)};
  const m=url.match(/environments\/ENV\/experiments\/(?:(\d+)\/(pause\/)?)?$/);if(!m)return {status:404,ok:false,text:async()=>''};
  if(!m[1])return {status:200,ok:true,text:async()=>JSON.stringify({results:exps})};
  return {status:o.method==='DELETE'?204:200,ok:true,text:async()=>'{}'};};
 return {calls,gate:createDurableGate({apiUrl:'http://x/api/v1',orgId:7,environmentKey:'ENV',flagName:'demo_flag',managementKey:'k',now:()=>t,fetchImpl:f,maxMonthlyCalls:1000})};};
const E=(id,flag,started,status='running')=>({id,status,started_at:started,feature:{name:flag}});
test('free when no experiment on the demo flag and usage is under the ceiling',async()=>{
 const {gate}=mk();assert.deepEqual(await gate.check(),{ok:true,used:100});
});
test('busy while an experiment exists on the demo flag; other flags are ignored',async()=>{
 assert.equal((await mk({exps:[E(1,'demo_flag','2026-11-27T11:59:00Z')]}).gate.check()).reason,'busy');
 assert.equal((await mk({exps:[E(2,'checkout_cta_copy','2026-11-27T11:59:00Z')]}).gate.check()).ok,true);
});
test('budget ceiling closes the gate; unreadable or failing state fails closed',async()=>{
 assert.equal((await mk({usage:{billableAPICalls:1000}}).gate.check()).reason,'budget');
 assert.equal((await mk({usage:{}}).gate.check()).reason,'usage-unreadable');
 assert.equal((await mk({fail:true}).gate.check()).reason,'state-unavailable');
});
test('sweep pauses then deletes only stale experiments on the demo flag',async()=>{
 const {gate,calls}=mk({exps:[E(1,'demo_flag','2026-11-27T11:00:00Z'),E(2,'demo_flag','2026-11-27T11:59:00Z'),E(3,'checkout_cta_copy','2026-11-01T00:00:00Z')]});
 assert.deepEqual(await gate.sweep(),[1]);
 assert.deepEqual(calls.filter(c=>!c.startsWith('GET')),['POST http://x/api/v1/environments/ENV/experiments/1/pause/','DELETE http://x/api/v1/environments/ENV/experiments/1/']);
});
test('requires full configuration',()=>{assert.throws(()=>createDurableGate({apiUrl:'x'}),/required/);});

test('pagination is followed; an off-host next link, bad shape or truncation fails closed',async()=>{
 const pages={'http://x/api/v1/environments/ENV/experiments/':{results:[{id:1,status:'completed',feature:{name:'other'}}],next:'http://x/api/v1/environments/ENV/experiments/?page=2'},
  'http://x/api/v1/environments/ENV/experiments/?page=2':{results:[{id:2,status:'created',started_at:null,created_at:'2026-11-27T11:59:00Z',feature:{name:'demo_flag'}}],next:null}};
 const mkP=(map,usage={billableAPICalls:1})=>createDurableGate({apiUrl:'http://x/api/v1',orgId:7,environmentKey:'ENV',flagName:'demo_flag',managementKey:'k',maxMonthlyCalls:1000,
  fetchImpl:async url=>/usage-data/.test(url)?{status:200,ok:true,text:async()=>JSON.stringify(usage)}:map[url]?{status:200,ok:true,text:async()=>JSON.stringify(map[url])}:{status:404,ok:false,text:async()=>''}});
 assert.equal((await mkP(pages).check()).reason,'busy');// created-but-not-started on page 2 still blocks
 const evil={'http://x/api/v1/environments/ENV/experiments/':{results:[],next:'http://evil.example/x'}};
 assert.equal((await mkP(evil).check()).reason,'state-unavailable');
 const bad={'http://x/api/v1/environments/ENV/experiments/':{oops:true}};
 assert.equal((await mkP(bad).check()).reason,'state-unavailable');
 const loop={'http://x/api/v1/environments/ENV/experiments/':{results:[],next:'http://x/api/v1/environments/ENV/experiments/'}};
 assert.equal((await mkP(loop).check()).reason,'state-unavailable');
});
test('sweep deletes a created-but-never-started experiment without pausing it (Flagsmith Cloud answers 400 to pause on created)',async()=>{
 const {gate,calls}=mk({exps:[E(5,'demo_flag','2026-11-27T11:00:00Z','created')]});
 assert.deepEqual(await gate.sweep(),[5]);
 assert.deepEqual(calls.filter(c=>!c.startsWith('GET')),['DELETE http://x/api/v1/environments/ENV/experiments/5/']);
});

test('release frees only the named experiment when it is listed on the demo flag',async()=>{
 const calls=[];const exps=[{id:5,status:'running',feature:{name:'checkout_cta_copy'},created_at:new Date().toISOString()},{id:6,status:'created',feature:{name:'other_flag'}}];
 const fetchImpl=async(url,o)=>{calls.push(o.method+' '+url.replace(/^.*experiments\//,''));return {ok:true,status:200,text:async()=>o.method==='GET'?JSON.stringify({results:exps}):''};};
 const g=createDurableGate({apiUrl:'https://x/api/v1/',orgId:1,environmentKey:'E',flagName:'checkout_cta_copy',managementKey:'k',fetchImpl});
 assert.equal(await g.release(6),false);assert.equal(await g.release(99),false);
 assert.equal(await g.release(5),true);
 assert.deepEqual(calls.filter(c=>c!=='GET '&&!c.startsWith('GET')),['POST 5/pause/','DELETE 5/']);
});

test('owns() is true only for our running experiment on the demo flag with our name; deleted, replaced, paused, renamed or errors are false',async()=>{
 const mkOwn=(body,status=200)=>createDurableGate({apiUrl:'https://x/api/v1/',orgId:1,environmentKey:'E',flagName:'checkout_cta_copy',managementKey:'k',fetchImpl:async()=>({ok:status<400,status,text:async()=>JSON.stringify(body)})});
 const ok={id:5,status:'running',name:'N',feature:{name:'checkout_cta_copy'}};
 assert.equal(await mkOwn(ok).owns(5,{name:'N'}),true);
 assert.equal(await mkOwn(ok).owns(6,{name:'N'}),false);
 assert.equal(await mkOwn({...ok,status:'paused'}).owns(5,{name:'N'}),false);
 assert.equal(await mkOwn({...ok,name:'other'}).owns(5,{name:'N'}),false);
 assert.equal(await mkOwn({...ok,feature:{name:'x'}}).owns(5,{name:'N'}),false);
 assert.equal(await mkOwn({},404).owns(5,{name:'N'}),false);
 assert.equal(await mkOwn({},500).owns(5,{name:'N'}),false);
});
