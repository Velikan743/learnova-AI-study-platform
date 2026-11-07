import type { VercelRequest, VercelResponse } from '@vercel/node';
import { bodyString, handleError, sendMethodNotAllowed, sessionId } from '../_lib/auth.js';
import { database } from '../_lib/db.js';
import { storage } from '../_lib/storage.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return sendMethodNotAllowed(res, 'POST');
  try {
    const userId = sessionId(req);
    if (!userId) return res.status(401).json({ error: 'Please log in to continue.' });
    const id = bodyString(req, 'id');
    if (!id) return res.status(400).json({ error: 'Missing document id.' });
    const db = database();
    const pending = await db.query('SELECT object_key, filename, byte_size FROM learnova_documents WHERE id = $1 AND user_id = $2 AND status = $3 LIMIT 1', [id, userId, 'pending']);
    if (!pending.rows.length) return res.status(404).json({ error: 'Upload not found or already completed.' });
    const row = pending.rows[0] as { object_key: string; filename: string; byte_size: string | number };
    const info = await storage().head(row.object_key);
    if (info.contentType !== 'application/pdf' || Number(info.size) !== Number(row.byte_size)) {
      await storage().delete(row.object_key).catch(() => undefined);
      await db.query('DELETE FROM learnova_documents WHERE id = $1 AND user_id = $2', [id, userId]);
      return res.status(400).json({ error: 'The uploaded file did not match the expected PDF.' });
    }
    await db.query('UPDATE learnova_documents SET status = $1 WHERE id = $2 AND user_id = $3', ['uploaded', id, userId]);
    return res.status(201).json({ id, filename: row.filename, size: Number(info.size) });
  } catch (error) { return handleError(res, error); }
}
