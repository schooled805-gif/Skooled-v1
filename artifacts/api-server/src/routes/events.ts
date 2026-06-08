import { Router } from "express";
import { db } from "@workspace/db";
import { events } from "@workspace/db";
import { and, eq } from "drizzle-orm";
import { getRequesterSchoolId } from "../lib/scope";
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
    const schoolId = await getRequesterSchoolId(req);
    if (!schoolId) { res.status(403).json({ error: "No school context for this account" }); return; }

    let rows = await db.select().from(events).where(eq(events.schoolId, schoolId));
    if (query.audience) rows = rows.filter(e => e.audience === query.audience || e.audience === "school");
    if (query.upcoming) rows = rows.filter(e => e.startDatetime && new Date(e.startDatetime) >= new Date());
    res.json(rows);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

/** Validate an event's start/end datetimes. Returns an error string or null. */
function validateEventDates(start: string, end?: string | null): string | null {
  const startDate = new Date(start);
  if (isNaN(startDate.getTime())) return "Start date is not a valid date";
  // Reject dates in the past (allow a small 1-minute grace for clock skew).
  if (startDate.getTime() < Date.now() - 60_000) return "Event start date cannot be in the past";
  if (end != null && end !== "") {
    const endDate = new Date(end);
    if (isNaN(endDate.getTime())) return "End date is not a valid date";
    if (endDate.getTime() < startDate.getTime()) return "End date cannot be before the start date";
  }
  return null;
}

router.post("/events", async (req, res) => {
  try {
    const schoolId = await getRequesterSchoolId(req);
    if (!schoolId) { res.status(403).json({ error: "No school context for this account" }); return; }
    const body = CreateEventBody.parse(req.body);
    const dateError = validateEventDates(body.start_datetime, body.end_datetime);
    if (dateError) { res.status(400).json({ error: dateError }); return; }
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
      schoolId, // server-derived; ignore any client-supplied school_id
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
    const schoolId = await getRequesterSchoolId(req);
    if (!schoolId) { res.status(403).json({ error: "No school context for this account" }); return; }

    if (body.start_datetime) {
      const dateError = validateEventDates(body.start_datetime, body.end_datetime);
      if (dateError) { res.status(400).json({ error: dateError }); return; }
    }

    const [event] = await db.update(events).set({
      title: body.title,
      description: body.description,
      eventType: body.event_type,
      startDatetime: body.start_datetime,
      endDatetime: body.end_datetime,
      location: body.location,
      audience: body.audience,
      requiresApproval: body.requires_approval,
      updatedAt: new Date(),
    }).where(and(eq(events.id, id), eq(events.schoolId, schoolId))).returning();
    if (!event) { res.status(404).json({ error: "Not found" }); return; }
    res.json(event);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/events/:id", async (req, res) => {
  try {
    const { id } = GetEventParams.parse(req.params);
    const schoolId = await getRequesterSchoolId(req);
    if (!schoolId) { res.status(403).json({ error: "No school context for this account" }); return; }

    const [deleted] = await db.delete(events)
      .where(and(eq(events.id, id), eq(events.schoolId, schoolId)))
      .returning();
    if (!deleted) { res.status(404).json({ error: "Not found" }); return; }
    res.status(204).send();
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
