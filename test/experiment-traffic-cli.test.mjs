import test from 'node:test';
import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {startStubFlagsmith,bucketVariant} from './helpers/stub-flagsmith.mjs';
import {EXPERIMENT_VARIANTS,EXPERIMENT_FLAG,EXPERIMENT_EVENT} from '../src/experiment-config.mjs';
import {identityConverts} from '../src/experiment.mjs';

const execFileAsync=promisify(execFile);

// Exercises the documented command `node scripts/run-experiment-traffic.mjs 150`
// against a local stub of the Flagsmith APIs. No network, no account contact.
test('traffic CLI runs the documented positional command end to end against a stub',async()=>{
 const stub=await startStubFlagsmith();
 try{
  const env={...process.env,
   FLAGSMITH_ENVIRONMENT_KEY:'stub-env-key',
   FLAGSMITH_API_URL:stub.apiUrl,
   FLAGSMITH_EVENTS_API_URL:stub.eventsApiBase,
  };
  const {stdout,stderr}=await execFileAsync(process.execPath,['scripts/run-experiment-traffic.mjs','150'],{env,timeout:120000});
  assert.equal(stderr,'');
  // 150 identities, minimum enforced by the script (3 variants x 50).
  assert.match(stdout,new RegExp(`Simulating 150 shoppers through experiment flag "${EXPERIMENT_FLAG}"`));
  // Per-variant printed counts must match the stub's deterministic bucketing.
  const expected={};
  for(let i=1;i<=150;i++){
   const id=`shopper-sim-${String(i).padStart(4,'0')}`;
   const key=bucketVariant(id);
   expected[key]??={exposures:0,conversions:0};
   expected[key].exposures+=1;
   const rate=EXPERIMENT_VARIANTS.find(v=>v.key===key).conversionRate;
   if(identityConverts(id,key,rate))expected[key].conversions+=1;
  }
  let totalExposures=0;
  for(const v of EXPERIMENT_VARIANTS){
   const e=expected[v.key]||{exposures:0,conversions:0};
   totalExposures+=e.exposures;
   assert.match(stdout,new RegExp(`${v.key}: ${e.exposures} exposures, ${e.conversions} conversions`),`printed counts for ${v.key}`);
  }
  assert.equal(totalExposures,150);
  // Stub saw one identities call per shopper and the exposure/conversion events.
  const identityCalls=stub.requests.filter(r=>r.method==='POST'&&r.url==='/api/v1/identities/');
  assert.equal(identityCalls.length,150);
  const exposures=stub.events.filter(e=>e&&e.event==='$flag_exposure'&&e.feature_name===EXPERIMENT_FLAG);
  const conversions=stub.events.filter(e=>e&&e.event===EXPERIMENT_EVENT);
  assert.equal(exposures.length,150);
  assert.equal(conversions.length,Object.values(expected).reduce((n,e)=>n+e.conversions,0));
  // Synthetic-data reminder stays on the CLI output.
  assert.match(stdout,/synthetic/i);
 }finally{
  await stub.close();
 }
});

// The A/A plumbing check path: custom flag, two identical variations, equal
// preset rates and a distinct identity prefix, end to end against the stub.
test('traffic CLI supports the A/A options (flag, variants, rates, prefix)',async()=>{
 const twins=[{key:'twin_a'},{key:'twin_b'}];
 const stub=await startStubFlagsmith({flag:'checkout_cta_copy_aa',variants:twins});
 try{
  const env={...process.env,
   FLAGSMITH_ENVIRONMENT_KEY:'stub-env-key',
   FLAGSMITH_API_URL:stub.apiUrl,
   FLAGSMITH_EVENTS_API_URL:stub.eventsApiBase,
  };
  const {stdout,stderr}=await execFileAsync(process.execPath,['scripts/run-experiment-traffic.mjs','100','--flag','checkout_cta_copy_aa','--variants','twin_a:twin_b','--rates','0.4:0.4','--prefix','aa-sim'],{env,timeout:120000});
  assert.equal(stderr,'');
  assert.match(stdout,/Simulating 100 shoppers through experiment flag "checkout_cta_copy_aa", event "checkout_completed"/);
  const expected={twin_a:{exposures:0,conversions:0},twin_b:{exposures:0,conversions:0}};
  for(let i=1;i<=100;i++){
   const id=`aa-sim-${String(i).padStart(4,'0')}`;
   const key=bucketVariant(id,twins);
   expected[key].exposures+=1;
   if(identityConverts(id,key,0.4))expected[key].conversions+=1;
  }
  for(const key of ['twin_a','twin_b']){
   assert.match(stdout,new RegExp(`${key}: ${expected[key].exposures} exposures, ${expected[key].conversions} conversions`),`printed counts for ${key}`);
  }
  const exposures=stub.events.filter(e=>e&&e.event==='$flag_exposure'&&e.feature_name==='checkout_cta_copy_aa');
  assert.equal(exposures.length,100);
  const conversions=stub.events.filter(e=>e&&e.event==='checkout_completed');
  assert.equal(conversions.length,expected.twin_a.conversions+expected.twin_b.conversions);
  assert.match(stdout,/synthetic/i);
 }finally{
  await stub.close();
 }
});

test('traffic CLI rejects mismatched --variants and --rates',async()=>{
 const {stdout,code}=await execFileAsync(process.execPath,['scripts/run-experiment-traffic.mjs','100','--flag','x','--variants','a:b','--rates','0.4']).catch(e=>e);
 const out=typeof stdout==='string'?stdout:'';
 assert.match(out,/--rates must be probabilities/);
});
