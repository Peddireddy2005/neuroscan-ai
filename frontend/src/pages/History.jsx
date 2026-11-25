import {useEffect,useState} from 'react';
import {Link} from 'react-router-dom';
import {api} from '../api';
import {useAuth} from '../auth';
import Report,{dateLabel,resultName} from '../Report';

export default function History(){
  const {user,restoring}=useAuth();
  const [rows,setRows]=useState(null),[error,setError]=useState(''),[query,setQuery]=useState('');
  const [id,setId]=useState(null),[detail,setDetail]=useState(null),[detailError,setDetailError]=useState('');
  useEffect(()=>{
    let active=true;
    setRows(null);setId(null);setError('');
    if(user)api('/history').then(items=>{if(active){ setRows([...items].reverse()); const wanted=Number(new URLSearchParams(location.search).get('report')); if(items.some(item=>item.id===wanted))setId(wanted); }}).catch(e=>{if(active)setError(e.message)});
    return ()=>{active=false};
  },[user]);
  useEffect(()=>{
    let active=true;
    setDetail(null);setDetailError('');
    if(id)api('/history/'+id).then(data=>{if(active)setDetail(data)}).catch(e=>{if(active)setDetailError(e.message)});
    return ()=>{active=false};
  },[id]);
  if(restoring)return <p>Opening your archive…</p>;
  if(!user)return <p><Link to="/login">Sign in</Link> to see your saved reports.</p>;
  async function clear(){
    if(!window.confirm('Permanently delete all your saved analysis reports?'))return;
    try{await api('/history',{method:'DELETE'});setRows([]);setId(null);setError('')}catch(e){setError(e.message)}
  }
  const shown=(rows||[]).filter(r=>[r.name,r.cls,dateLabel(r.date),String(r.id).padStart(4,'0')].join(' ').toLowerCase().includes(query.trim().toLowerCase()));
  return <section className="page on archive">
    <div className="archive-head"><div><h1>Analysis history</h1><p>Search your recordings and review their model findings.</p></div><Link className="btn p" to="/analyze">Analyze recording</Link></div>
    {error&&<p role="alert">{error}</p>}
    <div className="archive-grid"><aside className="archive-list"><h3>Saved reports {rows&&<small>({rows.length})</small>}</h3>
      <input type="search" aria-label="Search reports" placeholder="Search name, result or date" value={query} onChange={e=>setQuery(e.target.value)}/>
      {!rows&&!error&&<p>Loading reports…</p>}
      {rows&&!shown.length&&<p>{rows.length?'No matching reports.':'Your first completed analysis will appear here.'}</p>}
      {shown.map(r=><button className={'archive-item '+(id===r.id?'selected':'')} aria-pressed={id===r.id} key={r.id} onClick={()=>setId(r.id)}>
        <small>#{String(r.id).padStart(4,'0')} · {dateLabel(r.date)}</small><strong>{r.name}</strong><span>{resultName(r.cls?.split(' (')[0])}</span></button>)}
      {!!rows?.length&&<button className="archive-clear" onClick={clear}>Clear history</button>}
    </aside><div>{!id?<div className="archive-placeholder"><h3>Select a saved report</h3><p>Its result and recording details will appear here.</p></div>:detailError?<p role="alert">{detailError}</p>:!detail||detail.id!==id?<p>Opening report…</p>:detail.report?<Report archived report={{...detail.report,id}}/>:<div className="card"><h3>{detail.name}</h3><p>{detail.cls}</p><p>{dateLabel(detail.date)}</p><small>This earlier report contains a summary. Detailed model findings are available for newer analyses.</small></div>}</div></div>
  </section>;
}


