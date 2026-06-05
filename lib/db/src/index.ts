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

  // On Vercel, always prefer the Supabase integration's connection string,
  // even if a stale DATABASE_URL (e.g. Replit's internal DB) is present.
  if (VERCEL && POSTGRES_URL) return POSTGRES_URL;

  if (DATABASE_URL) return DATABASE_URL;
  if (POSTGRES_URL) return POSTGRES_URL;

  if (POSTGRES_HOST && POSTGRES_USER && POSTGRES_PASSWORD && POSTGRES_DATABASE) {
    return `postgresql://${POSTGRES_USER}:${encodeURIComponent(
      POSTGRES_PASSWORD,
    )}@${POSTGRES_HOST}:5432/${POSTGRES_DATABASE}?sslmode=require`;
  }

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
