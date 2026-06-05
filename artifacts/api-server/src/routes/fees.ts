import { Router } from "express";
import crypto from "node:crypto";
import { db } from "@workspace/db";
import {
  feeAccounts,
  feeLedger,
  feePayments,
  students,
  profiles,
  parentStudentLinks,
} from "@workspace/db";
import { eq, desc, and, sql } from "drizzle-orm";

const router = Router();

// ── helpers ──────────────────────────────────────────────────────────────────

function centsToDisplay(cents: number) {
  return (cents / 100).toFixed(2);
}

async function getOrCreateAccount(studentId: string, schoolId: string, exec: any = db) {
  const [existing] = await exec
    .select()
    .from(feeAccounts)
    .where(eq(feeAccounts.studentId, studentId))
    .limit(1);
  if (existing) return existing;
  const [created] = await exec
    .insert(feeAccounts)
    .values({ studentId, schoolId, balanceCents: 0 })
    .returning();
  return created;
}

async function getRequesterProfile(userId: string) {
  if (!userId) return null;
  const [p] = await db
    .select()
    .from(profiles)
    .where(eq(profiles.userId, userId))
    .limit(1);
  return p ?? null;
}

async function isLinkedParent(userId: string, studentId: string) {
  if (!userId) return false;
  const [link] = await db
    .select()
    .from(parentStudentLinks)
    .where(
      and(
        eq(parentStudentLinks.parentUserId, userId),
        eq(parentStudentLinks.studentId, studentId),
      ),
    )
    .limit(1);
  return !!link;
}

// ── provider configuration (read at request time, never at module load) ────────

function paystackSecret() {
  return process.env.PAYSTACK_SECRET_KEY ?? "";
}

function ozowConfig() {
  return {
    siteCode: process.env.OZOW_SITE_CODE ?? "",
    privateKey: process.env.OZOW_PRIVATE_KEY ?? "",
    apiKey: process.env.OZOW_API_KEY ?? "",
    isTest: (process.env.OZOW_IS_TEST ?? "true").toLowerCase() === "true",
  };
}

function providerStatus() {
  const ozow = ozowConfig();
  return {
    paystack: !!paystackSecret(),
    ozow: !!(ozow.siteCode && ozow.privateKey && ozow.apiKey),
  };
}

function sha512Lower(input: string) {
  return crypto.createHash("sha512").update(input.toLowerCase()).digest("hex");
}

function apiBaseFromReq(req: import("express").Request) {
  const proto =
    (req.headers["x-forwarded-proto"] as string | undefined)?.split(",")[0] ||
    req.protocol;
  const host = req.get("host");
  return `${proto}://${host}`;
}

// ── ACCOUNT (parent or admin) ─────────────────────────────────────────────────

/** GET /fees/account?student_id=... — balance + ledger for one student */
router.get("/fees/account", async (req, res) => {
  try {
    const userId = req.headers["x-user-id"] as string;
    const studentId = req.query.student_id as string;
    if (!studentId) { res.status(400).json({ error: "student_id required" }); return; }

    const [student] = await db.select().from(students).where(eq(students.id, studentId)).limit(1);
    if (!student) { res.status(404).json({ error: "Student not found" }); return; }

    // Authorization: linked parent OR admin of the same school
    const profile = await getRequesterProfile(userId);
    const isAdmin = profile?.role === "admin" && profile?.schoolId === student.schoolId;
    const linked = await isLinkedParent(userId, studentId);
    if (!isAdmin && !linked) { res.status(403).json({ error: "Forbidden" }); return; }

    const account = await getOrCreateAccount(studentId, student.schoolId);
    const [studentProfile] = await db.select().from(profiles).where(eq(profiles.id, student.profileId)).limit(1);

    const ledger = await db
      .select()
      .from(feeLedger)
      .where(eq(feeLedger.accountId, account.id))
      .orderBy(desc(feeLedger.createdAt));

    res.json({
      id: account.id,
      student_id: account.studentId,
      student_name: studentProfile?.fullName ?? null,
      school_id: account.schoolId,
      balance_cents: account.balanceCents,
      balance_display: centsToDisplay(account.balanceCents),
      updated_at: account.updatedAt?.toISOString() ?? null,
      ledger: ledger.map((l) => ({
        id: l.id,
        amount_cents: l.amountCents,
        amount_display: (l.amountCents >= 0 ? "+" : "") + centsToDisplay(l.amountCents),
        type: l.type,
        description: l.description,
        created_at: l.createdAt?.toISOString() ?? null,
      })),
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

/** GET /fees/accounts?school_id=... — admin: every student with their balance */
router.get("/fees/accounts", async (req, res) => {
  try {
    const userId = req.headers["x-user-id"] as string;
    const schoolId = req.query.school_id as string;
    if (!schoolId) { res.status(400).json({ error: "school_id required" }); return; }

    const profile = await getRequesterProfile(userId);
    if (!(profile?.role === "admin" && profile?.schoolId === schoolId)) {
      res.status(403).json({ error: "Forbidden" }); return;
    }

    const roster = await db.select().from(students).where(eq(students.schoolId, schoolId));
    const accounts = await db.select().from(feeAccounts).where(eq(feeAccounts.schoolId, schoolId));
    const balanceByStudent = new Map(accounts.map((a) => [a.studentId, a]));

    const enriched = await Promise.all(roster.map(async (s) => {
      const [prof] = await db.select().from(profiles).where(eq(profiles.id, s.profileId)).limit(1);
      const acc = balanceByStudent.get(s.id);
      const balanceCents = acc?.balanceCents ?? 0;
      return {
        account_id: acc?.id ?? null,
        student_id: s.id,
        student_name: prof?.fullName ?? null,
        grade: s.grade,
        balance_cents: balanceCents,
        balance_display: centsToDisplay(balanceCents),
      };
    }));

    enriched.sort((a, b) => b.balance_cents - a.balance_cents);
    res.json(enriched);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

/** POST /fees/charge — admin adds a charge or adjustment */
router.post("/fees/charge", async (req, res) => {
  try {
    const userId = req.headers["x-user-id"] as string;
    const { student_id, amount_cents, type, description } = req.body;

    if (!student_id || amount_cents === undefined || amount_cents === null) {
      res.status(400).json({ error: "student_id and amount_cents required" }); return;
    }
    const entryType = type === "adjustment" ? "adjustment" : "charge";
    const delta = Math.round(Number(amount_cents));
    if (!Number.isFinite(delta) || delta === 0) {
      res.status(400).json({ error: "amount_cents must be a non-zero integer" }); return;
    }
    if (entryType === "charge" && delta <= 0) {
      res.status(400).json({ error: "A charge amount must be greater than 0" }); return;
    }

    const [student] = await db.select().from(students).where(eq(students.id, student_id)).limit(1);
    if (!student) { res.status(404).json({ error: "Student not found" }); return; }

    const profile = await getRequesterProfile(userId);
    if (!(profile?.role === "admin" && profile?.schoolId === student.schoolId)) {
      res.status(403).json({ error: "Forbidden" }); return;
    }

    const { entry, account, newBalance } = await db.transaction(async (tx) => {
      const acct = await getOrCreateAccount(student_id, student.schoolId, tx);
      const [ledgerEntry] = await tx.insert(feeLedger).values({
        accountId: acct.id,
        studentId: student_id,
        schoolId: student.schoolId,
        amountCents: delta,
        type: entryType,
        description: description ?? (entryType === "charge" ? "Fee charge" : "Adjustment"),
        createdBy: userId ?? null,
      }).returning();
      const [updated] = await tx.update(feeAccounts)
        .set({ balanceCents: sql`${feeAccounts.balanceCents} + ${delta}`, updatedAt: new Date() })
        .where(eq(feeAccounts.id, acct.id))
        .returning();
      return { entry: ledgerEntry, account: acct, newBalance: updated.balanceCents };
    });

    res.status(201).json({
      entry_id: entry.id,
      account_id: account.id,
      student_id,
      balance_cents: newBalance,
      balance_display: centsToDisplay(newBalance),
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── PAYMENTS ───────────────────────────────────────────────────────────────────

/** GET /fees/providers — which online-payment providers are configured */
router.get("/fees/providers", async (_req, res) => {
  res.json(providerStatus());
});

/** POST /fees/pay/initiate — parent starts an online payment, returns redirect_url */
router.post("/fees/pay/initiate", async (req, res) => {
  try {
    const userId = req.headers["x-user-id"] as string;
    const { student_id, amount_cents, provider, return_url } = req.body;

    if (!student_id || !amount_cents || !provider) {
      res.status(400).json({ error: "student_id, amount_cents and provider required" }); return;
    }
    const amountCents = Math.round(Number(amount_cents));
    if (!Number.isFinite(amountCents) || amountCents <= 0) {
      res.status(400).json({ error: "amount_cents must be greater than 0" }); return;
    }
    if (provider !== "paystack" && provider !== "ozow") {
      res.status(400).json({ error: "Unsupported provider" }); return;
    }

    const [student] = await db.select().from(students).where(eq(students.id, student_id)).limit(1);
    if (!student) { res.status(404).json({ error: "Student not found" }); return; }

    // Authorization: only a linked parent may pay for a student
    const linked = await isLinkedParent(userId, student_id);
    if (!linked) { res.status(403).json({ error: "Forbidden" }); return; }

    const profile = await getRequesterProfile(userId);
    const reference = `SKOLR-${crypto.randomBytes(10).toString("hex").toUpperCase()}`;
    const successUrl = typeof return_url === "string" && return_url ? return_url : apiBaseFromReq(req);
    const notifyBase = apiBaseFromReq(req);

    // Record the intent before redirecting. Crediting happens only on webhook.
    const [payment] = await db.insert(feePayments).values({
      studentId: student_id,
      schoolId: student.schoolId,
      parentUserId: userId ?? null,
      provider,
      reference,
      amountCents,
      status: "pending",
    }).returning();

    if (provider === "paystack") {
      const key = paystackSecret();
      if (!key) { res.status(503).json({ error: "Paystack is not configured" }); return; }
      const email = profile?.email;
      if (!email) { res.status(400).json({ error: "A profile email is required for Paystack" }); return; }

      const psResp = await fetch("https://api.paystack.co/transaction/initialize", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          amount: amountCents,
          currency: "ZAR",
          reference,
          callback_url: successUrl,
          metadata: { student_id, school_id: student.schoolId, payment_id: payment.id },
        }),
      });
      const psData: any = await psResp.json().catch(() => ({}));
      if (!psResp.ok || !psData?.status || !psData?.data?.authorization_url) {
        req.log.error({ psData }, "Paystack initialize failed");
        await db.update(feePayments).set({ status: "failed", updatedAt: new Date() }).where(eq(feePayments.id, payment.id));
        res.status(502).json({ error: psData?.message ?? "Failed to initialise payment" });
        return;
      }
      res.json({ redirect_url: psData.data.authorization_url, reference });
      return;
    }

    // Ozow
    const ozow = ozowConfig();
    if (!ozow.siteCode || !ozow.privateKey || !ozow.apiKey) {
      res.status(503).json({ error: "Ozow is not configured" }); return;
    }
    const amountDecimal = (amountCents / 100).toFixed(2);
    const bankReference = "SkolrFees";
    const cancelUrl = successUrl;
    const errorUrl = successUrl;
    const notifyUrl = `${notifyBase}/api/fees/webhook/ozow`;
    const isTest = ozow.isTest ? "true" : "false";

    // Hash of the request fields in Ozow's documented order + private key.
    const hashInput =
      ozow.siteCode +
      "ZA" +
      "ZAR" +
      amountDecimal +
      reference +
      bankReference +
      cancelUrl +
      errorUrl +
      successUrl +
      notifyUrl +
      isTest +
      ozow.privateKey;
    const hashCheck = sha512Lower(hashInput);

    const ozResp = await fetch("https://api.ozow.com/postpaymentrequest", {
      method: "POST",
      headers: { ApiKey: ozow.apiKey, Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({
        countryCode: "ZA",
        currencyCode: "ZAR",
        amount: Number(amountDecimal),
        transactionReference: reference,
        bankReference,
        cancelUrl,
        errorUrl,
        successUrl,
        notifyUrl,
        isTest: ozow.isTest,
        siteCode: ozow.siteCode,
        hashCheck,
      }),
    });
    const ozData: any = await ozResp.json().catch(() => ({}));
    if (!ozResp.ok || !ozData?.url) {
      req.log.error({ ozData }, "Ozow postpaymentrequest failed");
      await db.update(feePayments).set({ status: "failed", updatedAt: new Date() }).where(eq(feePayments.id, payment.id));
      res.status(502).json({ error: ozData?.errorMessage ?? "Failed to initialise payment" });
      return;
    }
    res.json({ redirect_url: ozData.url, reference });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * Credit a verified payment to its student's account, idempotently.
 * Returns true if this call performed the credit, false if it was already done.
 */
async function creditPayment(reference: string, amountCents: number, providerReference: string) {
  const [payment] = await db.select().from(feePayments).where(eq(feePayments.reference, reference)).limit(1);
  if (!payment) return { ok: false, reason: "not_found" as const };
  if (payment.status === "complete") return { ok: false, reason: "already_done" as const };
  if (amountCents !== payment.amountCents) return { ok: false, reason: "amount_mismatch" as const };

  // Claim, ledger-write and balance update happen in one transaction so a
  // payment can never be marked complete without its credit being applied.
  return await db.transaction(async (tx) => {
    // Atomically claim the pending row so concurrent webhooks cannot double-credit.
    const claimed = await tx.update(feePayments)
      .set({ status: "complete", providerReference, updatedAt: new Date() })
      .where(and(eq(feePayments.id, payment.id), eq(feePayments.status, "pending")))
      .returning();
    if (!claimed.length) return { ok: false, reason: "already_done" as const };

    const account = await getOrCreateAccount(payment.studentId, payment.schoolId, tx);
    const delta = -payment.amountCents; // a payment reduces what is owed
    const [entry] = await tx.insert(feeLedger).values({
      accountId: account.id,
      studentId: payment.studentId,
      schoolId: payment.schoolId,
      amountCents: delta,
      type: "payment",
      description: `Online payment (${payment.provider})`,
      referenceId: payment.id,
      createdBy: "system",
    }).returning();

    await tx.update(feeAccounts)
      .set({ balanceCents: sql`${feeAccounts.balanceCents} + ${delta}`, updatedAt: new Date() })
      .where(eq(feeAccounts.id, account.id));
    await tx.update(feePayments)
      .set({ ledgerEntryId: entry.id, updatedAt: new Date() })
      .where(eq(feePayments.id, payment.id));

    return { ok: true as const };
  });
}

/** POST /fees/webhook/paystack — verified by x-paystack-signature (HMAC SHA512) */
router.post("/fees/webhook/paystack", async (req, res) => {
  try {
    const key = paystackSecret();
    if (!key) { res.status(503).json({ error: "Paystack not configured" }); return; }

    const raw = (req as unknown as { rawBody?: Buffer }).rawBody;
    const signature = req.headers["x-paystack-signature"] as string | undefined;
    if (!raw || !signature) { res.status(400).json({ error: "Missing signature" }); return; }

    const expected = crypto.createHmac("sha512", key).update(raw).digest("hex");
    const a = Buffer.from(expected);
    const b = Buffer.from(signature);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      req.log.warn("Paystack webhook signature mismatch");
      res.status(401).json({ error: "Invalid signature" }); return;
    }

    const event = req.body;
    if (event?.event === "charge.success" && event?.data?.status === "success") {
      const reference = event.data.reference as string;
      const amountCents = Number(event.data.amount);
      const providerRef = String(event.data.id ?? reference);
      const result = await creditPayment(reference, amountCents, providerRef);
      if (!result.ok && result.reason === "amount_mismatch") {
        req.log.warn({ reference }, "Paystack amount mismatch — not credited");
      }
    }
    res.json({ received: true });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

/** POST /fees/webhook/ozow — verified by SHA512 Hash of the response fields */
router.post("/fees/webhook/ozow", async (req, res) => {
  try {
    const ozow = ozowConfig();
    if (!ozow.privateKey) { res.status(503).json({ error: "Ozow not configured" }); return; }

    const b = req.body as Record<string, string>;
    const get = (k: string) => (b[k] ?? b[k.charAt(0).toLowerCase() + k.slice(1)] ?? "") as string;

    const hashInput =
      get("SiteCode") +
      get("TransactionId") +
      get("TransactionReference") +
      get("Amount") +
      get("Status") +
      get("Optional1") +
      get("Optional2") +
      get("Optional3") +
      get("Optional4") +
      get("Optional5") +
      get("CurrencyCode") +
      get("IsTest") +
      get("StatusMessage") +
      ozow.privateKey;
    const expected = sha512Lower(hashInput);
    const provided = (get("Hash") || "").toLowerCase();
    if (!provided || expected !== provided) {
      req.log.warn("Ozow webhook hash mismatch");
      res.status(401).json({ error: "Invalid hash" }); return;
    }

    if ((get("Status") || "").toLowerCase() === "complete") {
      const reference = get("TransactionReference");
      const amountCents = Math.round(parseFloat(get("Amount") || "0") * 100);
      const providerRef = get("TransactionId") || reference;
      const result = await creditPayment(reference, amountCents, providerRef);
      if (!result.ok && result.reason === "amount_mismatch") {
        req.log.warn({ reference }, "Ozow amount mismatch — not credited");
      }
    }
    res.json({ received: true });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
