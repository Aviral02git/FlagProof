import {randomUUID} from 'node:crypto';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fingerprint} from './core.mjs';
import {generateExperimentProposal,executeExperimentProposalFixture,plannerConfigured,makeExperimentProposal,ExperimentProposalSchema} from './experiment-plan.mjs';
import {executeExperimentProposalApi} from './experiment-execute.mjs';
import {flagsmithHosts,managementBase} from './hosts.mjs';
import {attachTrafficFence} from './traffic-fence.mjs';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';

// Track 02 product flow behind the UI: request -> agent proposal -> human approval of the exact hash -> execution -> plain-language result.
// Public (hosted) mode can only reach the fixture executor, by design. Live Flagsmith execution needs a local, non-public
// run with FLAGPROOF_MODE=flagsmith and a management key; the hosted site never holds that key.
const PROPOSAL_CAP_PER_SESSION=6, PLANNER_COOLDOWN_MS=8000, PLANNER_DAILY_CAP=150;

// Live execution on the PUBLIC site needs ALL of: FLAGPROOF_PUBLIC_LIVE=1, the durable gate AND the ledger present (guarded), and a Flagsmith Cloud target (not self-hosted).
// Anything missing leaves the public site on the fixture, so a half-configured deploy fails closed to fixture mode.
export function describeExecutor({publicMode,env=process.env,guarded=false}){
 const publicLiveOk=!publicMode||(env.FLAGPROOF_PUBLIC_LIVE==='1'&&guarded&&!flagsmithHosts(env).selfHosted);
 const live=publicLiveOk&&env.FLAGPROOF_EXPERIMENT_EXECUTOR==='flagsmith'&&env.FLAGSMITH_MANAGEMENT_KEY&&env.FLAGSMITH_ENVIRONMENT_KEY;
 if(live){const h=flagsmithHosts(env);return {kind:'flagsmith-api',label:h.selfHosted?`Self-hosted Flagsmith (${h.origin})`:'Live Flagsmith Cloud demo project, synthetic visitors',live:true,startAllowed:true,measure:env.FLAGPROOF_EXPERIMENT_MEASURE==='1'};}
 return {kind:'fixture',label:publicMode?'Hosted demo: recorded as a fixture artifact, no Flagsmith contact':'Local fixture: recorded as an artifact, no Flagsmith contact',live:false,startAllowed:false,measure:false};
}
export function explainProposal(proposal,baseline=makeExperimentProposal()){
 const split=proposal.variations.map(v=>`${v.key} ${v.weightPct}%`).join(', ');
 const rows=[];
 const add=(field,from,to)=>rows.push({field,from,to,changed:String(from)!==String(to)});
 add('Name',baseline.name,proposal.name);add('Hypothesis',baseline.hypothesis,proposal.hypothesis);
 add('Traffic split',baseline.variations.map(v=>v.weightPct).join('/'),proposal.variations.map(v=>v.weightPct).join('/'));
 add('Visitors entering the experiment',`${baseline.rolloutPct}%`,`${proposal.rolloutPct}%`);
 return {rows,summary:`Flag ${proposal.flag} would be tested with ${split}. ${proposal.rolloutPct}% of visitors enter the experiment; the rest keep the default. Success metric: ${proposal.metricEvent} (occurrence).`};
}
export function describeResult(artifact,executor,measuredTotal=0){
 const p=artifact.proposal;
 const base=`Approved: ${p.name}. ${p.variations.map(v=>`${v.key} ${v.weightPct}%`).join(' / ')}, ${p.rolloutPct}% of visitors enter.`;
 if(artifact.mode==='flagsmith-api'&&measuredTotal)return `${base} Created as experiment ${artifact.experimentId} and started (${executor.label}). Flagsmith's analysis below was computed from ${measuredTotal} labelled synthetic visitors. No winner is claimed.`;
 if(artifact.mode==='flagsmith-api')return `${base} Created as experiment ${artifact.experimentId}${artifact.started?' and started':', not started'} (${executor.label}). Nothing is measured yet: results appear only after visitors (or labelled synthetic traffic) hit the flag, and Flagsmith's Bayesian analysis needs enough exposures. No winner is claimed.`;
 return `${base} Recorded as a fixture artifact. No Flagsmith project was contacted, so there is no experiment and no result.`;
}

export function summariseAnalysis(results){
 const m=results?.results?.payload?.metrics?.[0];if(!m)return {ready:false,text:'Flagsmith returned no analysis yet.',rows:[]};
 const rows=Object.entries(m.variants||{}).map(([key,v])=>{const inf=m.inference?.[key];
  return {key,exposures:v.n,conversions:v.sum,rate:v.n?v.sum/v.n:null,lift:inf?inf.lift:null,ciLow:inf?inf.ci_low:null,ciHigh:inf?inf.ci_high:null,win:inf?inf.chance_to_win:null};});
 const hasInf=rows.some(r=>r.lift!==null);
 const total=rows.reduce((n,r)=>n+r.exposures,0);
 return {ready:true,total,hasInference:hasInf,rows,text:hasInf?`Flagsmith's Bayesian analysis on ${total} synthetic visitors. Lift and win probability are by construction of the preset conversion rates, not evidence about real customers. The pre-registered 10-point absolute threshold cannot be judged from relative intervals.`:`${total} synthetic visitors entered. Flagsmith has not produced lift or win-probability estimates yet (inference is empty), so no winner is claimed.`};
}
// ONE function sets both the reservation and the enforced worker ceiling: only rolloutPct of visitors enter, so more identities are sent to reach about 300 entrants (floor 150, cap 600).
export function plannedIdentities(proposal,visitors=300){
 const roll=Math.max(1,Math.min(100,Number(proposal?.rolloutPct)||100));
 return Math.max(150,Math.min(600,Math.ceil((Math.min(300,Number(visitors)||300))*100/roll)));
}
export const RESULT_HOLD_MS=Number(process.env.FLAGPROOF_RESULT_HOLD_MS)||360000;
const TRAFFIC=fileURLToPath(new URL('../scripts/run-experiment-traffic.mjs',import.meta.url));
// Plain-language refusals, one per cause, so a visitor can tell "someone else is using it" from "you must wait" from "the demo is out of budget".
export function gateMessage({reason,retryAfterSec}={}){
 const wait=Math.max(1,Math.ceil(Number(retryAfterSec)||60)),mins=wait>=120?`${Math.ceil(wait/60)} minutes`:`${wait} seconds`;
 switch(reason){
  case 'busy':return `Another visitor's live experiment is running. Only one runs at a time. Try again in about ${mins}.`;
  case 'cleanup-pending':return `The previous live experiment is still being cleaned up. Try again in about ${mins}.`;
  case 'cooldown':return `You started a live experiment a moment ago. Please wait about ${mins} before the next one.`;
  case 'daily-cap':case 'budget':return 'The live demo has used its allowance for now, so it is closed to new runs. The recorded results on this page are unaffected.';
  default:return `The live demo is unavailable right now, so nothing was started. Try again in about ${mins}.`;
 }
}
export function createExperimentFlow({publicMode,env=process.env,artifactRoot,now=Date.now,lock=null,ledger=null,gate=null,execute=executeExperimentProposalApi}){
 const proposals=new Map();let plannerDay={day:'',count:0};const lastCall=new Map();
 const executor=()=>describeExecutor({publicMode,env,guarded:Boolean(gate&&ledger)});
 // Frees the demo slot exactly once: deletes the experiment (pause first when running) and releases the lease. Never throws.
 const finishRun=async(r,owner)=>{
  if(r.finished||!(gate||lock))return;r.finished=true;clearTimeout(r.holdTimer);
  const id=r.result?.artifact?.experimentId;
  if(gate&&id!=null)await gate.release(id).catch(()=>{});
  if(lock&&r.lease){lock.release(owner,r.lease.token);r.lease=null;}
 };
 const own=(rec,owner)=>rec&&(!publicMode||rec.owner===owner);
 return {
  executor,
  agent:()=>({plannerConfigured:plannerConfigured(env),planner:plannerConfigured(env)?(env.FLAGPROOF_PLANNER==='ollama'?`local-ollama:${env.OLLAMA_MODEL}`:`openai-compatible-endpoint:${env.PLANNER_MODEL}`):'manual-template (not AI)',executor:executor()}),
  async propose({owner,ip,request}){
   const text=String(request||'').trim();
   if(publicMode){
    const mine=[...proposals.values()].filter(r=>r.owner===owner).length;
    if(mine>=PROPOSAL_CAP_PER_SESSION)throw Object.assign(new Error('Proposal limit for this visit reached. Reload later.'),{status:429});
    if(text){
     const key=ip||owner,t=now(),last=lastCall.get(key)||0;
     if(t-last<PLANNER_COOLDOWN_MS)throw Object.assign(new Error(`Wait ${Math.ceil((PLANNER_COOLDOWN_MS-(t-last))/1000)}s before the next AI request.`),{status:429});
     const day=new Date(t).toISOString().slice(0,10);if(plannerDay.day!==day)plannerDay={day,count:0};
     if(plannerDay.count>=PLANNER_DAILY_CAP)throw Object.assign(new Error('Daily AI request cap reached for this demo.'),{status:429});
     plannerDay.count++;lastCall.set(key,t);
    }
   }
   const record=await generateExperimentProposal(env,{request:text});
   record.owner=owner;record.explain=explainProposal(record.proposal);record.executor=executor();
   proposals.set(record.id,record);return record;
  },
  get(id,owner){const r=proposals.get(id);return own(r,owner)?r:null;},
  reject(id,owner){const r=proposals.get(id);if(!own(r,owner))throw Object.assign(new Error('Proposal not found'),{status:404});
   if(r.status!=='pending-review')throw Object.assign(new Error('Proposal is no longer pending'),{status:409});r.status='rejected';return r;},
  async measure(id,owner,{visitors=300,readOnly=false}={}){
   const r=proposals.get(id);const ex=executor();
   if((ledger||gate)&&r?.trafficSent)readOnly=true;// one reservation pays for one traffic send; a re-check only reads
   if(!ex.live||!ex.measure)throw Object.assign(new Error(publicMode?'This hosted demo is in fixture mode and never contacts Flagsmith.':'Measuring needs a local run with a Flagsmith executor.'),{status:409});
   if(!own(r,owner)||r.status!=='executed')throw Object.assign(new Error('Approve and execute the proposal first.'),{status:409});
   if(r.finished)throw Object.assign(new Error('The results window for this run has closed and its experiment was cleaned up for the next visitor. Start a new run to measure again.'),{status:409});
   if(r.measuring)throw Object.assign(new Error('Already measuring'),{status:409});
   const roll=Math.max(1,Math.min(100,Number(r.proposal.rolloutPct)||100));const cap=r.reservedIdentities??plannedIdentities(r.proposal);const n=Math.min(plannedIdentities(r.proposal,visitors),cap);// never more than was reserved
   if(lock&&r.lease&&!lock.holds(owner,r.lease.token))throw Object.assign(new Error('The demo lease expired; this run is being cleaned up. Start a new run.'),{status:409});
   r.measuring=true;
   try{
    const art=r.result.artifact,hosts=flagsmithHosts(env),base=managementBase(env);
    const call=async(method,p,body)=>{const res=await fetch(base+p,{method,body:body?JSON.stringify(body):undefined,headers:{'Content-Type':'application/json',Authorization:`Api-Key ${env.FLAGSMITH_MANAGEMENT_KEY}`},signal:AbortSignal.timeout(60000)});const t=await res.text();if(!res.ok)throw new Error(`Flagsmith ${method} ${p.split('/').slice(-3,-1).join('/')} failed (HTTP ${res.status})`);try{return JSON.parse(t);}catch{return t;}};
    const exp=`environments/${env.FLAGSMITH_ENVIRONMENT_KEY}/experiments/${art.experimentId}/`;
    if(!art.started){await call('POST',exp+'start/');art.started=true;}
    // Self-hosted Flagsmith has no analysis warehouse until one is connected (its own database). Flagsmith Cloud manages this itself, so Cloud is never touched.
    if(hosts.selfHosted){const wp=`environments/${env.FLAGSMITH_ENVIRONMENT_KEY}/warehouse-connections/`;const wl=await call('GET',wp);if(!(Array.isArray(wl)?wl:wl.results||[]).length)await call('POST',wp,{warehouse_type:'postgres',config:{source:'flagsmith_database'}});}
    if(!readOnly){await new Promise((resolve,reject)=>{const child=spawn('node',[TRAFFIC,String(n)],{env:hosts.selfHosted?{...env,FLAGSMITH_EVENTS_API_URL:hosts.origin+'/api/'}:Object.fromEntries(Object.entries(env).filter(([k])=>!['FLAGSMITH_API_URL','FLAGSMITH_EVENTS_API_URL'].includes(k))),stdio:['ignore','ignore','ignore','ipc']});let asked=0;attachTrafficFence(child,async()=>++asked<=n&&(!lock||!r.lease||lock.holds(owner,r.lease.token))&&(!gate||await gate.owns(art.experimentId,{name:r.proposal?.name})),{onStop:()=>reject(new Error('Synthetic traffic stopped: this run no longer owns the demo experiment.'))});const timer=setTimeout(()=>{child.kill();reject(new Error('Synthetic traffic timed out'));},200000);child.on('exit',code=>{clearTimeout(timer);code===0?resolve():reject(new Error('Synthetic traffic script failed'));});child.on('error',reject);});
     await new Promise(res=>setTimeout(res,Number(env.FLAGPROOF_SETTLE_MS??10000)));r.trafficSent=n;}
    // Flagsmith allows one analysis refresh per experiment per cooldown (about 5 minutes), so this makes ONE attempt and says so.
    let note='';
    for(const part of ['exposures/refresh/','results/refresh/']){try{await call('POST',exp+part);}catch(error){note=/429/.test(error.message)?'Flagsmith limits analysis refreshes to one per cooldown (about 5 minutes). Showing what it already holds.':error.message;}}
    // The refresh is queued (HTTP 202); poll the read endpoint, never the refresh, until Flagsmith stamps as_of.
    let results,summary;
    for(let i=0;i<10;i++){await new Promise(res=>setTimeout(res,i?4000:2000));await call('GET',exp+'exposures/').catch(()=>{});results=await call('GET',exp+'results/');summary=summariseAnalysis({results:results?.results});if(results?.results?.as_of&&summary.ready&&summary.total>=(r.trafficSent||n)*(roll/100)*0.8)break;}
    const want=(r.trafficSent||n)*(roll/100)*0.8;
    if(!summary.ready||summary.total<want)summary={...summary,ready:false,rows:summary.rows||[],text:`Flagsmith has processed ${summary.total||0} of the roughly ${Math.round((r.trafficSent||n)*roll/100)} synthetic visitors expected to enter (${r.trafficSent||n} sent, ${roll}% enter) so far${note?'. '+note:''} Nothing is claimed. Use "Check Flagsmith again" after the cooldown.${(gate||lock)?` This run's experiment stays available for about ${Math.round(RESULT_HOLD_MS/60000)} minutes for that, then it is cleaned up for the next visitor.`:''}`};
    if(summary.ready&&summary.total)r.result.summary=describeResult(art,r.result.executor,summary.total);
    r.measurement={at:new Date().toISOString(),visitors:r.trafficSent||0,synthetic:true,analysis:summary};
    // Slot lifecycle: finished analysis, or a re-check (the last chance), frees the slot now. An unfinished first measure keeps the experiment for a bounded window so
    // "Check Flagsmith again" can read real results, then a timer frees the slot. A restart loses the timer; the 15 min stale sweep covers that.
    if(summary.ready&&summary.hasInference||readOnly)await finishRun(r,owner);
    else if(gate||lock){clearTimeout(r.holdTimer);const t=setTimeout(()=>{finishRun(r,owner);},RESULT_HOLD_MS);t.unref?.();Object.defineProperty(r,'holdTimer',{value:t,enumerable:false,writable:true,configurable:true});}
    return r;
   }catch(error){await finishRun(r,owner);throw error;}finally{r.measuring=false;}
  },
  async approve(id,owner,{hash,start=false}){
   const r=proposals.get(id);if(!own(r,owner))throw Object.assign(new Error('Proposal not found'),{status:404});
   if(r.status!=='pending-review')throw Object.assign(new Error('Proposal is no longer pending'),{status:409});
   if((r.requestCheck||[]).some(c=>c.ok===false))throw Object.assign(new Error('This proposal does not match your request, so it cannot be approved. Reject it and edit the request.'),{status:422});
   if(hash!==r.hash)throw Object.assign(new Error('Reviewed proposal fingerprint changed'),{status:409});
   const valid=ExperimentProposalSchema.parse(r.proposal);
   if(fingerprint(valid)!==r.hash)throw Object.assign(new Error('Proposal mutated; review again'),{status:409});
   const ex=executor();
   // Optional shared-demo lock (off unless a lock is passed): one run at a time, refused when the lock state is unavailable.
   let lease=null;
   // Durable gate (state lives in Flagsmith, so it survives a restart): sweep stale leftovers, then refuse unless the demo slot is free and under its ceiling.
   // Any failure refuses. The experiment create below is still the atomic mutex, so two visitors passing this check at once cannot both create one.
   if(gate&&ex.live){let g;try{await gate.sweep();g=await gate.check();}catch{g={ok:false,reason:'state-unavailable',retryAfterSec:60};}if(!g.ok)throw Object.assign(new Error(gateMessage(g)),{status:429});}
   if(lock&&ex.live){lease=lock.tryAcquire(owner);if(!lease.ok)throw Object.assign(new Error(gateMessage(lease)),{status:429});}
   r.status='approved';let artifact=null;
   try{
    if(ex.live)artifact=await execute(r,{env,start:Boolean(start)&&ex.startAllowed&&!ledger});// with a ledger the experiment is created unstarted; measure() starts it only after the reservation below
    else artifact=await executeExperimentProposalFixture(r,{writeFile:async(name,contents)=>{if(publicMode)return;const dir=path.join(artifactRoot,'experiments');await mkdir(dir,{recursive:true});await writeFile(path.join(dir,name),contents);}});
    if(ex.live&&ledger){r.reservedIdentities=plannedIdentities(r.proposal);const res=await ledger.reserve({identities:r.reservedIdentities});if(!res.ok)throw Object.assign(new Error(gateMessage(res)),{gate:true});}// reserve under exclusive ownership, before any start or traffic
    if(lease&&artifact?.experimentId!=null&&!lock.recordExperiment(owner,lease.token,artifact.experimentId)){lock.adoptOrphan(artifact.experimentId);throw new Error('Demo lease was lost while the experiment was created; it is queued for cleanup.');}
    r.lease=lease;
    artifact.approvedBy='approval click through the browser UI (the server cannot tell a person from automation)';
    r.status='executed';r.result={artifact,summary:describeResult(artifact,ex),executor:ex};return r;
   }catch(error){if(lease)lock.release(owner,lease.token,{uncertain:true});if(gate&&artifact?.experimentId!=null)await gate.release(artifact.experimentId).catch(()=>{});r.status='failed';if(gate&&/HTTP 409/.test(error.message)){r.error='busy';throw Object.assign(new Error(gateMessage({reason:'busy',retryAfterSec:30})),{status:429});}// lost the create race: another visitor holds the slot
    if(error.gate){r.error=error.message;throw Object.assign(new Error(error.message),{status:429});}// a refusal before anything started is not an execution failure
    r.error=String(error.message).slice(0,500);throw Object.assign(new Error(`Execution failed: ${r.error}. ${ex.live?'Check Flagsmith before retrying; the approval is spent.':'Nothing was recorded.'}`),{status:502});}
  },
 };
}
