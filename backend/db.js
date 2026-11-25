// Database layer. DATABASE_URL set -> PostgreSQL (production). Not set -> SQLite file (local development).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const URL_ = process.env.DATABASE_URL;
export const kind = URL_ ? 'postgres' : 'sqlite';
let all, run;
if (URL_) {
  const { default: pg } = await import('pg');
  const local = /localhost|127\.0\.0\.1|@db[:/]/.test(URL_); // hosted databases (Render, Neon, Supabase...) need SSL
  const pool = new pg.Pool({ connectionString: URL_, max: 10, ssl: process.env.PGSSL === 'false' || local ? false : { rejectUnauthorized: false } });
  const num = s => { let i = 0; return s.replace(/\?/g, () => '$' + ++i); }; // write "?" once, works for both databases
  all = async (s, p = []) => (await pool.query(num(s), p)).rows;
  run = async (s, p = []) => { await pool.query(num(s), p); };
} else {
  const { default: Database } = await import('better-sqlite3');
  const file = process.env.DATABASE_PATH || path.join(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), 'neuroscan.db');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const d = new Database(file); d.pragma('journal_mode = WAL');
  all = async (s, p = []) => d.prepare(s).all(...p);
  run = async (s, p = []) => { d.prepare(s).run(...p); };
  console.log('Database: SQLite file', file);
}
export { run, all };
export const get = async (s, p) => (await all(s, p))[0];
export const insertId = async (s, p) => (await all(s + ' returning id', p))[0].id;

const pk = URL_ ? 'serial primary key' : 'integer primary key autoincrement';
await run(`create table if not exists users(id ${pk}, email text unique not null, pw text not null, created_at text)`);
await run(`create table if not exists refresh_tokens(id ${pk}, user_id integer not null, token_hash text unique not null, expires_at text not null, revoked integer default 0)`);
await run(`create table if not exists history(id ${pk}, user_id integer not null, name text, date text, model text, cls text, probs text, status text)`);
await run('create index if not exists ix_history_user on history(user_id)');
for (const c of ['users add column created_at text', 'history add column score real', 'history add column agreement text', 'history add column duration_s real'])
  try { await run('alter table ' + c); } catch { /* column already exists */ }
if (URL_) console.log('Database: PostgreSQL');

if (URL_) {
  await run('alter table history add column if not exists report_json text');
} else if (!(await all('pragma table_info(history)')).some(column => column.name === 'report_json')) {
  await run('alter table history add column report_json text');
}
