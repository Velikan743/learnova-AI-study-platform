import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handleError, publicAccount, sendMethodNotAllowed, sessionId } from '../_lib/auth';
import { database } from '../_lib/db';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return sendMethodNotAllowed(res, 'GET');
  try {
    const id = sessionId(req);
    if (!id) return res.status(401).json({ error: 'Not logged in.' });
    const db = database();
    const result = await db.query('SELECT name, email FROM learnova_accounts WHERE id = $1 LIMIT 1', [id]);
    if (!result.rows.length) return res.status(401).json({ error: 'Not logged in.' });
    return res.json({ user: publicAccount(result.rows[0] as { name: string; email: string }) });
  } catch (error) { return handleError(res, error); }
}
