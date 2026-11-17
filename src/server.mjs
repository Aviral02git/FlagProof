import {createServer} from 'node:http';
import {readFile,mkdir,stat} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomBytes,randomUUID,timingSafeEqual} from 'node:crypto';
import {createAdapter,equalFlags} from './flags.mjs';
import {PlanSchema,fingerprint,FLAG_NAMES} from './core.mjs';
import {generatePlan} from './planner.mjs';
import {runSuite} from './runner.mjs';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const TYPES={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.zip':'application/zip'};
export async function startServer({port=Number(process.env.PORT||4317),artifactRoot=path.join(ROOT,'artifacts'),adapter=createAdapter()}={}){
 await mkdir(artifactRoot,{recursive:true});
 const csrf=randomBytes(24).toString('hex');let active=null;let planning=false;let approving=false;const plans=new Map(),runs=new Map();
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
   if(req.method==='POST'){
    if(req.headers.origin&&req.headers.origin!==origin)return json(res,403,{error:'Cross-origin writes blocked'});
    if(req.headers['x-flagproof-token']!==csrf)return json(res,403,{error:'Missing local action token'});
   }
   if(pathname==='/favicon.ico'&&req.method==='GET'){res.writeHead(204);return res.end();}
   if(pathname==='/api/state'&&req.method==='GET')return json(res,200,{mode:adapter.mode,modeLabel:adapter.label,planner:process.env.FLAGPROOF_PLANNER==='ollama'?'local-ollama (not yet verified)':'manual-template (not AI)',token:csrf,active:active?runs.get(active):null,recent:[...runs.values()].reverse().slice(0,12),preEvent:true});
   if(pathname==='/api/demo-config'&&req.method==='GET')return json(res,200,{...adapter.publicConfig(),scenario:active?runs.get(active)?.plan.scenario:'seeded-interaction',flags:adapter.mode==='local-fixture'?await adapter.read():undefined});
   if(pathname==='/api/plans'&&req.method==='POST'){
    if(active||planning||approving)return json(res,409,{error:'Wait for the active operation'});
    const input=await body(req);if(!['seeded-interaction','healthy'].includes(input.scenario))return json(res,400,{error:'Unknown fixture'});
    planning=true;try{const record=await generatePlan(input.scenario);record.initialFlags=await adapter.read();record.configHash=fingerprint(record.initialFlags);plans.set(record.id,record);return json(res,201,record);}finally{planning=false;}
   }
   const planMatch=pathname.match(/^\/api\/plans\/([a-f0-9-]+)\/(reject|approve)$/);
   if(planMatch&&req.method==='POST'){
    const record=plans.get(planMatch[1]);if(!record)return json(res,404,{error:'Plan not found'});
    if(record.status!=='pending-review')return json(res,409,{error:'Plan is no longer pending'});
    if(planMatch[2]==='reject'){record.status='rejected';return json(res,200,{status:'rejected',changed:false});}
    const input=await body(req);if(input.hash!==record.hash)return json(res,409,{error:'Reviewed plan fingerprint changed'});
    if(active||approving)return json(res,409,{error:'Only one suite may run at a time'});
    if(planning)return json(res,409,{error:'Plan generation in progress'});
    approving=true;
    try{
    const valid=PlanSchema.parse(record.plan);
    if(fingerprint(valid)!==record.hash)return json(res,409,{error:'Plan mutated; review again'});
    if(!equalFlags(await adapter.read(),record.initialFlags))return json(res,409,{error:'Environment changed since review; create a fresh plan'});
    record.status='approved';const run={id:randomUUID(),planId:record.id,plan:valid,planSource:record.source,mode:adapter.mode,approvedHash:record.hash,status:'queued',results:[],cancelRequested:false};
    runs.set(run.id,run);active=run.id;
    setImmediate(()=>runSuite(run,{adapter,origin,artifactRoot}).catch(error=>{run.status='error';run.error=`Runner persistence failed: ${error.message}`;run.cleanup=run.cleanup||{status:'unknown'};}).finally(()=>{active=null;}));
    return json(res,202,run);
    }finally{approving=false;}
   }
   const cancel=pathname.match(/^\/api\/runs\/([a-f0-9-]+)\/cancel$/);
   if(cancel&&req.method==='POST'){const run=runs.get(cancel[1]);if(!run)return json(res,404,{error:'Run not found'});if(!['queued','running'].includes(run.status))return json(res,409,{error:'Run already finished'});run.cancelRequested=true;return json(res,202,{status:'cancelling',note:'Current browser operation finishes before verified cleanup.'});}
   const evidence=pathname.match(/^\/artifacts\/([a-f0-9-]+)\/([a-zA-Z0-9.-]+)$/);
   if(evidence&&req.method==='GET')return serve(res,path.join(artifactRoot,evidence[1],evidence[2]));
   if(req.method!=='GET')return json(res,404,{error:'Route not found'});
   const staticFiles={'/':'index.html','/app.js':'app.js','/style.css':'style.css','/demo':'demo.html','/demo.js':'demo.js'};
   if(staticFiles[pathname])return serve(res,path.join(ROOT,'public',staticFiles[pathname]));
   return json(res,404,{error:'Not found'});
  }catch(error){return json(res,error.code==='ENOENT'?404:400,{error:error.message.slice(0,1000)});}
 });
 await new Promise(resolve=>server.listen(port,'127.0.0.1',resolve));origin=`http://127.0.0.1:${server.address().port}`;
 return {server,origin,adapter,plans,runs,getActive:()=>active,close:async()=>{if(active)runs.get(active).cancelRequested=true;while(active)await new Promise(r=>setTimeout(r,100));return new Promise(r=>server.close(r));}};
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const app=await startServer();console.log(`FlagProof pre-event prototype: ${app.origin}`);console.log('Local fixture and manual plan by default. No live account integration claimed.');
 process.on('SIGINT',async()=>{console.log('Stopping, waiting for cleanup...');await app.close();process.exit(0);});
                                                                       }
