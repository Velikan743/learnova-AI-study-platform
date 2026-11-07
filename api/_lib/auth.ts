import type { VercelRequest, VercelResponse } from '@vercel/node';
import jwt from 'jsonwebtoken';

export type Account = { id: string; name: string; email: string; password_hash: string };
export const publicAccount = (account: Pick<Account, 'name' | 'email'>) => ({ name: account.name, email: account.email });
export function sendMethodNotAllowed(res: VercelResponse, method: string) {
  res.setHeader('Allow', method);
  return res.status(405).json({ error: 'Method not allowed.' });
}
export function sessionSecret() {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) throw new Error('SESSION_SECRET must be set to a random value of at least 32 characters.');
  return secret;
}
export function setSession(res: VercelResponse, account: Account) {
  const token = jwt.sign({ sub: account.id }, sessionSecret(), { expiresIn: '7d' });
  res.setHeader('Set-Cookie', `learnova_session=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=604800`);
}
export function clearSession(res: VercelResponse) {
  res.setHeader('Set-Cookie', 'learnova_session=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0');
}
export function sessionId(req: VercelRequest): string | undefined {
  const token = req.cookies?.learnova_session;
  if (!token) return undefined;
  try {
    const payload = jwt.verify(token, sessionSecret()) as jwt.JwtPayload;
    return typeof payload.sub === 'string' ? payload.sub : undefined;
  } catch { return undefined; }
}
export function bodyString(req: VercelRequest, key: string) {
  const value = req.body?.[key];
  return typeof value === 'string' ? value.trim() : '';
}
export function handleError(res: VercelResponse, error: unknown) {
  console.error(error);
  const message = error instanceof Error ? error.message : '';
  if (/AWS_|DATABASE_URL|SESSION_SECRET/.test(message)) return res.status(503).json({ error: message });
  return res.status(500).json({ error: 'Something went wrong on the server.' });
}
export function accountFromRow(row: Record<string, unknown>): Account {
  return { id: String(row.id), name: String(row.name), email: String(row.email), password_hash: String(row.password_hash) };
}
