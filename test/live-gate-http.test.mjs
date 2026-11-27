import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import {createLedger} from '../src/demo-ledger.mjs';
// Real HTTP routes in public mode with LOCAL TEST DOUBLES for Flagsmith (no network). The "world" object plays Flagsmith: it survives a simulated server restart.
const freePort=async()=>{const s=net.createServer();await new Promise(r=>s.listen(0,r));const p=s.address().port;await new Promise(r=>s.close(r));return p;};
const month=new Date().toISOString().slice(0,7);
const newWorld=(ledgerText=JSON.stringify({month,identities:300,runs:2,seed:'test'}))=>({exps:[],ledger:ledgerText,nextId:100,created:0});
const doubles=world=>({
 execute:async r=>{await new Promise(res=>setTimeout(res,10));if(world.exps.some(e=>!e.deleted))throw new Error('Flagsmith API POST experiments/ failed: HTTP 409 {"detail":"x"}');const e={id:world.nextId++,status:'created',name:r.proposal.name};world.exps.push(e);world.created++;return {mode:'flagsmith-api',experimentId:e.id,started:false,proposal:r.proposal};},
 gate:{sweep:async()=>[],check:async()=>world.exps.some(e=>!e.deleted)?{ok:false,reason:'busy',retryAfterSec:30}:{ok:true,used:0},release:async id=>{const e=world.exps.find(x=>x.id===id&&!x.deleted);if(e)e.deleted=true;return Boolean(e);},owns:async()=>true},
 ledger:createLedger({store:{read:async()=>{if(world.ledger==='THROW')throw new Error('down');return world.ledger;},write:async x=>{world.ledger=x;}},monthlyIdentityCeiling:10000}),
});
async function start(t,world,{live=true,guards=true}={}){
 const port=await freePort();
 Object.assign(process.env,{FLAGPROOF_PUBLIC:'1',PUBLIC_ORIGIN:`http://127.0.0.1:${port}`,FLAGPROOF_EXPERIMENT_EXECUTOR:'flagsmith',FLAGSMITH_MANAGEMENT_KEY:'stub',FLAGSMITH_ENVIRONMENT_KEY:'stub',FLAGSMITH_MANAGEMENT_URL:'http://127.0.0.1:9/api/v1/'});
 if(live)process.env.FLAGPROOF_PUBLIC_LIVE='1';else delete process.env.FLAGPROOF_PUBLIC_LIVE;
 delete process.env.PUBLIC_DEMO_PASSWORD;delete process.env.FLAGSMITH_API_URL;
 const {startServer}=await import('../src/server.mjs');
 const d=doubles(world);
 const app=await startServer({port,artifactRoot:await mkdtemp(path.join(os.tmpdir(),'fp-live-')),flowOptions:guards?{execute:d.execute,gate:d.gate,ledger:d.ledger}:{execute:d.execute}});
 t.after(async()=>{for(const k of ['FLAGPROOF_PUBLIC','PUBLIC_ORIGIN','FLAGPROOF_EXPERIMENT_EXECUTOR','FLAGSMITH_MANAGEMENT_KEY','FLAGSMITH_ENVIRONMENT_KEY','FLAGSMITH_MANAGEMENT_URL','FLAGPROOF_PUBLIC_LIVE'])delete process.env[k];await app.close();});
 return app;
}
const visitor=base=>{let cookie='',token='';const call=async(method,p,body)=>{const res=await fetch(base+p,{method,headers:{...(cookie?{cookie}:{}),...(token?{'x-flagproof-token':token}:{}),...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});const c=res.headers.get('set-cookie');if(c)cookie=c.split(';')[0];let data=null;try{data=await res.json();}catch{}return {status:res.status,data};};
 return {call,async init(){const s=await call('GET','/api/state');token=s.data.token;return s.data;}};};
const approveFlow=async v=>{const p=(await v.call('POST','/api/experiments/propose',{request:''})).data;return v.call('POST',`/api/experiments/${p.id}/approve`,{hash:p.hash,start:true});};
test('HTTP: two visitors approve at once, exactly one gets the slot, the other a plain busy message (429)',async t=>{
 const world=newWorld();const app=await start(t,world);const a=visitor(app.origin),b=visitor(app.origin);await a.init();await b.init();
 const [ra,rb]=await Promise.all([approveFlow(a),approveFlow(b)]);
 const codes=[ra.status,rb.status].sort();assert.deepEqual(codes,[200,429]);
 const loser=ra.status===429?ra:rb;assert.match(loser.data.error,/Another visitor/);assert.equal(world.created,1);
});
test('HTTP: after a simulated restart the slot is still busy and the ledger count is kept (state lives in the world, not the process)',async t=>{
 const world=newWorld();let app=await start(t,world);const a=visitor(app.origin);await a.init();assert.equal((await approveFlow(a)).status,200);
 const reserved=JSON.parse(world.ledger);assert.equal(reserved.identities,600);assert.equal(reserved.seed,'test');
 await app.close();app=await start(t,world);const b=visitor(app.origin);await b.init();
 const r=await approveFlow(b);assert.equal(r.status,429);assert.match(r.data.error,/Another visitor/);assert.equal(JSON.parse(world.ledger).identities,600);
});
test('HTTP: unreadable ledger, uninitialised ledger and exhausted allowance all refuse and release the created experiment',async t=>{
 for(const [ledger,re] of [['THROW',/unavailable/],['',/unavailable/],[JSON.stringify({month,identities:9900,runs:60}),/allowance/]]){
  const world=newWorld(ledger);const app=await start(t,world);const v=visitor(app.origin);await v.init();
  const r=await approveFlow(v);assert.equal(r.status,429);assert.match(r.data.error,re);assert.ok(world.exps.every(e=>e.deleted),'created experiment released');
  await app.close();
 }
});
test('HTTP: with the default proposal (300 identities reserved per run), exactly floor((10000-300)/300) = 32 further reservations succeed, the 33rd is refused',async t=>{
 const world=newWorld();const app=await start(t,world);let ok=0;
 for(let i=0;i<40;i++){const v=visitor(app.origin);await v.init();const r=await approveFlow(v);if(r.status===200){ok++;world.exps.forEach(e=>e.deleted=true);}else{assert.match(r.data.error,/allowance/);break;}}
 assert.equal(ok,32);assert.equal(JSON.parse(world.ledger).identities,9900);
});
test('HTTP: public site without the live switch, or without gate and ledger, stays on the fixture and never calls the executor',async t=>{
 for(const opts of [{live:false,guards:true},{live:true,guards:false}]){
  const world=newWorld();const app=await start(t,world,opts);const v=visitor(app.origin);await v.init();
  const r=await approveFlow(v);assert.equal(r.status,200);assert.equal(r.data.result.executor.live,false);assert.equal(world.created,0);
  await app.close();
 }
});
