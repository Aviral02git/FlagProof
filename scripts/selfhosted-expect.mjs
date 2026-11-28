// Fail-closed check for a self-hosted matrix run. Two different things are checked:
// 1. the harness finished cleanly (run completed, flags restored and read back), and
// 2. the planted defect showed up as expected (6 pass, 3 fail, reproduction confirmed).
// A run that errors part-way is never a success, even if the script itself did not crash.
export const EXPECTED={total:9,pass:6,fail:3};
export function judgeRun(summary,reproduction){
  const problems=[];
  if(summary?.status!=='completed')problems.push(`harness status is "${summary?.status}", not "completed"`);
  if(summary?.cleanup?.status!=='verified')problems.push(`flag restore is "${summary?.cleanup?.status}", not "verified"${summary?.cleanup?.error?`: ${summary.cleanup.error}`:''}`);
  for(const k of ['total','pass','fail'])if(summary?.[k]!==EXPECTED[k])problems.push(`${k} is ${summary?.[k]}, expected ${EXPECTED[k]}`);
  if(reproduction?.confirmed!==true)problems.push('the reproduction run did not confirm the failure');
  return {ok:problems.length===0,problems};
}
