import { env } from "cloudflare:workers";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";

type RuntimeEnv = {
  DB?: D1Database;
  INVITE_PEPPER?: string;
  OPENAI_API_KEY?: string;
};

export function getD1(): D1Database {
  const db = (env as unknown as RuntimeEnv).DB;
  if (!db) throw new Error("Cloudflare D1 binding `DB` is unavailable.");
  return db;
}

export function getDb() {
  return drizzle(getD1(), { schema });
}

export function getInvitePepper(): string | null {
  return (env as unknown as RuntimeEnv).INVITE_PEPPER ?? null;
}

export function getOpenAIApiKey(): string | null {
  return (
    (env as unknown as RuntimeEnv).OPENAI_API_KEY ??
    (typeof process !== "undefined" ? process.env.OPENAI_API_KEY : undefined) ??
    null
  );
}

let initialized: Promise<void> | null = null;

export function ensureDatabase(): Promise<void> {
  if (initialized) return initialized;
  initialized = initializeDatabase().catch((error) => {
    initialized = null;
    throw error;
  });
  return initialized;
}

async function initializeDatabase() {
  const db = getD1();
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS profiles (
      user_id TEXT PRIMARY KEY,
      email TEXT NOT NULL,
      display_name TEXT NOT NULL,
      role TEXT CHECK (role IN ('crew','partner') OR role IS NULL),
      airline TEXT,
      base_airport TEXT,
      schedule_tz TEXT NOT NULL DEFAULT 'Asia/Seoul',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deletion_requested_at TEXT
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS duties (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES profiles(user_id),
      type TEXT NOT NULL CHECK (type IN ('flight','standby','off','layover','training','leave')),
      roster_month TEXT NOT NULL,
      start_date TEXT,
      end_date TEXT,
      start_at TEXT,
      end_at TEXT,
      event_tz TEXT,
      flight_no TEXT,
      dep_airport TEXT,
      arr_airport TEXT,
      aircraft TEXT,
      layover_city TEXT,
      hotel_name TEXT,
      note TEXT,
      version INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS notification_preferences (
      user_id TEXT PRIMARY KEY REFERENCES profiles(user_id),
      all_enabled INTEGER NOT NULL DEFAULT 1,
      own_flight_pre INTEGER NOT NULL DEFAULT 1,
      partner_flight_pre INTEGER NOT NULL DEFAULT 1,
      partner_flight_post INTEGER NOT NULL DEFAULT 1,
      roster_changed INTEGER NOT NULL DEFAULT 1,
      shared_off_d1 INTEGER NOT NULL DEFAULT 1,
      hide_details INTEGER NOT NULL DEFAULT 1,
      notification_tz TEXT NOT NULL DEFAULT 'auto',
      updated_at TEXT NOT NULL
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS invite_codes (
      id TEXT PRIMARY KEY,
      issuer_user_id TEXT NOT NULL REFERENCES profiles(user_id),
      code_hash TEXT NOT NULL,
      code_hint TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      used_at TEXT,
      revoked_at TEXT
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS connections (
      id TEXT PRIMARY KEY,
      user_low_id TEXT NOT NULL REFERENCES profiles(user_id),
      user_high_id TEXT NOT NULL REFERENCES profiles(user_id),
      status TEXT NOT NULL DEFAULT 'active',
      linked_at TEXT NOT NULL,
      unlinked_at TEXT
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS active_memberships (
      user_id TEXT PRIMARY KEY REFERENCES profiles(user_id),
      connection_id TEXT NOT NULL REFERENCES connections(id),
      created_at TEXT NOT NULL
    )`),
    db.prepare(
      "CREATE INDEX IF NOT EXISTS idx_duties_user_roster ON duties(user_id, roster_month)",
    ),
    db.prepare(
      "CREATE INDEX IF NOT EXISTS idx_duties_user_start_date ON duties(user_id, start_date)",
    ),
    db.prepare(
      "CREATE INDEX IF NOT EXISTS idx_duties_user_start_at ON duties(user_id, start_at)",
    ),
    db.prepare(
      "CREATE UNIQUE INDEX IF NOT EXISTS idx_invite_codes_hash ON invite_codes(code_hash)",
    ),
    db.prepare(
      "CREATE INDEX IF NOT EXISTS idx_invite_codes_issuer_active ON invite_codes(issuer_user_id, expires_at)",
    ),
    db.prepare(
      "CREATE UNIQUE INDEX IF NOT EXISTS idx_connections_pair ON connections(user_low_id, user_high_id)",
    ),
    db.prepare(
      "CREATE INDEX IF NOT EXISTS idx_connections_low_status ON connections(user_low_id, status)",
    ),
    db.prepare(
      "CREATE INDEX IF NOT EXISTS idx_connections_high_status ON connections(user_high_id, status)",
    ),
    db.prepare(
      "CREATE INDEX IF NOT EXISTS idx_active_memberships_connection ON active_memberships(connection_id)",
    ),
  ]);
  await db.prepare("PRAGMA optimize").run();
}
