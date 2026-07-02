import { Router } from "express";
import { db } from "@workspace/db";
import { parentStudentLinks, students, profiles } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { getRequesterProfile } from "../lib/scope";

const router = Router();

// List parent-student links. A parent may only see their own links; an admin
// may query any parent within their own school. The parent_user_id query param
// is NOT trusted for authorization — it is validated against the verified caller.
router.get("/parent-student-links", async (req, res) => {
  try {
    const requester = await getRequesterProfile(req);
    if (!requester) { res.status(401).json({ error: "Authentication required" }); return; }

    const requestedParentId = (req.query.parent_user_id as string) || requester.userId;
    if (requester.role !== "admin" && requestedParentId !== requester.userId) {
      res.status(403).json({ error: "You can only view your own linked students" }); return;
    }

    const where = requester.role === "admin" && requester.schoolId
      ? and(
          eq(parentStudentLinks.parentUserId, requestedParentId),
          eq(parentStudentLinks.schoolId, requester.schoolId),
        )
      : eq(parentStudentLinks.parentUserId, requestedParentId);

    const links = await db.select().from(parentStudentLinks).where(where);

    const enriched = await Promise.all(links.map(async (link) => {
      const [student] = await db.select().from(students).where(eq(students.id, link.studentId)).limit(1);
      let studentName: string | null = null;
      let studentGrade: string | null = null;
      let studentNumber: string | null = null;
      let classId: string | null = null;
      if (student) {
        studentGrade = student.grade;
        studentNumber = student.studentNumber ?? null;
        classId = student.classId ?? null;
        const [prof] = await db.select().from(profiles).where(eq(profiles.id, student.profileId)).limit(1);
        studentName = prof?.fullName ?? null;
      }
      return {
        id: link.id,
        parent_user_id: link.parentUserId,
        student_id: link.studentId,
        school_id: link.schoolId,
        created_at: link.createdAt?.toISOString() ?? null,
        student_name: studentName,
        student_grade: studentGrade,
        student_number: studentNumber,
        class_id: classId,
      };
    }));

    res.json(enriched);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Create a parent-student link. Authorization is derived server-side from the
// verified caller — the client CANNOT set an arbitrary parent_user_id/school_id.
// A parent links themselves to a student; an admin may link a parent in their
// school. In both cases the student must belong to the same school, so a link
// can never be forged to a student in another school or on another account —
// which is what the fees/account authorization checks rely on.
router.post("/parent-student-links", async (req, res) => {
  try {
    const requester = await getRequesterProfile(req);
    if (!requester) { res.status(401).json({ error: "Authentication required" }); return; }

    const student_id = req.body?.student_id as string | undefined;
    if (!student_id) { res.status(400).json({ error: "student_id required" }); return; }

    let parentUserId: string;
    let schoolId: string;

    if (requester.role === "admin") {
      if (!requester.schoolId) { res.status(403).json({ error: "No school context" }); return; }
      const targetParentUserId = req.body?.parent_user_id as string | undefined;
      if (!targetParentUserId) { res.status(400).json({ error: "parent_user_id required" }); return; }
      const [parentProfile] = await db.select().from(profiles)
        .where(eq(profiles.userId, targetParentUserId)).limit(1);
      if (!parentProfile || parentProfile.role !== "parent" || parentProfile.schoolId !== requester.schoolId) {
        res.status(403).json({ error: "Parent not found in your school" }); return;
      }
      parentUserId = targetParentUserId;
      schoolId = requester.schoolId;
    } else if (requester.role === "parent") {
      if (!requester.schoolId) { res.status(403).json({ error: "No school context" }); return; }
      parentUserId = requester.userId;
      schoolId = requester.schoolId;
    } else {
      res.status(403).json({ error: "Only parents or admins can link students" }); return;
    }

    // The student must exist and be in the same school as the link.
    const [student] = await db.select().from(students).where(eq(students.id, student_id)).limit(1);
    if (!student || student.schoolId !== schoolId) {
      res.status(404).json({ error: "Student not found in this school" }); return;
    }

    const existing = await db.select().from(parentStudentLinks).where(
      and(
        eq(parentStudentLinks.parentUserId, parentUserId),
        eq(parentStudentLinks.studentId, student_id),
      )
    ).limit(1);
    if (existing.length > 0) { res.status(200).json(existing[0]); return; }

    const [link] = await db.insert(parentStudentLinks).values({
      parentUserId,
      studentId: student_id,
      schoolId,
    }).returning();
    res.status(201).json(link);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Remove a link. A parent may only remove their own link; an admin may remove a
// link within their own school.
router.delete("/parent-student-links/:id", async (req, res) => {
  try {
    const requester = await getRequesterProfile(req);
    if (!requester) { res.status(401).json({ error: "Authentication required" }); return; }

    const [link] = await db.select().from(parentStudentLinks)
      .where(eq(parentStudentLinks.id, req.params.id)).limit(1);
    if (!link) { res.status(204).send(); return; }

    const allowed = requester.role === "admin"
      ? link.schoolId === requester.schoolId
      : link.parentUserId === requester.userId;
    if (!allowed) { res.status(403).json({ error: "Not permitted" }); return; }

    await db.delete(parentStudentLinks).where(eq(parentStudentLinks.id, req.params.id));
    res.status(204).send();
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
