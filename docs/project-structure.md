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
      program.go             — Program, ProgramWorkout
      workout.go             — Section, SectionExercise, ProgressionRule
      cycle.go               — Cycle, Session, SetLog
      errors.go              — NotFoundError, ValidationError, ConflictError

    store/                   — persistence layer (depends on: domain)
      store.go               — Store struct, DBTX interface, WithTx helper
      exercise_store.go
      program_store.go
      workout_store.go
      cycle_store.go
      session_store.go
      progress_store.go

    handler/                 — HTTP layer (depends on: domain, store)
      handler.go             — shared helpers: respond, decode, error mapping
      exercise_handler.go
      program_handler.go
      workout_handler.go
      cycle_handler.go
      session_handler.go
      progress_handler.go
      dto/                   — request/response types
        exercise.go
        program.go
        cycle.go
        session.go

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
      steps/                 — step definitions
      main_test.go           — test server setup, godog runner
```

## Package Design — Hybrid (Layer + Domain)

Packages are organized by layer, with files within each layer organized by domain. This gives compiler-enforced layer separation while keeping domain concepts easy to find.

### Dependency Flow

```
handler → store → domain
handler → dto   → domain
server  → handler
seed    → store → domain
```

Dependencies flow inward toward `domain`. The domain package has zero internal dependencies — it is pure business logic.

### Why Hybrid Over Package-by-Feature

Go packages are the visibility boundary (exported vs unexported), and circular imports are a hard compiler error. Package-by-feature (`exercise/`, `program/`, `cycle/`) leads to cross-package dependencies (cycles reference programs reference exercises) and often requires extracting a shared types package anyway — arriving at this hybrid structure with more indirection.

With the hybrid approach:
- Layer separation is enforced by the compiler — `handler/` cannot access unexported things in `store/`
- No circular import risk — dependencies flow one way
- Domain concepts are still easy to find — one file per domain per layer
