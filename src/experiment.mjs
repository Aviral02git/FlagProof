import {createHash} from 'node:crypto';
import {EXPERIMENT_FLAG,EXPERIMENT_EVENT,EXPERIMENT_VARIANTS} from './experiment-config.mjs';
export {EXPERIMENT_FLAG,EXPERIMENT_EVENT,EXPERIMENT_VARIANTS,EXPERIMENT_HYPOTHESIS,variantByKey} from './experiment-config.mjs';
// Deterministic per-identity conversion so simulations are reproducible in
// tests and reruns: an identity converts if its keyed hash beats the variant rate.
export function identityConverts(identity,variantKey,rate){
 if(!Number.isFinite(rate)||rate<0||rate>1)throw new Error('conversion rate must be a probability');
 const h=createHash('sha256').update(`${variantKey}:${identity}`).digest();
 return h.readUInt32BE(0)/0xffffffff<rate;
}

// Runs simulated shoppers through an experiment against an injected SDK-like
// client. Order matters: exposure first, conversion only after exposure, then a
// final flush. Returns counts per variation for reporting. Flag, event and
// variants default to the Track-01 checkout experiment; the A/A plumbing check
// passes its own flag, identical variations and equal rates.
export async function runExperimentTraffic({client,identities,flag=EXPERIMENT_FLAG,event=EXPERIMENT_EVENT,variants=EXPERIMENT_VARIANTS,rates=Object.fromEntries(variants.map(v=>[v.key,v.conversionRate])),onProgress=()=>{},shouldContinue=()=>true}){
 const counts=Object.fromEntries(variants.map(v=>[v.key,{exposures:0,conversions:0}]));
 for(const identity of identities){
  if(!(await shouldContinue()))throw new Error('Traffic stopped: ownership of the demo run was lost.');// send-boundary fence, checked before every request
  const f=await client.getExperimentFlag(flag,identity);
  const key=f?.variant||f?.value||variants[0].key;
  if(!variants.some(v=>v.key===key))throw new Error(`unknown experiment variation: ${key}`);
  counts[key].exposures+=1;
  if(identityConverts(identity,key,rates[key])){
   await client.trackEvent(event,{identifier:identity,value:100});
   counts[key].conversions+=1;
  }
  onProgress({identity,variant:key});
 }
 await client.flushEvents?.();
 return counts;
}
