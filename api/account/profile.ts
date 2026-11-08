import type { VercelRequest, VercelResponse } from '@vercel/node';
import bcrypt from 'bcryptjs';
import { bodyString, handleError, sendMethodNotAllowed, sessionId } from '../_lib/auth.js';
import { database } from '../_lib/db.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const userId = sessionId(req);
  if (!userId) return res.status(401).json({ error: 'Please log in to manage your account.' });
  try {
    const db = database();
    if (req.method === 'GET') {
      const result = await db.query('SELECT name, email, phone, profile_picture_key FROM learnova_accounts WHERE id = $1 LIMIT 1', [userId]);
      if (!result.rows.length) return res.status(401).json({ error: 'Please log in again.' });
      const row = result.rows[0] as { name: string; email: string; phone: string | null; profile_picture_key: string | null };
      return res.json({ user: { name: row.name, email: row.email, phone: row.phone || '', profilePictureUrl: row.profile_picture_key ? `/api/account/avatar?v=${encodeURIComponent(row.profile_picture_key)}` : '' } });
    }
    if (req.method !== 'PATCH') return sendMethodNotAllowed(res, 'GET, PATCH');
    const name = bodyString(req, 'name');
    const email = bodyString(req, 'email').toLowerCase();
    const phone = bodyString(req, 'phone');
    const currentPassword = typeof req.body?.currentPassword === 'string' ? req.body.currentPassword : '';
    if (name.length < 2 || name.length > 80) return res.status(400).json({ error: 'Name must be between 2 and 80 characters.' });
    if (!/^\S+@\S+\.\S+$/.test(email) || email.length > 254) return res.status(400).json({ error: 'Enter a valid email address.' });
    if (phone.length > 32 || (phone && (phone.replace(/\D/g, '').length < 7 || phone.replace(/\D/g, '').length > 15 || !/^[+0-9().\s-]+$/.test(phone)))) return res.status(400).json({ error: 'Enter a valid phone number, including its country code if needed.' });
    const current = await db.query('SELECT email, password_hash FROM learnova_accounts WHERE id = $1 LIMIT 1', [userId]);
    if (!current.rows.length) return res.status(401).json({ error: 'Please log in again.' });
    const account = current.rows[0] as { email: string; password_hash: string };
    if (email !== account.email && !(await bcrypt.compare(currentPassword, account.password_hash))) return res.status(401).json({ error: 'Enter your current password to change your email address.' });
    try {
      const updated = await db.query('UPDATE learnova_accounts SET name = $2, email = $3, phone = $4 WHERE id = $1 RETURNING name, email, phone, profile_picture_key', [userId, name, email, phone || null]);
      const row = updated.rows[0] as { name: string; email: string; phone: string | null; profile_picture_key: string | null };
      return res.json({ user: { name: row.name, email: row.email, phone: row.phone || '', profilePictureUrl: row.profile_picture_key ? `/api/account/avatar?v=${encodeURIComponent(row.profile_picture_key)}` : '' } });
    } catch (error) {
      if (typeof error === 'object' && error !== null && 'code' in error && error.code === '23505') return res.status(409).json({ error: 'That email address is already used by another account.' });
      throw error;
    }
  } catch (error) { return handleError(res, error); }
}
