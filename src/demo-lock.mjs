import {randomBytes} from 'node:crypto';
import {readFileSync,writeFileSync,renameSync,existsSync,mkdirSync} from 'node:fs';
import path from 'node:path';
// Serialized-demo controls for a shared Flagsmith demo environment. NOT wired into public mode and not public-ready until
// integration proof exists. Nothing here contacts Flagsmith by itself.
// Why: Flagsmith allows one active experiment per flag per environment, so a shared demo runs one visitor at a time.
// State is a durable file (survives restart). A corrupt or unwritable file FAILS CLOSED: nobody can acquire.
// Destructive scope: only experiment ids this server recorded in its own ledger AND that sit in the exact configured
// environment and flag. Names and ages never grant deletion rights. Foreign ids are refused.
export function createDemoLock({stateFile,scope,now=Date.now,leaseMs=600000,dailyCap=20,perOwnerCooldownMs=300000}){
 if(!stateFile||!scope||!scope.environment||!scope.flag)throw new Error('stateFile and scope {environment, flag} are required');
 let broken=null;
 function load(){
  if(!existsSync(stateFile))return {day:'',count:0,holder:null,pending:[],ledger:[],last:{},uncertain:false};
  try{const s=JSON.parse(readFileSync(stateFile,'utf8'));if(!s||typeof s!=='object'||!Array.isArray(s.pending)||!Array.isArray(s.ledger))throw new Error('shape');return s;}
  catch(e){broken='state file unreadable';return null;}
 }
 function save(s){
  try{mkdirSync(path.dirname(stateFile),{recursive:true});const tmp=stateFile+'.tmp';writeFileSync(tmp,JSON.stringify(s));renameSync(tmp,stateFile);return true;}
  catch(e){broken='state file unwritable';return false;}
 }
 const day=()=>new Date(now()).toISOString().slice(0,10);
 const closed=reason=>({ok:false,reason,retryAfterSec:60});
 // An expired lease is never simply freed: if it recorded a resource, that resource goes to pending cleanup first.
 function settleExpiry(s){
  if(s.holder&&now()>=s.holder.expiresAt){
   for(const id of s.holder.experimentIds||[])if(!s.pending.includes(id))s.pending.push(id);
   s.holder=null;
  }
 }
 return {
  tryAcquire(owner){
   const s=load();if(!s)return closed('state-unavailable');
   settleExpiry(s);
   if(s.day!==day()){s.day=day();s.count=0;}
   let out;
   if(s.holder&&s.holder.owner===owner)out={ok:true,reused:true,token:s.holder.token,expiresAt:s.holder.expiresAt};
   else if(s.holder)out={ok:false,reason:'busy',retryAfterSec:Math.ceil((s.holder.expiresAt-now())/1000)};
   else if(s.pending.length||s.uncertain)out={ok:false,reason:'cleanup-pending',retryAfterSec:30};
   else if(now()-(s.last[owner]||0)<perOwnerCooldownMs)out={ok:false,reason:'cooldown',retryAfterSec:Math.ceil((perOwnerCooldownMs-(now()-s.last[owner]))/1000)};
   else if(s.count>=dailyCap)out={ok:false,reason:'daily-cap',retryAfterSec:3600};
   else{s.count++;s.last[owner]=now();s.holder={owner,token:randomBytes(12).toString('hex'),startedAt:now(),expiresAt:now()+leaseMs,experimentIds:[]};out={ok:true,token:s.holder.token,expiresAt:s.holder.expiresAt};}
   if(!save(s))return closed('state-unavailable');
   return out;
  },
  // Fencing: a stale owner whose lease expired (or was replaced) is refused. Its token no longer matches.
  holds(owner,token){const s=load();if(!s)return false;return Boolean(s.holder&&s.holder.owner===owner&&s.holder.token===token&&now()<s.holder.expiresAt);},
  recordExperiment(owner,token,experimentId){
   const s=load();if(!s)return false;
   if(!(s.holder&&s.holder.owner===owner&&s.holder.token===token&&now()<s.holder.expiresAt))return false;
   s.holder.experimentIds.push(experimentId);if(!s.ledger.includes(experimentId))s.ledger.push(experimentId);
   return save(s);
  },
  // A resource created after the lease was lost still belongs to this server: ledger + pending, so cleanup removes it and nobody starts a run on top of it.
  adoptOrphan(experimentId){const s=load();if(!s)return false;if(!s.ledger.includes(experimentId))s.ledger.push(experimentId);if(!s.pending.includes(experimentId))s.pending.push(experimentId);return save(s);},
  // Release only by the matching owner AND token. If a resource was created, it goes to pending cleanup, not straight to free.
  release(owner,token,{uncertain=false}={}){
   const s=load();if(!s)return {ok:false,reason:'state-unavailable'};
   if(!(s.holder&&s.holder.owner===owner&&s.holder.token===token))return {ok:false,reason:'not-holder'};
   for(const id of s.holder.experimentIds)if(!s.pending.includes(id))s.pending.push(id);
   if(uncertain)s.uncertain=true;// a failed create/start may have left a resource we have no id for: block until a listing reconciles it
   s.holder=null;return save(s)?{ok:true,pending:s.pending.length}:{ok:false,reason:'state-unavailable'};
  },
  // Heartbeat during in-flight side effects. Only the current holder, only while the lease is valid, capped at 3x the lease from acquisition.
  renew(owner,token){
   const s=load();if(!s)return false;const h=s.holder;
   if(!(h&&h.owner===owner&&h.token===token&&now()<h.expiresAt))return false;
   h.expiresAt=Math.min(now()+leaseMs,(h.startedAt||now())+3*leaseMs);return save(s);
  },
  // Scope gate for any destructive call: exact environment and flag, and an id this server recorded.
  inScope(exp){
   const s=load();if(!s)return false;
   return Boolean(exp&&s.ledger.includes(exp.id)&&String(exp.environment_key??exp.environment)===String(scope.environment)&&String(exp.feature_name??exp.flag)===String(scope.flag));
  },
  // adapter: {get(id)->experiment|null, complete(id), remove(id)}. Foreign or out-of-scope ids are dropped from pending, never touched.
  async cleanup(adapter){
   const s=load();if(!s)return {ok:false,reason:'state-unavailable'};
   settleExpiry(s);
   const done=[],refused=[],failed=[];
   let listed=true;
   if(s.uncertain){
    // Reconcile: every active experiment on the demo flag in the demo environment is by definition this demo's (the scope is the dedicated demo flag).
    try{for(const e of await adapter.listActive()){if(String(e.environment_key??e.environment)===String(scope.environment)&&String(e.feature_name??e.flag)===String(scope.flag)){if(!s.ledger.includes(e.id))s.ledger.push(e.id);if(!s.pending.includes(e.id))s.pending.push(e.id);}}}
    catch(e){listed=false;}
   }
   for(const id of [...s.pending]){
    let exp;try{exp=await adapter.get(id);}catch(e){failed.push(id);continue;}
    if(!exp){s.pending=s.pending.filter(x=>x!==id);done.push(id);continue;}
    if(!(s.ledger.includes(exp.id)&&String(exp.environment_key??exp.environment)===String(scope.environment)&&String(exp.feature_name??exp.flag)===String(scope.flag))){s.pending=s.pending.filter(x=>x!==id);refused.push(id);continue;}
    try{await adapter.complete(id);await adapter.remove(id);s.pending=s.pending.filter(x=>x!==id);done.push(id);}catch(e){failed.push(id);}
   }
   if(s.uncertain&&listed&&failed.length===0)s.uncertain=false;
   save(s);return {ok:failed.length===0&&listed,done,refused,failed};
  },
  status(){const s=load();if(!s)return {failClosed:true,reason:broken};settleExpiry(s);return {busy:Boolean(s.holder),uncertain:Boolean(s.uncertain),pending:s.pending.length,dailyUsed:s.day===day()?s.count:0,dailyCap};},
 };
}
