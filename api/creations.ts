import type { VercelRequest, VercelResponse } from '@vercel/node';
import { randomUUID } from 'node:crypto';
import { bodyString, handleError, sendMethodNotAllowed, sessionId } from './_lib/auth.js';
import { database } from './_lib/db.js';

const allowedTools = new Set(['quiz', 'notes', 'planner', 'performance', 'transcript', 'advisor', 'resume', 'roadmap', 'interview']);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const userId = sessionId(req);
  if (!userId) return res.status(401).json({ error: 'Please sign in again.' });
  try {
    if (req.method === 'GET') {
      const tool = typeof req.query.tool === 'string' ? req.query.tool : '';
      if (!allowedTools.has(tool)) return res.status(400).json({ error: 'Choose a valid study tool.' });
      const result = await database().query(
        'SELECT id, title, content, created_at FROM learnova_creations WHERE user_id = $1 AND tool = $2 ORDER BY created_at DESC LIMIT 5',
        [userId, tool]
      );
      return res.status(200).json({ creations: result.rows.map(row => ({ id: row.id, title: row.title, content: row.content, createdAt: row.created_at })) });
    }
    if (req.method === 'POST') {
      const tool = bodyString(req, 'tool');
      const content = bodyString(req, 'content');
      const title = bodyString(req, 'title').slice(0, 140);
      if (!allowedTools.has(tool)) return res.status(400).json({ error: 'Choose a valid study tool.' });
      if (!content || content.length > 30000) return res.status(400).json({ error: 'Generated work must be between 1 and 30,000 characters.' });
      const id = randomUUID();
      await database().query('INSERT INTO learnova_creations (id, user_id, tool, title, content) VALUES ($1, $2, $3, $4, $5)', [id, userId, tool, title || 'Saved study work', content]);
      return res.status(201).json({ id });
    }
    if (req.method === 'DELETE') {
      const id = typeof req.query.id === 'string' ? req.query.id : '';
      if (!id) return res.status(400).json({ error: 'Choose a saved item to delete.' });
      const result = await database().query('DELETE FROM learnova_creations WHERE id = $1 AND user_id = $2 RETURNING id', [id, userId]);
      if (!result.rowCount) return res.status(404).json({ error: 'That saved item was not found.' });
      return res.status(200).json({ ok: true });
    }
    return sendMethodNotAllowed(res, 'GET, POST, DELETE');
  } catch (error) { return handleError(res, error); }
}
