import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {verifyFlagsmithEnvironment,envFileContents} from '../src/flagsmith-check.mjs';
import {loadDotEnv} from '../src/env.mjs';
import {FLAG_NAMES} from '../src/core.mjs';

const IDS={new_checkout:101,express_shipping:102,promo_banner:103};
const ENV='env-key-123';
const MGMT='mgmt-secret-456';

function okJson(body){return {ok:true,status:200,json:async()=>body};}
function edgeBody(ids=IDS){return FLAG_NAMES.map(name=>({feature:{name,id:ids[name],type:'STANDARD'},enabled:false,feature_state_value:null}));}
function adminBody(overrides={}){return {environment_default:{enabled:false,variants:[],...overrides},segment_overrides:[],...overrides.seg?{segment_overrides:overrides.seg}:{}};}

function fakeFetch({edge=edgeBody(),admin=adminBody(),edgeStatus=200,adminStatus=200}={}){
 const calls=[];
 const fn=async(url,init={})=>{
  calls.push({url:String(url),headers:init.headers||{}});
  if(String(url).includes('edge.api.flagsmith.com'))return edgeStatus===200?okJson(edge):{ok:false,status:edgeStatus,json:async()=>({})};
  return adminStatus===200?okJson(admin):{ok:false,status:adminStatus,json:async()=>({})};
 };
 fn.calls=calls;
 return fn;
}

test('positive path: discovers all three flag IDs and returns them',async()=>{
 const fetchFn=fakeFetch();
 const {featureIds}=await verifyFlagsmithEnvironment({environment:ENV,management:MGMT,fetchFn});
 assert.deepEqual(featureIds,IDS);
 assert.equal(fetchFn.calls.length,1+FLAG_NAMES.length);
});

test('positive path: sends environment key to edge API and management key to admin API, never the reverse',async()=>{
 const fetchFn=fakeFetch();
 await verifyFlagsmithEnvironment({environment:ENV,management:MGMT,fetchFn});
 const edge=fetchFn.calls.find(c=>c.url.includes('edge.api.flagsmith.com'));
 const adminCalls=fetchFn.calls.filter(c=>!c.url.includes('edge.api.flagsmith.com'));
 assert.equal(edge.headers['X-Environment-Key'],ENV);
 assert.equal(edge.headers.Authorization,undefined);
 for(const c of adminCalls){
  assert.equal(c.headers.Authorization,`Api-Key ${MGMT}`);
  assert.ok(!String(c.url).includes(MGMT),'management key must not appear in URLs');
  assert.ok(!String(c.url).includes('edge.api'));
 }
});

test('missing a required flag fails with its name and dashboard guidance',async()=>{
 const ids={...IDS};delete ids.promo_banner;
 await assert.rejects(verifyFlagsmithEnvironment({environment:ENV,management:MGMT,fetchFn:fakeFetch({edge:edgeBody(ids)})}),/promo_banner.*plain boolean flags/s);
});

test('edge 401/404 errors name the environment key',async()=>{
 await assert.rejects(verifyFlagsmithEnvironment({environment:ENV,management:MGMT,fetchFn:fakeFetch({edgeStatus:404})}),/check the environment key/);
});

test('management 403 names the management key',async()=>{
 await assert.rejects(verifyFlagsmithEnvironment({environment:ENV,management:MGMT,fetchFn:fakeFetch({adminStatus:403})}),/check the management key/);
});

test('flags with segment overrides are rejected',async()=>{
 const admin={environment_default:{enabled:false,variants:[]},segment_overrides:[{id:1}]};
 await assert.rejects(verifyFlagsmithEnvironment({environment:ENV,management:MGMT,fetchFn:fakeFetch({admin})}),/segment overrides/);
});

test('flags with variants are rejected',async()=>{
 const admin={environment_default:{enabled:false,variants:[{id:1}]},segment_overrides:[]};
 await assert.rejects(verifyFlagsmithEnvironment({environment:ENV,management:MGMT,fetchFn:fakeFetch({admin})}),/variants/);
});

test('non-boolean or malformed flag shapes are rejected',async()=>{
 const admin={environment_default:{enabled:'yes'},segment_overrides:[]};
 await assert.rejects(verifyFlagsmithEnvironment({environment:ENV,management:MGMT,fetchFn:fakeFetch({admin})}),/unexpected shape/);
});

test('empty keys are rejected before any network call',async()=>{
 const fetchFn=fakeFetch();
 await assert.rejects(verifyFlagsmithEnvironment({environment:'',management:MGMT,fetchFn}),/Both keys are required/);
 assert.equal(fetchFn.calls.length,0);
});

test('env file contents contain the keys but no quotes or extra fields',async()=>{
 const text=envFileContents({environment:ENV,management:MGMT,featureIds:IDS});
 assert.match(text,/FLAGPROOF_MODE=flagsmith/);
 assert.match(text,new RegExp(`FLAGSMITH_MANAGEMENT_KEY=${MGMT}`));
 assert.match(text,/FLAGSMITH_FEATURE_IDS=\{"new_checkout":101,"express_shipping":102,"promo_banner":103\}/);
});

test('.env round trip: loader reads what envFileContents writes',async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'flagproof-env-'));
 await writeFile(path.join(dir,'.env'),envFileContents({environment:ENV,management:MGMT,featureIds:IDS}));
 const saved={...process.env};
 try{
  for(const k of Object.keys(process.env))if(k.startsWith('FLAGSMITH_')||k.startsWith('FLAGPROOF_'))delete process.env[k];
  assert.equal(await loadDotEnv(dir),true);
  assert.equal(process.env.FLAGSMITH_MANAGEMENT_KEY,MGMT);
  assert.deepEqual(JSON.parse(process.env.FLAGSMITH_FEATURE_IDS),IDS);
 }finally{for(const k of Object.keys(process.env))if(k.startsWith('FLAGSMITH_')||k.startsWith('FLAGPROOF_'))delete process.env[k];Object.assign(process.env,saved);}
});

test('loader: missing file returns false, real env wins, quotes and comments handled',async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'flagproof-env-'));
 assert.equal(await loadDotEnv(dir),false);
 await writeFile(path.join(dir,'.env'),'FP_A=1\nFP_B="two"\n# comment\n\nFP_A=must-not-override\n bad line\n');
 process.env.FP_A='preset';
 try{
  await loadDotEnv(dir);
  assert.equal(process.env.FP_A,'preset');
  assert.equal(process.env.FP_B,'two');
 }finally{delete process.env.FP_A;delete process.env.FP_B;}
});

test('repo .gitignore covers .env so secrets cannot be committed',async()=>{
 const gitignore=await readFile(new URL('../.gitignore',import.meta.url),'utf8');
 const lines=gitignore.split(/\r?\n/).map(l=>l.trim());
 assert.ok(lines.includes('.env'),'.env must be ignored');
});

test('no secret leakage: verification errors never contain key material',async()=>{
 for(const fetchFn of [fakeFetch({edgeStatus:404}),fakeFetch({adminStatus:403}),fakeFetch({edge:edgeBody({new_checkout:101,express_shipping:102})})]){
  try{await verifyFlagsmithEnvironment({environment:ENV,management:MGMT,fetchFn});assert.fail('should reject');}
  catch(error){
   assert.ok(!error.message.includes(MGMT),'error leaks management key');
   assert.ok(!error.message.includes(ENV),'error leaks environment key');
  }
 }
});
