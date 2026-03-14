# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository. **All referenced docs are mandatory reading before writing code.**

## Build & Run Commands

- `make run` — start the HTTP server
- `make build` — compile the binary
- `make test` — run all tests
- `make vet` — static analysis
- `make gen` — regenerate sqlc query code from `internal/db/query/*.sql` (run after any SQL query change)
- `make seed` — seed exercises and prebuilt programs
- `make reset-db` — delete the database (re-run `make run` + `make seed` after)

## Project

Compound is a workout planning app where users create custom programs from modular, composable workout structures and track progress with dynamic weight progression.

- **Phase 1** (current): Go backend + SQLite, local for 1 user, no frontend
- **Phase 2**: React Native (Expo) frontend in `/app`
- **Phase 3**: AI integration — exercise suggestions, template generation, program generation, form tips
- **Phase 4**: Cloud infra (Postgres), user accounts, template sharing

## Design Docs (MUST follow)

Before writing or modifying code, consult these docs. They define binding conventions — not suggestions.

| Doc | What it governs |
|---|---|
| [docs/architecture.md](docs/architecture.md) | High-level overview, data model hierarchy, links to all docs |
| [docs/schema-design.md](docs/schema-design.md) | Database tables, columns, types, ER diagram, design rationale |
| [docs/persistence.md](docs/persistence.md) | **sqlc workflow** (`make gen`), Store struct, DBTX interface, transactions, when to use raw SQL, timestamps (ISO 8601 UTC), UUIDs, soft deletes, nullable fields |
| [docs/implementation-patterns.md](docs/implementation-patterns.md) | DTOs, two-layer validation, logging (`log/slog`), config (YAML) |
| [docs/domain-model.md](docs/domain-model.md) | Aggregates, entities, value objects, state machines, business rules, struct definitions |
| [docs/error-handling.md](docs/error-handling.md) | Domain error types, HTTP mapping, error response format, multiple validation errors |
| [docs/project-structure.md](docs/project-structure.md) | Package layout (`domain/` → `store/` → `handler/`), dependency flow, file organization |
| [docs/naming-conventions.md](docs/naming-conventions.md) | Receivers (single letter), constructors (`NewXxx`), interfaces (`-er`), errors (`NewXxxError`), files (`domain_layer.go`), tests (`TestSubject_Behavior`), exports |
| [docs/api.md](docs/api.md) | REST API (`/api/v1`), cursor pagination, idempotency keys, sorting, response envelope, error codes |
| [docs/testing-strategy.md](docs/testing-strategy.md) | BDD-first development flow, acceptance tests (godog/Cucumber at HTTP level), integration tests (in-memory SQLite), unit tests |
| [docs/git-strategy.md](docs/git-strategy.md) | Trunk-based dev, short-lived `type/description` branches, PRs to main, CI requirements |
| [docs/local-development.md](docs/local-development.md) | First-run behavior, config file, Makefile targets, seeding, dev workflow |
| [docs/phase2.md](docs/phase2.md) | React Native frontend plan: connectivity model, offline strategy, navigation, API contract considerations (Phase 2) |
| [docs/ui-spec.md](docs/ui-spec.md) | **Approved UI designs** — visual style, all screen layouts, interaction patterns (Phase 2). Do not deviate without user sign-off. |
| [docs/frontend-patterns.md](docs/frontend-patterns.md) | **RN layout patterns** — SafeAreaView + scroll view structure, FlatList sizing, chip rows, modal pickers, NativeWind vs inline styles (Phase 2) |
| [docs/phase2-implementation-plan.md](docs/phase2-implementation-plan.md) | Phase 2 step-by-step build plan |
| [docs/ai.md](docs/ai.md) | AI feature design: exercise suggestions, template generation, program generation, form tips (Phase 3) |
| [docs/implementation-plan.md](docs/implementation-plan.md) | Phased build steps |

## Terminology

- **Program** — a multi-day workout plan (contains workouts). All programs are the same type; "prebuilt" programs (`is_prebuilt=1`) are seeded read-only content.
- **Workout** — one day's exercises within a program
- **Section** — a movement group within a workout (e.g., compound, isolation, burnout)
- **Exercise** — a single movement with target sets/reps/weight, belongs to a section
- **Cycle** — an active run of a program, created when a user starts a program
- **Session** — one workout instance within a cycle, tracks actual performance

## Key Rules (summary — details in docs above)

### Architecture
- Hybrid package structure: `domain/` → `store/` → `handler/` with one-way dependency flow
- Full DDD: rich domain models with validation, value objects, aggregate boundaries
- Domain package has zero infrastructure dependencies (no SQL, no HTTP)
- Request flow: handler (decode + validate DTO) → store (via DBTX) → domain

### Persistence
- Single `Store` struct, methods accept `DBTX` interface (works with both `*sql.DB` and `*sql.Tx`)
- **sqlc codegen** — write SQL in `internal/db/query/*.sql`, run `make gen`, call via `dbgen.New(db)` in store methods. No ORM, no query builder
- **Dynamic `IN` clauses** — use `sqlc.slice('param')` in the query file; sqlc generates typed slice parameters. Never hand-write `IN` clause queries
- Raw `db.QueryContext` only for two patterns sqlc cannot handle (see `persistence.md`): (1) runtime-chosen WHERE clauses where conditions are added/omitted based on input (`ListExercises`, `ListPrograms`); (2) dynamic SQL identifiers — table/column names cannot be `?` placeholders (`reindexSortOrder`, `reorderByUUIDs`)
- All timestamps: `time.Time` in Go, ISO 8601 text in SQLite, always UTC
- UUIDs generated Go-side (`google/uuid`), every table has integer PK + UUID column

### API & Data
- All endpoints prefixed with `/api/v1`
- Response envelope: `{"data": ...}` for success, `{"error": {"code": "...", "message": "...", "details": [...]}}` for errors
- Cursor-based pagination on list endpoints (`limit`, `cursor` params)
- Idempotency-Key header on POST requests
- Separate DTOs for request/response — domain models never serialized directly to JSON
- Responses expose `uuid` as external identifier, never integer `id`
- Domain error types (`NotFoundError`, `ValidationError`, `ConflictError`) mapped to HTTP status codes and error codes in handlers

### Naming
- Receivers: single letter (`e`, `s`, `h`)
- Constructors: `NewXxx()`, errors: `NewXxxError()`
- Files: `domain_layer.go` (e.g., `exercise_store.go`)
- Tests: `TestSubject_Behavior` (e.g., `TestCreateExercise_EmptyName`)
- Acronyms: all caps (`ID`, `UUID`, `HTTP`)

### Development Flow
- BDD-first: write Cucumber acceptance tests → build feature → add unit tests for edge cases
- When adding a new domain: domain model → SQL query file + `make gen` → store methods (call `dbgen.New(db)`) → DTOs → handler → route registration
- Trunk-based dev: short-lived `type/description` branches, PRs to main, CI must pass

### Frontend Development Flow (Phase 2+)
- **Design before wiring** — for every frontend screen or component, generate a static design (ASCII mockup or static component with hardcoded data) first. Only after the user approves the design, wire it up to the backend API.
- **Explain all decisions** — the user is a novice TypeScript engineer. Explain every technical decision, even ones that may seem obvious (why a hook vs a component, what a type does, why a particular pattern is used). Never assume prior TypeScript/React Native knowledge.
- **Layout patterns** — consult `docs/frontend-patterns.md` before building any screen. Key rule: `SafeAreaView` wraps only static header content; scroll views (`FlatList`, `ScrollView`) are siblings outside it.

## Gotchas

- There is no "Template" concept — `is_template` was removed. Prebuilt programs use `is_prebuilt=1` and are seeded read-only content. All user-created programs are just programs.
- "Sections" are workout sub-groups (compound, isolation, burnout), not page sections
- Go backend and future RN app coexist in the same repo (Go at root, RN in `/app`)
- Soft deletes only on `exercises` and `programs` — everything else cascades or is immutable log data
