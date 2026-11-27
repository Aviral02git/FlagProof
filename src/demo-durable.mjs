// Durable gate for the shared demo that keeps NO state of its own. State lives in Flagsmith, so a Render restart or redeploy cannot reset it:
//  - Busy: any non-completed experiment on the dedicated demo flag in the dedicated demo environment. Flagsmith itself allows only one active
//    experiment per flag per environment, so a racing second create is refused by Flagsmith as well.
//  - Cleanup: experiments on that flag older than staleMs are paused then deleted. Scope is the configured org/environment/flag only; the API
//    URL is environment-scoped, so other environments answer 404, and a flag mismatch is refused before any write.
//  - Budget: organisation usage (billable API calls) read from Flagsmith; at or above the ceiling the gate stays closed. Unreadable usage FAILS CLOSED.
// staleMs (15 min) is deliberately well above the longest legitimate run (about 2.5 min: traffic capped at 60 s plus up to 50 s of polling), so age alone only
// reaches runs that have clearly died. A worker whose experiment was cleaned up gets 404s on its next call and stops without creating anything.
// Unverified on Flagsmith Cloud: the usage-data endpoint and the experiment list shape were read from the open-source code, not exercised there.
export function createDurableGate({apiUrl,orgId,environmentKey,flagName,managementKey,maxMonthlyCalls=30000,staleMs=900000,now=Date.now,fetchImpl=globalThis.fetch}){
 for(const [k,v] of Object.entries({apiUrl,orgId,environmentKey,flagName,managementKey}))if(!v)throw new Error(`${k} is required`);
 const root=apiUrl.replace(/\/?$/,'/');const exps=`${root}environments/${environmentKey}/experiments/`;
 const call=async(method,url)=>{const res=await fetchImpl(url,{method,headers:{'Content-Type':'application/json',Authorization:`Api-Key ${managementKey}`},signal:AbortSignal.timeout(20000)});
  if(res.status===404)return {notFound:true};if(!res.ok)throw new Error(`Flagsmith ${method} ${res.status}`);const t=await res.text();return t?JSON.parse(t):{};};
 const onFlag=e=>(e.feature&&typeof e.feature==='object'?e.feature.name:null)===flagName;
 // Follows pagination ('next' links stay on the same API host and path prefix) up to a page cap. An unknown shape, an off-host next link or a
 // truncated listing THROWS, so the gate fails closed instead of reading a partial list as "free".
 const list=async()=>{
  let url=exps;const all=[];
  for(let page=0;page<20;page++){
   const d=await call('GET',url);if(d.notFound)return all.filter(onFlag);
   const rows=Array.isArray(d)?d:d.results;if(!Array.isArray(rows))throw new Error('unexpected experiment list shape');
   all.push(...rows);
   if(Array.isArray(d)||!d.next)return all.filter(onFlag);
   if(!String(d.next).startsWith(root))throw new Error('pagination left the API');
   url=d.next;
  }
  throw new Error('experiment list too long');
 };
 return {
  // Frees ONE experiment, only if it is currently listed on the demo flag (so an id from anywhere else is never touched). Pause first when running.
  async release(experimentId){
   const e=(await list()).find(x=>x.id===experimentId);if(!e)return false;
   if(e.status==='running')await call('POST',`${exps}${e.id}/pause/`);
   await call('DELETE',`${exps}${e.id}/`);return true;
  },
  // Ownership check used before EVERY traffic request: our experiment id must still exist, be running, be on the demo flag, and carry the name we created.
  // Anything else (deleted, swept, replaced, paused, renamed, unreadable, rate limited) answers false, so a suspended or stale worker stops at its next request.
  async owns(experimentId,{name}={}){
   try{const d=await call('GET',`${exps}${experimentId}/`);
    return !d.notFound&&d.id===experimentId&&d.status==='running'&&onFlag(d)&&(!name||d.name===name);}catch{return false;}
  },
  async sweep(){
   const gone=[];
   for(const e of await list()){
    const started=Date.parse(e.started_at||e.created_at||'');
    if(!Number.isFinite(started)||now()-started<staleMs)continue;
    if(e.status==='running')await call('POST',`${exps}${e.id}/pause/`);
    await call('DELETE',`${exps}${e.id}/`);gone.push(e.id);
   }
   return gone;
  },
  async check(){
   try{
    const left=await list();
    if(left.length)return {ok:false,reason:'busy',retryAfterSec:30};
    const u=await call('GET',`${root}organisations/${orgId}/usage-data/total-count/`);
    const used=Number(u?.billableAPICalls??u?.count??u?.total??NaN);
    if(!Number.isFinite(used))return {ok:false,reason:'usage-unreadable',retryAfterSec:300};
    if(used>=maxMonthlyCalls)return {ok:false,reason:'budget',retryAfterSec:3600};
    return {ok:true,used};
   }catch(e){return {ok:false,reason:'state-unavailable',retryAfterSec:60};}
  },
 };
}
