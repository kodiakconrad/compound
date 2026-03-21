import { type SQLiteDatabase } from "expo-sqlite";
import { getDatabase } from "./database";

// Each migration is a numbered SQL string. The migration runner applies them
// in order and tracks which have been applied in a schema_migrations table.
// Migrations must be additive — avoid destructive DDL (drops, renames).

interface Migration {
  version: number;
  sql?: string;
  fn?: () => void;
}

// ---------------------------------------------------------------------------
// Migration 001 — Initial schema
// Mirrors the Go backend schema.sql minus idempotency_keys (server-only).
// Timestamps are stored as ISO 8601 TEXT (not TIMESTAMP) since this is
// on-device SQLite with no type affinity expectations from sqlc.
// ---------------------------------------------------------------------------
const MIGRATION_001 = `
CREATE TABLE IF NOT EXISTS exercises (
    id              INTEGER  PRIMARY KEY AUTOINCREMENT,
    uuid            TEXT     UNIQUE NOT NULL,
    name            TEXT     NOT NULL,
    muscle_group    TEXT,
    equipment       TEXT,
    tracking_type   TEXT     NOT NULL DEFAULT 'weight_reps',
    notes           TEXT,
    is_custom       INTEGER  NOT NULL DEFAULT 1,
    created_at      TEXT     NOT NULL,
    updated_at      TEXT     NOT NULL,
    deleted_at      TEXT
);

CREATE TABLE IF NOT EXISTS programs (
    id              INTEGER  PRIMARY KEY AUTOINCREMENT,
    uuid            TEXT     UNIQUE NOT NULL,
    name            TEXT     NOT NULL,
    description     TEXT,
    is_prebuilt     INTEGER  NOT NULL DEFAULT 0,
    created_at      TEXT     NOT NULL,
    updated_at      TEXT     NOT NULL,
    deleted_at      TEXT
);

CREATE TABLE IF NOT EXISTS program_workouts (
    id              INTEGER  PRIMARY KEY AUTOINCREMENT,
    uuid            TEXT     UNIQUE NOT NULL,
    program_id      INTEGER  NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
    name            TEXT     NOT NULL,
    day_number      INTEGER  NOT NULL,
    sort_order      INTEGER  NOT NULL,
    created_at      TEXT     NOT NULL,
    updated_at      TEXT     NOT NULL
);

CREATE TABLE IF NOT EXISTS sections (
    id                  INTEGER  PRIMARY KEY AUTOINCREMENT,
    uuid                TEXT     UNIQUE NOT NULL,
    program_workout_id  INTEGER  NOT NULL REFERENCES program_workouts(id) ON DELETE CASCADE,
    name                TEXT     NOT NULL,
    sort_order          INTEGER  NOT NULL,
    rest_seconds        INTEGER,
    created_at          TEXT     NOT NULL,
    updated_at          TEXT     NOT NULL
);

CREATE TABLE IF NOT EXISTS section_exercises (
    id              INTEGER  PRIMARY KEY AUTOINCREMENT,
    uuid            TEXT     UNIQUE NOT NULL,
    section_id      INTEGER  NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
    exercise_id     INTEGER  NOT NULL REFERENCES exercises(id),
    target_sets     INTEGER,
    target_reps     INTEGER,
    target_weight   REAL,
    target_duration INTEGER,
    target_distance REAL,
    sort_order      INTEGER  NOT NULL,
    notes           TEXT,
    set_scheme      TEXT,
    created_at      TEXT     NOT NULL,
    updated_at      TEXT     NOT NULL
);

CREATE TABLE IF NOT EXISTS progression_rules (
    id                  INTEGER  PRIMARY KEY AUTOINCREMENT,
    uuid                TEXT     UNIQUE NOT NULL,
    section_exercise_id INTEGER  NOT NULL UNIQUE REFERENCES section_exercises(id) ON DELETE CASCADE,
    strategy            TEXT     NOT NULL,
    increment           REAL,
    increment_pct       REAL,
    deload_threshold    INTEGER  NOT NULL DEFAULT 3,
    deload_pct          REAL     NOT NULL DEFAULT 10,
    created_at          TEXT     NOT NULL,
    updated_at          TEXT     NOT NULL
);

CREATE TABLE IF NOT EXISTS cycles (
    id              INTEGER  PRIMARY KEY AUTOINCREMENT,
    uuid            TEXT     UNIQUE NOT NULL,
    program_id      INTEGER  NOT NULL REFERENCES programs(id),
    status          TEXT     NOT NULL DEFAULT 'active',
    started_at      TEXT,
    completed_at    TEXT,
    created_at      TEXT     NOT NULL,
    updated_at      TEXT     NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
    id                  INTEGER  PRIMARY KEY AUTOINCREMENT,
    uuid                TEXT     UNIQUE NOT NULL,
    cycle_id            INTEGER  NOT NULL REFERENCES cycles(id) ON DELETE CASCADE,
    program_workout_id  INTEGER  NOT NULL REFERENCES program_workouts(id),
    sort_order          INTEGER  NOT NULL,
    status              TEXT     NOT NULL DEFAULT 'pending',
    started_at          TEXT,
    completed_at        TEXT,
    notes               TEXT,
    created_at          TEXT     NOT NULL,
    updated_at          TEXT     NOT NULL
);

CREATE TABLE IF NOT EXISTS set_logs (
    id                  INTEGER  PRIMARY KEY AUTOINCREMENT,
    uuid                TEXT     UNIQUE NOT NULL,
    session_id          INTEGER  NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    exercise_id         INTEGER  NOT NULL REFERENCES exercises(id),
    section_exercise_id INTEGER  REFERENCES section_exercises(id),
    set_number          INTEGER  NOT NULL,
    target_reps         INTEGER,
    actual_reps         INTEGER,
    weight              REAL,
    duration            INTEGER,
    distance            REAL,
    rpe                 REAL,
    completed_at        TEXT     NOT NULL,
    created_at          TEXT     NOT NULL
);
`;

const migrations: Migration[] = [
  { version: 1, sql: MIGRATION_001 },
  { version: 2, fn: () => require("./seed_exercises").seedExercises() },
  { version: 3, fn: () => require("./seed_programs").seedPrograms() },
];

function ensureMigrationsTable(db: SQLiteDatabase): void {
  db.execSync(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version     INTEGER PRIMARY KEY,
      applied_at  TEXT    NOT NULL
    );
  `);
}

function getAppliedVersions(db: SQLiteDatabase): Set<number> {
  const rows = db.getAllSync<{ version: number }>(
    "SELECT version FROM schema_migrations ORDER BY version"
  );
  return new Set(rows.map((r) => r.version));
}

export function runMigrations(): void {
  const db = getDatabase();
  ensureMigrationsTable(db);
  const applied = getAppliedVersions(db);

  for (const migration of migrations) {
    if (applied.has(migration.version)) continue;

    db.execSync("BEGIN");
    try {
      if (migration.sql) db.execSync(migration.sql);
      if (migration.fn) migration.fn();
      db.runSync(
        "INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)",
        migration.version,
        new Date().toISOString()
      );
      db.execSync("COMMIT");
    } catch (err) {
      db.execSync("ROLLBACK");
      throw new Error(
        `Migration ${migration.version} failed: ${err instanceof Error ? err.message : err}`
      );
    }
  }
}
