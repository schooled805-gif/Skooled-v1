import { supabase } from '@/lib/supabase';

/**
 * Opens a protected uploaded file (e.g. a report PDF) in a new tab.
 *
 * The file is served by an authenticated API route, so a plain anchor
 * navigation fails ("Missing or invalid Authorization header"). Instead we
 * fetch it with the Supabase bearer token, then open the response as a blob URL
 * the browser can render inline.
 */
export async function openProtectedFile(fileUrl: string): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token ?? '';

  const res = await fetch(fileUrl, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) {
    throw new Error(`Failed to load file (${res.status})`);
  }

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank', 'noopener,noreferrer');
  // Give the new tab time to load before releasing the object URL.
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
