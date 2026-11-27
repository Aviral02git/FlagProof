import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {generateExperimentProposal,makeExperimentProposal} from '../src/experiment-plan.mjs';
const ignored=new Set(readFileSync(new URL('../.dockerignore',import.meta.url),'utf8').split('\n').map(l=>l.trim()).filter(Boolean));
test('the Docker build context ships every file the hosted server spawns or imports',()=>{
 for(const f of ['scripts','src','package.json','package-lock.json','Dockerfile'])assert.equal(ignored.has(f),false,`${f} must not be in .dockerignore`);
 assert.equal(existsSync(new URL('../scripts/run-experiment-traffic.mjs',import.meta.url)),true);
});
test('an empty request with an AI planner uses the fixed template and makes no model call',async()=>{
 const orig=globalThis.fetch;let calls=0;globalThis.fetch=async()=>{calls++;throw new Error('model must not be called');};
 try{for(const env of [{FLAGPROOF_PLANNER:'ollama',OLLAMA_MODEL:'m'},{FLAGPROOF_PLANNER:'openai',PLANNER_API_URL:'https://x.example/v1',PLANNER_API_KEY:'k',PLANNER_MODEL:'m'}])
  for(const request of [undefined,'','   ']){const r=await generateExperimentProposal(env,{request});
   assert.equal(calls,0);assert.deepEqual(r.proposal.variations.map(v=>v.weightPct),makeExperimentProposal().variations.map(v=>v.weightPct));
   assert.equal(r.proposal.rolloutPct,makeExperimentProposal().rolloutPct);assert.equal(r.source,'manual-template');}}
 finally{globalThis.fetch=orig;}
});
