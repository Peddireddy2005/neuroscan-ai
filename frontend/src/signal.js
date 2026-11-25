export function fft(re,im){const n=re.length;for(let i=1,j=0;i<n;i++){let b=n>>1;for(;j&b;b>>=1)j^=b;j^=b;if(i<j){[re[i],re[j]]=[re[j],re[i]];[im[i],im[j]]=[im[j],im[i]]}}
for(let l=2;l<=n;l<<=1){const a=-2*Math.PI/l;for(let i=0;i<n;i+=l)for(let k=0;k<l/2;k++){const c=Math.cos(a*k),s=Math.sin(a*k),u=i+k,v=u+l/2,tr=re[v]*c-im[v]*s,ti=re[v]*s+im[v]*c;re[v]=re[u]-tr;im[v]=im[u]-ti;re[u]+=tr;im[u]+=ti}}}
const B=[['Delta',.5,4],['Theta',4,8],['Alpha',8,13],['Beta',13,30],['Gamma',30,45]];
export function bandPct(x,s,w,fs){let N=1;while(N*2<=Math.min(w,16384))N*=2;if(N<64)return null;const re=new Float64Array(N),im=new Float64Array(N);let m=0;for(let i=0;i<N;i++)m+=x[s+i];m/=N;
for(let i=0;i<N;i++)re[i]=(x[s+i]-m)*(.5-.5*Math.cos(2*Math.PI*i/(N-1)));fft(re,im);
const P=B.map(([n,a,b])=>{let t=0;for(let k=1;k<N/2;k++){const f=k*fs/N;if(f>=a&&f<b)t+=re[k]**2+im[k]**2}return t}),T=P.reduce((a,b)=>a+b,0)||1;return B.map((b,i)=>[b[0],P[i]/T*100])}
export function parseCSV(t){const rows=t.split(/\r?\n/).filter(l=>l.trim());let names=null;const first=rows[0].split(/[,;\t]/);if(first.some(c=>isNaN(parseFloat(c)))){names=first.map(s=>s.trim());rows.shift()}
const n=rows.length,c=rows[0]?rows[0].split(/[,;\t]/).length:0;if(n<2||!c)throw Error('No numeric data found.');
const ch=Array.from({length:c},()=>new Float32Array(n));let bad=0;
rows.forEach((l,i)=>{const p=l.split(/[,;\t]/);for(let j=0;j<c;j++){const v=parseFloat(p[j]);if(isNaN(v))bad++;else ch[j][i]=v}});
if(bad>n*c*.05)throw Error('More than 5% of values are non-numeric. Check the file layout.');return{ch,names:names||ch.map((_,i)=>'Ch '+(i+1)),n,c}}
export const CHANNELS=['Fp1','Fp2','F3','F4','F7','F8','Fz','C3','C4','Cz','P3','P4','Pz','T3','T4','T5','T6','O1','O2'];
const ALIAS={t7:'t3',t8:'t4',p7:'t5',p8:'t6'};
// which uploaded file is which channel (same rule as the server): Fp1.txt, sub-01_Cz.txt, EEG T7.csv ...
export function matchChannels(files){const found={},dups=[],extra=[];
for(const f of files){const t=f.name.replace(/\.[^.]+$/,'').toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
const c=/\.(txt|csv)$/i.test(f.name)&&(CHANNELS.find(x=>t.includes(x.toLowerCase()))||CHANNELS.find(x=>t.some(y=>ALIAS[y]===x.toLowerCase())));
if(!c)extra.push(f.name);else if(found[c])dups.push(f.name);else found[c]=f}
return{found,dups,extra,missing:CHANNELS.filter(c=>!found[c])}}
// files from a dropped folder (walks sub-folders). Entries must be read synchronously inside the drop handler.
export async function filesFromEntries(entries){const out=[];const walk=async e=>{if(e.isFile)out.push(await new Promise(r=>e.file(r)));
else if(e.isDirectory){const rd=e.createReader();let b;do{b=await new Promise(r=>rd.readEntries(r));for(const c of b)await walk(c)}while(b.length)}};
for(const e of entries)await walk(e);return out}
// ordered19 = the 19 channel files in CHANNELS order, or a single 19-column CSV
export async function readRecording(files){files=[...files];if(files.length===1)return parseCSV(await files[0].text());
const ch=await Promise.all(files.map(async(f,i)=>{const a=Float32Array.from((await f.text()).split(/[\s,;]+/).filter(Boolean).map(Number).filter(Number.isFinite));
if(!a.length)throw Error(CHANNELS[i]+' file ('+f.name+') contains no numeric data.');return a}));
const n=Math.min(...ch.map(a=>a.length)),mx=Math.max(...ch.map(a=>a.length));
return{ch:ch.map(a=>a.subarray(0,n)),names:CHANNELS,n,c:19,warn:mx-n>.02*mx?'Channel files have different lengths; trimmed to the shortest.':''}}
