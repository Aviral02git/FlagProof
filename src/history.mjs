import {readdir,readFile,writeFile,rename} from 'node:fs/promises';
import path from 'node:path';
import {PlanSchema,FlagState,summarize} from './core.mjs';
import {randomUUID} from 'node:crypto';
const ID=/^[a-f0-9-]{36}$/;
export async function saveReport(dir,run){
 const temp=path.join(dir,`.report-${randomUUID()}.tmp`);
 await writeFile(temp,JSON.stringify(run,null,2));
 await rename(temp,path.join(dir,'report.json'));
}
export async function loadHistory(root){
 const runs=new Map(),warnings=[];
 for(const entry of await readdir(root,{withFileTypes:true})){
  if(!entry.isDirectory()||!ID.test(entry.name))continue;
  try{
   const run=JSON.parse(await readFile(path.join(root,entry.name,'report.json'),'utf8'));
   PlanSchema.parse(run.plan);
   for(const result of run.results||[]){
    FlagState.parse(result.flags);
    if(!/^[a-zA-Z0-9.-]+$/.test(result.id)||!['matrix','reproduce'].includes(result.label)||!['pending','running','pass','fail','invalid','cancelled'].includes(result.status))throw new Error('Invalid case record');
    for(const file of Object.values(result.artifacts||{}))if(typeof file!=='string'||!/^case-[a-zA-Z0-9.-]+\.(png|zip)$/.test(file))throw new Error('Invalid evidence filename');
   }
   if(!['queued','running','completed','cancelled','error','interrupted'].includes(run.status))throw new Error('Invalid run status');
   if(run.id!==entry.name||!Array.isArray(run.results)||!['healthy','seeded-interaction'].includes(run.plan?.scenario)||!['local-fixture','flagsmith'].includes(run.mode))throw new Error('Invalid saved report');
   if(['queued','running'].includes(run.status)||run.cleanup?.status==='restoring'){
    run.previousStatus=run.status;run.status='interrupted';run.recoveredFromDisk=true;
    run.error='The previous process stopped before completion. No test or cleanup was resumed.';
    if(run.cleanup?.status!=='verified')run.cleanup={status:'unknown',error:run.mode==='flagsmith'?'Verify and restore the saved original state in the vendor dashboard before any further live use.':'The local fixture was in memory and resets on restart. Previous cleanup was not verified.'};
    await saveReport(path.join(root,run.id),run);
   }
   run.summary=summarize(run.results.filter(r=>r.label==='matrix'));
   runs.set(run.id,run);
  }catch{warnings.push(`Saved report ${entry.name} is unreadable. Inspect the artifact directory before relying on history.`);}
 }
 return {runs:new Map([...runs].sort((a,b)=>(a[1].startedAt||'').localeCompare(b[1].startedAt||''))),warnings};
}
export function recoveryBlock(runs,warnings,mode){
 if(mode!=='flagsmith')return null;
 if(warnings.length)return 'Unreadable saved history. Live writes are blocked until an authorized operator inspects the artifact directory.';
 const unresolved=[...runs.values()].find(r=>r.mode==='flagsmith'&&r.cleanup?.status!=='verified');
 return unresolved?`Live writes blocked: saved run ${unresolved.id} has unverified restoration. Inspect its originalFlags and verify restoration in Flagsmith. There is no automatic retry or recovery override.`:null;
}
