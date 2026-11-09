# Testing Strategy

Local-first architecture with all data in on-device SQLite (expo-sqlite). Tests target domain logic and repository queries as the primary layers, with E2E deferred to Maestro.

## Development Flow

When building a new feature, work through the layers and test each one:

### 1. Domain Model

Define the types, validation functions, and business logic in `app/domain/`. Write unit tests in `app/domain/__tests__/` covering validation rules, state transitions, and edge cases.

### 2. Repository

Write the SQL queries in `app/db/repositories/`. Write integration tests using `better-sqlite3` as an in-memory SQLite test adapter (see [Repository Integration Tests](#repository-integration-tests-jest--better-sqlite3) below).

### 3. Hook

Wire the repository into a React hook in `app/hooks/`. Test via component tests if the hook has non-trivial logic (e.g., combining multiple repository calls, optimistic updates).

### 4. Component

Build the UI component. For complex interactions, add component tests with React Native Testing Library. For simple rendering, visual verification during development is sufficient.

## Test Types

### Domain Unit Tests (Jest)

**What:** Test domain validation, value objects, state machines, progression logic, and deep copy. No database, no React — pure TypeScript functions.

**Where:** `app/domain/__tests__/*.test.ts` (5 test files, 66 tests)

**Current coverage:**
- `exercise.test.ts` — `validateExercise` (name, tracking_type, muscle_group, equipment validation)
- `program.test.ts` — `validateProgram`, deep copy with new UUIDs, workout/section/exercise tree validation
- `cycle.test.ts` — `validateCycle`, state transitions
- `session.test.ts` — `validateSession`, state machine (pending/active/completed)
- `progression.test.ts` — `nextWeight` calculations, deload threshold, failure tracking across cycles

**Example:**

```ts
// app/domain/__tests__/exercise.test.ts
describe("validateExercise", () => {
  it("accepts valid exercise", () => {
    expect(
      validateExercise({
        name: "Bench Press",
        tracking_type: "weight_reps",
        muscle_group: "chest",
        equipment: "barbell",
      })
    ).toBeNull();
  });

  it("rejects empty name", () => {
    const err = validateExercise({
      name: "",
      tracking_type: "weight_reps",
    });
    expect(err).not.toBeNull();
    expect(err!.field).toBe("name");
  });
});
```

**What to test:**
- Validation rules (required fields, enum values, constraints)
- Business logic (progression calculations, deload thresholds)
- State machine transitions (session lifecycle, cycle status)
- Deep copy correctness (new UUIDs, independent trees)

### Repository Integration Tests (Jest + better-sqlite3)

**What:** Test SQL queries against a real in-memory SQLite database. Repositories (`app/db/repositories/*.ts`) contain all data access logic — they are the critical persistence layer in the local-first architecture.

**Where:** `app/db/repositories/__tests__/*.test.ts`

**The test adapter pattern:** The app uses `expo-sqlite` at runtime, which is a native module unavailable in Jest's Node.js environment. Tests use `better-sqlite3` as a drop-in replacement that speaks the same synchronous SQLite API (`getFirstSync`, `getAllSync`, `runSync`). A test helper creates an in-memory database, runs migrations, and injects it so repository functions use the test database instead of calling `getDatabase()`.

**Current repositories (5):**
- `exercise_repository.ts` — CRUD, list with filters, soft delete
- `program_repository.ts` — full tree load (program + workouts + sections + exercises), deep copy
- `cycle_repository.ts` — create, get, list, status transitions
- `session_repository.ts` — create, get active, log sets, complete
- `progress_repository.ts` — failure counts, progression history

**What to test:**
- CRUD operations return correct data
- Filters and search work (e.g., list exercises by muscle_group)
- Soft deletes hide records from queries
- Foreign key constraints are enforced
- Full tree loads assemble the correct nested structure
- Domain errors are returned (e.g., `NotFoundError`), not raw SQL errors

### Component Tests (Jest + React Native Testing Library)

**What:** Test component rendering and interaction in a Node.js environment. No device or simulator required.

**Status:** Future — add as components grow in complexity.

**What to test:**
- Zustand stores (`useTimerStore`, `useSessionStore`) — state transitions
- Hooks with non-trivial logic — combining repository calls, optimistic updates
- Component rendering — does the right text appear given props?

**What NOT to test:**
- Navigation flows (test with E2E)
- NativeWind className rendering (no meaningful rendering in Node.js)
- Simple pass-through components

### E2E Tests (Maestro) — Deferred

**What:** Full end-to-end tests on a real iOS Simulator or Android Emulator. Maestro uses YAML scripts to tap buttons, fill inputs, and assert visible text.

**When to add:** After there is a meaningful session flow to exercise. Covers flows that span multiple screens and require real device APIs.

**Why Maestro over Detox:** Detox requires native build infrastructure and lengthy setup. Maestro is a standalone binary with YAML scripts — significantly less setup for the same coverage.

**Example (`e2e/log_a_set.yaml`):**

```yaml
appId: com.kodiakconrad.compound
---
- launchApp
- assertVisible: "Today"
- tapOn: "Start Session"
- assertVisible: "Day A — Push"
- longPressOn: "Bench Press"
- tapOn: "Log Set"
- assertVisible: "1/5"
```

**Install:** `brew install maestro` (macOS)

**Run:** `maestro test e2e/`

### Go Backend Tests

**What:** The Go server is a thin sync/content service. It retains `go test ./...` for its reduced scope (health endpoint, sync logic, content serving), but it is no longer the primary test surface.

**Run:** `make test` (from repo root)

## What Gets Tested Where

| Concern | Test Type | Location |
|---|---|---|
| "Exercise name must not be empty" | Domain unit | `app/domain/__tests__/exercise.test.ts` |
| "Progression rule calculates correct next weight" | Domain unit | `app/domain/__tests__/progression.test.ts` |
| "Session transitions from active to completed" | Domain unit | `app/domain/__tests__/session.test.ts` |
| "Deep copy creates independent program with new UUIDs" | Domain unit | `app/domain/__tests__/program.test.ts` |
| "Repository correctly inserts and retrieves an exercise" | Repository integration | `app/db/repositories/__tests__/` |
| "Soft delete hides exercise from list query" | Repository integration | `app/db/repositories/__tests__/` |
| "Full program tree loads with nested workouts/sections" | Repository integration | `app/db/repositories/__tests__/` |
| "Timer counts down and stops at zero" | Component unit | `app/store/__tests__/` |
| "Starting a session navigates to session screen" | Maestro E2E | `e2e/` |
| "Logging a set updates the UI immediately" | Maestro E2E | `e2e/` |
| "Go health endpoint returns 200" | Go test | `go test ./...` |

## When NOT to Write Tests

- Don't unit test simple type definitions or struct construction
- Don't write repository tests for trivial single-row inserts already covered by more complex tests
- Don't test framework behavior (Expo Router navigation config, NativeWind class resolution)
- Don't duplicate coverage — if a domain unit test covers a validation edge case, don't re-test it in a repository test
- Don't write E2E tests for logic that can be tested faster at the unit or integration level

## Running Tests

```bash
# All frontend tests (domain + repository + component)
cd app && npm test

# Domain unit tests only
cd app && npx jest domain

# Repository integration tests only
cd app && npx jest repositories

# Go backend tests
make test

# Go vet (static analysis)
make vet

# Type check (no emit)
cd app && npx tsc --noEmit

# E2E (requires simulator, deferred)
maestro test e2e/
```

## CI

Two parallel jobs run on every PR to `main` (`.github/workflows/ci.yml`):

**Backend job:**
1. `go vet ./...` — static analysis
2. `go test ./...` — all Go tests
3. `go build ./...` — compile check

**Frontend job:**
1. `npm ci` — install dependencies
2. `npx tsc --noEmit` — type check
3. `npm test` — Jest (domain unit tests, repository integration tests, component tests)

Maestro E2E is run manually (requires a simulator) — not part of CI.
