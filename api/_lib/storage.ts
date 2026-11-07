import { Files } from 'files-sdk';
import { neon } from 'files-sdk/neon';

export function storage() {
  const required = ['AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'AWS_ENDPOINT_URL_S3'];
  const missing = required.filter(key => !process.env[key]);
  if (missing.length) throw new Error(`Neon Object Storage is not configured. Missing ${missing.join(', ')}.`);
  return new Files({ adapter: neon({ bucket: 'uploads' }), timeout: 30_000, retries: 2 });
}
