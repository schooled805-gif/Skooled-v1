import { Router } from "express";
import { db } from "@workspace/db";
import { announcements, profiles } from "@workspace/db";
import { and, eq, isNotNull } from "drizzle-orm";
import { getRequesterSchoolId } from "../lib/scope";
import {
  ListAnnouncementsQueryParams,
  CreateAnnouncementBody,
} from "@workspace/api-zod";
import { sendPushNotifications } from "../lib/pushNotifications";

const router = Router();

router.get("/announcements", async (req, res) => {
  try {
    const query = ListAnnouncementsQueryParams.parse(req.query);
    const schoolId = await getRequesterSchoolId(req);
    if (!schoolId) { res.status(403).json({ error: "No school context for this account" }); return; }

    const rows = await db.select({
      id: announcements.id,
      title: announcements.title,
      body: announcements.body,
      audience_type: announcements.audienceType,
      priority: announcements.priority,
      attachment_url: announcements.attachmentUrl,
      publish_at: announcements.publishAt,
      expires_at: announcements.expiresAt,
      school_id: announcements.schoolId,
      author_name: profiles.fullName,
      created_at: announcements.createdAt,
    }).from(announcements)
      .leftJoin(profiles, eq(announcements.authorId, profiles.userId))
      .where(eq(announcements.schoolId, schoolId));

    const now = Date.now();
    // Hide announcements whose expiry date has passed.
    let result = rows.filter(a => !a.expires_at || new Date(a.expires_at as unknown as string).getTime() >= now);
    if (query.audience_type) {
      result = result.filter(a => a.audience_type === query.audience_type || a.audience_type === "all");
    }
    res.json(result);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/announcements", async (req, res) => {
  try {
    const body = CreateAnnouncementBody.parse(req.body);
    const userId = req.headers["x-user-id"] as string;
    const [announcement] = await db.insert(announcements).values({
      title: body.title,
      body: body.body,
      audienceType: body.audience_type,
      priority: body.priority ?? null,
      attachmentUrl: body.attachment_url ?? null,
      publishAt: body.publish_at ?? null,
      expiresAt: body.expires_at ?? null,
      schoolId: body.school_id,
      authorId: userId ?? null,
    }).returning();

    // Send push notifications only for high-priority announcements (fire-and-forget)
    const isHighPriority = body.priority === "high" || body.priority === "urgent";
    if (isHighPriority) {
      setImmediate(async () => {
        try {
          const audienceType = body.audience_type;
          const rows = await db
            .select({ pushToken: profiles.pushToken, role: profiles.role })
            .from(profiles)
            .where(
              and(
                isNotNull(profiles.pushToken),
                eq(profiles.schoolId, body.school_id),
              ),
            );

          const tokens = rows
            .filter((r) => {
              if (!r.pushToken) return false;
              if (audienceType === "all") return true;
              return r.role === audienceType;
            })
            .map((r) => r.pushToken as string);

          if (tokens.length > 0) {
            await sendPushNotifications(tokens, {
              title: `📢 ${body.title}`,
              body: body.body.length > 120 ? body.body.slice(0, 117) + "…" : body.body,
              data: { type: "announcement", id: announcement.id },
            });
          }
        } catch {
          // Non-fatal
        }
      });
    }

    res.status(201).json({ ...announcement, author_name: null });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
