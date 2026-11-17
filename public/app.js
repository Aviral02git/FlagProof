const $=s=>document.querySelector(s);
const names=['new_checkout','express_shipping','promo_banner'];
let token,plan,currentRun,lastState;
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
async function api(url,data){const response=await fetch(url,{method:data===undefined?'GET':'POST',headers:{'Content-Type':'application/json','X-Flagproof-Token':token||''},body:data===undefined?undefined:JSON.stringify(data),cache:'no-store'});const result=await response.json();if(!response.ok)throw new Error(result.error||'Request failed');return result;}
function notice(text,error=false){$('#notice').textContent=text;$('#notice').classList.toggle('error',error);}
function pill(el,text,status){el.textContent=text;el.className=`pill ${status}`;}
function renderRun(run){
 currentRun=run;$('#run-meta').textContent=run?`Showing ${run.plan.scenario==='healthy'?'healthy control':'seeded interaction defect'} · run ${run.id.slice(0,8)}. This is the last started suite, not an unrun selection.`:'No suite has run yet.';const results=run?.results?.filter(r=>r.label==='matrix')||[];
 $('#matrix').innerHTML=Array.from({length:8},(_,i)=>{
  const flags=Object.fromEntries(names.map((n,b)=>[n,Boolean(i&(1<<b))]));
  const result=results.find(r=>names.every(n=>r.flags[n]===flags[n]));
  const status=result?.status||'untested';
  const evidence=result?.artifacts?.screenshot?`<a href="/artifacts/${run.id}/${result.artifacts.screenshot}" target="_blank" rel="noopener" aria-label="Screenshot for case ${i+1}">Shot ↗</a>${result.artifacts.trace?`<a href="/artifacts/${run.id}/${result.artifacts.trace}" download aria-label="Trace for case ${i+1}">Trace ↓</a>`:''}`:'<span class="muted">-</span>';
  return `<tr class="row-${esc(status)}"><td class="case">${String(i+1).padStart(2,'0')}</td>${names.map(n=>`<td><span class="flag ${flags[n]?'on':'off'}">${flags[n]?'ON':'OFF'}</span></td>`).join('')}<td><span class="result ${esc(status)}">${esc(status)}</span></td><td class="evidence">${evidence}</td></tr>`;
 }).join('');
 const running=run&&['queued','running'].includes(run.status);
 $('#cancel').hidden=!running;$('#generate').disabled=!!running;$('#scenario').disabled=!!running;
 if(run)pill($('#run-status'),running?`Running · ${results.filter(r=>['pass','fail','invalid','cancelled'].includes(r.status)).length}/8`:run.status,run.status==='completed'?'pass':run.status==='error'?'fail':'neutral');
 $('#run-error').textContent=run?.error||'';
 $('#cleanup').textContent=run?.cleanup?.status==='verified'?'✓ Original flags restored and read-back verified.':run?.cleanup?.status==='failed'?`Restoration failed: ${run.cleanup.error}`:run?.cleanup?.status==='restoring'?'Restoring original flags…':running?'Original state captured. Cleanup will run before completion.':'Flag restoration is verified after each suite, including cancelled runs.';
 $('#cleanup').classList.toggle('error',run?.cleanup?.status==='failed');
 if(run?.finishedAt&&plan?.status==='approved'&&plan.id===run.planId)notice(`Suite ${run.status}. Review the measured results below.`,run.status==='error');
 const summary=run?.summary;
 $('#finding').hidden=!summary;
 if(summary){
  const minimal=summary.minimal?.[0];const failing=minimal?run.results.find(r=>r.id===minimal.runId):null;const price=failing?.assertions?.find(a=>a.name==='correct-total');
  $('#finding').className=`finding ${summary.failedCases?'finding-fail':'finding-pass'}`;
  $('#finding').innerHTML=`<p class="eyebrow">${summary.validCases}/8 VALID · ${summary.passedCases} PASS · ${summary.failedCases} FAIL${summary.invalidCases?` · ${summary.invalidCases} INVALID`:''}</p><h3>${minimal?'Observed minimal failing set':summary.allPassed?'No failure observed':'Evidence is incomplete'}</h3>${minimal?`<div class="flag-set">${minimal.flags.map(n=>`<code>${esc(n)}</code>`).join('<span>+</span>')}</div>${price?`<p>Price assertion: expected <strong>$${esc(price.expected)}</strong>, observed <strong>$${esc(price.observed)}</strong>.</p>`:''}<p>Each proper subset passed. ${run.reproduction?.confirmed?'A fresh browser run reproduced the failure.':'Reproduction not confirmed.'}</p>`:''}<p>${esc(run.reproduction?.confirmed&&summary.minimal.length?'This is a reproduced observation for this checkout and flag matrix, not a causal proof or a production guarantee.':summary.conclusion)}</p>`;
 }
 $('#downloads').hidden=!run?.finishedAt;
 if(run?.finishedAt)$('#downloads').innerHTML=`<a class="text-link" href="/artifacts/${run.id}/report.json" download>Download measured report JSON ↓</a><span class="small">${esc(run.planSource)} · ${esc(run.mode)}</span>`;
}
async function refresh(){try{lastState=await api('/api/state');token=lastState.token;$('#mode').textContent=lastState.modeLabel;$('#planner').textContent=`Plan source: ${lastState.planner}`;const run=lastState.active||lastState.recent[0];if(run)renderRun(run);}catch(error){notice(`Runner unavailable: ${error.message}`,true);}}
$('#generate').onclick=async()=>{
 $('#generate').disabled=true;notice('Preparing a constrained plan for your review…');
 try{plan=await api('/api/plans',{scenario:$('#scenario').value});$('#plan').hidden=false;$('#plan-title').textContent=plan.plan.title;$('#plan-rationale').textContent=plan.plan.rationale;$('#plan-source').textContent=plan.source;$('#plan-json').textContent=JSON.stringify(plan.plan,null,2);$('#plan-hash').textContent=`SHA-256 ${plan.hash}`;pill($('#plan-status'),'Pending review','neutral');$('#approve').disabled=false;$('#reject').disabled=false;notice('Review before running. Preparing this plan has not changed any flags.');}catch(error){notice(error.message,true);}finally{$('#generate').disabled=false;}
};
$('#reject').onclick=async()=>{try{await api(`/api/plans/${plan.id}/reject`,{});plan.status='rejected';pill($('#plan-status'),'Rejected','neutral');$('#approve').disabled=true;$('#reject').disabled=true;notice('Plan rejected. No flags changed and no browser tests ran.');}catch(error){notice(error.message,true);}};
$('#approve').onclick=async()=>{try{const run=await api(`/api/plans/${plan.id}/approve`,{hash:plan.hash});plan.status='approved';pill($('#plan-status'),'Approved','pass');$('#approve').disabled=true;$('#reject').disabled=true;notice('Running the reviewed plan. Fresh browser context for each configuration.');renderRun(run);}catch(error){notice(error.message,true);}};
$('#cancel').onclick=async()=>{try{await api(`/api/runs/${currentRun.id}/cancel`,{});notice('Cancellation requested. Waiting for the current operation and verified cleanup.');}catch(error){notice(error.message,true);}};
renderRun(null);await refresh();setInterval(refresh,700);
