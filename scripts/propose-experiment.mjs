import {createInterface} from 'node:readline/promises';
import {writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {stdin,stdout} from 'node:process';
import {generateExperimentProposal,executeExperimentProposalFixture} from '../src/experiment-plan.mjs';
import {executeExperimentProposalApi} from '../src/experiment-execute.mjs';

// FlagProof agent mode (Track 02): the agent proposes a Flagsmith experiment as
// a reviewable artifact. Nothing executes until a human approves the exact
// proposal hash. Default execution is the local fixture; creating the real
// experiment in a Flagsmith org is a separate, separately approved step.
// Usage: node scripts/propose-experiment.mjs [--request "plain-language request"] [--live]
// --request needs the local planner (FLAGPROOF_PLANNER=ollama, OLLAMA_MODEL). The model output is checked against hard limits first.
// --live: after fixture execution, offer real creation in the Flagsmith
// environment. That path needs a second explicit typed confirmation and the
// management key in .env; it is never the default.

const rl=createInterface({input:stdin,output:stdout});
async function main(){
 const reqIdx=process.argv.indexOf('--request');
 const record=await generateExperimentProposal(process.env,{request:reqIdx>0?process.argv[reqIdx+1]:''});
 console.log(`Proposed experiment (${record.source}):\n`);
 console.log(JSON.stringify(record.proposal,null,2));
 if(record.requestText)console.log(`\nRequest given to the model (as data): ${JSON.stringify(record.requestText)}`);
 if(record.changedFromTemplate)console.log(`Changed from the fixed template by the model: ${record.changedFromTemplate.length?record.changedFromTemplate.join(', '):'nothing'}`);
 console.log(`\nApproval hash: ${record.hash}`);
 const answer=(await rl.question('\nApprove and execute this exact proposal against the local fixture? Type the approval hash to confirm, anything else cancels: ')).trim();
 if(answer!==record.hash){console.log('Not approved. Nothing executed.');return;}
 const dir=path.join('artifacts','experiments');await mkdir(dir,{recursive:true});
 const artifact=await executeExperimentProposalFixture(record,{writeFile:(name,contents)=>writeFile(path.join(dir,name),contents)});
 console.log(`Approved proposal executed against the local fixture: artifacts/experiments/experiment-${record.id}.json`);
 if(!process.argv.includes('--live')){
  console.log('To create the real experiment in Flagsmith, use the dashboard wizard (Experiments > Create Experiment), or rerun with --live for the separately confirmed API path.');
  return;
 }
 const confirm=(await rl.question('LIVE mode: create this exact experiment in the Flagsmith environment from .env (not started unless you say so). Type CREATE to proceed, anything else cancels: ')).trim();
 if(confirm!=='CREATE'){console.log('Live creation cancelled. Only the fixture artifact exists.');return;}
 const startAnswer=(await rl.question('Also START the experiment now (locks the flag, turns on the rollout)? Type START, anything else creates it stopped: ')).trim();
 const live=await executeExperimentProposalApi(record,{start:startAnswer==='START'});
 console.log(`Live experiment created in Flagsmith: id ${live.experimentId}, metric ${live.metricId}, flag ${live.featureId}, started=${live.started}.`);
 console.log('Reminder: only send clearly labelled synthetic traffic (scripts/run-experiment-traffic.mjs) or real users, and label results accordingly.');
}
try{await main();}catch(error){console.error(error.message);process.exitCode=1;}finally{rl.close();}
