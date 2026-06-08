import type { Request } from "express";
import { db } from "@workspace/db";
import { profiles } from "@workspace/db";
import { eq } from "drizzle-orm";
import type { Profile } from "@workspace/db";

/**
 * Resolve the authenticated requester's profile from the trusted x-user-id
 * header (set by verifySupabaseJwt after verifying the Bearer token). Never
 * trust a client-supplied user id or school id.
 */
export async function getRequesterProfile(req: Request): Promise<Profile | null> {
  const userId = req.headers["x-user-id"] as string | undefined;
  if (!userId) return null;
  const [p] = await db.select().from(profiles).where(eq(profiles.userId, userId)).limit(1);
  return p ?? null;
}

/**
 * The school the requester belongs to. This is the ONLY school a request is
 * allowed to read/write data for — it is derived server-side and overrides any
 * school_id the client may have sent, preventing cross-school data leaks.
 */
export async function getRequesterSchoolId(req: Request): Promise<string | null> {
  const p = await getRequesterProfile(req);
  return p?.schoolId ?? null;
}

/**
 * Resolve the requester's profile and require that they are an admin with a
 * school context. Returns the admin profile, or null if the requester is not an
 * authenticated admin. Use to gate admin-only mutations (managing users,
 * crediting accounts) — the UI hiding a control is not a security boundary.
 */
export async function requireAdmin(req: Request): Promise<Profile | null> {
  const p = await getRequesterProfile(req);
  if (!p || p.role !== "admin" || !p.schoolId) return null;
  return p;
}
