import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handleError, sendMethodNotAllowed, sessionId } from '../_lib/auth.js';
import { database } from '../_lib/db.js';
import { storage } from '../_lib/storage.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const userId = sessionId(req);
    if (!userId) return res.status(401).json({ error: 'Please log in to continue.' });
    if (req.method === 'DELETE') {
      const id = typeof req.query.id === 'string' ? req.query.id : '';
      if (!id) return res.status(400).json({ error: 'Choose a PDF to remove.' });
      const file = await database().query('SELECT object_key FROM learnova_documents WHERE id = $1 AND user_id = $2 AND status = $3 LIMIT 1', [id, userId, 'uploaded']);
      if (!file.rows.length) return res.status(404).json({ error: 'That PDF was not found in your library.' });
      await storage().delete(String(file.rows[0].object_key));
      await database().query('DELETE FROM learnova_documents WHERE id = $1 AND user_id = $2 AND status = $3', [id, userId, 'uploaded']);
      return res.status(200).json({ deleted: true });
    }
    if (req.method !== 'GET') return sendMethodNotAllowed(res, 'GET, DELETE');
    const result = await database().query('SELECT id, filename, byte_size, created_at FROM learnova_documents WHERE user_id = $1 AND status = $2 ORDER BY created_at DESC LIMIT 100', [userId, 'uploaded']);
    return res.json({ files: result.rows.map(row => ({ id: row.id, filename: row.filename, size: Number(row.byte_size), createdAt: row.created_at })) });
  } catch (error) { return handleError(res, error); }
}
