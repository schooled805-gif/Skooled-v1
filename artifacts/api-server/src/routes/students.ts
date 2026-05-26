import { Router } from "express";
import { db } from "@workspace/db";
import { students, profiles, schools } from "@workspace/db";
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

router.delete("/students/:id", async (req, res) => {
  try {
    const { id } = GetStudentParams.parse(req.params);
    await db.delete(students).where(eq(students.id, id));
    res.status(204).send();
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/students/full-create", async (req, res) => {
  try {
    const { full_name, email, grade, class_id, date_of_birth, school_id } = req.body;

    if (!class_id) {
      res.status(400).json({ error: "Class assignment is required. A student cannot be enrolled without a class." });
      return;
    }
    if (!full_name?.trim() || !email?.trim() || !grade?.trim() || !school_id) {
      res.status(400).json({ error: "full_name, email, grade, and school_id are required" });
      return;
    }

    // Generate student number: school prefix + sequential
    const existingCount = await db.select({ id: students.id }).from(students).where(eq(students.schoolId, school_id));
    const seq = String(existingCount.length + 1).padStart(4, "0");

    let prefix = "STU";
    try {
      const [school] = await db.select({ name: schools.name }).from(schools).where(eq(schools.id, school_id)).limit(1);
      if (school?.name) {
        prefix = school.name.replace(/[^a-zA-Z]/g, "").slice(0, 3).toUpperCase() || "STU";
      }
    } catch {}

    const student_number = `${prefix}-${seq}`;

    // Create profile with placeholder userId (linked on first login via email)
    const placeholderUserId = crypto.randomUUID();
    const [profile] = await db.insert(profiles).values({
      userId: placeholderUserId,
      role: "student",
      fullName: full_name.trim(),
      email: email.trim().toLowerCase(),
      schoolId: school_id,
    }).returning();

    // Create student record
    const [student] = await db.insert(students).values({
      profileId: profile.id,
      classId: class_id,
      schoolId: school_id,
      grade: grade.trim(),
      dateOfBirth: date_of_birth || null,
      studentNumber: student_number,
    }).returning();

    // Try to send Supabase invite email
    let invited = false;
    const supabaseUrl = process.env["SUPABASE_URL"];
    const serviceKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];
    if (supabaseUrl && serviceKey) {
      try {
        const inviteRes = await fetch(`${supabaseUrl}/auth/v1/invite`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${serviceKey}`, "apikey": serviceKey },
          body: JSON.stringify({ email: email.trim().toLowerCase(), data: { full_name: full_name.trim() } }),
        });
        invited = inviteRes.ok;
      } catch {}
    }

    res.status(201).json({ ...student, full_name: profile.fullName, student_number, invited });
  } catch (err: any) {
    req.log.error(err);
    if (err?.code === "23505") {
      res.status(409).json({ error: "A student with this email already exists" });
    } else {
      res.status(500).json({ error: "Internal server error" });
    }
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
