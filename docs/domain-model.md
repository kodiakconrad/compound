# Domain Model

Detailed specification of the Compound domain — aggregates, entities, value objects, business rules, and state machines.

> **TODO:** This doc needs to be fleshed out in a future session. The sections below outline the structure; each aggregate needs complete field definitions, validation rules, state transitions, and business logic.

## Aggregates

### Exercise (standalone)

An exercise is a named movement that can be added to program sections and tracked in sessions.

**Fields:** name, muscle_group, equipment, tracking_type, notes, is_custom

**Value objects:**
- `TrackingType` — `weight_reps`, `bodyweight_reps`, `duration`, `distance`
- `MuscleGroup` — chest, back, legs, shoulders, biceps, triceps, core, cardio, other
- `Equipment` — barbell, dumbbell, cable, machine, bodyweight, band, kettlebell, other

**Validation rules:**
- Name is required, non-empty
- TrackingType must be a valid enum value
- Only custom exercises can be updated/deleted

**TODO:**
- [ ] Define full validation rule set
- [ ] Document soft delete behavior and how it interacts with historical set_logs
- [ ] Decide if muscle_group and equipment should be value objects or plain strings

---

### Program (aggregate root)

A program is a multi-day workout plan. It contains the full tree: workouts → sections → section_exercises → progression_rules.

Templates are programs with `is_template=1`. Deep copying a template creates a new program.

**Entities within this aggregate:**
- `ProgramWorkout` — one day's workout, ordered by day_number
- `Section` — a named group within a workout (e.g., "Heavy Compounds"), with optional rest_seconds
- `SectionExercise` — an exercise placement with target sets/reps/weight/duration/distance
- `ProgressionRule` — how weight progresses for a specific section_exercise

**Value objects:**
- `ProgressionStrategy` — `linear`, `percentage`, `wave`

**Invariants:**
- A program must have a name
- Workouts have unique day_numbers within a program
- sort_order values are unique within their parent (sections within a workout, exercises within a section)

**Key operations:**
- Deep copy (for "create from template")
- Add/remove/reorder workouts, sections, exercises
- Soft delete (sets deleted_at, preserves historical cycle data)

**TODO:**
- [ ] Define full struct definitions with all fields
- [ ] Document deep copy behavior — what gets copied, what gets new UUIDs/timestamps
- [ ] Define reordering logic (how sort_order values are managed)
- [ ] Document validation rules for each entity in the aggregate
- [ ] Define ProgressionRule business logic — NextWeight(), deload calculation
- [ ] Clarify whether partial updates (add a single workout) reload the full aggregate or operate on sub-entities

---

### Cycle (aggregate root)

A cycle is an active run of a program. Created when a user starts a program. Contains pre-generated sessions.

**Entities within this aggregate:**
- `Session` — one workout instance, pre-generated with sort_order mirroring the workout's day_number

**State machine — Cycle:**
```
active → paused → active (resume)
active → completed
paused → completed
```

**State machine — Session:**
```
pending → in_progress → completed
pending → skipped
in_progress → skipped
```

**Invariants:**
- A program can have multiple cycles (user restarts manually)
- All sessions are created when the cycle starts
- Sessions can be completed in any order
- A cycle is completed when all sessions are completed or skipped

**TODO:**
- [ ] Define full struct definitions
- [ ] Document session pre-generation logic — what data is copied from the program at cycle creation time
- [ ] Define what happens to a cycle when the source program is modified or deleted
- [ ] Clarify whether starting a new cycle while one is active is allowed (or must pause/complete first)

---

### Session → SetLogs

A session is a single workout instance within a cycle. SetLogs are the actual performance records.

**Entities within this aggregate:**
- `SetLog` — one set of one exercise: actual_reps, weight, duration, distance, rpe

**Key operations:**
- Start session (status → in_progress, sets started_at)
- Log a set (appends a SetLog)
- Complete session (status → completed, sets completed_at)
- Skip session (status → skipped)

**Business logic:**
- Target weights for each exercise are calculated from the previous session's set_logs + progression_rules
- If all target reps were hit → apply progression rule (increment weight)
- If target reps were missed → keep same weight
- After N consecutive failures → deload

**TODO:**
- [ ] Define full struct definitions for SetLog
- [ ] Document target weight calculation algorithm in detail
- [ ] Define what "all target reps were hit" means precisely (every set? average?)
- [ ] Document how consecutive failures are tracked (per exercise across sessions)
- [ ] Clarify RPE — is it per-set or per-exercise? Optional always?
- [ ] Define what data is returned when fetching a session (targets + actuals together?)

---

## Cross-Aggregate Relationships

```
Exercise ←── referenced by ──→ SectionExercise (within Program aggregate)
Exercise ←── referenced by ──→ SetLog (within Session aggregate)
Program  ←── referenced by ──→ Cycle (Cycle stores program_id)
ProgramWorkout ← referenced by → Session (Session stores program_workout_id)
```

Exercises are referenced by other aggregates but never owned by them. Deleting an exercise (soft delete) doesn't affect existing programs or logs.

**TODO:**
- [ ] Document how cross-aggregate references work with the Store layer (joins? separate queries?)
- [ ] Define consistency rules — what happens when referenced data changes?

## Open Questions

- [ ] Should the Program aggregate enforce minimum structure (at least 1 workout, at least 1 section per workout)?
- [ ] How should sort_order rebalancing work? (e.g., insert between 2 and 3 — use fractional? reindex?)
- [ ] Should completed cycles snapshot the program structure, or always reference the live program?
- [ ] What's the maximum nesting depth for the Program aggregate before performance becomes a concern?
