-- Source of truth for sqlc. Keep in sync with internal/migration/*.sql files.
-- Add new tables here whenever a new migration is added.
-- Do NOT include the schema_migrations table — that is managed by the migration runner only.

CREATE TABLE IF NOT EXISTS exercises (
    id              INTEGER  PRIMARY KEY AUTOINCREMENT,
    uuid            TEXT     UNIQUE NOT NULL,
    name            TEXT     NOT NULL,
    muscle_group    TEXT,
    equipment       TEXT,
    tracking_type   TEXT     NOT NULL DEFAULT 'weight_reps',
    notes           TEXT,
    is_custom       BOOLEAN  NOT NULL DEFAULT TRUE,
    created_at      DATETIME NOT NULL,
    updated_at      DATETIME NOT NULL,
    deleted_at      DATETIME
);

CREATE TABLE IF NOT EXISTS programs (
    id              INTEGER  PRIMARY KEY AUTOINCREMENT,
    uuid            TEXT     UNIQUE NOT NULL,
    name            TEXT     NOT NULL,
    description     TEXT,
    is_prebuilt     BOOLEAN  NOT NULL DEFAULT FALSE,
    created_at      DATETIME NOT NULL,
    updated_at      DATETIME NOT NULL,
    deleted_at      DATETIME
);

CREATE TABLE IF NOT EXISTS program_workouts (
    id              INTEGER  PRIMARY KEY AUTOINCREMENT,
    uuid            TEXT     UNIQUE NOT NULL,
    program_id      INTEGER  NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
    name            TEXT     NOT NULL,
    day_number      INTEGER  NOT NULL,
    sort_order      INTEGER  NOT NULL,
    created_at      DATETIME NOT NULL,
    updated_at      DATETIME NOT NULL
);

CREATE TABLE IF NOT EXISTS sections (
    id                  INTEGER  PRIMARY KEY AUTOINCREMENT,
    uuid                TEXT     UNIQUE NOT NULL,
    program_workout_id  INTEGER  NOT NULL REFERENCES program_workouts(id) ON DELETE CASCADE,
    name                TEXT     NOT NULL,
    sort_order          INTEGER  NOT NULL,
    rest_seconds        INTEGER,
    created_at          DATETIME NOT NULL,
    updated_at          DATETIME NOT NULL
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
    created_at      DATETIME NOT NULL,
    updated_at      DATETIME NOT NULL
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
    created_at          DATETIME NOT NULL,
    updated_at          DATETIME NOT NULL
);

CREATE TABLE IF NOT EXISTS cycles (
    id              INTEGER  PRIMARY KEY AUTOINCREMENT,
    uuid            TEXT     UNIQUE NOT NULL,
    program_id      INTEGER  NOT NULL REFERENCES programs(id),
    status          TEXT     NOT NULL DEFAULT 'active',
    started_at      DATETIME,
    completed_at    DATETIME,
    created_at      DATETIME NOT NULL,
    updated_at      DATETIME NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
    id                  INTEGER  PRIMARY KEY AUTOINCREMENT,
    uuid                TEXT     UNIQUE NOT NULL,
    cycle_id            INTEGER  NOT NULL REFERENCES cycles(id) ON DELETE CASCADE,
    program_workout_id  INTEGER  NOT NULL REFERENCES program_workouts(id),
    sort_order          INTEGER  NOT NULL,
    status              TEXT     NOT NULL DEFAULT 'pending',
    started_at          DATETIME,
    completed_at        DATETIME,
    notes               TEXT,
    created_at          DATETIME NOT NULL,
    updated_at          DATETIME NOT NULL
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
    completed_at        DATETIME NOT NULL,
    created_at          DATETIME NOT NULL
);

CREATE TABLE IF NOT EXISTS idempotency_keys (
    id              INTEGER  PRIMARY KEY AUTOINCREMENT,
    key             TEXT     UNIQUE NOT NULL,
    method          TEXT     NOT NULL,
    path            TEXT     NOT NULL,
    status          INTEGER  NOT NULL,
    response        TEXT     NOT NULL,
    created_at      DATETIME NOT NULL,
    expires_at      DATETIME NOT NULL
);
