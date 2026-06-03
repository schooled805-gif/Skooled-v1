import { Router } from "express";
import { db } from "@workspace/db";
import { messages, profiles } from "@workspace/db";
import { eq, or, and, isNull } from "drizzle-orm";
import {
  ListMessagesQueryParams,
  SendMessageBody,
  MarkMessageReadParams,
} from "@workspace/api-zod";

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
    res.status(201).json({ ...msg, sender_name: null });
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
