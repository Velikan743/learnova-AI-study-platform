import dotenv from 'dotenv';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Pool } from 'pg';

dotenv.config({ path: '.env.local' });
dotenv.config();

const connectionString = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL_UNPOOLED is missing. Run `neon deploy` first.');
const pool = new Pool({ connectionString, max: 1, connectionTimeoutMillis: 15_000 });
try {
  const migration = await readFile(resolve('migrations/0001_learnova.sql'), 'utf8');
  await pool.query(migration);
  const result = await pool.query("SELECT to_regclass('public.learnova_accounts') AS accounts, to_regclass('public.learnova_documents') AS documents");
  console.log(`Learnova schema ready: ${result.rows[0].accounts}, ${result.rows[0].documents}`);
} finally { await pool.end(); }
