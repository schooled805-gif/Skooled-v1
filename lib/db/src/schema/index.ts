import { pgTable, text, uuid, timestamp, boolean, integer, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// ── SCHOOLS ──────────────────────────────────────────────────────────────────
export const schools = pgTable("schools", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  address: text("address"),
  phone: text("phone"),
  email: text("email"),
  logoUrl: text("logo_url"),
  primaryColor: text("primary_color"),
  secondaryColor: text("secondary_color"),
  tuckshopUrl: text("tuckshop_url"),
  createdAt: timestamp("created_at").defaultNow(),
});

// ── PROFILES ──────────────────────────────────────────────────────────────────
export const profiles = pgTable("profiles", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull().unique(),
  role: text("role").notNull(), // parent | teacher | student | admin
  status: text("status").notNull().default("approved"), // approved | pending | rejected
  fullName: text("full_name").notNull(),
  email: text("email").notNull().unique(),
  phone: text("phone"),
  avatarUrl: text("avatar_url"),
  schoolId: uuid("school_id"),
  pushToken: text("push_token"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at"),
});

// ── CLASSES ───────────────────────────────────────────────────────────────────
export const classes = pgTable("classes", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  schoolId: uuid("school_id").notNull(),
  gradeLevel: text("grade_level").notNull(),
  teacherId: uuid("teacher_id"),
  academicYear: text("academic_year"),
  status: text("status").notNull().default("active"), // active | disabled
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at"),
});

// ── SUBJECTS ──────────────────────────────────────────────────────────────────
export const subjects = pgTable("subjects", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  code: text("code"),
  schoolId: uuid("school_id").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// ── STUDENTS ──────────────────────────────────────────────────────────────────
export const students = pgTable("students", {
  id: uuid("id").primaryKey().defaultRandom(),
  profileId: uuid("profile_id").notNull(),
  classId: uuid("class_id"),
  schoolId: uuid("school_id").notNull(),
  grade: text("grade").notNull(),
  dateOfBirth: text("date_of_birth"),
  studentNumber: text("student_number"),
  createdAt: timestamp("created_at").defaultNow(),
});

// ── PARENT_STUDENT_LINKS ───────────────────────────────────────────────────────
export const parentStudentLinks = pgTable("parent_student_links", {
  id: uuid("id").primaryKey().defaultRandom(),
  parentUserId: text("parent_user_id").notNull(),
  studentId: uuid("student_id").notNull(),
  schoolId: uuid("school_id").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// ── TIMETABLE_ENTRIES ─────────────────────────────────────────────────────────
export const timetableEntries = pgTable("timetable_entries", {
  id: uuid("id").primaryKey().defaultRandom(),
  studentId: uuid("student_id"),
  classId: uuid("class_id"),
  subjectId: uuid("subject_id").notNull(),
  teacherId: uuid("teacher_id").notNull(),
  dayOfWeek: text("day_of_week").notNull(),
  startTime: text("start_time").notNull(),
  endTime: text("end_time").notNull(),
  room: text("room"),
  type: text("type").notNull().default("lesson"),
  schoolId: uuid("school_id").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// ── EVENTS ────────────────────────────────────────────────────────────────────
export const events = pgTable("events", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  description: text("description"),
  eventType: text("event_type").notNull(),
  startDatetime: text("start_datetime").notNull(),
  endDatetime: text("end_datetime"),
  location: text("location"),
  audience: text("audience").notNull().default("school"),
  requiresApproval: boolean("requires_approval").default(false),
  approvalDueDate: text("approval_due_date"),
  schoolId: uuid("school_id").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at"),
});

// ── APPROVALS ─────────────────────────────────────────────────────────────────
export const approvals = pgTable("approvals", {
  id: uuid("id").primaryKey().defaultRandom(),
  eventId: uuid("event_id").notNull(),
  studentId: uuid("student_id").notNull(),
  parentUserId: text("parent_user_id").notNull(),
  status: text("status").notNull().default("pending"),
  responseComment: text("response_comment"),
  respondedAt: text("responded_at"),
  schoolId: uuid("school_id").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// ── MESSAGES ──────────────────────────────────────────────────────────────────
export const messages = pgTable("messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  senderId: text("sender_id").notNull(),
  recipientId: text("recipient_id").notNull(),
  body: text("body").notNull(),
  studentId: uuid("student_id"),
  subjectId: uuid("subject_id"),
  readAt: text("read_at"),
  schoolId: uuid("school_id").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// ── ANNOUNCEMENTS ─────────────────────────────────────────────────────────────
export const announcements = pgTable("announcements", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  audienceType: text("audience_type").notNull().default("all"),
  priority: text("priority"),
  attachmentUrl: text("attachment_url"),
  publishAt: text("publish_at"),
  expiresAt: text("expires_at"),
  schoolId: uuid("school_id").notNull(),
  authorId: text("author_id"),
  createdAt: timestamp("created_at").defaultNow(),
});

// ── REPORTS ───────────────────────────────────────────────────────────────────
export const reports = pgTable("reports", {
  id: uuid("id").primaryKey().defaultRandom(),
  studentId: uuid("student_id").notNull(),
  title: text("title").notNull(),
  term: text("term").notNull(),
  year: integer("year").notNull(),
  fileUrl: text("file_url").notNull(),
  visibleToStudent: boolean("visible_to_student").default(false),
  schoolId: uuid("school_id").notNull(),
  grade: text("grade"),
  subject: text("subject"),
  teacherName: text("teacher_name"),
  comments: text("comments"),
  score: integer("score"),
  createdAt: timestamp("created_at").defaultNow(),
});

// ── TUCKSHOP_ACCOUNTS ─────────────────────────────────────────────────────────
export const tuckshopAccounts = pgTable("tuckshop_accounts", {
  id: uuid("id").primaryKey().defaultRandom(),
  studentId: uuid("student_id").notNull().unique(),
  schoolId: uuid("school_id").notNull(),
  balanceCents: integer("balance_cents").notNull().default(0),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ── TUCKSHOP_MENUS ────────────────────────────────────────────────────────────
export const tuckshopMenus = pgTable("tuckshop_menus", {
  id: uuid("id").primaryKey().defaultRandom(),
  schoolId: uuid("school_id").notNull(),
  weekLabel: text("week_label").notNull(), // e.g. "Week of 27 May 2026"
  items: text("items").notNull().default("[]"), // JSON array of menu items
  publishedAt: timestamp("published_at").defaultNow(),
  createdBy: text("created_by"),
  createdAt: timestamp("created_at").defaultNow(),
});

// ── TUCKSHOP_ORDERS ───────────────────────────────────────────────────────────
export const tuckshopOrders = pgTable("tuckshop_orders", {
  id: uuid("id").primaryKey().defaultRandom(),
  studentId: uuid("student_id").notNull(),
  schoolId: uuid("school_id").notNull(),
  parentUserId: text("parent_user_id"),
  items: text("items").notNull().default("[]"), // JSON array of ordered items
  totalCents: integer("total_cents").notNull().default(0),
  status: text("status").notNull().default("pending"), // pending|confirmed|ready|collected|cancelled
  orderDate: text("order_date"), // YYYY-MM-DD
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at"),
});

// ── TUCKSHOP_TRANSACTIONS ─────────────────────────────────────────────────────
export const tuckshopTransactions = pgTable("tuckshop_transactions", {
  id: uuid("id").primaryKey().defaultRandom(),
  accountId: uuid("account_id").notNull(),
  amountCents: integer("amount_cents").notNull(),
  type: text("type").notNull(), // topup|order|refund|adjustment
  description: text("description"),
  referenceId: text("reference_id"),
  createdAt: timestamp("created_at").defaultNow(),
});

// ── FEE_ACCOUNTS ──────────────────────────────────────────────────────────────
// Per-student school-fees account. balanceCents is the amount OWED:
// positive = outstanding balance, negative = credit on the account.
export const feeAccounts = pgTable("fee_accounts", {
  id: uuid("id").primaryKey().defaultRandom(),
  studentId: uuid("student_id").notNull().unique(),
  schoolId: uuid("school_id").notNull(),
  balanceCents: integer("balance_cents").notNull().default(0),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ── FEE_LEDGER ────────────────────────────────────────────────────────────────
// Immutable ledger of every change to a fee account. amountCents is the signed
// delta applied to the balance: a charge is positive (increases what is owed),
// a payment is negative (reduces what is owed), an adjustment can be either.
export const feeLedger = pgTable("fee_ledger", {
  id: uuid("id").primaryKey().defaultRandom(),
  accountId: uuid("account_id").notNull(),
  studentId: uuid("student_id").notNull(),
  schoolId: uuid("school_id").notNull(),
  amountCents: integer("amount_cents").notNull(),
  type: text("type").notNull(), // charge | adjustment | payment
  description: text("description"),
  referenceId: text("reference_id"), // e.g. fee_payments.id for payments
  createdBy: text("created_by"), // admin user_id, or "system" for provider payments
  createdAt: timestamp("created_at").defaultNow(),
});

// ── FEE_PAYMENTS ──────────────────────────────────────────────────────────────
// Tracks an online payment attempt through a provider. The balance is only ever
// credited from a verified provider webhook, matched back to one of these rows by
// its unique `reference`. `status` transitions pending -> complete (idempotent).
export const feePayments = pgTable("fee_payments", {
  id: uuid("id").primaryKey().defaultRandom(),
  studentId: uuid("student_id").notNull(),
  schoolId: uuid("school_id").notNull(),
  parentUserId: text("parent_user_id"),
  provider: text("provider").notNull(), // ozow | paystack
  reference: text("reference").notNull().unique(), // our server-generated unique ref
  providerReference: text("provider_reference"), // provider's transaction id
  amountCents: integer("amount_cents").notNull(),
  status: text("status").notNull().default("pending"), // pending | complete | failed | cancelled
  ledgerEntryId: uuid("ledger_entry_id"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at"),
});

// ── AUDIT_LOGS ────────────────────────────────────────────────────────────────
export const auditLogs = pgTable("audit_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id"),
  action: text("action").notNull(),
  entity: text("entity"),
  entityId: text("entity_id"),
  details: text("details"),
  schoolId: uuid("school_id"),
  createdAt: timestamp("created_at").defaultNow(),
});

// ── SUBJECT_TEACHERS (many-to-many: which teachers teach a subject) ────────────
export const subjectTeachers = pgTable("subject_teachers", {
  id: uuid("id").primaryKey().defaultRandom(),
  subjectId: uuid("subject_id").notNull(),
  teacherId: uuid("teacher_id").notNull(),
  schoolId: uuid("school_id").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// ── ACTIVITY_PROVIDERS (external companies that offer extra-mural activities) ──
export const activityProviders = pgTable("activity_providers", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  contactName: text("contact_name"),
  contactEmail: text("contact_email"),
  contactPhone: text("contact_phone"),
  schoolId: uuid("school_id").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// ── ACTIVITIES (extra-mural; internal coach OR external provider) ──────────────
export const activities = pgTable("activities", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  description: text("description"),
  category: text("category"), // sport | music | cultural | academic | other
  isExternal: boolean("is_external").notNull().default(false),
  coachTeacherId: uuid("coach_teacher_id"), // profiles.id (internal coach/teacher)
  providerId: uuid("provider_id"), // activity_providers.id (external company)
  dayOfWeek: text("day_of_week"),
  startTime: text("start_time"),
  endTime: text("end_time"),
  location: text("location"),
  schoolId: uuid("school_id").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// ── ACTIVITY_SIGNUPS (a student enrolled in an activity by their parent) ───────
export const activitySignups = pgTable("activity_signups", {
  id: uuid("id").primaryKey().defaultRandom(),
  activityId: uuid("activity_id").notNull(),
  studentId: uuid("student_id").notNull(),
  parentUserId: text("parent_user_id"),
  status: text("status").notNull().default("active"), // active | cancelled
  schoolId: uuid("school_id").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Insert schemas
export const insertProfileSchema = createInsertSchema(profiles).omit({ id: true, createdAt: true });
export const insertStudentSchema = createInsertSchema(students).omit({ id: true, createdAt: true });
export const insertClassSchema = createInsertSchema(classes).omit({ id: true, createdAt: true });
export const insertSubjectSchema = createInsertSchema(subjects).omit({ id: true, createdAt: true });

// Types
export type Profile = typeof profiles.$inferSelect;
export type Student = typeof students.$inferSelect;
export type Class = typeof classes.$inferSelect;
export type Subject = typeof subjects.$inferSelect;
export type TimetableEntry = typeof timetableEntries.$inferSelect;
export type Event = typeof events.$inferSelect;
export type Approval = typeof approvals.$inferSelect;
export type Message = typeof messages.$inferSelect;
export type Announcement = typeof announcements.$inferSelect;
export type Report = typeof reports.$inferSelect;
export type FeeAccount = typeof feeAccounts.$inferSelect;
export type FeeLedgerEntry = typeof feeLedger.$inferSelect;
export type FeePayment = typeof feePayments.$inferSelect;
export type SubjectTeacher = typeof subjectTeachers.$inferSelect;
export type ActivityProvider = typeof activityProviders.$inferSelect;
export type Activity = typeof activities.$inferSelect;
export type ActivitySignup = typeof activitySignups.$inferSelect;
