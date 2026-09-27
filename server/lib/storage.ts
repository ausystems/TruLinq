/* Private document storage for verification uploads, provider-ready for Vercel Blob (REST API, no SDK). Without a
   token the upload endpoint refuses with 503 storage_not_configured rather than pretending a file was kept. */
import type { Env } from '../env.ts';
import { errors } from '../http.ts';

export interface StoredObject { key: string; url: string }

export async function putPrivateObject(env: Env, key: string, bytes: Buffer, mime: string): Promise<StoredObject> {
  if (!env.BLOB_READ_WRITE_TOKEN) throw errors.unavailable('storage_not_configured', 'Document storage is not configured on this deployment yet.');
  const res = await fetch(`https://blob.vercel-storage.com/${key}`, {
    method: 'PUT',
    headers: { authorization: `Bearer ${env.BLOB_READ_WRITE_TOKEN}`, 'x-api-version': '7', 'x-content-type': mime, 'x-add-random-suffix': '0', 'x-cache-control-max-age': '0' },
    body: new Uint8Array(bytes)
  });
  if (!res.ok) { console.error('[storage] upload failed', res.status); throw errors.unavailable('storage_error', 'The document could not be stored. Try again.'); }
  const data = (await res.json()) as { url: string; pathname?: string };
  return { key, url: data.url };
}
