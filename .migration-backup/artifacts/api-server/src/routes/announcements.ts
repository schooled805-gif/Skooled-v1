import { Router } from "express";
import { db } from "@workspace/db";
import { announcements, profiles } from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  ListAnnouncementsQueryParams,
  CreateAnnouncementBody,
} from "@workspace/api-zod";

const router = Router();

router.get("/announcements", async (req, res) => {
  try {
    const query = ListAnnouncementsQueryParams.parse(req.query);
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
      .leftJoin(profiles, eq(announcements.authorId, profiles.userId));

    let result = rows;
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
    res.status(201).json({ ...announcement, author_name: null });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
