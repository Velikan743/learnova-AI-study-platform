import { attachDatabasePool } from '@vercel/functions';
import { Pool } from 'pg';

let pool: Pool | undefined;

export function database() {
  if (pool) return pool;
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL is not configured.');
  pool = new Pool({ connectionString, max: 5, idleTimeoutMillis: 20_000, connectionTimeoutMillis: 10_000 });
  if (process.env.VERCEL) attachDatabasePool(pool);
  return pool;
}
