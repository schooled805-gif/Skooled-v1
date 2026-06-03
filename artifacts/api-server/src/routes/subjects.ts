import { Router } from "express";
import { db } from "@workspace/db";
import { subjects } from "@workspace/db";
import { CreateSubjectBody } from "@workspace/api-zod";

const router = Router();

router.get("/subjects", async (req, res) => {
  try {
    const rows = await db.select().from(subjects);
    res.json(rows);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/subjects", async (req, res) => {
  try {
    const body = CreateSubjectBody.parse(req.body);
    const [subject] = await db.insert(subjects).values({
      name: body.name,
      code: body.code ?? null,
      schoolId: body.school_id,
    }).returning();
    res.status(201).json(subject);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
