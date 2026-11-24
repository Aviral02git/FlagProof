import {createServer} from 'node:http';
import {readFile,mkdir,stat} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomBytes,randomUUID,timingSafeEqual} from 'node:crypto';
import {createAdapter,equalFlags} from './flags.mjs';
import {PlanSchema,fingerprint,FLAG_NAMES} from './core.mjs';
import {generatePlan} from './planner.mjs';
import {runSuite} from './runner.mjs';
import {loadHistory,recoveryBlock,saveReport} from './history.mjs';
import {compareRuns,reportMarkdown} from './report.mjs';
import {createPublicGuard} from './public-guard.mjs';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const TYPES={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.zip':'application/zip'};
export async function startServer({port=Number(process.env.PORT||4317),artifactRoot=path.join(ROOT,'artifacts'),adapter=createAdapter()}={}){
 await mkdir(artifactRoot,{recursive:true});
 const csrf=randomBytes(24).toString('hex');let active=null;let planning=false;let approving=false;const plans=new Map();
 const runnerTickets=new Map(); // run-scoped tickets: let the server-side runner read only the fixture config, only while its run is active; never the visitor session
 const publicMode=process.env.FLAGPROOF_PUBLIC==='1';const trustProxy=process.env.TRUST_PROXY==='1';let guard=null;
 const {runs,warnings:historyWarnings}=publicMode?{runs:new Map(),warnings:[]}:await loadHistory(artifactRoot);
 const blocked=()=>recoveryBlock(runs,historyWarnings,adapter.mode);
 let origin;
 function json(res,status,data){res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(data));}
 async function body(req){let text='';for await(const chunk of req){text+=chunk;if(text.length>32768)throw new Error('Request too large');}return text?JSON.parse(text):{};}
 async function serve(res,file){const data=await readFile(file);res.writeHead(200,{'Content-Type':TYPES[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(data);}
 const server=createServer(async(req,res)=>{
  try{
   if(req.headers.host!==new URL(origin).host)return json(res,403,{error:'Untrusted Host'});
   res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self' https://edge.api.flagsmith.com; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
   const url=new URL(req.url,origin),pathname=url.pathname;
   if(!['GET','POST'].includes(req.method))return json(res,405,{error:'Method not allowed'});
   let sess=null;
   if(publicMode){
    if(req.headers.host!==new URL(origin).host)return json(res,403,{error:'Untrusted Host'});
    sess=guard.session(req,res);
    if(pathname==='/api/enter'&&req.method==='POST'){const input=await body(req);return guard.tryEnter(sess,input.password)?json(res,200,{ok:true}):json(res,403,{error:'Wrong demo password'});}
    if((pathname.startsWith('/api/')||pathname.startsWith('/artifacts/'))&&!sess.authed){
     const ticket=(req.headers.cookie||'').split(';').map(p=>p.trim().split('=')).find(a=>a[0]==='fp_run');
     const expected=active?runnerTickets.get(active):null;
     if(!(req.method==='GET'&&pathname==='/api/demo-config'&&ticket&&expected&&ticket[1]===`${active}:${expected}`))return json(res,403,{error:'Demo locked. Enter the demo password.'});
    }
   }
   if(req.method==='POST'){
    if(req.headers.origin&&req.headers.origin!==origin)return json(res,403,{error:'Cross-origin writes blocked'});
    if(pathname!=='/api/enter'&&req.headers['x-flagproof-token']!==(publicMode?sess.token:csrf))return json(res,403,{error:'Missing local action token'});
   }
   if(pathname==='/favicon.ico'&&req.method==='GET'){res.writeHead(204);return res.end();}
   if(pathname==='/api/state'&&req.method==='GET')return json(res,200,{mode:adapter.mode,modeLabel:adapter.label,locked:publicMode?false:undefined,hosted:publicMode?true:undefined,planner:process.env.FLAGPROOF_PLANNER==='ollama'?(process.env.OLLAMA_MODEL==='qwen2.5:0.5b'?'local-ollama:qwen2.5:0.5b (verified 2026-11-20)':`local-ollama:${process.env.OLLAMA_MODEL||'unset'} (untested model)`):'manual-template (not AI)',token:publicMode?sess.token:csrf,active:active&&(!publicMode||sess.runs.has(active))?runs.get(active):null,recoveryBlock:blocked(),historyWarnings,recent:publicMode?[...sess.runs].map(id=>runs.get(id)).filter(Boolean).slice(-12).reverse():[...runs.values()].reverse().slice(0,12),preEvent:true});
   if(pathname==='/api/demo-config'&&req.method==='GET')return json(res,200,{...adapter.publicConfig(),scenario:active?runs.get(active)?.plan.scenario:'seeded-interaction',flags:adapter.mode==='local-fixture'?await adapter.read():undefined});
   if(pathname==='/api/plans'&&req.method==='POST'){
    if(blocked())return json(res,409,{error:blocked()});
    if(planning||((active||approving)&&!publicMode))return json(res,409,{error:'Wait for the active operation'});
    const input=await body(req);if(!['seeded-interaction','healthy'].includes(input.scenario))return json(res,400,{error:'Unknown fixture'});
    planning=true;try{const record=await generatePlan(input.scenario);record.initialFlags=await adapter.read();record.configHash=fingerprint(record.initialFlags);record.owner=publicMode?sess.id:null;plans.set(record.id,record);return json(res,201,record);}finally{planning=false;}
   }
   const planMatch=pathname.match(/^\/api\/plans\/([a-f0-9-]+)\/(reject|approve)$/);
   if(planMatch&&req.method==='POST'){
    const record=plans.get(planMatch[1]);if(!record||(publicMode&&record.owner!==sess.id))return json(res,404,{error:'Plan not found'});
    if(record.status!=='pending-review')return json(res,409,{error:'Plan is no longer pending'});
    if(planMatch[2]==='reject'){record.status='rejected';return json(res,200,{status:'rejected',changed:false});}
    if(blocked())return json(res,409,{error:blocked()});
    const input=await body(req);if(input.hash!==record.hash)return json(res,409,{error:'Reviewed plan fingerprint changed'});
    if(active||approving)return json(res,409,{error:'Only one suite may run at a time'});
    if(planning)return json(res,409,{error:'Plan generation in progress'});
    if(publicMode){const gate=guard.suiteAllowed(guard.clientIp(req,trustProxy));if(!gate.ok)return json(res,429,{error:`Another suite started recently. Try again in ${gate.retryAfter}s.`});}
    approving=true;
    try{
    const valid=PlanSchema.parse(record.plan);
    if(fingerprint(valid)!==record.hash)return json(res,409,{error:'Plan mutated; review again'});
    if(!equalFlags(await adapter.read(),record.initialFlags))return json(res,409,{error:'Environment changed since review; create a fresh plan'});
    record.status='approved';const run={id:randomUUID(),planId:record.id,plan:valid,planSource:record.source,mode:adapter.mode,approvedHash:record.hash,status:'queued',results:[],cancelRequested:false};
    run.createdAt=new Date().toISOString();run.originalFlags={...record.initialFlags};run.cleanup={status:'not-started'};run.owner=publicMode?sess.id:null;
    await mkdir(path.join(artifactRoot,run.id),{recursive:true});await saveReport(path.join(artifactRoot,run.id),run);
    runs.set(run.id,run);active=run.id;if(publicMode){sess.runs.add(run.id);runnerTickets.set(run.id,randomBytes(24).toString('hex'));}
    setImmediate(()=>runSuite(run,{adapter,origin,artifactRoot,runnerCookie:publicMode?{name:'fp_run',value:`${run.id}:${runnerTickets.get(run.id)}`,url:origin}:undefined}).catch(error=>{run.status='error';run.error=`Runner persistence failed: ${error.message}`;run.cleanup=run.cleanup||{status:'unknown'};}).finally(()=>{active=null;runnerTickets.delete(run.id);if(publicMode)guard.sweep(runs).catch(()=>{});}));
    return json(res,202,run);
    }finally{approving=false;}
   }
   const cancel=pathname.match(/^\/api\/runs\/([a-f0-9-]+)\/cancel$/);
   if(cancel&&req.method==='POST'){const run=runs.get(cancel[1]);if(!run||(publicMode&&!sess.runs.has(cancel[1])))return json(res,404,{error:'Run not found'});if(!['queued','running'].includes(run.status))return json(res,409,{error:'Run already finished'});run.cancelRequested=true;return json(res,202,{status:'cancelling',note:'Current browser operation finishes before verified cleanup.'});}
   const selected=pathname.match(/^\/api\/runs\/([a-f0-9-]+)$/);
   if(selected&&req.method==='GET'){const run=runs.get(selected[1]);return run&&(!publicMode||sess.runs.has(selected[1]))?json(res,200,run):json(res,404,{error:'Run not found'});}
   if(pathname==='/api/compare'&&req.method==='GET'){if(publicMode&&(!sess.runs.has(url.searchParams.get('current'))||!sess.runs.has(url.searchParams.get('baseline'))))return json(res,404,{error:'Run not found'});return json(res,200,compareRuns(runs.get(url.searchParams.get('current')),runs.get(url.searchParams.get('baseline'))));}
   const readable=pathname.match(/^\/artifacts\/([a-f0-9-]+)\/report\.md$/);
   if(readable&&req.method==='GET'){
    const run=runs.get(readable[1]);if(!run||(publicMode&&!sess.runs.has(readable[1])))return json(res,404,{error:'Run not found'});
    res.writeHead(200,{'Content-Type':'text/markdown; charset=utf-8','Content-Disposition':'attachment; filename=flagproof-'+run.id+'.md','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});return res.end(reportMarkdown(run));
   }
   const evidence=pathname.match(/^\/artifacts\/([a-f0-9-]+)\/([a-zA-Z0-9.-]+)$/);
   if(evidence&&req.method==='GET'){if(evidence[2].includes('..')||(publicMode&&!sess.runs.has(evidence[1])))return json(res,404,{error:'Run not found'});return serve(res,path.join(artifactRoot,evidence[1],evidence[2]));}
   if(req.method!=='GET')return json(res,404,{error:'Route not found'});
   const staticFiles={'/':'index.html','/app.js':'app.js','/style.css':'style.css','/demo':'demo.html','/demo.js':'demo.js','/experiment':'experiment.html','/experiment.js':'experiment.js'};
   if(staticFiles[pathname])return serve(res,path.join(ROOT,'public',staticFiles[pathname]));
   return json(res,404,{error:'Not found'});
  }catch(error){return json(res,error.code==='ENOENT'?404:400,{error:error.message.slice(0,1000)});}
 });
 if(publicMode&&!process.env.PUBLIC_ORIGIN)throw new Error('Set PUBLIC_ORIGIN to the public https URL in public mode.');
 await new Promise(resolve=>server.listen(port,publicMode?'0.0.0.0':'127.0.0.1',resolve));
 origin=publicMode?process.env.PUBLIC_ORIGIN.replace(/\/$/,''):`http://127.0.0.1:${server.address().port}`;
 if(publicMode)guard=createPublicGuard({origin,password:process.env.PUBLIC_DEMO_PASSWORD||'',artifactRoot});
 return {server,origin,adapter,plans,runs,runnerTickets,getActive:()=>active,close:async()=>{if(active)runs.get(active).cancelRequested=true;while(active)await new Promise(r=>setTimeout(r,100));return new Promise(r=>server.close(r));}};
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const {loadDotEnv}=await import('./env.mjs');
 const dotenv=await loadDotEnv();
 const app=await startServer();console.log(`FlagProof pre-event prototype: ${app.origin}`);
 console.log(dotenv?`Loaded .env. Mode: ${app.adapter.mode} (${app.adapter.label}).`:'No .env found. Local fixture and manual plan by default; run npm run setup:flagsmith to use a real Flagsmith environment.');
 process.on('SIGINT',async()=>{console.log('Stopping, waiting for cleanup...');await app.close();process.exit(0);});
  }
