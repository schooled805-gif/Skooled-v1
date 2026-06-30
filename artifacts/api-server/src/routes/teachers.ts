import { Router } from "express";
import { randomUUID } from "node:crypto";
import { db } from "@workspace/db";
import { profiles } from "@workspace/db";
import { eq } from "drizzle-orm";
import { normalizePhase } from "../lib/validation";

const router = Router();

router.post("/teachers/invite", async (req, res) => {
  try {
    const { full_name, email, phone, school_id, phase } = req.body;
    const normalizedPhase = normalizePhase(phase);

    if (!full_name?.trim() || !email?.trim()) {
      res.status(400).json({ error: "full_name and email are required" });
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();

    const [existing] = await db.select({ id: profiles.id }).from(profiles).where(eq(profiles.email, normalizedEmail)).limit(1);
    if (existing) {
      res.status(409).json({ error: "A teacher with this email already exists" });
      return;
    }

    // Send the Supabase invite email FIRST so we can link the teacher's profile
    // to the real Supabase user id it returns. This way the teacher is matched by
    // user_id on their very first login and is never pushed into the
    // "create account" flow. Falls back to a placeholder id (claimed later by the
    // email-based fallback in /profiles/me) when the invite can't be sent.
    let invited = false;
    let invitedUserId: string | null = null;
    const supabaseUrl = process.env["SUPABASE_URL"] ?? process.env["VITE_SUPABASE_URL"];
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
          body: JSON.stringify({
            email: normalizedEmail,
            data: { full_name: full_name.trim(), role: "teacher" },
          }),
        });
        invited = inviteRes.ok;
        if (inviteRes.ok) {
          const inviteData: any = await inviteRes.json().catch(() => ({}));
          if (typeof inviteData?.id === "string" && inviteData.id) {
            invitedUserId = inviteData.id;
          }
        } else {
          const errBody = await inviteRes.json().catch(() => ({}));
          req.log.warn({ status: inviteRes.status, body: errBody }, "Supabase invite failed");
        }
      } catch (e) {
        req.log.warn(e, "Supabase invite fetch error");
      }
    }

    const [profile] = await db.insert(profiles).values({
      userId: invitedUserId ?? randomUUID(),
      role: "teacher",
      fullName: full_name.trim(),
      email: normalizedEmail,
      phone: phone?.trim() || null,
      schoolId: school_id || null,
      phase: normalizedPhase,
      // Teachers are invited with a temporary password and must set their own on
      // first login (F7). The web app gates on this flag and forces a change.
      mustChangePassword: true,
    }).returning();

    res.status(201).json({
      profile: {
        id: profile.id,
        user_id: profile.userId,
        role: profile.role,
        full_name: profile.fullName,
        email: profile.email,
        phone: profile.phone ?? null,
        school_id: profile.schoolId ?? null,
        phase: profile.phase ?? null,
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
