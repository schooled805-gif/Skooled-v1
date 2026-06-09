import { Router } from "express";
import { db } from "@workspace/db";
import {
  activities,
  activityProviders,
  activitySignups,
  profiles,
  students,
  parentStudentLinks,
} from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { getRequesterProfile, requireAdmin } from "../lib/scope";
import { handleRouteError } from "../lib/validation";

const router = Router();

function str(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t.length ? t : null;
}

// ── ACTIVITIES ────────────────────────────────────────────────────────────────
router.get("/activities", async (req, res) => {
  try {
    const requester = await getRequesterProfile(req);
    if (!requester || !requester.schoolId) {
      res.status(403).json({ error: "No school context for this account" });
      return;
    }
    const rows = await db
      .select({
        id: activities.id,
        name: activities.name,
        description: activities.description,
        category: activities.category,
        is_external: activities.isExternal,
        coach_teacher_id: activities.coachTeacherId,
        provider_id: activities.providerId,
        day_of_week: activities.dayOfWeek,
        start_time: activities.startTime,
        end_time: activities.endTime,
        location: activities.location,
        school_id: activities.schoolId,
        created_at: activities.createdAt,
        coach_name: profiles.fullName,
        provider_name: activityProviders.name,
      })
      .from(activities)
      .leftJoin(profiles, eq(activities.coachTeacherId, profiles.id))
      .leftJoin(activityProviders, eq(activities.providerId, activityProviders.id))
      .where(eq(activities.schoolId, requester.schoolId));
    res.json(rows);
  } catch (err) {
    handleRouteError(req, res, err);
  }
});

router.post("/activities", async (req, res) => {
  try {
    const admin = await requireAdmin(req);
    if (!admin || !admin.schoolId) {
      res.status(403).json({ error: "Admin access required" });
      return;
    }
    const name = str(req.body?.name);
    if (!name) {
      res.status(400).json({ error: "name: Activity name is required" });
      return;
    }
    const isExternal = req.body?.is_external === true;
    const [row] = await db
      .insert(activities)
      .values({
        name,
        description: str(req.body?.description),
        category: str(req.body?.category),
        isExternal,
        coachTeacherId: isExternal ? null : str(req.body?.coach_teacher_id),
        providerId: isExternal ? str(req.body?.provider_id) : null,
        dayOfWeek: str(req.body?.day_of_week),
        startTime: str(req.body?.start_time),
        endTime: str(req.body?.end_time),
        location: str(req.body?.location),
        schoolId: admin.schoolId,
      })
      .returning();
    res.status(201).json(row);
  } catch (err) {
    handleRouteError(req, res, err);
  }
});

router.patch("/activities/:id", async (req, res) => {
  try {
    const admin = await requireAdmin(req);
    if (!admin || !admin.schoolId) {
      res.status(403).json({ error: "Admin access required" });
      return;
    }
    const name = str(req.body?.name);
    if (!name) {
      res.status(400).json({ error: "name: Activity name is required" });
      return;
    }
    const isExternal = req.body?.is_external === true;
    const [row] = await db
      .update(activities)
      .set({
        name,
        description: str(req.body?.description),
        category: str(req.body?.category),
        isExternal,
        coachTeacherId: isExternal ? null : str(req.body?.coach_teacher_id),
        providerId: isExternal ? str(req.body?.provider_id) : null,
        dayOfWeek: str(req.body?.day_of_week),
        startTime: str(req.body?.start_time),
        endTime: str(req.body?.end_time),
        location: str(req.body?.location),
      })
      .where(and(eq(activities.id, req.params.id), eq(activities.schoolId, admin.schoolId)))
      .returning();
    if (!row) {
      res.status(404).json({ error: "Activity not found" });
      return;
    }
    res.json(row);
  } catch (err) {
    handleRouteError(req, res, err);
  }
});

router.delete("/activities/:id", async (req, res) => {
  try {
    const admin = await requireAdmin(req);
    if (!admin || !admin.schoolId) {
      res.status(403).json({ error: "Admin access required" });
      return;
    }
    await db.delete(activitySignups).where(and(eq(activitySignups.activityId, req.params.id), eq(activitySignups.schoolId, admin.schoolId)));
    await db
      .delete(activities)
      .where(and(eq(activities.id, req.params.id), eq(activities.schoolId, admin.schoolId)));
    res.status(204).end();
  } catch (err) {
    handleRouteError(req, res, err);
  }
});

// ── ACTIVITY PROVIDERS (external companies) ───────────────────────────────────
router.get("/activity-providers", async (req, res) => {
  try {
    const requester = await getRequesterProfile(req);
    if (!requester || !requester.schoolId) {
      res.status(403).json({ error: "No school context for this account" });
      return;
    }
    const rows = await db
      .select()
      .from(activityProviders)
      .where(eq(activityProviders.schoolId, requester.schoolId));
    res.json(
      rows.map((p) => ({
        id: p.id,
        name: p.name,
        contact_name: p.contactName,
        contact_email: p.contactEmail,
        contact_phone: p.contactPhone,
        school_id: p.schoolId,
      })),
    );
  } catch (err) {
    handleRouteError(req, res, err);
  }
});

router.post("/activity-providers", async (req, res) => {
  try {
    const admin = await requireAdmin(req);
    if (!admin || !admin.schoolId) {
      res.status(403).json({ error: "Admin access required" });
      return;
    }
    const name = str(req.body?.name);
    if (!name) {
      res.status(400).json({ error: "name: Company name is required" });
      return;
    }
    const [row] = await db
      .insert(activityProviders)
      .values({
        name,
        contactName: str(req.body?.contact_name),
        contactEmail: str(req.body?.contact_email),
        contactPhone: str(req.body?.contact_phone),
        schoolId: admin.schoolId,
      })
      .returning();
    res.status(201).json(row);
  } catch (err) {
    handleRouteError(req, res, err);
  }
});

router.delete("/activity-providers/:id", async (req, res) => {
  try {
    const admin = await requireAdmin(req);
    if (!admin || !admin.schoolId) {
      res.status(403).json({ error: "Admin access required" });
      return;
    }
    await db
      .delete(activityProviders)
      .where(and(eq(activityProviders.id, req.params.id), eq(activityProviders.schoolId, admin.schoolId)));
    res.status(204).end();
  } catch (err) {
    handleRouteError(req, res, err);
  }
});

// ── ACTIVITY SIGNUPS (a parent enrols a child) ────────────────────────────────
router.get("/activity-signups", async (req, res) => {
  try {
    const requester = await getRequesterProfile(req);
    if (!requester || !requester.schoolId) {
      res.status(403).json({ error: "No school context for this account" });
      return;
    }
    let rows = await db
      .select({
        id: activitySignups.id,
        activity_id: activitySignups.activityId,
        student_id: activitySignups.studentId,
        parent_user_id: activitySignups.parentUserId,
        status: activitySignups.status,
        created_at: activitySignups.createdAt,
        activity_name: activities.name,
        student_name: profiles.fullName,
      })
      .from(activitySignups)
      .leftJoin(activities, eq(activitySignups.activityId, activities.id))
      .leftJoin(students, eq(activitySignups.studentId, students.id))
      .leftJoin(profiles, eq(students.profileId, profiles.id))
      .where(eq(activitySignups.schoolId, requester.schoolId));

    // Role scoping: parents see only their children's signups; students their own.
    if (requester.role === "parent") {
      const links = await db
        .select({ sid: parentStudentLinks.studentId })
        .from(parentStudentLinks)
        .where(eq(parentStudentLinks.parentUserId, requester.userId));
      const allowed = new Set(links.map((l) => l.sid));
      rows = rows.filter((r) => !!r.student_id && allowed.has(r.student_id));
    } else if (requester.role === "student") {
      const [me] = await db
        .select({ id: students.id })
        .from(students)
        .where(eq(students.profileId, requester.id))
        .limit(1);
      rows = rows.filter((r) => !!me && r.student_id === me.id);
    }

    const activityId = typeof req.query.activity_id === "string" ? req.query.activity_id : null;
    const studentId = typeof req.query.student_id === "string" ? req.query.student_id : null;
    let result = rows;
    if (activityId) result = result.filter((r) => r.activity_id === activityId);
    if (studentId) result = result.filter((r) => r.student_id === studentId);
    res.json(result);
  } catch (err) {
    handleRouteError(req, res, err);
  }
});

router.post("/activity-signups", async (req, res) => {
  try {
    const requester = await getRequesterProfile(req);
    if (!requester || !requester.schoolId) {
      res.status(403).json({ error: "No school context for this account" });
      return;
    }
    const activityId = str(req.body?.activity_id);
    const studentId = str(req.body?.student_id);
    if (!activityId || !studentId) {
      res.status(400).json({ error: "Please choose both an activity and a child" });
      return;
    }
    const [act] = await db
      .select()
      .from(activities)
      .where(and(eq(activities.id, activityId), eq(activities.schoolId, requester.schoolId)))
      .limit(1);
    if (!act) {
      res.status(404).json({ error: "Activity not found" });
      return;
    }
    if (requester.role === "parent") {
      const [link] = await db
        .select()
        .from(parentStudentLinks)
        .where(
          and(
            eq(parentStudentLinks.parentUserId, requester.userId),
            eq(parentStudentLinks.studentId, studentId),
          ),
        )
        .limit(1);
      if (!link) {
        res.status(403).json({ error: "That child is not linked to your account" });
        return;
      }
    } else if (requester.role !== "admin") {
      res.status(403).json({ error: "Only a parent or admin can sign a student up" });
      return;
    }
    const [existing] = await db
      .select()
      .from(activitySignups)
      .where(
        and(
          eq(activitySignups.activityId, activityId),
          eq(activitySignups.studentId, studentId),
          eq(activitySignups.status, "active"),
        ),
      )
      .limit(1);
    if (existing) {
      res.status(409).json({ error: "This child is already signed up for that activity" });
      return;
    }
    const [row] = await db
      .insert(activitySignups)
      .values({
        activityId,
        studentId,
        parentUserId:
          requester.role === "parent" ? requester.userId : str(req.body?.parent_user_id),
        schoolId: requester.schoolId,
        status: "active",
      })
      .returning();
    res.status(201).json(row);
  } catch (err) {
    handleRouteError(req, res, err);
  }
});

router.delete("/activity-signups/:id", async (req, res) => {
  try {
    const requester = await getRequesterProfile(req);
    if (!requester || !requester.schoolId) {
      res.status(403).json({ error: "No school context for this account" });
      return;
    }
    const [row] = await db
      .select()
      .from(activitySignups)
      .where(and(eq(activitySignups.id, req.params.id), eq(activitySignups.schoolId, requester.schoolId)))
      .limit(1);
    if (!row) {
      res.status(204).end();
      return;
    }
    if (requester.role === "parent") {
      if (row.parentUserId !== requester.userId) {
        res.status(403).json({ error: "You can only cancel your own sign-ups" });
        return;
      }
    } else if (requester.role !== "admin") {
      res.status(403).json({ error: "Not allowed" });
      return;
    }
    await db.delete(activitySignups).where(eq(activitySignups.id, req.params.id));
    res.status(204).end();
  } catch (err) {
    handleRouteError(req, res, err);
  }
});

export default router;
