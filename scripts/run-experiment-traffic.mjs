import {Flagsmith} from '@flagsmith/nodejs';
import {loadDotEnv} from '../src/env.mjs';
import {runExperimentTraffic,EXPERIMENT_FLAG,EXPERIMENT_EVENT,EXPERIMENT_VARIANTS} from '../src/experiment.mjs';

// Sends simulated experiment traffic to the real Flagsmith environment named in
// .env (FLAGSMITH_ENVIRONMENT_KEY). Identities are synthetic
// (shopper-sim-0001 style); exposures and conversion events are the documented
// getExperimentFlag/trackEvent SDK calls. The environment key is never printed.
//
// Usage: node scripts/run-experiment-traffic.mjs [identityCount] [options]
//   --flag NAME        experiment flag (default: the Track-01 checkout flag)
//   --event NAME       conversion event (default: checkout_completed)
//   --variants a:b     variation keys (default: control:buy_now:get_it_today)
//   --rates x:y        preset conversion probabilities, same order as --variants
//                      (default: the Track-01 fixture rates)
//   --prefix P         identity prefix (default: shopper-sim)
// The A/A plumbing check uses: --flag <aa flag> --variants twin_a:twin_b
// --rates 0.4:0.4 --prefix aa-sim, with identical preset rates on both arms.

await loadDotEnv();
const environment=process.env.FLAGSMITH_ENVIRONMENT_KEY;
if(!environment){console.log('FLAGSMITH_ENVIRONMENT_KEY missing. Run npm run setup:flagsmith first.');process.exitCode=1;process.exit();}

const args=process.argv.slice(2);
const positional=args.filter(a=>!a.startsWith('--'));
const option=name=>{const i=args.indexOf(name);return i===-1?undefined:args[i+1];};
const flag=option('--flag')||EXPERIMENT_FLAG;
const event=option('--event')||EXPERIMENT_EVENT;
const variantKeys=(option('--variants')||EXPERIMENT_VARIANTS.map(v=>v.key).join(':')).split(':');
const ratesRaw=option('--rates');
const ratesList=ratesRaw?ratesRaw.split(':').map(Number):EXPERIMENT_VARIANTS.map(v=>v.conversionRate);
if(variantKeys.length<2||variantKeys.some(k=>!k)){console.log('Need at least two non-empty variation keys.');process.exitCode=1;process.exit();}
if(ratesList.length!==variantKeys.length||ratesList.some(r=>!Number.isFinite(r)||r<0||r>1)){console.log('--rates must be probabilities, one per variation, in the same order.');process.exitCode=1;process.exit();}
const variants=variantKeys.map(key=>({key}));
const rates=Object.fromEntries(variantKeys.map((k,i)=>[k,ratesList[i]]));
const prefix=option('--prefix')||'shopper-sim';
const total=Math.max(variantKeys.length*50,Number(positional[0]||450));

// Self-hosted Flagsmith: set FLAGSMITH_API_URL (ends /api/v1/) and
// FLAGSMITH_EVENTS_API_URL (e.g. http://localhost:8000/api/ when the
// warehouse is the Flagsmith database; the SDK appends v1/events itself). Both default to Flagsmith Cloud.
const apiUrl=process.env.FLAGSMITH_API_URL;
const eventsApiUrl=process.env.FLAGSMITH_EVENTS_API_URL;
const client=new Flagsmith({environmentKey:environment,enableEvents:true,...(apiUrl?{apiUrl}:{}),...(eventsApiUrl?{eventProcessorConfig:{eventsApiUrl}}:{})});
const identities=Array.from({length:total},(_,i)=>`${prefix}-${String(i+1).padStart(4,'0')}`);
console.log(`Simulating ${total} shoppers through experiment flag "${flag}", event "${event}".`);
let done=0;
const counts=await runExperimentTraffic({client,identities,flag,event,variants,rates,onProgress:()=>{if(++done%50===0)console.log(`  ${done}/${total} shoppers processed`);}});
await client.close();
console.log('Done. Per-variant counts (synthetic demo fixtures, before Flagsmith-side aggregation):');
for(const [key,c] of Object.entries(counts))console.log(`  ${key}: ${c.exposures} exposures, ${c.conversions} conversions`);
console.log('Open the experiment in the Flagsmith dashboard and choose Refresh results to read lift, credible intervals and win probability.');
console.log('Reminder: these visitors are synthetic with preset conversion probabilities. Any winner the dashboard reports reflects the fixture rates, not real user behavior. Label every screenshot and README claim as synthetic demo data.');
