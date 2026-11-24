import {test} from 'node:test';
import assert from 'node:assert/strict';
import {EXPERIMENT_FLAG,EXPERIMENT_EVENT,EXPERIMENT_VARIANTS,EXPERIMENT_HYPOTHESIS,identityConverts,variantByKey,runExperimentTraffic} from '../src/experiment.mjs';

test('experiment config: distinct labeled variations with valid conversion rates',()=>{
 const keys=EXPERIMENT_VARIANTS.map(v=>v.key);
 assert.equal(new Set(keys).size,keys.length);
 for(const v of EXPERIMENT_VARIANTS){
  assert.ok(v.key&&v.label&&v.copy,'every variation needs a key, label and copy');
  assert.ok(v.conversionRate>0&&v.conversionRate<1,'conversion rate must be a probability');
 }
 assert.ok(keys.includes('control'),'a control variation is required');
});
test('hypothesis names the change, metric, magnitude and timeframe',()=>{
 assert.match(EXPERIMENT_HYPOTHESIS,/Buy now/);
 assert.match(EXPERIMENT_HYPOTHESIS,/checkout completion/);
 assert.match(EXPERIMENT_HYPOTHESIS,/percentage points/);
 assert.match(EXPERIMENT_HYPOTHESIS,/window/);
});
test('identityConverts is deterministic, keyed per variation and bounded by the rate',()=>{
 assert.equal(identityConverts('shopper-sim-0001','control',0.5),identityConverts('shopper-sim-0001','control',0.5));
 // The variant key feeds the hash, so assignments are not copy-paste correlated.
 const differs=Array.from({length:200},(_,i)=>`k-${i}`).some(id=>identityConverts(id,'control',0.5)!==identityConverts(id,'buy_now',0.5));
 assert.ok(differs,'variation key must feed the hash');
 assert.equal(identityConverts('anyone','control',0),false);
 assert.equal(identityConverts('anyone','control',1),true);
 assert.throws(()=>identityConverts('x','control',1.5),/probability/);
 // Rough calibration: 0.5 rate lands within 35-65% over 2000 identities.
 let hits=0;for(let i=0;i<2000;i++)if(identityConverts(`cal-${i}`,'control',0.5))hits++;
 assert.ok(hits>700&&hits<1300,`calibration off: ${hits}`);
});
test('variantByKey rejects unknown variations',()=>{
 assert.equal(variantByKey('control').copy,'Checkout');
 assert.throws(()=>variantByKey('nope'),/unknown experiment variation/);
});
test('runExperimentTraffic: exposure before conversion, one exposure per identity, final flush, exact event name',async()=>{
 const calls=[];
 const assignments=['control','buy_now','get_it_today'];
 const client={
  async getExperimentFlag(name,identity){calls.push(['exposure',name,identity]);return {variant:assignments[calls.filter(c=>c[0]==='exposure').length%3]};},
  async trackEvent(name,opts){calls.push(['conversion',name,opts.identifier,opts.value]);},
  async flushEvents(){calls.push(['flush']);}
 };
 const identities=Array.from({length:60},(_,i)=>`shop-${i}`);
 const counts=await runExperimentTraffic({client,identities,rates:{control:1,buy_now:0,get_it_today:1}});
 const exposures=calls.filter(c=>c[0]==='exposure');
 assert.equal(exposures.length,60,'one exposure call per identity');
 assert.ok(exposures.every(c=>c[1]===EXPERIMENT_FLAG),'exposures use the experiment flag');
 const conversions=calls.filter(c=>c[0]==='conversion');
 assert.ok(conversions.every(c=>c[1]===EXPERIMENT_EVENT),'conversions use the exact metric event name');
 assert.ok(conversions.every(c=>c[3]===100),'conversions carry the order value');
 // Every conversion follows that identity's exposure in the call order.
 const firstSeen=new Map();let order=0;
 for(const c of calls){if(c[0]==='exposure'&&!firstSeen.has(c[2]))firstSeen.set(c[2],order);if(c[0]==='conversion')assert.ok(firstSeen.get(c[2])<order,'conversion precedes its exposure');order++;}
 assert.equal(calls.at(-1)[0],'flush','events are flushed at the end');
 assert.equal(counts.control.conversions,counts.control.exposures,'rate 1 converts everyone');
 assert.equal(counts.buy_now.conversions,0,'rate 0 converts nobody');
 assert.equal(counts.control.exposures+counts.buy_now.exposures+counts.get_it_today.exposures,60);
});
test('self-hosted path: publicConfig and traffic client honor FLAGSMITH_API_URL / FLAGSMITH_EVENTS_API_URL',async()=>{
 const {FlagsmithAdapter}=await import('../src/flags.mjs');
 const adapter=new FlagsmithAdapter({FLAGPROOF_ALLOW_LIVE:'I_APPROVE_ISOLATED_DEMO_WRITES',FLAGSMITH_MANAGEMENT_KEY:'k',FLAGSMITH_ENVIRONMENT_KEY:'e',FLAGSMITH_FEATURE_IDS:JSON.stringify({new_checkout:1,express_shipping:2,promo_banner:3})});
 assert.equal(adapter.publicConfig().api,'https://edge.api.flagsmith.com/api/v1/','cloud is the default');
 process.env.FLAGSMITH_API_URL='http://localhost:8000/api/v1/';
 try{assert.equal(adapter.publicConfig().api,'http://localhost:8000/api/v1/','self-hosted URL overrides');}
 finally{delete process.env.FLAGSMITH_API_URL;}
 const script=await import('node:fs/promises').then(fs=>fs.readFile(new URL('../scripts/run-experiment-traffic.mjs',import.meta.url),'utf8'));
 assert.match(script,/eventProcessorConfig/,'traffic script supports a self-hosted events URL');
});

test('runExperimentTraffic: custom flag, event and two identical A/A variations',async()=>{
 const calls=[];
 const twins=[{key:'twin_a'},{key:'twin_b'}];
 const client={
  async getExperimentFlag(name,identity){calls.push(['exposure',name,identity]);return {variant:identity.endsWith('0')?'twin_b':'twin_a'};},
  async trackEvent(name,opts){calls.push(['conversion',name,opts.identifier]);},
  async flushEvents(){calls.push(['flush']);}
 };
 const identities=Array.from({length:20},(_,i)=>`aa-${i}`);
 const counts=await runExperimentTraffic({client,identities,flag:'checkout_cta_copy_aa',event:'checkout_completed',variants:twins,rates:{twin_a:1,twin_b:1}});
 assert.ok(calls.filter(c=>c[0]==='exposure').every(c=>c[1]==='checkout_cta_copy_aa'),'exposures use the custom flag');
 assert.ok(calls.filter(c=>c[0]==='conversion').every(c=>c[1]==='checkout_completed'),'conversions use the custom event');
 assert.equal(counts.twin_a.exposures+counts.twin_b.exposures,20);
 assert.equal(counts.twin_a.conversions,counts.twin_a.exposures,'rate 1 converts everyone on twin_a');
 assert.equal(counts.twin_b.conversions,counts.twin_b.exposures,'rate 1 converts everyone on twin_b');
});

test('runExperimentTraffic: rejects a variation outside the provided set',async()=>{
 const client={async getExperimentFlag(){return {variant:'stranger'};},async trackEvent(){},async flushEvents(){}};
 await assert.rejects(()=>runExperimentTraffic({client,identities:['x-1'],variants:[{key:'twin_a'},{key:'twin_b'}],rates:{twin_a:0.4,twin_b:0.4}}),/unknown experiment variation: stranger/);
});
