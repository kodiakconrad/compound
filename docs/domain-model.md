# Domain Model

Detailed specification of the Compound domain — aggregates, entities, value objects, business rules, and state machines.

## Domain Layer (`internal/domain/`)

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
    TrackingWeightReps     TrackingType = "weight_reps"
    TrackingBodyweightReps TrackingType = "bodyweight_reps"
    TrackingDuration       TrackingType = "duration"
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

## Aggregates

| Aggregate Root | Contains |
|---|---|
| `Exercise` | standalone |
| `Program` | ProgramWorkouts → Sections → SectionExercises → ProgressionRules |
| `Cycle` | Sessions → SetLogs |

A `Program` is always created/loaded with its full tree. Partial updates (add a workout, reorder sections) load only the minimum context needed to enforce invariants, then operate on the specific rows.

### What Lives Where

| Concern | Layer | Example |
|---|---|---|
| "Is this name non-empty?" | Domain (model validation) | `Exercise.Validate()` |
| "Does this exercise exist?" | Store (query) | `Store.GetExercise()` |
| "Is the request JSON valid?" | Handler (request validation) | decode + check required fields |
| "Map request to domain model" | Handler/DTO | `dto.ToExercise()` |
| "Begin transaction for nested write" | Handler (orchestration) | `Store.WithTx()` |
| "Calculate next weight" | Domain (business logic) | `ProgressionRule.NextWeight()` |
| "Are day_numbers unique in this program?" | Domain (invariant) | `Program.AddWorkout()` |

---

## Exercise (standalone)

An exercise is a named movement that can be added to program sections and tracked in sessions.

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
```

**Value objects:**
- `TrackingType` — `weight_reps`, `bodyweight_reps`, `duration`, `distance`
- `MuscleGroup` — plain string, validated against allowed values: `chest`, `back`, `legs`, `shoulders`, `biceps`, `triceps`, `core`, `cardio`, `other`
- `Equipment` — plain string, validated against allowed values: `barbell`, `dumbbell`, `cable`, `machine`, `bodyweight`, `band`, `kettlebell`, `other`

**Validation rules:**
- Name is required, non-empty after trimming whitespace
- TrackingType must be a valid enum value
- MuscleGroup and Equipment must be one of the allowed values, or null
- Only custom exercises (`is_custom=1`) can be updated or deleted

**Soft delete behavior:**
- Soft deleted exercises are hidden from listings but their rows remain
- Historical `set_logs` reference `exercise_id` directly — soft delete preserves that history
- Programs referencing a deleted exercise are unaffected; the exercise name is still resolvable via join

---

## Program (aggregate root)

A program is a multi-day workout plan. It contains the full tree: workouts → sections → section_exercises → progression_rules.

Templates are programs with `is_template=1`. Deep copying a template creates a new independent program.

```go
type Program struct {
    ID          int64
    UUID        string
    Name        string
    Description *string
    IsTemplate  bool
    IsPrebuilt  bool
    Workouts    []*ProgramWorkout
    CreatedAt   time.Time
    UpdatedAt   time.Time
    DeletedAt   *time.Time
}

type ProgramWorkout struct {
    ID        int64
    UUID      string
    ProgramID int64
    Name      string
    DayNumber int
    SortOrder int
    Sections  []*Section
    CreatedAt time.Time
    UpdatedAt time.Time
}

type Section struct {
    ID               int64
    UUID             string
    ProgramWorkoutID int64
    Name             string
    SortOrder        int
    RestSeconds      *int
    Exercises        []*SectionExercise
    CreatedAt        time.Time
    UpdatedAt        time.Time
}

type SectionExercise struct {
    ID              int64
    UUID            string
    SectionID       int64
    ExerciseID      int64
    TargetSets      *int
    TargetReps      *int
    TargetWeight    *float64
    TargetDuration  *int
    TargetDistance  *float64
    SortOrder       int
    Notes           *string
    ProgressionRule *ProgressionRule
    CreatedAt       time.Time
    UpdatedAt       time.Time
}

type ProgressionRule struct {
    ID                int64
    UUID              string
    SectionExerciseID int64
    Strategy          ProgressionStrategy
    Increment         *float64
    IncrementPct      *float64
    DeloadThreshold   int
    DeloadPct         float64
    CreatedAt         time.Time
    UpdatedAt         time.Time
}
```

**Value objects:**
- `ProgressionStrategy` — `linear`, `percentage`, `wave`

**Invariants:**
- A program must have a name
- `DayNumber` values must be unique within a program
- `SortOrder` values must be unique within their parent (workouts within a program, sections within a workout, exercises within a section)

**sort_order rebalancing:**
On every insert or move, renumber all siblings sequentially (1, 2, 3...). Lists are small (typically 3–6 siblings), so a full reindex is cheap. No fractional keys.

**Partial updates:**
Operations like AddWorkout and ReorderSections load only the minimum context needed to enforce the relevant invariant, then operate on the specific rows. Example: adding a workout queries existing day_numbers for that program, passes them to `Program.AddWorkout()` for uniqueness validation, then inserts the row.

**Key operations:**
- `AddWorkout` — validates unique day_number, appends to workouts
- `AddSection` — validates sort_order, appends to workout's sections
- `AddExercise` — appends to section's exercises
- `ReorderWorkouts` / `ReorderSections` / `ReorderExercises` — reindexes sort_order for all siblings
- `DeepCopy` — creates a fully independent copy with new UUIDs and timestamps throughout the entire tree (workouts, sections, section_exercises, progression_rules). Used when creating a program from a template.
- Soft delete — sets `deleted_at`, preserves historical cycle data

**Deep copy behavior:**
Every node in the tree gets a new UUID, new integer ID, and fresh `created_at`/`updated_at` timestamps. The copy is fully independent — subsequent edits to the source template do not affect the copied program.

**Edit lock:**
A program cannot be modified while it has an active cycle. The handler checks for an active cycle before allowing any structural edits. Mid-cycle exercise substitutions are handled at the `set_log` level (the user logs a different `exercise_id`) — the program structure itself does not change.

**Validation rules per entity:**

| Entity | Rules |
|---|---|
| `Program` | Name required and non-empty |
| `ProgramWorkout` | Name required; DayNumber must be unique within program; SortOrder non-negative |
| `Section` | Name required; SortOrder non-negative |
| `SectionExercise` | ExerciseID required; SortOrder non-negative; at least one target field should be set |
| `ProgressionRule` | Strategy must be valid enum; Increment required for `linear`; IncrementPct required for `percentage`; DeloadThreshold > 0; DeloadPct between 0 and 100 |

---

## Cycle (aggregate root)

A cycle is an active run of a program. Created when a user starts a program. Contains pre-generated sessions.

```go
type Cycle struct {
    ID          int64
    UUID        string
    ProgramID   int64
    Status      CycleStatus
    StartedAt   *time.Time
    CompletedAt *time.Time
    Sessions    []*Session
    CreatedAt   time.Time
    UpdatedAt   time.Time
}
```

**Value objects:**
- `CycleStatus` — `active`, `paused`, `completed`

**State machine — Cycle:**
```
active → paused → active (resume)
active → completed
paused → completed
```

**Invariants:**
- Multiple cycles can be active simultaneously — no single-cycle constraint in the domain
- All sessions are pre-generated when the cycle starts (one per `ProgramWorkout`)
- A cycle is completed when all its sessions are `completed` or `skipped`

**Session pre-generation:**
When a cycle starts, one `Session` is created per `ProgramWorkout` in the program. Each session stores the `program_workout_id` and inherits the workout's `sort_order`. All sessions start with status `pending`.

---

## Session → SetLogs

A session is a single workout instance within a cycle. SetLogs are the actual performance records.

```go
type Session struct {
    ID               int64
    UUID             string
    CycleID          int64
    ProgramWorkoutID int64
    SortOrder        int
    Status           SessionStatus
    StartedAt        *time.Time
    CompletedAt      *time.Time
    Notes            *string
    SetLogs          []*SetLog
    CreatedAt        time.Time
    UpdatedAt        time.Time
}

type SetLog struct {
    ID                int64
    UUID              string
    SessionID         int64
    ExerciseID        int64
    SectionExerciseID *int64
    SetNumber         int
    TargetReps        *int
    ActualReps        *int
    Weight            *float64
    Duration          *int
    Distance          *float64
    RPE               *float64
    CompletedAt       time.Time
    CreatedAt         time.Time
}
```

**Value objects:**
- `SessionStatus` — `pending`, `in_progress`, `completed`, `skipped`

**State machine — Session:**
```
pending → in_progress → completed
pending → skipped
in_progress → skipped
```

**Key operations:**
- Start session — status → `in_progress`, sets `started_at`
- Log a set — appends a `SetLog`
- Complete session — status → `completed`, sets `completed_at`
- Skip session — status → `skipped`

**SetLog notes:**
- `ExerciseID` is the exercise actually performed — may differ from `SectionExercise.ExerciseID` for mid-cycle substitutions
- `SectionExerciseID` is nullable — null when the user performs an ad-hoc exercise not tied to a section placement
- `RPE` is per-set, always optional
- `set_logs` is append-only — no `updated_at`

**Target weight calculation:**
When a session starts, the system calculates the target weight for each exercise:
1. Look up the `ProgressionRule` for the `SectionExercise`
2. Query `set_logs` from the most recent completed session in the **same cycle** for the same `section_exercise_id`
3. Check if the user hit all target reps: every set must have `actual_reps >= target_reps`
4. Count consecutive failures by walking back through prior sessions in the cycle
5. Apply `ProgressionRule.NextWeight()`

**Consecutive failure tracking:**
Computed from `set_logs` at session completion — no separate counter stored. Scoped to the cycle via the `session_id → cycle_id` join chain.

**`ProgressionRule.NextWeight()`:**
```go
func (r *ProgressionRule) NextWeight(current float64, consecutiveFailures int) float64 {
    if consecutiveFailures >= r.DeloadThreshold {
        return current * (1 - r.DeloadPct/100)
    }
    switch r.Strategy {
    case ProgressionLinear:
        return current + *r.Increment
    case ProgressionPercentage:
        return current * (1 + *r.IncrementPct/100)
    case ProgressionWave:
        // Wave loading deferred — seeded 5/3/1 programs use static
        // target weights set at template creation time. Dynamic wave
        // progression will be designed and implemented in a future phase.
        return current
    }
    return current
}
```

---

## Cross-Aggregate Relationships

```
Exercise ←── referenced by ──→ SectionExercise (within Program aggregate)
Exercise ←── referenced by ──→ SetLog (within Session aggregate)
Program  ←── referenced by ──→ Cycle (Cycle stores program_id)
ProgramWorkout ←── referenced by ──→ Session (Session stores program_workout_id)
```

Exercises are referenced by other aggregates but never owned by them. Soft deleting an exercise hides it from listings but does not affect existing programs or historical set_logs.

Cross-aggregate reads (e.g. fetching a session with its target weights) are handled by the store layer via joins or sequential queries — never by traversing domain object references across aggregate boundaries.
