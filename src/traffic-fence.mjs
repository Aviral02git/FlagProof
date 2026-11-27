// Parent side of the per-request handshake with the traffic worker. The worker sends {t:'next'} before EVERY request and waits for {go}.
// verify() must prove ownership at that moment; a throw, a false, or no answer within verifyTimeoutMs (22 s, just above the 20 s management GET budget) means the worker is told to stop (and is killed).
export function attachTrafficFence(child,verify,{onStop=()=>{},verifyTimeoutMs=22000}={}){
 let stopped=false;
 child.on('message',async m=>{
  if(!m||m.t!=='next'||stopped)return;
  let go=false;try{go=Boolean(await Promise.race([verify(),new Promise((_,rej)=>{const t=setTimeout(()=>rej(new Error('verify timeout')),verifyTimeoutMs);t.unref?.();})]));}catch{go=false;}
  if(!go){stopped=true;try{child.send({go:false});}catch{}child.kill();onStop();return;}
  try{child.send({go:true});}catch{}
 });
 return {get stopped(){return stopped;}};
}
