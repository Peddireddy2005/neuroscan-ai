// JavaScript port of the notebooks' pipeline: load -> band-pass 0.5-45 Hz (sosfiltfilt) -> per-channel z-score -> epochs -> features.
export const CHANNELS = ['Fp1','Fp2','F3','F4','F7','F8','Fz','C3','C4','Cz','P3','P4','Pz','T3','T4','T5','T6','O1','O2'];
export const FS = 128;
const SOS = [[0.26937622369180353, 0.5387524473836071, 0.26937622369180353, 1.0, 0.6747114955705579, 0.14589885093297694], [1.0, 2.0, 1.0, 1.0, 0.9115741461453388, 0.5332086171861993], [1.0, -2.0, 1.0, 1.0, -1.9546766924649397, 0.9552782239403277], [1.0, -2.0, 1.0, 1.0, -1.9809548352198139, 0.9815537637730188]]; // scipy.signal.butter(4, [0.5/64, 45/64], 'band', output='sos')

const nums = t => Float64Array.from(t.split(/[\s,;]+/).filter(Boolean).map(Number).filter(Number.isFinite));
const ALIAS = { t7: 't3', t8: 't4', p7: 't5', p8: 't6' }; // modern 10-10 names -> the 10-20 names used in training

// Which uploaded file is which channel? Matches tokens of the file name (Fp1.txt, sub-01_Cz.txt, EEG T7.csv ...)
export function matchChannels(names) {
  const found = {}, dups = [], extra = [];
  names.forEach((n, i) => {
    const t = n.replace(/\.[^.]+$/, '').toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
    const ch = CHANNELS.find(c => t.includes(c.toLowerCase())) || CHANNELS.find(c => t.some(x => ALIAS[x] === c.toLowerCase()));
    if (!ch) extra.push(n); else if (found[ch] !== undefined) dups.push(n); else found[ch] = i;
  });
  return { found, dups, extra, missing: CHANNELS.filter(c => found[c] === undefined) };
}

// files: [{name, buffer}] -> {sig: Float64Array[19], n, warnings}. Accepts the 19 channel files, or one CSV with 19 columns.
export function loadRecording(files) {
  const m = matchChannels(files.map(f => f.name)), warnings = [];
  if (files.length > 1) {
    if (m.dups.length) throw new Error(`More than one file for the same channel (${m.dups.slice(0, 3).join(', ')}). Upload one recording at a time.`);
    if (m.missing.length) throw new Error(`Missing channel files: ${m.missing.join(', ')}.`);
    const s = CHANNELS.map(c => { const f = files[m.found[c]], v = nums(f.buffer.toString('utf8')); if (!v.length) throw new Error(`${f.name} contains no numeric data`); return v; });
    const n = Math.min(...s.map(a => a.length)), mx = Math.max(...s.map(a => a.length));
    if (mx - n > .02 * mx) warnings.push('Channel files have different lengths; all were trimmed to the shortest');
    return { sig: s.map(a => a.subarray(0, n)), n, warnings };
  }
  const rows = files[0].buffer.toString('utf8').split(/\r?\n/).filter(l => l.trim()), d = /[,;\t]/;
  const head = rows[0].split(d).map(s => s.trim());
  let idx = CHANNELS.map((_, i) => i);
  if (head.some(t => t === '' || isNaN(+t))) {
    rows.shift(); idx = CHANNELS.map(c => head.findIndex(h => h.toLowerCase() === c.toLowerCase()));
    if (idx.includes(-1)) throw new Error('Header must contain all 19 channels: ' + CHANNELS.join(', '));
  } else if (head.length !== 19) throw new Error('Expected 19 channel columns, found ' + head.length);
  else warnings.push('No header: columns were assumed to be in the order ' + CHANNELS.join(', '));
  const n = rows.length, sig = idx.map(() => new Float64Array(n));
  rows.forEach((l, i) => { const p = l.split(d); idx.forEach((j, c) => { const v = parseFloat(p[j]); sig[c][i] = Number.isFinite(v) ? v : 0; }); });
  return { sig, n, warnings };
}

// ---- scipy.signal.sosfiltfilt ----
function sosfilt(x, zi) {
  const y = Float64Array.from(x);
  SOS.forEach(([b0, b1, b2, , a1, a2], s) => {
    let z0 = zi[s][0], z1 = zi[s][1];
    for (let i = 0; i < y.length; i++) { const v = y[i], o = b0 * v + z0; z0 = b1 * v - a1 * o + z1; z1 = b2 * v - a2 * o; y[i] = o; }
  });
  return y;
}
function sosZi() { // sosfilt_zi
  let sc = 1;
  return SOS.map(([b0, b1, b2, , a1, a2]) => {
    const B0 = b1 - a1 * b0, B1 = b2 - a2 * b0, z0 = (B0 + B1) / (1 + a1 + a2), z = [sc * z0, sc * (B1 - a2 * z0)];
    sc *= (b0 + b1 + b2) / (1 + a1 + a2); return z;
  });
}
function filtfilt(x) {
  const n = x.length, e = 27, ext = new Float64Array(n + 2 * e), z = sosZi(); // edge = 3 * (2*sections+1)
  for (let i = 0; i < e; i++) { ext[i] = 2 * x[0] - x[e - i]; ext[n + e + i] = 2 * x[n - 1] - x[n - 2 - i]; }
  ext.set(x, e);
  const y = sosfilt(ext, z.map(p => p.map(v => v * ext[0]))).reverse();
  const w = sosfilt(y, z.map(p => p.map(v => v * y[0]))).reverse();
  return w.subarray(e, n + e);
}
export function preprocess(sig) {
  return sig.map(x => {
    const y = filtfilt(x); let m = 0; for (const v of y) m += v; m /= y.length;
    let s = 0; for (const v of y) s += (v - m) ** 2; s = Math.sqrt(s / y.length);
    return y.map(v => (v - m) / (s + 1e-8));
  });
}

// time-major epochs [n, L, 19] (what the exported CNN/CLDNN models take)
export function rawEpochs(P, L) {
  const n = Math.floor(P[0].length / L), data = new Float32Array(n * L * 19);
  for (let e = 0; e < n; e++) for (let t = 0; t < L; t++) for (let c = 0; c < 19; c++) data[(e * L + t) * 19 + c] = P[c][e * L + t];
  return { data, n };
}
export function subsample({ data, n, shape }, max) {
  if (!max || n <= max) return { data, n, shape };
  const row = shape.reduce((a, b) => a * b), out = new Float32Array(max * row);
  for (let i = 0; i < max; i++) out.set(data.subarray(Math.round(i * (n - 1) / (max - 1)) * row).subarray(0, row), i * row);
  return { data: out, n: max, shape };
}

// ---- features (scipy.signal.welch: hann, nperseg 256, 50% overlap, constant detrend) ----
function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) { let b = n >> 1; for (; j & b; b >>= 1) j ^= b; j ^= b; if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; } }
  for (let l = 2; l <= n; l <<= 1) { const a = -2 * Math.PI / l; for (let i = 0; i < n; i += l) for (let k = 0; k < l / 2; k++) {
    const c = Math.cos(a * k), s = Math.sin(a * k), u = i + k, v = u + l / 2, tr = re[v] * c - im[v] * s, ti = re[v] * s + im[v] * c;
    re[v] = re[u] - tr; im[v] = im[u] - ti; re[u] += tr; im[u] += ti; } }
}
const HW = Float64Array.from({ length: 256 }, (_, i) => .5 - .5 * Math.cos(2 * Math.PI * i / 256)), SW = HW.reduce((a, w) => a + w * w, 0);
function welch(x) {
  const P = new Float64Array(129); let ns = 0;
  for (let s = 0; s + 256 <= x.length; s += 128, ns++) {
    const re = new Float64Array(256), im = new Float64Array(256); let m = 0;
    for (let i = 0; i < 256; i++) m += x[s + i]; m /= 256;
    for (let i = 0; i < 256; i++) re[i] = (x[s + i] - m) * HW[i];
    fft(re, im); for (let k = 0; k <= 128; k++) P[k] += re[k] ** 2 + im[k] ** 2;
  }
  for (let k = 0; k <= 128; k++) P[k] *= (k === 0 || k === 128 ? 1 : 2) / (FS * SW * ns);
  return P;
}
const BANDS = [[1, 4], [4, 8], [8, 10], [10, 13], [13, 30], [30, 45]];
const vr = a => { let m = 0; for (const v of a) m += v; m /= a.length; let s = 0; for (const v of a) s += (v - m) ** 2; return s / a.length; };
const diff = a => a.slice(1).map((v, i) => v - a[i]);

// one 8 s epoch (19 x Float64Array(1024)) -> {dnn: 152 features, spec: 247 features}
function epochFeatures(chs) {
  const R = BANDS.map(() => new Float64Array(19)), ent = [], ta = [], sef = [], cen = [], ap = [], mob = [], comp = [];
  chs.forEach((x, c) => {
    const p = welch(x); let tot = 1e-12; for (let k = 2; k <= 90; k++) tot += p[k];
    BANDS.forEach(([lo, hi], b) => { let s = 0; for (let k = 0; k <= 128; k++) { const f = k * .5; if (f >= lo && f < hi) s += p[k]; } R[b][c] = s / tot; });
    let e = 0, cum = 0, sf = null, ce = 0, pk = -Infinity, pf = 0;
    for (let k = 2; k <= 90; k++) { const pn = p[k] / tot, f = k * .5; e -= pn * Math.log(pn + 1e-12); cum += pn; if (sf === null && cum >= .95) sf = f; ce += f * pn; if (f >= 7 && f <= 13 && p[k] > pk) { pk = p[k]; pf = f; } }
    ent[c] = e; sef[c] = sf ?? 1; cen[c] = ce; ap[c] = pf; ta[c] = Math.log((R[1][c] + 1e-9) / (R[2][c] + R[3][c] + 1e-9));
    const d1 = diff(x), v0 = vr(x) + 1e-12, v1 = vr(d1) + 1e-12, v2 = vr(diff(d1)) + 1e-12;
    mob[c] = Math.sqrt(v1 / v0); comp[c] = Math.sqrt(v2 / v1) / mob[c];
  });
  const base = [...R.flatMap(r => Array.from(r, v => Math.log(v + 1e-6))), ...ent, ...ta];
  return { dnn: base, spec: [...base, ...sef, ...cen, ...ap, ...mob, ...comp] };
}
export function allFeatures(P) {
  const n = Math.floor(P[0].length / 1024), dnn = new Float32Array(n * 152), spec = new Float32Array(n * 247);
  for (let e = 0; e < n; e++) { const f = epochFeatures(P.map(x => x.subarray(e * 1024, (e + 1) * 1024))); dnn.set(f.dnn, e * 152); spec.set(f.spec, e * 247); }
  return { dnn, spec, n };
}
