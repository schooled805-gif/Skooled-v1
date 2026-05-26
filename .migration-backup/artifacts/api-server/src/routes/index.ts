import { Router, type IRouter } from "express";
import healthRouter from "./health";
import profilesRouter from "./profiles";
import studentsRouter from "./students";
import classesRouter from "./classes";
import subjectsRouter from "./subjects";
import timetableRouter from "./timetable";
import eventsRouter from "./events";
import approvalsRouter from "./approvals";
import messagesRouter from "./messages";
import announcementsRouter from "./announcements";
import reportsRouter from "./reports";
import dashboardRouter from "./dashboard";
import schoolsRouter from "./schools";
import parentStudentLinksRouter from "./parentStudentLinks";

const router: IRouter = Router();

router.use(healthRouter);
router.use(profilesRouter);
router.use(studentsRouter);
router.use(classesRouter);
router.use(subjectsRouter);
router.use(timetableRouter);
router.use(eventsRouter);
router.use(approvalsRouter);
router.use(messagesRouter);
router.use(announcementsRouter);
router.use(reportsRouter);
router.use(dashboardRouter);
router.use(schoolsRouter);
router.use(parentStudentLinksRouter);

export default router;
