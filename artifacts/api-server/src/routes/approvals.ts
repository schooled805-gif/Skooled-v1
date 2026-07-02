import { Router } from "express";
import { db } from "@workspace/db";
import { approvals, events, students, profiles } from "@workspace/db";
import { and, eq, isNotNull, inArray } from "drizzle-orm";
import {
  getRequesterSchoolId,
  getRequesterProfile,
  resolveStudentIds,
  getParentLinksForStudents,
  getTeacherClassIds,
} from "../lib/scope";
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
    const schoolId = await getRequesterSchoolId(req);
    if (!schoolId) { res.status(403).json({ error: "No school context for this account" }); return; }

    const rows = await db.select({
      id: approvals.id,
      event_id: approvals.eventId,
      student_id: approvals.studentId,
      parent_user_id: approvals.parentUserId,
      status: approvals.status,
      response_comment: approvals.responseComment,
      responded_at: approvals.respondedAt,
      school_id: approvals.schoolId,
      title: approvals.title,
      description: approvals.description,
      event_title: events.title,
      student_name: profiles.fullName,
      created_at: approvals.createdAt,
    }).from(approvals)
      .leftJoin(events, eq(approvals.eventId, events.id))
      .leftJoin(students, eq(approvals.studentId, students.id))
      .leftJoin(profiles, eq(students.profileId, profiles.id))
      .where(eq(approvals.schoolId, schoolId));

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

/**
 * POST /api/approvals/bulk — a teacher/admin creates approval requests for many
 * students at once, selected by any mix of individual students, classes, grade
 * levels, or subjects. One approval row is created per (student, linked parent)
 * pair so each parent responds for their own child.
 */
router.post("/approvals/bulk", async (req, res) => {
  try {
    const requester = await getRequesterProfile(req);
    if (!requester?.schoolId) { res.status(403).json({ error: "No school context for this account" }); return; }
    if (requester.role !== "teacher" && requester.role !== "admin") {
      res.status(403).json({ error: "Only staff can create approval requests" }); return;
    }
    const { event_id, title, description, student_ids, class_ids, grade_levels, subject_ids } = req.body ?? {};
    const reqTitle = typeof title === "string" ? title.trim() : "";
    const reqDescription = typeof description === "string" ? description.trim() : "";
    if (!event_id && !reqTitle) {
      res.status(400).json({ error: "Provide either an event or a request title" }); return;
    }

    // If an event was referenced, confirm it belongs to this school.
    let event: { id: string; title: string } | undefined;
    if (event_id) {
      [event] = await db.select({ id: events.id, title: events.title })
        .from(events)
        .where(and(eq(events.id, event_id), eq(events.schoolId, requester.schoolId)))
        .limit(1);
      if (!event) { res.status(404).json({ error: "Event not found" }); return; }
    }
    const requestLabel = event?.title ?? reqTitle;

    // Teachers may only target students in their own classes; admins the school.
    const allowedClassIds = requester.role === "teacher"
      ? await getTeacherClassIds(requester.id, requester.schoolId)
      : undefined;

    const studentIdSet = await resolveStudentIds(requester.schoolId, {
      studentIds: student_ids,
      classIds: class_ids,
      gradeLevels: grade_levels,
      subjectIds: subject_ids,
    }, allowedClassIds);
    if (studentIdSet.size === 0) {
      res.status(400).json({ error: "No students matched the selected recipients" }); return;
    }

    const links = await getParentLinksForStudents(requester.schoolId, Array.from(studentIdSet));
    if (links.length === 0) {
      res.status(400).json({ error: "None of the selected students have a linked parent" }); return;
    }

    // Dedupe (student, parent) pairs to avoid duplicate approval rows.
    const seen = new Set<string>();
    const values = links.filter((l) => {
      const key = `${l.studentId}:${l.parentUserId}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).map((l) => ({
      eventId: event_id ? (event_id as string) : null,
      title: reqTitle || null,
      description: reqDescription || null,
      studentId: l.studentId,
      parentUserId: l.parentUserId,
      status: "pending" as const,
      schoolId: requester.schoolId!,
    }));

    await db.insert(approvals).values(values);

    // Push notify each distinct parent (fire-and-forget).
    setImmediate(async () => {
      try {
        const parentIds = Array.from(new Set(values.map((v) => v.parentUserId)));
        const recips = await db.select({ pushToken: profiles.pushToken })
          .from(profiles)
          .where(and(inArray(profiles.userId, parentIds), isNotNull(profiles.pushToken)));
        const tokens = recips.map((r) => r.pushToken!).filter(Boolean);
        if (tokens.length) {
          await sendPushNotifications(tokens, {
            title: "✅ Approval Required",
            body: `Your approval is needed for "${requestLabel}"`,
            data: { type: "approval", event_id: event_id ? (event_id as string) : null },
          });
        }
      } catch {
        // Non-fatal
      }
    });

    res.status(201).json({ created: values.length, students_matched: studentIdSet.size });
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
