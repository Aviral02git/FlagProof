import test from 'node:test';
import assert from 'node:assert/strict';
import {makePlan} from '../src/core.mjs';
import {generatePlan} from '../src/planner.mjs';
const env={FLAGPROOF_PLANNER:'ollama',OLLAMA_MODEL:'mock-model'};
test('mocked ollama: valid AI plan passes schema check and keeps the requested scenario',async t=>{
 const aiPlan={...makePlan('seeded-interaction'),title:'AI written title',rationale:'AI written rationale.'};
 t.mock.method(globalThis,'fetch',async()=>({ok:true,json:async()=>({response:JSON.stringify(aiPlan)})}));
 const record=await generatePlan('seeded-interaction',env);
 assert.equal(record.source,'local-ollama:mock-model');
 assert.equal(record.plan.scenario,'seeded-interaction');
 assert.equal(record.plan.title,'AI written title');
});
test('mocked ollama: schema-violating output is rejected, nothing runs',async t=>{
 t.mock.method(globalThis,'fetch',async()=>({ok:true,json:async()=>({response:'{"title":"x"}'})}));
 await assert.rejects(()=>generatePlan('seeded-interaction',env),/invalid plan/);
});
test('mocked ollama: a plan that changes the requested scenario is rejected',async t=>{
 const aiPlan=makePlan('healthy');
 t.mock.method(globalThis,'fetch',async()=>({ok:true,json:async()=>({response:JSON.stringify(aiPlan)})}));
 await assert.rejects(()=>generatePlan('seeded-interaction',env),/changed the requested fixture/);
});
test('mocked ollama: API failure throws an explicit error with no silent fallback',async t=>{
 t.mock.method(globalThis,'fetch',async()=>({ok:false,status:503}));
 await assert.rejects(()=>generatePlan('seeded-interaction',env),/no silent fallback/);
});
test('manual template path never calls the model',async t=>{
 const fetch=t.mock.method(globalThis,'fetch',async()=>{throw new Error('must not be called');});
 const record=await generatePlan('healthy',{});
 assert.equal(record.source,'manual-template');
 assert.equal(fetch.mock.callCount(),0);
});
