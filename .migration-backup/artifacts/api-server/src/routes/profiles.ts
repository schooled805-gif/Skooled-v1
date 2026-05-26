import { Router } from "express";
import { db } from "@workspace/db";
import { profiles } from "@workspace/db";
import { eq } from "drizzle-orm";
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
    full_name: p.fullName,
    email: p.email,
    phone: p.phone ?? null,
    avatar_url: p.avatarUrl ?? null,
    school_id: p.schoolId ?? null,
    created_at: p.createdAt?.toISOString() ?? null,
    updated_at: p.updatedAt?.toISOString() ?? null,
  };
}

router.get("/profiles/me", async (req, res) => {
  try {
    const userId = req.headers["x-user-id"] as string;
    if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }
    const [profile] = await db.select().from(profiles).where(eq(profiles.userId, userId)).limit(1);
    if (!profile) { res.status(404).json({ error: "Profile not found" }); return; }
    res.json(mapProfile(profile));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/profiles", async (req, res) => {
  try {
    const query = ListProfilesQueryParams.parse(req.query);
    let rows = await db.select().from(profiles);
    if (query.role) rows = rows.filter(p => p.role === query.role);
    if (query.school_id) rows = rows.filter(p => p.schoolId === query.school_id);
    res.json(rows.map(mapProfile));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/profiles", async (req, res) => {
  try {
    const body = CreateProfileBody.parse(req.body);

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

    const [profile] = await db.insert(profiles).values({
      userId: body.user_id,
      role: body.role,
      fullName: body.full_name,
      email: body.email.toLowerCase().trim(),
      phone: body.phone ?? null,
      avatarUrl: body.avatar_url ?? null,
      schoolId: body.school_id,
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

router.delete("/profiles/:id", async (req, res) => {
  try {
    const { id } = GetProfileParams.parse(req.params);
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

export default router;
