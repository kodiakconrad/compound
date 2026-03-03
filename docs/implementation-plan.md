# Implementation Plan — Phase 1 (Go Backend MVP)

Each step follows the BDD-first development flow from [testing-strategy.md](testing-strategy.md):
1. Write Gherkin acceptance tests (they will fail — that's the point)
2. Implement: domain model → store → DTOs → handler → route registration
3. Add unit tests for complex business logic
4. Run `make test` — acceptance tests should go green

---

## Step 1 — Project Setup & Infrastructure

No BDD here — pure infrastructure. Verify by running the server.

1. Initialize `go.mod` with dependencies:
   - `github.com/go-chi/chi/v5` — routing
   - `github.com/go-chi/cors` — CORS middleware
   - `modernc.org/sqlite` — pure-Go SQLite driver
   - `github.com/google/uuid` — UUID generation
   - `github.com/cucumber/godog` — acceptance test runner
   - `gopkg.in/yaml.v3` — YAML config
2. Write `internal/config/config.go` — YAML config loading with defaults (`server`, `database`, `log`); env var overrides: `PORT` overrides `server.port`, `DATABASE_PATH` overrides `database.path`
3. Write `internal/migration/001_initial.sql` — all `CREATE TABLE` statements from the schema
4. Write `internal/migration/migrations.go` — embedded SQL runner, `schema_migrations` tracking table
5. Write `internal/store/store.go` — `Store` struct, `DBTX` interface, `WithTx` helper
6. Write `internal/server/server.go` — HTTP server setup, middleware (logging, recovery, CORS)
7. Write `internal/server/routes.go` — route skeleton with `/api/v1` prefix and `GET /health` endpoint
8. Write `main.go` — load config, open DB, run migrations, start server

**Cloud-readiness additions (Phase 2 hybrid A+C support):**
- `github.com/go-chi/cors` middleware — allows the React Native app to call the backend regardless of host
- `PORT` env var override — required by Fly.io and similar platforms (e.g., `fly deploy` sets `$PORT` at runtime)
- `DATABASE_PATH` env var override — required for cloud deployments where the DB lives on a mounted volume
- `GET /health` route — required by cloud platform health checks; returns `200 OK` with `{"status": "ok"}`

**Verify:** `make run` starts without errors, DB file created, `GET /health` returns `{"status":"ok"}`, `GET /api/v1/` returns 404 cleanly.

---

## Step 2 — Exercise Library

**Acceptance tests first** (`tests/acceptance/features/exercises.feature`):
- Create a custom exercise — 201 with uuid in response
- Cannot create exercise without a name — 400 validation error
- Cannot create exercise with invalid tracking_type — 400 validation error
- Get exercise by uuid — 200 with full fields
- Get non-existent exercise — 404
- List exercises — 200 paginated list
- List exercises filtered by muscle_group — filtered results
- Search exercises by name — filtered results
- Update a custom exercise — 200 with updated fields
- Cannot update a prebuilt exercise — 422
- Soft delete a custom exercise — 204, hidden from list
- Cannot delete a prebuilt exercise — 422

**Implement:**
1. `internal/domain/exercise.go` — `Exercise` struct, `TrackingType` value object, `Validate()`
2. `internal/domain/errors.go` — `NotFoundError`, `ValidationError`, `ConflictError`
3. `internal/store/exercise_store.go` — `CreateExercise`, `GetExercise`, `ListExercises`, `UpdateExercise`, `DeleteExercise`
4. `internal/handler/dto/exercise.go` — `CreateExerciseRequest`, `UpdateExerciseRequest`, `ExerciseResponse`, `ToExerciseResponse`
5. `internal/handler/handler.go` — shared helpers: `respond`, `decode`, `respondError`, error mapping
6. `internal/handler/exercise_handler.go` — REST handlers
7. Register exercise routes in `routes.go`

**Unit tests** (`internal/domain/exercise_test.go`):
- `TestExercise_Validate` — empty name, invalid tracking_type, valid exercise
- `TestTrackingType_IsValid`

**Seed:** `make seed` loads ~80–100 common exercises from `internal/seed/exercises.go`.

---

## Step 3 — Programs, Templates & Workout Builder

**Acceptance tests first** (`tests/acceptance/features/programs.feature`):
- Create a program — 201 with uuid
- Create a template (`is_template=true`) — 201
- List programs — paginated list
- List templates only (`?is_template=true`) — filtered
- Get program with full tree (workouts → sections → exercises) — 200
- Deep copy a template into a new program — 201, independent copy
- Update program metadata — 200
- Soft delete a program — 204
- Cannot delete a prebuilt program — 422
- Add a workout to a program — 201
- Cannot add workout with duplicate day_number — 409
- Update a workout — 200
- Delete a workout — 204
- Reorder workouts — 200, sort_order updated
- Add a section to a workout — 201
- Reorder sections — 200
- Add an exercise to a section — 201
- Update section exercise targets — 200
- Remove an exercise from a section — 204
- Reorder exercises within a section — 200
- Cannot modify a program with an active cycle — 422

**Implement:**
1. `internal/domain/program.go` — `Program`, `ProgramWorkout`, `Section`, `SectionExercise`, `ProgressionRule`, `ProgressionStrategy` value object, aggregate invariant methods (`AddWorkout`, `AddSection`, etc.), `DeepCopy`
2. `internal/store/program_store.go` — program CRUD, `CopyProgram`
3. `internal/store/workout_store.go` — workout, section, section_exercise CRUD + reorder methods
4. `internal/handler/dto/program.go` — all program/workout/section/exercise DTOs
5. `internal/handler/program_handler.go` — all program + nested resource handlers
6. Register routes in `routes.go`

**Unit tests** (`internal/domain/program_test.go`):
- `TestProgram_AddWorkout_DuplicateDayNumber`
- `TestProgram_DeepCopy` — verify new UUIDs, independence from source
- `TestProgressionRule_NextWeight` — linear, percentage, deload trigger

**Seed:** `internal/seed/programs.go` — prebuilt templates: 5/3/1, PPL, Starting Strength.

---

## Step 4 — Cycles & Sessions

**Acceptance tests first** (`tests/acceptance/features/cycles.feature`, `sessions.feature`):
- Start a cycle from a program — 201, sessions pre-generated
- Cannot modify program while cycle is active — 422
- List cycles — paginated
- Get cycle with sessions — 200
- Pause a cycle — 200
- Resume a paused cycle — 200
- Complete a cycle — 200
- Start a session — 200, status → in_progress
- Log a set — 201 set_log created
- Log a set with a substituted exercise (different exercise_id than planned) — 201
- Complete a session — 200, status → completed
- Skip a session — 200, status → skipped
- Get session detail with target weights and logged sets — 200
- Target weight increases after successful session — verified via second session fetch
- Target weight unchanged after failed session (missed reps) — verified
- Deload applied after N consecutive failures — verified

**Implement:**
1. `internal/domain/cycle.go` — `Cycle`, `CycleStatus`, `Session`, `SessionStatus`, `SetLog`, state transition methods
2. `internal/store/cycle_store.go` — `CreateCycle`, `GetCycle`, `ListCycles`, `UpdateCycle`, session pre-generation
3. `internal/store/session_store.go` — `GetSession`, `UpdateSession`, `LogSet`
4. `internal/domain/progression.go` (or on `ProgressionRule`) — target weight calculation, consecutive failure computation from set_logs
5. `internal/handler/dto/cycle.go`, `session.go` — DTOs
6. `internal/handler/cycle_handler.go`, `session_handler.go` — handlers
7. Register routes in `routes.go`

**Unit tests** (`internal/domain/progression_test.go`):
- `TestProgressionRule_NextWeight_Linear`
- `TestProgressionRule_NextWeight_Percentage`
- `TestProgressionRule_NextWeight_Deload`
- `TestConsecutiveFailures` — various hit/miss sequences

---

## Step 5 — Progress Tracking

**Acceptance tests first** (`tests/acceptance/features/progress.feature`):
- Get exercise history — ordered list of weight/reps over time
- Get personal records — best weight per exercise
- Get summary — total sessions completed, current streak

**Implement:**
1. `internal/store/progress_store.go` — `GetExerciseHistory`, `GetPersonalRecords`, `GetSummary`
2. `internal/handler/dto/progress.go` — response DTOs
3. `internal/handler/progress_handler.go` — handlers
4. Register routes in `routes.go`

---

## Verification (all steps)

After each step:
- `make build` compiles without errors
- `make test` — all acceptance tests pass, no regressions
- `make vet` — no static analysis issues
- Manual smoke test with `curl` or a `.http` file
