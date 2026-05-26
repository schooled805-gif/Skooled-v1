import { Router } from "express";
import { db } from "@workspace/db";
import { students, profiles } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import {
  ListStudentsQueryParams,
  CreateStudentBody,
  GetStudentParams,
  UpdateStudentParams,
  UpdateStudentBody,
} from "@workspace/api-zod";
import { inArray } from "drizzle-orm";

const router = Router();

router.get("/students", async (req, res) => {
  try {
    const query = ListStudentsQueryParams.parse(req.query);
    const rows = await db.select({
      id: students.id,
      profile_id: students.profileId,
      class_id: students.classId,
      school_id: students.schoolId,
      grade: students.grade,
      date_of_birth: students.dateOfBirth,
      student_number: students.studentNumber,
      full_name: profiles.fullName,
      avatar_url: profiles.avatarUrl,
      created_at: students.createdAt,
    }).from(students).leftJoin(profiles, eq(students.profileId, profiles.id));

    let result = rows;
    if (query.school_id) result = result.filter(s => s.school_id === query.school_id);
    if (query.class_id) result = result.filter(s => s.class_id === query.class_id);
    res.json(result);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/students", async (req, res) => {
  try {
    const body = CreateStudentBody.parse(req.body);
    const [student] = await db.insert(students).values({
      profileId: body.profile_id,
      classId: body.class_id ?? null,
      schoolId: body.school_id,
      grade: body.grade,
      dateOfBirth: body.date_of_birth ?? null,
      studentNumber: body.student_number ?? null,
    }).returning();

    const [prof] = await db.select().from(profiles).where(eq(profiles.id, student.profileId)).limit(1);
    res.status(201).json({
      ...student,
      full_name: prof?.fullName ?? null,
      avatar_url: prof?.avatarUrl ?? null,
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/students/:id", async (req, res) => {
  try {
    const { id } = GetStudentParams.parse(req.params);
    const [row] = await db.select({
      id: students.id,
      profile_id: students.profileId,
      class_id: students.classId,
      school_id: students.schoolId,
      grade: students.grade,
      date_of_birth: students.dateOfBirth,
      student_number: students.studentNumber,
      full_name: profiles.fullName,
      avatar_url: profiles.avatarUrl,
      created_at: students.createdAt,
    }).from(students).leftJoin(profiles, eq(students.profileId, profiles.id)).where(eq(students.id, id)).limit(1);
    if (!row) { res.status(404).json({ error: "Not found" }); return; }
    res.json(row);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/students/:id", async (req, res) => {
  try {
    const { id } = UpdateStudentParams.parse(req.params);
    const body = UpdateStudentBody.parse(req.body);
    const [student] = await db.update(students).set({
      classId: body.class_id,
      grade: body.grade,
      dateOfBirth: body.date_of_birth,
    }).where(eq(students.id, id)).returning();
    if (!student) { res.status(404).json({ error: "Not found" }); return; }
    const [prof] = await db.select().from(profiles).where(eq(profiles.id, student.profileId)).limit(1);
    res.json({ ...student, full_name: prof?.fullName ?? null, avatar_url: prof?.avatarUrl ?? null });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
