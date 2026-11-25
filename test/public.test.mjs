import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';

async function freePort(){const s=net.createServer();await new Promise(r=>s.listen(0,r));const p=s.address().port;await new Promise(r=>s.close(r));return p;}

// Public-mode guard tests: session isolation, entry gate, rate limits, fail-closed fixture.
// Each test starts its own server on an ephemeral port with a temp artifact root.
async function startPublic(t,{password=''}={}){
 const port=await freePort();
 process.env.FLAGPROOF_PUBLIC='1';
 process.env.PUBLIC_ORIGIN=`http://127.0.0.1:${port}`;
 delete process.env.PUBLIC_DEMO_PASSWORD;
 if(password)process.env.PUBLIC_DEMO_PASSWORD=password;
 const {startServer}=await import('../src/server.mjs');
 const artifactRoot=await mkdtemp(path.join(os.tmpdir(),'fp-public-'));
 const app=await startServer({port:Number(process.env.PUBLIC_ORIGIN.split(':').pop()),artifactRoot});
 t.after(async()=>{delete process.env.FLAGPROOF_PUBLIC;delete process.env.PUBLIC_ORIGIN;delete process.env.PUBLIC_DEMO_PASSWORD;await app.close();});
 app.artifactRoot=artifactRoot;
 return app;
}
function client(base){
 let cookie='';
 return {
  async req(method,p,{token,body}={}){
   const res=await fetch(base+p,{method,headers:{...(cookie?{cookie}:{}),...(token?{'x-flagproof-token':token}:{}),...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});
   const setc=res.headers.get('set-cookie');if(setc)cookie=setc.split(';')[0];
   let data=null;try{data=await res.json();}catch{}
   return {status:res.status,data};
  },
  get(p,o){return this.req('GET',p,o);},post(p,o){return this.req('POST',p,o);},
 };
}
test('public mode forces the local fixture adapter even with flagsmith env present',async t=>{
 process.env.FLAGPROOF_MODE='flagsmith';
 const app=await startPublic(t);
 assert.equal(app.adapter.mode,'local-fixture');
 assert.ok(app.origin.startsWith('http://127.0.0.1:'));
 delete process.env.FLAGPROOF_MODE;
});
test('public mode refuses to start without PUBLIC_ORIGIN',async t=>{
 process.env.FLAGPROOF_PUBLIC='1';delete process.env.PUBLIC_ORIGIN;
 const {startServer}=await import('../src/server.mjs');
 const artifactRoot=await mkdtemp(path.join(os.tmpdir(),'fp-public-'));
 await assert.rejects(()=>startServer({port:0,artifactRoot}),/PUBLIC_ORIGIN/);
 delete process.env.FLAGPROOF_PUBLIC;
});
test('clientIp trusts a single forwarded entry only behind a trusted proxy; spoofed chains fall back to the peer address',async()=>{
 const {createPublicGuard}=await import('../src/public-guard.mjs');
 const {clientIp}=createPublicGuard({origin:'http://127.0.0.1:9',password:'',artifactRoot:await mkdtemp(path.join(os.tmpdir(),'fp-guard-'))});
 const req=xff=>({headers:xff===undefined?{}:{'x-forwarded-for':xff},socket:{remoteAddress:'10.9.9.9'}});
 assert.equal(clientIp(req('1.2.3.4'),true),'1.2.3.4');
 assert.equal(clientIp(req('1.2.3.4, 5.6.7.8'),true),'10.9.9.9');
 assert.equal(clientIp(req('1.2.3.4'),false),'10.9.9.9');
 assert.equal(clientIp(req(' , ,'),true),'10.9.9.9');
 assert.equal(clientIp(req(undefined),true),'10.9.9.9');
});

test('locked demo serves an unlock form wired to /api/enter',async t=>{
 const app=await startPublic(t);
 const state=(await (await fetch(app.origin+'/api/state')).json());
 assert.equal(state.hosted,true);
 const html=await (await fetch(app.origin+'/')).text();
 assert.match(html,/id="lock"/);assert.match(html,/id="lock-password"/);
 const js=await (await fetch(app.origin+'/app.js')).text();
 assert.match(js,/\/api\/enter/);
});

test('entry password gates all API and artifact access; wrong password rejected',async t=>{
 const app=await startPublic(t,{password:'demo-pass-123'});
 const base=app.origin;
 const raw=(method,p,headers={},body)=>fetch(base+p,{method,headers,body});
 let res=await raw('GET','/api/state');assert.equal(res.status,403);
 res=await raw('POST','/api/enter',{'Content-Type':'application/json'},JSON.stringify({password:'nope'}));assert.equal(res.status,403);
 const cookie=res.headers.get('set-cookie').split(';')[0];
 res=await raw('POST','/api/enter',{cookie,'Content-Type':'application/json'},JSON.stringify({password:'demo-pass-123'}));assert.equal(res.status,200);
 res=await raw('GET','/api/state',{cookie});assert.equal(res.status,200);
 const state=await res.json();assert.ok(state.token);
 res=await raw('GET','/api/state',{});
 assert.equal((await raw('GET','/artifacts/whatever/report.md',{cookie})).status,404); // owned-only: unknown id is 404, not 403, after entry
});
test('two visitors get different tokens and cannot see each other\'s plans, runs or artifacts',async t=>{
 const app=await startPublic(t);
 const base=app.origin;
 const jar=()=>{let cookie='';return {
  async call(method,p,{token,body}={}){const res=await fetch(base+p,{method,headers:{...(cookie?{cookie}:{}),...(token?{'x-flagproof-token':token}:{}),...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});const sc=res.headers.get('set-cookie');if(sc)cookie=sc.split(';')[0];let data=null;try{data=await res.json();}catch{}return {status:res.status,data};},
 };};
 const a=jar(),b=jar();
 const sa=(await a.call('GET','/api/state')).data, sb=(await b.call('GET','/api/state')).data;
 assert.notEqual(sa.token,sb.token);
 const plan=(await a.call('POST','/api/plans',{token:sa.token,body:{scenario:'healthy'}})).data;
 assert.ok(plan.id);
 // B cannot act on A's plan, and A's token does not work for B.
 assert.equal((await b.call('POST',`/api/plans/${plan.id}/reject`,{token:sb.token})).status,404);
 assert.equal((await b.call('POST','/api/plans',{token:sa.token,body:{scenario:'healthy'}})).status,403);
 // A approves and starts a real suite.
 const appr=await a.call('POST',`/api/plans/${plan.id}/approve`,{token:sa.token,body:{hash:plan.hash}});
 assert.equal(appr.status,202);
 const runId=appr.data.id;
 // B cannot read A's run, report or artifacts while it exists.
 assert.equal((await b.call('GET',`/api/runs/${runId}`)).status,404);
 assert.equal((await b.call('GET',`/artifacts/${runId}/report.md`)).status,404);
 assert.equal((await b.call('GET',`/api/compare?current=${runId}&baseline=${runId}`)).status,404);
 // A's run appears only in A's recent list.
 assert.ok((await a.call('GET','/api/state')).data.recent.some(r=>r.id===runId));
 assert.ok(!(await b.call('GET','/api/state')).data.recent.some(r=>r.id===runId));
 // While A's suite runs, B can review a plan but cannot start a second suite.
 const pb=(await b.call('POST','/api/plans',{token:sb.token,body:{scenario:'healthy'}})).data;
 assert.ok(pb.id);
 const busy=await b.call('POST',`/api/plans/${pb.id}/approve`,{token:sb.token,body:{hash:pb.hash}});
 assert.equal(busy.status,409);
 assert.match(busy.data.error,/Only one suite/);
 // A's own suite completes fully despite the guard.
 for(let i=0;i<60;i++){const st=(await a.call('GET',`/api/runs/${runId}`));if(st.status===200&&['completed','error'].includes(st.data.status))break;await new Promise(r=>setTimeout(r,1000));}
 const done=(await a.call('GET',`/api/runs/${runId}`)).data;
 assert.equal(done.status,'completed');
 assert.equal(done.results.filter(r=>r.status==='pass').length,8);
 // Wait until the server releases the active slot (status flips before the slot clears).
 for(let i=0;i<50;i++){const st=(await a.call('GET','/api/state')).data;if(!st.active)break;await new Promise(r=>setTimeout(r,100));}
 assert.equal((await a.call('GET','/api/state')).data.active,null);
 // A second suite start from the same IP (different visitor) hits the cooldown.
 const second=await b.call('POST',`/api/plans/${pb.id}/approve`,{token:sb.token,body:{hash:pb.hash}});
 assert.equal(second.status,429);
 assert.match(second.data.error,/Try again in \d+s/);
});
test('suite completes behind the entry password: the runner uses a run-scoped ticket, never the visitor session',async t=>{
 const app=await startPublic(t,{password:'demo-pass-123'});
 const base=app.origin;
 let cookie='';
 const call=async(method,p,{token,body}={})=>{const res=await fetch(base+p,{method,headers:{...(cookie?{cookie}:{}),...(token?{'x-flagproof-token':token}:{}),...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});const sc=res.headers.get('set-cookie');if(sc)cookie=sc.split(';')[0];let data=null;try{data=await res.json();}catch{}return {status:res.status,data};};
 const raw=(method,p,ck)=>fetch(base+p,{method,headers:{cookie:ck}});
 assert.equal((await call('GET','/api/state')).status,403);
 assert.equal((await call('POST','/api/enter',{body:{password:'demo-pass-123'}})).status,200);
 const sid=cookie.split('=')[1];
 const sa=(await call('GET','/api/state')).data;
 const plan=(await call('POST','/api/plans',{token:sa.token,body:{scenario:'healthy'}})).data;
 assert.ok(plan.id);
 const appr=await call('POST',`/api/plans/${plan.id}/approve`,{token:sa.token,body:{hash:plan.hash}});
 assert.equal(appr.status,202);
 const runId=appr.data.id;
 const ticket=app.runnerTickets.get(runId);
 assert.ok(ticket,'approve must issue a run-scoped ticket');
 const tk=`fp_run=${runId}:${ticket}`;
 // While the run is active the ticket opens only the fixture config read, nothing else.
 assert.equal((await raw('GET','/api/demo-config',tk)).status,200);
 assert.equal((await raw('GET','/api/state',tk)).status,403);
 assert.equal((await raw('GET',`/api/runs/${runId}`,tk)).status,403);
 assert.equal((await raw('GET',`/artifacts/${runId}/report.md`,tk)).status,403);
 assert.equal((await raw('POST','/api/plans',tk)).status,403);
 assert.equal((await raw('POST','/api/demo-config',tk)).status,403);
 for(let i=0;i<60;i++){const st=await call('GET',`/api/runs/${runId}`);if(st.status===200&&['completed','error'].includes(st.data.status))break;await new Promise(r=>setTimeout(r,1000));}
 const done=(await call('GET',`/api/runs/${runId}`)).data;
 assert.equal(done.status,'completed');
 assert.equal(done.results.filter(r=>r.status==='pass').length,8);
 // The real ticket is dead once the run slot cleared. The ticket is revoked in the
 // run's finally, which can land a moment after the status flips to completed, so
 // allow a short settle window before asserting.
 let ticketStatus=0;
 for(let i=0;i<25;i++){ticketStatus=(await raw('GET','/api/demo-config',tk)).status;if(ticketStatus===403)break;await new Promise(r=>setTimeout(r,200));}
 assert.equal(ticketStatus,403);
 // Downloadable evidence must not carry the visitor session credential. These checks fail closed.
 const report=await (await fetch(base+`/artifacts/${runId}/report.md`,{headers:{cookie}})).text();
 assert.ok(!report.includes(sid));
 const {execSync}=await import('node:child_process');
 const zip=execSync(`find ${app.artifactRoot} -name 'case-01-*.zip'`).toString().trim().split('\n')[0];
 assert.ok(zip,'suite must leave a trace zip for case 01');
 const traceText=execSync(`unzip -p ${zip}`).toString();
 assert.ok(traceText.length>0,'trace zip must decode');
 assert.ok(!traceText.includes(sid),'trace must not contain the visitor session id');
 assert.ok(traceText.includes('fp_run'),'trace carries the run-scoped ticket, dead once the run slot clears');
});

test('experiment results page serves the recorded synthetic analysis, byte-identical to the evidence fixture',async t=>{
 const app=await startPublic(t);
 const html=await (await fetch(app.origin+'/experiment/results')).text();
 assert.match(html,/FLAGPROOF \/ EXPERIMENT RESULTS/);
 assert.match(html,/experiment-results\.js/);
 const js=await (await fetch(app.origin+'/experiment-results.js')).text();
 assert.match(js,/SAVED SYNTHETIC RESULTS/);
 assert.match(js,/not a live feed/);
 assert.match(js,/not established by this record/);
 assert.match(js,/no calibrated absolute-threshold posterior/);
 const page=await (await fetch(app.origin+'/experiment/results')).text();
 assert.match(page,/Delta vs control \(relative\)/);
 assert.match(page,/95% credible interval \(relative\)/);
 assert.match(page,/WHAT THIS RECORD ESTABLISHES/);
 const servedText=await (await fetch(app.origin+'/evidence-experiment-399.json')).text();
 const fixtureText=await readFile(new URL('./fixtures/run-report-399.json',import.meta.url),'utf8');
 assert.equal(servedText,fixtureText);
 const served=JSON.parse(servedText);
 assert.equal(served.experiment.flagsmithExperimentId,399);
 assert.equal(served.analysis.variations.length,3);
 assert.equal(served.analysis.variations[0].key,'control');
 assert.equal(served.analysis.variations[0].winProbabilityPct,'<1');
 assert.match(served.label,/synthetic/i);
 assert.match(served.analysis.note,/pairwise against control/);
 const shop=await (await fetch(app.origin+'/experiment')).text();
 assert.match(shop,/\/experiment\/results/);
});
