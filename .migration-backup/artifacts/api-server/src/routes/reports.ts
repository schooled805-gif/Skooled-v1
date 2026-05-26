import { Router } from "express";
import { db } from "@workspace/db";
import { reports, students, profiles } from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  ListReportsQueryParams,
  CreateReportBody,
} from "@workspace/api-zod";

const router = Router();

router.get("/reports", async (req, res) => {
  try {
    const query = ListReportsQueryParams.parse(req.query);
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
      created_at: reports.createdAt,
    }).from(reports)
      .leftJoin(students, eq(reports.studentId, students.id))
      .leftJoin(profiles, eq(students.profileId, profiles.id));

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
    const body = CreateReportBody.parse(req.body);
    const [report] = await db.insert(reports).values({
      studentId: body.student_id,
      title: body.title,
      term: body.term,
      year: body.year,
      fileUrl: body.file_url,
      visibleToStudent: body.visible_to_student ?? false,
      schoolId: body.school_id,
    }).returning();
    res.status(201).json({ ...report, student_name: null });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
