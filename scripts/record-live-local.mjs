import {chromium} from 'playwright';
import {startServer} from '../src/server.mjs';
import {mkdirSync} from 'node:fs';

// LIVE complete take in LOCAL-FIXTURE mode (no .env loaded): real approve -> real suite -> results.
// Usage: node scripts/record-live-local.mjs <seeded-interaction|healthy> [compare]
const scenario=process.argv[2]||'seeded-interaction';
const doCompare=process.argv[3]==='compare';
const out='/tmp/flagproof-rec';mkdirSync(out,{recursive:true});
const app=await startServer({port:0});
const browser=await chromium.launch({headless:true});
const ctx=await browser.newContext({recordVideo:{dir:out,size:{width:1280,height:800}},viewport:{width:1280,height:800}});
const page=await ctx.newPage();
const pause=ms=>page.waitForTimeout(ms);
const center=sel=>page.evaluate(s=>document.querySelector(s)?.scrollIntoView({block:'center'}),sel);

await page.goto(app.origin+'/');
await page.waitForFunction(()=>/local/i.test(document.querySelector('#mode')?.textContent||''),{timeout:60000});
await pause(2000);
await page.selectOption('#scenario',scenario);
await page.click('#generate',{timeout:60000});
await page.waitForFunction(()=>document.querySelector('#plan-hash')?.textContent.trim().length>10,{timeout:60000});
await center('#plan-hash');
await pause(2500);
await page.click('#approve',{timeout:60000});
await pause(2500); // live progress visible
await page.waitForFunction(()=>/completed|error|cancelled/i.test(document.querySelector('#run-status')?.textContent||''),{timeout:90000,polling:500});
await center('#matrix');await pause(2500);
if(doCompare){
 const has=await page.evaluate(()=>document.querySelectorAll('#baseline option').length>1);
 if(has){
  await page.evaluate(()=>{const o=[...document.querySelectorAll('#baseline option')][1];document.querySelector('#baseline').value=o.value;document.querySelector('#baseline').dispatchEvent(new Event('change',{bubbles:true}));});
  await pause(2000);
  await center('#comparison');await pause(4000);
 }
}
await center('#finding');await pause(3500);
await center('#cleanup');await pause(2000);
await center('#downloads');await pause(2500);
await ctx.close();await browser.close();await app.close();
console.log('live local take done:',scenario,doCompare?'with-compare':'');
