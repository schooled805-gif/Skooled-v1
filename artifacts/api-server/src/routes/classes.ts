import { Router } from "express";
import { db } from "@workspace/db";
import { classes } from "@workspace/db";
import { eq } from "drizzle-orm";
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
    created_at: c.createdAt?.toISOString() ?? null,
    updated_at: c.updatedAt?.toISOString() ?? null,
  };
}

router.get("/classes", async (req, res) => {
  try {
    const query = ListClassesQueryParams.parse(req.query);
    let rows = await db.select().from(classes);
    if (query.school_id) rows = rows.filter(c => c.schoolId === query.school_id);
    res.json(rows.map(mapClass));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/classes", async (req, res) => {
  try {
    const body = CreateClassBody.parse(req.body);
    const [cls] = await db.insert(classes).values({
      name: body.name,
      schoolId: body.school_id,
      gradeLevel: body.grade_level,
      teacherId: body.teacher_id ?? null,
      academicYear: body.academic_year ?? null,
    }).returning();
    res.status(201).json(mapClass(cls));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/classes/:id", async (req, res) => {
  try {
    const { id } = GetClassParams.parse(req.params);
    const [cls] = await db.select().from(classes).where(eq(classes.id, id)).limit(1);
    if (!cls) { res.status(404).json({ error: "Not found" }); return; }
    res.json(mapClass(cls));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/classes/:id", async (req, res) => {
  try {
    const { id } = UpdateClassParams.parse(req.params);
    const body = UpdateClassBody.parse(req.body);
    const [cls] = await db.update(classes).set({
      name: body.name,
      gradeLevel: body.grade_level,
      teacherId: body.teacher_id,
      updatedAt: new Date(),
    }).where(eq(classes.id, id)).returning();
    if (!cls) { res.status(404).json({ error: "Not found" }); return; }
    res.json(mapClass(cls));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
