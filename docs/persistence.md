# Persistence Layer

How the Go backend interacts with SQLite. See [schema-design.md](schema-design.md) for the database schema and design rationale.

## Store Structure

A single `Store` struct holds the database connection. All domain methods live on this struct, split across per-domain files:

```
internal/store/
  store.go              — Store struct, DBTX interface, WithTx helper, DB init
  exercise_store.go     — CreateExercise, GetExercise, ListExercises, UpdateExercise, DeleteExercise
  program_store.go      — CreateProgram, GetProgram, ListPrograms, UpdateProgram, DeleteProgram, CopyProgram
  workout_store.go      — CreateWorkout, CreateSection, CreateSectionExercise, etc.
  mapper.go             — dbgen → domain mapper functions
  cycle_store.go        — CreateCycle, GetCycle, ListCycles, UpdateCycle
  session_store.go      — CreateSession, GetSession, UpdateSession, LogSet
  progress_store.go     — GetExerciseHistory, GetPersonalRecord, GetProgressSummary
  idempotency_store.go  — CheckIdempotencyKey, SaveIdempotencyKey

internal/db/
  schema.sql            — sqlc schema (kept in sync with migration files)
  query/
    exercises.sql       — named SQL queries for exercises
    programs.sql        — named SQL queries for programs
    workouts.sql        — named SQL queries for workouts, sections, section exercises, progression rules
    cycles.sql          — named SQL queries for cycles
    sessions.sql        — named SQL queries for sessions and set_logs
    progress.sql        — named SQL queries for history, personal records, summary
    idempotency.sql     — named SQL queries for idempotency key lookup and insert
  db.go                 — generated (do not edit)
  models.go             — generated (do not edit)
  exercises.sql.go      — generated (do not edit)
  programs.sql.go       — generated (do not edit)
  workouts.sql.go       — generated (do not edit)
  cycles.sql.go         — generated (do not edit)
  sessions.sql.go       — generated (do not edit)
  progress.sql.go       — generated (do not edit)
  idempotency.sql.go    — generated (do not edit)
```

```go
type Store struct {
    DB *sql.DB
}

func New(db *sql.DB) *Store {
    return &Store{DB: db}
}
```

Handlers receive a single `*Store` — no per-domain wiring needed:

```go
// in main.go or server setup
store := store.New(db)
handler.NewExerciseHandler(store)
handler.NewProgramHandler(store)
```

## DBTX Interface

Store methods accept a `DBTX` parameter instead of `*sql.DB` directly. This interface is satisfied by both `*sql.DB` (normal operations) and `*sql.Tx` (transactional operations):

```go
type DBTX interface {
    ExecContext(ctx context.Context, query string, args ...any) (sql.Result, error)
    PrepareContext(ctx context.Context, query string) (*sql.Stmt, error)
    QueryContext(ctx context.Context, query string, args ...any) (*sql.Rows, error)
    QueryRowContext(ctx context.Context, query string, args ...any) *sql.Row
}
```

Store methods are unaware of whether they're running inside a transaction:

```go
func (s *Store) GetExerciseByUUID(ctx context.Context, db DBTX, id string) (*domain.Exercise, error) {
    row, err := dbgen.New(db).GetExerciseByUUID(ctx, id)
    if errors.Is(err, sql.ErrNoRows) {
        return nil, domain.NewNotFoundError("exercise", id)
    }
    if err != nil {
        return nil, err
    }
    return mapExercise(row), nil
}
```

### Simple call (no transaction)

```go
err := store.CreateExercise(ctx, store.DB, &exercise)
```

### Transactional call

```go
err := store.WithTx(ctx, func(tx *sql.Tx) error {
    if err := store.CreateProgram(ctx, tx, &program); err != nil {
        return err
    }
    for i := range workouts {
        workouts[i].ProgramID = program.ID
        if err := store.CreateWorkout(ctx, tx, &workouts[i]); err != nil {
            return err
        }
        // sections, section_exercises, progression_rules...
    }
    return nil
})
```

The caller decides whether to use a transaction. The store methods don't change.

## WithTx Helper

Manages begin/commit/rollback boilerplate:

```go
func (s *Store) WithTx(ctx context.Context, fn func(tx *sql.Tx) error) error {
    tx, err := s.DB.BeginTx(ctx, nil)
    if err != nil {
        return err
    }
    defer tx.Rollback()

    if err := fn(tx); err != nil {
        return err
    }
    return tx.Commit()
}
```

- `Rollback()` in `defer` is a no-op if `Commit()` already succeeded
- If `fn` returns an error, the defer fires `Rollback()` before the error propagates
- If `fn` panics, the defer still fires `Rollback()`

## Queries — sqlc

SQL query files in `internal/db/query/` are the source of truth. `make gen` runs `sqlc generate` to produce typed Go code in `internal/db/`. **Never edit generated files directly.**

Each query is annotated with a name and return type:

```sql
-- name: GetExerciseByUUID :one
SELECT id, uuid, name, muscle_group, equipment, tracking_type, notes, is_custom, created_at, updated_at
FROM exercises WHERE uuid = ? AND deleted_at IS NULL;
```

Store methods call generated code via `dbgen.New(db)`:

```go
func (s *Store) GetExerciseByUUID(ctx context.Context, db DBTX, id string) (*domain.Exercise, error) {
    row, err := dbgen.New(db).GetExerciseByUUID(ctx, id)
    // ...
    return mapExercise(row), nil
}
```

**Key rule:** `dbgen.New(db)` is called inside each store method, not stored on `Store`. Storing it would bind the queries to `*sql.DB` rather than the current transaction's `*sql.Tx`, breaking `WithTx`.

**`internal/db/schema.sql`** is a copy of the latest migration SQL (without the `schema_migrations` table). It must be kept in sync with `internal/migration/*.sql` — add new tables here whenever a new migration is added.

Generated files are committed to the repository. `sqlc` does not need to be installed to build or run the project.

## Dynamic IN Clauses — sqlc.slice()

For queries with `IN (...)` clauses built from Go slices, use `sqlc.slice()` in the query file:

```sql
-- name: GetSectionsByWorkoutIDs :many
SELECT id, uuid, program_workout_id, name, sort_order, rest_seconds, created_at, updated_at
FROM sections
WHERE program_workout_id IN (sqlc.slice('workout_ids'))
ORDER BY sort_order;
```

sqlc generates code that builds the placeholder list at runtime. The store method receives a typed `[]int64` (or `[]*int64` when the column is nullable). **Do not hand-write `IN` clause queries** — use `sqlc.slice()` instead.

## Dynamic Queries — Raw SQL

Raw `db.QueryContext` / `db.ExecContext` is reserved for two patterns that sqlc genuinely cannot handle. If you find yourself reaching for raw SQL for any other reason, use `sqlc.slice()` instead.

### Pattern 1 — Runtime-chosen WHERE clauses

`ListExercises` and `ListPrograms` accept optional filter params (muscle group, equipment, search term, etc.). The WHERE clause itself changes depending on which filters are provided — not just the values, but which conditions are included at all:

```go
// If the caller passes a muscle_group filter, we append:
conditions = append(conditions, "muscle_group = ?")
args = append(args, *p.MuscleGroup)
// If they don't, that condition is omitted entirely.
```

sqlc requires SQL to be fully written at code-generation time. It cannot conditionally include or exclude WHERE clauses based on runtime input, so these list queries must stay as raw SQL.

The `ORDER BY` column and direction face the same constraint — sqlc cannot accept a column name as a parameter because SQL identifiers cannot be bound as `?` placeholders.

### Pattern 2 — Dynamic SQL identifiers

`reindexSortOrder` and `reorderByUUIDs` are shared helpers that operate across multiple tables (`sections`, `section_exercises`, `program_workouts`). They accept a table name and parent column name as arguments:

```go
func reindexSortOrder(ctx context.Context, db DBTX, table, parentCol string, parentID int64) error {
    query := fmt.Sprintf(`UPDATE %s SET sort_order = ? WHERE id = ?`, table)
    // ...
}
```

SQL `?` placeholders can only bind **values** (strings, numbers, booleans). They cannot bind **identifiers** like table names or column names — the database driver treats placeholders as data, and the query planner needs to know the table at parse time. There is no sqlc workaround for this; a shared helper with dynamic identifiers must use `fmt.Sprintf`.

Note: the table and column names here are always hardcoded at the call sites — they come from internal logic, never from user input — so there is no injection risk.

**Convention for raw SQL:**
- Use backtick multi-line strings for readability
- Always use `?` placeholders for values (never string interpolation for values)
- Always pass `context.Context` through to `ExecContext`/`QueryContext`
- Use mapper functions (see below) on results where applicable

## Mappers

sqlc generates its own model types in `internal/db/` (package `dbgen`). These are never used outside the store layer. `internal/store/mapper.go` contains one mapper function per domain type that converts dbgen structs to domain structs:

```go
func mapExercise(row dbgen.Exercise) *domain.Exercise {
    e := &domain.Exercise{
        ID:           row.ID,
        UUID:         row.Uuid,
        Name:         row.Name,
        TrackingType: domain.TrackingType(row.TrackingType),
        IsCustom:     row.IsCustom,
        CreatedAt:    row.CreatedAt,
        UpdatedAt:    row.UpdatedAt,
    }
    e.MuscleGroup = row.MuscleGroup
    e.Equipment   = row.Equipment
    e.Notes       = row.Notes
    return e
}
```

Domain types (`internal/domain`) are the contract for the entire application above the store layer. Handler, DTO, and domain packages never import `internal/db`.

## Timestamps

Go models use `time.Time` for all timestamp fields. Stored in SQLite as ISO 8601 text (UTC). The column type `DATETIME` is declared in the schema so sqlc generates `time.Time` fields directly; the modernc.org/sqlite driver DSN includes `?_loc=UTC` to ensure consistent UTC parsing.

**Convention:**
- Generate with `time.Now().UTC()`
- `created_at` — set once on insert
- `updated_at` — set on insert (same as `created_at`), updated on every write
- `deleted_at` — nullable (`*time.Time`), set on soft delete, omitted from JSON when nil
- Domain timestamps (`started_at`, `completed_at`) are separate from metadata timestamps

## UUIDs

Generated Go-side using `google/uuid` before INSERT:

```go
e.UUID = uuid.NewString()  // v4 UUID
```

- Every table has a `uuid TEXT UNIQUE NOT NULL` column
- Internal joins use integer `id` (fast)
- API responses include `uuid` for external references
- UUID is set once on creation, never changes

## Soft Deletes

Only `exercises` and `programs` use soft deletes. All queries against these tables filter:

```sql
SELECT ... FROM exercises WHERE deleted_at IS NULL
```

The delete store method sets the timestamp rather than removing the row. Historical `set_logs` retain their `exercise_id` references — the data is still there, just hidden from active listings.

## Nullable Fields

Optional columns use Go pointer types:

| SQL column | Go type | JSON behavior |
|---|---|---|
| `TEXT NOT NULL` | `string` | always present |
| `TEXT` (nullable) | `*string` | omitted when nil with `omitempty` |
| `INTEGER` (nullable) | `*int64` | omitted when nil |
| `REAL` (nullable) | `*float64` | omitted when nil |
| `DATETIME` (nullable) | `*time.Time` | omitted when nil |

sqlc emits pointer types directly via `emit_pointers_for_null_types: true` — no intermediate `sql.NullString` / `sql.NullTime` scanning required.

## Migrations

SQL migrations are embedded in the binary via `//go:embed` and run on startup:

```
internal/migration/
  migrations.go     — embed directive + runner
  001_initial.sql   — full schema creation
```

Migrations run sequentially. A `schema_migrations` table tracks which have been applied. Each migration runs inside a transaction.
