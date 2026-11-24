import {readFile} from 'node:fs/promises';
import {loadDotEnv} from '../src/env.mjs';
import {runAdapterVerification} from '../src/experiment-execute.mjs';

// One-shot bounded live verification of the experiment adapter, run only with
// explicit per-run approval. The management key is read from a private vault
// file and never printed. Prints only ids and booleans.
await loadDotEnv();
const keyFile=process.env.FLAGSMITH_MANAGEMENT_KEY_FILE;
if(!keyFile){console.error('Set FLAGSMITH_MANAGEMENT_KEY_FILE to the private key file path.');process.exit(1);}
const key=(await readFile(keyFile,'utf8')).trim();
const report=await runAdapterVerification({env:{...process.env,FLAGSMITH_MANAGEMENT_KEY:key}});
console.log(JSON.stringify(report,null,2));
