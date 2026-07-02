import { Router } from "express";
import { db } from "@workspace/db";
import { attendanceRecords, students, profiles } from "@workspace/db";
import { and, eq, isNull, inArray, type SQL } from "drizzle-orm";
import { getRequesterProfile, getTeacherClassIds } from "../lib/scope";

const router = Router();

type Status = "present" | "absent" | "late" | "excused";

/** GET /api/attendance?date=&class_id=&subject_id= — list register records. */
router.get("/attendance", async (req, res) => {
  try {
    const requester = await getRequesterProfile(req);
    if (!requester?.schoolId) { res.status(403).json({ error: "No school context for this account" }); return; }
    if (requester.role !== "admin" && requester.role !== "teacher") {
      res.status(403).json({ error: "Only staff can view the register" }); return;
    }
    const { date, class_id, subject_id } = req.query as Record<string, string>;

    const rows = await db.select({
      id: attendanceRecords.id,
      school_id: attendanceRecords.schoolId,
      student_id: attendanceRecords.studentId,
      class_id: attendanceRecords.classId,
      subject_id: attendanceRecords.subjectId,
      date: attendanceRecords.date,
      status: attendanceRecords.status,
      note: attendanceRecords.note,
      marked_by_user_id: attendanceRecords.markedByUserId,
      student_name: profiles.fullName,
      created_at: attendanceRecords.createdAt,
    }).from(attendanceRecords)
      .leftJoin(students, eq(attendanceRecords.studentId, students.id))
      .leftJoin(profiles, eq(students.profileId, profiles.id))
      .where(eq(attendanceRecords.schoolId, requester.schoolId));

    let result = rows;
    if (date) result = result.filter((r) => r.date === date);
    if (class_id) result = result.filter((r) => r.class_id === class_id);
    if (subject_id) result = result.filter((r) => r.subject_id === subject_id);
    // Teachers only see registers for classes they are responsible for.
    if (requester.role === "teacher") {
      const allowed = await getTeacherClassIds(requester.id, requester.schoolId);
      result = result.filter((r) => r.class_id && allowed.has(r.class_id));
    }
    res.json(result);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * GET /api/attendance/report?class_id=&start=&end= — per-student attendance
 * summary for a class over a date range. Returns every student in the class
 * (including those with no records) with counts per status and an attendance
 * rate. Teachers are restricted to classes they are responsible for.
 */
router.get("/attendance/report", async (req, res) => {
  try {
    const requester = await getRequesterProfile(req);
    if (!requester?.schoolId) { res.status(403).json({ error: "No school context for this account" }); return; }
    if (requester.role !== "admin" && requester.role !== "teacher") {
      res.status(403).json({ error: "Only staff can view attendance reports" }); return;
    }
    const { class_id, start, end } = req.query as Record<string, string>;
    if (!class_id) { res.status(400).json({ error: "class_id is required" }); return; }

    if (requester.role === "teacher") {
      const allowed = await getTeacherClassIds(requester.id, requester.schoolId);
      if (!allowed.has(class_id)) { res.status(403).json({ error: "You do not teach this class" }); return; }
    }

    // Roster: every student currently in the class.
    const roster = await db
      .select({ id: students.id, name: profiles.fullName })
      .from(students)
      .leftJoin(profiles, eq(students.profileId, profiles.id))
      .where(and(eq(students.schoolId, requester.schoolId), eq(students.classId, class_id)));

    // Records for the class, filtered by date range (dates are YYYY-MM-DD text,
    // so lexicographic comparison is chronological).
    const records = await db
      .select({ student_id: attendanceRecords.studentId, date: attendanceRecords.date, status: attendanceRecords.status })
      .from(attendanceRecords)
      .where(and(eq(attendanceRecords.schoolId, requester.schoolId), eq(attendanceRecords.classId, class_id)));

    const inRange = records.filter(
      (r) => (!start || r.date >= start) && (!end || r.date <= end),
    );

    // Collapse to one status per student per day so multiple records on the
    // same day (e.g. subject-period registers) don't inflate counts. When a
    // day has several statuses, the most concerning one wins so a full-day
    // absence is never masked by a single present period.
    const RANK: Record<string, number> = { present: 0, excused: 1, late: 2, absent: 3 };
    const perDay = new Map<string, Status>(); // key: `${student}|${date}`
    const distinctDays = new Set<string>();
    for (const r of inRange) {
      if (r.status !== "present" && r.status !== "absent" && r.status !== "late" && r.status !== "excused") continue;
      distinctDays.add(r.date);
      const key = `${r.student_id}|${r.date}`;
      const prev = perDay.get(key);
      if (!prev || RANK[r.status] > RANK[prev]) perDay.set(key, r.status);
    }

    const byStudent = new Map<string, { present: number; absent: number; late: number; excused: number }>();
    for (const [key, status] of perDay) {
      const studentId = key.slice(0, key.indexOf("|"));
      const s = byStudent.get(studentId) ?? { present: 0, absent: 0, late: 0, excused: 0 };
      s[status] += 1;
      byStudent.set(studentId, s);
    }

    const rows = roster.map((st) => {
      const c = byStudent.get(st.id) ?? { present: 0, absent: 0, late: 0, excused: 0 };
      const total = c.present + c.absent + c.late + c.excused;
      // Present + late count as "in attendance"; excused is neutral (not counted
      // against the rate). Rate is over recorded days only.
      const denom = c.present + c.absent + c.late;
      const rate = denom > 0 ? Math.round(((c.present + c.late) / denom) * 100) : null;
      return {
        student_id: st.id,
        student_name: st.name ?? "Student",
        present: c.present,
        absent: c.absent,
        late: c.late,
        excused: c.excused,
        total,
        rate,
      };
    });
    rows.sort((a, b) => a.student_name.localeCompare(b.student_name));

    res.json({ days_recorded: distinctDays.size, students: rows });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * POST /api/attendance/mark — save a whole register for a class/subject on a
 * date. There is no unique constraint on the table, so we upsert by replacing:
 * delete every record matching the same scope (school + date + class + subject)
 * then insert the supplied rows. Idempotent re-saves are therefore safe.
 */
router.post("/attendance/mark", async (req, res) => {
  try {
    const requester = await getRequesterProfile(req);
    if (!requester?.schoolId) { res.status(403).json({ error: "No school context for this account" }); return; }
    if (requester.role !== "admin" && requester.role !== "teacher") {
      res.status(403).json({ error: "Only staff can mark the register" }); return;
    }
    const { date, class_id, subject_id, records } = req.body ?? {};
    if (!date || !Array.isArray(records)) {
      res.status(400).json({ error: "date and records[] are required" }); return;
    }

    // A teacher must mark a specific class, and only one they are responsible
    // for. Without a class_id a teacher could mark arbitrary students.
    if (requester.role === "teacher") {
      if (!class_id) { res.status(400).json({ error: "class_id is required" }); return; }
      const allowed = await getTeacherClassIds(requester.id, requester.schoolId);
      if (!allowed.has(class_id)) { res.status(403).json({ error: "You do not teach this class" }); return; }
    }

    const classId = class_id || null;
    const subjectId = subject_id || null;

    // Validate every submitted student belongs to this school and, when a class
    // is given, to that class. This stops a teacher from passing an owned
    // class_id but smuggling in student_ids from other classes.
    const submittedIds = Array.from(
      new Set(records.map((r: any) => r?.student_id).filter(Boolean) as string[]),
    );
    if (submittedIds.length === 0) {
      res.status(400).json({ error: "records[] must contain at least one student_id" }); return;
    }
    const studentConds: SQL[] = [
      eq(students.schoolId, requester.schoolId),
      inArray(students.id, submittedIds),
    ];
    if (classId) studentConds.push(eq(students.classId, classId));
    const validRows = await db
      .select({ id: students.id })
      .from(students)
      .where(and(...studentConds));
    const validIds = new Set(validRows.map((r) => r.id));
    if (validIds.size !== submittedIds.length) {
      res.status(403).json({ error: "One or more students are not in the specified class" }); return;
    }

    const conds: SQL[] = [
      eq(attendanceRecords.schoolId, requester.schoolId),
      eq(attendanceRecords.date, date),
      classId ? eq(attendanceRecords.classId, classId) : isNull(attendanceRecords.classId),
      subjectId ? eq(attendanceRecords.subjectId, subjectId) : isNull(attendanceRecords.subjectId),
    ];
    await db.delete(attendanceRecords).where(and(...conds));

    const toInsert = records
      .filter((r: any) => r?.student_id)
      .map((r: any) => ({
        schoolId: requester.schoolId!,
        studentId: r.student_id as string,
        classId,
        subjectId,
        date: date as string,
        status: ["present", "absent", "late", "excused"].includes(r.status) ? r.status : "present",
        note: r.note?.trim() || null,
        markedByUserId: requester.userId,
      }));

    if (toInsert.length) await db.insert(attendanceRecords).values(toInsert);
    res.status(201).json({ saved: toInsert.length });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
