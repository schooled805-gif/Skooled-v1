import type { Request } from "express";
import { db } from "@workspace/db";
import { profiles, classes, timetableEntries } from "@workspace/db";
import { eq, and } from "drizzle-orm";
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

/**
 * The set of class ids a teacher is responsible for: classes where they are the
 * head/class teacher PLUS classes where they teach at least one subject on the
 * timetable. Used to scope what students/classes a teacher can see — a teacher
 * must only see students in their own classes, never the whole school.
 */
export async function getTeacherClassIds(
  teacherProfileId: string,
  schoolId: string,
): Promise<Set<string>> {
  const ids = new Set<string>();
  const head = await db
    .select({ id: classes.id })
    .from(classes)
    .where(and(eq(classes.schoolId, schoolId), eq(classes.teacherId, teacherProfileId)));
  for (const c of head) ids.add(c.id);
  const tt = await db
    .select({ classId: timetableEntries.classId })
    .from(timetableEntries)
    .where(and(eq(timetableEntries.schoolId, schoolId), eq(timetableEntries.teacherId, teacherProfileId)));
  for (const t of tt) if (t.classId) ids.add(t.classId);
  return ids;
}
