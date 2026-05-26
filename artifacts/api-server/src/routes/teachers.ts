import { Router } from "express";
import { db } from "@workspace/db";
import { profiles } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

router.post("/teachers/invite", async (req, res) => {
  try {
    const { full_name, email, phone, school_id } = req.body;

    if (!full_name?.trim() || !email?.trim()) {
      res.status(400).json({ error: "full_name and email are required" });
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Check if profile already exists
    const [existing] = await db.select({ id: profiles.id }).from(profiles).where(eq(profiles.email, normalizedEmail)).limit(1);
    if (existing) {
      res.status(409).json({ error: "A teacher with this email already exists" });
      return;
    }

    // Create profile with placeholder userId (linked on first login via email)
    const placeholderUserId = crypto.randomUUID();
    const [profile] = await db.insert(profiles).values({
      userId: placeholderUserId,
      role: "teacher",
      fullName: full_name.trim(),
      email: normalizedEmail,
      phone: phone?.trim() || null,
      schoolId: school_id || null,
    }).returning();

    // Try to send Supabase invite email via admin API
    let invited = false;
    const supabaseUrl = process.env["SUPABASE_URL"];
    const serviceKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];
    if (supabaseUrl && serviceKey) {
      try {
        const inviteRes = await fetch(`${supabaseUrl}/auth/v1/invite`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${serviceKey}`,
            "apikey": serviceKey,
          },
          body: JSON.stringify({ email: normalizedEmail, data: { full_name: full_name.trim() } }),
        });
        invited = inviteRes.ok;
      } catch {}
    }

    res.status(201).json({
      profile: {
        id: profile.id,
        user_id: profile.userId,
        role: profile.role,
        full_name: profile.fullName,
        email: profile.email,
        phone: profile.phone ?? null,
        school_id: profile.schoolId ?? null,
        created_at: profile.createdAt?.toISOString() ?? null,
      },
      invited,
    });
  } catch (err: any) {
    req.log.error(err);
    if (err?.code === "23505") {
      res.status(409).json({ error: "A teacher with this email already exists" });
    } else {
      res.status(500).json({ error: "Internal server error" });
    }
  }
});

export default router;
