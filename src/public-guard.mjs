import {randomBytes,timingSafeEqual} from 'node:crypto';
import {readdir,rm,stat} from 'node:fs/promises';
import path from 'node:path';

// Public-demo guard: per-visitor sessions with owned runs, optional entry password,
// per-IP suite-start cooldown + global daily cap, and bounded artifact retention.
// Loopback CSRF alone is not online isolation; every cross-visitor read/write goes through session ownership here.
export function createPublicGuard({origin,password,artifactRoot}){
 const sessions=new Map();
 const ipLastSuite=new Map();
 let daily={day:'',count:0};
 const secure=origin.startsWith('https:');
 const COOKIE='fp_sid';
 const SUITE_COOLDOWN_MS=120000, DAILY_SUITE_CAP=40, SESSION_RUN_CAP=3, DIR_CAP=40, RUN_TTL_MS=3600000;
 function cookies(req){return Object.fromEntries((req.headers.cookie||'').split(';').map(p=>p.trim().split('=')).filter(a=>a[0]));}
 function session(req,res){
  let s=cookies(req)[COOKIE]&&sessions.get(cookies(req)[COOKIE]);
  if(!s){s={id:randomBytes(16).toString('hex'),token:randomBytes(24).toString('hex'),authed:!password,runs:new Set(),createdAt:Date.now()};sessions.set(s.id,s);}
  res.setHeader('Set-Cookie',`${COOKIE}=${s.id}; HttpOnly; SameSite=Lax; Path=/${secure?'; Secure':''}`);
  return s;
 }
 // Spoof-resistant: a client can add its own X-Forwarded-For entries, so a trusted
 // proxy chain can carry attacker-chosen leading values. Trust the header only when
 // it holds exactly one entry (a proxy that overwrote it, or an unspoofed append).
 // Anything longer falls back to the direct peer address.
 function clientIp(req,trustProxy){
  if(trustProxy){const xff=req.headers['x-forwarded-for'];if(typeof xff==='string'){const parts=xff.split(',').map(p=>p.trim()).filter(Boolean);if(parts.length===1)return parts[0];}}
  return req.socket.remoteAddress||'unknown';
 }
 function tryEnter(s,candidate){
  if(!password)return true;
  if(typeof candidate!=='string')return false;
  const a=Buffer.from(candidate),b=Buffer.from(password);
  if(a.length!==b.length||!timingSafeEqual(a,b))return false;
  s.authed=true;return true;
 }
 function suiteAllowed(ip){
  const now=Date.now(),day=new Date().toISOString().slice(0,10);
  if(daily.day!==day)daily={day,count:0};
  const last=ipLastSuite.get(ip)||0;
  if(now-last<SUITE_COOLDOWN_MS)return {ok:false,retryAfter:Math.ceil((SUITE_COOLDOWN_MS-(now-last))/1000)};
  if(daily.count>=DAILY_SUITE_CAP)return {ok:false,retryAfter:3600};
  ipLastSuite.set(ip,now);daily.count++;
  return {ok:true};
 }
 // Artifact hygiene: per-session cap, total directory cap, and TTL. Artifact names are run ids, never visitor data.
 async function sweep(runs){
  try{
   const keep=new Set([...sessions.values()].flatMap(s=>[...s.runs]));
   for(const s of sessions.values()){
    const owned=[...s.runs];
    while(owned.length>SESSION_RUN_CAP){const old=owned.shift();s.runs.delete(old);runs.delete(old);await rm(path.join(artifactRoot,old),{recursive:true,force:true});}
   }
   let names=await readdir(artifactRoot).catch(()=>[]);
   const withTime=[];
   for(const n of names){try{withTime.push({n,t:(await stat(path.join(artifactRoot,n))).mtimeMs});}catch{}}
   withTime.sort((a,b)=>a.t-b.t);
   const now=Date.now();
   for(const {n,t} of withTime){
    if(keep.has(n)&&now-t<RUN_TTL_MS&&names.length<=DIR_CAP)continue;
    if([...runs.values()].some(r=>r.id===n&&['queued','running'].includes(r.status)))continue;
    names=names.filter(x=>x!==n);runs.delete(n);await rm(path.join(artifactRoot,n),{recursive:true,force:true});
   }
  }catch{/* sweep failure never blocks a run */}
 }
 return {session,clientIp,tryEnter,suiteAllowed,sweep};
}
