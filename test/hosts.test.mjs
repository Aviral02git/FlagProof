import test from 'node:test';
import assert from 'node:assert/strict';
import {flagsmithHosts} from '../src/hosts.mjs';
import {verifyFlagsmithEnvironment} from '../src/flagsmith-check.mjs';
test('default hosts are Flagsmith Cloud',()=>{const h=flagsmithHosts({});assert.equal(h.selfHosted,false);assert.equal(h.flagsUrl,'https://edge.api.flagsmith.com/api/v1/flags/');assert.equal(h.environmentsUrl,'https://api.flagsmith.com/api/__future__/environments');});
test('self-hosted URL moves SDK and management calls to one host',()=>{const h=flagsmithHosts({FLAGSMITH_API_URL:'http://localhost:8000/api/v1'});assert.equal(h.selfHosted,true);assert.equal(h.sdkApi,'http://localhost:8000/api/v1/');assert.equal(h.flagsUrl,'http://localhost:8000/api/v1/flags/');assert.equal(h.environmentsUrl,'http://localhost:8000/api/__future__/environments');assert.equal(h.origin,'http://localhost:8000');});
test('bad or non-http FLAGSMITH_API_URL is rejected',()=>{assert.throws(()=>flagsmithHosts({FLAGSMITH_API_URL:'nope'}),/not a valid URL/);assert.throws(()=>flagsmithHosts({FLAGSMITH_API_URL:'ftp://x/api/v1/'}),/http or https/);});
test('environment check calls only the self-hosted host when configured',async()=>{
 const urls=[];const flags=['new_checkout','express_shipping','promo_banner'].map((name,i)=>({feature:{name,id:i+1}}));
 const fetchFn=async(url)=>{urls.push(url);if(url.includes('/flags/'))return {ok:true,json:async()=>flags};return {ok:true,json:async()=>({environment_default:{enabled:false,variants:[]},segment_overrides:[]})};};
 await verifyFlagsmithEnvironment({environment:'ENV',management:'KEY',fetchFn,env:{FLAGSMITH_API_URL:'http://localhost:8000/api/v1/'}});
 assert.ok(urls.length===4&&urls.every(u=>u.startsWith('http://localhost:8000/')),urls.join(' '));
});
