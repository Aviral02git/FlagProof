import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,readdir} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {ExperimentProposalSchema,makeExperimentProposal,reviewExperimentProposal,generateExperimentProposal,executeExperimentProposalFixture} from '../src/experiment-plan.mjs';
import {EXPERIMENT_FLAG,EXPERIMENT_EVENT} from '../src/experiment-config.mjs';

test('experiment proposal: valid default, strict schema, weights sum to 100',()=>{
 const p=makeExperimentProposal();
 assert.equal(p.flag,EXPERIMENT_FLAG);
 assert.equal(p.metricEvent,EXPERIMENT_EVENT);
 assert.equal(p.variations.reduce((a,v)=>a+v.weightPct,0),100);
 assert.equal(p.syntheticDataNotice,true,'proposals always carry the synthetic-data notice');
 assert.throws(()=>ExperimentProposalSchema.parse({...p,flag:'other_flag'}));
 assert.throws(()=>ExperimentProposalSchema.parse({...p,extra:1}));
 assert.throws(()=>ExperimentProposalSchema.parse({...p,rolloutPct:101}));
});
test('review record carries the exact approval hash',()=>{
 const a=reviewExperimentProposal(makeExperimentProposal());
 const b=reviewExperimentProposal(makeExperimentProposal());
 assert.equal(a.hash,b.hash,'same proposal, same hash');
 assert.equal(a.status,'pending-review');
 assert.notEqual(a.id,b.id);
 const tampered=reviewExperimentProposal({...makeExperimentProposal(),hypothesis:'Different hypothesis with metric, magnitude and timeframe.'});
 assert.notEqual(tampered.hash,a.hash,'any wording change changes the hash');
});
test('generateExperimentProposal: manual template default, no ollama call without opt-in',async()=>{
 const record=await generateExperimentProposal({});
 assert.equal(record.source,'manual-template');
 assert.equal(record.proposal.kind,'experiment-proposal');
 await assert.rejects(()=>generateExperimentProposal({FLAGPROOF_PLANNER:'ollama'}),/OLLAMA_MODEL/);
});
test('fixture execution writes only an artifact, performs no network',async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'fp-exp-plan-'));
 const record=reviewExperimentProposal(makeExperimentProposal());
 const artifact=await executeExperimentProposalFixture(record,{writeFile:(n,c)=>import('node:fs/promises').then(fs=>fs.writeFile(path.join(dir,n),c))});
 assert.equal(artifact.mode,'fixture');
 assert.equal(artifact.approvedHash,record.hash);
 const files=await readdir(dir);
 assert.equal(files.length,1);
 const stored=JSON.parse(await readFile(path.join(dir,files[0]),'utf8'));
 assert.equal(stored.proposal.flag,EXPERIMENT_FLAG);
 assert.match(stored.note,/separately approved/);
 // Tampered records cannot execute: schema re-parse rejects unknown shapes.
 await assert.rejects(()=>executeExperimentProposalFixture({...record,proposal:{...record.proposal,flag:'other_flag'}},{writeFile:async()=>{}}));
});
