import { Router } from "express";
import { db } from "@workspace/db";
import { classes, students } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { getRequesterSchoolId, getRequesterProfile, getTeacherClassIds, requireAdmin } from "../lib/scope";
import { handleRouteError, normalizePhase } from "../lib/validation";
import {
  ListClassesQueryParams,
  CreateClassBody,
  GetClassParams,
  UpdateClassParams,
  UpdateClassBody,
} from "@workspace/api-zod";

const router = Router();

/** Map Drizzle camelCase class to snake_case for API responses */
function mapClass(c: typeof classes.$inferSelect) {
  return {
    id: c.id,
    name: c.name,
    school_id: c.schoolId,
    grade_level: c.gradeLevel ?? null,
    teacher_id: c.teacherId ?? null,
    academic_year: c.academicYear ?? null,
    phase: c.phase ?? null,
    status: c.status ?? "active",
    created_at: c.createdAt?.toISOString() ?? null,
    updated_at: c.updatedAt?.toISOString() ?? null,
  };
}

router.get("/classes", async (req, res) => {
  try {
    ListClassesQueryParams.parse(req.query);
    const requester = await getRequesterProfile(req);
    if (!requester?.schoolId) { res.status(403).json({ error: "No school context for this account" }); return; }

    const rows = await db.select().from(classes).where(eq(classes.schoolId, requester.schoolId));
    // A teacher only sees the classes they teach (head teacher or via timetable).
    let result = rows;
    if (requester.role === "teacher") {
      const allowed = await getTeacherClassIds(requester.id, requester.schoolId);
      result = rows.filter((c) => allowed.has(c.id));
    }
    res.json(result.map(mapClass));
  } catch (err) {
    handleRouteError(req, res, err);
  }
});

router.post("/classes", async (req, res) => {
  try {
    const admin = await requireAdmin(req);
    if (!admin || !admin.schoolId) { res.status(403).json({ error: "Admin access required" }); return; }
    const body = CreateClassBody.parse(req.body);
    const phase = normalizePhase(req.body?.phase);
    // Reject duplicate class names within the same school + phase.
    const desired = body.name?.trim().toLowerCase();
    if (desired) {
      const existingRows = await db.select({ name: classes.name, phase: classes.phase })
        .from(classes).where(eq(classes.schoolId, admin.schoolId));
      const dup = existingRows.find(
        (c) => c.name?.trim().toLowerCase() === desired && (c.phase ?? null) === (phase ?? null),
      );
      if (dup) { res.status(409).json({ error: `A class named "${body.name}" already exists` }); return; }
    }
    const [cls] = await db.insert(classes).values({
      name: body.name,
      schoolId: admin.schoolId,
      gradeLevel: body.grade_level,
      teacherId: body.teacher_id ?? null,
      academicYear: body.academic_year ?? null,
      phase,
    }).returning();
    res.status(201).json(mapClass(cls));
  } catch (err) {
    handleRouteError(req, res, err);
  }
});

router.get("/classes/:id", async (req, res) => {
  try {
    const { id } = GetClassParams.parse(req.params);
    const schoolId = await getRequesterSchoolId(req);
    if (!schoolId) { res.status(403).json({ error: "No school context for this account" }); return; }
    const [cls] = await db.select().from(classes)
      .where(and(eq(classes.id, id), eq(classes.schoolId, schoolId))).limit(1);
    if (!cls) { res.status(404).json({ error: "Not found" }); return; }
    res.json(mapClass(cls));
  } catch (err) {
    handleRouteError(req, res, err);
  }
});

router.patch("/classes/:id", async (req, res) => {
  try {
    const admin = await requireAdmin(req);
    if (!admin || !admin.schoolId) { res.status(403).json({ error: "Admin access required" }); return; }
    const { id } = UpdateClassParams.parse(req.params);
    const body = UpdateClassBody.parse(req.body);
    const [cls] = await db.update(classes).set({
      name: body.name,
      gradeLevel: body.grade_level,
      teacherId: body.teacher_id,
      ...(req.body?.phase !== undefined && {
        phase: normalizePhase(req.body.phase),
      }),
      updatedAt: new Date(),
    }).where(and(eq(classes.id, id), eq(classes.schoolId, admin.schoolId))).returning();
    if (!cls) { res.status(404).json({ error: "Not found" }); return; }
    res.json(mapClass(cls));
  } catch (err) {
    handleRouteError(req, res, err);
  }
});

// Enable/disable a class (admin only). A disabled class is hidden from the
// places where active classes are offered (e.g. timetable + enrolment pickers).
router.patch("/classes/:id/status", async (req, res) => {
  try {
    const admin = await requireAdmin(req);
    if (!admin || !admin.schoolId) { res.status(403).json({ error: "Admin access required" }); return; }
    const status = req.body?.status;
    if (status !== "active" && status !== "disabled") {
      res.status(400).json({ error: "status: must be 'active' or 'disabled'" });
      return;
    }
    const [cls] = await db.update(classes).set({ status, updatedAt: new Date() })
      .where(and(eq(classes.id, req.params.id), eq(classes.schoolId, admin.schoolId))).returning();
    if (!cls) { res.status(404).json({ error: "Class not found" }); return; }
    res.json(mapClass(cls));
  } catch (err) {
    handleRouteError(req, res, err);
  }
});

router.delete("/classes/:id", async (req, res) => {
  try {
    const admin = await requireAdmin(req);
    if (!admin || !admin.schoolId) { res.status(403).json({ error: "Admin access required" }); return; }
    const enrolled = await db.select({ id: students.id }).from(students).where(eq(students.classId, req.params.id));
    if (enrolled.length > 0) {
      res.status(400).json({ error: `Cannot delete this class — ${enrolled.length} student(s) are still enrolled. Reassign or remove them first, or disable the class instead.` });
      return;
    }
    await db.delete(classes).where(and(eq(classes.id, req.params.id), eq(classes.schoolId, admin.schoolId)));
    res.status(204).end();
  } catch (err) {
    handleRouteError(req, res, err);
  }
});

export default router;
