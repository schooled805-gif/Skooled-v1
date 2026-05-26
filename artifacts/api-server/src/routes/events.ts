import { Router } from "express";
import { db } from "@workspace/db";
import { events } from "@workspace/db";
import { eq, gte } from "drizzle-orm";
import {
  ListEventsQueryParams,
  CreateEventBody,
  GetEventParams,
  UpdateEventParams,
  UpdateEventBody,
} from "@workspace/api-zod";

const router = Router();

router.get("/events", async (req, res) => {
  try {
    const query = ListEventsQueryParams.parse(req.query);
    let rows = await db.select().from(events);
    if (query.audience) rows = rows.filter(e => e.audience === query.audience || e.audience === "school");
    if (query.upcoming) rows = rows.filter(e => e.startDatetime && new Date(e.startDatetime) >= new Date());
    res.json(rows);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/events", async (req, res) => {
  try {
    const body = CreateEventBody.parse(req.body);
    const [event] = await db.insert(events).values({
      title: body.title,
      description: body.description ?? null,
      eventType: body.event_type,
      startDatetime: body.start_datetime,
      endDatetime: body.end_datetime ?? null,
      location: body.location ?? null,
      audience: body.audience,
      requiresApproval: body.requires_approval ?? false,
      approvalDueDate: body.approval_due_date ?? null,
      schoolId: body.school_id,
    }).returning();
    res.status(201).json(event);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/events/:id", async (req, res) => {
  try {
    const { id } = GetEventParams.parse(req.params);
    const [event] = await db.select().from(events).where(eq(events.id, id)).limit(1);
    if (!event) { res.status(404).json({ error: "Not found" }); return; }
    res.json(event);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/events/:id", async (req, res) => {
  try {
    const { id } = UpdateEventParams.parse(req.params);
    const body = UpdateEventBody.parse(req.body);
    const [event] = await db.update(events).set({
      title: body.title,
      description: body.description,
      startDatetime: body.start_datetime,
      endDatetime: body.end_datetime,
      location: body.location,
      requiresApproval: body.requires_approval,
      updatedAt: new Date(),
    }).where(eq(events.id, id)).returning();
    if (!event) { res.status(404).json({ error: "Not found" }); return; }
    res.json(event);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
