import {createInterface} from 'node:readline/promises';
import {writeFile,readFile} from 'node:fs/promises';
import {stdin,stdout} from 'node:process';
import {verifyFlagsmithEnvironment,envFileContents} from '../src/flagsmith-check.mjs';
import {FLAG_NAMES} from '../src/core.mjs';

// Guided setup for running FlagProof against a real Flagsmith environment.
// Verifies the environment key, locates the three boolean flags, checks the
// management key can read them, and writes a gitignored .env. The management
// key is never printed back. No flag or account data is created or changed.

const rl=createInterface({input:stdin,output:stdout});
let pending=null;
rl.on('close',()=>pending?.abort()); // EOF or Ctrl+D ends the current question
const ask=async q=>{
 const ac=new AbortController();pending=ac;
 try{return (await rl.question(q,{signal:ac.signal})).trim();}
 catch(error){if(error?.name==='AbortError')return '';throw error;}
 finally{pending=null;}
};

async function main(){
 console.log(`FlagProof: Flagsmith setup check
This verifies a real Flagsmith environment and writes a local .env (gitignored).
You need, from your Flagsmith dashboard:
  1. A client-side ENVIRONMENT KEY (Project -> Environment settings -> Keys).
  2. A SERVER-SIDE / management API key with access to the same environment.
  3. Three boolean flags named exactly: ${FLAG_NAMES.join(', ')}
     (create them in the dashboard first if any is missing, then re-run this).
`);

 // Non-interactive path: keys already in the environment skip the prompts (useful for re-checks and CI).
 const environment=process.env.FLAGSMITH_ENVIRONMENT_KEY||await ask('Environment key: ');
 const management=process.env.FLAGSMITH_MANAGEMENT_KEY||await ask('Management API key (kept local, never echoed): ');
 if(!environment||!management){console.log('Both keys are required. Nothing written.');process.exitCode=1;return;}

 let featureIds;
 try{
  ({featureIds}=await verifyFlagsmithEnvironment({environment,management}));
 }catch(error){console.log(error.message);process.exitCode=1;return;}

 let existed=true;
 try{await readFile('.env','utf8');}catch{existed=false;}
 await writeFile('.env',envFileContents({environment,management,featureIds}));
 console.log(`\nVerified: environment key resolves, all three boolean flags found, management key reads them.
Wrote .env (${existed?'replaced existing file':'new file'}; gitignored).
Next: npm start, then open the printed local address. The dashboard will show FLAGSMITH API + SDK mode.
Local-fixture mode remains available by removing .env.`);
}

try{
 await main();
}catch(error){
 if(error?.name!=='AbortError'){console.error(error);process.exitCode=1;}
 else process.exitCode=1;
}finally{
 rl.close();
}
