# Implementation Patterns

Cross-cutting implementation conventions for the Compound Go backend: DTOs, two-layer validation, logging, and configuration.

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

This is the pre-`allowed_origins` shape shown as a reference for struct mapping. The full generated config (including `allowed_origins`) is in [local-development.md](local-development.md).

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

If no config file exists on first run, the app generates `compound.yaml` with defaults and writes it to the current directory. Subsequent runs load the file. Defaults are applied for any fields absent from the file.

The YAML includes an `allowed_origins` list under `server` for CORS. Default is `["*"]` (wildcard) — suitable for local development and the single-user cloud deployment. Tighten this before adding OAuth2 protection in Phase 2.

```yaml
server:
  port: 8080
  host: "localhost"
  allowed_origins:
    - "*"

database:
  path: "compound.db"

log:
  level: "info"
```

The `ServerConfig` struct gains an `AllowedOrigins []string` field. The chi CORS middleware reads this slice at startup.
