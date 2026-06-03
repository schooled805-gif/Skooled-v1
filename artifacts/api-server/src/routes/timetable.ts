import { Router } from "express";
import { db } from "@workspace/db";
import { timetableEntries, subjects, profiles, classes } from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  ListTimetableEntriesQueryParams,
  CreateTimetableEntryBody,
  UpdateTimetableEntryParams,
  UpdateTimetableEntryBody,
  DeleteTimetableEntryParams,
} from "@workspace/api-zod";

const router = Router();

router.get("/timetable", async (req, res) => {
  try {
    const query = ListTimetableEntriesQueryParams.parse(req.query);
    const rows = await db.select({
      id: timetableEntries.id,
      student_id: timetableEntries.studentId,
      class_id: timetableEntries.classId,
      subject_id: timetableEntries.subjectId,
      teacher_id: timetableEntries.teacherId,
      day_of_week: timetableEntries.dayOfWeek,
      start_time: timetableEntries.startTime,
      end_time: timetableEntries.endTime,
      room: timetableEntries.room,
      type: timetableEntries.type,
      school_id: timetableEntries.schoolId,
      subject_name: subjects.name,
      teacher_name: profiles.fullName,
      class_name: classes.name,
      created_at: timetableEntries.createdAt,
    }).from(timetableEntries)
      .leftJoin(subjects, eq(timetableEntries.subjectId, subjects.id))
      .leftJoin(profiles, eq(timetableEntries.teacherId, profiles.id))
      .leftJoin(classes, eq(timetableEntries.classId, classes.id));

    let result = rows;
    if (query.student_id) result = result.filter(r => r.student_id === query.student_id);
    if (query.class_id) result = result.filter(r => r.class_id === query.class_id);
    if (query.teacher_id) result = result.filter(r => r.teacher_id === query.teacher_id);
    if (query.day_of_week) result = result.filter(r => r.day_of_week === query.day_of_week);
    res.json(result);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/timetable", async (req, res) => {
  try {
    const body = CreateTimetableEntryBody.parse(req.body);
    const [entry] = await db.insert(timetableEntries).values({
      studentId: body.student_id ?? null,
      classId: body.class_id ?? null,
      subjectId: body.subject_id,
      teacherId: body.teacher_id,
      dayOfWeek: body.day_of_week,
      startTime: body.start_time,
      endTime: body.end_time,
      room: body.room ?? null,
      type: body.type,
      schoolId: body.school_id,
    }).returning();
    res.status(201).json({ ...entry, subject_name: null, teacher_name: null, class_name: null });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/timetable/:id", async (req, res) => {
  try {
    const { id } = UpdateTimetableEntryParams.parse(req.params);
    const body = UpdateTimetableEntryBody.parse(req.body);
    const [entry] = await db.update(timetableEntries).set({
      dayOfWeek: body.day_of_week,
      startTime: body.start_time,
      endTime: body.end_time,
      room: body.room,
      type: body.type,
    }).where(eq(timetableEntries.id, id)).returning();
    if (!entry) { res.status(404).json({ error: "Not found" }); return; }
    res.json({ ...entry, subject_name: null, teacher_name: null, class_name: null });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/timetable/:id", async (req, res) => {
  try {
    const { id } = DeleteTimetableEntryParams.parse(req.params);
    await db.delete(timetableEntries).where(eq(timetableEntries.id, id));
    res.status(204).end();
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
