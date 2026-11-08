import type { VercelRequest, VercelResponse } from '@vercel/node';
import { bodyString, handleError, sendMethodNotAllowed, sessionId } from '../_lib/auth.js';
import { database } from '../_lib/db.js';
import { storage } from '../_lib/storage.js';

const maxAvatarBytes = 3 * 1024 * 1024;
function isExpectedImage(bytes: Buffer, extension: string) {
  if (extension === 'jpg') return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (extension === 'png') return bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  return extension === 'webp' && bytes.length >= 12 && bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP';
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const userId = sessionId(req);
  if (!userId) return res.status(401).json({ error: 'Please log in to manage your profile picture.' });
  try {
    const db = database();
    if (req.method === 'GET') {
      const result = await db.query('SELECT profile_picture_key FROM learnova_accounts WHERE id = $1 LIMIT 1', [userId]);
      const key = result.rows[0]?.profile_picture_key;
      if (!key) return res.status(404).end();
      const url = await storage().url(String(key), { expiresIn: 300 });
      res.setHeader('Cache-Control', 'private, no-store');
      return res.redirect(302, url);
    }
    if (req.method === 'POST') {
      const key = bodyString(req, 'key');
      const prefix = `${userId}/avatars/`;
      if (!key.startsWith(prefix)) return res.status(400).json({ error: 'That profile picture upload is invalid. Please upload it again.' });
      const filename = key.slice(prefix.length);
      const match = filename.match(/^([0-9a-f-]{36})\.(jpg|png|webp)$/i);
      if (!match) return res.status(400).json({ error: 'That profile picture upload is invalid. Please upload it again.' });
      let uploaded: Buffer;
      try { uploaded = Buffer.from(await (await storage().download(key)).arrayBuffer()); }
      catch { return res.status(400).json({ error: 'The profile picture did not finish uploading. Please try again.' }); }
      if (uploaded.length < 1 || uploaded.length > maxAvatarBytes || !isExpectedImage(uploaded, match[2].toLowerCase())) return res.status(415).json({ error: 'Upload a valid JPG, PNG, or WebP image no larger than 3 MB.' });
      const previous = await db.query('SELECT profile_picture_key FROM learnova_accounts WHERE id = $1 LIMIT 1', [userId]);
      if (!previous.rows.length) return res.status(401).json({ error: 'Please log in again.' });
      const oldKey = previous.rows[0].profile_picture_key;
      await db.query('UPDATE learnova_accounts SET profile_picture_key = $2 WHERE id = $1', [userId, key]);
      if (oldKey && oldKey !== key) await storage().delete(String(oldKey)).catch(error => console.warn('Could not remove replaced profile image:', error));
      return res.json({ ok: true });
    }
    if (req.method === 'DELETE') {
      const previous = await db.query('SELECT profile_picture_key FROM learnova_accounts WHERE id = $1 LIMIT 1', [userId]);
      if (!previous.rows.length) return res.status(401).json({ error: 'Please log in again.' });
      const oldKey = previous.rows[0].profile_picture_key;
      await db.query('UPDATE learnova_accounts SET profile_picture_key = NULL WHERE id = $1', [userId]);
      if (oldKey) await storage().delete(String(oldKey)).catch(error => console.warn('Could not remove profile image:', error));
      return res.json({ ok: true });
    }
    return sendMethodNotAllowed(res, 'GET, POST, DELETE');
  } catch (error) { return handleError(res, error); }
}
