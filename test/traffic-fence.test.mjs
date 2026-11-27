import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {spawn} from 'node:child_process';
// Runs the REAL traffic worker against a local counting stub (no Flagsmith contact) with the parent handshake the demo flow uses.
const run=async(allow,extraEnv={})=>{
 let identities=0,i=0;
 const server=http.createServer((q,r)=>{q.resume();q.on('end',()=>{r.setHeader('content-type','application/json');
  if(q.url.includes('identities')){identities++;const v=['control','buy_now','get_it_today'][i++%3];return r.end(JSON.stringify({traits:[],flags:[{feature:{id:1,name:'checkout_cta_copy',type:'MULTIVARIATE'},enabled:true,feature_state_value:v}]}));}
  r.end('{}');});});
 await new Promise(res=>server.listen(0,'127.0.0.1',res));const port=server.address().port;
 const child=spawn('node',['scripts/run-experiment-traffic.mjs','150'],{env:{...process.env,...extraEnv,FLAGSMITH_ENVIRONMENT_KEY:'stub',FLAGSMITH_API_URL:`http://127.0.0.1:${port}/api/v1/`,FLAGSMITH_EVENTS_API_URL:`http://127.0.0.1:${port}/api/`},stdio:['ignore','ignore','ignore','ipc']});
 let asks=0;child.on('message',m=>{if(m?.t==='next'){asks++;child.send({go:allow(asks),id:m.id});}});
 const code=await new Promise(res=>child.on('exit',res));server.close();
 return {code,identities,asks};
};
test('real worker asks the parent before every request and sends nothing after a refusal',async()=>{
 const r=await run(n=>n<=5);
 assert.notEqual(r.code,0);assert.equal(r.identities,5);assert.equal(r.asks,6);
});
test('real worker completes all 150 when the parent keeps saying go, one ask per request',async()=>{
 const r=await run(()=>true);
 assert.equal(r.code,0);assert.equal(r.identities,150);assert.equal(r.asks,150);
});

test('with 6 lanes the worker still asks once per request, never sends without its own go, and stops after a refusal',async()=>{
 const r=await run(n=>n<=5,{FLAGPROOF_TRAFFIC_CONCURRENCY:'6'});
 assert.notEqual(r.code,0);assert.equal(r.identities,5);assert.ok(r.asks>=6&&r.asks<=11,`asks ${r.asks}`);
});
test('with 6 lanes all 150 complete with exactly one ask each',async()=>{
 const r=await run(()=>true,{FLAGPROOF_TRAFFIC_CONCURRENCY:'6'});
 assert.equal(r.code,0);assert.equal(r.identities,150);assert.equal(r.asks,150);
});

import {attachTrafficFence} from '../src/traffic-fence.mjs';
const runFenced=async(verify,fenceOpts={},askMs,lanes)=>{
 let identities=0,i=0;
 const server=http.createServer((q,r)=>{q.resume();q.on('end',()=>{r.setHeader('content-type','application/json');
  if(q.url.includes('identities')){identities++;const v=['control','buy_now','get_it_today'][i++%3];return r.end(JSON.stringify({traits:[],flags:[{feature:{id:1,name:'checkout_cta_copy',type:'MULTIVARIATE'},enabled:true,feature_state_value:v}]}));}r.end('{}');});});
 await new Promise(res=>server.listen(0,'127.0.0.1',res));const port=server.address().port;
 const child=spawn('node',['scripts/run-experiment-traffic.mjs','150'],{env:{...process.env,FLAGSMITH_ENVIRONMENT_KEY:'stub',...(lanes?{FLAGPROOF_TRAFFIC_CONCURRENCY:String(lanes)}:{}),...(askMs?{FLAGPROOF_ASK_TIMEOUT_MS:String(askMs)}:{}),FLAGSMITH_API_URL:`http://127.0.0.1:${port}/api/v1/`,FLAGSMITH_EVENTS_API_URL:`http://127.0.0.1:${port}/api/`},stdio:['ignore','ignore','ignore','ipc']});
 const f=attachTrafficFence(child,verify,fenceOpts);const code=await new Promise(res=>child.on('exit',res));server.close();return {code,identities,stopped:f.stopped};
};
test('fence: external deletion mid-run (ownership check turns false) stops the real worker before the next request',async()=>{
 let n=0;const r=await runFenced(async()=>++n<=7);
 assert.equal(r.identities,7);assert.equal(r.stopped,true);assert.notEqual(r.code,0);
});
test('fence: a verifier that throws, or one that never answers, stops the worker without sending',async()=>{
 const a=await runFenced(async()=>{throw new Error('flagsmith down');});assert.equal(a.identities,0);assert.equal(a.stopped,true);
 const b=await runFenced(()=>new Promise(()=>{}),{verifyTimeoutMs:300});assert.equal(b.identities,0);assert.notEqual(b.code,0);
});
test('fence: a slow verifier (suspension) delays but does not skip the check',async()=>{
 let n=0;const r=await runFenced(async()=>{await new Promise(res=>setTimeout(res,20));return ++n<=3;});
 assert.equal(r.identities,3);
});

test('fence: a supported slow check (6 s, over the old 5 s worker budget) succeeds; one past the fence budget fails closed',async()=>{
 let n=0;const ok=await runFenced(async()=>{n++;if(n===1)await new Promise(res=>setTimeout(res,6000));return n<=3;});
 assert.equal(ok.identities,3);assert.equal(ok.stopped,true);
 const slow=await runFenced(async()=>{await new Promise(res=>setTimeout(res,1500));return true;},{verifyTimeoutMs:400});
 assert.equal(slow.identities,0);assert.equal(slow.stopped,true);
});
test('fence: the worker still gives up on its own if the parent never answers (overall bound)',async()=>{
 const r=await runFenced(()=>new Promise(()=>{}),{verifyTimeoutMs:60000},800);
 assert.equal(r.identities,0);assert.notEqual(r.code,0);
});

test('fence with 6 lanes: deleted mid-run, thrown, hung and slow-then-false checks all stop the worker; sends never exceed grants',async()=>{
 let n=0;const a=await runFenced(async()=>{await new Promise(res=>setTimeout(res,30));return ++n<=7;},{},undefined,6);
 assert.ok(a.identities>=1&&a.identities<=7,`sent ${a.identities}`);// never more than the 7 grants; a granted request still in flight when the worker is killed may not sendassert.equal(a.stopped,true);assert.notEqual(a.code,0);
 const b=await runFenced(async()=>{throw new Error('flagsmith down');},{},undefined,6);assert.equal(b.identities,0);assert.equal(b.stopped,true);
 const c=await runFenced(()=>new Promise(()=>{}),{verifyTimeoutMs:300},undefined,6);assert.equal(c.identities,0);assert.notEqual(c.code,0);
 let m=0;const d=await runFenced(async()=>{m++;if(m===3)await new Promise(res=>setTimeout(res,1500));return m!==3;},{verifyTimeoutMs:400},undefined,6);
 assert.equal(d.stopped,true);assert.notEqual(d.code,0);assert.ok(d.identities<150);// other lanes keep their own already-answered grants until the hung check times out; no request is ever sent without its own go
});
