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
GET /api/v1/programs?is_prebuilt=true
GET /api/v1/cycles?status=active
GET /api/v1/exercises?search=bench    (name search)
```

The canonical allowed values for `muscle_group`, `equipment`, and `tracking_type` are served dynamically by `GET /api/v1/exercises/filters` — do not hardcode enum lists in frontend clients.

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
2. Server stores the key, method, path, status, and full response body in the `idempotency_keys` table
3. If the same key is sent again, server returns the stored response without re-executing
4. Using the same key on a different endpoint returns 422
5. Keys expire after 24 hours; expired keys are filtered out on read (no background cleanup)

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

### Health

```
GET /health    — returns 200 {"status": "ok"} — used by cloud platform health checks (Fly.io etc.)
```

This endpoint is intentionally outside the `/api/v1` prefix and requires no auth. It is not versioned.

### Exercises

```
GET    /api/v1/exercises                  — list (search, filter, paginate, sort)
GET    /api/v1/exercises/{id}             — get one
GET    /api/v1/exercises/filters          — return allowed enum values for filter UIs
POST   /api/v1/exercises                  — create custom exercise
PUT    /api/v1/exercises/{id}             — update
DELETE /api/v1/exercises/{id}             — soft delete (custom only)
```

**`GET /api/v1/exercises/filters` response:**
```json
{
  "data": {
    "muscle_groups": ["chest", "back", "legs", "shoulders", "biceps", "triceps", "core", "cardio", "other"],
    "equipment": ["barbell", "dumbbell", "cable", "machine", "bodyweight", "band", "kettlebell", "other"],
    "tracking_types": ["weight_reps", "bodyweight_reps", "duration", "distance"]
  }
}
```

### Programs & Templates

Prebuilt programs (seeded content) have `is_prebuilt=1` and are read-only. All user-created programs are identical in structure — there is no separate "template" type. Any program can be deep-copied to create an independent copy.

**List vs detail response shapes:**
- `GET /api/v1/programs` — returns **summary shape** only (no tree). Use for list views.
- `GET /api/v1/programs/{id}` — returns **full tree** (workouts → sections → exercises → progression rules).

**List response item shape:**
```json
{
  "uuid": "...",
  "name": "5/3/1",
  "is_prebuilt": false,
  "workout_count": 4,
  "updated_at": "2026-03-08T10:00:00Z"
}
```

```
GET    /api/v1/programs                   — list (filter: ?is_prebuilt=true)
GET    /api/v1/programs/{id}              — get with full workout/section/exercise tree
POST   /api/v1/programs                   — create program
POST   /api/v1/programs/{id}/copy         — deep copy a program into a new program
PUT    /api/v1/programs/{id}              — update program metadata
DELETE /api/v1/programs/{id}              — soft delete
```

### Workouts (within a program)

```
POST   /api/v1/programs/{id}/workouts                — add workout day
PUT    /api/v1/programs/{id}/workouts/{wid}          — update workout
DELETE /api/v1/programs/{id}/workouts/{wid}          — delete workout
PUT    /api/v1/programs/{id}/workouts/reorder        — reorder workouts
```

### Sections (within a workout)

```
POST   /api/v1/programs/{id}/workouts/{wid}/sections              — add section
PUT    /api/v1/programs/{id}/workouts/{wid}/sections/{sid}        — update
DELETE /api/v1/programs/{id}/workouts/{wid}/sections/{sid}        — delete
PUT    /api/v1/programs/{id}/workouts/{wid}/sections/reorder      — reorder sections
```

### Section Exercises

```
POST   /api/v1/programs/{id}/workouts/{wid}/sections/{sid}/exercises              — add exercise
PUT    /api/v1/programs/{id}/workouts/{wid}/sections/{sid}/exercises/{eid}        — update targets
DELETE /api/v1/programs/{id}/workouts/{wid}/sections/{sid}/exercises/{eid}        — remove
PUT    /api/v1/programs/{id}/workouts/{wid}/sections/{sid}/exercises/reorder      — reorder exercises
```

### Reorder Request Shape

All three reorder endpoints use the same request body — an ordered list of UUIDs:

```json
{
  "uuids": ["uuid-c", "uuid-a", "uuid-b"]
}
```

The server reindexes `sort_order` sequentially (1, 2, 3...) to match the supplied order. Returns 200 with the updated list. Returns 422 if any UUID doesn't belong to the parent resource.

### Cycles

```
POST   /api/v1/programs/{id}/start        — start a cycle from a program
GET    /api/v1/cycles                      — list cycles (active, completed)
GET    /api/v1/cycles/{id}                 — get cycle with sessions
PUT    /api/v1/cycles/{id}                 — pause/complete cycle
```

### Sessions

```
GET    /api/v1/sessions/active                       — get in-progress session (convenience for app resume)
GET    /api/v1/cycles/{cid}/sessions/{sid}           — get session detail (targets + logged sets)
POST   /api/v1/cycles/{cid}/sessions/{sid}/start     — start a session (pending → in_progress)
POST   /api/v1/cycles/{cid}/sessions/{sid}/sets      — log a set
PUT    /api/v1/cycles/{cid}/sessions/{sid}/complete  — complete session (in_progress → completed)
PUT    /api/v1/cycles/{cid}/sessions/{sid}/skip      — skip session (pending or in_progress → skipped)
DELETE /api/v1/sessions/{sid}/sets?exercise_uuid={}  — delete all set_logs for an exercise in a session
```

**`GET /api/v1/sessions/active` response:**

Returns the single in-progress session with targets and actuals combined — designed so the Today tab and session resume flow require a single call.

```json
{
  "data": {
    "uuid": "...",
    "cycle_uuid": "...",
    "workout_name": "Day A — Push",
    "status": "in_progress",
    "started_at": "2026-03-08T10:00:00Z",
    "sections": [
      {
        "uuid": "...",
        "name": "Compound",
        "exercises": [
          {
            "section_exercise_uuid": "...",
            "exercise_uuid": "...",
            "name": "Bench Press",
            "target_sets": 3,
            "target_reps": 5,
            "target_weight": 80.0,
            "rest_seconds": 180,
            "logged_sets": [
              {
                "uuid": "...",
                "set_number": 1,
                "actual_reps": 5,
                "weight": 80.0,
                "completed_at": "2026-03-08T10:05:00Z"
              }
            ]
          }
        ]
      }
    ]
  }
}
```

Returns `404` with code `no_active_session` when no session is in progress.

**`DELETE /api/v1/sessions/{sid}/sets?exercise_uuid={uuid}`**

Deletes all `set_logs` for the given exercise in the given session. Used when the user substitutes an exercise mid-session after having already logged some sets — those partial logs are discarded before logging begins under the substitute.

- Returns `204 No Content`
- Returns `404` if session or exercise not found
- Returns `422` if session is not `in_progress`

### Progress

```
GET    /api/v1/progress/exercise/{id}     — history for one exercise (chart-ready time series)
GET    /api/v1/progress/prs               — personal records across exercises
GET    /api/v1/progress/summary           — overall stats (total sessions, streak, etc.)
```

**`GET /api/v1/progress/exercise/{id}` response** — pre-aggregated, chart-ready. Each entry represents one session:

```json
{
  "data": [
    { "date": "2026-01-05", "weight": 75.0, "reps": 5, "volume": 375.0 },
    { "date": "2026-01-12", "weight": 77.5, "reps": 5, "volume": 387.5 },
    { "date": "2026-01-19", "weight": 80.0, "reps": 5, "volume": 400.0 }
  ]
}
```

`volume` = `weight × reps` for the best set of that session. Ordered ascending by date. Clients pass this directly to a charting library.
