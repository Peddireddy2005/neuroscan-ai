import express from 'express';
import multer from 'multer';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import * as ort from 'onnxruntime-node';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { kind, run, get, all, insertId } from './db.js';
import { FS, loadRecording, preprocess, rawEpochs, allFeatures, subsample } from './eeg.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MODELS = process.env.MODELS_DIR || path.join(ROOT, 'models'), DIST = path.join(ROOT, 'frontend', 'dist');
const SECRET = process.env.SECRET_KEY || crypto.randomBytes(32).toString('hex'); // SET SECRET_KEY in production
const app = express(), upload = multer({ limits: { fileSize: 60 * 1024 * 1024 } });
const E = (code, msg) => Object.assign(new Error(msg), { code });
app.set('trust proxy', 1);
app.use(express.json({ limit: '10kb' }));
app.use('/api/auth', (req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});
app.use('/api/auth', rateLimit({
  windowMs: 15 * 60e3,
  limit: 60,
  message: { detail: 'Too many account requests. Please try again in a few minutes.' },
}));

// ---- auth: short-lived access JWT (Authorization header) + rotating refresh token (httpOnly cookie, stored hashed) ----
const ACCESS_TTL = +process.env.ACCESS_TTL || 900, REFRESH_DAYS = 30; // 15 min access token, 30 day refresh token
if (process.env.NODE_ENV === 'production' && (process.env.SECRET_KEY?.length ?? 0) < 32) {
  throw new Error('Set SECRET_KEY to at least 32 characters in production.');
}
if (!process.env.SECRET_KEY) console.warn('WARNING: SECRET_KEY is not set. Using a random key; tokens stop working on restart. Set SECRET_KEY in production.');
const cookieOptions = req => ({ httpOnly: true, sameSite: 'lax', secure: req.secure || process.env.NODE_ENV === 'production', path: '/api/auth' });
const hash = p => { const s = crypto.randomBytes(16); return s.toString('hex') + ':' + crypto.scryptSync(p, s, 64).toString('hex'); };
const same = (p, h) => { const [s, d] = h.split(':'); return crypto.timingSafeEqual(crypto.scryptSync(p, Buffer.from(s, 'hex'), 64), Buffer.from(d, 'hex')); };
const sha = t => crypto.createHash('sha256').update(t).digest('hex');
const cookie = (req, n) => req.headers.cookie?.split(';').map(c => c.trim().split('=')).find(([k]) => k === n)?.[1];
const auth = (req, res, next) => {
  try { req.uid = +jwt.verify((req.headers.authorization || '').slice(7), SECRET, { algorithms: ['HS256'], issuer: 'neuroscan' }).sub; }
  catch { throw E(401, 'Please sign in'); }
  next();
};
async function issue(req, res, id, email) {
  const t = crypto.randomBytes(32).toString('base64url');
  await run('insert into refresh_tokens(user_id,token_hash,expires_at) values(?,?,?)', [id, sha(t), new Date(Date.now() + REFRESH_DAYS * 864e5).toISOString()]);
  res.cookie('ns_refresh', t, { ...cookieOptions(req), maxAge: REFRESH_DAYS * 864e5 });
  return { token: jwt.sign({ sub: String(id), email }, SECRET, { expiresIn: ACCESS_TTL, issuer: 'neuroscan' }), email, expires_in: ACCESS_TTL };
}
const cred = b => {
  const e = typeof b?.email === 'string' ? b.email.trim().toLowerCase() : '';
  const p = typeof b?.password === 'string' ? b.password : '';
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e) || e.length > 200 || p.length < 8 || p.length > 200) throw E(422, 'Enter a valid email and a password of 8+ characters');
  return [e, p];
};
app.post('/api/auth/register', async (req, res) => {
  const [e, p] = cred(req.body);
  const user = await get(
    'insert into users(email,pw,created_at) values(?,?,?) on conflict(email) do nothing returning id',
    [e, hash(p), new Date().toISOString()],
  );
  if (!user) throw E(409, 'This email is already registered. Sign in with that account.');
  const { id } = user;
  res.json(await issue(req, res, id, e));
});
app.post('/api/auth/login', async (req, res) => {
  const [e, p] = cred(req.body), u = await get('select id,pw from users where email=?', [e]);
  if (!u || !same(p, u.pw)) throw E(401, 'Wrong email or password');
  res.json(await issue(req, res, u.id, e));
});
app.post('/api/auth/refresh', async (req, res) => { // rotates the refresh token on every use
  const t = cookie(req, 'ns_refresh'); if (!t) throw E(401, 'No session');
  const now = new Date().toISOString();
  await run('delete from refresh_tokens where expires_at <= ?', [now]);
  const r = await get(
    'update refresh_tokens set revoked=1 where token_hash=? and revoked=0 and expires_at>? returning user_id',
    [sha(t), now],
  );
  if (!r) throw E(401, 'Session expired');
  const u = await get('select id,email from users where id=?', [r.user_id]);
  res.json(await issue(req, res, u.id, u.email));
});
app.post('/api/auth/logout', async (req, res) => {
  const t = cookie(req, 'ns_refresh'); if (t) await run('update refresh_tokens set revoked=1 where token_hash=?', [sha(t)]);
  res.clearCookie('ns_refresh', cookieOptions(req)); res.json({ ok: true });
});
app.get('/api/auth/me', auth, async (req, res) => res.json({ email: (await get('select email from users where id=?', [req.uid]))?.email }));

// ---- models: each folder in models/ = meta.json + member *.onnx files (a cross-validation-fold ensemble) ----
const read = f => JSON.parse(fs.readFileSync(f, 'utf8'));
const registry = () => !fs.existsSync(MODELS) ? [] : fs.readdirSync(MODELS).filter(d => /^[\w.-]+$/.test(d) && fs.existsSync(path.join(MODELS, d, 'meta.json'))).map(d => {
  const dir = path.join(MODELS, d), members = fs.readdirSync(dir).filter(f => f.endsWith('.onnx')).sort();
  return members.length ? { ...read(path.join(dir, 'meta.json')), id: d, dir, members } : null;
}).filter(Boolean);

app.get('/api/health', async (q, r) => { await get('select 1 as ok'); r.json({ status: 'ok', database: kind, models: registry().length }); });
app.get('/api/models', (q, r) => r.json(registry().map(({ id, name, description, accuracy, members }) => ({ id, name, description, accuracy, members: members.length }))));
app.get('/api/metrics', (q, r) => r.json(Object.fromEntries(registry().map(m => {
  const f = path.join(m.dir, 'metrics.json'); return [m.id, { name: m.name, metrics: fs.existsSync(f) ? read(f) : {} }];
}))));

// ---- history ----
app.get('/api/history', auth, async (q, r) => r.json(await all('select id,name,date,cls,score,agreement,duration_s,status from history where user_id=? order by id', [q.uid])));
app.get('/api/history/:id', auth, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id <= 0) throw E(404, 'Report unavailable');
  const row = await get('select id,name,date,cls,duration_s,agreement,report_json from history where id=? and user_id=?', [id, req.uid]);
  if (!row) throw E(404, 'Report unavailable');
  const { report_json, ...summary } = row;
  const report = report_json ? JSON.parse(report_json) : null;
  if (report && !report.findings && report.votes) {
    report.findings = report.votes;
    delete report.votes;
  }
  res.json({ ...summary, report });
});
app.delete('/api/history', auth, async (q, r) => { await run('delete from history where user_id=?', [q.uid]); r.json({ cleared: true }); });

// ---- predict: all installed models run in the BACKGROUND; the user only ever sees one combined result ----
const INPUTS = { // what each model family consumes (see backend/eeg.js)
  raw8: P => ({ ...rawEpochs(P, 1024), shape: [1024, 19] }), raw1: P => ({ ...rawEpochs(P, 128), shape: [128, 19] }),
  feat152: (P, memo) => { const f = (memo.f ??= allFeatures(P)); return { data: f.dnn, n: f.n, shape: [152] }; },
  spec247: (P, memo) => { const f = (memo.f ??= allFeatures(P)); return { data: f.spec, n: f.n, shape: [247] }; },
};
async function runModel(m, P, memo, step) { // -> P(Alzheimer) averaged over epochs and ensemble members
  const { data, n, shape } = subsample(INPUTS[m.input](P, memo), m.max_epochs), row = shape.reduce((a, b) => a * b), vals = [];
  // Keep native inference memory bounded while evaluating every checkpoint.
  const batchSize = 4;
  for (const filename of m.members) {
    const session = await ort.InferenceSession.create(path.join(m.dir, filename), {
      intraOpNumThreads: 1,
      interOpNumThreads: 1,
      enableCpuMemArena: false,
      enableMemPattern: false,
    });
    let sum = 0;
    try {
      for (let offset = 0; offset < n; offset += batchSize) {
        const count = Math.min(batchSize, n - offset);
        const values = data.subarray(offset * row, (offset + count) * row);
        const input = new ort.Tensor('float32', values, [count, ...shape]);
        const outputs = await session.run({ [session.inputNames[0]]: input });
        const predictions = outputs[session.outputNames[0]].data;
        const width = predictions.length / count;
        for (let j = 0; j < count; j++) {
          sum += predictions[j * width + (width === 2 ? 1 : 0)];
        }
      }
    } finally {
      await session.release();
    }
    vals.push(sum / n);
    step?.();
    await new Promise(resolve => setImmediate(resolve));
  }
  const v = vals.reduce((a, b) => a + b, 0) / vals.length;
  return m.pooling === 'decision' ? 1 / (1 + Math.exp(-v)) : v;
}
const jobs = new Map(); let queue = Promise.resolve(); // one analysis at a time keeps memory use predictable
setInterval(() => { for (const [k, j] of jobs) if (Date.now() - j.created > 3600e3) jobs.delete(k); }, 600e3).unref();

async function analyze(job, rec, models, name, uid) {
  try {
    job.status = 'running';
    const P = preprocess(rec.sig), memo = {}, total = models.reduce((a, m) => a + m.members.length, 0); let done = 0; const scores = [];
    for (const m of models) { scores.push(await runModel(m, P, memo, () => { job.progress = ++done / total * .98; })); await new Promise(r => setImmediate(r)); }
    if (!scores.every(Number.isFinite)) throw Error('Invalid model output');
    const findings = scores.map((score, index) => ({
      model: models[index].name,
      score, members: models[index].members.length,
      label: score > 0.5 ? 'Alzheimer' : 'Healthy',
    }));
    const alzheimer = findings.filter(item => item.label === 'Alzheimer').length;
    const healthy = findings.length - alzheimer;
    const label = alzheimer === healthy ? 'Inconclusive' : alzheimer > healthy ? 'Alzheimer' : 'Healthy';
    const agreement = { alzheimer, healthy, total: findings.length };
    const score = scores.reduce((sum, value) => sum + value, 0) / findings.length;
    const warnings = [...rec.warnings, ...(rec.n < 60 * FS ? ['Short recording (under 60 s): fewer epochs means a less stable result'] : [])];
    const date = new Date().toISOString();
    const report = { version: 2, name, date, label, score, agreement, findings, duration_s: +(rec.n / FS).toFixed(1), channels: 19, sample_rate: FS, warnings };
    const id = await insertId('insert into history(user_id,name,date,model,cls,probs,status,score,agreement,duration_s,report_json) values(?,?,?,?,?,?,?,?,?,?,?)', [
      uid, name, date, '', `${label} (AD ${alzheimer}, healthy ${healthy})`, '', 'Complete', score,
      `${Math.max(alzheimer, healthy)}/${findings.length}`, report.duration_s, JSON.stringify(report)
    ]);
    job.result = { ...report, id };
    job.progress = 1; job.status = 'done';
  } catch (e) { console.error(e); job.status = 'error'; job.error = 'The analysis could not be completed on the server. Please try again, or contact the administrator.'; }
}
app.post('/api/predict', auth, upload.array('files', 40), (req, res) => {
  const models = registry(); if (!models.length) throw E(503, 'No trained models are installed on the server yet');
  if (!req.files?.length) throw E(422, 'No file uploaded');
  if (+req.body.fs && +req.body.fs !== FS) throw E(422, `The models need ${FS} Hz recordings. Resample your data to ${FS} Hz first.`);
  let rec;
  try { rec = loadRecording(req.files.map(f => ({ name: path.basename(f.originalname), buffer: f.buffer }))); if (rec.n < 8 * FS) throw new Error('Recording too short: at least 8 seconds (1024 samples at 128 Hz) are required'); }
  catch (e) { throw E(422, e.message); }
  const id = crypto.randomUUID(), job = { uid: req.uid, status: 'queued', progress: 0, created: Date.now() };
  const alias = (typeof req.body.name === 'string' ? req.body.name : '').trim().slice(0, 100);
  const name = alias || (req.files.length === 1 ? path.basename(req.files[0].originalname) : 'Recording (19 channels)');
  jobs.set(id, job); queue = queue.then(() => analyze(job, rec, models, name, req.uid));
  res.status(202).json({ job_id: id });
});
app.get('/api/jobs/:id', auth, (req, res) => {
  const j = jobs.get(req.params.id); if (!j || j.uid !== req.uid) throw E(404, 'Analysis not found (it may have expired)');
  res.json({ status: j.status, progress: j.progress, result: j.result, error: j.error });
});

// ---- built React app (client-side routes fall back to index.html) ----
if (fs.existsSync(DIST)) { app.use(express.static(DIST)); app.get(/^\/(?!api\/).*/, (q, r) => r.sendFile(path.join(DIST, 'index.html'))); }
app.use((err, req, res, next) => {
  const c = err.code === 'LIMIT_FILE_SIZE' ? 413 : err.type === 'entity.parse.failed' ? 400 : err.type === 'entity.too.large' ? 413 : Number.isInteger(err.code) ? err.code : 500;
  if (c === 500) console.error(err);
  res.status(c).json({ detail: c === 500 ? 'Server error' : c === 400 ? 'Invalid JSON request' : err.code === 'LIMIT_FILE_SIZE' ? 'File exceeds 60 MB limit' : err.message });
});
const port = process.env.PORT || 8000;
app.listen(port, () => console.log('NeuroScan running on :' + port));

