# REST API

All endpoints are prefixed with `/api/v1`. Request and response bodies are JSON. Resource IDs in URLs are UUIDs.

## Conventions

### Versioning

API is versioned via URL prefix: `/api/v1/...`. Breaking changes go in `/api/v2/...` when needed.

### Response Envelope

All responses use a consistent wrapper:

**Single resource:**
```json
{
  "data": {
    "uuid": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Bench Press",
    "tracking_type": "weight_reps",
    "created_at": "2026-03-01T12:00:00Z"
  }
}
```

**List (paginated):**
```json
{
  "data": [
    { "uuid": "...", "name": "Bench Press" },
    { "uuid": "...", "name": "Squat" }
  ],
  "pagination": {
    "next_cursor": "eyJpZCI6NDJ9",
    "has_more": true
  }
}
```

**Empty list:**
```json
{
  "data": [],
  "pagination": {
    "has_more": false
  }
}
```

### Pagination — Cursor-Based

List endpoints use cursor-based pagination. The cursor is an opaque base64-encoded token — clients should not parse or construct cursors.

**Query parameters:**
- `limit` — number of items per page (default: 20, max: 100)
- `cursor` — cursor from a previous response's `pagination.next_cursor`

```
GET /api/v1/exercises?limit=10
GET /api/v1/exercises?limit=10&cursor=eyJpZCI6NDJ9
```

**How it works:**
1. First request omits `cursor` — returns the first page
2. Response includes `pagination.next_cursor` if more items exist
3. Client passes `cursor` in the next request to get the next page
4. When `has_more` is `false`, there are no more pages

**Implementation:** Cursors encode the last item's sort key (typically `id`). The query uses `WHERE id > ?` for forward pagination. This is consistent regardless of concurrent inserts/deletes.

### Filtering & Sorting

**Filtering** — query parameters match field names:
```
GET /api/v1/exercises?muscle_group=chest&equipment=barbell
GET /api/v1/programs?is_template=true
GET /api/v1/cycles?status=active
GET /api/v1/exercises?search=bench    (name search)
```

**Sorting** — `sort` and `order` query parameters:
```
GET /api/v1/exercises?sort=name&order=asc
GET /api/v1/exercises?sort=created_at&order=desc
```

- `sort` — field to sort by (whitelisted per endpoint, default varies)
- `order` — `asc` or `desc` (default: `asc`)

**Default sorts:**
| Endpoint | Default sort |
|---|---|
| Exercises | `name asc` |
| Programs | `updated_at desc` |
| Cycles | `created_at desc` |
| Sessions | `sort_order asc` |

### Idempotency

POST requests support an `Idempotency-Key` header for safe retries:

```
POST /api/v1/exercises
Idempotency-Key: 7c3e7e4a-1b2c-4d5e-9f8a-0b1c2d3e4f5a
Content-Type: application/json

{"name": "Bench Press", "tracking_type": "weight_reps"}
```

**How it works:**
1. Client generates a unique key (UUID recommended) and sends it with the request
2. Server stores the key + response in an `idempotency_keys` table
3. If the same key is sent again, server returns the stored response without re-executing
4. Keys expire after 24 hours

**When to use:** All POST (create) endpoints. PUT endpoints are naturally idempotent (same input → same result). DELETE endpoints are naturally idempotent (deleting twice → same outcome).

### Error Responses

See [error-handling.md](error-handling.md) for domain error types and HTTP mapping.

Error responses use a consistent format with a machine-readable code and human-readable message:

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

**Error codes and HTTP status mapping:**

| HTTP Status | Error Code | When |
|---|---|---|
| 400 | `validation_failed` | Request body fails validation |
| 400 | `bad_request` | Malformed JSON, missing content-type, etc. |
| 404 | `not_found` | Resource doesn't exist (or is soft-deleted) |
| 409 | `conflict` | Duplicate resource, state conflict |
| 422 | `unprocessable` | Valid JSON but semantically wrong (e.g., start a completed cycle) |
| 500 | `internal_error` | Unexpected server error (details logged, not exposed) |

**Single-field errors** (not found, conflict) omit the `details` array:
```json
{
  "error": {
    "code": "not_found",
    "message": "exercise with id 550e8400-... not found"
  }
}
```

## Endpoints

### Exercises

```
GET    /api/v1/exercises                  — list (search, filter, paginate, sort)
GET    /api/v1/exercises/{id}             — get one
POST   /api/v1/exercises                  — create custom exercise
PUT    /api/v1/exercises/{id}             — update
DELETE /api/v1/exercises/{id}             — soft delete (custom only)
```

### Programs & Templates

Templates are programs with `is_template=1`. No separate endpoints.

```
GET    /api/v1/programs                   — list (filter: ?is_template=true for templates)
GET    /api/v1/programs/{id}              — get with full workout/section/exercise tree
POST   /api/v1/programs                   — create program (set is_template=true for template)
POST   /api/v1/programs/{id}/copy         — deep copy a program/template into a new program
PUT    /api/v1/programs/{id}              — update program metadata
DELETE /api/v1/programs/{id}              — soft delete
```

### Workouts (within a program)

```
POST   /api/v1/programs/{id}/workouts                — add workout day
PUT    /api/v1/programs/{id}/workouts/{wid}          — update workout
DELETE /api/v1/programs/{id}/workouts/{wid}          — delete workout
```

### Sections (within a workout)

```
POST   /api/v1/programs/{id}/workouts/{wid}/sections              — add section
PUT    /api/v1/programs/{id}/workouts/{wid}/sections/{sid}        — update
DELETE /api/v1/programs/{id}/workouts/{wid}/sections/{sid}        — delete
```

### Section Exercises

```
POST   /api/v1/programs/{id}/workouts/{wid}/sections/{sid}/exercises        — add exercise
PUT    /api/v1/programs/{id}/workouts/{wid}/sections/{sid}/exercises/{eid}  — update targets
DELETE /api/v1/programs/{id}/workouts/{wid}/sections/{sid}/exercises/{eid}  — remove
```

### Cycles

```
POST   /api/v1/programs/{id}/start        — start a cycle from a program
GET    /api/v1/cycles                      — list cycles (active, completed)
GET    /api/v1/cycles/{id}                 — get cycle with sessions
PUT    /api/v1/cycles/{id}                 — pause/complete cycle
```

### Sessions

```
GET    /api/v1/cycles/{cid}/sessions/{sid}          — get session detail
POST   /api/v1/cycles/{cid}/sessions/{sid}/start    — start a session
POST   /api/v1/cycles/{cid}/sessions/{sid}/sets     — log a set
PUT    /api/v1/cycles/{cid}/sessions/{sid}/complete  — complete session
```

### Progress

```
GET    /api/v1/progress/exercise/{id}     — history for one exercise (weight, volume over time)
GET    /api/v1/progress/prs               — personal records across exercises
GET    /api/v1/progress/summary           — overall stats (total sessions, streak, etc.)
```
