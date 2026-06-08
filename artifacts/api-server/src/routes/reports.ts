import { Router } from "express";
import type { Request } from "express";
import { db } from "@workspace/db";
import { reports, students, profiles, classes, parentStudentLinks } from "@workspace/db";
import { and, eq } from "drizzle-orm";
import { getRequesterProfile } from "../lib/scope";
import {
  ListReportsQueryParams,
  CreateReportBody,
} from "@workspace/api-zod";
import path from "path";
import fs from "fs";

const router = Router();

// Resolve the uploads directory lazily, never at module load. Creating a
// directory at import time crashes serverless functions (Vercel's filesystem is
// read-only except for /tmp), which would take down the entire API at startup.
const isServerless = !!(
  process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME
);
function getUploadsDir(): string {
  const dir = isServerless
    ? path.join("/tmp", "uploads")
    : path.join(process.cwd(), "uploads");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

type ReportRow = { student_id: string | null; visible_to_student: boolean | null };

/**
 * Build a role-aware entitlement for report reads/downloads. Returns the
 * requester's school and a predicate deciding whether a given report row is
 * visible to them:
 *  - admin:   every report in their school
 *  - teacher: reports for students in classes they teach
 *  - parent:  reports for their linked children
 *  - student: only their own reports that are marked visible
 * Any other role sees nothing. The UI does no ownership filtering, so this is
 * the only thing preventing cross-student report disclosure within a school.
 */
async function reportEntitlement(
  req: Request,
): Promise<{ schoolId: string; filter: (r: ReportRow) => boolean } | null> {
  const requester = await getRequesterProfile(req);
  if (!requester || !requester.schoolId) return null;
  const schoolId = requester.schoolId;

  if (requester.role === "admin") {
    return { schoolId, filter: () => true };
  }
  if (requester.role === "teacher") {
    const rows = await db.select({ id: students.id }).from(students)
      .innerJoin(classes, eq(students.classId, classes.id))
      .where(and(eq(students.schoolId, schoolId), eq(classes.teacherId, requester.id)));
    const allowed = new Set(rows.map(r => r.id));
    return { schoolId, filter: r => !!r.student_id && allowed.has(r.student_id) };
  }
  if (requester.role === "parent") {
    const rows = await db.select({ sid: parentStudentLinks.studentId }).from(parentStudentLinks)
      .where(eq(parentStudentLinks.parentUserId, requester.userId));
    const allowed = new Set(rows.map(r => r.sid));
    return { schoolId, filter: r => !!r.student_id && allowed.has(r.student_id) };
  }
  if (requester.role === "student") {
    const [me] = await db.select({ id: students.id }).from(students)
      .where(eq(students.profileId, requester.id)).limit(1);
    const myId = me?.id ?? null;
    return { schoolId, filter: r => !!myId && r.student_id === myId && !!r.visible_to_student };
  }
  return { schoolId, filter: () => false };
}

// Upload a report file. The file is stored under a per-school directory and the
// returned URL embeds the school id, so file ownership is bound at write time
// to the uploader's school (derived server-side, never from the client). This
// is the source of truth the download route authorizes against.
router.post("/reports/upload", async (req, res) => {
  try {
    // Only teachers and admins may upload report files.
    const requester = await getRequesterProfile(req);
    if (!requester || !requester.schoolId) { res.status(403).json({ error: "No school context for this account" }); return; }
    if (requester.role !== "admin" && requester.role !== "teacher") {
      res.status(403).json({ error: "Only teachers and admins can upload reports" });
      return;
    }
    const schoolId = requester.schoolId;

    const { file_data, file_name } = req.body;
    if (!file_data || !file_name) {
      res.status(400).json({ error: "file_data and file_name are required" });
      return;
    }
    const schoolDir = path.join(getUploadsDir(), path.basename(schoolId));
    if (!fs.existsSync(schoolDir)) fs.mkdirSync(schoolDir, { recursive: true });

    const buffer = Buffer.from(file_data, "base64");
    const safeName = `${Date.now()}-${file_name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    fs.writeFileSync(path.join(schoolDir, safeName), buffer);
    res.json({ url: `/api/uploads/${schoolId}/${safeName}` });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Serve an uploaded report file. Stays behind auth (verifySupabaseJwt) and is
// tenant-bound deterministically: the school id is part of the path and must
// match the requester's school. A user from one school can never fetch another
// school's file even if they know the filename. Browsers cannot attach an
// Authorization header to a plain anchor navigation, so the frontend fetches
// this with the bearer token and opens the result as a blob.
router.get("/uploads/:schoolId/:name", async (req, res) => {
  try {
    const ent = await reportEntitlement(req);
    if (!ent) { res.status(403).json({ error: "No school context for this account" }); return; }

    // 404 (not 403) when the path school doesn't match, so we don't reveal that
    // a file exists for another school.
    if (path.basename(req.params.schoolId) !== ent.schoolId) {
      res.status(404).json({ error: "File not found" });
      return;
    }

    const name = path.basename(req.params.name);

    // Entitlement is report-level, not just school-level: the requester must be
    // allowed to see at least one report that references this exact file.
    const fileUrl = `/api/uploads/${ent.schoolId}/${name}`;
    const refs = await db.select({
      student_id: reports.studentId,
      visible_to_student: reports.visibleToStudent,
    }).from(reports).where(and(eq(reports.schoolId, ent.schoolId), eq(reports.fileUrl, fileUrl)));
    if (!refs.some(ent.filter)) {
      res.status(404).json({ error: "File not found" });
      return;
    }

    const filePath = path.join(getUploadsDir(), ent.schoolId, name);
    if (!fs.existsSync(filePath)) {
      res.status(404).json({ error: "File not found" });
      return;
    }
    res.sendFile(filePath);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/reports", async (req, res) => {
  try {
    const query = ListReportsQueryParams.parse(req.query);
    const ent = await reportEntitlement(req);
    if (!ent) { res.status(403).json({ error: "No school context for this account" }); return; }
    const schoolId = ent.schoolId;

    const rows = await db.select({
      id: reports.id,
      student_id: reports.studentId,
      title: reports.title,
      term: reports.term,
      year: reports.year,
      file_url: reports.fileUrl,
      visible_to_student: reports.visibleToStudent,
      school_id: reports.schoolId,
      student_name: profiles.fullName,
      grade: reports.grade,
      subject: reports.subject,
      teacher_name: reports.teacherName,
      comments: reports.comments,
      score: reports.score,
      created_at: reports.createdAt,
    }).from(reports)
      .leftJoin(students, eq(reports.studentId, students.id))
      .leftJoin(profiles, eq(students.profileId, profiles.id))
      .where(eq(reports.schoolId, schoolId));

    // Role-aware filtering: a parent/student/teacher only ever sees the reports
    // they are entitled to, regardless of what the client requests.
    let result = rows.filter(ent.filter);
    if (query.student_id) result = result.filter(r => r.student_id === query.student_id);
    res.json(result);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/reports", async (req, res) => {
  try {
    // Only teachers and admins may create reports. The UI hiding the control is
    // not a security boundary — enforce role and class ownership server-side.
    const requester = await getRequesterProfile(req);
    if (!requester || !requester.schoolId) { res.status(403).json({ error: "No school context for this account" }); return; }
    if (requester.role !== "admin" && requester.role !== "teacher") {
      res.status(403).json({ error: "Only teachers and admins can upload reports" });
      return;
    }
    const schoolId = requester.schoolId;

    const body = CreateReportBody.parse(req.body);

    // The file must be one this school uploaded (URLs are school-bound at
    // upload time). Reject references to another tenant's file.
    if (!body.file_url.startsWith(`/api/uploads/${schoolId}/`)) {
      res.status(400).json({ error: "Invalid file reference" });
      return;
    }

    // The student must belong to the requester's school.
    const [student] = await db.select().from(students).where(eq(students.id, body.student_id)).limit(1);
    if (!student || student.schoolId !== schoolId) {
      res.status(404).json({ error: "Student not found" });
      return;
    }

    // A teacher may only upload reports for students in a class they teach.
    // Admins are unrestricted within their school.
    if (requester.role === "teacher") {
      if (!student.classId) {
        res.status(403).json({ error: "You can only upload reports for students in your classes" });
        return;
      }
      const [owned] = await db.select().from(classes)
        .where(and(eq(classes.id, student.classId), eq(classes.teacherId, requester.id)))
        .limit(1);
      if (!owned) {
        res.status(403).json({ error: "You can only upload reports for students in your classes" });
        return;
      }
    }

    const [report] = await db.insert(reports).values({
      studentId: body.student_id,
      title: body.title,
      term: body.term,
      year: body.year,
      fileUrl: body.file_url,
      visibleToStudent: body.visible_to_student ?? false,
      schoolId, // server-derived; ignore any client-supplied school_id
      grade: body.grade ?? null,
      subject: body.subject ?? null,
      teacherName: body.teacher_name ?? null,
      comments: body.comments ?? null,
      score: body.score ?? null,
    }).returning();
    res.status(201).json({ ...report, student_name: null });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
