import type { VercelRequest, VercelResponse } from '@vercel/node';
import bcrypt from 'bcryptjs';
import { handleError, sendMethodNotAllowed, sessionId } from '../_lib/auth.js';
import { database } from '../_lib/db.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return sendMethodNotAllowed(res, 'POST');
  const userId = sessionId(req);
  if (!userId) return res.status(401).json({ error: 'Please log in to change your password.' });
  try {
    const currentPassword = typeof req.body?.currentPassword === 'string' ? req.body.currentPassword : '';
    const newPassword = typeof req.body?.newPassword === 'string' ? req.body.newPassword : '';
    if (newPassword.length < 8 || newPassword.length > 128) return res.status(400).json({ error: 'Your new password must be 8–128 characters long.' });
    const result = await database().query('SELECT password_hash FROM learnova_accounts WHERE id = $1 LIMIT 1', [userId]);
    if (!result.rows.length) return res.status(401).json({ error: 'Please log in again.' });
    if (!(await bcrypt.compare(currentPassword, String(result.rows[0].password_hash)))) return res.status(401).json({ error: 'Your current password is incorrect.' });
    const passwordHash = await bcrypt.hash(newPassword, 12);
    await database().query('UPDATE learnova_accounts SET password_hash = $2 WHERE id = $1', [userId, passwordHash]);
    return res.json({ ok: true });
  } catch (error) { return handleError(res, error); }
}
