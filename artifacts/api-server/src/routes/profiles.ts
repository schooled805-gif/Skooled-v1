import { Router } from "express";
import { randomUUID } from "node:crypto";
import { db } from "@workspace/db";
import { profiles } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { getRequesterSchoolId, requireAdmin } from "../lib/scope";
import { normalizePhase } from "../lib/validation";
import {
  ListProfilesQueryParams,
  CreateProfileBody,
  GetProfileParams,
  UpdateProfileParams,
  UpdateProfileBody,
} from "@workspace/api-zod";
import type { Profile } from "@workspace/db";

const router = Router();

/** Convert Drizzle camelCase profile to snake_case (matching OpenAPI spec) */
function mapProfile(p: Profile) {
  return {
    id: p.id,
    user_id: p.userId,
    role: p.role,
    status: p.status ?? "approved",
    full_name: p.fullName,
    email: p.email,
    phone: p.phone ?? null,
    avatar_url: p.avatarUrl ?? null,
    school_id: p.schoolId ?? null,
    phase: p.phase ?? null,
    created_at: p.createdAt?.toISOString() ?? null,
    updated_at: p.updatedAt?.toISOString() ?? null,
  };
}

router.get("/profiles/me", async (req, res) => {
  try {
    const userId = req.headers["x-user-id"] as string;
    const userEmail = req.headers["x-user-email"] as string | undefined;
    if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

    let [profile] = await db.select().from(profiles).where(eq(profiles.userId, userId)).limit(1);

    // Email-based fallback: when a teacher/student is invited by admin, their profile
    // has a placeholder userId. On first login, link the real Supabase userId.
    if (!profile && userEmail) {
      const [byEmail] = await db.select().from(profiles).where(eq(profiles.email, userEmail.toLowerCase())).limit(1);
      if (byEmail) {
        const [updated] = await db.update(profiles).set({ userId, updatedAt: new Date() }).where(eq(profiles.id, byEmail.id)).returning();
        profile = updated;
      }
    }

    if (!profile) { res.status(404).json({ error: "Profile not found" }); return; }
    res.json(mapProfile(profile));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * GET /api/profiles/email-exists?email=... — public pre-flight check used by the
 * signup form so it can reject an already-registered email with a clear message
 * BEFORE creating a Supabase auth user (which would otherwise be orphaned).
 * Must be declared before "/profiles/:id" so it isn't captured as an id.
 */
router.get("/profiles/email-exists", async (req, res) => {
  try {
    const email = (req.query.email as string | undefined)?.trim().toLowerCase();
    if (!email) { res.status(400).json({ error: "email is required" }); return; }
    const [existing] = await db
      .select({ id: profiles.id })
      .from(profiles)
      .where(eq(profiles.email, email))
      .limit(1);
    res.json({ exists: !!existing });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/profiles", async (req, res) => {
  try {
    const query = ListProfilesQueryParams.parse(req.query);
    const schoolId = await getRequesterSchoolId(req);
    if (!schoolId) { res.status(403).json({ error: "No school context for this account" }); return; }

    let rows = await db.select().from(profiles).where(eq(profiles.schoolId, schoolId));
    if (query.role) rows = rows.filter(p => p.role === query.role);
    res.json(rows.map(mapProfile));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/profiles", async (req, res) => {
  try {
    const body = CreateProfileBody.parse(req.body);

    // Invite-only roles: teachers are created exclusively by a school admin via
    // POST /teachers/invite. This endpoint is public (used during signup), so we
    // must reject self-registration of a teacher here — the UI hiding the option
    // is not a security control.
    if (body.role === "teacher") {
      res.status(403).json({
        error: "Teacher accounts are created by your school administrator. Please ask them to invite you.",
      });
      return;
    }

    // Check for duplicate email
    const [existing] = await db
      .select({ id: profiles.id })
      .from(profiles)
      .where(eq(profiles.email, body.email.toLowerCase().trim()))
      .limit(1);

    if (existing) {
      res.status(409).json({ error: "An account with this email address already exists." });
      return;
    }

    // Check for duplicate userId
    const [existingUser] = await db
      .select({ id: profiles.id })
      .from(profiles)
      .where(eq(profiles.userId, body.user_id))
      .limit(1);

    if (existingUser) {
      res.status(409).json({ error: "A profile for this user already exists." });
      return;
    }

    // Admins and parents are auto-approved.
    // Teachers who self-register are pending until an admin approves them.
    const status = (body.role === "admin" || body.role === "parent" || body.role === "student")
      ? "approved"
      : "pending";

    // If no user_id is provided, generate a placeholder so the admin can
    // create profiles for users before they log in for the first time.
    const userId = body.user_id?.trim() || randomUUID();

    const [profile] = await db.insert(profiles).values({
      userId,
      role: body.role,
      status,
      fullName: body.full_name,
      email: body.email.toLowerCase().trim(),
      phone: body.phone ?? null,
      avatarUrl: body.avatar_url ?? null,
      schoolId: body.school_id,
      phase: normalizePhase(req.body?.phase),
    }).returning();
    res.status(201).json(mapProfile(profile));
  } catch (err: any) {
    req.log.error(err);
    if (err?.code === "23505") {
      if (err?.constraint?.includes("email")) {
        res.status(409).json({ error: "An account with this email address already exists." });
        return;
      }
      if (err?.constraint?.includes("user_id")) {
        res.status(409).json({ error: "A profile for this user already exists." });
        return;
      }
    }
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/profiles/:id", async (req, res) => {
  try {
    const { id } = GetProfileParams.parse(req.params);
    const [profile] = await db.select().from(profiles).where(eq(profiles.id, id)).limit(1);
    if (!profile) { res.status(404).json({ error: "Not found" }); return; }
    res.json(mapProfile(profile));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

/** GET /api/profiles/pending?school_id=... — pending member requests for admin */
router.get("/profiles/pending", async (req, res) => {
  try {
    const schoolId = req.query.school_id as string | undefined;
    if (!schoolId) { res.status(400).json({ error: "school_id required" }); return; }
    const rows = await db.select().from(profiles).where(
      and(eq(profiles.schoolId, schoolId), eq(profiles.status, "pending")),
    );
    res.json(rows.map(mapProfile));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * PATCH /api/profiles/:id/status — approve/reject a pending member, or
 * disable/re-enable an existing one. A disabled profile keeps its data but is
 * blocked from signing in (the web app gates on this status). Tenant-scoped:
 * an admin may only change profiles within their own school.
 */
router.patch("/profiles/:id/status", async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body as { status: string };
    if (!["approved", "rejected", "disabled"].includes(status)) {
      res.status(400).json({ error: "status must be approved, rejected or disabled" }); return;
    }
    const admin = await requireAdmin(req);
    if (!admin) { res.status(403).json({ error: "Admin access required" }); return; }

    const [target] = await db.select().from(profiles).where(eq(profiles.id, id)).limit(1);
    if (!target) { res.status(404).json({ error: "Not found" }); return; }
    if (target.schoolId !== admin.schoolId) { res.status(403).json({ error: "Forbidden" }); return; }
    if (target.id === admin.id) { res.status(400).json({ error: "You cannot change your own account status" }); return; }

    const [profile] = await db.update(profiles)
      .set({ status, updatedAt: new Date() })
      .where(eq(profiles.id, id))
      .returning();
    res.json(mapProfile(profile));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

/** DELETE /api/profiles/:id — permanently remove a profile (tenant-scoped). */
router.delete("/profiles/:id", async (req, res) => {
  try {
    const { id } = GetProfileParams.parse(req.params);
    const admin = await requireAdmin(req);
    if (!admin) { res.status(403).json({ error: "Admin access required" }); return; }

    const [target] = await db.select().from(profiles).where(eq(profiles.id, id)).limit(1);
    if (!target) { res.status(204).send(); return; }
    if (target.schoolId !== admin.schoolId) { res.status(403).json({ error: "Forbidden" }); return; }
    if (target.id === admin.id) { res.status(400).json({ error: "You cannot remove your own account" }); return; }

    await db.delete(profiles).where(eq(profiles.id, id));
    res.status(204).send();
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/profiles/:id", async (req, res) => {
  try {
    const { id } = UpdateProfileParams.parse(req.params);
    const body = UpdateProfileBody.parse(req.body);
    const [profile] = await db.update(profiles).set({
      fullName: body.full_name,
      phone: body.phone,
      avatarUrl: body.avatar_url,
      updatedAt: new Date(),
    }).where(eq(profiles.id, id)).returning();
    if (!profile) { res.status(404).json({ error: "Not found" }); return; }
    res.json(mapProfile(profile));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/profiles/me/push-token", async (req, res) => {
  try {
    const userId = req.headers["x-user-id"] as string;
    if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }
    const push_token: string | null = req.body?.push_token ?? null;
    if (push_token !== null && typeof push_token !== "string") {
      res.status(400).json({ error: "push_token must be a string or null" });
      return;
    }
    const [profile] = await db
      .update(profiles)
      .set({ pushToken: push_token, updatedAt: new Date() })
      .where(eq(profiles.userId, userId))
      .returning();
    if (!profile) { res.status(404).json({ error: "Profile not found" }); return; }
    res.json({ ok: true });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
