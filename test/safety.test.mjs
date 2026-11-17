import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {LocalFixtureAdapter,FlagsmithAdapter,equalFlags} from '../src/flags.mjs';
import {matrix,makePlan} from '../src/core.mjs';
import {runSuite} from '../src/runner.mjs';
const fakeConfig={FLAGPROOF_ALLOW_LIVE:'I_APPROVE_ISOLATED_DEMO_WRITES',FLAGSMITH_MANAGEMENT_KEY:'nonfunctional-unit-test-key',FLAGSMITH_ENVIRONMENT_KEY:'nonfunctional-unit-test-env',FLAGSMITH_FEATURE_IDS:JSON.stringify({new_checkout:1,express_shipping:2,promo_banner:3})};
test('unverified live adapter contract: strict config, server-only key and bounded PATCH shape',async t=>{
 const requests=[];const state={1:false,2:false,3:false};
 t.mock.method(globalThis,'fetch',async(url,options)=>{requests.push({url,options});const id=Number(url.match(/features\/(\d+)/)[1]);if(options.method==='PATCH')state[id]=JSON.parse(options.body).environment_default.enabled;return {ok:true,json:async()=>({environment_default:{enabled:state[id],variants:[]},segment_overrides:[]})};});
 const adapter=new FlagsmithAdapter(fakeConfig);assert.equal(JSON.stringify(adapter.publicConfig()).includes(fakeConfig.FLAGSMITH_MANAGEMENT_KEY),false);
 await adapter.set(matrix()[3]);assert.ok(equalFlags(await adapter.read(),matrix()[3]));assert.ok(requests.every(r=>r.url.startsWith('https://api.flagsmith.com/api/__future__/environments/')));assert.equal(requests.filter(r=>r.options.method==='PATCH').length,3);assert.deepEqual(JSON.parse(requests.find(r=>r.options.method==='PATCH').options.body),{environment_default:{enabled:true}});
});
test('unverified live adapter refuses variants, overrides and bad API responses',async t=>{
 let payload={environment_default:{enabled:true,variants:[{id:1}]},segment_overrides:[]};
 const fetch=t.mock.method(globalThis,'fetch',async()=>({ok:true,json:async()=>payload}));const adapter=new FlagsmithAdapter(fakeConfig);await assert.rejects(()=>adapter.read(),/plain boolean/);
 payload={environment_default:{enabled:true,variants:[]},segment_overrides:[{segment:{id:1}}]};await assert.rejects(()=>adapter.read(),/plain boolean/);
 fetch.mock.mockImplementation(async()=>({ok:false,status:429}));await assert.rejects(()=>adapter.read(),/429/);
});
function run(){return {id:crypto.randomUUID(),plan:makePlan(),planSource:'manual-template',mode:'local-fixture',results:[]};}
test('invalid setup stops the matrix and still restores the original local state',{timeout:30000},async()=>{
 class FailOnce extends LocalFixtureAdapter{calls=0;async set(next){if(++this.calls===1){this.state={...next,new_checkout:true};throw new Error('Injected partial write');}return super.set(next);}}
 const adapter=new FailOnce(),original=await adapter.read();const artifactRoot=await mkdtemp(path.join(os.tmpdir(),'flagproof-fault-'));const record=run();await runSuite(record,{adapter,origin:'http://127.0.0.1:1',artifactRoot});assert.equal(record.status,'error');assert.equal(record.results.length,1);assert.equal(record.results[0].setup,'invalid');assert.equal(record.summary.allPassed,false);assert.equal(record.cleanup.status,'verified');assert.ok(equalFlags(await adapter.read(),original));
});
test('failed cleanup is explicit and overrides any completed status',{timeout:30000},async()=>{
 class CannotRestore extends LocalFixtureAdapter{calls=0;async set(next){this.calls++;if(this.calls>1)throw new Error('Injected restore refusal');return super.set(next);}}
 const adapter=new CannotRestore();const artifactRoot=await mkdtemp(path.join(os.tmpdir(),'flagproof-fault-'));const record=run();await runSuite(record,{adapter,origin:'http://127.0.0.1:1',artifactRoot});assert.equal(record.status,'error');assert.equal(record.cleanup.status,'failed');assert.match(record.cleanup.error,/restore refusal/);const report=JSON.parse(await readFile(path.join(artifactRoot,record.id,'report.json')));assert.equal(report.cleanup.status,'failed');assert.equal(report.summary.allPassed,false);
});
