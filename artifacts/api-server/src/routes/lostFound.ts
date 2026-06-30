import { Router } from "express";
import { db } from "@workspace/db";
import { lostFoundItems, profiles, messages, students } from "@workspace/db";
import { and, eq, desc } from "drizzle-orm";
import { getRequesterProfile, isStudentLinkedToParent } from "../lib/scope";
import { sendPushNotifications } from "../lib/pushNotifications";

const router = Router();

/** GET /api/lost-found — every member of the school can browse items. */
router.get("/lost-found", async (req, res) => {
  try {
    const requester = await getRequesterProfile(req);
    if (!requester?.schoolId) { res.status(403).json({ error: "No school context for this account" }); return; }
    const rows = await db.select()
      .from(lostFoundItems)
      .where(eq(lostFoundItems.schoolId, requester.schoolId))
      .orderBy(desc(lostFoundItems.createdAt));
    res.json(rows.map((r) => ({
      id: r.id,
      school_id: r.schoolId,
      title: r.title,
      description: r.description,
      category: r.category,
      photo_url: r.photoUrl,
      status: r.status,
      location_found: r.locationFound,
      posted_by_user_id: r.postedByUserId,
      posted_by_name: r.postedByName,
      claimed_by_user_id: r.claimedByUserId,
      claimed_by_name: r.claimedByName,
      claimed_student_id: r.claimedStudentId,
      claim_note: r.claimNote,
      claimed_at: r.claimedAt,
      created_at: r.createdAt,
    })));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

/** POST /api/lost-found — admins and teachers post a found item. */
router.post("/lost-found", async (req, res) => {
  try {
    const requester = await getRequesterProfile(req);
    if (!requester?.schoolId) { res.status(403).json({ error: "No school context for this account" }); return; }
    if (requester.role !== "admin" && requester.role !== "teacher") {
      res.status(403).json({ error: "Only staff can post lost & found items" }); return;
    }
    const { title, description, category, photo_url, location_found } = req.body ?? {};
    if (!title?.trim()) { res.status(400).json({ error: "title is required" }); return; }
    const [item] = await db.insert(lostFoundItems).values({
      schoolId: requester.schoolId,
      title: title.trim(),
      description: description?.trim() || null,
      category: category?.trim() || null,
      photoUrl: photo_url?.trim() || null,
      locationFound: location_found?.trim() || null,
      status: "open",
      postedByUserId: requester.userId,
      postedByName: requester.fullName,
    }).returning();
    res.status(201).json({
      id: item.id,
      school_id: item.schoolId,
      title: item.title,
      description: item.description,
      category: item.category,
      photo_url: item.photoUrl,
      status: item.status,
      location_found: item.locationFound,
      posted_by_user_id: item.postedByUserId,
      posted_by_name: item.postedByName,
      claimed_by_user_id: item.claimedByUserId,
      claimed_by_name: item.claimedByName,
      claimed_student_id: item.claimedStudentId,
      claim_note: item.claimNote,
      claimed_at: item.claimedAt,
      created_at: item.createdAt,
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

/** POST /api/lost-found/:id/claim — a parent claims an item for their child. */
router.post("/lost-found/:id/claim", async (req, res) => {
  try {
    const requester = await getRequesterProfile(req);
    if (!requester?.schoolId) { res.status(403).json({ error: "No school context for this account" }); return; }
    if (requester.role !== "parent") { res.status(403).json({ error: "Only parents can claim items" }); return; }
    const { id } = req.params;
    const { claimed_student_id, claim_note } = req.body ?? {};

    const [existing] = await db.select().from(lostFoundItems)
      .where(and(eq(lostFoundItems.id, id), eq(lostFoundItems.schoolId, requester.schoolId))).limit(1);
    if (!existing) { res.status(404).json({ error: "Not found" }); return; }
    if (existing.status !== "open") { res.status(409).json({ error: "This item has already been claimed" }); return; }

    let studentName: string | null = null;
    if (claimed_student_id) {
      // A parent may only claim on behalf of a child linked to them.
      const linked = await isStudentLinkedToParent(requester.schoolId, requester.userId, claimed_student_id);
      if (!linked) { res.status(403).json({ error: "That child is not linked to your account" }); return; }
      const [s] = await db.select({ name: profiles.fullName })
        .from(students)
        .leftJoin(profiles, eq(students.profileId, profiles.id))
        .where(and(eq(students.id, claimed_student_id), eq(students.schoolId, requester.schoolId)))
        .limit(1);
      studentName = s?.name ?? null;
    }

    const [item] = await db.update(lostFoundItems).set({
      status: "claimed",
      claimedByUserId: requester.userId,
      claimedByName: requester.fullName,
      claimedStudentId: claimed_student_id || null,
      claimNote: claim_note?.trim() || null,
      claimedAt: new Date().toISOString(),
      updatedAt: new Date(),
    }).where(eq(lostFoundItems.id, id)).returning();

    // Notify all admins of the school (in-app message + push), fire-and-forget.
    setImmediate(async () => {
      try {
        const admins = await db.select({ userId: profiles.userId, pushToken: profiles.pushToken })
          .from(profiles)
          .where(and(eq(profiles.schoolId, requester.schoolId!), eq(profiles.role, "admin")));
        const body = `${requester.fullName} claimed the lost & found item "${existing.title}"${studentName ? ` for ${studentName}` : ""}.${claim_note ? ` Note: ${claim_note}` : ""}`;
        const tokens: string[] = [];
        for (const a of admins) {
          await db.insert(messages).values({
            senderId: requester.userId,
            recipientId: a.userId,
            body,
            schoolId: requester.schoolId!,
          });
          if (a.pushToken) tokens.push(a.pushToken);
        }
        if (tokens.length) {
          await sendPushNotifications(tokens, {
            title: "🧥 Lost & Found claim",
            body,
            data: { type: "lost_found", id: item.id },
          });
        }
      } catch {
        // Non-fatal
      }
    });

    res.json({
      id: item.id,
      school_id: item.schoolId,
      title: item.title,
      description: item.description,
      category: item.category,
      photo_url: item.photoUrl,
      status: item.status,
      location_found: item.locationFound,
      posted_by_user_id: item.postedByUserId,
      posted_by_name: item.postedByName,
      claimed_by_user_id: item.claimedByUserId,
      claimed_by_name: item.claimedByName,
      claimed_student_id: item.claimedStudentId,
      claim_note: item.claimNote,
      claimed_at: item.claimedAt,
      created_at: item.createdAt,
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

/** PATCH /api/lost-found/:id — staff update status (resolve / reopen). */
router.patch("/lost-found/:id", async (req, res) => {
  try {
    const requester = await getRequesterProfile(req);
    if (!requester?.schoolId) { res.status(403).json({ error: "No school context for this account" }); return; }
    if (requester.role !== "admin" && requester.role !== "teacher") {
      res.status(403).json({ error: "Only staff can update items" }); return;
    }
    const { id } = req.params;
    const { status } = req.body ?? {};
    if (!["open", "claimed", "resolved"].includes(status)) {
      res.status(400).json({ error: "status must be open, claimed or resolved" }); return;
    }
    const [item] = await db.update(lostFoundItems)
      .set({ status, updatedAt: new Date() })
      .where(and(eq(lostFoundItems.id, id), eq(lostFoundItems.schoolId, requester.schoolId)))
      .returning();
    if (!item) { res.status(404).json({ error: "Not found" }); return; }
    res.json({ id: item.id, status: item.status });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

/** DELETE /api/lost-found/:id — staff remove an item. */
router.delete("/lost-found/:id", async (req, res) => {
  try {
    const requester = await getRequesterProfile(req);
    if (!requester?.schoolId) { res.status(403).json({ error: "No school context for this account" }); return; }
    if (requester.role !== "admin" && requester.role !== "teacher") {
      res.status(403).json({ error: "Only staff can remove items" }); return;
    }
    const { id } = req.params;
    const deleted = await db.delete(lostFoundItems)
      .where(and(eq(lostFoundItems.id, id), eq(lostFoundItems.schoolId, requester.schoolId)))
      .returning();
    if (deleted.length === 0) { res.status(404).json({ error: "Not found" }); return; }
    res.status(204).send();
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
