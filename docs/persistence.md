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
  progress_store.go     — GetExerciseHistory, GetPersonalRecords, GetSummary

internal/db/
  schema.sql            — sqlc schema (kept in sync with migration files)
  query/
    exercises.sql       — named SQL queries for exercises
    programs.sql        — named SQL queries for programs
    workouts.sql        — named SQL queries for workouts, sections, section exercises, progression rules
  db.go                 — generated (do not edit)
  models.go             — generated (do not edit)
  exercises.sql.go      — generated (do not edit)
  programs.sql.go       — generated (do not edit)
  workouts.sql.go       — generated (do not edit)
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

## Dynamic Queries — Raw SQL

Some queries cannot be expressed as static SQL and stay as hand-written `db.QueryContext` / `db.ExecContext` calls:

- **`ListExercises`** — dynamic `WHERE` filters (muscle group, equipment, tracking type, search term) and configurable `ORDER BY` column/direction
- **`ListPrograms`** — same pattern
- **`reorderByUUIDs`** — uses `fmt.Sprintf` with dynamic table and column names
- **`reindexSortOrder`** — same
- **`GetProgramWithTree`** — bulk-load queries using `IN (...)` clauses built from integer slices; sqlc SQLite support for slice parameters is limited

**Convention for raw SQL:**
- Use backtick multi-line strings for readability
- Always use `?` placeholders (never string interpolation for values)
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
