# Architecture

## Data Model

### Hierarchy

```
Template → (user creates a Program from a template or from scratch)
Program
  └── Workouts (one per day, ordered)
        └── Sections (compound, isolation, burnout, etc.)
              └── Exercises (with target sets, reps, weight)
        └── Rest Periods (between sections or exercises)

Program → (user starts running it) → Cycle
  └── Sessions (one per workout in the program)
        └── Set Logs (actual reps completed, weight used)
```

### SQLite Tables

```sql
exercises
  id              TEXT PRIMARY KEY
  name            TEXT NOT NULL
  muscle_group    TEXT            -- chest, back, legs, shoulders, biceps, triceps, core, cardio, other
  equipment       TEXT            -- barbell, dumbbell, cable, machine, bodyweight, band, kettlebell, other
  notes           TEXT
  is_custom       INTEGER DEFAULT 1  -- 0 = from seed data, 1 = user-created
  created_at      INTEGER NOT NULL   -- unix ms

templates
  id              TEXT PRIMARY KEY
  name            TEXT NOT NULL
  description     TEXT
  is_prebuilt     INTEGER DEFAULT 0
  author          TEXT
  created_at      INTEGER NOT NULL

programs
  id              TEXT PRIMARY KEY
  name            TEXT NOT NULL
  description     TEXT
  template_id     TEXT REFERENCES templates(id)  -- nullable; set if created from a template
  created_at      INTEGER NOT NULL
  updated_at      INTEGER NOT NULL

program_workouts
  id              TEXT PRIMARY KEY
  program_id      TEXT NOT NULL REFERENCES programs(id) ON DELETE CASCADE
  name            TEXT NOT NULL
  day_number      INTEGER NOT NULL
  sort_order      INTEGER NOT NULL

sections
  id              TEXT PRIMARY KEY
  program_workout_id TEXT NOT NULL REFERENCES program_workouts(id) ON DELETE CASCADE
  name            TEXT NOT NULL     -- compound, isolation, burnout, warmup, cooldown, etc.
  sort_order      INTEGER NOT NULL

section_exercises
  id              TEXT PRIMARY KEY
  section_id      TEXT NOT NULL REFERENCES sections(id) ON DELETE CASCADE
  exercise_id     TEXT NOT NULL REFERENCES exercises(id)
  target_sets     INTEGER
  target_reps     INTEGER
  target_weight   REAL
  sort_order      INTEGER NOT NULL
  notes           TEXT

rest_periods
  id              TEXT PRIMARY KEY
  program_workout_id TEXT NOT NULL REFERENCES program_workouts(id) ON DELETE CASCADE
  after_section_id   TEXT REFERENCES sections(id)           -- nullable
  after_exercise_id  TEXT REFERENCES section_exercises(id)   -- nullable
  duration_seconds   INTEGER NOT NULL

cycles
  id              TEXT PRIMARY KEY
  program_id      TEXT NOT NULL REFERENCES programs(id)
  started_at      INTEGER NOT NULL
  completed_at    INTEGER           -- nullable, set on completion
  status          TEXT NOT NULL DEFAULT 'active'  -- active, paused, completed

sessions
  id              TEXT PRIMARY KEY
  cycle_id        TEXT NOT NULL REFERENCES cycles(id) ON DELETE CASCADE
  program_workout_id TEXT NOT NULL REFERENCES program_workouts(id)
  started_at      INTEGER
  completed_at    INTEGER
  notes           TEXT

set_logs
  id              TEXT PRIMARY KEY
  session_id      TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE
  exercise_id     TEXT NOT NULL REFERENCES exercises(id)
  section_exercise_id TEXT REFERENCES section_exercises(id)
  set_number      INTEGER NOT NULL
  target_reps     INTEGER
  actual_reps     INTEGER
  weight          REAL
  rpe             REAL              -- rate of perceived exertion (optional)
  completed_at    INTEGER NOT NULL
```

### Weight Progression Logic

When generating a new session, the system looks at the previous session's set_logs for that exercise:
- If the user completed all target reps across all sets → increase weight by a configurable increment
- If the user failed to complete target reps → keep same weight (or deload after N consecutive failures)
- Increments are per-exercise (e.g., 5lb for barbell compounds, 2.5lb for isolation)

## Go Backend Structure

```
/compound (repo root)
  go.mod
  main.go                    — entry point, starts HTTP server

  internal/
    server/
      server.go              — HTTP server setup, middleware
      routes.go              — route registration

    handler/
      exercises.go           — CRUD handlers for exercises
      templates.go           — template CRUD + listing prebuilts
      programs.go            — program CRUD (create from template or scratch)
      workouts.go            — workout/section/exercise management within a program
      cycles.go              — start/pause/complete cycles
      sessions.go            — session management, set logging
      progress.go            — progress queries (stats, PRs, history)

    model/
      exercise.go
      template.go
      program.go
      workout.go             — includes Section, SectionExercise, RestPeriod
      cycle.go
      session.go             — includes SetLog

    store/
      sqlite.go              — DB connection, migrations
      exercise_store.go
      template_store.go
      program_store.go
      workout_store.go
      cycle_store.go
      session_store.go
      progress_store.go

    migration/
      migrations.go          — embedded SQL migrations
      001_initial.sql

    seed/
      seed.go                — seed exercises + prebuilt templates (5/3/1, PPL, Starting Strength)
      exercises.go           — ~80-100 common exercises
      programs.go            — prebuilt program definitions
```

## REST API Endpoints

```
# Exercises
GET    /api/exercises                  — list (with search, filter by muscle_group/equipment)
GET    /api/exercises/{id}             — get one
POST   /api/exercises                  — create custom exercise
PUT    /api/exercises/{id}             — update
DELETE /api/exercises/{id}             — delete (custom only)

# Templates
GET    /api/templates                  — list all (prebuilt + user-created)
GET    /api/templates/{id}             — get with full program structure
POST   /api/templates                  — create from existing program
POST   /api/templates/{id}/create-program — create a new program from this template

# Programs
GET    /api/programs                   — list user's programs
GET    /api/programs/{id}              — get with full workout/section/exercise tree
POST   /api/programs                   — create empty program
PUT    /api/programs/{id}              — update program metadata
DELETE /api/programs/{id}              — delete program

# Workouts (within a program)
POST   /api/programs/{id}/workouts                — add workout day
PUT    /api/programs/{id}/workouts/{wid}          — update workout
DELETE /api/programs/{id}/workouts/{wid}          — delete workout

# Sections (within a workout)
POST   /api/programs/{id}/workouts/{wid}/sections              — add section
PUT    /api/programs/{id}/workouts/{wid}/sections/{sid}        — update
DELETE /api/programs/{id}/workouts/{wid}/sections/{sid}        — delete

# Section Exercises
POST   /api/programs/{id}/workouts/{wid}/sections/{sid}/exercises        — add exercise
PUT    /api/programs/{id}/workouts/{wid}/sections/{sid}/exercises/{eid}  — update sets/reps/weight
DELETE /api/programs/{id}/workouts/{wid}/sections/{sid}/exercises/{eid}  — delete

# Cycles
POST   /api/programs/{id}/start        — start a cycle from a program
GET    /api/cycles                      — list cycles (active, completed)
GET    /api/cycles/{id}                 — get cycle with sessions
PUT    /api/cycles/{id}                 — pause/complete cycle

# Sessions
GET    /api/cycles/{cid}/sessions/{sid}          — get session detail
POST   /api/cycles/{cid}/sessions/{sid}/start    — start a session
POST   /api/cycles/{cid}/sessions/{sid}/sets     — log a set
PUT    /api/cycles/{cid}/sessions/{sid}/complete  — complete session

# Progress
GET    /api/progress/exercise/{id}     — history for one exercise (weight, volume over time)
GET    /api/progress/prs               — personal records across exercises
GET    /api/progress/summary           — overall stats (total sessions, streak, etc.)
```
