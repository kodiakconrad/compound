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
  cycle_store.go        — CreateCycle, GetCycle, ListCycles, UpdateCycle
  session_store.go      — CreateSession, GetSession, UpdateSession, LogSet
  progress_store.go     — GetExerciseHistory, GetPersonalRecords, GetSummary
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
    QueryContext(ctx context.Context, query string, args ...any) (*sql.Rows, error)
    QueryRowContext(ctx context.Context, query string, args ...any) *sql.Row
}
```

Store methods are unaware of whether they're running inside a transaction:

```go
func (s *Store) CreateExercise(ctx context.Context, db DBTX, e *model.Exercise) error {
    e.UUID = uuid.NewString()
    now := time.Now().UTC()
    e.CreatedAt = now
    e.UpdatedAt = now
    result, err := db.ExecContext(ctx,
        `INSERT INTO exercises (uuid, name, muscle_group, equipment, tracking_type, notes, is_custom, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        e.UUID, e.Name, e.MuscleGroup, e.Equipment, e.TrackingType, e.Notes, e.IsCustom, e.CreatedAt, e.UpdatedAt,
    )
    if err != nil {
        return err
    }
    id, _ := result.LastInsertId()
    e.ID = id
    return nil
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

## Queries — Raw SQL

All queries are hand-written SQL strings in store methods. No ORM, no query builder, no codegen.

**Why:** Full control over queries, no hidden behavior, easy to debug with SQLite CLI. The schema is small enough that raw SQL stays manageable.

**Convention:**
- Use backtick multi-line strings for readability
- Always use `?` placeholders (never string interpolation)
- Always pass `context.Context` through to `ExecContext`/`QueryContext`
- Use `QueryRowContext` for single-row lookups, `QueryContext` + row scanning for lists

## Timestamps

Go models use `time.Time` for all timestamp fields. Stored in SQLite as ISO 8601 text (UTC).

```go
type Exercise struct {
    ID           int64      `json:"id"`
    UUID         string     `json:"uuid"`
    Name         string     `json:"name"`
    MuscleGroup  *string    `json:"muscle_group"`
    Equipment    *string    `json:"equipment"`
    TrackingType string     `json:"tracking_type"`
    Notes        *string    `json:"notes"`
    IsCustom     bool       `json:"is_custom"`
    CreatedAt    time.Time  `json:"created_at"`
    UpdatedAt    time.Time  `json:"updated_at"`
    DeletedAt    *time.Time `json:"deleted_at,omitempty"`
}
```

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

The delete store method sets the timestamp rather than removing the row:

```go
func (s *Store) DeleteExercise(ctx context.Context, db DBTX, id int64) error {
    _, err := db.ExecContext(ctx,
        `UPDATE exercises SET deleted_at = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL`,
        time.Now().UTC(), time.Now().UTC(), id,
    )
    return err
}
```

Historical `set_logs` retain their `exercise_id` references — the data is still there, just hidden from active listings.

## Nullable Fields

Optional columns use Go pointer types:

| SQL column | Go type | JSON behavior |
|---|---|---|
| `TEXT` (required) | `string` | always present |
| `TEXT` (nullable) | `*string` | omitted when nil with `omitempty` |
| `INTEGER` (nullable) | `*int` | omitted when nil |
| `REAL` (nullable) | `*float64` | omitted when nil |
| `TIMESTAMP` (nullable) | `*time.Time` | omitted when nil |

When scanning nullable columns from SQL, use `sql.NullString`, `sql.NullInt64`, `sql.NullFloat64`, `sql.NullTime` and convert to pointers after scanning.

## Migrations

SQL migrations are embedded in the binary via `//go:embed` and run on startup:

```
internal/migration/
  migrations.go     — embed directive + runner
  001_initial.sql   — full schema creation
```

Migrations run sequentially. A `schema_migrations` table tracks which have been applied. Each migration runs inside a transaction.
