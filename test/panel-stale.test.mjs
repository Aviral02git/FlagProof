import test from 'node:test';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {startServer} from '../src/server.mjs';
import {chromePath} from '../src/runner.mjs';
// Regression: valid draft -> reject -> invalid draft must not leave the old proposal looking current.
test('refused draft clears the previous proposal, checks and actions',async()=>{
 const app=await startServer({port:0});const browser=await chromium.launch({headless:true,executablePath:chromePath(),args:['--no-sandbox']});
 try{
  const page=await browser.newPage();let n=0;
  await page.route('**/api/experiments/propose',route=>{n++;
   if(n===1)return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({id:'exp-test',source:'test stub',requestText:'half',explain:{summary:'OLD SUMMARY 50/25/25',rows:[]},requestCheck:[{ok:true,claim:'old claim',actual:'x'}],attempts:[],executor:{label:'test'}})});
   return route.fulfill({status:400,contentType:'application/json',body:JSON.stringify({error:'AI returned an invalid experiment proposal. Nothing will run.'})});});
  await page.route('**/api/experiments/exp-test/reject',route=>route.fulfill({status:200,contentType:'application/json',body:'{}'}));
  await page.evaluate(()=>0).catch(()=>0);
  await page.goto(app.origin);await page.locator('#agent-request').evaluate(e=>{e.disabled=false;});await page.locator('#agent-request').fill('half');
  await page.locator('#agent-draft').click();await page.getByText('OLD SUMMARY 50/25/25').waitFor();
  await page.locator('#agent-reject').click();await page.getByText('Rejected. Nothing was recorded or changed.').waitFor();
  await page.locator('#agent-draft').click();await page.locator('#agent-notice.error').waitFor();
  assert.equal(await page.locator('#agent-proposal').isHidden(),true,'old proposal must be hidden');
  assert.doesNotMatch(await page.locator('#agent-proposal').textContent(),/OLD SUMMARY|old claim|your request: "half"/);
  assert.equal(await page.locator('#agent-approve').isDisabled(),true);
  assert.equal(await page.locator('#agent-reject').isDisabled(),true);
  assert.match(await page.locator('#agent-notice').innerText(),/Nothing will run/);
 }finally{await browser.close();await app.close?.();}
});
