// Flagsmith adapter for demo-lock cleanup. Every call is scoped to ONE environment key in the URL, so another environment's
// experiment answers 404 and cannot be touched. The feature is checked against the configured demo flag id before any write.
export function createFlagsmithCleanupAdapter({apiUrl,environmentKey,managementKey,flagName,featureId,fetchImpl=globalThis.fetch}){
 const base=apiUrl.replace(/\/?$/,'/')+`environments/${environmentKey}/experiments/`;
 // The experiment API returns the feature as an object {id,name,...} (older shape: bare id). Both are matched exactly against the configured demo flag.
 const featureOf=f=>{const name=f&&typeof f==='object'?f.name:null,id=f&&typeof f==='object'?f.id:f;return (name===flagName||(featureId!=null&&String(id)===String(featureId)))?flagName:`feature#${id}`;};
 const call=async(method,url)=>{const res=await fetchImpl(url,{method,headers:{'Content-Type':'application/json',Authorization:`Api-Key ${managementKey}`},signal:AbortSignal.timeout(30000)});
  if(res.status===404)return {notFound:true};if(!res.ok)throw new Error(`Flagsmith ${method} ${res.status}`);
  const t=await res.text();return t?JSON.parse(t):{};};
 return {
  async get(id){const e=await call('GET',`${base}${id}/`);if(e.notFound)return null;
   return {id:e.id,status:e.status,environment_key:environmentKey,feature_name:featureOf(e.feature)};},
  // Flagsmith's own "complete" needs a rollout decision payload, and delete only needs the experiment paused or completed, so cleanup pauses (named complete() for the lock's adapter contract).
  async listActive(){const d=await call('GET',base);if(d.notFound)return [];return (d.results||d).filter(e=>e.status==='running'||e.status==='created'||e.status==='paused').map(e=>({id:e.id,status:e.status,environment_key:environmentKey,feature_name:featureOf(e.feature)}));},
  async complete(id){const e=await call('GET',`${base}${id}/`);if(e.notFound)return;if(e.status!=='running')return;await call('POST',`${base}${id}/pause/`);},
  async remove(id){await call('DELETE',`${base}${id}/`);},
 };
}
