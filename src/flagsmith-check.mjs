import {FLAG_NAMES} from './core.mjs';
import {flagsmithHosts} from './hosts.mjs';

// Verification logic for a real Flagsmith environment, separated from the
// interactive setup wrapper so tests can inject fetch and a target directory.
// Throws Error with a user-readable message on any check failure.


export async function verifyFlagsmithEnvironment({environment,management,fetchFn=fetch,env=process.env}){
 const {flagsUrl:EDGE,environmentsUrl:ADMIN}=flagsmithHosts(env);
 if(!environment||!management)throw new Error('Both keys are required.');
 let featureIds={};
 let res;
 try{
  res=await fetchFn(EDGE,{headers:{'X-Environment-Key':environment},signal:AbortSignal.timeout(10000)});
 }catch(error){throw new Error(`environment key check could not reach Flagsmith: ${error.message}`);}
 if(!res.ok)throw new Error(`environment key check failed: edge API answered ${res.status}${res.status===401||res.status===404?' - check the environment key':''}`);
 const flags=await res.json();
 for(const f of flags)if(FLAG_NAMES.includes(f?.feature?.name)&&Number.isInteger(f.feature.id)&&f.feature.id>0)featureIds[f.feature.name]=f.feature.id;
 const missing=FLAG_NAMES.filter(n=>!(n in featureIds));
 if(missing.length)throw new Error(`missing flags in this environment: ${missing.join(', ')} - create them as plain boolean flags (default OFF, no variants, no segment overrides) in the dashboard, then re-run`);
 for(const name of FLAG_NAMES){
  let data;
  try{
   const r=await fetchFn(`${ADMIN}/${encodeURIComponent(environment)}/features/${featureIds[name]}/`,{headers:{Authorization:`Api-Key ${management}`},signal:AbortSignal.timeout(10000)});
   if(!r.ok)throw new Error(`status ${r.status}${r.status===401||r.status===403?' - check the management key and its environment access':''}`);
   data=await r.json();
  }catch(error){throw new Error(`management key check failed on "${name}": ${error.message}`);}
  if(typeof data?.environment_default?.enabled!=='boolean')throw new Error(`management key check failed on "${name}": unexpected shape`);
  if((data.segment_overrides?.length||0)>0)throw new Error(`"${name}" has segment overrides; FlagProof supports plain booleans only`);
  if((data.environment_default.variants?.length||0)>0)throw new Error(`"${name}" has variants; FlagProof supports plain booleans only`);
 }
 return {featureIds};
}

export function envFileContents({environment,management,featureIds}){
 return [
  '# FlagProof local configuration. Gitignored - never commit.',
  'FLAGPROOF_MODE=flagsmith',
  'FLAGPROOF_ALLOW_LIVE=I_APPROVE_ISOLATED_DEMO_WRITES',
  `FLAGSMITH_ENVIRONMENT_KEY=${environment}`,
  `FLAGSMITH_MANAGEMENT_KEY=${management}`,
  `FLAGSMITH_FEATURE_IDS=${JSON.stringify(featureIds)}`,
  '',
 ].join('\n');
}
