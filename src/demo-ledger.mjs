// Monthly reservation ledger. Reserve BEFORE any traffic, and only while holding exclusive ownership of the demo slot (the experiment create is the mutex).
// The store is injected: read() -> string|null, write(string) -> void. A store that throws, or text that does not parse, fails closed.
// Reservations count identities we intend to send, never observed usage, so counter lag cannot loosen the cap.
export function createLedger({store,monthlyIdentityCeiling,perRunIdentities=150,now=Date.now}){
 if(!store||typeof store.read!=='function'||typeof store.write!=='function')throw new Error('store is required');
 if(!Number.isInteger(monthlyIdentityCeiling)||monthlyIdentityCeiling<perRunIdentities)throw new Error('ceiling must cover at least one run');
 const month=()=>new Date(now()).toISOString().slice(0,7);
 const parse=text=>{
  // An empty ledger is NOT zero usage: it means nobody initialised it with the real prior usage, so refuse rather than start counting from zero.
  if(text==null||text==='')throw new Error('ledger not initialised');
  let d;try{d=JSON.parse(text);}catch{throw new Error('ledger unparseable');}
  if(!d||typeof d.month!=='string'||!Number.isInteger(d.identities)||!Number.isInteger(d.runs)||d.identities<0||d.runs<0)throw new Error('ledger malformed');
  return d.month===month()?d:{month:month(),identities:0,runs:0,seed:'new month'};
 };
 return {
  async reserve({identities=perRunIdentities}={}){
   if(!Number.isInteger(identities)||identities<1||identities>monthlyIdentityCeiling)return {ok:false,reason:'state-unavailable',retryAfterSec:60};
   try{
    const cur=parse(await store.read());
    if(cur.identities+identities>monthlyIdentityCeiling)return {ok:false,reason:'budget',retryAfterSec:3600};
    const next={month:cur.month,identities:cur.identities+identities,runs:cur.runs+1,...(typeof cur.seed==='string'?{seed:cur.seed.slice(0,300)}:{})};
    await store.write(JSON.stringify(next));
    const back=parse(await store.read());// read back: a write that did not land must not let traffic start
    if(back.identities!==next.identities)return {ok:false,reason:'state-unavailable',retryAfterSec:60};
    return {ok:true,reserved:identities,identitiesThisMonth:next.identities,runsThisMonth:next.runs};
   }catch{return {ok:false,reason:'state-unavailable',retryAfterSec:60};}
  },
 };
}
