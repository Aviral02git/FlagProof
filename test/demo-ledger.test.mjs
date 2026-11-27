import test from 'node:test';
import assert from 'node:assert/strict';
import {createLedger} from '../src/demo-ledger.mjs';
const mem=(v=null)=>({v,read:async()=>mem.v??null,write:async x=>{mem.v=x;}});
const mk=(init,o={})=>{const s={v:init,read:async()=>s.v,write:async x=>{s.v=x;}};return {s,l:createLedger({store:s,monthlyIdentityCeiling:450,now:()=>Date.parse('2026-11-27T10:00:00Z'),...o})};};
test('reserves until the ceiling, then refuses as budget',async()=>{
 const {l}=mk(JSON.stringify({month:'2026-11',identities:0,runs:0}));
 for(let i=1;i<=3;i++)assert.equal((await l.reserve()).identitiesThisMonth,150*i);
 assert.equal((await l.reserve()).reason,'budget');
});
test('a new month starts from zero',async()=>{
 const {l}=mk(JSON.stringify({month:'2026-10',identities:450,runs:3}));
 assert.equal((await l.reserve()).ok,true);
});
test('unparseable, malformed, throwing or non-landing stores fail closed',async()=>{
 for(const bad of ['{nope','{"month":"2026-11","identities":-1,"runs":0}','{"month":5}']){const {l}=mk(bad);assert.equal((await l.reserve()).reason,'state-unavailable');}
 const t=createLedger({store:{read:async()=>{throw new Error('x');},write:async()=>{}},monthlyIdentityCeiling:450});assert.equal((await t.reserve()).reason,'state-unavailable');
 const lost=createLedger({store:{read:async()=>null,write:async()=>{}},monthlyIdentityCeiling:450});assert.equal((await lost.reserve()).reason,'state-unavailable');
});
test('constructor refuses a ceiling smaller than one run',()=>{assert.throws(()=>createLedger({store:mem(),monthlyIdentityCeiling:100}),/ceiling/);});

test('an empty ledger is refused (not read as zero usage), and the seed note survives reservations',async()=>{
 assert.equal((await mk(null).l.reserve()).reason,'state-unavailable');assert.equal((await mk('').l.reserve()).reason,'state-unavailable');
 const {l,s}=mk(JSON.stringify({month:'2026-11',identities:300,runs:2,seed:'prior runs counted'}));await l.reserve();assert.equal(JSON.parse(s.v).seed,'prior runs counted');
});
