import { Router } from "express";
import { db } from "@workspace/db";
import { customEvents, parentStudentLinks, students } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { getRequesterProfile } from "../lib/scope";
import { handleRouteError } from "../lib/validation";

const router = Router();

function str(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t.length ? t : null;
}

function strArray(v: unknown): string[] | null {
  if (!Array.isArray(v)) return null;
  const arr = v.map((x) => (typeof x === "string" ? x.trim() : "")).filter(Boolean);
  return arr.length ? arr : null;
}

function serialize(e: typeof customEvents.$inferSelect) {
  return {
    id: e.id,
    parent_user_id: e.parentUserId,
    student_id: e.studentId,
    title: e.title,
    description: e.description,
    days_of_week: e.daysOfWeek ?? [],
    start_time: e.startTime,
    end_time: e.endTime,
    start_date: e.startDate,
    end_date: e.endDate,
    location: e.location,
    school_id: e.schoolId,
    created_at: e.createdAt,
  };
}

// Confirm the requesting parent is linked to the given student.
async function parentOwnsStudent(parentUserId: string, studentId: string): Promise<boolean> {
  const [link] = await db
    .select()
    .from(parentStudentLinks)
    .where(and(eq(parentStudentLinks.parentUserId, parentUserId), eq(parentStudentLinks.studentId, studentId)))
    .limit(1);
  return !!link;
}

// ── GET /custom-events ────────────────────────────────────────────────────────
// Parent → their own custom events. Admin → all for the school.
router.get("/custom-events", async (req, res) => {
  try {
    const requester = await getRequesterProfile(req);
    if (!requester || !requester.schoolId) {
      res.status(403).json({ error: "No school context for this account" });
      return;
    }
    let rows;
    if (requester.role === "parent") {
      rows = await db
        .select()
        .from(customEvents)
        .where(and(eq(customEvents.parentUserId, requester.userId), eq(customEvents.schoolId, requester.schoolId)));
    } else if (requester.role === "admin") {
      rows = await db.select().from(customEvents).where(eq(customEvents.schoolId, requester.schoolId));
    } else {
      rows = [];
    }
    res.json(rows.map(serialize));
  } catch (err) {
    handleRouteError(req, res, err);
  }
});

// ── POST /custom-events ───────────────────────────────────────────────────────
router.post("/custom-events", async (req, res) => {
  try {
    const requester = await getRequesterProfile(req);
    if (!requester || !requester.schoolId) {
      res.status(403).json({ error: "No school context for this account" });
      return;
    }
    if (requester.role !== "parent") {
      res.status(403).json({ error: "Only a parent can add a custom event" });
      return;
    }
    const studentId = str(req.body?.student_id);
    const title = str(req.body?.title);
    if (!studentId || !title) {
      res.status(400).json({ error: "Please choose a child and a title" });
      return;
    }
    if (!(await parentOwnsStudent(requester.userId, studentId))) {
      res.status(403).json({ error: "That child is not linked to your account" });
      return;
    }
    // Confirm the student belongs to this school.
    const [student] = await db
      .select({ id: students.id })
      .from(students)
      .where(and(eq(students.id, studentId), eq(students.schoolId, requester.schoolId)))
      .limit(1);
    if (!student) {
      res.status(404).json({ error: "Student not found" });
      return;
    }
    const [row] = await db
      .insert(customEvents)
      .values({
        parentUserId: requester.userId,
        studentId,
        title,
        description: str(req.body?.description),
        daysOfWeek: strArray(req.body?.days_of_week),
        startTime: str(req.body?.start_time),
        endTime: str(req.body?.end_time),
        startDate: str(req.body?.start_date),
        endDate: str(req.body?.end_date),
        location: str(req.body?.location),
        schoolId: requester.schoolId,
      })
      .returning();
    res.status(201).json(serialize(row));
  } catch (err) {
    handleRouteError(req, res, err);
  }
});

// ── DELETE /custom-events/:id ─────────────────────────────────────────────────
router.delete("/custom-events/:id", async (req, res) => {
  try {
    const requester = await getRequesterProfile(req);
    if (!requester || !requester.schoolId) {
      res.status(403).json({ error: "No school context for this account" });
      return;
    }
    const [row] = await db
      .select()
      .from(customEvents)
      .where(and(eq(customEvents.id, req.params.id), eq(customEvents.schoolId, requester.schoolId)))
      .limit(1);
    if (!row) {
      res.status(204).end();
      return;
    }
    if (requester.role === "parent" && row.parentUserId !== requester.userId) {
      res.status(403).json({ error: "You can only remove your own events" });
      return;
    }
    if (requester.role !== "parent" && requester.role !== "admin") {
      res.status(403).json({ error: "Not allowed" });
      return;
    }
    await db.delete(customEvents).where(eq(customEvents.id, req.params.id));
    res.status(204).end();
  } catch (err) {
    handleRouteError(req, res, err);
  }
});

export default router;
