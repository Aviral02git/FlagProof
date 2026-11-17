import flagsmith from '@flagsmith/flagsmith';
const $=s=>document.querySelector(s);
try {
 const config=await fetch('/api/demo-config',{cache:'no-store'}).then(r=>r.json());
 let flags;
 if(config.mode==='flagsmith'){
  await flagsmith.init({environmentID:config.environmentID,api:config.api,cacheFlags:false,enableAnalytics:false});
  await flagsmith.getFlags();
  const all=flagsmith.getAllFlags();
  for(const name of ['new_checkout','express_shipping','promo_banner'])if(!Object.hasOwn(all,name)||typeof all[name].enabled!=='boolean')throw new Error('Required demo flag missing or invalid in SDK response.');
  flags=Object.fromEntries(['new_checkout','express_shipping','promo_banner'].map(n=>[n,flagsmith.hasFeature(n)]));
 }else flags=config.flags;
 window.resolvedFlags=flags;window.flagproofReady=true;
 $('#mode').textContent=config.label;
 $('#resolved').textContent=JSON.stringify(flags,null,2);
 $('#variant').textContent=flags.new_checkout?'New checkout':'Classic checkout';
 if(flags.promo_banner)$('#promo').hidden=false;
 $('#shipping').textContent=flags.express_shipping?'Express shipping · $15':'Standard shipping · $5';
 $('#add').disabled=false;
 $('#add').onclick=()=>{ $('#cart').hidden=false;$('#add').disabled=true;$('#checkout').disabled=false; };
 $('#checkout').onclick=()=>{
  // Deliberately seeded integration defect: the new checkout adds express shipping twice.
  const shipping=flags.express_shipping?15:5;
  let total=100+shipping;
  if(config.scenario==='seeded-interaction'&&flags.new_checkout&&flags.express_shipping)total+=shipping;
  const el=$('#total');el.textContent=`$${total.toFixed(2)}`;el.dataset.total=String(total);
  $('#confirmation').hidden=false;$('#checkout').disabled=true;
  if(total!==100+shipping)console.error('Demo checkout charged shipping twice.');
 };
}catch(error){$('#mode').textContent='Flag setup failed';$('#setup-error').textContent=error.message;window.flagproofReady=false;}
