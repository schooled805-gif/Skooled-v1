import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

// Replit's internal Postgres (host `helium`, or a `*.replit.*` host) is only
// reachable from inside Replit, so it must never be used from Vercel.
function isReplitInternalHost(url: string): boolean {
  return /@helium[:/]/.test(url) || /@[^/@]*\.replit\.[^/@]*/.test(url);
}

function resolveConnectionString(): string | undefined {
  const {
    DATABASE_URL,
    POSTGRES_URL,
    POSTGRES_USER,
    POSTGRES_PASSWORD,
    POSTGRES_HOST,
    POSTGRES_DATABASE,
    VERCEL,
  } = process.env;

  // Supabase's transaction pooler uses 6543; session pooler/direct use 5432.
  const fromParts = () => {
    if (
      POSTGRES_HOST &&
      POSTGRES_USER &&
      POSTGRES_PASSWORD &&
      POSTGRES_DATABASE
    ) {
      const port =
        process.env.POSTGRES_PORT ||
        (POSTGRES_HOST.includes("pooler") ? "6543" : "5432");
      // Note: we deliberately do NOT append `?sslmode=require`. Modern pg
      // (>=8.20) treats `sslmode=require` as `verify-full`, which rejects
      // Supabase's pooler certificate ("self-signed certificate in chain").
      // SSL is instead enabled via the Pool `ssl` option below.
      return `postgresql://${POSTGRES_USER}:${encodeURIComponent(
        POSTGRES_PASSWORD,
      )}@${POSTGRES_HOST}:${port}/${POSTGRES_DATABASE}`;
    }
    return undefined;
  };

  // On Vercel, prefer the Supabase integration's connection. The Replit-internal
  // DATABASE_URL (host `helium`) is unreachable from Vercel, but an *external*
  // DATABASE_URL (e.g. Supabase) is perfectly usable — fall back to it rather
  // than crashing the whole serverless function.
  if (VERCEL) {
    const supabase = POSTGRES_URL ?? fromParts();
    if (supabase) return supabase;
    if (DATABASE_URL && !isReplitInternalHost(DATABASE_URL)) return DATABASE_URL;
    console.error(
      "[db] No reachable Postgres connection on Vercel. Set POSTGRES_URL " +
        "(or POSTGRES_HOST/USER/PASSWORD/DATABASE) via the Supabase integration, " +
        "or a non-internal DATABASE_URL.",
    );
    return undefined;
  }

  if (DATABASE_URL) return DATABASE_URL;
  if (POSTGRES_URL) return POSTGRES_URL;

  const parts = fromParts();
  if (parts) return parts;

  console.error(
    "[db] DATABASE_URL is not set. Database queries will fail until a database " +
      "is provisioned.",
  );
  return undefined;
}

const rawConnectionString = resolveConnectionString();

// Supabase (and most hosted Postgres) require TLS; Replit's internal DB does not.
// Only TLS-requiring sslmodes count — `sslmode=disable`/`allow` must NOT enable
// SSL (Replit's helium DB uses `sslmode=disable` and rejects SSL connections).
const requiresSsl =
  !!rawConnectionString &&
  (/supabase\.(co|com)/.test(rawConnectionString) ||
    /sslmode=(require|prefer|verify-ca|verify-full)/i.test(rawConnectionString));

// Strip any `sslmode` query param from the connection string. Modern pg (>=8.20)
// treats `sslmode=require` as `verify-full`, which performs strict certificate
// verification and rejects Supabase's pooler cert with "self-signed certificate
// in certificate chain" — breaking EVERY query on Vercel. We enable TLS via the
// explicit Pool `ssl: { rejectUnauthorized: false }` option instead, which is the
// correct posture for Supabase's managed certs.
function stripSslMode(url: string): string {
  return url
    .replace(/([?&])sslmode=[^&]*/gi, "$1")
    .replace(/&&+/g, "&")
    .replace(/[?&]+$/g, "")
    .replace(/\?&/, "?");
}
const connectionString = rawConnectionString
  ? stripSslMode(rawConnectionString)
  : undefined;

// Never throw at module load: a missing/invalid connection must surface as a
// clean per-request error (caught by route handlers), not a serverless
// FUNCTION_INVOCATION_FAILED that takes down the entire site (frontend included).
export const pool = connectionString
  ? new Pool({
      connectionString,
      ssl: requiresSsl ? { rejectUnauthorized: false } : undefined,
    })
  : new Pool({ host: "127.0.0.1", port: 1, database: "unconfigured" });
export const db = drizzle(pool, { schema });

export * from "./schema";
