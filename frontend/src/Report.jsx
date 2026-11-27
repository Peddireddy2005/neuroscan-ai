import {Link} from 'react-router-dom';

export function resultName(label) {
  return { Alzheimer: "Alzheimer’s-like pattern", Healthy: "Healthy-like pattern", Inconclusive: "Inconclusive" }[label] || label;
}

export function dateLabel(date) {
  if (!date) return 'Date unavailable';
  const value = date.includes('T') ? date : date.replace(' ', 'T') + 'Z';
  const time = new Date(value);
  return Number.isNaN(time.getTime()) ? date : time.toLocaleString(undefined, {dateStyle:'medium', timeStyle:'short'});
}

export default function Report({report, archived=false}) {
  const {label, agreement} = report;
  const findings = report.findings || [];
  return <article className="report-panel" aria-label="Analysis report" aria-live="polite">
    <div className="report-cover">
      <div className="report-meta"><span>EEG analysis report</span><span>#{String(report.id).padStart(4,'0')}</span></div>
      <h2>{resultName(label)}</h2>
      <p>{label==='Inconclusive' ? 'The model families are evenly split between the two patterns.' : Math.max(agreement.healthy,agreement.alzheimer)+' of '+agreement.total+' model families identified this pattern.'}</p>
      <div className="record-caption">{report.name} · {dateLabel(report.date)}</div>
    </div>
    <div className="report-body">
      <dl className="record-stats">{[['Recording length',report.duration_s+' s'],['Channels',report.channels],['Sampling rate',report.sample_rate+' Hz']].map(([k,v])=><div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
      <h3>Model findings</h3>
      <p className="report-note">Each bar shows the average AD-class score for a model family. Values above 50% indicate the AD-like pattern.</p>
      {findings.map(v=><div className="finding-row" key={v.model}><div><strong>{v.model === 'SVM + SPEC features' ? 'Classical ML' : v.model}</strong><small>{v.members} checkpoints</small></div><div><b>{resultName(v.label)}</b><div className="finding-meter"><i style={{width:(100*v.score)+'%'}}/></div><small>Class score {(v.score*100).toFixed(1)}%</small></div></div>)}
      {report.warnings.map(w=><p key={w} className="pill warn">{w}</p>)}
      <p className="report-note">For research use only.</p>
      <div className="row noprint"><button className="btn g" onClick={()=>window.print()}>Print report / PDF</button>{!archived&&<Link className="btn g" to="/history">View saved reports</Link>}</div>
    </div>
  </article>;
}

