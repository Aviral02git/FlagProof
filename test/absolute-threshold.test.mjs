import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {analyse} from '../scripts/absolute-threshold.mjs';
const run=JSON.parse(readFileSync(new URL('../test/fixtures/run-report-399.json',import.meta.url)));
test('absolute difference from exact sent counts, seeded and repeatable',()=>{
  const c=run.trafficRun.sentCounts;
  assert.equal(c.control.exposures+c.buy_now.exposures+c.get_it_today.exposures,450);
  assert.equal(c.control.conversions+c.buy_now.conversions+c.get_it_today.conversions,188);
  const a=analyse(c,{draws:40000}),b=analyse(c,{draws:40000});
  assert.deepEqual(a,b);
  const r=a.results.buy_now;
  assert.ok(r.meanPp>12.5&&r.meanPp<15);
  assert.ok(r.ci95Pp[0]>2&&r.ci95Pp[0]<4&&r.ci95Pp[1]>23&&r.ci95Pp[1]<26);
  assert.ok(r.probAtLeastThreshold>0.7&&r.probAtLeastThreshold<0.8);
});
