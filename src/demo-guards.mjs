// Builds the durable gate and reservation ledger from server environment. Returns {} unless explicitly enabled, so nothing changes by default.
// Ceiling is PROVISIONAL: measured 150 identity requests per run (local stub, not Cloud); 10000 identities per month is about 20% of the Free 50K request limit,
// leaving 5x room for SDK behaviour on Cloud that was not measured. Billing behaviour on overage is unresolved in Flagsmith's own pages.
import {createDurableGate} from './demo-durable.mjs';
import {createLedger} from './demo-ledger.mjs';
import {createFlagsmithLedgerStore} from './demo-ledger-store.mjs';
import {managementBase} from './hosts.mjs';
export const PROVISIONAL_MONTHLY_IDENTITY_CEILING=10000;
export function buildDemoGuards(env=process.env){
 if(env.FLAGPROOF_DEMO_DURABLE!=='1')return {};
 for(const k of ['FLAGSMITH_ORG_ID','FLAGSMITH_LEDGER_FEATURE_ID','FLAGSMITH_MANAGEMENT_KEY','FLAGSMITH_ENVIRONMENT_KEY'])if(!env[k])throw new Error(`${k} is required when FLAGPROOF_DEMO_DURABLE=1`);
 const apiUrl=managementBase(env);const featureName=env.FLAGPROOF_DEMO_FLAG||'checkout_cta_copy';
 const ceiling=Number(env.FLAGPROOF_MONTHLY_IDENTITY_CEILING||PROVISIONAL_MONTHLY_IDENTITY_CEILING);
 const gate=createDurableGate({apiUrl,orgId:Number(env.FLAGSMITH_ORG_ID),environmentKey:env.FLAGSMITH_ENVIRONMENT_KEY,flagName:featureName,managementKey:env.FLAGSMITH_MANAGEMENT_KEY});
 const store=createFlagsmithLedgerStore({apiUrl,environmentKey:env.FLAGSMITH_ENVIRONMENT_KEY,featureId:Number(env.FLAGSMITH_LEDGER_FEATURE_ID),managementKey:env.FLAGSMITH_MANAGEMENT_KEY});
 return {gate,ledger:createLedger({store,monthlyIdentityCeiling:ceiling})};
}
