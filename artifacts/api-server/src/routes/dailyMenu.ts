import { Router } from "express";
import { db } from "@workspace/db";
import { dailyMenus, schools } from "@workspace/db";
import { eq, and, gte, lte, asc } from "drizzle-orm";
import { getRequesterSchoolId, requireAdmin } from "../lib/scope";

const router = Router();

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** A "meal menu" school has phases exactly {nursery, pre_primary}. */
async function isMealMenuSchool(schoolId: string): Promise<boolean> {
  const [row] = await db.select({ phases: schools.phases }).from(schools).where(eq(schools.id, schoolId)).limit(1);
  const phases = row?.phases ?? [];
  return phases.length === 2 && phases.includes("nursery") && phases.includes("pre_primary");
}

function serialize(m: typeof dailyMenus.$inferSelect) {
  let meals: unknown = [];
  try { meals = JSON.parse(m.meals); } catch { meals = []; }
  return {
    id: m.id,
    school_id: m.schoolId,
    menu_date: m.menuDate,
    meals,
    created_at: m.createdAt?.toISOString() ?? null,
    updated_at: m.updatedAt?.toISOString() ?? null,
  };
}

/** GET /daily-menu?from=YYYY-MM-DD&to=YYYY-MM-DD — menus in date range for the requester's school */
router.get("/daily-menu", async (req, res) => {
  try {
    const schoolId = await getRequesterSchoolId(req);
    if (!schoolId) { res.status(403).json({ error: "No school context for this account" }); return; }
    const from = req.query.from as string | undefined;
    const to = req.query.to as string | undefined;

    const conds = [eq(dailyMenus.schoolId, schoolId)];
    if (from && DATE_RE.test(from)) conds.push(gte(dailyMenus.menuDate, from));
    if (to && DATE_RE.test(to)) conds.push(lte(dailyMenus.menuDate, to));

    const rows = await db
      .select()
      .from(dailyMenus)
      .where(and(...conds))
      .orderBy(asc(dailyMenus.menuDate));
    res.json(rows.map(serialize));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

/** POST /daily-menu — admin upserts the menu for a single date (one menu per school per date) */
router.post("/daily-menu", async (req, res) => {
  try {
    const admin = await requireAdmin(req);
    if (!admin) { res.status(403).json({ error: "Admin access required" }); return; }
    const schoolId = admin.schoolId!;
    if (!(await isMealMenuSchool(schoolId))) {
      res.status(403).json({ error: "Daily menu is only available for nursery/pre-primary schools" }); return;
    }
    const { menu_date, meals } = req.body ?? {};
    if (typeof menu_date !== "string" || !DATE_RE.test(menu_date)) {
      res.status(400).json({ error: "menu_date (YYYY-MM-DD) is required" }); return;
    }
    if (!Array.isArray(meals)) { res.status(400).json({ error: "meals[] is required" }); return; }

    const mealsJson = JSON.stringify(meals);
    // Atomic upsert keyed on (school_id, menu_date) — one menu per school per day.
    const [row] = await db
      .insert(dailyMenus)
      .values({ schoolId, menuDate: menu_date, meals: mealsJson, createdBy: admin.userId })
      .onConflictDoUpdate({
        target: [dailyMenus.schoolId, dailyMenus.menuDate],
        set: { meals: mealsJson, updatedAt: new Date() },
      })
      .returning();
    res.status(201).json(serialize(row));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

/** DELETE /daily-menu/:id — admin removes a day's menu (scoped to their school) */
router.delete("/daily-menu/:id", async (req, res) => {
  try {
    const admin = await requireAdmin(req);
    if (!admin) { res.status(403).json({ error: "Admin access required" }); return; }
    const { id } = req.params;
    await db
      .delete(dailyMenus)
      .where(and(eq(dailyMenus.id, id), eq(dailyMenus.schoolId, admin.schoolId!)));
    res.status(204).send();
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
