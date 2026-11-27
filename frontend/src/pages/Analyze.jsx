import {useEffect,useRef,useState} from 'react';import {Link} from 'react-router-dom';import {api} from '../api';import {useAuth} from '../auth';
import {CHANNELS,matchChannels,readRecording,filesFromEntries} from '../signal';
import Report from '../Report';
const FS=128;
export default function Analyze(){const{user}=useAuth(),cv=useRef(),fi=useRef(),fo=useRef(),alive=useRef(true);
const [name,setName]=useState('');
const[sel,setSel]=useState(null),[D,setD]=useState(null),[err,setErr]=useState(''),[ch,setCh]=useState(0),[zoom,setZoom]=useState(60),[pos,setPos]=useState(0),[job,setJob]=useState(null),[res,setRes]=useState(null),[n,setN]=useState(null);
useEffect(()=>{alive.current=true;api('/models').then(m=>setN(m.length)).catch(()=>setN(0));return()=>{alive.current=false}},[]);
const load=async list=>{if(job)return;setName('');setErr('');setRes(null);setJob(null);setD(null);setSel(null);list=[...list];if(!list.length)return;
 try{if(list.length===1&&!/\.(txt|csv)$/i.test(list[0].name))throw Error('Use .txt or .csv files.');
 let files,info=null;
 if(list.length===1){files=list}else{info=matchChannels(list);setSel({info,files:null});if(info.missing.length||info.dups.length)return;files=CHANNELS.map(c=>info.found[c])}
 if(files.some(f=>f.size>60e6))throw Error('A file is larger than 60 MB.');
 const d=await readRecording(files);if(d.n<8*FS)throw Error('Recording too short: at least 1,024 samples per channel at 128 Hz are required.');
 setD(d);setCh(0);setSel({info,files})}catch(e){setErr(e.message)}};
const drop=e=>{e.preventDefault();const en=[...e.dataTransfer.items].map(i=>i.webkitGetAsEntry?.()).filter(Boolean);
 (en.length?filesFromEntries(en):Promise.resolve([...e.dataTransfer.files])).then(load)};
const w=D?Math.max(50,Math.round(D.n*(.02+zoom/100*.98))):0,s=D?Math.round((D.n-w)*pos/100):0;
useEffect(()=>{if(!D)return;const c=cv.current,d=devicePixelRatio||1,W=c.clientWidth,H=c.clientHeight;c.width=W*d;c.height=H*d;const g=c.getContext('2d');g.scale(d,d);const x=D.ch[ch];let mn=1e99,mx=-1e99;
for(let i=s;i<s+w;i++){mn=Math.min(mn,x[i]);mx=Math.max(mx,x[i])}if(mx===mn)mx=mn+1;g.strokeStyle='#2563EB';g.lineWidth=1.3;g.beginPath();const st=Math.max(1,Math.floor(w/(W*2)));
for(let i=0;i<w;i+=st){const px=4+(W-8)*i/w,py=10+(H-26)*(1-(x[s+i]-mn)/(mx-mn));i?g.lineTo(px,py):g.moveTo(px,py)}g.stroke();
g.fillStyle='#5b6785';g.font='11px Manrope';g.fillText((s/FS).toFixed(2)+' s',4,H-5);g.fillText((D.n/FS).toFixed(1)+' s total · unfiltered preview',W-200,H-5)},[D,ch,s,w]);
const run=async()=>{setErr('');setRes(null);setJob({status:'queued',progress:0});
 try{const fd=new FormData();sel.files.forEach(f=>fd.append('files',f));fd.append('fs',FS);fd.append('name',name.trim());const{job_id}=await api('/predict',{method:'POST',body:fd});
 for(;;){await new Promise(r=>setTimeout(r,1000));if(!alive.current)return;const j=await api('/jobs/'+job_id);setJob(j);
  if(j.status==='done'){setRes(j.result);setJob(null);return}if(j.status==='error')throw Error(j.error)}}catch(e){setErr(e.message);setJob(null)}};
const info=sel?.info,ok=D&&sel?.files,busy=!!job,r=res,pa=r?r.score*100:0;
return <section className="page on"><h2 style={{marginTop:0}}>Upload EEG Recording</h2>
<p className="sub">Select the <b>folder</b> that holds one recording’s 19 channel files (Fp1.txt … O2.txt), or a single CSV with 19 channel columns. Recordings must be sampled at 128 Hz.</p>
<div className="drop" onDragOver={e=>e.preventDefault()} onDrop={drop}><h3>Drag and drop the recording folder here</h3><div className="sub">or choose it with a button</div>
<div className="row" style={{justifyContent:'center',marginTop:10}}><button className="btn p" onClick={()=>fo.current.click()}>Select folder</button><button className="btn g" onClick={()=>fi.current.click()}>Select files</button></div>
<input ref={fo} type="file" webkitdirectory="" directory="" multiple hidden onChange={e=>{load(e.target.files);e.target.value=''}}/>
<input ref={fi} type="file" accept=".csv,.txt" multiple hidden onChange={e=>{load(e.target.files);e.target.value=''}}/></div>
{err&&<div className="pill bad" style={{marginTop:10}}>{err}</div>}
{info&&<div className="card" style={{marginTop:16}}><b>Folder check</b><div style={{display:'flex',flexWrap:'wrap',gap:6,margin:'10px 0'}}>{CHANNELS.map(c=><span key={c} className={'pill '+(info.found[c]?'ok':'bad')}>{info.found[c]?'✓':'✗'} {c}</span>)}</div>
{info.missing.length===0&&info.dups.length===0?<div className="sub" style={{margin:0}}>✓ All 19 channel files found{info.extra.length?` · ${info.extra.length} other file(s) ignored`:''}.</div>
:<div className="pill bad">{info.dups.length?`More than one file for the same channel (${info.dups.slice(0,3).join(', ')}). Select a single recording’s folder.`:`Not a valid recording folder: ${info.missing.length} channel file(s) missing (${info.missing.join(', ')}).`}</div>}</div>}
{D&&<><div className="grid" style={{marginTop:16}}>{[['Source',info?'19 channel files':sel.files[0].name],['Channels',D.c],['Duration',(D.n/FS).toFixed(1)+' s']].map(([k,v])=><div className="card" key={k}><div className="k">{k}</div><div style={{fontWeight:800,wordBreak:'break-all'}}>{v}</div></div>)}</div>
{D.warn&&<div className="pill warn" style={{marginTop:10}}>{D.warn}</div>}
<div className="card" style={{marginTop:16}}><div className="row"><label>Channel <select value={ch} onChange={e=>setCh(+e.target.value)}>{D.names.map((x,i)=><option key={i} value={i}>{x}</option>)}</select></label>
<label>Window <input type="range" value={zoom} onChange={e=>setZoom(+e.target.value)}/></label><label>Position <input type="range" value={pos} onChange={e=>setPos(+e.target.value)}/></label></div><canvas className="eeg" ref={cv}/></div>
</>}
<h2>Analysis</h2><div className="card">{!user?<p>Please <Link to="/login"><b>sign in</b></Link> to analyze a recording.</p>:n===0?<div className="pill warn">The analysis models are not installed on the server yet (see README, step 1).</div>:
<div>{ok&&<label className="record-label">Recording label <small>(optional)</small><input maxLength={100} value={name} disabled={busy} placeholder="e.g. Study 04, baseline" onChange={e=>setName(e.target.value)}/></label>}<div className="row"><span>{ok?'Recording is valid and ready.':'Select a valid recording to begin.'}</span><button className="btn p" disabled={!ok||busy||!n} onClick={run}>{busy?'Analyzing…':'Analyze EEG Signal'}</button></div></div>}
{busy&&<div style={{marginTop:14}}><div className="bar"><i style={{width:Math.max(4,(job.progress||0)*100)+'%'}}/></div><div className="sub" style={{margin:'6px 0 0'}}>{job.status==='queued'?'Waiting for the analysis to start…':`Analyzing the recording in the background… ${Math.round((job.progress||0)*100)}%`} You can keep this page open.</div></div>}</div>
{r&&<Report report={r}/>}</section>}
