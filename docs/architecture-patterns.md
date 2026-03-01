# Architecture Patterns

Architectural decisions and conventions for the Compound Go backend. Read alongside [persistence.md](persistence.md) (store layer details), [schema-design.md](schema-design.md) (database schema), and [project-structure.md](project-structure.md) (package layout).

## DDD — Full Domain-Driven Design

### Domain Layer (`internal/domain/`)

The domain package contains all business logic. It has no dependencies on infrastructure (no SQL, no HTTP, no external packages beyond stdlib).

**Models** carry behavior — validation, factory methods, state transitions:

```go
type Exercise struct {
    ID           int64
    UUID         string
    Name         string
    MuscleGroup  *string
    Equipment    *string
    TrackingType TrackingType
    Notes        *string
    IsCustom     bool
    CreatedAt    time.Time
    UpdatedAt    time.Time
    DeletedAt    *time.Time
}

func (e *Exercise) Validate() error {
    if strings.TrimSpace(e.Name) == "" {
        return NewValidationError("name", "must not be empty")
    }
    if !e.TrackingType.IsValid() {
        return NewValidationError("tracking_type", "must be one of: weight_reps, bodyweight_reps, duration, distance")
    }
    return nil
}
```

**Value objects** encapsulate constrained types:

```go
type TrackingType string

const (
    TrackingWeightReps    TrackingType = "weight_reps"
    TrackingBodyweightReps TrackingType = "bodyweight_reps"
    TrackingDuration      TrackingType = "duration"
    TrackingDistance       TrackingType = "distance"
)

func (t TrackingType) IsValid() bool {
    switch t {
    case TrackingWeightReps, TrackingBodyweightReps, TrackingDuration, TrackingDistance:
        return true
    }
    return false
}
```

**Aggregates** — domain objects that are always loaded/saved as a unit:

| Aggregate Root | Contains |
|---|---|
| `Exercise` | standalone |
| `Program` | ProgramWorkouts → Sections → SectionExercises → ProgressionRules |
| `Cycle` | Sessions |
| `Session` | SetLogs |

A `Program` is always created/loaded with its full tree. Partial updates (add a workout, reorder sections) go through the aggregate root.

### What Lives Where

| Concern | Layer | Example |
|---|---|---|
| "Is this name non-empty?" | Domain (model validation) | `Exercise.Validate()` |
| "Does this exercise exist?" | Store (query) | `Store.GetExercise()` |
| "Is the request JSON valid?" | Handler (request validation) | decode + check required fields |
| "Map request to domain model" | Handler/DTO | `dto.ToExercise()` |
| "Begin transaction for nested write" | Handler (orchestration) | `Store.WithTx()` |
| "Calculate next weight" | Domain (business logic) | `ProgressionRule.NextWeight()` |

## Error Handling — Domain Error Types

### Domain Errors

Defined in `domain/errors.go`. Custom types that carry context:

```go
type NotFoundError struct {
    Entity string // "exercise", "program", etc.
    ID     int64
}

func (e *NotFoundError) Error() string {
    return fmt.Sprintf("%s with id %d not found", e.Entity, e.ID)
}

type ValidationError struct {
    Field   string
    Message string
}

func (e *ValidationError) Error() string {
    return fmt.Sprintf("validation failed on %s: %s", e.Field, e.Message)
}

type ConflictError struct {
    Message string
}

func (e *ConflictError) Error() string {
    return e.Message
}
```

### HTTP Error Mapping

Handlers map domain errors to HTTP responses in a shared helper:

```go
func respondError(w http.ResponseWriter, err error) {
    var notFound *domain.NotFoundError
    var validation *domain.ValidationError
    var conflict *domain.ConflictError

    switch {
    case errors.As(err, &notFound):
        respond(w, http.StatusNotFound, map[string]string{"error": err.Error()})
    case errors.As(err, &validation):
        respond(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
    case errors.As(err, &conflict):
        respond(w, http.StatusConflict, map[string]string{"error": err.Error()})
    default:
        slog.Error("internal error", "error", err)
        respond(w, http.StatusInternalServerError, map[string]string{"error": "internal server error"})
    }
}
```

Store methods return domain errors (e.g., `&NotFoundError{...}` when a query returns no rows). Handlers call `respondError` — never construct HTTP status codes from business logic.

## DTOs — Separate Request/Response Types

Domain models are never serialized directly to JSON. Handlers map between DTOs and domain types.

```go
// dto/exercise.go

type CreateExerciseRequest struct {
    Name         string  `json:"name"`
    MuscleGroup  *string `json:"muscle_group"`
    Equipment    *string `json:"equipment"`
    TrackingType string  `json:"tracking_type"`
    Notes        *string `json:"notes"`
}

type ExerciseResponse struct {
    UUID         string  `json:"uuid"`
    Name         string  `json:"name"`
    MuscleGroup  *string `json:"muscle_group,omitempty"`
    Equipment    *string `json:"equipment,omitempty"`
    TrackingType string  `json:"tracking_type"`
    Notes        *string `json:"notes,omitempty"`
    CreatedAt    string  `json:"created_at"`
    UpdatedAt    string  `json:"updated_at"`
}

func ToExerciseResponse(e *domain.Exercise) ExerciseResponse {
    return ExerciseResponse{
        UUID:         e.UUID,
        Name:         e.Name,
        MuscleGroup:  e.MuscleGroup,
        Equipment:    e.Equipment,
        TrackingType: string(e.TrackingType),
        Notes:        e.Notes,
        CreatedAt:    e.CreatedAt.Format(time.RFC3339),
        UpdatedAt:    e.UpdatedAt.Format(time.RFC3339),
    }
}
```

**Key rules:**
- Requests never include `id`, `uuid`, `created_at`, `updated_at` — those are server-generated
- Responses expose `uuid` (not integer `id`) as the external identifier
- Timestamps in responses are ISO 8601 strings
- DTOs live in `handler/dto/`, not in the domain package

## Validation — Two Layers

### Handler Layer (Request Shape)

Validates that the request is well-formed before constructing a domain object:

- Required fields are present
- JSON is parseable
- Types are correct (string where expected, number where expected)
- String lengths / basic format checks

```go
func (r *CreateExerciseRequest) Validate() error {
    if strings.TrimSpace(r.Name) == "" {
        return &domain.ValidationError{Field: "name", Message: "is required"}
    }
    return nil
}
```

### Domain Layer (Business Rules)

Validates domain invariants after the object is constructed:

- `TrackingType` is a valid enum value
- `ProgressionRule.Increment` is positive when strategy is `linear`
- `Section.SortOrder` is non-negative
- A program must have at least one workout (if enforced)

```go
func (e *Exercise) Validate() error {
    if !e.TrackingType.IsValid() {
        return &ValidationError{Field: "tracking_type", Message: "invalid value"}
    }
    return nil
}
```

Handler validation catches malformed input early. Domain validation enforces business rules regardless of entry point (handler, seed data, tests).

## Logging — `log/slog`

Use Go's stdlib structured logger. No external dependencies.

```go
slog.Info("creating program", "program_id", program.ID, "workouts", len(workouts))
slog.Error("failed to create exercise", "error", err)
```

**Convention:**
- Log at handler boundaries (request received, response sent, errors)
- Log in store layer only for unexpected conditions (not for normal queries)
- Use structured key-value pairs, not string interpolation
- Include relevant IDs (`program_id`, `exercise_id`) for traceability
- `Error` level for failures that need attention, `Info` for notable events, `Debug` for development

## Configuration — Config File

Configuration loaded from a YAML file with sensible defaults. Config file path can be overridden via a `COMPOUND_CONFIG` environment variable.

```
compound.yaml (project root, gitignored)
```

```yaml
server:
  port: 8080
  host: "localhost"

database:
  path: "compound.db"

log:
  level: "info"   # debug, info, warn, error
```

```go
// internal/config/config.go

type Config struct {
    Server   ServerConfig   `yaml:"server"`
    Database DatabaseConfig `yaml:"database"`
    Log      LogConfig      `yaml:"log"`
}

type ServerConfig struct {
    Port int    `yaml:"port"`
    Host string `yaml:"host"`
}

type DatabaseConfig struct {
    Path string `yaml:"path"`
}

type LogConfig struct {
    Level string `yaml:"level"`
}
```

Defaults are applied when fields are absent from the file. If no config file exists on first run, the app runs with defaults.

## Testing Strategy

### Integration Tests (Store Layer)

Test against a real SQLite database (in-memory) to verify actual SQL behavior:

```go
func setupTestStore(t *testing.T) *Store {
    t.Helper()
    db, err := sql.Open("sqlite", ":memory:")
    require.NoError(t, err)
    t.Cleanup(func() { db.Close() })
    runMigrations(db)
    return New(db)
}

func TestCreateExercise(t *testing.T) {
    s := setupTestStore(t)
    ex := &domain.Exercise{Name: "Bench Press", TrackingType: domain.TrackingWeightReps}
    err := s.CreateExercise(context.Background(), s.DB, ex)
    require.NoError(t, err)
    assert.NotZero(t, ex.ID)
    assert.NotEmpty(t, ex.UUID)
}
```

No mocks — tests run real SQL against real SQLite. Fast because SQLite in-memory databases are instant.

### Acceptance Tests (User Journeys)

Cucumber/BDD-style tests that verify end-to-end user workflows through the HTTP API. Uses `godog` (Go Cucumber implementation) or a similar BDD framework.

```gherkin
Feature: Program Management
  Scenario: Create a program from a template
    Given a template "5/3/1" exists
    When I create a program from template "5/3/1"
    Then a new program should be created
    And it should have the same workouts as "5/3/1"

  Scenario: Track a workout session
    Given I have an active cycle for "My PPL Program"
    And the next session is "Push Day"
    When I start the session
    And I log 5 reps at 225 lbs for "Bench Press" set 1
    And I complete the session
    Then the session status should be "completed"
    And my "Bench Press" history should include the logged set
```

Acceptance tests start a real HTTP server with a test database, exercise the full stack (handler → store → SQLite), and verify responses. They serve as living documentation of user-facing behavior.

```
tests/
  acceptance/
    features/
      exercises.feature
      programs.feature
      cycles.feature
      sessions.feature
    steps/
      exercise_steps.go
      program_steps.go
      cycle_steps.go
      session_steps.go
    main_test.go            — test server setup, godog runner
```

### What Gets Tested Where

| Layer | Test Type | What It Verifies |
|---|---|---|
| `domain/` | Unit tests | Validation rules, value objects, business logic |
| `store/` | Integration tests | SQL queries, transactions, data integrity |
| `handler/` | Acceptance tests | Full request/response cycle, error mapping, serialization |
| End-to-end | Acceptance tests | User journeys across multiple endpoints |
