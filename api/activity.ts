import type { VercelRequest, VercelResponse } from '@vercel/node';
import { randomUUID } from 'node:crypto';
import { bodyString, handleError, sendMethodNotAllowed, sessionId } from './_lib/auth.js';
import { database } from './_lib/db.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const userId = sessionId(req);
  if (!userId) return res.status(401).json({ error: 'Please sign in again.' });
  const db = database();
  try {
    if (req.method === 'GET') {
      const [totals, days, uploads, sessionsBySubject, recentActivity] = await Promise.all([
        db.query(`SELECT
          COALESCE(SUM(duration_minutes) FILTER (WHERE created_at >= date_trunc('week', NOW())), 0)::int AS minutes_this_week,
          COUNT(*) FILTER (WHERE event_type = 'quiz_generated')::int AS quizzes_generated,
          COUNT(*) FILTER (WHERE event_type = 'study_session')::int AS sessions_completed
          FROM learnova_activity WHERE user_id = $1`, [userId]),
        db.query(`SELECT created_at::date::text AS day FROM learnova_activity
          WHERE user_id = $1 AND event_type = 'study_session'
          GROUP BY created_at::date ORDER BY day DESC LIMIT 366`, [userId]),
        db.query(`SELECT COUNT(*)::int AS count FROM learnova_documents WHERE user_id = $1 AND status = 'uploaded'`, [userId]),
        db.query(`SELECT subject, COUNT(*)::int AS count, MIN(created_at) AS first_session FROM learnova_activity WHERE user_id = $1 AND event_type = 'study_session' GROUP BY subject ORDER BY first_session`, [userId]),
        db.query(`SELECT id, event_type, subject, duration_minutes, created_at FROM learnova_activity WHERE user_id = $1 ORDER BY created_at DESC LIMIT 10`, [userId])
      ]);
      const activeDays = new Set(days.rows.map(row => String(row.day).slice(0, 10)));
      let streak = 0;
      const date = new Date(); date.setUTCHours(0, 0, 0, 0);
      const today = date.toISOString().slice(0, 10);
      if (!activeDays.has(today)) date.setUTCDate(date.getUTCDate() - 1);
      while (activeDays.has(date.toISOString().slice(0, 10))) { streak++; date.setUTCDate(date.getUTCDate() - 1); }
      return res.status(200).json({ ...totals.rows[0], current_streak: streak, notes_uploaded: uploads.rows[0].count, sessions_by_subject: sessionsBySubject.rows.map(row => ({ subject: row.subject === null ? null : String(row.subject), count: Number(row.count) })), recent_activity: recentActivity.rows.map(row => ({ id: String(row.id), type: String(row.event_type), subject: row.subject === null ? null : String(row.subject), durationMinutes: Number(row.duration_minutes), createdAt: row.created_at })) });
    }
    if (req.method === 'POST') {
      const type = bodyString(req, 'type');
      if (type !== 'study_session' && type !== 'quiz_generated') return res.status(400).json({ error: 'Unknown activity type.' });
      const minutes = type === 'study_session' ? Number(req.body?.durationMinutes) : 0;
      if (!Number.isInteger(minutes) || minutes < 0 || minutes > 240 || (type === 'study_session' && minutes < 1)) return res.status(400).json({ error: 'Study time must be between 1 and 240 minutes.' });
      const subject = bodyString(req, 'subject').slice(0, 80) || null;
      await db.query('INSERT INTO learnova_activity (id, user_id, event_type, subject, duration_minutes) VALUES ($1, $2, $3, $4, $5)', [randomUUID(), userId, type, subject, minutes]);
      return res.status(201).json({ ok: true });
    }
    return sendMethodNotAllowed(res, 'GET, POST');
  } catch (error) { return handleError(res, error); }
}
