import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {matrix,expectedTotal,summarize,FLAG_NAMES} from './core.mjs';
import {equalFlags} from './flags.mjs';
import {saveReport} from './history.mjs';
import {reportMarkdown} from './report.mjs';
export function chromePath(){return process.env.CHROME_PATH|| (existsSync('/usr/bin/google-chrome-stable')?'/usr/bin/google-chrome-stable':undefined);}
export async function runSuite(run,{adapter,origin,artifactRoot,runnerCookie,onUpdate=()=>{}}){
 const dir=path.join(artifactRoot,run.id);await mkdir(dir,{recursive:true});
 let browser,original,lastWritten;
 run.results=[];run.cleanup={status:'not-started'};run.status='running';run.startedAt=new Date().toISOString();
 async function save(){await saveReport(dir,run);onUpdate(run);}
 async function testCase(flags,label){
  const id=`case-${String(run.results.length+1).padStart(2,'0')}-${randomUUID().slice(0,6)}`;
  const result={id,label,flags,resolved:null,setup:'pending',status:'running',startedAt:new Date().toISOString(),errors:[],assertions:[],artifacts:{}};
  run.results.push(result);await save();
  let context;
  try{
   const current=await adapter.read();
   if(lastWritten&&!equalFlags(current,lastWritten))throw new Error('Environment changed unexpectedly; refusing to overwrite it.');
   lastWritten=flags;await adapter.set(flags); // remember partial-write target so cleanup still runs on error
   const readBack=await adapter.read();if(!equalFlags(readBack,flags))throw new Error('Management read-back mismatch');
   context=await browser.newContext({viewport:{width:1100,height:760}});
   if(runnerCookie)await context.addCookies([runnerCookie]);
   await context.tracing.start({screenshots:true,snapshots:true,sources:true});
   const page=await context.newPage();
   page.on('pageerror',e=>result.errors.push(e.message.slice(0,2000)));
   page.on('console',m=>{if(m.type()==='error')result.errors.push(m.text().slice(0,2000));});
   page.setDefaultTimeout(8000);
   await page.goto(`${origin}/demo`,{waitUntil:'domcontentloaded'});
   await page.waitForFunction(expected=>window.flagproofReady&&Object.entries(expected).every(([n,v])=>window.resolvedFlags?.[n]===v),flags,{timeout:10000});
   result.resolved=await page.evaluate(()=>window.resolvedFlags);result.setup='valid';
   if(run.cancelRequested)throw new Error('Cancelled by user');
   await page.getByRole('button',{name:'Add test item'}).click();
   await page.getByRole('button',{name:'Complete test order'}).click();
   const confirmed=await page.getByTestId('confirmation').isVisible();
   const observed=Number(await page.getByTestId('total').getAttribute('data-total'));
   const expected=expectedTotal(flags);
   result.assertions=[{name:'order-confirmed',pass:confirmed},{name:'correct-total',pass:observed===expected,expected,observed}];
   result.status=result.assertions.every(a=>a.pass)&&result.errors.length===0?'pass':'fail';
   if(result.status==='fail')result.errors.push(`Price contract violated: expected $${expected}, observed $${observed}.`);
   await page.screenshot({path:path.join(dir,`${id}.png`),fullPage:true});result.artifacts.screenshot=`${id}.png`;
  }catch(error){
   result.status=run.cancelRequested?'cancelled':result.setup==='valid'?'fail':'invalid';
   if(result.setup!=='valid')result.setup='invalid';
   result.errors.push(error.message);
   const page=context?.pages()[0];if(page){try{await page.screenshot({path:path.join(dir,`${id}.png`),fullPage:true,timeout:3000});result.artifacts.screenshot=`${id}.png`;}catch{ /* Report retains the screenshot failure via absent artifact. */ }}
  }finally{
   if(context){try{await context.tracing.stop({path:path.join(dir,`${id}.zip`)});result.artifacts.trace=`${id}.zip`;}catch(error){result.errors.push(`Trace capture failed: ${error.message}`);}await context.close();}
   result.finishedAt=new Date().toISOString();await save();
  }
  return result;
 }
 try{
  original=await adapter.read();run.originalFlags=original;lastWritten=original;await save();
  browser=await chromium.launch({headless:true,executablePath:chromePath(),args:['--no-sandbox']});
  for(const flags of matrix()){
   if(run.cancelRequested)break;
   const result=await testCase(flags,'matrix');
   if(result.setup!=='valid')throw new Error('Setup invalid. Stopping suite to avoid misleading findings.');
  }
  run.summary=summarize(run.results.filter(r=>r.label==='matrix'));
  if(run.summary.minimal.length&&!run.cancelRequested){
   const first=run.summary.minimal[0];
   const flags=Object.fromEntries(FLAG_NAMES.map(n=>[n,first.flags.includes(n)]));
   const repeated=await testCase(flags,'reproduce');
   run.reproduction={runId:repeated.id,confirmed:repeated.setup==='valid'&&repeated.status==='fail'};
  }
  run.status=run.cancelRequested?'cancelled':'completed';
 }catch(error){run.status=run.cancelRequested?'cancelled':'error';run.error=error.message;}
 finally{
  if(original){
   run.cleanup={status:'restoring'};await save();
   try{
    // Do not overwrite unexpected external edits. Partial local writes can always be safely restored.
    if(adapter.mode==='flagsmith'&&lastWritten&&!equalFlags(await adapter.read(),lastWritten))throw new Error('External or partial state change detected. Manual restoration required.');
    await adapter.set(original);const restored=await adapter.read();
    if(!equalFlags(restored,original))throw new Error('Restoration read-back mismatch');
    run.cleanup={status:'verified',flags:restored};
   }catch(error){run.cleanup={status:'failed',error:error.message};run.status='error';}
  }
  if(browser)await browser.close();
  run.finishedAt=new Date().toISOString();
  if(!run.summary)run.summary=summarize(run.results.filter(r=>r.label==='matrix'));
  run.analysisSource='deterministic-evidence-summary';
  run.limitations=['Pre-event prototype.',run.mode==='flagsmith'?'Flagsmith is used only for the approved isolated synthetic checkout; this is not a production test.':'Fixture mode is not live Flagsmith integration.',run.planSource?.startsWith('local-ollama:')?'Model-proposed plan still requires review.':'Manual template is not an AI-generated plan.','Synthetic app defect is intentionally seeded; browser outcomes are measured.','One journey and three flags do not prove application correctness.'];
  await save();
  await writeFile(path.join(dir,'report.md'),reportMarkdown(run));
 }
 return run;
    }
