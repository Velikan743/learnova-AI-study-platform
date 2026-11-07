import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

type Account = { id: string; name: string; email: string; passwordHash: string; createdAt: string };
const app = express();
const port = Number(process.env.PORT || 3001);
const secret = process.env.SESSION_SECRET;
const dataPath = resolve(process.env.DATA_PATH || 'data/accounts.json');
const publicAccount = ({ id: _id, name, email }: Account) => ({ name, email });

app.use(cors({ origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173', credentials: true }));
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());

async function accounts(): Promise<Account[]> {
  try { return JSON.parse(await readFile(dataPath, 'utf8')) as Account[]; }
  catch (err) { if ((err as NodeJS.ErrnoException).code === 'ENOENT') return []; throw err; }
}
async function saveAccounts(value: Account[]) {
  await mkdir(dirname(dataPath), { recursive: true });
  await writeFile(dataPath, JSON.stringify(value, null, 2), { mode: 0o600 });
}
function issueSession(res: express.Response, account: Account) {
  if (!secret) throw new Error('SESSION_SECRET is missing. Copy .env.example to .env and set a private secret.');
  const token = jwt.sign({ sub: account.id }, secret, { expiresIn: '7d' });
  res.cookie('learnova_session', token, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: 7 * 86400000, path: '/' });
}
async function currentAccount(req: express.Request): Promise<Account | undefined> {
  if (!secret || !req.cookies.learnova_session) return;
  try {
    const payload = jwt.verify(req.cookies.learnova_session, secret) as jwt.JwtPayload;
    return (await accounts()).find(a => a.id === payload.sub);
  } catch { return; }
}
const requireAccount: express.RequestHandler = async (req, res, next) => {
  const account = await currentAccount(req);
  if (!account) { res.status(401).json({ error: 'Please log in to continue.' }); return; }
  res.locals.account = account;
  next();
};

app.get('/api/health', (_req, res) => res.json({ ok: true, aiReady: Boolean(process.env.GEMINI_API_KEY) }));
app.post('/api/auth/signup', async (req, res) => {
  const name = String(req.body?.name || '').trim();
  const email = String(req.body?.email || '').trim().toLowerCase();
  const password = String(req.body?.password || '');
  if (name.length < 2 || name.length > 80) { res.status(400).json({ error: 'Please enter a name between 2 and 80 characters.' }); return; }
  if (!/^\S+@\S+\.\S+$/.test(email) || email.length > 254) { res.status(400).json({ error: 'Enter a valid email address.' }); return; }
  if (password.length < 8 || password.length > 128) { res.status(400).json({ error: 'Your password must be 8–128 characters long.' }); return; }
  const all = await accounts();
  if (all.some(a => a.email === email)) { res.status(409).json({ error: 'An account with this email already exists.' }); return; }
  const account: Account = { id: crypto.randomUUID(), name, email, passwordHash: await bcrypt.hash(password, 12), createdAt: new Date().toISOString() };
  all.push(account); await saveAccounts(all); issueSession(res, account); res.status(201).json({ user: publicAccount(account) });
});
app.post('/api/auth/login', async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const password = String(req.body?.password || '');
  const account = (await accounts()).find(a => a.email === email);
  if (!account || !(await bcrypt.compare(password, account.passwordHash))) { res.status(401).json({ error: 'Email or password is incorrect.' }); return; }
  issueSession(res, account); res.json({ user: publicAccount(account) });
});
app.get('/api/auth/me', async (req, res) => {
  const account = await currentAccount(req);
  if (!account) { res.status(401).json({ error: 'Not logged in.' }); return; }
  res.json({ user: publicAccount(account) });
});
app.post('/api/auth/logout', (_req, res) => { res.clearCookie('learnova_session', { httpOnly: true, sameSite: 'lax', path: '/' }); res.json({ ok: true }); });
app.post('/api/ai/generate', requireAccount, async (req, res) => {
  if (!process.env.GEMINI_API_KEY) { res.status(503).json({ error: 'Gemini is not connected yet. Add GEMINI_API_KEY to your server .env file.' }); return; }
  const prompt = String(req.body?.prompt || '').trim();
  const content = String(req.body?.content || '').trim();
  const option = String(req.body?.option || '').trim();
  if (!prompt || !content) { res.status(400).json({ error: 'Add your study material before generating.' }); return; }
  if (content.length > 30000) { res.status(413).json({ error: 'Please keep your input under 30,000 characters.' }); return; }
  try {
    const model = new GoogleGenerativeAI(process.env.GEMINI_API_KEY).getGenerativeModel({ model: process.env.GEMINI_MODEL || 'gemini-2.0-flash' });
    const response = await model.generateContent(`${prompt}\n\nStudent preference: ${option || 'clear and useful'}.\n\nStudent material:\n${content}`);
    res.json({ text: response.response.text() });
  } catch (err) {
    console.error('Gemini generation failed:', err);
    res.status(502).json({ error: 'Gemini could not complete that request. Check your API key and try again.' });
  }
});
app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err); res.status(500).json({ error: 'Something went wrong on the server.' });
});
app.listen(port, () => console.log(`Learnova API ready at http://localhost:${port}`));
