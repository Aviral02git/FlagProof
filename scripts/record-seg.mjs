import {chromium} from 'playwright';
import {startServer} from '../src/server.mjs';
import {loadDotEnv} from '../src/env.mjs';
import {mkdirSync} from 'node:fs';

// Segment recorder. Usage: node scripts/record-seg.mjs <plan|complete> [scenario]
//  plan:     dashboard -> prepare -> review JSON -> approve -> ~12s live progress (run may be interrupted at cut; history keeps it honest)
//  complete: fresh server -> prepare+approve immediately -> wait completion -> matrix/finding/cleanup/downloads
const seg=process.argv[2]||'plan';
const scenario=process.argv[3]||'seeded-interaction';
const out='/tmp/flagproof-rec';
mkdirSync(out,{recursive:true});
await loadDotEnv();
const app=await startServer({port:0});
const browser=await chromium.launch({headless:true});
const ctx=await browser.newContext({recordVideo:{dir:out,size:{width:1280,height:800}},viewport:{width:1280,height:800}});
const page=await ctx.newPage();
const pause=ms=>page.waitForTimeout(ms);
const center=sel=>page.evaluate(s=>document.querySelector(s).scrollIntoView({block:'center'}),sel);

await page.goto(app.origin+'/');
await page.waitForFunction(()=>document.querySelector('#mode')?.textContent.trim().length>0,{timeout:60000});
await pause(3000);

await page.selectOption('#scenario',scenario);
await page.click('#generate',{timeout:120000});
await page.waitForFunction(()=>document.querySelector('#plan-hash')?.textContent.trim().length>10,{timeout:60000});

if(seg==='plan'){
 await page.click('details summary',{timeout:60000});
 await center('#plan-hash');
 await pause(6000);
 await center('#approve');
 await pause(2500); // hold on the approval gate; the complete take shows the approve click + run
}else{
 await page.click('#approve',{timeout:60000});
 await page.waitForFunction(()=>/completed|error|cancelled/i.test(document.querySelector('#run-status')?.textContent||''),{timeout:100000,polling:1000});
 await center('#matrix');
 await pause(3000);
 await center('#finding');
 await pause(4000);
 await center('#cleanup');
 await pause(2500);
 await center('#downloads');
 await pause(3000);
}

await ctx.close();await browser.close();await app.close();
console.log('seg',seg,scenario,'done');
