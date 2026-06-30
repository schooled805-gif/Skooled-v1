import nodemailer, { type Transporter } from "nodemailer";
import { logger } from "./logger";

/**
 * Lightweight transactional-email helper. Sending is driven entirely by SMTP
 * environment variables so the app can run (and the rest of a feature can work)
 * even when no mail provider is configured yet:
 *
 *   SMTP_HOST   - smtp server hostname (required to enable sending)
 *   SMTP_PORT   - port (default 587)
 *   SMTP_USER   - username
 *   SMTP_PASS   - password / app password
 *   SMTP_SECURE - "true" to use TLS on connect (default: true when port 465)
 *   EMAIL_FROM  - the From address (falls back to SMTP_USER)
 *
 * When SMTP is not configured, sendEmail() logs a warning and resolves false
 * rather than throwing, so callers (e.g. canteen order placement) never fail
 * just because email isn't set up.
 */

let cachedTransporter: Transporter | null | undefined;

export function isEmailConfigured(): boolean {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

function getTransporter(): Transporter | null {
  if (cachedTransporter !== undefined) return cachedTransporter;
  if (!isEmailConfigured()) {
    cachedTransporter = null;
    return null;
  }
  const port = Number(process.env.SMTP_PORT ?? 587);
  const secure = process.env.SMTP_SECURE
    ? process.env.SMTP_SECURE === "true"
    : port === 465;
  cachedTransporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
  return cachedTransporter;
}

export interface SendEmailInput {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

/** Send an email. Returns true if sent, false if email isn't configured or fails. */
export async function sendEmail(input: SendEmailInput): Promise<boolean> {
  const transporter = getTransporter();
  if (!transporter) {
    logger.warn(
      { to: input.to, subject: input.subject },
      "Email not sent: SMTP is not configured (set SMTP_HOST/SMTP_USER/SMTP_PASS).",
    );
    return false;
  }
  try {
    await transporter.sendMail({
      from: process.env.EMAIL_FROM ?? process.env.SMTP_USER,
      to: input.to,
      subject: input.subject,
      text: input.text,
      html: input.html ?? undefined,
    });
    return true;
  } catch (err) {
    logger.error({ err, to: input.to }, "Failed to send email");
    return false;
  }
}
