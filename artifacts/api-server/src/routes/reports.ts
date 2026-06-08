import { Router } from "express";
import { db } from "@workspace/db";
import { reports, students, profiles } from "@workspace/db";
import { and, eq } from "drizzle-orm";
import { getRequesterSchoolId } from "../lib/scope";
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

// Upload a report file. The file is stored under a per-school directory and the
// returned URL embeds the school id, so file ownership is bound at write time
// to the uploader's school (derived server-side, never from the client). This
// is the source of truth the download route authorizes against.
router.post("/reports/upload", async (req, res) => {
  try {
    const schoolId = await getRequesterSchoolId(req);
    if (!schoolId) { res.status(403).json({ error: "No school context for this account" }); return; }

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
    const schoolId = await getRequesterSchoolId(req);
    if (!schoolId) { res.status(403).json({ error: "No school context for this account" }); return; }

    // 404 (not 403) when the path school doesn't match, so we don't reveal that
    // a file exists for another school.
    if (path.basename(req.params.schoolId) !== schoolId) {
      res.status(404).json({ error: "File not found" });
      return;
    }

    const name = path.basename(req.params.name);
    const filePath = path.join(getUploadsDir(), schoolId, name);
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
    const schoolId = await getRequesterSchoolId(req);
    if (!schoolId) { res.status(403).json({ error: "No school context for this account" }); return; }

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

    let result = rows;
    if (query.student_id) result = result.filter(r => r.student_id === query.student_id);
    res.json(result);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/reports", async (req, res) => {
  try {
    const schoolId = await getRequesterSchoolId(req);
    if (!schoolId) { res.status(403).json({ error: "No school context for this account" }); return; }

    const body = CreateReportBody.parse(req.body);

    // The file must be one this school uploaded (URLs are school-bound at
    // upload time). Reject references to another tenant's file.
    if (!body.file_url.startsWith(`/api/uploads/${schoolId}/`)) {
      res.status(400).json({ error: "Invalid file reference" });
      return;
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
