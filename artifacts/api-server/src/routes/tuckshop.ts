import { Router } from "express";
import { db } from "@workspace/db";
import {
  tuckshopAccounts,
  tuckshopMenus,
  tuckshopOrders,
  tuckshopTransactions,
  students,
  profiles,
} from "@workspace/db";
import { eq, desc, and } from "drizzle-orm";

const router = Router();

// ── helpers ──────────────────────────────────────────────────────────────────

function centsToDisplay(cents: number) {
  return (cents / 100).toFixed(2);
}

async function getOrCreateAccount(studentId: string, schoolId: string) {
  const [existing] = await db
    .select()
    .from(tuckshopAccounts)
    .where(eq(tuckshopAccounts.studentId, studentId))
    .limit(1);
  if (existing) return existing;
  const [created] = await db
    .insert(tuckshopAccounts)
    .values({ studentId, schoolId, balanceCents: 0 })
    .returning();
  return created;
}

// ── ACCOUNTS ─────────────────────────────────────────────────────────────────

/** GET /tuckshop/account?student_id=... */
router.get("/tuckshop/account", async (req, res) => {
  try {
    const studentId = req.query.student_id as string;
    if (!studentId) { res.status(400).json({ error: "student_id required" }); return; }

    const [student] = await db.select().from(students).where(eq(students.id, studentId)).limit(1);
    if (!student) { res.status(404).json({ error: "Student not found" }); return; }

    const account = await getOrCreateAccount(studentId, student.schoolId);
    const [profile] = await db.select().from(profiles).where(eq(profiles.id, student.profileId)).limit(1);

    res.json({
      id: account.id,
      student_id: account.studentId,
      student_name: profile?.fullName ?? null,
      school_id: account.schoolId,
      balance_cents: account.balanceCents,
      balance_display: centsToDisplay(account.balanceCents),
      updated_at: account.updatedAt?.toISOString() ?? null,
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

/** GET /tuckshop/accounts?school_id=... — admin: list all accounts */
router.get("/tuckshop/accounts", async (req, res) => {
  try {
    const schoolId = req.query.school_id as string;
    if (!schoolId) { res.status(400).json({ error: "school_id required" }); return; }

    const accounts = await db
      .select()
      .from(tuckshopAccounts)
      .where(eq(tuckshopAccounts.schoolId, schoolId));

    const enriched = await Promise.all(accounts.map(async (acc) => {
      const [student] = await db.select().from(students).where(eq(students.id, acc.studentId)).limit(1);
      let name: string | null = null;
      if (student) {
        const [prof] = await db.select().from(profiles).where(eq(profiles.id, student.profileId)).limit(1);
        name = prof?.fullName ?? null;
      }
      return {
        id: acc.id,
        student_id: acc.studentId,
        student_name: name,
        balance_cents: acc.balanceCents,
        balance_display: centsToDisplay(acc.balanceCents),
        updated_at: acc.updatedAt?.toISOString() ?? null,
      };
    }));

    res.json(enriched);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

/** POST /tuckshop/topup — admin credits a student account */
router.post("/tuckshop/topup", async (req, res) => {
  try {
    const { student_id, amount_cents, description } = req.body;
    if (!student_id || !amount_cents || amount_cents <= 0) {
      res.status(400).json({ error: "student_id and amount_cents (>0) required" }); return;
    }

    const [student] = await db.select().from(students).where(eq(students.id, student_id)).limit(1);
    if (!student) { res.status(404).json({ error: "Student not found" }); return; }

    const account = await getOrCreateAccount(student_id, student.schoolId);

    const newBalance = account.balanceCents + Number(amount_cents);
    const [updated] = await db
      .update(tuckshopAccounts)
      .set({ balanceCents: newBalance, updatedAt: new Date() })
      .where(eq(tuckshopAccounts.id, account.id))
      .returning();

    await db.insert(tuckshopTransactions).values({
      accountId: account.id,
      amountCents: Number(amount_cents),
      type: "topup",
      description: description ?? "Manual top-up",
    });

    res.json({
      account_id: updated.id,
      student_id: updated.studentId,
      balance_cents: updated.balanceCents,
      balance_display: centsToDisplay(updated.balanceCents),
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── MENUS ────────────────────────────────────────────────────────────────────

/** GET /tuckshop/menu?school_id=... — get latest published menu */
router.get("/tuckshop/menu", async (req, res) => {
  try {
    const schoolId = req.query.school_id as string;
    if (!schoolId) { res.status(400).json({ error: "school_id required" }); return; }

    const [menu] = await db
      .select()
      .from(tuckshopMenus)
      .where(eq(tuckshopMenus.schoolId, schoolId))
      .orderBy(desc(tuckshopMenus.createdAt))
      .limit(1);

    if (!menu) { res.json(null); return; }

    res.json({
      id: menu.id,
      school_id: menu.schoolId,
      week_label: menu.weekLabel,
      items: JSON.parse(menu.items),
      published_at: menu.publishedAt?.toISOString() ?? null,
      created_at: menu.createdAt?.toISOString() ?? null,
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

/** GET /tuckshop/menus?school_id=... — list all menus */
router.get("/tuckshop/menus", async (req, res) => {
  try {
    const schoolId = req.query.school_id as string;
    if (!schoolId) { res.status(400).json({ error: "school_id required" }); return; }
    const menus = await db
      .select()
      .from(tuckshopMenus)
      .where(eq(tuckshopMenus.schoolId, schoolId))
      .orderBy(desc(tuckshopMenus.createdAt));
    res.json(menus.map(m => ({
      id: m.id,
      school_id: m.schoolId,
      week_label: m.weekLabel,
      items: JSON.parse(m.items),
      published_at: m.publishedAt?.toISOString() ?? null,
      created_at: m.createdAt?.toISOString() ?? null,
    })));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

/** POST /tuckshop/menu — admin publishes a menu */
router.post("/tuckshop/menu", async (req, res) => {
  try {
    const userId = req.headers["x-user-id"] as string;
    const { school_id, week_label, items } = req.body;
    if (!school_id || !week_label || !Array.isArray(items)) {
      res.status(400).json({ error: "school_id, week_label and items[] required" }); return;
    }
    const [menu] = await db.insert(tuckshopMenus).values({
      schoolId: school_id,
      weekLabel: week_label,
      items: JSON.stringify(items),
      createdBy: userId ?? null,
      publishedAt: new Date(),
    }).returning();
    res.status(201).json({
      id: menu.id,
      school_id: menu.schoolId,
      week_label: menu.weekLabel,
      items: JSON.parse(menu.items),
      published_at: menu.publishedAt?.toISOString() ?? null,
      created_at: menu.createdAt?.toISOString() ?? null,
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

/** PATCH /tuckshop/menu/:id — admin updates a menu */
router.patch("/tuckshop/menu/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { week_label, items } = req.body;
    const updateData: Record<string, unknown> = {};
    if (week_label) updateData.weekLabel = week_label;
    if (Array.isArray(items)) updateData.items = JSON.stringify(items);
    const [menu] = await db.update(tuckshopMenus).set(updateData).where(eq(tuckshopMenus.id, id)).returning();
    if (!menu) { res.status(404).json({ error: "Not found" }); return; }
    res.json({
      id: menu.id,
      school_id: menu.schoolId,
      week_label: menu.weekLabel,
      items: JSON.parse(menu.items),
      published_at: menu.publishedAt?.toISOString() ?? null,
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── ORDERS ────────────────────────────────────────────────────────────────────

/** GET /tuckshop/orders?school_id=...&student_id=... */
router.get("/tuckshop/orders", async (req, res) => {
  try {
    const { school_id, student_id } = req.query as Record<string, string>;
    let rows = await db
      .select()
      .from(tuckshopOrders)
      .orderBy(desc(tuckshopOrders.createdAt));
    if (school_id) rows = rows.filter(o => o.schoolId === school_id);
    if (student_id) rows = rows.filter(o => o.studentId === student_id);
    res.json(rows.map(o => ({
      id: o.id,
      student_id: o.studentId,
      school_id: o.schoolId,
      parent_user_id: o.parentUserId,
      items: JSON.parse(o.items),
      total_cents: o.totalCents,
      total_display: centsToDisplay(o.totalCents),
      status: o.status,
      order_date: o.orderDate,
      created_at: o.createdAt?.toISOString() ?? null,
    })));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

/** POST /tuckshop/orders — place an order */
router.post("/tuckshop/orders", async (req, res) => {
  try {
    const { student_id, school_id, parent_user_id, items, total_cents, order_date } = req.body;
    if (!student_id || !school_id || !Array.isArray(items) || !total_cents) {
      res.status(400).json({ error: "student_id, school_id, items[], total_cents required" }); return;
    }
    const totalCents = Number(total_cents);

    // Check / deduct balance
    const account = await getOrCreateAccount(student_id, school_id);
    if (account.balanceCents < totalCents) {
      res.status(402).json({
        error: "Insufficient balance",
        balance_cents: account.balanceCents,
        balance_display: centsToDisplay(account.balanceCents),
        required_display: centsToDisplay(totalCents),
      });
      return;
    }

    const [order] = await db.insert(tuckshopOrders).values({
      studentId: student_id,
      schoolId: school_id,
      parentUserId: parent_user_id ?? null,
      items: JSON.stringify(items),
      totalCents,
      status: "pending",
      orderDate: order_date ?? new Date().toISOString().split("T")[0],
    }).returning();

    // Deduct balance
    const newBalance = account.balanceCents - totalCents;
    await db.update(tuckshopAccounts).set({ balanceCents: newBalance, updatedAt: new Date() }).where(eq(tuckshopAccounts.id, account.id));
    await db.insert(tuckshopTransactions).values({
      accountId: account.id,
      amountCents: -totalCents,
      type: "order",
      description: `Order #${order.id.slice(0, 8)}`,
      referenceId: order.id,
    });

    res.status(201).json({
      id: order.id,
      student_id: order.studentId,
      items: JSON.parse(order.items),
      total_cents: order.totalCents,
      total_display: centsToDisplay(order.totalCents),
      status: order.status,
      new_balance_cents: newBalance,
      new_balance_display: centsToDisplay(newBalance),
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

/** PATCH /tuckshop/orders/:id — update order status */
router.patch("/tuckshop/orders/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    if (!status) { res.status(400).json({ error: "status required" }); return; }
    const [order] = await db.update(tuckshopOrders).set({ status, updatedAt: new Date() }).where(eq(tuckshopOrders.id, id)).returning();
    if (!order) { res.status(404).json({ error: "Not found" }); return; }
    res.json({ id: order.id, status: order.status });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

/** GET /tuckshop/transactions?account_id=... */
router.get("/tuckshop/transactions", async (req, res) => {
  try {
    const accountId = req.query.account_id as string;
    if (!accountId) { res.status(400).json({ error: "account_id required" }); return; }
    const txns = await db
      .select()
      .from(tuckshopTransactions)
      .where(eq(tuckshopTransactions.accountId, accountId))
      .orderBy(desc(tuckshopTransactions.createdAt));
    res.json(txns.map(t => ({
      id: t.id,
      account_id: t.accountId,
      amount_cents: t.amountCents,
      amount_display: (t.amountCents >= 0 ? "+" : "") + centsToDisplay(t.amountCents),
      type: t.type,
      description: t.description,
      created_at: t.createdAt?.toISOString() ?? null,
    })));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
