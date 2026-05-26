import { Router } from "express";
import { db } from "@workspace/db";
import { schools } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

router.get("/schools", async (req, res) => {
  try {
    const rows = await db.select().from(schools).orderBy(schools.name);
    res.json(rows);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/schools", async (req, res) => {
  try {
    const { name, address, phone, email, logo_url } = req.body;
    if (!name) { res.status(400).json({ error: "name is required" }); return; }
    const [school] = await db.insert(schools).values({
      name,
      address: address ?? null,
      phone: phone ?? null,
      email: email ?? null,
      logoUrl: logo_url ?? null,
    }).returning();
    res.status(201).json(school);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/schools/:id", async (req, res) => {
  try {
    const [school] = await db.select().from(schools).where(eq(schools.id, req.params.id)).limit(1);
    if (!school) { res.status(404).json({ error: "Not found" }); return; }
    res.json(school);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/schools/:id", async (req, res) => {
  try {
    const userId = req.headers["x-user-id"] as string;
    if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

    const { profiles } = await import("@workspace/db");
    const [profile] = await db
      .select()
      .from(profiles)
      .where(eq(profiles.userId, userId))
      .limit(1);

    if (!profile || profile.role !== "admin" || profile.schoolId !== req.params.id) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    const { name, address, phone, email, logo_url, primary_color, secondary_color } = req.body;

    const [updated] = await db
      .update(schools)
      .set({
        ...(name !== undefined && { name }),
        ...(address !== undefined && { address }),
        ...(phone !== undefined && { phone }),
        ...(email !== undefined && { email }),
        ...(logo_url !== undefined && { logoUrl: logo_url }),
        ...(primary_color !== undefined && { primaryColor: primary_color }),
        ...(secondary_color !== undefined && { secondaryColor: secondary_color }),
      })
      .where(eq(schools.id, req.params.id))
      .returning();

    if (!updated) { res.status(404).json({ error: "Not found" }); return; }
    res.json(updated);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
