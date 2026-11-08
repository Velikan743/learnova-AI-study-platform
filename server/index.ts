import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config();

import express, { type RequestHandler } from 'express';
import cookieParser from 'cookie-parser';
import signup from '../api/auth/signup';
import login from '../api/auth/login';
import me from '../api/auth/me';
import logout from '../api/auth/logout';
import generate from '../api/ai/generate';
import uploadUrl from '../api/files/upload-url';
import completeUpload from '../api/files/complete';
import listFiles from '../api/files/list';
import downloadFile from '../api/files/download';
import subjects from '../api/subjects';
import activity from '../api/activity';
import creations from '../api/creations';

const app = express();
const port = Number(process.env.PORT || 3001);
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());

const route = (handler: (req: any, res: any) => unknown): RequestHandler => (req, res, next) => {
  Promise.resolve(handler(req, res)).catch(next);
};

app.get('/api/health', (_req, res) => res.json({ ok: true, aiReady: Boolean(process.env.GEMINI_API_KEY), storageReady: Boolean(process.env.AWS_ACCESS_KEY_ID) }));
app.post('/api/auth/signup', route(signup));
app.post('/api/auth/login', route(login));
app.get('/api/auth/me', route(me));
app.post('/api/auth/logout', route(logout));
app.post('/api/ai/generate', route(generate));
app.post('/api/files/upload-url', route(uploadUrl));
app.post('/api/files/complete', route(completeUpload));
app.get('/api/files/list', route(listFiles));
app.get('/api/files/download', route(downloadFile));
app.all('/api/subjects', route(subjects));
app.all('/api/activity', route(activity));
app.all('/api/creations', route(creations));

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err); res.status(500).json({ error: 'Something went wrong on the server.' });
});
app.listen(port, () => console.log(`Learnova API ready at http://localhost:${port}`));
