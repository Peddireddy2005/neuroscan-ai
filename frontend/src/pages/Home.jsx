import {lazy, Suspense, useEffect, useState} from 'react';
import {Link} from 'react-router-dom';
import {api} from '../api';
import {useAuth} from '../auth';
import {dateLabel, resultName} from '../Report';

const Brain = lazy(() => import('../Brain'));

export default function Home() {
  const {user} = useAuth();
  const [models, setModels] = useState(null);
  const [history, setHistory] = useState(null);
  const [problem, setProblem] = useState('');
  useEffect(() => {
    let active = true;
    setHistory(null);
    setProblem('');
    api('/models').then(data => active && setModels(data)).catch(() => active && setProblem('Model availability could not be loaded.'));
    if (user) api('/history').then(data => active && setHistory(data)).catch(() => active && setProblem('Your recent reports could not be loaded.'));
    return () => { active = false; };
  }, [user]);
  const latest = history?.at(-1);
  return <section className="page on overview">
    <div className="hero"><div className="t"><div className="eyebrow">EEG research workspace</div>
      <h1>Recording analysis</h1><p>Explore a 19-channel EEG recording, compare model findings and save a report for your study.</p>
      <div className="row"><Link className="btn p" to="/analyze">Analyze a recording</Link><Link className="btn g" to="/history">Saved reports</Link></div>
      <p className="input-note">128 Hz sampling rate · CSV or channel files</p>
    </div><Suspense fallback={<div id="brain"/>}><Brain/></Suspense></div>
    {problem && <p role="alert">{problem}</p>}
    <div className="workspace-panels"><section className="card"><h2>Model inventory</h2><p className="sub">Checkpoints available for analysis</p>
    {models?.map(m => <div className="inventory-line" key={m.id}><strong>{m.name}</strong><span>{m.members} checkpoints</span></div>)}
    {!models && !problem && <p>Loading models…</p>}<Link to="/compare">View BTP evaluation results →</Link></section>
    <section className="card"><h2>Latest report</h2>{latest ? <><p>{dateLabel(latest.date)}</p><h3>{latest.name}</h3><p>{resultName(latest.cls?.split(' (')[0])}</p><Link to={'/history?report='+latest.id}>Open report →</Link></> :
    <><p>{user ? history ? 'Completed analyses appear here and in your report archive.' : 'Loading reports…' : 'Sign in to access your recording history and saved findings.'}</p><Link to={user?'/analyze':'/login'}>{user?'Start an analysis':'Sign in'} →</Link></>}</section></div>
  </section>;
}
