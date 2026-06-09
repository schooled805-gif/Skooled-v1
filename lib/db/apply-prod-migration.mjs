import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import pg from "pg";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// The SUPABASE_*_URL secrets hold Supabase's dashboard connection TEMPLATE with a
// literal [YOUR-PASSWORD] placeholder, so we cannot use them as-is. Extract the
// real host/port/user from the template and supply the real password from
// SUPABASE_DB_PASSWORD as a discrete field (avoids URL-escaping issues).
const template = process.env.SUPABASE_DB_URL || process.env.SUPABASE_POSTGRES_URL || "";
const password = process.env.SUPABASE_DB_PASSWORD;
if (!password) { console.error("SUPABASE_DB_PASSWORD is not set"); process.exit(1); }

function parseTemplate(t) {
  // postgresql://<user>:<placeholder>@<host>:<port>/<db>... (template may concat
  // multiple URLs; we only need user + host, then force the transaction pooler).
  const m = t.match(/postgres(?:ql)?:\/\/([^:]+):[^@]*@([a-z0-9.-]*pooler\.supabase\.com)/i);
  if (!m) return null;
  return { user: m[1], host: m[2] };
}

let parsed = parseTemplate(template);

if (!parsed) {
  // Fallback: construct from project ref + known transaction-pooler convention.
  const ref = (process.env.VITE_SUPABASE_URL || "").match(/https:\/\/([a-z0-9]+)\.supabase\.co/i)?.[1];
  if (!ref) { console.error("Cannot determine Supabase project ref"); process.exit(1); }
  parsed = { user: `postgres.${ref}`, host: "aws-1-eu-west-2.pooler.supabase.com" };
}

// Session pooler (5432) is disabled for this project; only the transaction
// pooler (6543) accepts connections. Database is always "postgres".
const cfg = { user: parsed.user, host: parsed.host, port: 6543, database: "postgres" };

console.log(`Connecting: host=${cfg.host} port=${cfg.port} db=${cfg.database} user=postgres.<ref>`);

const sql = readFileSync(path.join(__dirname, "supabase-prod-migration.sql"), "utf8");

async function connectWithRetry() {
  let lastErr;
  for (let attempt = 1; attempt <= 6; attempt++) {
    const client = new pg.Client({ ...cfg, password, ssl: { rejectUnauthorized: false } });
    try {
      await client.connect();
      return client;
    } catch (err) {
      lastErr = err;
      console.log(`connect attempt ${attempt} failed: ${err.code || err.message}`);
      try { await client.end(); } catch {}
      await new Promise((r) => setTimeout(r, 800 * attempt));
    }
  }
  throw lastErr;
}

const client = await connectWithRetry();
try {
  await client.query(sql);
  console.log("Migration applied.");

  const { rows: cols } = await client.query(
    "select column_name from information_schema.columns where table_name='classes' and column_name='status'"
  );
  console.log("classes.status present:", cols.length === 1);

  const { rows: tbls } = await client.query(
    "select table_name from information_schema.tables where table_schema='public' and table_name = any($1) order by table_name",
    [["subject_teachers", "activity_providers", "activities", "activity_signups"]]
  );
  console.log("new tables present:", tbls.map((t) => t.table_name).join(", "));
} finally {
  await client.end();
}
