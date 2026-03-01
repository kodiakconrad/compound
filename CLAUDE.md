# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Run Commands

- `make run` — start the HTTP server
- `make build` — compile the binary
- `make test` — run all tests
- `make vet` — static analysis
- `make seed` — seed exercises and prebuilt templates
- `make reset-db` — delete the database (re-run `make run` + `make seed` after)

## Project

Compound is a workout planning app where users create custom programs from modular, composable workout structures and track progress with dynamic weight progression.

- **Phase 1** (current): Go backend + SQLite, local for 1 user, no frontend
- **Phase 2**: React Native (Expo) frontend in `/app`
- **Phase 3**: Cloud infra (Postgres), user accounts, template sharing

See [docs/architecture.md](docs/architecture.md) for high-level overview and links to all design docs.
See [docs/local-development.md](docs/local-development.md) for local setup and dev workflow.
See [docs/implementation-plan.md](docs/implementation-plan.md) for phased build steps.

## Terminology

- **Program** — a multi-day workout plan (contains workouts)
- **Workout** — one day's exercises within a program
- **Section** — a movement group within a workout (e.g., compound, isolation, burnout)
- **Exercise** — a single movement with target sets/reps/weight, belongs to a section
- **Template** — a reusable program blueprint (prebuilt: 5/3/1, PPL, Starting Strength)
- **Cycle** — an active run of a program, created when a user starts a program
- **Session** — one workout instance within a cycle, tracks actual performance

## MVP

- Programs span multiple days and consist of workouts (one per day)
- Workouts contain sections (compound, isolation, burnout, etc.) which group exercises with custom sets/reps
- Sections have optional rest periods (rest_seconds column)
- Programs can be created from scratch or from templates (programs with is_template=1)
- Running a program creates a cycle with one session per workout
- Sessions have dynamic weights that adjust based on progress
- Users track completed reps per set during sessions

## User Stories

- Users can create templates for workout programs
- Users can create programs from templates or from scratch
- Users can run programs and track progress
- Weight increases are calculated automatically based on session performance
- When building programs, users can get AI suggestions for exercises

## Stack

- Go 1.26 with chi router (`go-chi/chi/v5`)
- SQLite via `modernc.org/sqlite` (pure Go, no CGO)
- `database/sql` with hand-written queries (no ORM)

## Patterns

- Hybrid package structure: `domain/` → `store/` → `handler/` (layer separation, files organized by domain)
- Full DDD: rich domain models with validation, value objects, aggregate boundaries
- Request flow: handler (decode + validate DTO) → store (via DBTX) → domain
- Single `Store` struct with DBTX interface for transparent transaction support
- Separate DTOs for request/response — domain models never serialized directly to JSON
- Domain error types (`NotFoundError`, `ValidationError`) mapped to HTTP status in handlers
- SQL migrations embedded via `//go:embed`, run automatically on startup
- When adding a new domain, follow: domain model → store methods → DTOs → handler → route registration

## Gotchas

- Programs and Templates are structurally identical — a Template is a Program flagged as shareable/reusable
- "Sections" are workout sub-groups (compound, isolation, burnout), not page sections
- Go backend and future RN app coexist in the same repo (Go at root, RN in /app)

## Workflow

- Build incrementally: get each step compiling and testable via curl before moving on
- Test API endpoints with curl or .http files — no frontend in Phase 1
