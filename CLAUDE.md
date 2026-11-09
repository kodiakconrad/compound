# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository. **All referenced docs are mandatory reading before writing code.**

## Build & Run Commands

The app (in `/app`) is now **local-first** — this is the real app and where almost all work happens:

- `npx expo start` (from `/app`) — run the app
- `npm test` (from `/app`) — Jest: domain unit tests + repository integration tests
- `npm run test:bdd` (from `/app`) — Cucumber.js acceptance tests
- `./node_modules/.bin/tsc --noEmit` (from `/app`) — typecheck (prefer this over `npx tsc`, which can resolve a stale global package)

The Go backend at the repo root is a reduced legacy artifact — schema reference and seed data generation only, no longer in the app's data path:

- `make seed` — regenerate seed data (exercises, prebuilt programs) consumed by the TS seed scripts in `app/db/`
- `make test` / `make vet` — still run against the remaining Go domain tests
- `make gen` is **dead** — `internal/db/query/*.sql` no longer exists; do not expect sqlc codegen to work

## Project

Compound is a workout planning app where users create custom programs from modular, composable workout structures and track progress with dynamic weight progression.

- **Phase 1** (done): Go backend + SQLite, local for 1 user, no frontend
- **Phase 2** (current): React Native (Expo) frontend in `/app`, **local-first architecture** — see below
- **Phase 3**: AI integration — exercise suggestions, template generation, program generation, form tips
- **Phase 4**: Cloud infra (Postgres), user accounts, template sharing, and a real answer for auth + multi-device sync

### Local-first architecture (current)

Phase 2 was originally planned as the Go backend served over HTTP, with an offline queue on the phone to tolerate dropped connections (see `docs/phase2.md`'s "Hybrid A + C" decision). That was **reversed**: the app now owns all its data on-device, in SQLite via `expo-sqlite`, with no HTTP calls for reads or writes. Offline is therefore inherent rather than a queue-and-replay layer.

- `app/domain/` — TypeScript domain models, ported from `internal/domain/` (validation, value objects, state machines)
- `app/db/repositories/` — TypeScript data-access layer, ported from `internal/store/` (SQL queries against `expo-sqlite`, same dynamic-WHERE and IN-clause patterns as before, just hand-written since there's no sqlc for TS)
- `app/hooks/` — TanStack Query hooks wrap repositories directly; no DTOs, no HTTP client, no idempotency keys (nothing to replay — writes land directly in the on-device DB)
- The Go backend remains for schema reference (`internal/db/schema.sql`, `internal/migration/`) and seed data generation (`cmd/seed`) — it is **not called by the app**

Most of the design docs below (`persistence.md`, `api.md`, `error-handling.md`, `project-structure.md`, `domain-model.md`, `naming-conventions.md`, `implementation-patterns.md`, `architecture.md`) describe the superseded Go/HTTP architecture and carry a notice pointing here. They're still useful as design *rationale* (why a value object is shaped the way it is, why a state machine transitions the way it does) — the TS ports preserve that reasoning — but don't follow their Go-specific mechanics (sqlc, DTOs, HTTP mapping, `domain/`→`store/`→`handler/` package layout) for new frontend work. `docs/testing-strategy.md` is current and describes the real layering (`domain/` → `db/repositories/` → `hooks/` → components).

## Design Docs (MUST follow)

Before writing or modifying code, consult these docs. They define binding conventions — not suggestions. Docs marked **(superseded)** describe the Phase 1 Go/HTTP architecture; read them for design rationale, not mechanics — see "Local-first architecture" above for what actually governs `/app` code now.

| Doc | What it governs |
|---|---|
| [docs/testing-strategy.md](docs/testing-strategy.md) | **Current.** BDD-first flow, Cucumber.js acceptance tests, Jest domain unit + repository integration tests for the local-first app |
| [docs/ui-spec.md](docs/ui-spec.md) | **Current, approved UI designs** — visual style, all screen layouts, interaction patterns. Do not deviate without user sign-off |
| [docs/frontend-patterns.md](docs/frontend-patterns.md) | **Current.** RN layout patterns — SafeAreaView + scroll view structure, FlatList sizing, chip rows, modal pickers, NativeWind vs inline styles |
| [docs/git-strategy.md](docs/git-strategy.md) | **Current.** Trunk-based dev, short-lived `type/description` branches, PRs to main, CI requirements |
| [docs/local-development.md](docs/local-development.md) | **Current.** First-run behavior, Makefile targets, seeding, dev workflow |
| [docs/ai.md](docs/ai.md) | AI feature design: exercise suggestions, template generation, program generation, form tips (Phase 3) |
| [docs/implementation-plan.md](docs/implementation-plan.md) | Phased build steps (Phase 1, done) |
| [docs/phase2-implementation-plan.md](docs/phase2-implementation-plan.md) | Phase 2 step-by-step build plan — Steps 1–6 shipped as written; **Steps 7–8 superseded**, see notice in the doc |
| [docs/phase2.md](docs/phase2.md) | **(superseded)** Original connectivity decision (HTTP + offline queue) — reversed in favor of local-first |
| [docs/architecture.md](docs/architecture.md) | **(superseded)** High-level overview, data model hierarchy — hierarchy still accurate, "Go backend" framing is not |
| [docs/schema-design.md](docs/schema-design.md) | Database tables, columns, types, ER diagram — **table design still accurate**, now enforced by on-device migrations in `app/db/` rather than the Go backend |
| [docs/persistence.md](docs/persistence.md) | **(superseded)** sqlc workflow, Store struct, DBTX interface — see `app/db/repositories/` for the TS equivalent |
| [docs/implementation-patterns.md](docs/implementation-patterns.md) | **(superseded)** DTOs, two-layer validation, `log/slog`, YAML config — none of this applies to `/app` |
| [docs/domain-model.md](docs/domain-model.md) | **(superseded, mechanics)** Aggregates, value objects, state machines, business rules — the *rules* still hold, ported to `app/domain/`; the Go struct definitions don't |
| [docs/error-handling.md](docs/error-handling.md) | **(superseded)** Domain error types, HTTP mapping — no HTTP layer in `/app` |
| [docs/project-structure.md](docs/project-structure.md) | **(superseded)** Go package layout (`domain/` → `store/` → `handler/`) — `/app` uses `domain/` → `db/repositories/` → `hooks/` → components instead |
| [docs/naming-conventions.md](docs/naming-conventions.md) | **(superseded for `/app`)** Go naming (single-letter receivers, `NewXxx`) — TS code in `/app` follows ordinary TS/React conventions (camelCase, `useXxx` hooks) instead |
| [docs/api.md](docs/api.md) | **(superseded)** REST API, cursor pagination, idempotency keys — no HTTP API in the app's data path anymore |

## Terminology

- **Program** — a multi-day workout plan (contains workouts). All programs are the same type; "prebuilt" programs (`is_prebuilt=1`) are seeded read-only content.
- **Workout** — one day's exercises within a program
- **Section** — a movement group within a workout (e.g., compound, isolation, burnout)
- **Exercise** — a single movement with target sets/reps/weight, belongs to a section
- **Cycle** — an active run of a program, created when a user starts a program
- **Session** — one workout instance within a cycle, tracks actual performance

## Key Rules (summary — details in docs above)

### Architecture (`/app`, current)
- Layering: `domain/` → `db/repositories/` → `hooks/` → components, one-way dependency flow
- Full DDD, ported from Go: rich domain models with validation, value objects, aggregate boundaries, state machines
- `domain/` has zero infrastructure dependencies (no SQL, no React) — pure TypeScript functions and types
- Data flow: component → hook (TanStack Query) → repository (expo-sqlite) → domain validation. No HTTP, no DTOs, no handler layer — the repository returns domain types directly to the hook

### Architecture (Go backend, legacy — schema/seed only)
- Old layering for reference: `domain/` → `store/` → `handler/`, DTOs, sqlc codegen, HTTP mapping — all still described in the superseded docs, none of it is live code the app depends on
- What's left: `internal/domain/` (ported, not called), `internal/db/schema.sql` + `internal/migration/` (source of truth for table design), `cmd/seed` (generates seed data consumed by `app/db/seed_*.ts`)
- `make gen` is dead (no `internal/db/query/*.sql` left)

### Persistence (`/app`, current)
- Repositories in `app/db/repositories/` hand-write SQL against `expo-sqlite`'s sync API — no sqlc for TS, so no codegen step
- Same two raw-SQL patterns as the Go store layer, same reasons: runtime-chosen WHERE clauses, and dynamic IN-clause lists
- Timestamps: ISO 8601 text, UTC, same as before
- UUIDs generated client-side (`expo-crypto` / `uuid`), same integer-PK + UUID-column schema as `schema-design.md`
- No transactions-as-DBTX-interface pattern — `expo-sqlite`'s `withTransactionSync` is used directly where multi-statement atomicity is needed

### Naming (`/app`, current)
- Ordinary TypeScript/React conventions: camelCase functions/variables, `PascalCase` types and components, `useXxx` for hooks
- Files: `camelCase.ts` or matching the exported symbol (e.g. `session_repository.ts` for repositories, following the existing ported-from-Go snake_case on that one directory — match whatever's already in the folder you're editing)
- Tests: colocated `__tests__/subject.test.ts`, describe/it blocks named after the behavior

### Naming (Go, legacy)
- Receivers: single letter (`e`, `s`, `h`)
- Constructors: `NewXxx()`, errors: `NewXxxError()`
- Files: `domain_layer.go` (e.g., `exercise_store.go`)
- Tests: `TestSubject_Behavior` (e.g., `TestCreateExercise_EmptyName`)
- Acronyms: all caps (`ID`, `UUID`, `HTTP`)

### Development Flow
- BDD-first: write Cucumber.js acceptance tests (`app/tests/acceptance/`) → build feature → add Jest unit/integration tests for edge cases
- When adding a new domain concept: domain model + validation in `app/domain/` → repository in `app/db/repositories/` (+ migration if schema changes) → TanStack Query hook in `app/hooks/` → component
- Trunk-based dev: short-lived `type/description` branches, PRs to main, CI must pass

### Frontend Development Flow
- **Design before wiring** — for every frontend screen or component, generate a static design (ASCII mockup or static component with hardcoded data) first. Only after the user approves the design, wire it up to the local repository layer (not a "backend API" — there isn't one in the data path).
- **Explain all decisions** — the user is a novice TypeScript engineer. Explain every technical decision, even ones that may seem obvious (why a hook vs a component, what a type does, why a particular pattern is used). Never assume prior TypeScript/React Native knowledge.
- **Layout patterns** — consult `docs/frontend-patterns.md` before building any screen. Key rule: `SafeAreaView` wraps only static header content; scroll views (`FlatList`, `ScrollView`) are siblings outside it.

## Gotchas

- There is no "Template" concept — `is_template` was removed. Prebuilt programs use `is_prebuilt=1` and are seeded read-only content. All user-created programs are just programs.
- "Sections" are workout sub-groups (compound, isolation, burnout), not page sections
- Go backend and RN app coexist in the same repo (Go at root, RN in `/app`), but the Go backend is **not called by the app** — it's schema/seed-reference only, kept alive by `make seed`/`make test`/`make vet`. Don't add HTTP endpoints expecting the app to use them without a separate decision to reverse local-first again
- Soft deletes only on `exercises` and `programs` — everything else cascades or is immutable log data
- There is no offline queue, idempotency keys, or `lib/api.ts` in `/app` — those were Step 7 of the old plan and were removed when the architecture went local-first. Don't re-add them without checking `docs/phase2.md`'s superseded-decision note first
