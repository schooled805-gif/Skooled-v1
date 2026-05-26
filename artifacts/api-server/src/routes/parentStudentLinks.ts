import { Router } from "express";
import { db } from "@workspace/db";
import { parentStudentLinks, students, profiles } from "@workspace/db";
import { eq, and } from "drizzle-orm";

const router = Router();

router.get("/parent-student-links", async (req, res) => {
  try {
    const parentUserId = (req.query.parent_user_id as string) || (req.headers["x-user-id"] as string);
    if (!parentUserId) { res.status(400).json({ error: "parent_user_id required" }); return; }

    const links = await db.select().from(parentStudentLinks).where(eq(parentStudentLinks.parentUserId, parentUserId));

    // Enrich with student info
    const enriched = await Promise.all(links.map(async (link) => {
      const [student] = await db.select().from(students).where(eq(students.id, link.studentId)).limit(1);
      let studentName: string | null = null;
      let studentGrade: string | null = null;
      if (student) {
        studentGrade = student.grade;
        const [prof] = await db.select().from(profiles).where(eq(profiles.id, student.profileId)).limit(1);
        studentName = prof?.fullName ?? null;
      }
      return { ...link, student_name: studentName, student_grade: studentGrade };
    }));

    res.json(enriched);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/parent-student-links", async (req, res) => {
  try {
    const { parent_user_id, student_id, school_id } = req.body;
    if (!parent_user_id || !student_id || !school_id) {
      res.status(400).json({ error: "parent_user_id, student_id, school_id required" }); return;
    }
    // Prevent duplicates
    const existing = await db.select().from(parentStudentLinks).where(
      and(
        eq(parentStudentLinks.parentUserId, parent_user_id),
        eq(parentStudentLinks.studentId, student_id)
      )
    ).limit(1);
    if (existing.length > 0) {
      res.status(409).json({ error: "Link already exists" }); return;
    }
    const [link] = await db.insert(parentStudentLinks).values({
      parentUserId: parent_user_id,
      studentId: student_id,
      schoolId: school_id,
    }).returning();
    res.status(201).json(link);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/parent-student-links/:id", async (req, res) => {
  try {
    await db.delete(parentStudentLinks).where(eq(parentStudentLinks.id, req.params.id));
    res.status(204).send();
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
