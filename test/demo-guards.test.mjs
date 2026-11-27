import test from 'node:test';
import assert from 'node:assert/strict';
import {buildDemoGuards,PROVISIONAL_MONTHLY_IDENTITY_CEILING} from '../src/demo-guards.mjs';
const base={FLAGPROOF_DEMO_DURABLE:'1',FLAGSMITH_ORG_ID:'1',FLAGSMITH_LEDGER_FEATURE_ID:'2',FLAGSMITH_MANAGEMENT_KEY:'k',FLAGSMITH_ENVIRONMENT_KEY:'E',FLAGSMITH_MANAGEMENT_URL:'https://api.flagsmith.com/api/v1/'};
test('off by default; on only with explicit flag; missing config throws instead of silently running unguarded',()=>{
 assert.deepEqual(buildDemoGuards({}),{});
 const g=buildDemoGuards(base);assert.ok(g.gate&&g.ledger);assert.equal(typeof g.gate.owns,'function');
 for(const k of ['FLAGSMIT_X','FLAGSMITH_ORG_ID','FLAGSMITH_LEDGER_FEATURE_ID','FLAGSMITH_MANAGEMENT_KEY'])if(k in base){const e={...base};delete e[k];assert.throws(()=>buildDemoGuards(e),/required/);}
 assert.equal(PROVISIONAL_MONTHLY_IDENTITY_CEILING,10000);
});
