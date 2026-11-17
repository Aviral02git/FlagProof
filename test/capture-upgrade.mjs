import {chromium} from 'playwright';
import {startServer} from '../src/server.mjs';
import {chromePath} from '../src/runner.mjs';
import {mkdir,mkdtemp,writeFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
const evidence=new URL('../evidence/',import.meta.url).pathname;
await mkdir(evidence,{recursive:true});
const artifactRoot=await mkdtemp(path.join(os.tmpdir(),'flagproof-upgrade-'));
let app=await startServer({port:0,artifactRoot});
const browser=await chromium.launch({headless:true,executablePath:chromePath(),args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:1440,height:1100}});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
try{
 await page.goto(app.origin);await page.getByText('LOCAL FIXTURE · not Flagsmith',{exact:true}).waitFor();
 for(const scenario of ['seeded-interaction','healthy']){
  await page.locator('#scenario').selectOption(scenario);
  await page.getByRole('button',{name:'Prepare reviewable plan'}).click();
  await page.getByRole('button',{name:'Approve & run 8 cases'}).click();
  await page.getByText('✓ Original flags restored and read-back verified.',{exact:true}).waitFor({timeout:60000});
  if(scenario==='seeded-interaction'){
   await page.locator('.subset-evidence summary').click();
   assert.equal(await page.locator('.subset-evidence li').count(),3);
   await page.locator('.finding').screenshot({path:evidence+'upgrade-subset-evidence.png'});
  }
 }
 const state=await fetch(app.origin+'/api/state').then(r=>r.json());
 const healthy=state.recent.find(r=>r.plan.scenario==='healthy'),seeded=state.recent.find(r=>r.plan.scenario==='seeded-interaction');
 await page.locator('#baseline').selectOption(seeded.id);
 await page.getByRole('heading',{name:'0 regressions · 2 improvements'}).waitFor();
 await page.screenshot({path:evidence+'upgrade-comparison-desktop.png',fullPage:true});
 const download=page.waitForEvent('download');await page.getByText('Download readable evidence report ↓',{exact:true}).click();
 const file=await download;await file.saveAs(evidence+'upgrade-readable-report.md');
 const markdown=await fetch(`${app.origin}/artifacts/${healthy.id}/report.md`).then(r=>r.text());assert.match(markdown,/FlagProof evidence report/);
 await page.locator('#history').selectOption(seeded.id);await page.getByRole('heading',{name:'Observed minimal failing set'}).waitFor();
 await page.reload();await page.getByRole('heading',{name:'No failure observed',exact:true}).waitFor();
 await app.close();app=await startServer({port:0,artifactRoot});
 await page.goto(app.origin);await page.getByRole('heading',{name:'No failure observed',exact:true}).waitFor();
 const reloaded=await fetch(app.origin+'/api/state').then(r=>r.json());assert.equal(reloaded.recent.length,2);assert.equal(reloaded.active,null);
 await page.locator('#history').selectOption(seeded.id);await page.getByRole('heading',{name:'Observed minimal failing set'}).waitFor();
 await page.locator('#baseline').selectOption(healthy.id);await page.getByRole('heading',{name:'2 regressions · 0 improvements'}).waitFor();
 for(const width of [390,320]){
  await page.setViewportSize({width,height:1000});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth),width);
  await page.screenshot({path:evidence+`upgrade-history-mobile-${width}.png`,fullPage:true});
 }
 await page.setViewportSize({width:1440,height:1100});await page.locator('.subset-evidence summary').click();
 await page.screenshot({path:evidence+'upgrade-restored-history.png',fullPage:true});
 assert.deepEqual(errors,[]);
 await writeFile(evidence+'upgrade-ui-check.json',JSON.stringify({checkedAt:new Date().toISOString(),artifactRoot,seeded:seeded.id,healthy:healthy.id,restartHistory:true,selectedHistory:true,markdownDownload:true,forwardComparison:{improvements:2,regressions:0},reverseComparison:{regressions:2,improvements:0},subsetEvidence:3,mobileWidths:[390,320],pageErrors:errors},null,2));
 console.log(JSON.stringify({artifactRoot,evidence,seeded:seeded.id,healthy:healthy.id,pageErrors:errors}));
}finally{await browser.close();await app.close();}
