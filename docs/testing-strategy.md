# Testing Strategy

BDD-first development with acceptance tests at the HTTP API level, supported by unit and integration tests.

## Development Flow — BDD First

When building a new feature, follow this order:

### 1. Write Acceptance Tests (Cucumber) — tagged `@wip`

Start by defining the user-facing behavior in Gherkin. Tag the entire feature with `@wip` so the suite skips it while the implementation is in progress:

```gherkin
@wip
Feature: Exercise Management

  Scenario: Create a custom exercise
    When I create an exercise with:
      | name                  | muscle_group | equipment | tracking_type |
      | Bulgarian Split Squat | legs         | dumbbell  | weight_reps   |
    Then the response status should be 201
    And the response should include:
      | name                  | tracking_type |
      | Bulgarian Split Squat | weight_reps   |
    And the response should have a uuid

  Scenario: Cannot create exercise without a name
    When I create an exercise with:
      | muscle_group |
      | chest        |
    Then the response status should be 400
    And the response should have error code "validation_failed"
    And the response should have field error "name"

  Scenario: List exercises filtered by muscle group
    Given the following exercises exist:
      | name        | muscle_group |
      | Bench Press | chest        |
      | Squat       | legs         |
      | Deadlift    | back         |
    When I list exercises with muscle_group "chest"
    Then the response status should be 200
    And the response should contain 1 exercise
```

The `@wip` tag tells the godog suite to skip these scenarios. `make test` stays green while the feature is being built.

### 2. Build the Feature

Work through the layers to make the acceptance tests pass:

1. **Domain model** — define the struct, value objects, `Validate()` method
2. **Store** — write the SQL queries (CREATE, GET, LIST, etc.)
3. **DTOs** — define request/response types and mapping functions
4. **Handler** — wire up the HTTP endpoint (decode → validate → store → respond)
5. **Route** — register in `routes.go`

### 3. Enable the Tests

When the feature is complete, remove `@wip` from the feature file and run `make test` to confirm all scenarios pass before opening a PR.

### 3. Add Unit Tests for Complex Logic

After the feature works end-to-end, add targeted unit tests for:
- Domain validation edge cases
- Value object behavior
- Business logic (progression calculations, etc.)

These are only needed where the acceptance tests don't cover the edge cases well enough.

## Test Types

### Acceptance Tests (Cucumber / godog)

**What:** End-to-end tests through the HTTP API. A real HTTP server starts with an in-memory SQLite database. Scenarios make HTTP requests and assert responses.

**Where:** `tests/acceptance/`

```
tests/
  acceptance/
    features/
      exercises.feature
      programs.feature
      cycles.feature
      sessions.feature
      progress.feature
    steps/
      common_steps.go      — shared step definitions (HTTP helpers, response assertions)
      exercise_steps.go
      program_steps.go
      cycle_steps.go
      session_steps.go
    main_test.go           — test server setup, godog suite runner
```

**How they run:**

```go
// main_test.go
func TestFeatures(t *testing.T) {
    // Start a real server with in-memory SQLite
    db, _ := sql.Open("sqlite", ":memory:")
    runMigrations(db)
    store := store.New(db)
    srv := server.New(store)
    ts := httptest.NewServer(srv.Router())
    defer ts.Close()

    suite := godog.TestSuite{
        ScenarioInitializer: func(ctx *godog.ScenarioContext) {
            // Register step definitions with the test server URL
            InitializeCommonSteps(ctx, ts.URL)
            InitializeExerciseSteps(ctx)
            InitializeProgramSteps(ctx)
            // ...
        },
        Options: &godog.Options{
            Format: "pretty",
            Paths:  []string{"features"},
        },
    }
    if suite.Run() != 0 {
        t.Fatal("non-zero exit from godog")
    }
}
```

**Key conventions:**
- Each scenario gets a fresh database (reset between scenarios)
- Step definitions are thin — they make HTTP calls and check responses
- Use data tables for structured input/output
- Scenarios describe user intent, not implementation details
- Tag new feature files with `@wip` until the feature is fully implemented

**Data table format — always use header rows, not header columns:**

Header rows (correct):
```gherkin
Given the following exercises exist:
  | name        | muscle_group | tracking_type |
  | Bench Press | chest        | weight_reps   |
  | Squat       | legs         | weight_reps   |
```

Header columns (do not use):
```gherkin
Given the following exercises exist:
  | name          | Bench Press |
  | muscle_group  | chest       |
  | tracking_type | weight_reps |
```

Header rows allow multiple rows per table and keep step definitions consistent — `tableToMapSlice` always returns a slice, even for single-row tables.

### Integration Tests (Store Layer)

**What:** Test SQL queries against a real in-memory SQLite database. Verify that store methods correctly read/write data, handle transactions, and return proper domain errors.

**Where:** `internal/store/*_test.go`

```go
func TestCreateAndGetExercise(t *testing.T) {
    s := setupTestStore(t)
    ctx := context.Background()

    ex := &domain.Exercise{
        Name:         "Bench Press",
        TrackingType: domain.TrackingWeightReps,
        IsCustom:     true,
    }
    err := s.CreateExercise(ctx, s.DB, ex)
    require.NoError(t, err)
    assert.NotZero(t, ex.ID)

    got, err := s.GetExercise(ctx, s.DB, ex.ID)
    require.NoError(t, err)
    assert.Equal(t, "Bench Press", got.Name)
    assert.Equal(t, domain.TrackingWeightReps, got.TrackingType)
}

func TestGetExercise_NotFound(t *testing.T) {
    s := setupTestStore(t)
    _, err := s.GetExercise(context.Background(), s.DB, 999)
    var notFound *domain.NotFoundError
    assert.ErrorAs(t, err, &notFound)
}
```

**What to test:**
- CRUD operations return correct data
- Filters and search work (e.g., list by muscle_group)
- Transactions commit/rollback correctly
- Soft deletes hide records from queries
- Foreign key constraints are enforced
- Domain errors are returned (not raw SQL errors)

### Unit Tests (Domain Layer)

**What:** Test domain model validation, value objects, and business logic in isolation. No database, no HTTP.

**Where:** `internal/domain/*_test.go`

```go
func TestExercise_Validate(t *testing.T) {
    tests := []struct {
        name    string
        ex      Exercise
        wantErr bool
    }{
        {
            name: "valid exercise",
            ex:   Exercise{Name: "Squat", TrackingType: TrackingWeightReps},
        },
        {
            name:    "empty name",
            ex:      Exercise{Name: "", TrackingType: TrackingWeightReps},
            wantErr: true,
        },
        {
            name:    "invalid tracking type",
            ex:      Exercise{Name: "Squat", TrackingType: "invalid"},
            wantErr: true,
        },
    }
    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            err := tt.ex.Validate()
            if tt.wantErr {
                assert.Error(t, err)
            } else {
                assert.NoError(t, err)
            }
        })
    }
}

func TestTrackingType_IsValid(t *testing.T) {
    assert.True(t, TrackingWeightReps.IsValid())
    assert.True(t, TrackingDuration.IsValid())
    assert.False(t, TrackingType("invalid").IsValid())
}
```

**What to test:**
- Validation rules (required fields, enum values, constraints)
- Value object behavior (TrackingType, ProgressionStrategy)
- Business logic (ProgressionRule.NextWeight, deload calculations)

## What Gets Tested Where

| Concern | Test Type | Example |
|---|---|---|
| "User can create an exercise via API" | Acceptance | Cucumber scenario |
| "User journey: create program → start cycle → log sets" | Acceptance | Multi-step Cucumber scenario |
| "Store correctly inserts and retrieves an exercise" | Integration | Store test |
| "Soft delete hides exercise from list" | Integration | Store test |
| "Transaction rolls back on error" | Integration | Store test |
| "Exercise name must not be empty" | Unit | Domain test |
| "Progression rule calculates correct next weight" | Unit | Domain test |
| "TrackingType enum validates correctly" | Unit | Domain test |

## When NOT to Write Tests

- Don't unit test simple getters/setters or struct construction
- Don't write integration tests for queries already covered by acceptance tests (unless testing edge cases)
- Don't test framework behavior (chi routing, JSON marshaling)
- Don't test the same validation in both unit and acceptance tests — acceptance tests cover the happy path, unit tests cover edge cases

## Test Helpers

Shared helpers reduce boilerplate:

```go
// tests/acceptance/steps/common_steps.go

// HTTP helper for step definitions
type TestClient struct {
    BaseURL    string
    LastStatus int
    LastBody   map[string]any
}

func (c *TestClient) Post(path string, body any) error { ... }
func (c *TestClient) Get(path string) error { ... }
func (c *TestClient) AssertStatus(expected int) error { ... }
func (c *TestClient) AssertBodyContains(key, value string) error { ... }
```

```go
// internal/store/test_helpers_test.go

func setupTestStore(t *testing.T) *Store {
    t.Helper()
    db, err := sql.Open("sqlite", ":memory:")
    require.NoError(t, err)
    t.Cleanup(func() { db.Close() })
    runMigrations(db)
    return New(db)
}
```

## Running Tests

```bash
# All tests (unit + integration + acceptance)
make test

# Just acceptance tests
go test ./tests/acceptance/...

# Just store integration tests
go test ./internal/store/...

# Just domain unit tests
go test ./internal/domain/...

# Verbose output
go test -v ./...
```

## React Native Frontend Testing (Phase 2+)

The frontend uses three layers, each targeting a different level of confidence vs. setup cost.

### Unit Tests — Jest + React Native Testing Library

**What:** Test pure logic (hooks, stores, lib functions) and component rendering in a Node.js environment. No device or simulator required.

**When to add:** During Steps 3–6 as components and hooks are built.

**Run:** `cd app && npx jest`

**What to test:**
- Zustand stores (`useTimerStore`, `useSessionStore`) — state transitions
- `lib/api.ts` — error handling, envelope parsing, idempotency key generation
- `lib/offlineQueue.ts` — enqueue/flush/pendingCount logic
- Hooks (`useActiveSession`, `useOfflineQueue`) — return shapes, error cases
- Component rendering — does the right text appear given props?

**Example:**
```ts
// store/timer.test.ts
import { useTimerStore } from "./timer";

it("counts down to zero and stops", () => {
  const store = useTimerStore.getState();
  store.start(2);
  expect(store.isRunning).toBe(true);
  store.tick();
  expect(store.secondsRemaining).toBe(1);
  store.tick();
  expect(store.secondsRemaining).toBe(0);
  expect(store.isRunning).toBe(false);
});
```

**What NOT to unit test:**
- Navigation flows (test those with E2E)
- NativeWind className rendering (no meaningful browser rendering in Node.js)
- Anything that requires a real device/simulator

### E2E Tests — Maestro (deferred to Step 7)

**What:** Full end-to-end tests on a real iOS Simulator or Android Emulator. Maestro uses simple YAML scripts to tap buttons, fill inputs, and assert visible text — no JavaScript required.

**When to add:** After Step 5 (Today tab) when there's a meaningful session flow to exercise. Scheduled for Step 7 (offline hardening).

**Why Maestro over Detox:** Detox requires native build infrastructure and lengthy setup. Maestro is a standalone binary with YAML scripts — significantly less setup for the same coverage.

**Example flow (`e2e/log_a_set.yaml`):**
```yaml
appId: com.kodiakconrad.compound
---
- launchApp
- assertVisible: "Today"
- tapOn: "Start Session"
- assertVisible: "Day A — Push"
- longPressOn: "Bench Press"   # tap-and-hold to adjust weight
- tapOn: "Log Set"
- assertVisible: "✓ 5"         # set is now logged
```

**Install:** `brew install maestro` (macOS)

**Run:** `maestro test e2e/`

### Not Applicable

| Tool | Why not |
|---|---|
| Cypress | Browser-based — cannot automate a native iOS/Android app |
| Playwright | Same — browser-only |
| Detox | Valid alternative to Maestro but requires significantly more setup (native build, wda, etc.) |

### What Gets Tested Where (Frontend)

| Concern | Test type |
|---|---|
| Zustand timer counts down correctly | Jest unit |
| `api.ts` throws `ApiError` on 4xx response | Jest unit |
| `offlineQueue` enqueues and flushes in order | Jest unit |
| Tab bar renders with correct labels | RNTL component test |
| Starting a session navigates to session screen | Maestro E2E |
| Logging a set updates the UI immediately | Maestro E2E |
| Offline set syncs after reconnecting | Maestro E2E |

## CI

All tests run in CI on every PR via `go test ./...`. See [git-strategy.md](git-strategy.md) for CI pipeline details.

Frontend Jest tests will be added to CI once the first test file exists (`cd app && npx jest --passWithNoTests`). Maestro E2E is run manually (requires a simulator) — not part of CI.
