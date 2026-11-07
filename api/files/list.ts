import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handleError, sendMethodNotAllowed, sessionId } from '../_lib/auth';
import { database } from '../_lib/db';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return sendMethodNotAllowed(res, 'GET');
  try {
    const userId = sessionId(req);
    if (!userId) return res.status(401).json({ error: 'Please log in to continue.' });
    const result = await database().query('SELECT id, filename, byte_size, created_at FROM learnova_documents WHERE user_id = $1 AND status = $2 ORDER BY created_at DESC LIMIT 100', [userId, 'uploaded']);
    return res.json({ files: result.rows.map(row => ({ id: row.id, filename: row.filename, size: Number(row.byte_size), createdAt: row.created_at })) });
  } catch (error) { return handleError(res, error); }
}
