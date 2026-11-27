const results = [
  { model: 'CNN', correct: 70, accuracy: '97.22%', precision: '0.9474', f1: '0.9730' },
  { model: 'CLDNN', correct: 66, accuracy: '91.67%', precision: '0.8947', f1: '0.9189' },
  { model: 'DNN', correct: 68, accuracy: '94.44%', precision: '0.9706', f1: '0.9429' },
];

export default function Compare() {
  return <section className="page on">
    <h2 style={{marginTop: 0}}>Model performance</h2>
    <p className="sub">Results reported in the BTP end evaluation. The balanced cohort included 116 participants with Alzheimer's disease and 116 healthy controls.</p>
    <div className="card">
      <h3>Balanced test set</h3>
      <p>Training included 160 participants (80 per group). Testing included 72 participants (36 per group).</p>
      <div style={{overflowX: 'auto'}}><table>
        <thead><tr>{['Model', 'Correct / tested', 'Accuracy', 'Precision', 'F1 score'].map(title => <th key={title} scope="col">{title}</th>)}</tr></thead>
        <tbody>{results.map(r => <tr key={r.model}>
          <th scope="row">{r.model}</th><td>{r.correct} / 72</td><td><strong>{r.accuracy}</strong></td><td>{r.precision}</td><td>{r.f1}</td>
        </tr>)}</tbody>
      </table></div>
    </div>
    <h3>Earlier classical ML evaluation</h3>
    <div className="card"><strong>XGBoost · 99.01% accuracy</strong>
      <p>The previous evaluation used an uneven class split. The presentation reports this result separately from the balanced test set.</p>
    </div>
  </section>;
}
