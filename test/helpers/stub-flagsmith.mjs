import {createServer} from 'node:http';
import {createHash} from 'node:crypto';
import {EXPERIMENT_FLAG,EXPERIMENT_VARIANTS} from '../../src/experiment-config.mjs';

// Local stand-in for the Flagsmith remote-evaluation and events APIs. Lets the
// real SDK and CLI run end to end with no network and no account contact.
// Deterministic per-identity bucketing, like Flagsmith's own hash split.
export function bucketVariant(identifier,variants=EXPERIMENT_VARIANTS){
 const h=createHash('sha256').update(`bucket:${identifier}`).digest();
 const pct=(h.readUInt32BE(0)/0xffffffff)*100;
 // The Track-01 default keeps the real experiment's 34/33/33 weights; any
 // other variation set (for example the A/A twins) splits evenly.
 const weights=variants===EXPERIMENT_VARIANTS?variants.map(v=>v.key==='control'?34:33):variants.map(()=>100/variants.length);
 let acc=0;
 for(let i=0;i<variants.length;i++){acc+=weights[i];if(pct<acc)return variants[i].key;}
 return variants[variants.length-1].key;
}

export async function startStubFlagsmith({flag=EXPERIMENT_FLAG,variants=EXPERIMENT_VARIANTS}={}){
 const requests=[];const events=[];
 const server=createServer((req,res)=>{
  let body='';req.on('data',c=>body+=c);req.on('end',()=>{
   requests.push({method:req.method,url:req.url});
   if(req.method==='POST'&&req.url==='/api/v1/identities/'){
    const {identifier}=JSON.parse(body||'{}');
    const variant=bucketVariant(identifier,variants);
    res.setHeader('Content-Type','application/json');
    res.end(JSON.stringify({identifier,traits:[],flags:[{
     feature:{id:1,name:flag},
     enabled:true,
     feature_state_value:variant,
     variant,
     metadata:{experiment:{id:999,name:'Stub experiment',in_experiment:true}},
    }]}));
    return;
   }
   if(req.method==='POST'&&req.url?.split('?')[0].replace(/\/$/,'')==='/api/v1/events'){
    try{const p=JSON.parse(body||'{}');events.push(...(Array.isArray(p)?p:p.events||[]));}catch{events.push(body);}
    res.setHeader('Content-Type','application/json');res.end('{}');return;
   }
   res.statusCode=404;res.end('{"detail":"not found"}');
  });
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const port=server.address().port;
 return {server,port,requests,events,apiUrl:`http://127.0.0.1:${port}/api/v1/`,eventsApiBase:`http://127.0.0.1:${port}/api/`,close:()=>new Promise(r=>server.close(r))};
}
