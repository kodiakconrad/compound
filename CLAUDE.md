# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Run Commands

- `go build` — compile the binary
- `go run main.go` — start the HTTP server
- `go test ./...` — run all tests
- `go vet ./...` — static analysis

## Project

Compound is a workout planning app where users create custom programs from modular, composable workout structures and track progress with dynamic weight progression.

- **Phase 1** (current): Go backend + SQLite, local for 1 user, no frontend
- **Phase 2**: React Native (Expo) frontend in `/app`
- **Phase 3**: Cloud infra (Postgres), user accounts, template sharing

See [docs/architecture.md](docs/architecture.md) for data model, API endpoints, and backend structure.
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
- Workouts also contain rest periods
- Programs can be created from scratch or from templates (prebuilt: 5/3/1, PPL, Starting Strength)
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

- Request flow: handler/ → store/ → SQLite
- Each domain (exercises, programs, cycles, etc.) has its own handler + store file
- Nested writes use transactions (e.g., creating a program with workouts/sections/exercises)
- SQL migrations embedded via `//go:embed`, run on startup
- Weight progression calculated server-side when generating session targets
- When adding a new domain, follow: model → store → handler → route registration

## Gotchas

- Programs and Templates are structurally identical — a Template is a Program flagged as shareable/reusable
- "Sections" are workout sub-groups (compound, isolation, burnout), not page sections
- Go backend and future RN app coexist in the same repo (Go at root, RN in /app)

## Workflow

- Build incrementally: get each step compiling and testable via curl before moving on
- Test API endpoints with curl or .http files — no frontend in Phase 1
