// Server-side only. Applies SQL migrations over a direct Postgres connection.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import pg from 'pg';

const here = path.dirname(fileURLToPath(import.meta.url));
const env = Object.fromEntries(
  readFileSync(path.join(here, '.env'), 'utf8').split(/\r?\n/)
    .filter((l) => l.includes('=') && !l.startsWith('#'))
    .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)])
);

Object.assign(env, process.env);
if (!env.DB_PASSWORD) throw new Error('Set DB_PASSWORD in the process environment before running migrations.');
const file = process.argv[2] || '0001_online.sql';
const sql = readFileSync(path.join(here, file), 'utf8');

const candidates = [
  { host: `aws-0-${env.REGION}.pooler.supabase.com`, port: 5432, user: `postgres.${env.PROJECT_REF}` },
  { host: `db.${env.PROJECT_REF}.supabase.co`, port: 5432, user: 'postgres' },
];

let client = null;
for (const c of candidates) {
  const trial = new pg.Client({ ...c, password: env.DB_PASSWORD, database: 'postgres', ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 8000 });
  try {
    await trial.connect();
    client = trial;
    console.log('connected via', c.host);
    break;
  } catch (e) {
    console.log('failed', c.host, '-', e.message);
    await trial.end().catch(() => {});
  }
}
if (!client) { console.error('no reachable database host'); process.exit(1); }

try {
  await client.query(sql);
  console.log('migration applied:', file);
  const tables = await client.query(`select table_name from information_schema.tables where table_schema='public' order by 1`);
  console.log('tables:', tables.rows.map((r) => r.table_name).join(', '));
  const pol = await client.query(`select tablename, policyname from pg_policies where schemaname='public' order by 1,2`);
  console.log('policies:', pol.rows.map((r) => `${r.tablename}.${r.policyname}`).join(', '));
  const grants = await client.query(`select grantee, table_name, privilege_type from information_schema.role_table_grants where table_schema='public' and grantee in ('anon','authenticated') order by 1,2,3`);
  console.log('grants:', grants.rows.map((r) => `${r.grantee}:${r.table_name}:${r.privilege_type}`).join(', '));
} finally {
  await client.end();
}