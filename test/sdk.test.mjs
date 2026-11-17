import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {chromium} from 'playwright';
import {startServer} from '../src/server.mjs';
import {chromePath} from '../src/runner.mjs';
import {LocalFixtureAdapter} from '../src/flags.mjs';
import {FLAG_NAMES} from '../src/core.mjs';
async function check(names){
 const adapter=new LocalFixtureAdapter();adapter.mode='flagsmith';adapter.label='Simulated SDK test, not live';adapter.publicConfig=()=>({mode:'flagsmith',label:adapter.label,environmentID:'nonfunctional-sdk-test-key',api:'https://edge.api.flagsmith.com/api/v1/'});
 const artifactRoot=await mkdtemp(path.join(os.tmpdir(),'flagproof-sdk-'));const app=await startServer({port:0,artifactRoot,adapter});const browser=await chromium.launch({headless:true,executablePath:chromePath(),args:['--no-sandbox']});
 try{
  const page=await browser.newPage();await page.route('https://edge.api.flagsmith.com/**',route=>route.fulfill({status:200,contentType:'application/json',headers:{'Access-Control-Allow-Origin':'*'},body:JSON.stringify(names.map(name=>({feature:{name,type:'STANDARD'},enabled:false,feature_state_value:null})))}));
  await page.goto(app.origin+'/demo');await page.waitForFunction(()=>window.flagproofReady||document.querySelector('#setup-error').textContent);
  return {ready:await page.evaluate(()=>window.flagproofReady),error:await page.locator('#setup-error').textContent(),resolved:await page.evaluate(()=>window.resolvedFlags)};
 }finally{await browser.close();await app.close();}
}
test('real SDK bundle accepts all three present false flags using simulated SDK HTTP responses',async()=>{const result=await check(FLAG_NAMES);assert.equal(result.ready,true);assert.deepEqual(result.resolved,Object.fromEntries(FLAG_NAMES.map(n=>[n,false])));assert.equal(result.error,'');});
test('missing SDK flags are invalid setup, never mistaken for valid false flags',async()=>{const result=await check(FLAG_NAMES.slice(0,2));assert.equal(result.ready,false);assert.match(result.error,/missing or invalid/);assert.equal(result.resolved,undefined);});
