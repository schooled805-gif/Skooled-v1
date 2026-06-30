import type { Request } from "express";
import { db } from "@workspace/db";
import { profiles, classes, timetableEntries, students, parentStudentLinks } from "@workspace/db";
import { eq, and, inArray } from "drizzle-orm";
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

export interface StudentScope {
  studentIds?: string[];
  classIds?: string[];
  gradeLevels?: string[];
  subjectIds?: string[];
}

/**
 * Resolve a multi-select scope (any combination of individual students, whole
 * classes, grade levels, or subjects) into the concrete set of student ids it
 * targets, always constrained to the given school. Used by the teacher messaging
 * and approval-request flows so one request can fan out to many recipients.
 */
export async function resolveStudentIds(
  schoolId: string,
  scope: StudentScope,
  allowedClassIds?: Set<string>,
): Promise<Set<string>> {
  const ids = new Set<string>();

  if (scope.studentIds?.length) {
    const rows = await db.select({ id: students.id })
      .from(students)
      .where(and(eq(students.schoolId, schoolId), inArray(students.id, scope.studentIds)));
    for (const r of rows) ids.add(r.id);
  }

  if (scope.classIds?.length) {
    const rows = await db.select({ id: students.id })
      .from(students)
      .where(and(eq(students.schoolId, schoolId), inArray(students.classId, scope.classIds)));
    for (const r of rows) ids.add(r.id);
  }

  if (scope.gradeLevels?.length) {
    const rows = await db.select({ id: students.id })
      .from(students)
      .where(and(eq(students.schoolId, schoolId), inArray(students.grade, scope.gradeLevels)));
    for (const r of rows) ids.add(r.id);
  }

  if (scope.subjectIds?.length) {
    // Subjects map to students via the classes that have timetable entries for
    // those subjects.
    const tt = await db.select({ classId: timetableEntries.classId })
      .from(timetableEntries)
      .where(and(eq(timetableEntries.schoolId, schoolId), inArray(timetableEntries.subjectId, scope.subjectIds)));
    const classIds = Array.from(new Set(tt.map((t) => t.classId).filter((c): c is string => !!c)));
    if (classIds.length) {
      const rows = await db.select({ id: students.id })
        .from(students)
        .where(and(eq(students.schoolId, schoolId), inArray(students.classId, classIds)));
      for (const r of rows) ids.add(r.id);
    }
  }

  // When a restriction set is supplied (e.g. a teacher may only target students
  // in their own classes), drop any resolved student outside those classes.
  if (allowedClassIds) {
    if (ids.size === 0 || allowedClassIds.size === 0) return new Set();
    const rows = await db.select({ id: students.id })
      .from(students)
      .where(and(
        eq(students.schoolId, schoolId),
        inArray(students.id, Array.from(ids)),
        inArray(students.classId, Array.from(allowedClassIds)),
      ));
    return new Set(rows.map((r) => r.id));
  }

  return ids;
}

/**
 * Whether a given student is linked to a given parent within a school. Used to
 * stop a parent from claiming/acting on a child that is not theirs.
 */
export async function isStudentLinkedToParent(
  schoolId: string,
  parentUserId: string,
  studentId: string,
): Promise<boolean> {
  const [row] = await db.select({ id: parentStudentLinks.studentId })
    .from(parentStudentLinks)
    .where(and(
      eq(parentStudentLinks.schoolId, schoolId),
      eq(parentStudentLinks.parentUserId, parentUserId),
      eq(parentStudentLinks.studentId, studentId),
    )).limit(1);
  return !!row;
}

/**
 * Map a set of student ids to the parent user ids linked to them, returning each
 * parent together with one of their linked student ids (for message/approval
 * context). A parent linked to several targeted students appears once per
 * student so callers can create a per-student row when needed.
 */
export async function getParentLinksForStudents(
  schoolId: string,
  studentIds: string[],
): Promise<Array<{ parentUserId: string; studentId: string }>> {
  if (!studentIds.length) return [];
  const rows = await db.select({
    parentUserId: parentStudentLinks.parentUserId,
    studentId: parentStudentLinks.studentId,
  }).from(parentStudentLinks)
    .where(and(eq(parentStudentLinks.schoolId, schoolId), inArray(parentStudentLinks.studentId, studentIds)));
  return rows;
}
