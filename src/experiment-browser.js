import flagsmith from '@flagsmith/flagsmith';
import {EXPERIMENT_FLAG,EXPERIMENT_EVENT,EXPERIMENT_VARIANTS} from './experiment-config.mjs';
const $=s=>document.querySelector(s);
function pickStubVariation(identity){
 // Deterministic local stand-in for assignment, so the preview is stable per browser.
 let h=0;for(const c of identity)h=(h*31+c.charCodeAt(0))>>>0;
 return EXPERIMENT_VARIANTS[h%EXPERIMENT_VARIANTS.length].key;
}
function showVariation({key,identity,live}){
 const variant=EXPERIMENT_VARIANTS.find(v=>v.key===key);
 window.experimentVariant=key;window.flagproofReady=true;
 $('#variant').textContent=`Variation: ${variant.label}`;
 const cta=$('#cta');cta.textContent=variant.copy;cta.disabled=false;
 $('#resolved').textContent=JSON.stringify({flag:EXPERIMENT_FLAG,variation:key,identity,metricEvent:EXPERIMENT_EVENT,mode:live?'live':'stub'},null,2);
 cta.onclick=async()=>{
  cta.disabled=true;
  $('#confirmation').hidden=false;
  if(!live){$('#event-note').textContent='Stub preview: no conversion event was sent to Flagsmith. No money charged.';return;}
  try{await flagsmith.trackEvent(EXPERIMENT_EVENT,{value:105});await flagsmith.flushEvents();$('#event-note').textContent=`Conversion event "${EXPERIMENT_EVENT}" sent to Flagsmith for this variation. No money charged.`;}
  catch{ $('#event-note').textContent='Order confirmed locally; the conversion event could not be sent. No money charged.'; }
 };
}
try {
 const config=await fetch('/api/demo-config',{cache:'no-store'}).then(r=>r.json());
 // A stable synthetic visitor id per browser, so exposures deduplicate per identity.
 let identity=localStorage.getItem('fp-experiment-identity');
 if(!identity){identity=`visitor-${crypto.randomUUID()}`;localStorage.setItem('fp-experiment-identity',identity);}
 if(config.mode!=='flagsmith'){
  $('#mode').textContent='SYNTHETIC PREVIEW · variation stubbed, no live Flagsmith traffic';
  $('#intro').textContent='This stub preview shows how the experiment shop behaves. No Flagsmith environment is connected: the variation below is chosen locally, and no exposure or conversion events are sent. No payment or real order is created.';
  showVariation({key:pickStubVariation(identity),identity,live:false});
 }else{
  await flagsmith.init({environmentID:config.environmentID,api:config.api,cacheFlags:false,enableEvents:true});
  await flagsmith.identify(identity);
  const flag=flagsmith.getExperimentFlag(EXPERIMENT_FLAG); // evaluates and records the exposure
  const key=EXPERIMENT_VARIANTS.some(v=>v.key===flag?.value)?flag.value:'control';
  $('#mode').textContent=config.label;
  showVariation({key,identity,live:true});
 }
}catch(error){$('#mode').textContent='Experiment setup failed';$('#setup-error').textContent=error.message;window.flagproofReady=false;}
