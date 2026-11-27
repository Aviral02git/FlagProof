// Bootstraps a FRESH self-hosted Flagsmith for FlagProof using the documented API.
// Usage: FLAGSMITH_API_URL=http://localhost:8000/api/v1/ node scripts/bootstrap-selfhosted.mjs [out.env]
// Creates: first admin user, organisation, project, Development environment, the three
// plain boolean flags FlagProof exercises (default OFF), and a master API key. Writes a
// gitignored .env (mode 600). Refuses to run if the instance already has users.
import {randomBytes} from 'node:crypto';
import {writeFile,chmod} from 'node:fs/promises';
import {flagsmithHosts} from '../src/hosts.mjs';
import {FLAG_NAMES} from '../src/core.mjs';
import {envFileContents} from '../src/flagsmith-check.mjs';
const hosts=flagsmithHosts();
if(!hosts.selfHosted){console.error('Set FLAGSMITH_API_URL to your self-hosted instance (for example http://localhost:8000/api/v1/). Refusing to touch Flagsmith Cloud.');process.exit(2);}
const out=process.argv[2]||'.env';
const base=hosts.sdkApi;
const call=async(method,path,body,token)=>{
 const res=await fetch(base+path,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:`Token ${token}`}:{})},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(30000)});
 const text=await res.text();let data;try{data=JSON.parse(text);}catch{data=text;}
 if(!res.ok)throw new Error(`${method} ${path} -> ${res.status} ${typeof data==='string'?data.slice(0,200):JSON.stringify(data).slice(0,300)}`);
 return data;
};
const version=await fetch(`${hosts.origin}/version/`).then(r=>r.json());
if(version?.self_hosted_data?.has_users)throw new Error('This instance already has users. Bootstrap only runs on a fresh instance; create keys in its dashboard instead.');
const password=randomBytes(18).toString('base64url');
const email='admin@flagproof.local';
const user=await call('POST','auth/users/',{email,password,re_password:password,first_name:'FlagProof',last_name:'Admin',superuser:true});
const token=user.key;
const org=await call('POST','organisations/',{name:'FlagProof self-hosted'},token);
const project=await call('POST','projects/',{name:'FlagProof',organisation:org.id},token);
const env=await call('POST','environments/',{name:'Development',project:project.id},token);
const featureIds={};
for(const name of FLAG_NAMES){const f=await call('POST',`projects/${project.id}/features/`,{name,default_enabled:false,type:'STANDARD'},token);featureIds[name]=f.id;}
const mk=await call('POST',`organisations/${org.id}/master-api-keys/`,{name:'FlagProof',is_admin:true},token);
const lines=envFileContents({environment:env.api_key,management:mk.key,featureIds}).trimEnd().split('\n');
lines.push(`FLAGSMITH_API_URL=${base}`,`# Self-hosted admin login (local playground): ${email} / ${password}`,'');
await writeFile(out,lines.join('\n'),{mode:0o600});await chmod(out,0o600);
console.log(`Self-hosted Flagsmith bootstrapped. org ${org.id}, project ${project.id}, environment ${env.api_key.slice(0,4)}..., flags ${Object.keys(featureIds).join(', ')}. Wrote ${out} (mode 600, not printed).`);
