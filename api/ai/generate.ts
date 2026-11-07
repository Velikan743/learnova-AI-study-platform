import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { bodyString, handleError, sendMethodNotAllowed, sessionId } from '../_lib/auth';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return sendMethodNotAllowed(res, 'POST');
  try {
    if (!sessionId(req)) return res.status(401).json({ error: 'Please log in to continue.' });
    const key = process.env.GEMINI_API_KEY;
    if (!key) return res.status(503).json({ error: 'Gemini is not connected yet. Add GEMINI_API_KEY in Vercel project settings.' });
    const prompt = bodyString(req, 'prompt');
    const content = bodyString(req, 'content');
    const option = bodyString(req, 'option');
    if (!prompt || !content) return res.status(400).json({ error: 'Add your study material before generating.' });
    if (content.length > 30000) return res.status(413).json({ error: 'Please keep your input under 30,000 characters.' });
    const model = new GoogleGenerativeAI(key).getGenerativeModel({ model: process.env.GEMINI_MODEL || 'gemini-2.0-flash' });
    const response = await model.generateContent(`${prompt}\n\nStudent preference: ${option || 'clear and useful'}.\n\nStudent material:\n${content}`);
    return res.json({ text: response.response.text() });
  } catch (error) { return handleError(res, error); }
}
