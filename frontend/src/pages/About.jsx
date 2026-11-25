const Step=({n,t,d})=><div className="step"><b>{n} · {t}</b><span>{d}</span></div>;
export default function About(){return <section className="page on"><h2 style={{marginTop:0}}>About NeuroScan AI</h2>
<p className="sub">A research tool that looks for EEG patterns associated with Alzheimer’s disease using signal processing and machine learning.</p>
<div className="two"><div className="card"><div className="k">Purpose</div><p>Alzheimer’s disease is often identified late. EEG is non-invasive, inexpensive and widely available, and researchers study whether machine learning can pick up disease-related changes in brain rhythms. NeuroScan AI lets you upload a recording and see what a set of trained models make of it.</p></div>
<div className="card"><div className="k">Intended use</div><p>Research, education and method demonstration. It is <b>not a medical device</b> and must not be used to diagnose, rule out or monitor any condition. Clinical decisions need a qualified clinician and a full evaluation.</p></div></div>
<h2>How an analysis works</h2><div className="steps">
<Step n="1" t="Upload" d="You provide one recording: its 19 channel files in a folder, or a single CSV."/>
<Step n="2" t="Validation" d="The site checks that all 19 channels are present, contain numbers, and the recording is at least 8 s long at 128 Hz."/>
<Step n="3" t="Filtering" d="Each channel is band-pass filtered from 0.5 to 45 Hz (zero-phase) and standardised."/>
<Step n="4" t="Segmentation" d="The signal is cut into short non-overlapping windows (1 s and 8 s)."/>
<Step n="5" t="Analysis" d="Several independently trained models score every window, in the background on the server."/>
<Step n="6" t="Result" d="Window scores are averaged per model, then combined into one result with an agreement count."/></div>
<h2>Input requirements</h2><div className="card"><ul>
<li><b>19 channels</b> of the standard 10–20 layout: Fp1, Fp2, F3, F4, F7, F8, Fz, C3, C4, Cz, P3, P4, Pz, T3, T4, T5, T6, O1, O2. The newer names T7, T8, P7, P8 are accepted for T3, T4, T5, T6.</li>
<li><b>128 Hz</b> sampling rate. The models were trained at this rate, so other rates are rejected rather than guessed.</li>
<li><b>Format:</b> one text file of numbers per channel (named after the channel, for example Fp1.txt), or a single CSV with one column per channel.</li>
<li><b>Length:</b> at least 8 s. A minute or more is recommended, because more windows give a more stable result.</li>
<li>One recording at a time. A folder holding several recordings is rejected.</li></ul></div>
<h2>Reading the result</h2><div className="card"><ul>
<li>Each family contributes one classification. An even split produces an inconclusive result.</li>
<li>Scores near the 50% threshold indicate a small margin between classes.</li></ul></div>
<h2>Validation and performance</h2><div className="card"><p>The models were evaluated with <b>subject-level cross-validation on 232 subjects</b>: no person appears in both the training and the test data. Individually, the models reached roughly <b>90% to 94% accuracy</b>. Two points matter when you read this:</p><ul>
<li>The combined result shown by this site has <b>not been evaluated as a separate system</b>.</li>
<li>These figures come from one dataset. Accuracy on other hospitals, devices, age groups or recording protocols is unknown and is likely to be lower.</li></ul></div>
<h2>Limitations</h2><div className="card"><ul>
<li>The system answers a two-way question, healthy controls versus Alzheimer’s disease. It cannot recognise other dementias, mild cognitive impairment or other conditions, and will still force a recording into one of the two groups.</li>
<li>With a modest number of subjects, results can be unstable and some people will be misclassified in both directions.</li>
<li>EEG quality matters: eye movements, muscle activity, electrode problems and drowsiness can change the result.</li>
<li>Age, medication and other health conditions also change EEG rhythms and are not accounted for.</li></ul></div>
<h2>Privacy and data handling</h2><div className="card"><ul>
<li>Uploaded recordings are processed in the server’s memory and are <b>not saved</b>.</li>
<li>Your history stores the recording label, date, recording details and model findings, and you can delete it from the History page.</li>
<li>Passwords are stored as salted hashes. Use HTTPS when you deploy the site.</li></ul></div>
<h2>Frequently asked questions</h2><div className="card">
<details><summary><b>Why does the site reject my folder?</b></summary><p>The check shows which of the 19 channels is missing. Make sure the file names contain the channel name, and that the folder contains one recording only.</p></details>
<details><summary><b>My data is not 128 Hz. What can I do?</b></summary><p>Resample it to 128 Hz first with your EEG software, then upload it again.</p></details>
<details><summary><b>How long does an analysis take?</b></summary><p>Usually from a few seconds to about a minute, depending on recording length. It runs in the background and the page updates by itself.</p></details>
<details><summary><b>Can I rely on the result?</b></summary><p>No. It is a research output and cannot replace professional evaluation.</p></details></div></section>}
