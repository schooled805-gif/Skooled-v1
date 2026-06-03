import { Router } from "express";
import { db } from "@workspace/db";
import { approvals, events, students, profiles } from "@workspace/db";
import { and, eq } from "drizzle-orm";
import {
  ListApprovalsQueryParams,
  CreateApprovalBody,
  RespondToApprovalParams,
  RespondToApprovalBody,
} from "@workspace/api-zod";
import { sendPushNotifications } from "../lib/pushNotifications";

const router = Router();

router.get("/approvals", async (req, res) => {
  try {
    const query = ListApprovalsQueryParams.parse(req.query);
    const rows = await db.select({
      id: approvals.id,
      event_id: approvals.eventId,
      student_id: approvals.studentId,
      parent_user_id: approvals.parentUserId,
      status: approvals.status,
      response_comment: approvals.responseComment,
      responded_at: approvals.respondedAt,
      school_id: approvals.schoolId,
      event_title: events.title,
      student_name: profiles.fullName,
      created_at: approvals.createdAt,
    }).from(approvals)
      .leftJoin(events, eq(approvals.eventId, events.id))
      .leftJoin(students, eq(approvals.studentId, students.id))
      .leftJoin(profiles, eq(students.profileId, profiles.id));

    let result = rows;
    if (query.student_id) result = result.filter(r => r.student_id === query.student_id);
    if (query.status) result = result.filter(r => r.status === query.status);
    if (query.parent_id) result = result.filter(r => r.parent_user_id === query.parent_id);
    res.json(result);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/approvals", async (req, res) => {
  try {
    const body = CreateApprovalBody.parse(req.body);
    const [approval] = await db.insert(approvals).values({
      eventId: body.event_id,
      studentId: body.student_id,
      parentUserId: body.parent_user_id,
      status: "pending",
      schoolId: body.school_id,
    }).returning();

    // Notify the parent that their approval is required (fire-and-forget)
    setImmediate(async () => {
      try {
        const [parentProfile] = await db
          .select({ pushToken: profiles.pushToken })
          .from(profiles)
          .where(
            and(
              eq(profiles.userId, body.parent_user_id),
              eq(profiles.schoolId, body.school_id),
            ),
          )
          .limit(1);

        const [event] = await db
          .select({ title: events.title })
          .from(events)
          .where(eq(events.id, body.event_id))
          .limit(1);

        if (parentProfile?.pushToken) {
          await sendPushNotifications([parentProfile.pushToken], {
            title: "✅ Approval Required",
            body: event?.title
              ? `Your approval is needed for "${event.title}"`
              : "Your approval is needed for a school event",
            data: { type: "approval", id: approval.id },
          });
        }
      } catch {
        // Non-fatal
      }
    });

    res.status(201).json({ ...approval, event_title: null, student_name: null });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/approvals/:id/respond", async (req, res) => {
  try {
    const { id } = RespondToApprovalParams.parse(req.params);
    const body = RespondToApprovalBody.parse(req.body);
    const [approval] = await db.update(approvals).set({
      status: body.status,
      responseComment: body.response_comment ?? null,
      respondedAt: new Date().toISOString(),
    }).where(eq(approvals.id, id)).returning();
    if (!approval) { res.status(404).json({ error: "Not found" }); return; }
    res.json({ ...approval, event_title: null, student_name: null });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
