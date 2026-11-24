import {chromium} from 'playwright';
import {startServer} from '../src/server.mjs';
import {loadDotEnv} from '../src/env.mjs';
import {mkdirSync} from 'node:fs';

// Results take: renders the completed saved run from history (no live writes).
const out='/tmp/flagproof-rec';mkdirSync(out,{recursive:true});
await loadDotEnv();
const app=await startServer({port:0});
const browser=await chromium.launch({headless:true});
const ctx=await browser.newContext({recordVideo:{dir:out,size:{width:1280,height:800}},viewport:{width:1280,height:800}});
const page=await ctx.newPage();
const pause=ms=>page.waitForTimeout(ms);
const center=sel=>page.evaluate(s=>document.querySelector(s)?.scrollIntoView({block:'center'}),sel);

await page.goto(app.origin+'/');
await page.waitForFunction(()=>document.querySelector('#mode')?.textContent.trim().length>0,{timeout:60000});
await page.waitForFunction(()=>document.querySelectorAll('#history option').length>1,{timeout:30000});
await pause(2000);
const val=await page.evaluate(()=>{const o=[...document.querySelectorAll('#history option')].find(o=>/completed/i.test(o.textContent));return o?o.value:null});
if(val){await page.selectOption('#history',val);}
await page.waitForFunction(()=>(document.querySelectorAll('#matrix tr').length>0),{timeout:30000});
await center('#matrix');await pause(4000);
await center('#finding');await pause(5000);
await center('#cleanup');await pause(3000);
await center('#downloads');await pause(3500);
await ctx.close();await browser.close();await app.close();
console.log('results take done, history run:',val);
