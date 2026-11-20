import {FlagState,FLAG_NAMES} from './core.mjs';
import {setTimeout as delay} from 'node:timers/promises';
export class LocalFixtureAdapter {
 constructor(){this.mode='local-fixture';this.label='LOCAL FIXTURE · not Flagsmith';this.state=Object.fromEntries(FLAG_NAMES.map(n=>[n,false]));}
 async read(){return {...this.state};}
 async set(next){this.state=FlagState.parse(next);return this.read();}
 publicConfig(){return {mode:this.mode,label:this.label};}
}
// Uses documented experimental endpoints. Verified on the approved isolated demo in Nov 2026.
// That verification does not make this a transactional or production-safe adapter.
// This adapter is deliberately opt-in and supports only plain boolean flags without overrides/variants.
export class FlagsmithAdapter {
 constructor(env=process.env){
  if(env.FLAGPROOF_ALLOW_LIVE!=='I_APPROVE_ISOLATED_DEMO_WRITES')throw new Error('Live writes require explicit isolated-demo opt-in. Read README first.');
  this.mode='flagsmith';this.label='FLAGSMITH API + SDK · isolated demo';
  this.key=env.FLAGSMITH_MANAGEMENT_KEY;this.environment=env.FLAGSMITH_ENVIRONMENT_KEY;
  try{this.ids=JSON.parse(env.FLAGSMITH_FEATURE_IDS||'{}');}catch{throw new Error('Invalid feature ID configuration');}
  if(!this.key||!this.environment||!FLAG_NAMES.every(n=>Number.isInteger(this.ids[n])&&this.ids[n]>0))throw new Error('Flagsmith keys or feature IDs missing. Never put management keys in the browser.');
 }
 publicConfig(){return {mode:this.mode,label:this.label,environmentID:this.environment,api:'https://edge.api.flagsmith.com/api/v1/'};}
 async request(name,method='GET',enabled){
  const url=`https://api.flagsmith.com/api/__future__/environments/${encodeURIComponent(this.environment)}/features/${this.ids[name]}/`;
  const response=await fetch(url,{method,headers:{Authorization:`Api-Key ${this.key}`,'Content-Type':'application/json'},body:method==='PATCH'?JSON.stringify({environment_default:{enabled}}):undefined,signal:AbortSignal.timeout(10000)});
  if(!response.ok)throw new Error(`Flagsmith ${method} failed (${response.status}); inspect account configuration separately.`);
  const data=await response.json();
  if(typeof data?.environment_default?.enabled!=='boolean'||(data.segment_overrides?.length||0)>0||(data.environment_default.variants?.length||0)>0)throw new Error('Only plain boolean flags with no variants/overrides are supported.');
  return data.environment_default.enabled;
 }
 async read(){const entries=await Promise.all(FLAG_NAMES.map(async n=>[n,await this.request(n)]));return FlagState.parse(Object.fromEntries(entries));}
 async set(next){const valid=FlagState.parse(next);await this.read();for(const n of FLAG_NAMES)await this.request(n,'PATCH',valid[n]);return this.read();}
}
export function createAdapter(){return process.env.FLAGPROOF_PUBLIC==='1'?new LocalFixtureAdapter():process.env.FLAGPROOF_MODE==='flagsmith'?new FlagsmithAdapter():new LocalFixtureAdapter();}
export function equalFlags(a,b){return FLAG_NAMES.every(n=>a?.[n]===b?.[n]);}
export async function waitFlags(read,expected,{attempts=20,interval=150}={}){for(let i=0;i<attempts;i++){const current=await read();if(equalFlags(current,expected))return current;await delay(interval);}throw new Error('Requested flag state did not resolve before timeout.');}
