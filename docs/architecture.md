# Architecture

High-level overview of the Compound backend. Each section links to a dedicated doc with full details.

## Data Model

```
Program (is_template=1 for reusable templates, deep-copied to create user programs)
  └── Workouts (one per day, ordered)
        └── Sections (freeform named groups, e.g. "Heavy Compounds", "Accessories")
              └── Exercises (with target sets/reps/weight/duration/distance)
              └── Progression Rules (per exercise placement)

Program → (user starts running it) → Cycle
  └── Sessions (pre-generated, one per workout)
        └── Set Logs (actual reps completed, weight used)
```

### Weight Progression

When generating session targets, the system checks the `progression_rules` for each exercise and the previous session's `set_logs`:
- If the user completed all target reps across all sets → apply the progression rule (linear increment, percentage increase, or wave pattern)
- If the user failed to complete target reps → keep same weight
- After N consecutive failures (`deload_threshold`) → reduce weight by `deload_pct`
- Rules are per `section_exercise`, so the same exercise can progress differently in different programs

## Stack

- Go 1.26 with chi router (`go-chi/chi/v5`)
- SQLite via `modernc.org/sqlite` (pure Go, no CGO)
- `database/sql` with hand-written queries (no ORM)
- `log/slog` for structured logging
- YAML config file (`compound.yaml`)

## Detailed Docs

| Doc | Covers |
|---|---|
| [schema-design.md](schema-design.md) | Database tables, columns, ER diagram, and rationale for each design decision |
| [persistence.md](persistence.md) | Store struct, DBTX interface, transactions, query conventions, timestamps, UUIDs, soft deletes |
| [implementation-patterns.md](implementation-patterns.md) | DTOs, two-layer validation, logging, config |
| [project-structure.md](project-structure.md) | Package layout, file organization, dependency flow |
| [api.md](api.md) | REST API endpoints, pagination, idempotency, sorting, response format |
| [domain-model.md](domain-model.md) | Aggregates, entities, value objects, state machines, business rules, struct definitions |
| [error-handling.md](error-handling.md) | Domain error types, HTTP mapping, error response format |
| [local-development.md](local-development.md) | Local setup, Makefile, dev workflow |
| [git-strategy.md](git-strategy.md) | Trunk-based dev, branching, PRs, CI pipeline |
| [testing-strategy.md](testing-strategy.md) | BDD-first development, test types, conventions |
| [naming-conventions.md](naming-conventions.md) | Go naming: receivers, constructors, files, tests, exports |
| [ai.md](ai.md) | AI feature design: exercise suggestions, template generation, program generation, form tips (Phase 3) |
| [implementation-plan.md](implementation-plan.md) | Phased build steps |
