import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handleError, sendMethodNotAllowed, sessionId } from '../_lib/auth.js';
import { storage } from '../_lib/storage.js';

const maxAvatarBytes = 3 * 1024 * 1024;
const imageTypes: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return sendMethodNotAllowed(res, 'POST');
  const userId = sessionId(req);
  if (!userId) return res.status(401).json({ error: 'Please log in to add a profile picture.' });
  try {
    const contentType = typeof req.body?.contentType === 'string' ? req.body.contentType.toLowerCase() : '';
    const size = Number(req.body?.size);
    const extension = imageTypes[contentType];
    if (!extension) return res.status(415).json({ error: 'Choose a JPG, PNG, or WebP image.' });
    if (!Number.isSafeInteger(size) || size < 1 || size > maxAvatarBytes) return res.status(413).json({ error: 'Profile pictures must be 3 MB or smaller.' });
    const key = `${userId}/avatars/${crypto.randomUUID()}.${extension}`;
    const upload = await storage().signedUploadUrl(key, { expiresIn: 300, contentType, maxSize: maxAvatarBytes });
    return res.status(201).json({ key, contentType, upload });
  } catch (error) { return handleError(res, error); }
}
