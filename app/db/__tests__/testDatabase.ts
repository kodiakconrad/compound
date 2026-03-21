// Test adapter: wraps better-sqlite3 to mimic expo-sqlite's synchronous API.
// This lets repository code (which calls getDatabase()) run unchanged in Jest.

import Database from "better-sqlite3";

// ---------------------------------------------------------------------------
// Migration SQL — copied from migrate.ts MIGRATION_001
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

// ---------------------------------------------------------------------------
// Adapter class — maps expo-sqlite synchronous API onto better-sqlite3
// ---------------------------------------------------------------------------

export class TestDatabase {
  private db: Database.Database;

  constructor() {
    this.db = new Database(":memory:");
    this.db.pragma("foreign_keys = ON");
    this.db.pragma("journal_mode = WAL");
  }

  getAllSync<T>(sql: string, ...params: unknown[]): T[] {
    const stmt = this.db.prepare(sql);
    return stmt.all(...params) as T[];
  }

  getFirstSync<T>(sql: string, ...params: unknown[]): T | null {
    const stmt = this.db.prepare(sql);
    const row = stmt.get(...params) as T | undefined;
    return row ?? null;
  }

  runSync(sql: string, ...params: unknown[]): { changes: number; lastInsertRowId: number } {
    const stmt = this.db.prepare(sql);
    const result = stmt.run(...params);
    return {
      changes: result.changes,
      lastInsertRowId: Number(result.lastInsertRowid),
    };
  }

  execSync(sql: string): void {
    this.db.exec(sql);
  }

  withTransactionSync(fn: () => void): void {
    const transaction = this.db.transaction(fn);
    transaction();
  }

  /** Close the database (call in afterEach for cleanup). */
  close(): void {
    this.db.close();
  }
}

// ---------------------------------------------------------------------------
// setupTestDB — call in beforeEach to get a fresh database per test
// ---------------------------------------------------------------------------

export function setupTestDB(): TestDatabase {
  const testDb = new TestDatabase();
  testDb.execSync(MIGRATION_001);

  // Mock getDatabase to return our test adapter
  jest.spyOn(
    require("../database"),
    "getDatabase"
  ).mockReturnValue(testDb);

  return testDb;
}
