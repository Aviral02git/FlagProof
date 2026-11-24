// Shared configuration for the genuine Flagsmith Experimentation demo (Track 01).
// The experiment tests checkout CTA copy with a multivariate flag, recorded
// exposures and a conversion metric, using only documented SDK calls.
export const EXPERIMENT_FLAG='checkout_cta_copy';
export const EXPERIMENT_EVENT='checkout_completed';
export const EXPERIMENT_VARIANTS=Object.freeze([
 {key:'control',label:'Control',copy:'Checkout',conversionRate:0.32},
 {key:'buy_now',label:'Buy now',copy:'Buy now',conversionRate:0.46},
 {key:'get_it_today',label:'Get it today',copy:'Get it today',conversionRate:0.38},
]);
export const EXPERIMENT_HYPOTHESIS='Changing the checkout CTA copy from "Checkout" to "Buy now" will increase checkout completion by at least 10 percentage points within the simulated traffic window.';

export function variantByKey(key){
 const v=EXPERIMENT_VARIANTS.find(v=>v.key===key);
 if(!v)throw new Error(`unknown experiment variation: ${key}`);
 return v;
}
