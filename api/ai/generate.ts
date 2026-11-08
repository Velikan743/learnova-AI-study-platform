import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenerativeAI, type Part } from '@google/generative-ai';
import { bodyString, handleError, sendMethodNotAllowed, sessionId } from '../_lib/auth.js';
import { database } from '../_lib/db.js';
import { storage } from '../_lib/storage.js';

function youtubeVideoUrl(value: string): string | null {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:') return null;
    const host = url.hostname.toLowerCase().replace(/^www\./, '');
    if (!['youtube.com', 'm.youtube.com', 'youtu.be', 'youtube-nocookie.com'].includes(host)) return null;
    if (host === 'youtu.be' && !url.pathname.slice(1)) return null;
    if (host !== 'youtu.be' && url.pathname !== '/watch' && !url.pathname.startsWith('/shorts/') && !url.pathname.startsWith('/embed/')) return null;
    if (url.pathname === '/watch' && !url.searchParams.get('v')) return null;
    return url.toString();
  } catch { return null; }
}

async function generateVideoTranscript(key: string, prompt: string, option: string, videoUrl: string, res: VercelResponse) {
  // Keep YouTube video handling on a video-capable model independently of the
  // text model selected for the rest of the app.
  const model = process.env.GEMINI_VIDEO_MODEL || 'gemini-3.7-flash';
  let response: Response;
  try {
    response = await fetch('https://generativelanguage.googleapis.com/v1beta/interactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({
        model,
        input: [
          { type: 'text', text: `${prompt}\n\nSelected output style: ${option || 'Clear & concise'}.` },
          { type: 'video', uri: videoUrl },
        ],
      }),
      signal: AbortSignal.timeout(55_000),
    });
  } catch (error) {
    console.error('Gemini video transcript request failed:', error);
    return res.status(502).json({ error: 'Gemini could not finish processing this video in time. Try a shorter public video, then try again.' });
  }
  const raw = await response.text();
  let data: { output_text?: unknown; output?: unknown; error?: { message?: string; status?: string } };
  try { data = JSON.parse(raw) as typeof data; }
  catch {
    console.error('Gemini returned an unreadable video response:', response.status, raw.slice(0, 1000));
    return res.status(502).json({ error: 'Gemini returned an unexpected response while processing the video. Try again shortly.' });
  }
  if (!response.ok) {
    console.error('Gemini video transcript API error:', response.status, data.error);
    if (response.status === 401 || response.status === 403) return res.status(502).json({ error: 'Google Gemini rejected the API key. Check GEMINI_API_KEY in Vercel, then redeploy.' });
    if (response.status === 429) return res.status(502).json({ error: `Google Gemini model “${model}” rate limit or quota was reached. Check this model’s limits and try again later.` });
    if (response.status === 400) return res.status(422).json({ error: 'Gemini could not access this video. Make sure the YouTube video is public and the link is valid.' });
    if (response.status === 404) return res.status(502).json({ error: `Gemini model “${model}” is unavailable for video input. Set GEMINI_VIDEO_MODEL to a video-capable Gemini model enabled for your key.` });
    return res.status(502).json({ error: 'Google Gemini is temporarily unavailable while processing this video. Try again shortly.' });
  }
  const output = Array.isArray(data.output) ? data.output : [];
  const outputText = output.map(item => {
    if (!item || typeof item !== 'object') return '';
    const block = item as { type?: unknown; text?: unknown; content?: unknown };
    if (typeof block.text === 'string') return block.text;
    if (Array.isArray(block.content)) return block.content.map(part => part && typeof part === 'object' && typeof (part as { text?: unknown }).text === 'string' ? (part as { text: string }).text : '').join('\n');
    return '';
  }).filter(Boolean).join('\n\n');
  const text = typeof data.output_text === 'string' ? data.output_text : outputText;
  if (!text.trim()) return res.status(502).json({ error: 'Gemini returned no transcript for this video. Confirm it has accessible audio, then try again.' });
  return res.json({ text });
}

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
    const tool = bodyString(req, 'tool');
    const videoUrl = bodyString(req, 'videoUrl');
    if (tool === 'transcript') {
      const validVideoUrl = youtubeVideoUrl(videoUrl);
      if (!validVideoUrl) return res.status(400).json({ error: 'Enter a valid YouTube video link.' });
      if (!prompt) return res.status(400).json({ error: 'Transcript instructions are missing. Refresh the page and try again.' });
      return generateVideoTranscript(key, prompt, option, validVideoUrl, res);
    }
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
    let response;
    for (let attempt = 0; ; attempt++) {
      try {
        response = await model.generateContent(parts);
        break;
      } catch (error) {
      console.error('Gemini generation failed:', error);
      const status = typeof error === 'object' && error !== null && 'status' in error ? Number(error.status) : 0;
      const message = typeof error === 'object' && error !== null && 'message' in error ? String(error.message) : '';
      if ((status >= 500 || status === 0) && attempt < 2) {
        await new Promise(resolve => setTimeout(resolve, 500 * (attempt + 1)));
        continue;
      }
      if ((status >= 500 || status === 0) && attempt === 2) {
        const primaryModel = process.env.GEMINI_MODEL || 'gemini-3.8-flash';
        const fallbackModel = primaryModel === 'gemini-3.7-flash' ? 'gemini-3.6-flash' : 'gemini-3.7-flash';
        try {
          console.warn(`Retrying Gemini request with fallback model ${fallbackModel}.`);
          response = await new GoogleGenerativeAI(key).getGenerativeModel({ model: fallbackModel }).generateContent(parts);
          break;
        } catch (fallbackError) {
          console.error(`Gemini fallback model ${fallbackModel} failed:`, fallbackError);
          const fallbackStatus = typeof fallbackError === 'object' && fallbackError !== null && 'status' in fallbackError ? Number(fallbackError.status) : 0;
          if (fallbackStatus >= 500 || fallbackStatus === 0) {
            return res.status(502).json({ error: 'Google Gemini is temporarily unavailable on multiple models. Wait a moment and try again.' });
          }
          if (fallbackStatus === 429) {
            return res.status(502).json({ error: 'Google Gemini rate limit or quota was reached. Check the project’s Gemini API limits and try again shortly.' });
          }
          return res.status(502).json({ error: 'Gemini’s primary model failed and its fallback model is unavailable. Check the Vercel function logs for details.' });
        }
      }
      if (status === 401 || status === 403 || /API_KEY_INVALID|API key not valid/i.test(message)) {
        return res.status(502).json({ error: 'Google Gemini rejected the API key. Check GEMINI_API_KEY in your Vercel environment variables, then redeploy.' });
      }
      if (status === 404 || /model.*not found|not supported for generateContent/i.test(message)) {
        return res.status(502).json({ error: `Gemini model “${process.env.GEMINI_MODEL || 'gemini-3.8-flash'}” is unavailable for this API key. Remove GEMINI_MODEL or set it to a model enabled in Google AI Studio, then redeploy.` });
      }
      if (status === 429) {
        return res.status(502).json({ error: 'Google Gemini rate limit or quota was reached. Check the project’s Gemini API limits and try again shortly.' });
      }
      if (status >= 500) {
        return res.status(502).json({ error: 'Google Gemini is temporarily unavailable. Wait a moment and try again.' });
      }
      return res.status(502).json({ error: 'Google Gemini could not generate this response. Check the Vercel function logs for the provider error.' });
      }
    }
    return res.json({ text: response.response.text() });
  } catch (error) { return handleError(res, error); }
}
