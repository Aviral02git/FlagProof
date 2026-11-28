// Absolute percentage-point difference for the recorded Track 01 run (experiment 399).
// Our own calculation, not Flagsmith's. Inputs: the exact SDK counts sent, from
// evidence/experiment-399/run-report.json (trafficRun.sentCounts). Synthetic visitors.
// Model: independent Beta(1,1) priors on each arm's conversion rate. Seeded Monte Carlo.
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
const SEED=7, DRAWS=200000, THRESHOLD_PP=10;
function rng(seed){let a=seed>>>0;return()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
function normal(r){let u=0,v=0;while(u===0)u=r();v=r();return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v);}
function gamma(shape,r){const d=shape-1/3,c=1/Math.sqrt(9*d);for(;;){let x,v;do{x=normal(r);v=1+c*x;}while(v<=0);v=v*v*v;const u=r();if(u<1-0.0331*x**4||Math.log(u)<0.5*x*x+d*(1-v+Math.log(v)))return d*v;}}
function beta(a,b,r){const x=gamma(a,r),y=gamma(b,r);return x/(x+y);}
export function analyse(counts,{seed=SEED,draws=DRAWS,thresholdPp=THRESHOLD_PP}={}){
  const r=rng(seed),c=counts.control,out={};
  for(const key of Object.keys(counts).filter(k=>k!=='control')){
    const v=counts[key],diffs=[];
    for(let i=0;i<draws;i++)diffs.push(100*(beta(1+v.conversions,1+v.exposures-v.conversions,r)-beta(1+c.conversions,1+c.exposures-c.conversions,r)));
    diffs.sort((x,y)=>x-y);const q=p=>diffs[Math.floor(p*(draws-1))];
    out[key]={meanPp:+(diffs.reduce((s,x)=>s+x,0)/draws).toFixed(1),ci95Pp:[+q(0.025).toFixed(1),+q(0.975).toFixed(1)],probAboveZero:+(diffs.filter(x=>x>0).length/draws).toFixed(3),probAtLeastThreshold:+(diffs.filter(x=>x>=thresholdPp).length/draws).toFixed(3)};
  }
  return {model:'independent Beta(1,1) priors, seeded Monte Carlo',seed,draws,thresholdPp,counts,results:out};
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
  const run=JSON.parse(readFileSync(new URL('../evidence/experiment-399/run-report.json',import.meta.url)));
  console.log(JSON.stringify(analyse(run.trafficRun.sentCounts),null,2));
}
