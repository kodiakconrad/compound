# Project Structure

File and package layout for the Compound Go backend.

## Layout

```
/compound (repo root)
  go.mod
  main.go                    — entry point, starts HTTP server
  compound.yaml              — configuration (gitignored)

  internal/
    domain/                  — pure domain: models, value objects, validation, errors
      exercise.go            — Exercise, TrackingType
      program.go             — Program (aggregate root)
      workout.go             — ProgramWorkout, Section, SectionExercise
      progression.go         — ProgressionStrategy, ProgressionRule
      cycle.go               — Cycle, Session, SetLog
      errors.go              — NotFoundError, ValidationError, ConflictError

    store/                   — persistence layer (depends on: domain)
      store.go               — Store struct, DBTX interface, WithTx helper
      exercise_store.go
      program_store.go
      workout_store.go       — workouts, sections, section exercises
      cycle_store.go
      session_store.go
      progress_store.go

    handler/                 — HTTP layer (depends on: domain, store)
      handler.go             — shared helpers: respond, decode, error mapping
      exercise_handler.go
      program_handler.go     — ProgramHandler struct + program CRUD
      workout_handler.go     — workout CRUD + reorder
      section_handler.go     — section CRUD + reorder
      section_exercise_handler.go — section exercise CRUD + reorder
      cycle_handler.go
      session_handler.go
      progress_handler.go
      dto/                   — request/response types
        common.go            — FieldError, Validator interface
        exercise.go
        program.go           — program request/response DTOs
        workout.go           — workout, section, section exercise DTOs
        progression.go       — progression rule DTO
        cycle.go
        session.go
      middleware/             — chi middleware
        idempotency.go       — Idempotency-Key header handling

    server/
      server.go              — HTTP server setup, middleware
      routes.go              — route registration

    config/
      config.go              — YAML config loading, defaults

    migration/
      migrations.go          — embedded SQL migrations
      001_initial.sql

    seed/
      seed.go                — seed exercises + prebuilt programs (5/3/1, PPL, Starting Strength)
      exercises.go           — ~80-100 common exercises
      programs.go            — prebuilt program definitions (is_template=1, is_prebuilt=1)

  tests/
    acceptance/
      features/              — Cucumber .feature files (user journeys)
      common_steps.go        — shared step definitions (TestClient, assertions)
      exercise_steps.go      — exercise-specific step definitions
      main_test.go           — test server setup, godog runner
```

## Package Design — Hybrid (Layer + Domain)

Packages are organized by layer, with files within each layer organized by domain. This gives compiler-enforced layer separation while keeping domain concepts easy to find.

### Dependency Flow

```
handler    → store → domain
handler    → dto   → domain
middleware → store → domain
server     → handler, middleware
seed       → store → domain
```

Dependencies flow inward toward `domain`. The domain package has zero internal dependencies — it is pure business logic.

### File Granularity — One File Per Domain Object

Within each layer, split files by domain object — not by layer. A single file should contain one type (or one tight cluster of related types) and its associated logic.

**In `domain/`**: one file per domain type or value object cluster.
```
program.go       — Program aggregate root
workout.go       — ProgramWorkout, Section, SectionExercise (all workout-tree nodes)
progression.go   — ProgressionStrategy value object + ProgressionRule entity
```

**In `store/`**: one file per aggregate or closely related store operations.

**In `handler/`**: one file per handler concern. The struct and constructor live in the primary file; each sub-resource gets its own file.
```
program_handler.go          — ProgramHandler struct + program CRUD
workout_handler.go          — workout endpoints
section_handler.go          — section endpoints
section_exercise_handler.go — section exercise endpoints
```

**In `handler/dto/`**: mirrors the domain split — one DTO file per domain object.

**Test files follow the same split** — `workout_test.go` tests types from `workout.go`, `progression_test.go` tests types from `progression.go`, and so on.

This keeps files focused and easy to navigate, especially coming from languages where one class = one file.

### Why Hybrid Over Package-by-Feature

Go packages are the visibility boundary (exported vs unexported), and circular imports are a hard compiler error. Package-by-feature (`exercise/`, `program/`, `cycle/`) leads to cross-package dependencies (cycles reference programs reference exercises) and often requires extracting a shared types package anyway — arriving at this hybrid structure with more indirection.

With the hybrid approach:
- Layer separation is enforced by the compiler — `handler/` cannot access unexported things in `store/`
- No circular import risk — dependencies flow one way
- Domain concepts are still easy to find — one file per domain per layer
