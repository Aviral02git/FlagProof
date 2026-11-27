import test from 'node:test';
import assert from 'node:assert/strict';
import {createFlagsmithLedgerStore} from '../src/demo-ledger-store.mjs';
const fake=state=>async(url,o)=>{state.calls.push(o.method+' '+url);
 if(state.fail)return {ok:false,status:state.fail,text:async()=>''};
 if(o.method==='PATCH'){state.value=JSON.parse(o.body).environment_default.value.value;}
 return {ok:true,status:200,text:async()=>JSON.stringify(state.body??{environment_default:{enabled:false,value:{type:'string',value:state.value},variants:[]}})};};
const mk=s=>createFlagsmithLedgerStore({apiUrl:'https://api.x.test/api/v1/',environmentKey:'E',featureId:7,managementKey:'k',fetchImpl:fake(s)});
test('reads empty as null and round-trips a value through the environment-feature endpoint',async()=>{
 const s={calls:[],value:''};const st=mk(s);assert.equal(await st.read(),null);await st.write('{"a":1}');assert.equal(await st.read(),'{"a":1}');
 assert.ok(s.calls.every(c=>c.includes('https://api.x.test/api/__future__/environments/E/features/7/')));
});
test('bad shape, non-text value and HTTP errors throw',async()=>{
 await assert.rejects(()=>mk({calls:[],body:{}}).read(),/not text/);
 await assert.rejects(()=>mk({calls:[],body:{environment_default:{value:{type:'integer',value:5}}}}).read(),/not text/);
 await assert.rejects(()=>mk({calls:[],fail:500}).read(),/500/);
 await assert.rejects(()=>mk({calls:[],fail:400}).write('x'),/400/);
});
