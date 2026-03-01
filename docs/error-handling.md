# Error Handling

How errors flow from the domain layer through to HTTP responses.

## Domain Error Types

Defined in `domain/errors.go`. Custom types that carry context for the handler layer to map to HTTP responses.

```go
type NotFoundError struct {
    Entity string // "exercise", "program", etc.
    ID     string // UUID
}

func (e *NotFoundError) Error() string {
    return fmt.Sprintf("%s with id %s not found", e.Entity, e.ID)
}

func NewNotFoundError(entity string, id string) *NotFoundError {
    return &NotFoundError{Entity: entity, ID: id}
}

type ValidationError struct {
    Field   string
    Message string
}

func (e *ValidationError) Error() string {
    return fmt.Sprintf("validation failed on %s: %s", e.Field, e.Message)
}

func NewValidationError(field string, message string) *ValidationError {
    return &ValidationError{Field: field, Message: message}
}

type ConflictError struct {
    Message string
}

func (e *ConflictError) Error() string {
    return e.Message
}

func NewConflictError(message string) *ConflictError {
    return &ConflictError{Message: message}
}
```

## Error Flow

```
domain/store returns error → handler receives error → respondError maps to HTTP
```

1. **Store layer** returns domain errors (e.g., `NewNotFoundError("exercise", uuid)` when a query returns no rows)
2. **Domain layer** returns validation errors (e.g., `NewValidationError("name", "is required")` from `Validate()`)
3. **Handler layer** catches errors and calls `respondError()` — never constructs HTTP status codes from business logic

## HTTP Error Mapping

Handlers map domain errors to HTTP responses in a shared helper:

```go
func respondError(w http.ResponseWriter, err error) {
    var notFound *domain.NotFoundError
    var validation *domain.ValidationError
    var conflict *domain.ConflictError

    switch {
    case errors.As(err, &notFound):
        respondJSON(w, http.StatusNotFound, errorResponse("not_found", err.Error(), nil))
    case errors.As(err, &validation):
        respondJSON(w, http.StatusBadRequest, errorResponse("validation_failed", "Request validation failed", []fieldError{
            {Field: validation.Field, Message: validation.Message},
        }))
    case errors.As(err, &conflict):
        respondJSON(w, http.StatusConflict, errorResponse("conflict", err.Error(), nil))
    default:
        slog.Error("internal error", "error", err)
        respondJSON(w, http.StatusInternalServerError, errorResponse("internal_error", "internal server error", nil))
    }
}
```

## Error Response Format

All error responses use a consistent JSON structure. See [api.md](api.md) for the full error code table.

**With field details (validation errors):**
```json
{
  "error": {
    "code": "validation_failed",
    "message": "Request validation failed",
    "details": [
      { "field": "name", "message": "is required" },
      { "field": "tracking_type", "message": "must be one of: weight_reps, bodyweight_reps, duration, distance" }
    ]
  }
}
```

**Without details (not found, conflict, internal):**
```json
{
  "error": {
    "code": "not_found",
    "message": "exercise with id 550e8400-... not found"
  }
}
```

## Error Response Types

```go
type errorBody struct {
    Code    string       `json:"code"`
    Message string       `json:"message"`
    Details []fieldError `json:"details,omitempty"`
}

type fieldError struct {
    Field   string `json:"field"`
    Message string `json:"message"`
}

type errorEnvelope struct {
    Error errorBody `json:"error"`
}

func errorResponse(code string, message string, details []fieldError) errorEnvelope {
    return errorEnvelope{
        Error: errorBody{
            Code:    code,
            Message: message,
            Details: details,
        },
    }
}
```

## Multiple Validation Errors

When a request has multiple validation failures, collect them all before responding:

```go
func (r *CreateExerciseRequest) Validate() []fieldError {
    var errs []fieldError
    if strings.TrimSpace(r.Name) == "" {
        errs = append(errs, fieldError{Field: "name", Message: "is required"})
    }
    if r.TrackingType != "" && !domain.TrackingType(r.TrackingType).IsValid() {
        errs = append(errs, fieldError{Field: "tracking_type", Message: "must be one of: weight_reps, bodyweight_reps, duration, distance"})
    }
    return errs
}
```

Handlers check the slice and respond with all errors at once:

```go
if errs := req.Validate(); len(errs) > 0 {
    respondJSON(w, http.StatusBadRequest, errorResponse("validation_failed", "Request validation failed", errs))
    return
}
```

This gives clients all field errors in a single round trip rather than one at a time.

## Rules

- Store methods return domain errors, never raw `sql.ErrNoRows` or similar
- Handlers call `respondError()` — never build HTTP status codes from business logic
- Internal errors (unexpected failures) are logged with `slog.Error` but only "internal server error" is sent to the client
- Domain validation returns domain errors; DTO validation returns field error slices
