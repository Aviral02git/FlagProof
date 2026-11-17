import {chromium} from 'playwright';
import {startServer} from '../src/server.mjs';
import {chromePath} from '../src/runner.mjs';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const out=new URL('../evidence/',import.meta.url).pathname;await mkdir(out,{recursive:true});
const app=await startServer({port:0});const browser=await chromium.launch({headless:true,executablePath:chromePath(),args:['--no-sandbox']});
try{
 const context=await browser.newContext({viewport:{width:1440,height:1100},deviceScaleFactor:1});const page=await context.newPage();
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(app.origin);await page.getByText('LOCAL FIXTURE · not Flagsmith',{exact:true}).waitFor();
 await page.screenshot({path:out+'01-ready-desktop.png',fullPage:true});
 await page.getByRole('button',{name:'Prepare reviewable plan'}).click();await page.getByRole('button',{name:'Approve & run 8 cases'}).waitFor();
 await page.screenshot({path:out+'02-reviewed-plan.png',fullPage:true});
 await page.getByRole('button',{name:'Approve & run 8 cases'}).click();
 await page.getByText('✓ Original flags restored and read-back verified.',{exact:true}).waitFor({timeout:60000});
 await page.getByText('A fresh browser run reproduced the failure.',{exact:false}).waitFor();
 await page.screenshot({path:out+'03-seeded-desktop.png',fullPage:true});
 let state=await fetch(app.origin+'/api/state').then(r=>r.json());const seeded=state.recent[0];assert.equal(seeded.summary.failedCases,2);assert.equal(seeded.reproduction.confirmed,true);
 await writeFile(out+'seeded-report.json',JSON.stringify(seeded,null,2));
 // Save screenshot of failing browser target, not an invented mock-up.
 const fail=seeded.results.find(r=>r.status==='fail');
 const bytes=await fetch(`${app.origin}/artifacts/${seeded.id}/${fail.artifacts.screenshot}`).then(r=>r.arrayBuffer());await writeFile(out+'04-failing-checkout.png',Buffer.from(bytes));
 for(const width of [1280,390,320]){
  await page.setViewportSize({width,height:1000});await page.screenshot({path:out+`05-seeded-mobile-${width}.png`,fullPage:true});
  const overflow=await page.evaluate(()=>({doc:document.documentElement.scrollWidth,viewport:innerWidth}));assert.equal(overflow.doc,overflow.viewport,`Page overflows at ${width}`);
 }
 await page.setViewportSize({width:1440,height:1100});
 await page.locator('#scenario').selectOption('healthy');await page.getByRole('button',{name:'Prepare reviewable plan'}).click();await page.getByRole('button',{name:'Approve & run 8 cases'}).waitFor({state:'visible'});await page.getByRole('button',{name:'Approve & run 8 cases'}).click();
 await page.getByRole('heading',{name:'No failure observed',exact:true}).waitFor({timeout:60000});
 await page.getByText('✓ Original flags restored and read-back verified.',{exact:true}).waitFor();
 await page.screenshot({path:out+'06-healthy-desktop.png',fullPage:true});state=await fetch(app.origin+'/api/state').then(r=>r.json());assert.equal(state.recent[0].summary.passedCases,8);await writeFile(out+'healthy-report.json',JSON.stringify(state.recent[0],null,2));
 await page.getByRole('button',{name:'Prepare reviewable plan'}).click();await page.getByRole('button',{name:'Reject',exact:true}).click();await page.getByText('Plan rejected. No flags changed and no browser tests ran.',{exact:true}).waitFor();
 assert.deepEqual(errors,[]);await writeFile(out+'ui-check.json',JSON.stringify({checkedAt:new Date().toISOString(),desktop:1440,additionalDesktop:1280,mobileWidths:[390,320],horizontalPageOverflow:false,pageErrors:errors,seededRun:seeded.id,healthyRun:state.recent[0].id,reviewedPlan:true,rejectWithoutRun:true},null,2));
 console.log(JSON.stringify({origin:app.origin,evidence:out,seededRun:seeded.id,healthyRun:state.recent[0].id,pageErrors:errors},null,2));
}finally{await browser.close();await app.close();}
