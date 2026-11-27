// Level-3 proof against a self-hosted Flagsmith: the experiment flow (Track 1 mechanics) on your own instance.
// Creates the multivariate flag, connects the Flagsmith-database warehouse, creates and starts the approved
// experiment through FlagProof's adapter, drives SYNTHETIC visitors through the server SDK with events sent to
// the self-hosted events endpoint, refreshes Flagsmith's own analysis and saves what it returned.
// Usage: node scripts/verify-selfhosted-experiment.mjs [env-file] [out.json] [visitors]
import {readFile,writeFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {generateExperimentProposal} from '../src/experiment-plan.mjs';
import {executeExperimentProposalApi} from '../src/experiment-execute.mjs';
import {flagsmithHosts} from '../src/hosts.mjs';
const [envFile='.env',outFile='selfhosted-experiment.json',visitors='450']=process.argv.slice(2);
for(const line of (await readFile(envFile,'utf8')).split(/\r?\n/)){const m=line.match(/^([A-Z0-9_]+)=(.*)$/);if(m&&process.env[m[1]]===undefined)process.env[m[1]]=m[2];}
const hosts=flagsmithHosts();if(!hosts.selfHosted)throw new Error('FLAGSMITH_API_URL is not set to a self-hosted instance.');
const base=hosts.sdkApi,key=process.env.FLAGSMITH_MANAGEMENT_KEY,envKey=process.env.FLAGSMITH_ENVIRONMENT_KEY;
const call=async(method,path,body)=>{const r=await fetch(base+path,{method,headers:{'Content-Type':'application/json',Authorization:`Api-Key ${key}`},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(60000)});const t=await r.text();let d;try{d=JSON.parse(t);}catch{d=t;}if(!r.ok)throw new Error(`${method} ${path} -> ${r.status} ${JSON.stringify(d).slice(0,300)}`);return d;};
const env=await call('GET',`environments/${envKey}/`);const pid=env.project;
let feats=await call('GET',`projects/${pid}/features/?search=checkout_cta_copy`);
let feat=(feats.results||[]).find(f=>f.name==='checkout_cta_copy');
if(!feat){feat=await call('POST',`projects/${pid}/features/`,{name:'checkout_cta_copy',default_enabled:true,initial_value:'control',description:'Synthetic demo flag (FlagProof self-hosted check)'});
 for(const v of ['buy_now','get_it_today'])await call('POST',`projects/${pid}/features/${feat.id}/mv-options/`,{type:'unicode',string_value:v,key:v,default_percentage_allocation:0,feature:feat.id});}
const wh=await call('GET',`environments/${envKey}/warehouse-connections/`);const whList=Array.isArray(wh)?wh:wh.results||[];
if(!whList.length)await call('POST',`environments/${envKey}/warehouse-connections/`,{warehouse_type:'postgres',config:{source:'flagsmith_database'}});
const wh2=await call('GET',`environments/${envKey}/warehouse-connections/`);console.log('warehouse',JSON.stringify((Array.isArray(wh2)?wh2:wh2.results)?.map(w=>({type:w.warehouse_type,status:w.status}))));
// Planner -> proposal. Default is the manual template; set FLAGPROOF_PLANNER=ollama (+OLLAMA_MODEL, optional FLAGPROOF_REQUEST) for the local AI planner.
const record=process.env.FLAGPROOF_RECORD_FILE?JSON.parse(await readFile(process.env.FLAGPROOF_RECORD_FILE,'utf8')):await generateExperimentProposal(process.env,{request:process.env.FLAGPROOF_REQUEST||''});
console.log('planner',record.source,'changed fields',JSON.stringify(record.changedFromTemplate||[]),'request',JSON.stringify(record.requestText||null));console.log('proposal',JSON.stringify({split:record.proposal.variations.map(v=>v.weightPct),rollout:record.proposal.rolloutPct}));
console.log('proposal hash',record.hash.slice(0,16),'(scripted approval of this exact hash)');
const exec=await executeExperimentProposalApi(record,{start:true});
console.log('experiment',exec.experimentId,'started',exec.started);
const traffic=spawnSync('node',['scripts/run-experiment-traffic.mjs',visitors],{env:{...process.env,FLAGSMITH_EVENTS_API_URL:hosts.origin+'/api/'},encoding:'utf8',timeout:600000});
console.log((traffic.stdout||'').split('\n').filter(l=>/Simulating|exposures|Done/.test(l)).join('\n'));if(traffic.status!==0)console.log('traffic stderr',(traffic.stderr||'').slice(-400));
await new Promise(r=>setTimeout(r,3000));
const ex=`environments/${envKey}/experiments/${exec.experimentId}/`;
let refresh,results,exposures;
try{await call('POST',ex+'exposures/refresh/');}catch(e){console.log('exposures refresh:',e.message.slice(0,200));}
try{refresh=await call('POST',ex+'results/refresh/');}catch(e){console.log('results refresh:',e.message.slice(0,300));}
try{exposures=await call('GET',ex+'exposures/');}catch(e){console.log('exposures read:',e.message.slice(0,200));}
try{results=await call('GET',ex+'results/');}catch(e){console.log('results read:',e.message.slice(0,300));}
await writeFile(outFile,JSON.stringify({host:hosts.origin,experimentId:exec.experimentId,exec,refresh,exposures,results},null,1));
console.log('saved',outFile,'results keys',results&&typeof results==='object'?Object.keys(results).join(','):String(results));
