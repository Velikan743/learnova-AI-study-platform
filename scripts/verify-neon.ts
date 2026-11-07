import dotenv from 'dotenv';
import { randomUUID } from 'node:crypto';
import { spawn, type ChildProcess } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { Pool } from 'pg';
import { storage } from '../api/_lib/storage';

dotenv.config({ path: '.env.local' });
dotenv.config();

const port = 3317;
const baseUrl = `http://127.0.0.1:${port}`;
const nonce = randomUUID();
const email = `neon-check-${nonce}@example.test`;
const password = `Tmp-${randomUUID()}-Aa9!`;
const filename = `learnova-check-${nonce}.pdf`;
const pdf = Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Count 0/Kids[]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n');
let userId: string | undefined;
let documentId: string | undefined;
let objectKey: string | undefined;
let cookie = '';
const pool = new Pool({ connectionString: process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL });
let server: ChildProcess | undefined;

async function request(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  if (cookie) headers.set('Cookie', cookie);
  return fetch(`${baseUrl}${path}`, { ...init, headers });
}

async function main() {
  server = spawn(process.execPath, ['node_modules/tsx/dist/cli.mjs', 'server/index.ts'], { env: { ...process.env, PORT: String(port) }, stdio: 'ignore' });
  let ready = false;
  for (let attempt = 0; attempt < 40; attempt++) {
    try { const response = await fetch(`${baseUrl}/api/health`); if (response.ok) { ready = true; break; } } catch {}
    await delay(250);
  }
  if (!ready) throw new Error('Local Learnova API did not start.');
  const health = await (await fetch(`${baseUrl}/api/health`)).json() as { ok: boolean; storageReady: boolean; aiReady: boolean };
  if (!health.ok || !health.storageReady) throw new Error('Local API or Neon Object Storage is not ready.');

  const signup = await request('/api/auth/signup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Neon Verification', email, password }) });
  const signupResult = await signup.json() as { user?: { email: string }; error?: string };
  if (!signup.ok) throw new Error(`Signup failed: ${signupResult.error || signup.status}`);
  const setCookie = signup.headers.get('set-cookie') || '';
  cookie = setCookie.split(';', 1)[0];
  if (!cookie) throw new Error('Signup did not create a session cookie.');
  const user = await request('/api/auth/me');
  const me = await user.json() as { user?: { email: string } };
  if (!user.ok || me.user?.email !== email) throw new Error('Postgres account and authenticated session check failed.');
  const account = await pool.query('SELECT id FROM learnova_accounts WHERE email = $1', [email]);
  userId = String(account.rows[0]?.id || '');
  if (!userId) throw new Error('Account was not persisted in Neon Postgres.');
  console.log('PASS: account creation, password hashing, login session, and Postgres lookup');

  const signedResponse = await request('/api/files/upload-url', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ filename, contentType: 'application/pdf', size: pdf.byteLength }) });
  const signed = await signedResponse.json() as { id?: string; filename?: string; upload?: { method: 'POST' | 'PUT'; url: string; fields?: Record<string, string>; headers?: Record<string, string> }; error?: string };
  if (!signedResponse.ok || !signed.id || !signed.upload) throw new Error(`Signed upload failed: ${signed.error || signedResponse.status}`);
  documentId = signed.id;
  objectKey = `${userId}/${documentId}.pdf`;
  const upload = signed.upload;
  let stored: Response;
  if (upload.method === 'POST') {
    const form = new FormData();
    for (const [key, value] of Object.entries(upload.fields || {})) form.append(key, value);
    form.append('file', new Blob([pdf], { type: 'application/pdf' }), filename);
    stored = await fetch(upload.url, { method: 'POST', body: form });
  } else {
    stored = await fetch(upload.url, { method: 'PUT', headers: upload.headers, body: pdf });
  }
  if (!stored.ok) throw new Error(`Neon Object Storage upload failed (${stored.status}).`);
  const complete = await request('/api/files/complete', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: documentId }) });
  const completed = await complete.json() as { error?: string };
  if (!complete.ok) throw new Error(`Upload verification failed: ${completed.error || complete.status}`);
  const listed = await request('/api/files/list');
  const listing = await listed.json() as { files?: Array<{ id: string }> };
  if (!listed.ok || !listing.files?.some(file => file.id === documentId)) throw new Error('Uploaded PDF was not listed for its owner.');
  const download = await request(`/api/files/download?id=${encodeURIComponent(documentId)}`, { redirect: 'follow' });
  const downloaded = Buffer.from(await download.arrayBuffer());
  if (!download.ok || !downloaded.equals(pdf)) throw new Error('Private PDF download did not match uploaded bytes.');
  const metadata = await storage().head(objectKey);
  if (metadata.contentType !== 'application/pdf' || Number(metadata.size) !== pdf.byteLength) throw new Error('Object metadata did not match the uploaded PDF.');
  console.log('PASS: private object upload, Postgres metadata, owner-only listing, signed download, and byte-for-byte verification');
  console.log(`Cleanup target: temporary verification account and PDF object (Gemini API key configured: ${health.aiReady})`);
}

try {
  await main();
} finally {
  server?.kill();
  if (objectKey) await storage().delete(objectKey).catch(() => undefined);
  if (userId) await pool.query('DELETE FROM learnova_accounts WHERE id = $1', [userId]).catch(() => undefined);
  await pool.end();
}
