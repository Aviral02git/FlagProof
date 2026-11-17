import {z} from 'zod';
import {createHash,randomUUID} from 'node:crypto';
export const FLAG_NAMES=['new_checkout','express_shipping','promo_banner'];
export const FlagState=z.object(Object.fromEntries(FLAG_NAMES.map(n=>[n,z.boolean()]))).strict();
export const PlanSchema=z.object({
  title:z.string().min(1).max(120),
  target:z.literal('local-checkout'),
  scenario:z.enum(['seeded-interaction','healthy']),
  flags:z.tuple([z.literal('new_checkout'),z.literal('express_shipping'),z.literal('promo_banner')]),
  actions:z.tuple([z.literal('add-item'),z.literal('complete-checkout')]),
  assertions:z.tuple([z.literal('order-confirmed'),z.literal('correct-total')]),
  rationale:z.string().min(1).max(1200)
}).strict();
export function matrix(){return Array.from({length:8},(_,i)=>Object.fromEntries(FLAG_NAMES.map((n,b)=>[n,Boolean(i&(1<<b))])));}
export function expectedTotal(flags){return 100+(flags.express_shipping?15:5);}
export function fixtureTotal(flags,scenario){const correct=expectedTotal(flags);return correct+(scenario==='seeded-interaction'&&flags.new_checkout&&flags.express_shipping?15:0);}
export function fingerprint(value){return createHash('sha256').update(JSON.stringify(value)).digest('hex');}
export function makePlan(scenario='seeded-interaction'){return PlanSchema.parse({title:'Check cart total across three feature flags',target:'local-checkout',scenario,flags:FLAG_NAMES,actions:['add-item','complete-checkout'],assertions:['order-confirmed','correct-total'],rationale:'Cover all eight combinations. The independent price contract is one $100 item plus standard $5 or express $15 shipping. Confirm the order and compare the payable total.'});}
export function reviewRecord(plan,source='manual-template'){const valid=PlanSchema.parse(plan);return {id:randomUUID(),plan:valid,hash:fingerprint(valid),source,createdAt:new Date().toISOString(),status:'pending-review'};}
export function summarize(results){
 const valid=results.filter(r=>r.setup==='valid'&&['pass','fail'].includes(r.status));
 const distinct=new Set(valid.map(r=>JSON.stringify(FLAG_NAMES.map(n=>r.flags[n])))).size;
 const failures=valid.filter(r=>r.status==='fail');
 const allPassed=valid.length===8&&distinct===8&&valid.every(r=>r.status==='pass');
 // A flag set is an observed minimal reproducer only if all of its proper subsets passed.
 const minimal=[];
 for(const fail of failures){
  const enabled=FLAG_NAMES.filter(n=>fail.flags[n]);
  const properSubsets=matrix().filter(s=>FLAG_NAMES.every(n=>!s[n]||fail.flags[n])&&FLAG_NAMES.some(n=>s[n]!==fail.flags[n]));
  const subsetRuns=properSubsets.map(s=>valid.find(r=>FLAG_NAMES.every(n=>r.flags[n]===s[n])));
  if(subsetRuns.every(r=>r&&r.status==='pass')) minimal.push({flags:enabled,runId:fail.id,passingNeighbours:subsetRuns.map(r=>r.id)});
 }
 minimal.sort((a,b)=>a.flags.length-b.flags.length);
 return {validCases:valid.length,invalidCases:results.filter(r=>r.setup!=='valid').length,failedCases:failures.length,passedCases:valid.filter(r=>r.status==='pass').length,allPassed,minimal,conclusion:distinct<8?'Incomplete evidence. Do not infer a clean release.':allPassed?'No failure observed in these eight configurations and this journey. Not proof of overall correctness.':minimal.length?'A minimal failing flag set was observed among the tested configurations. Repeat before trusting the finding.':'Failures observed, but no minimal set could be established.'};
}
