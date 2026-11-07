import type { VercelRequest, VercelResponse } from '@vercel/node';
import { bodyString, handleError, sendMethodNotAllowed, sessionId } from '../_lib/auth.js';
import { database } from '../_lib/db.js';
import { storage } from '../_lib/storage.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return sendMethodNotAllowed(res, 'GET');
  try {
    const userId = sessionId(req);
    if (!userId) return res.status(401).json({ error: 'Please log in to continue.' });
    const id = typeof req.query?.id === 'string' ? req.query.id : '';
    const result = await database().query('SELECT object_key FROM learnova_documents WHERE id = $1 AND user_id = $2 AND status = $3 LIMIT 1', [id, userId, 'uploaded']);
    if (!result.rows.length) return res.status(404).json({ error: 'File not found.' });
    const url = await storage().url(String(result.rows[0].object_key), { expiresIn: 300 });
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('Location', url);
    return res.status(302).end();
  } catch (error) { return handleError(res, error); }
}
