import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenerativeAI, type Part } from '@google/generative-ai';
import { bodyString, handleError, sendMethodNotAllowed, sessionId } from '../_lib/auth';
import { database } from '../_lib/db';
import { storage } from '../_lib/storage';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return sendMethodNotAllowed(res, 'POST');
  try {
    const userId = sessionId(req);
    if (!userId) return res.status(401).json({ error: 'Please log in to continue.' });
    const key = process.env.GEMINI_API_KEY;
    if (!key) return res.status(503).json({ error: 'Gemini is not connected yet. Add GEMINI_API_KEY in Vercel project settings.' });
    const prompt = bodyString(req, 'prompt');
    const content = bodyString(req, 'content');
    const option = bodyString(req, 'option');
    const documentId = bodyString(req, 'documentId');
    if (!prompt || (!content && !documentId)) return res.status(400).json({ error: 'Add your study material or select an uploaded PDF first.' });
    if (content.length > 30000) return res.status(413).json({ error: 'Please keep your input under 30,000 characters.' });
    const parts: Part[] = [{ text: `${prompt}\n\nStudent preference: ${option || 'clear and useful'}.${content ? `\n\nStudent material:\n${content}` : ''}` }];
    if (documentId) {
      const result = await database().query('SELECT object_key, filename FROM learnova_documents WHERE id = $1 AND user_id = $2 AND status = $3 LIMIT 1', [documentId, userId, 'uploaded']);
      if (!result.rows.length) return res.status(404).json({ error: 'That uploaded PDF was not found in your library.' });
      const stored = await storage().download(String(result.rows[0].object_key));
      const bytes = Buffer.from(await stored.arrayBuffer());
      parts.push({ inlineData: { data: bytes.toString('base64'), mimeType: 'application/pdf' } });
      parts.push({ text: `The attached study document is named “${String(result.rows[0].filename).replace(/[<>]/g, '')}”. Use it as the source material.` });
    }
    const model = new GoogleGenerativeAI(key).getGenerativeModel({ model: process.env.GEMINI_MODEL || 'gemini-3.8-flash' });
    const response = await model.generateContent(parts);
    return res.json({ text: response.response.text() });
  } catch (error) { return handleError(res, error); }
}
