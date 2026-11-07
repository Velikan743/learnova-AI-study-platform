import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handleError, publicAccount, sendMethodNotAllowed, sessionId } from '../_lib/auth';
import { ensureAccountsTable } from '../_lib/db';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return sendMethodNotAllowed(res, 'GET');
  try {
    const id = sessionId(req);
    if (!id) return res.status(401).json({ error: 'Not logged in.' });
    const sql = await ensureAccountsTable();
    const rows = await sql`SELECT name, email FROM learnova_accounts WHERE id = ${id} LIMIT 1`;
    if (!rows.length) return res.status(401).json({ error: 'Not logged in.' });
    return res.json({ user: publicAccount(rows[0] as { name: string; email: string }) });
  } catch (error) { return handleError(res, error); }
}
