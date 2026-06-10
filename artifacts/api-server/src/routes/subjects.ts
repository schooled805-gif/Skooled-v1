import { Router } from "express";
import { db } from "@workspace/db";
import { subjects, subjectTeachers, profiles } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { CreateSubjectBody } from "@workspace/api-zod";
import { getRequesterProfile, requireAdmin } from "../lib/scope";
import { handleRouteError, normalizePhase } from "../lib/validation";

const router = Router();

function str(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t.length ? t : null;
}

router.get("/subjects", async (req, res) => {
  try {
    const requester = await getRequesterProfile(req);
    if (!requester || !requester.schoolId) {
      res.status(403).json({ error: "No school context for this account" });
      return;
    }
    const rows = await db.select().from(subjects).where(eq(subjects.schoolId, requester.schoolId));
    res.json(rows);
  } catch (err) {
    handleRouteError(req, res, err);
  }
});

router.post("/subjects", async (req, res) => {
  try {
    const admin = await requireAdmin(req);
    if (!admin || !admin.schoolId) {
      res.status(403).json({ error: "Admin access required" });
      return;
    }
    const name = str(req.body?.name);
    if (!name) {
      res.status(400).json({ error: "name: Subject name is required" });
      return;
    }
    const phase = normalizePhase(req.body?.phase);
    // Reject duplicate subject names within the same school + phase.
    const existingRows = await db.select({ name: subjects.name, phase: subjects.phase })
      .from(subjects).where(eq(subjects.schoolId, admin.schoolId));
    const dup = existingRows.find(
      (s) => s.name?.trim().toLowerCase() === name.toLowerCase() && (s.phase ?? null) === (phase ?? null),
    );
    if (dup) { res.status(409).json({ error: `A subject named "${name}" already exists` }); return; }
    const [subject] = await db.insert(subjects).values({
      name,
      code: str(req.body?.code),
      schoolId: admin.schoolId,
      phase,
    }).returning();
    res.status(201).json(subject);
  } catch (err) {
    handleRouteError(req, res, err);
  }
});

router.patch("/subjects/:id", async (req, res) => {
  try {
    const admin = await requireAdmin(req);
    if (!admin || !admin.schoolId) {
      res.status(403).json({ error: "Admin access required" });
      return;
    }
    const name = str(req.body?.name);
    if (!name) {
      res.status(400).json({ error: "name: Subject name is required" });
      return;
    }
    const [subject] = await db.update(subjects).set({
      name,
      code: str(req.body?.code),
      ...(req.body?.phase !== undefined && { phase: normalizePhase(req.body?.phase) }),
    }).where(and(eq(subjects.id, req.params.id), eq(subjects.schoolId, admin.schoolId))).returning();
    if (!subject) { res.status(404).json({ error: "Subject not found" }); return; }
    res.json(subject);
  } catch (err) {
    handleRouteError(req, res, err);
  }
});

router.delete("/subjects/:id", async (req, res) => {
  try {
    const admin = await requireAdmin(req);
    if (!admin || !admin.schoolId) {
      res.status(403).json({ error: "Admin access required" });
      return;
    }
    await db.delete(subjectTeachers).where(and(eq(subjectTeachers.subjectId, req.params.id), eq(subjectTeachers.schoolId, admin.schoolId)));
    await db.delete(subjects).where(and(eq(subjects.id, req.params.id), eq(subjects.schoolId, admin.schoolId)));
    res.status(204).end();
  } catch (err) {
    handleRouteError(req, res, err);
  }
});

// ── SUBJECT ↔ TEACHER ASSIGNMENTS ─────────────────────────────────────────────
router.get("/subject-teachers", async (req, res) => {
  try {
    const requester = await getRequesterProfile(req);
    if (!requester || !requester.schoolId) {
      res.status(403).json({ error: "No school context for this account" });
      return;
    }
    const rows = await db.select({
      id: subjectTeachers.id,
      subject_id: subjectTeachers.subjectId,
      teacher_id: subjectTeachers.teacherId,
      teacher_name: profiles.fullName,
    }).from(subjectTeachers)
      .leftJoin(profiles, eq(subjectTeachers.teacherId, profiles.id))
      .where(eq(subjectTeachers.schoolId, requester.schoolId));
    res.json(rows);
  } catch (err) {
    handleRouteError(req, res, err);
  }
});

router.post("/subjects/:id/teachers", async (req, res) => {
  try {
    const admin = await requireAdmin(req);
    if (!admin || !admin.schoolId) {
      res.status(403).json({ error: "Admin access required" });
      return;
    }
    const teacherId = str(req.body?.teacher_id);
    if (!teacherId) {
      res.status(400).json({ error: "teacher_id: Please choose a teacher" });
      return;
    }
    const [existing] = await db.select().from(subjectTeachers).where(and(
      eq(subjectTeachers.subjectId, req.params.id),
      eq(subjectTeachers.teacherId, teacherId),
    )).limit(1);
    if (existing) { res.status(200).json(existing); return; }
    const [row] = await db.insert(subjectTeachers).values({
      subjectId: req.params.id,
      teacherId,
      schoolId: admin.schoolId,
    }).returning();
    res.status(201).json(row);
  } catch (err) {
    handleRouteError(req, res, err);
  }
});

router.delete("/subjects/:subjectId/teachers/:teacherId", async (req, res) => {
  try {
    const admin = await requireAdmin(req);
    if (!admin || !admin.schoolId) {
      res.status(403).json({ error: "Admin access required" });
      return;
    }
    await db.delete(subjectTeachers).where(and(
      eq(subjectTeachers.subjectId, req.params.subjectId),
      eq(subjectTeachers.teacherId, req.params.teacherId),
      eq(subjectTeachers.schoolId, admin.schoolId),
    ));
    res.status(204).end();
  } catch (err) {
    handleRouteError(req, res, err);
  }
});

export default router;
