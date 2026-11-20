import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

// Minimal .env loader: no dependency, no override of real environment variables.
// .env is gitignored; never commit it. Lines: KEY=VALUE, # comments, blank lines.
export async function loadDotEnv(root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..')){
 let text;
 try{text=await readFile(path.join(root,'.env'),'utf8');}catch{return false;}
 for(const line of text.split(/\r?\n/)){
  const trimmed=line.trim();
  if(!trimmed||trimmed.startsWith('#'))continue;
  const eq=trimmed.indexOf('=');
  if(eq<1)continue;
  const key=trimmed.slice(0,eq).trim();
  let value=trimmed.slice(eq+1).trim();
  if((value.startsWith('"')&&value.endsWith('"'))||(value.startsWith("'")&&value.endsWith("'")))value=value.slice(1,-1);
  if(/^[A-Z0-9_]+$/i.test(key)&&process.env[key]===undefined)process.env[key]=value;
 }
 return true;
}
