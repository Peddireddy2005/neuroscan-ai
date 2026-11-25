let access=null;export const setAccess=t=>{access=t};
let refreshing=null;
export function refresh(){return refreshing??=(async()=>{const r=await fetch('/api/auth/refresh',{method:'POST',signal:AbortSignal.timeout(10000)});if(!r.ok)throw Error('expired');const j=await r.json();access=j.token;return j})().finally(()=>{refreshing=null})}
export async function api(path,o={},retry=true){const orig=o,h={...(o.headers||{})};if(access)h.Authorization='Bearer '+access;
if(o.json){h['Content-Type']='application/json';o={...o,body:JSON.stringify(o.json)}}
let r;
try{r=await fetch('/api'+path,{...o,headers:h})}
catch(error){if(error.name==='AbortError')throw error;throw Error('Could not reach NeuroScan. Check your connection and try again.')}
if(r.status===401&&retry&&!path.startsWith('/auth/')){try{await refresh()}catch{access=null;throw Error('Your session expired. Please sign in again.')}return api(path,orig,false)}
if(!r.ok){let m=r.statusText;try{m=(await r.json()).detail||m}catch{}throw Error(typeof m==='string'&&m?m:'The request could not be completed. Please try again.')}
return r.json()}
