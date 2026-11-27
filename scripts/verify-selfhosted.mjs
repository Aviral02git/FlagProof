// Level-2 proof against a self-hosted Flagsmith: runs the normal FlagProof flow
// (environment check -> reviewable hash-bound plan -> human-style approval -> 8-configuration
// real-browser matrix with restore and read-back) with the Flagsmith host taken from .env.
// Usage: node scripts/verify-selfhosted.mjs [env-file] [out-report.json]
// The "approval" here is the script presenting the exact plan hash back, as a CI-style run; a
// person normally clicks Approve in the UI. Writes only the report; prints no secrets.
import {readFile,writeFile} from 'node:fs/promises';
import {startServer} from '../src/server.mjs';
import {FlagsmithAdapter} from '../src/flags.mjs';
import {verifyFlagsmithEnvironment} from '../src/flagsmith-check.mjs';
import {flagsmithHosts} from '../src/hosts.mjs';
const envFile=process.argv[2]||'.env',outFile=process.argv[3]||'selfhosted-report.json';
for(const line of (await readFile(envFile,'utf8')).split(/\r?\n/)){const m=line.match(/^([A-Z0-9_]+)=(.*)$/);if(m&&process.env[m[1]]===undefined)process.env[m[1]]=m[2];}
const hosts=flagsmithHosts();
if(!hosts.selfHosted)throw new Error('This check is for self-hosted Flagsmith. FLAGSMITH_API_URL is not set.');
const checked=await verifyFlagsmithEnvironment({environment:process.env.FLAGSMITH_ENVIRONMENT_KEY,management:process.env.FLAGSMITH_MANAGEMENT_KEY});
console.log('level 1+2a: environment and management key verified against',hosts.origin,'flags',Object.keys(checked.featureIds).join(','));
const app=await startServer({port:0,adapter:new FlagsmithAdapter()});
try{
 const state=await (await fetch(app.origin+'/api/state')).json();
 const post=async(p,b)=>{const r=await fetch(app.origin+p,{method:'POST',headers:{'Content-Type':'application/json','X-Flagproof-Token':state.token},body:JSON.stringify(b)});return {status:r.status,data:await r.json()};};
 const plan=await post('/api/plans',{scenario:'seeded-interaction'});
 if(plan.status!==201)throw new Error('plan failed '+JSON.stringify(plan.data));
 console.log('plan',plan.data.id,'hash',plan.data.hash.slice(0,16),'source',plan.data.source);
 const wrong=await post(`/api/plans/${plan.data.id}/approve`,{hash:'0'.repeat(64)});
 console.log('approve with wrong hash ->',wrong.status,'(must be 409)');
 if(wrong.status!==409)throw new Error('wrong hash was not rejected');
 const ok=await post(`/api/plans/${plan.data.id}/approve`,{hash:plan.data.hash});
 console.log('approve with exact hash ->',ok.status);
 let run;for(let i=0;i<120;i++){await new Promise(r=>setTimeout(r,1000));const s=await (await fetch(app.origin+'/api/state')).json();run=s.recent?.[0];if(!s.active&&run&&run.status&&run.status!=='running')break;}
 const full=await (await fetch(app.origin+`/api/runs/${run.id}`)).json();
 const summary={mode:full.mode,integration:full.integration,status:full.status,cleanup:full.cleanup,pass:(full.results||[]).filter(r=>r.status==='pass').length,fail:(full.results||[]).filter(r=>r.status==='fail').length,total:(full.results||[]).length,startedAt:full.startedAt,finishedAt:full.finishedAt,flagsmithHost:hosts.origin};
 console.log('level 2 result',JSON.stringify(summary));
 await writeFile(outFile,JSON.stringify({summary,originalFlags:full.originalFlags,results:full.results},null,1));
}finally{await app.close();}
