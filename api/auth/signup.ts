import type { VercelRequest, VercelResponse } from '@vercel/node';
import bcrypt from 'bcryptjs';
import { accountFromRow, bodyString, handleError, publicAccount, sendMethodNotAllowed, setSession } from '../_lib/auth.js';
import { database } from '../_lib/db.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return sendMethodNotAllowed(res, 'POST');
  try {
    const name = bodyString(req, 'name');
    const email = bodyString(req, 'email').toLowerCase();
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    if (name.length < 2 || name.length > 80) return res.status(400).json({ error: 'Please enter a name between 2 and 80 characters.' });
    if (!/^\S+@\S+\.\S+$/.test(email) || email.length > 254) return res.status(400).json({ error: 'Enter a valid email address.' });
    if (password.length < 8 || password.length > 128) return res.status(400).json({ error: 'Your password must be 8–128 characters long.' });
    const db = database();
    const id = crypto.randomUUID();
    const hash = await bcrypt.hash(password, 12);
    const result = await db.query('INSERT INTO learnova_accounts (id, name, email, password_hash) VALUES ($1, $2, $3, $4) ON CONFLICT (email) DO NOTHING RETURNING id, name, email, password_hash', [id, name, email, hash]);
    if (!result.rows.length) return res.status(409).json({ error: 'An account with this email already exists.' });
    const account = accountFromRow(result.rows[0]);
    setSession(res, account);
    return res.status(201).json({ user: publicAccount(account) });
  } catch (error) { return handleError(res, error); }
}
