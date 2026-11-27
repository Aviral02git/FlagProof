// Where to find Flagsmith. Default: Flagsmith Cloud. Self-hosted: set FLAGSMITH_API_URL to
// your instance's SDK API root (for example http://localhost:8000/api/v1/).
// The management endpoints used by FlagProof live on the same host under /api/__future__/.
export function flagsmithHosts(env=process.env){
 const raw=env.FLAGSMITH_API_URL;
 if(!raw)return {selfHosted:false,sdkApi:'https://edge.api.flagsmith.com/api/v1/',flagsUrl:'https://edge.api.flagsmith.com/api/v1/flags/',environmentsUrl:'https://api.flagsmith.com/api/__future__/environments',origin:'https://edge.api.flagsmith.com'};
 let url;try{url=new URL(raw);}catch{throw new Error('FLAGSMITH_API_URL is not a valid URL.');}
 if(url.protocol!=='http:'&&url.protocol!=='https:')throw new Error('FLAGSMITH_API_URL must be http or https.');
 const sdkApi=raw.replace(/\/?$/,'/');
 return {selfHosted:true,sdkApi,flagsUrl:`${sdkApi}flags/`,environmentsUrl:`${url.origin}/api/__future__/environments`,origin:url.origin};
}

// Management API base (experiments, metrics, warehouse). Separate from the SDK/event host: on Flagsmith Cloud the management API is api.flagsmith.com
// while SDK and event traffic go to the edge host, so FLAGSMITH_MANAGEMENT_URL can be set without making the SDK side look self-hosted.
export function managementBase(env=process.env){
 const raw=env.FLAGSMITH_MANAGEMENT_URL||env.FLAGSMITH_API_URL||'https://api.flagsmith.com/api/v1/';
 let url;try{url=new URL(raw);}catch{throw new Error('FLAGSMITH_MANAGEMENT_URL is not a valid URL.');}
 if(url.protocol!=='http:'&&url.protocol!=='https:')throw new Error('FLAGSMITH_MANAGEMENT_URL must be http or https.');
 return raw.replace(/\/?$/,'/');
}
