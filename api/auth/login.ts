import type { VercelRequest, VercelResponse } from '@vercel/node';
import bcrypt from 'bcryptjs';
import { accountFromRow, bodyString, handleError, publicAccount, sendMethodNotAllowed, setSession } from '../_lib/auth';
import { ensureAccountsTable } from '../_lib/db';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return sendMethodNotAllowed(res, 'POST');
  try {
    const email = bodyString(req, 'email').toLowerCase();
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    const sql = await ensureAccountsTable();
    const rows = await sql`SELECT id, name, email, password_hash FROM learnova_accounts WHERE email = ${email} LIMIT 1`;
    if (!rows.length) return res.status(401).json({ error: 'Email or password is incorrect.' });
    const account = accountFromRow(rows[0]);
    if (!(await bcrypt.compare(password, account.password_hash))) return res.status(401).json({ error: 'Email or password is incorrect.' });
    setSession(res, account);
    return res.json({ user: publicAccount(account) });
  } catch (error) { return handleError(res, error); }
}
