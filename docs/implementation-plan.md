# Implementation Plan — Phase 1 (Go Backend MVP)

## Step 1 — Project Setup & Database

1. Update `go.mod` with dependencies (`go-chi/chi/v5` for routing, `modernc.org/sqlite` for pure-Go SQLite)
2. Create `internal/store/sqlite.go` — DB connection, migration runner
3. Create `internal/migration/001_initial.sql` — all tables
4. Create `internal/server/server.go` and `internal/server/routes.go` — HTTP server setup
5. Update `main.go` — init DB, run migrations, start HTTP server
6. **Verify**: `go run main.go` starts server, DB file created with tables

## Step 2 — Exercise Library

1. Define `internal/model/exercise.go`
2. Implement `internal/store/exercise_store.go` — CRUD + search
3. Implement `internal/handler/exercises.go` — REST handlers
4. Seed ~80-100 exercises in `internal/seed/exercises.go`
5. Register routes, wire up in `main.go`
6. **Verify**: `curl` to create, list, search exercises

## Step 3 — Programs & Workout Builder

1. Define models for Program, Workout, Section, SectionExercise, RestPeriod
2. Implement stores with transactional writes (creating a program with nested structure)
3. Implement handlers for full CRUD on the program tree
4. **Verify**: Create a program via API, add workouts/sections/exercises, retrieve full tree

## Step 4 — Templates

1. Define Template model (a template is essentially a saved program structure)
2. Implement "create program from template" (deep copy of the program structure)
3. Implement "save program as template"
4. Seed prebuilt templates: 5/3/1, PPL, Starting Strength
5. **Verify**: List templates, create program from 5/3/1 template, verify program has correct structure

## Step 5 — Cycles & Sessions

1. Define Cycle and Session models
2. "Start cycle" — creates cycle + generates sessions (one per workout in program)
3. Session start — loads the workout structure with target weights (calculated from previous sessions)
4. Set logging — record actual reps/weight per set
5. Session completion — marks done, stores summary
6. Weight progression logic — compare previous session to calculate next target weights
7. **Verify**: Start cycle, log sets in a session, complete it, start next session and verify weights adjusted

## Step 6 — Progress Tracking

1. Implement progress queries — per-exercise history, PRs, volume trends
2. Return structured data ready for charting (the RN app will render charts in Phase 2)
3. **Verify**: After logging several sessions, progress endpoints return correct data

## Verification (all steps)

After each step:
1. `go build` compiles without errors
2. `go run main.go` starts the server
3. Test endpoints with `curl` or a `.http` file
4. `go test ./...` passes (add tests as we go)
