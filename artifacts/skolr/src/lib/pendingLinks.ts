// Children a parent selected during signup/profile-setup that still need to be
// linked. Linking requires an authenticated session (the API derives the parent
// identity from the verified token), which may not exist yet at signup time when
// email confirmation is enabled. We stash the selected student ids and flush
// them from AuthContext once the parent is authenticated.
const key = (userId: string) => `skolr_pending_child_links_${userId}`;

export function stashPendingChildLinks(userId: string, studentIds: string[]): void {
  if (!userId || studentIds.length === 0) return;
  try {
    localStorage.setItem(key(userId), JSON.stringify(studentIds));
  } catch {
    /* ignore storage errors */
  }
}

export function readPendingChildLinks(userId: string): string[] {
  if (!userId) return [];
  try {
    const raw = localStorage.getItem(key(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export function clearPendingChildLinks(userId: string): void {
  if (!userId) return;
  try {
    localStorage.removeItem(key(userId));
  } catch {
    /* ignore storage errors */
  }
}
