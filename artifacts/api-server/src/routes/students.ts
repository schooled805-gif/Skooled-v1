import { Router } from "express";
import { db } from "@workspace/db";
import { students, profiles, schools, classes, subjects, timetableEntries, parentStudentLinks } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { getRequesterSchoolId } from "../lib/scope";
import {
  ListStudentsQueryParams,
  CreateStudentBody,
  GetStudentParams,
  UpdateStudentParams,
  UpdateStudentBody,
} from "@workspace/api-zod";

const router = Router();

/** GET /api/students/lookup?school_id=...&student_number=...
 *  Public endpoint — used during parent signup to verify a child by student number.
 *  Returns only safe fields (no DOB, no profile_id). */
router.get("/students/lookup", async (req, res) => {
  try {
    const { school_id, student_number } = req.query as Record<string, string>;
    if (!school_id || !student_number) {
      res.status(400).json({ error: "school_id and student_number are required" }); return;
    }
    const rows = await db.select({
      id: students.id,
      school_id: students.schoolId,
      grade: students.grade,
      student_number: students.studentNumber,
      full_name: profiles.fullName,
    }).from(students)
      .leftJoin(profiles, eq(students.profileId, profiles.id))
      .where(eq(students.schoolId, school_id));
    const match = rows.find(r => r.student_number?.toLowerCase() === student_number.toLowerCase());
    if (!match) { res.status(404).json({ error: "No student found with that ID at this school" }); return; }
    res.json(match);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/students", async (req, res) => {
  try {
    const query = ListStudentsQueryParams.parse(req.query);
    const schoolId = await getRequesterSchoolId(req);
    if (!schoolId) { res.status(403).json({ error: "No school context for this account" }); return; }

    const rows = await db.select({
      id: students.id,
      profile_id: students.profileId,
      class_id: students.classId,
      school_id: students.schoolId,
      grade: students.grade,
      date_of_birth: students.dateOfBirth,
      student_number: students.studentNumber,
      full_name: profiles.fullName,
      email: profiles.email,
      avatar_url: profiles.avatarUrl,
      created_at: students.createdAt,
    }).from(students)
      .leftJoin(profiles, eq(students.profileId, profiles.id))
      .where(eq(students.schoolId, schoolId));

    // school_id is enforced server-side; only optional in-school filters remain.
    let result = rows;
    if (query.class_id) result = result.filter((s) => s.class_id === query.class_id);
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
      email: profiles.email,
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

    const placeholderUserId = crypto.randomUUID();
    const [profile] = await db.insert(profiles).values({
      userId: placeholderUserId,
      role: "student",
      fullName: full_name.trim(),
      email: email.trim().toLowerCase(),
      schoolId: school_id,
    }).returning();

    const [student] = await db.insert(students).values({
      profileId: profile.id,
      classId: class_id,
      schoolId: school_id,
      grade: grade.trim(),
      dateOfBirth: date_of_birth || null,
      studentNumber: student_number,
    }).returning();

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

/** GET /api/students/:id/teachers
 *  Returns the class/head teacher plus the distinct subject teachers (derived
 *  from the class timetable) for a student. Only a parent linked to the student
 *  may call this. Each teacher includes their auth user_id so the caller can
 *  start a message conversation with them. */
router.get("/students/:id/teachers", async (req, res) => {
  try {
    const studentId = req.params.id;
    const requesterUserId = req.headers["x-user-id"] as string;

    // Authorize: the requesting parent must be linked to this student.
    const [link] = await db.select().from(parentStudentLinks).where(
      and(
        eq(parentStudentLinks.parentUserId, requesterUserId),
        eq(parentStudentLinks.studentId, studentId),
      ),
    ).limit(1);
    if (!link) { res.status(403).json({ error: "You are not linked to this student" }); return; }

    const [student] = await db.select().from(students).where(eq(students.id, studentId)).limit(1);
    if (!student) { res.status(404).json({ error: "Student not found" }); return; }

    const classId = student.classId ?? null;
    if (!classId) {
      res.json({ student_id: studentId, class_id: null, class_name: null, class_teacher: null, subject_teachers: [] });
      return;
    }

    // Class (head) teacher.
    const [cls] = await db.select({
      id: classes.id,
      name: classes.name,
      teacherId: classes.teacherId,
      teacher_user_id: profiles.userId,
      teacher_name: profiles.fullName,
    }).from(classes)
      .leftJoin(profiles, eq(classes.teacherId, profiles.id))
      .where(eq(classes.id, classId))
      .limit(1);

    const classTeacher = cls?.teacherId && cls.teacher_user_id
      ? {
          teacher_user_id: cls.teacher_user_id,
          teacher_profile_id: cls.teacherId,
          name: cls.teacher_name ?? "Teacher",
          subject_id: null,
          subject_name: null,
        }
      : null;

    // Subject teachers derived from the class timetable.
    const entries = await db.select({
      teacher_profile_id: timetableEntries.teacherId,
      subject_id: timetableEntries.subjectId,
      subject_name: subjects.name,
      teacher_user_id: profiles.userId,
      teacher_name: profiles.fullName,
    }).from(timetableEntries)
      .leftJoin(subjects, eq(timetableEntries.subjectId, subjects.id))
      .leftJoin(profiles, eq(timetableEntries.teacherId, profiles.id))
      .where(eq(timetableEntries.classId, classId));

    const seen = new Set<string>();
    const subjectTeachers = [] as Array<{
      teacher_user_id: string;
      teacher_profile_id: string;
      name: string;
      subject_id: string | null;
      subject_name: string | null;
    }>;
    for (const e of entries) {
      if (!e.teacher_user_id) continue; // teacher has no auth account — can't message
      const key = `${e.teacher_profile_id}:${e.subject_id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      subjectTeachers.push({
        teacher_user_id: e.teacher_user_id,
        teacher_profile_id: e.teacher_profile_id,
        name: e.teacher_name ?? "Teacher",
        subject_id: e.subject_id ?? null,
        subject_name: e.subject_name ?? null,
      });
    }

    res.json({
      student_id: studentId,
      class_id: classId,
      class_name: cls?.name ?? null,
      class_teacher: classTeacher,
      subject_teachers: subjectTeachers,
    });
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
