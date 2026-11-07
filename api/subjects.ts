import type { VercelRequest, VercelResponse } from '@vercel/node';
import { bodyString, handleError, sendMethodNotAllowed, sessionId } from './_lib/auth.js';
import { database } from './_lib/db.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const userId = sessionId(req);
  if (!userId) return res.status(401).json({ error: 'Please log in to manage your subjects.' });

  try {
    if (req.method === 'GET') {
      const result = await database().query('SELECT id, name FROM learnova_subjects WHERE user_id = $1 ORDER BY created_at, id', [userId]);
      return res.json({ subjects: result.rows.map(row => ({ id: String(row.id), name: String(row.name) })) });
    }

    if (req.method === 'POST') {
      const name = bodyString(req, 'name').replace(/\s+/g, ' ');
      if (name.length < 1 || name.length > 80) return res.status(400).json({ error: 'Subject names must be between 1 and 80 characters.' });
      const result = await database().query(
        'INSERT INTO learnova_subjects (id, user_id, name) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING RETURNING id, name',
        [crypto.randomUUID(), userId, name],
      );
      if (result.rows.length) return res.status(201).json({ subject: { id: String(result.rows[0].id), name: String(result.rows[0].name) } });
      const existing = await database().query('SELECT id, name FROM learnova_subjects WHERE user_id = $1 AND lower(name) = lower($2) LIMIT 1', [userId, name]);
      return res.status(200).json({ subject: { id: String(existing.rows[0].id), name: String(existing.rows[0].name) }, exists: true });
    }

    if (req.method === 'DELETE') {
      const id = typeof req.query?.id === 'string' ? req.query.id : '';
      if (!id) return res.status(400).json({ error: 'Choose a subject to remove.' });
      const result = await database().query('DELETE FROM learnova_subjects WHERE id = $1 AND user_id = $2 RETURNING id', [id, userId]);
      if (!result.rowCount) return res.status(404).json({ error: 'Subject not found.' });
      return res.status(200).json({ deleted: true });
    }

    return sendMethodNotAllowed(res, 'GET, POST, DELETE');
  } catch (error) { return handleError(res, error); }
}
