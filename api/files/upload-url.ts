import type { VercelRequest, VercelResponse } from '@vercel/node';
import { bodyString, handleError, sendMethodNotAllowed, sessionId } from '../_lib/auth';
import { database } from '../_lib/db';
import { storage } from '../_lib/storage';

const maxPdfBytes = 10 * 1024 * 1024;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return sendMethodNotAllowed(res, 'POST');
  try {
    const userId = sessionId(req);
    if (!userId) return res.status(401).json({ error: 'Please log in to upload a file.' });
    const filename = bodyString(req, 'filename').replace(/[\\/\u0000-\u001f]/g, '_').slice(0, 180);
    const contentType = bodyString(req, 'contentType').toLowerCase();
    const size = Number(req.body?.size);
    if (!filename.toLowerCase().endsWith('.pdf') || contentType !== 'application/pdf') return res.status(415).json({ error: 'Upload a PDF file.' });
    if (!Number.isSafeInteger(size) || size < 1 || size > maxPdfBytes) return res.status(413).json({ error: 'PDFs must be smaller than 10 MB.' });

    const id = crypto.randomUUID();
    const objectKey = `${userId}/${id}.pdf`;
    const db = database();
    await db.query('INSERT INTO learnova_documents (id, user_id, filename, object_key, content_type, byte_size, status) VALUES ($1, $2, $3, $4, $5, $6, $7)', [id, userId, filename, objectKey, contentType, size, 'pending']);
    const upload = await storage().signedUploadUrl(objectKey, { expiresIn: 600, contentType, maxSize: maxPdfBytes });
    return res.status(201).json({ id, filename, upload });
  } catch (error) { return handleError(res, error); }
}
