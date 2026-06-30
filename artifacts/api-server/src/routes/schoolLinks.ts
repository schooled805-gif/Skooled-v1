import { Router } from "express";
import { db } from "@workspace/db";
import { schoolLinks } from "@workspace/db";
import { and, eq, asc } from "drizzle-orm";
import { getRequesterProfile, requireAdmin } from "../lib/scope";

const router = Router();

function mapLink(r: typeof schoolLinks.$inferSelect) {
  return {
    id: r.id,
    school_id: r.schoolId,
    label: r.label,
    url: r.url,
    category: r.category,
    sort_order: r.sortOrder,
    created_at: r.createdAt,
  };
}

/** GET /api/school-links — any member can see the school's external links. */
router.get("/school-links", async (req, res) => {
  try {
    const requester = await getRequesterProfile(req);
    if (!requester?.schoolId) { res.status(403).json({ error: "No school context for this account" }); return; }
    const rows = await db.select()
      .from(schoolLinks)
      .where(eq(schoolLinks.schoolId, requester.schoolId))
      .orderBy(asc(schoolLinks.sortOrder));
    res.json(rows.map(mapLink));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

/** POST /api/school-links — admin adds a link. */
router.post("/school-links", async (req, res) => {
  try {
    const admin = await requireAdmin(req);
    if (!admin || !admin.schoolId) { res.status(403).json({ error: "Admin access required" }); return; }
    const { label, url, category, sort_order } = req.body ?? {};
    if (!label?.trim() || !url?.trim()) { res.status(400).json({ error: "label and url are required" }); return; }
    const [row] = await db.insert(schoolLinks).values({
      schoolId: admin.schoolId,
      label: label.trim(),
      url: url.trim(),
      category: category?.trim() || "uniform",
      sortOrder: typeof sort_order === "number" ? sort_order : 0,
    }).returning();
    res.status(201).json(mapLink(row));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

/** PATCH /api/school-links/:id — admin edits a link. */
router.patch("/school-links/:id", async (req, res) => {
  try {
    const admin = await requireAdmin(req);
    if (!admin || !admin.schoolId) { res.status(403).json({ error: "Admin access required" }); return; }
    const { id } = req.params;
    const { label, url, category, sort_order } = req.body ?? {};
    const [row] = await db.update(schoolLinks).set({
      ...(label !== undefined ? { label: String(label).trim() } : {}),
      ...(url !== undefined ? { url: String(url).trim() } : {}),
      ...(category !== undefined ? { category: String(category).trim() } : {}),
      ...(typeof sort_order === "number" ? { sortOrder: sort_order } : {}),
    }).where(and(eq(schoolLinks.id, id), eq(schoolLinks.schoolId, admin.schoolId))).returning();
    if (!row) { res.status(404).json({ error: "Not found" }); return; }
    res.json(mapLink(row));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

/** DELETE /api/school-links/:id — admin removes a link. */
router.delete("/school-links/:id", async (req, res) => {
  try {
    const admin = await requireAdmin(req);
    if (!admin || !admin.schoolId) { res.status(403).json({ error: "Admin access required" }); return; }
    const { id } = req.params;
    const deleted = await db.delete(schoolLinks)
      .where(and(eq(schoolLinks.id, id), eq(schoolLinks.schoolId, admin.schoolId)))
      .returning();
    if (deleted.length === 0) { res.status(404).json({ error: "Not found" }); return; }
    res.status(204).send();
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
