import { neon } from '@neondatabase/serverless';

export function database() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not configured. Connect a Neon Postgres database in Vercel.');
  return neon(url);
}

export async function ensureAccountsTable() {
  const sql = database();
  await sql`CREATE TABLE IF NOT EXISTS learnova_accounts (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
  return sql;
}
