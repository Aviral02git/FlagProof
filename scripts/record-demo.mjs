import {chromium} from 'playwright';
import {startServer} from '../src/server.mjs';
import {loadDotEnv} from '../src/env.mjs';
import {mkdirSync,writeFileSync} from 'node:fs';

// Records the FlagProof demo flow in FLAGSMITH mode (requires .env from setup).
// One continuous take with wall-clock markers for later cutting/speedup.
// Usage: node scripts/record-demo.mjs [outdir]

const out=process.argv[2]||'/tmp/flagproof-rec';
mkdirSync(out,{recursive:true});
await loadDotEnv();
const app=await startServer({port:0});
const markers=[];
const t0=Date.now();
const mark=name=>{markers.push({name,at:((Date.now()-t0)/1000).toFixed(1)});console.log(`[${((Date.now()-t0)/1000).toFixed(1)}s] ${name}`);};

const browser=await chromium.launch({headless:true});
const ctx=await browser.newContext({recordVideo:{dir:out,size:{width:1280,height:800}},viewport:{width:1280,height:800}});
const page=await ctx.newPage();
const pause=ms=>page.waitForTimeout(ms);

async function runScenario(scenario){
 await page.selectOption('#scenario',scenario);
 mark(`prepare-${scenario}`);
 await page.click('#generate',{timeout:120000});
 await page.waitForFunction(()=>document.querySelector('#plan-hash')?.textContent.trim().length>10,{timeout:30000});
 await page.click('details summary',{timeout:60000});
 await page.evaluate(()=>document.querySelector('#plan-hash').scrollIntoView({block:'center'}));
 await pause(5000);
 mark(`approve-${scenario}`);
 await page.click('#approve',{timeout:120000});
 await page.waitForFunction(()=>/completed|error|cancelled/i.test(document.querySelector('#run-status')?.textContent||''),{timeout:300000,polling:1000});
 mark(`done-${scenario}`);
 await page.evaluate(()=>document.querySelector('#matrix').scrollIntoView({block:'center'}));
 await pause(4000);
}

mark('open-dashboard');
await page.goto(app.origin+'/');
await page.waitForFunction(()=>document.querySelector('#mode')?.textContent.trim().length>0,{timeout:30000});
await pause(4000);

await runScenario('seeded-interaction');
await page.evaluate(()=>document.querySelector('#finding').scrollIntoView({block:'center'}));
await pause(5000);
mark('show-finding');
await page.evaluate(()=>document.querySelector('#cleanup').scrollIntoView({block:'center'}));
await pause(3000);

await runScenario('healthy');
await page.evaluate(()=>document.querySelector('#comparison').scrollIntoView({block:'center'}));
await pause(4000);
mark('show-comparison');
await page.evaluate(()=>document.querySelector('#downloads').scrollIntoView({block:'center'}));
await pause(4000);
mark('end');

writeFileSync(`${out}/markers.json`,JSON.stringify(markers,null,1));
await ctx.close();await browser.close();await app.close();
console.log('recorded to',out);
