import { Router } from "express";
import { db } from "@workspace/db";
import { students, profiles, classes, approvals, messages, events, announcements } from "@workspace/db";
import { and, eq, isNull } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { getRequesterSchoolId } from "../lib/scope";

const router = Router();

router.get("/dashboard/summary", async (req, res) => {
  try {
    const schoolId = await getRequesterSchoolId(req);
    if (!schoolId) { res.status(403).json({ error: "No school context for this account" }); return; }

    const [studentCount] = await db.select({ count: sql<number>`count(*)::int` }).from(students).where(eq(students.schoolId, schoolId));
    const [teacherCount] = await db.select({ count: sql<number>`count(*)::int` }).from(profiles).where(and(eq(profiles.role, "teacher"), eq(profiles.schoolId, schoolId)));
    const [classCount] = await db.select({ count: sql<number>`count(*)::int` }).from(classes).where(eq(classes.schoolId, schoolId));
    const [pendingApprovals] = await db.select({ count: sql<number>`count(*)::int` }).from(approvals).where(and(eq(approvals.status, "pending"), eq(approvals.schoolId, schoolId)));
    const [unreadMessages] = await db.select({ count: sql<number>`count(*)::int` }).from(messages).where(isNull(messages.readAt));
    const [upcomingEvents] = await db.select({ count: sql<number>`count(*)::int` }).from(events).where(eq(events.schoolId, schoolId));

    const recentAnnouncements = await db.select({
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
      .where(eq(announcements.schoolId, schoolId))
      .limit(5);

    res.json({
      total_students: studentCount?.count ?? 0,
      total_teachers: teacherCount?.count ?? 0,
      total_classes: classCount?.count ?? 0,
      pending_approvals: pendingApprovals?.count ?? 0,
      unread_messages: unreadMessages?.count ?? 0,
      upcoming_events: upcomingEvents?.count ?? 0,
      recent_announcements: recentAnnouncements,
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
