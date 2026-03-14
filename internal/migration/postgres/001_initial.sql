-- 001_initial.sql — Full schema for Compound workout tracker (Postgres).
-- Postgres equivalent of ../001_initial.sql (SQLite).
-- Key differences: GENERATED ALWAYS AS IDENTITY, TIMESTAMPTZ, UUID type, native BOOLEAN, DOUBLE PRECISION.

CREATE TABLE IF NOT EXISTS exercises (
    id              INTEGER  GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    uuid            UUID     UNIQUE NOT NULL,
    name            TEXT     NOT NULL,
    muscle_group    TEXT,
    equipment       TEXT,
    tracking_type   TEXT     NOT NULL DEFAULT 'weight_reps',
    notes           TEXT,
    is_custom       BOOLEAN  NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL,
    updated_at      TIMESTAMPTZ NOT NULL,
    deleted_at      TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS programs (
    id              INTEGER  GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    uuid            UUID     UNIQUE NOT NULL,
    name            TEXT     NOT NULL,
    description     TEXT,
    is_prebuilt     BOOLEAN  NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL,
    updated_at      TIMESTAMPTZ NOT NULL,
    deleted_at      TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS program_workouts (
    id              INTEGER  GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    uuid            UUID     UNIQUE NOT NULL,
    program_id      INTEGER  NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
    name            TEXT     NOT NULL,
    day_number      INTEGER  NOT NULL,
    sort_order      INTEGER  NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL,
    updated_at      TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS sections (
    id                  INTEGER  GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    uuid                UUID     UNIQUE NOT NULL,
    program_workout_id  INTEGER  NOT NULL REFERENCES program_workouts(id) ON DELETE CASCADE,
    name                TEXT     NOT NULL,
    sort_order          INTEGER  NOT NULL,
    rest_seconds        INTEGER,
    created_at          TIMESTAMPTZ NOT NULL,
    updated_at          TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS section_exercises (
    id              INTEGER  GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    uuid            UUID     UNIQUE NOT NULL,
    section_id      INTEGER  NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
    exercise_id     INTEGER  NOT NULL REFERENCES exercises(id),
    target_sets     INTEGER,
    target_reps     INTEGER,
    target_weight   DOUBLE PRECISION,
    target_duration INTEGER,
    target_distance DOUBLE PRECISION,
    sort_order      INTEGER  NOT NULL,
    notes           TEXT,
    created_at      TIMESTAMPTZ NOT NULL,
    updated_at      TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS progression_rules (
    id                  INTEGER  GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    uuid                UUID     UNIQUE NOT NULL,
    section_exercise_id INTEGER  NOT NULL UNIQUE REFERENCES section_exercises(id) ON DELETE CASCADE,
    strategy            TEXT     NOT NULL,
    increment           DOUBLE PRECISION,
    increment_pct       DOUBLE PRECISION,
    deload_threshold    INTEGER  NOT NULL DEFAULT 3,
    deload_pct          DOUBLE PRECISION NOT NULL DEFAULT 10,
    created_at          TIMESTAMPTZ NOT NULL,
    updated_at          TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS cycles (
    id              INTEGER  GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    uuid            UUID     UNIQUE NOT NULL,
    program_id      INTEGER  NOT NULL REFERENCES programs(id),
    status          TEXT     NOT NULL DEFAULT 'active',
    started_at      TIMESTAMPTZ,
    completed_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL,
    updated_at      TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
    id                  INTEGER  GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    uuid                UUID     UNIQUE NOT NULL,
    cycle_id            INTEGER  NOT NULL REFERENCES cycles(id) ON DELETE CASCADE,
    program_workout_id  INTEGER  NOT NULL REFERENCES program_workouts(id),
    sort_order          INTEGER  NOT NULL,
    status              TEXT     NOT NULL DEFAULT 'pending',
    started_at          TIMESTAMPTZ,
    completed_at        TIMESTAMPTZ,
    notes               TEXT,
    created_at          TIMESTAMPTZ NOT NULL,
    updated_at          TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS set_logs (
    id                  INTEGER  GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    uuid                UUID     UNIQUE NOT NULL,
    session_id          INTEGER  NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    exercise_id         INTEGER  NOT NULL REFERENCES exercises(id),
    section_exercise_id INTEGER  REFERENCES section_exercises(id),
    set_number          INTEGER  NOT NULL,
    target_reps         INTEGER,
    actual_reps         INTEGER,
    weight              DOUBLE PRECISION,
    duration            INTEGER,
    distance            DOUBLE PRECISION,
    rpe                 DOUBLE PRECISION,
    completed_at        TIMESTAMPTZ NOT NULL,
    created_at          TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS idempotency_keys (
    id              INTEGER  GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    key             TEXT     UNIQUE NOT NULL,
    method          TEXT     NOT NULL,
    path            TEXT     NOT NULL,
    status          INTEGER  NOT NULL,
    response        TEXT     NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL,
    expires_at      TIMESTAMPTZ NOT NULL
);
