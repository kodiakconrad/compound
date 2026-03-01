# Naming Conventions

Go naming conventions for the Compound codebase.

## Receiver Names

Single letter, derived from the type name:

```go
func (e *Exercise) Validate() error { ... }
func (p *Program) AddWorkout(w *ProgramWorkout) { ... }
func (s *Store) CreateExercise(ctx context.Context, db DBTX, e *Exercise) error { ... }
func (h *ExerciseHandler) HandleCreate(w http.ResponseWriter, r *http.Request) { ... }
```

Use the same letter consistently for a given type across all its methods.

## Constructors

Standard `NewXxx()` pattern:

```go
// Simple constructors
store.NewStore(db)
server.NewServer(store)

// Domain constructors with required fields
domain.NewExercise(name string, trackingType TrackingType)

// From-variant when converting from another type
dto.NewExerciseFromRequest(req *CreateExerciseRequest)
```

## Interfaces

Use `-er` suffix, idiomatic Go style. Only define interfaces when needed for abstraction:

```go
// DBTX is the primary interface — satisfies both *sql.DB and *sql.Tx
type DBTX interface {
    ExecContext(ctx context.Context, query string, args ...any) (sql.Result, error)
    QueryContext(ctx context.Context, query string, args ...any) (*sql.Rows, error)
    QueryRowContext(ctx context.Context, query string, args ...any) *sql.Row
}

// Future interfaces follow -er convention
type Validator interface {
    Validate() error
}
```

Don't create interfaces preemptively. Add them when a second implementation or test mock is needed.

## Error Constructors

`NewXxxError()` pattern for custom domain error types:

```go
NewNotFoundError("exercise", 42)
NewValidationError("name", "must not be empty")
NewConflictError("exercise with this name already exists")
```

Error type names end in `Error`:

```go
type NotFoundError struct { ... }
type ValidationError struct { ... }
type ConflictError struct { ... }
```

## File Names

`domain_layer.go` — domain concept first, layer second:

```
internal/store/
  exercise_store.go
  program_store.go
  cycle_store.go

internal/handler/
  exercise_handler.go
  program_handler.go
  cycle_handler.go

internal/domain/
  exercise.go          — no suffix needed, package is the layer
  program.go
  cycle.go
  errors.go
```

Test files follow Go convention — same name with `_test.go`:

```
internal/domain/exercise_test.go
internal/store/exercise_store_test.go
```

## Test Names

`TestSubject_Behavior` — describes what's tested and the specific scenario:

```go
// Store tests
func TestCreateExercise_Success(t *testing.T) { ... }
func TestCreateExercise_EmptyName(t *testing.T) { ... }
func TestGetExercise_NotFound(t *testing.T) { ... }
func TestListExercises_FilterByMuscleGroup(t *testing.T) { ... }

// Domain tests
func TestExerciseValidate_InvalidTrackingType(t *testing.T) { ... }
func TestTrackingType_IsValid(t *testing.T) { ... }
func TestProgressionRule_NextWeight(t *testing.T) { ... }
```

For table-driven tests, use `t.Run()` with descriptive subtest names:

```go
func TestExerciseValidate(t *testing.T) {
    tests := []struct {
        name    string
        // ...
    }{
        {name: "valid exercise", ...},
        {name: "empty name", ...},
        {name: "invalid tracking type", ...},
    }
    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) { ... })
    }
}
```

## Exports

Export at the package boundary — export types and functions used by other packages, unexport internal helpers:

### `domain/` — export models, value objects, errors

```go
// Exported — used by store, handler, dto
type Exercise struct { ... }
type TrackingType string
func NewNotFoundError(...) *NotFoundError

// Unexported — internal helpers
func sanitizeName(s string) string
```

### `store/` — export Store, DBTX, and all query methods

```go
// Exported — used by handler, seed
type Store struct { DB *sql.DB }
type DBTX interface { ... }
func (s *Store) CreateExercise(...)
func (s *Store) WithTx(...)

// Unexported — SQL helpers
func scanExercise(row *sql.Row) (*domain.Exercise, error)
```

### `handler/` — export handler structs and constructors

```go
// Exported — used by server/routes.go
type ExerciseHandler struct { ... }
func NewExerciseHandler(store *store.Store) *ExerciseHandler
func (h *ExerciseHandler) HandleCreate(w http.ResponseWriter, r *http.Request)

// Unexported — shared helpers
func respond(w http.ResponseWriter, status int, body any)
func decode(r *http.Request, v any) error
func respondError(w http.ResponseWriter, err error)
```

### `dto/` — export all request/response types and mappers

```go
// Exported — used by handler
type CreateExerciseRequest struct { ... }
type ExerciseResponse struct { ... }
func ToExerciseResponse(e *domain.Exercise) ExerciseResponse
```

## General Go Conventions

- **Variables**: camelCase (`exerciseID`, `trackingType`, not `exercise_id`)
- **Constants**: PascalCase if exported (`TrackingWeightReps`), camelCase if not
- **Acronyms**: all caps (`ID`, `UUID`, `HTTP`, `API`, `SQL`, `URL`, not `Id`, `Uuid`)
- **Context**: always first parameter, named `ctx` (`func Foo(ctx context.Context, ...)`)
- **Errors**: always last return value (`func Foo() (*Thing, error)`)
