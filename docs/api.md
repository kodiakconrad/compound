# REST API

All endpoints are prefixed with `/api`. Request and response bodies are JSON. Resource IDs in URLs are UUIDs.

## Exercises

```
GET    /api/exercises                  — list (with search, filter by muscle_group/equipment)
GET    /api/exercises/{id}             — get one
POST   /api/exercises                  — create custom exercise
PUT    /api/exercises/{id}             — update
DELETE /api/exercises/{id}             — soft delete (custom only)
```

## Programs & Templates

Templates are programs with `is_template=1`. No separate endpoints.

```
GET    /api/programs                   — list (filter: ?is_template=true for templates)
GET    /api/programs/{id}              — get with full workout/section/exercise tree
POST   /api/programs                   — create program (set is_template=true for template)
POST   /api/programs/{id}/copy         — deep copy a program/template into a new program
PUT    /api/programs/{id}              — update program metadata
DELETE /api/programs/{id}              — soft delete
```

## Workouts (within a program)

```
POST   /api/programs/{id}/workouts                — add workout day
PUT    /api/programs/{id}/workouts/{wid}          — update workout
DELETE /api/programs/{id}/workouts/{wid}          — delete workout
```

## Sections (within a workout)

```
POST   /api/programs/{id}/workouts/{wid}/sections              — add section
PUT    /api/programs/{id}/workouts/{wid}/sections/{sid}        — update
DELETE /api/programs/{id}/workouts/{wid}/sections/{sid}        — delete
```

## Section Exercises

```
POST   /api/programs/{id}/workouts/{wid}/sections/{sid}/exercises        — add exercise
PUT    /api/programs/{id}/workouts/{wid}/sections/{sid}/exercises/{eid}  — update targets
DELETE /api/programs/{id}/workouts/{wid}/sections/{sid}/exercises/{eid}  — remove
```

## Cycles

```
POST   /api/programs/{id}/start        — start a cycle from a program
GET    /api/cycles                      — list cycles (active, completed)
GET    /api/cycles/{id}                 — get cycle with sessions
PUT    /api/cycles/{id}                 — pause/complete cycle
```

## Sessions

```
GET    /api/cycles/{cid}/sessions/{sid}          — get session detail
POST   /api/cycles/{cid}/sessions/{sid}/start    — start a session
POST   /api/cycles/{cid}/sessions/{sid}/sets     — log a set
PUT    /api/cycles/{cid}/sessions/{sid}/complete  — complete session
```

## Progress

```
GET    /api/progress/exercise/{id}     — history for one exercise (weight, volume over time)
GET    /api/progress/prs               — personal records across exercises
GET    /api/progress/summary           — overall stats (total sessions, streak, etc.)
```
