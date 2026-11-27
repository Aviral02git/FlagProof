// Ledger store backed by one Flagsmith feature VALUE in the demo environment (management API only, no SDK traffic).
// Uses the environment-feature endpoint because the demo environment uses v2 feature versioning, where plain featurestate writes are refused (observed HTTP 400).
// Not compare-and-swap: only safe while the caller holds exclusive ownership of the demo slot. Any unexpected shape or HTTP error throws, so the ledger fails closed.
export function createFlagsmithLedgerStore({apiUrl,environmentKey,featureId,managementKey,fetchImpl=globalThis.fetch}){
 for(const [k,v] of Object.entries({apiUrl,environmentKey,featureId,managementKey}))if(!v)throw new Error(`${k} is required`);
 const url=`${new URL(apiUrl).origin}/api/__future__/environments/${encodeURIComponent(environmentKey)}/features/${encodeURIComponent(featureId)}/`;
 const call=async(method,body)=>{const res=await fetchImpl(url,{method,headers:{'Content-Type':'application/json',Authorization:`Api-Key ${managementKey}`},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(20000)});
  if(!res.ok)throw new Error(`ledger store ${method} ${res.status}`);const t=await res.text();return t?JSON.parse(t):{};};
 const value=d=>{const v=d?.environment_default?.value;if(!v||v.type!=='string'||typeof v.value!=='string')throw new Error('ledger value not text');return v.value;};
 return {
  async read(){const t=value(await call('GET'));return t===''?null:t;},
  async write(text){await call('PATCH',{environment_default:{enabled:false,value:{type:'string',value:String(text)}}});},
 };
}
