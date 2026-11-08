import dotenv from 'dotenv';
import { readdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Pool } from 'pg';

dotenv.config({ path: '.env.local' });
dotenv.config();

const connectionString = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL_UNPOOLED is missing. Run `neon deploy` first.');
const pool = new Pool({ connectionString, max: 1, connectionTimeoutMillis: 15_000 });
try {
  const files = (await readdir(resolve('migrations'))).filter(file => /^\d+_.+\.sql$/.test(file)).sort();
  for (const file of files) await pool.query(await readFile(resolve('migrations', file), 'utf8'));
  const result = await pool.query("SELECT to_regclass('public.learnova_accounts') AS accounts, to_regclass('public.learnova_documents') AS documents, to_regclass('public.learnova_subjects') AS subjects, to_regclass('public.learnova_activity') AS activity");
  console.log(`Learnova schema ready: ${result.rows[0].accounts}, ${result.rows[0].documents}, ${result.rows[0].subjects}, ${result.rows[0].activity}`);
} finally { await pool.end(); }
