import { Router } from "express";
import { db } from "@workspace/db";
import { messages, profiles } from "@workspace/db";
import { eq, and, isNotNull, inArray } from "drizzle-orm";
import {
  ListMessagesQueryParams,
  SendMessageBody,
  MarkMessageReadParams,
} from "@workspace/api-zod";
import { sendPushNotifications } from "../lib/pushNotifications";
import { getRequesterProfile, resolveStudentIds, getParentLinksForStudents, getTeacherClassIds } from "../lib/scope";

const router = Router();

router.get("/messages", async (req, res) => {
  try {
    const query = ListMessagesQueryParams.parse(req.query);
    const userId = req.headers["x-user-id"] as string;

    const rows = await db.select({
      id: messages.id,
      sender_id: messages.senderId,
      recipient_id: messages.recipientId,
      body: messages.body,
      student_id: messages.studentId,
      subject_id: messages.subjectId,
      read_at: messages.readAt,
      school_id: messages.schoolId,
      sender_name: profiles.fullName,
      created_at: messages.createdAt,
    }).from(messages)
      .leftJoin(profiles, eq(messages.senderId, profiles.userId));

    let result = rows;
    if (query.conversation_with) {
      result = result.filter(m =>
        (m.sender_id === userId && m.recipient_id === query.conversation_with) ||
        (m.sender_id === query.conversation_with && m.recipient_id === userId)
      );
    }
    res.json(result);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/messages", async (req, res) => {
  try {
    const body = SendMessageBody.parse(req.body);
    const userId = req.headers["x-user-id"] as string;
    const [msg] = await db.insert(messages).values({
      senderId: userId,
      recipientId: body.recipient_id,
      body: body.body,
      studentId: body.student_id ?? null,
      subjectId: body.subject_id ?? null,
      schoolId: body.school_id,
    }).returning();

    // Notify the recipient (fire-and-forget)
    setImmediate(async () => {
      try {
        const [senderProfile] = await db
          .select({ fullName: profiles.fullName })
          .from(profiles)
          .where(eq(profiles.userId, userId))
          .limit(1);

        const [recipientProfile] = await db
          .select({ pushToken: profiles.pushToken })
          .from(profiles)
          .where(
            and(
              eq(profiles.userId, body.recipient_id),
              isNotNull(profiles.pushToken),
            ),
          )
          .limit(1);

        if (recipientProfile?.pushToken) {
          const senderName = senderProfile?.fullName ?? "Someone";
          const preview = body.body.length > 80 ? body.body.slice(0, 77) + "…" : body.body;
          await sendPushNotifications([recipientProfile.pushToken], {
            title: `💬 New message from ${senderName}`,
            body: preview,
            data: { type: "message", conversation_with: userId, message_id: msg.id },
          });
        }
      } catch {
        // Non-fatal
      }
    });

    res.status(201).json({ ...msg, sender_name: null });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * POST /api/messages/broadcast — a teacher (or admin) sends one message to the
 * parents of many students at once, selected by any combination of individual
 * students, classes, grade levels, or subjects. One message row is created per
 * recipient parent (deduplicated). Reuses the messages table so the parent sees
 * it in their normal inbox.
 */
router.post("/messages/broadcast", async (req, res) => {
  try {
    const requester = await getRequesterProfile(req);
    if (!requester?.schoolId) { res.status(403).json({ error: "No school context for this account" }); return; }
    if (requester.role !== "teacher" && requester.role !== "admin") {
      res.status(403).json({ error: "Only staff can broadcast messages" }); return;
    }
    const { body, student_ids, class_ids, grade_levels, subject_ids } = req.body ?? {};
    if (!body?.trim()) { res.status(400).json({ error: "body is required" }); return; }

    // Teachers may only target students in their own classes; admins may target
    // the whole school.
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
    // Dedupe parents — a parent linked to several targeted students gets one msg.
    const parentToStudent = new Map<string, string>();
    for (const l of links) if (!parentToStudent.has(l.parentUserId)) parentToStudent.set(l.parentUserId, l.studentId);

    if (parentToStudent.size === 0) {
      res.status(400).json({ error: "None of the selected students have a linked parent" }); return;
    }

    const values = Array.from(parentToStudent.entries()).map(([parentUserId, studentId]) => ({
      senderId: requester.userId,
      recipientId: parentUserId,
      body: body.trim(),
      studentId,
      schoolId: requester.schoolId!,
    }));
    await db.insert(messages).values(values);

    // Push notify recipients with a token (fire-and-forget).
    setImmediate(async () => {
      try {
        const recipientIds = Array.from(parentToStudent.keys());
        const recips = await db.select({ pushToken: profiles.pushToken })
          .from(profiles)
          .where(and(inArray(profiles.userId, recipientIds), isNotNull(profiles.pushToken)));
        const tokens = recips.map((r) => r.pushToken!).filter(Boolean);
        if (tokens.length) {
          const preview = body.trim().length > 80 ? body.trim().slice(0, 77) + "…" : body.trim();
          await sendPushNotifications(tokens, {
            title: `💬 Message from ${requester.fullName}`,
            body: preview,
            data: { type: "message", conversation_with: requester.userId },
          });
        }
      } catch {
        // Non-fatal
      }
    });

    res.status(201).json({ sent: values.length, students_matched: studentIdSet.size });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/messages/conversations", async (req, res) => {
  try {
    const userId = req.headers["x-user-id"] as string;
    const allMessages = await db.select({
      id: messages.id,
      sender_id: messages.senderId,
      recipient_id: messages.recipientId,
      body: messages.body,
      read_at: messages.readAt,
      created_at: messages.createdAt,
    }).from(messages);

    const userMessages = allMessages.filter(m =>
      m.sender_id === userId || m.recipient_id === userId
    );

    // Group into conversations
    const convMap = new Map<string, typeof userMessages[0][]>();
    for (const msg of userMessages) {
      const otherId = msg.sender_id === userId ? msg.recipient_id : msg.sender_id;
      if (!convMap.has(otherId)) convMap.set(otherId, []);
      convMap.get(otherId)!.push(msg);
    }

    const allProfiles = await db.select().from(profiles);
    const profileMap = new Map(allProfiles.map(p => [p.userId, p]));

    const conversations = Array.from(convMap.entries()).map(([otherId, msgs]) => {
      const sorted = msgs.sort((a, b) => new Date(b.created_at!).getTime() - new Date(a.created_at!).getTime());
      const latest = sorted[0];
      const otherProfile = profileMap.get(otherId);
      const unread = msgs.filter(m => m.sender_id === otherId && !m.read_at).length;
      return {
        other_user_id: otherId,
        other_user_name: otherProfile?.fullName ?? "Unknown",
        other_user_role: otherProfile?.role ?? null,
        last_message: latest.body,
        last_message_at: latest.created_at,
        unread_count: unread,
      };
    });

    res.json(conversations);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/messages/:id/read", async (req, res) => {
  try {
    const { id } = MarkMessageReadParams.parse(req.params);
    const [msg] = await db.update(messages).set({
      readAt: new Date().toISOString(),
    }).where(eq(messages.id, id)).returning();
    if (!msg) { res.status(404).json({ error: "Not found" }); return; }
    res.json({ ...msg, sender_name: null });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
