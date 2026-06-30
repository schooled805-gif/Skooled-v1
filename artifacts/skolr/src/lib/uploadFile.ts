import { supabase } from '@/lib/supabase';

export interface UploadResult {
  /** Normalized object path, e.g. `/objects/uploads/uuid`. */
  objectPath: string;
  /** Ready-to-use serving URL, e.g. `/api/storage/objects/uploads/uuid`. */
  url: string;
}

/**
 * Uploads a file to object storage using the presigned-URL flow:
 *   1. Ask the API server for a presigned PUT URL (JSON metadata only).
 *   2. PUT the raw file bytes directly to Google Cloud Storage.
 * Returns the stored object path and a serving URL to persist/render.
 */
export async function uploadFile(file: File): Promise<UploadResult> {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token ?? '';

  const reqRes = await fetch('/api/storage/uploads/request-url', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ name: file.name, size: file.size, contentType: file.type || 'application/octet-stream' }),
  });
  if (!reqRes.ok) throw new Error(`Could not start upload (${reqRes.status})`);
  const { uploadURL, objectPath } = await reqRes.json() as { uploadURL: string; objectPath: string };

  const putRes = await fetch(uploadURL, {
    method: 'PUT',
    headers: { 'Content-Type': file.type || 'application/octet-stream' },
    body: file,
  });
  if (!putRes.ok) throw new Error(`Upload failed (${putRes.status})`);

  return { objectPath, url: `/api/storage${objectPath}` };
}
