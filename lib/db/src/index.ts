import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

function resolveConnectionString(): string {
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
      return `postgresql://${POSTGRES_USER}:${encodeURIComponent(
        POSTGRES_PASSWORD,
      )}@${POSTGRES_HOST}:${port}/${POSTGRES_DATABASE}?sslmode=require`;
    }
    return undefined;
  };

  // On Vercel, the Replit-internal DATABASE_URL (host `helium`) is unreachable.
  // Always use the Supabase integration's connection; never fall back to a stale
  // DATABASE_URL. Fail fast with a clear error if it is missing.
  if (VERCEL) {
    const supabase = POSTGRES_URL ?? fromParts();
    if (supabase) return supabase;
    throw new Error(
      "On Vercel, POSTGRES_URL (or POSTGRES_HOST/USER/PASSWORD/DATABASE) must be " +
        "set by the Supabase integration. The Replit DATABASE_URL is not reachable.",
    );
  }

  if (DATABASE_URL) return DATABASE_URL;
  if (POSTGRES_URL) return POSTGRES_URL;

  const parts = fromParts();
  if (parts) return parts;

  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

const connectionString = resolveConnectionString();

// Supabase (and most hosted Postgres) require TLS; Replit's internal DB does not.
const requiresSsl =
  /supabase\.(co|com)/.test(connectionString) ||
  /sslmode=require/.test(connectionString);

export const pool = new Pool({
  connectionString,
  ssl: requiresSsl ? { rejectUnauthorized: false } : undefined,
});
export const db = drizzle(pool, { schema });

export * from "./schema";
