import type { VercelRequest, VercelResponse } from '@vercel/node';
import { clearSession, sendMethodNotAllowed } from '../_lib/auth';

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return sendMethodNotAllowed(res, 'POST');
  clearSession(res);
  return res.json({ ok: true });
}
