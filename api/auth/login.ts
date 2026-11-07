import type { VercelRequest, VercelResponse } from '@vercel/node';
import bcrypt from 'bcryptjs';
import { accountFromRow, bodyString, handleError, publicAccount, sendMethodNotAllowed, setSession } from '../_lib/auth.js';
import { database } from '../_lib/db.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return sendMethodNotAllowed(res, 'POST');
  try {
    const email = bodyString(req, 'email').toLowerCase();
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    const db = database();
    const result = await db.query('SELECT id, name, email, password_hash FROM learnova_accounts WHERE email = $1 LIMIT 1', [email]);
    if (!result.rows.length) return res.status(401).json({ error: 'Email or password is incorrect.' });
    const account = accountFromRow(result.rows[0]);
    if (!(await bcrypt.compare(password, account.password_hash))) return res.status(401).json({ error: 'Email or password is incorrect.' });
    setSession(res, account);
    return res.json({ user: publicAccount(account) });
  } catch (error) { return handleError(res, error); }
}
