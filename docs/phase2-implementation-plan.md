# Implementation Plan — Phase 2 (React Native Frontend)

Follows the same BDD-first development flow as Phase 1:
1. Write acceptance/integration tests where applicable
2. Implement feature
3. `make test` (backend) or `npx expo start` + manual smoke (frontend)

---

## Decisions (locked)

| Decision | Choice |
|---|---|
| Connectivity | Hybrid A + C (local network for dev, Fly.io for gym) |
| Auth | Clerk (JWT middleware on backend before Fly.io deploy) |
| State management | TanStack Query (server state) + Zustand (local/UI state) |
| UI components | NativeWind v4 (Tailwind for RN) |
| Rest timer | In-app countdown, vibration on completion |
| Active session | `GET /api/v1/sessions/active` backend endpoint |
| Offline queue | Expo SQLite (survives app kill) |
| Filter values | `GET /api/v1/exercises/filters` backend endpoint |
| Charts | Victory Native XL (Skia renderer) |

---

## Step 1 — Backend additions

Small backend changes required before the frontend can be built.

See [ui-spec.md](ui-spec.md) for all approved screen layouts and interaction patterns.

### New endpoints

**`DELETE /api/v1/sessions/{uuid}/sets?exercise_uuid={uuid}`**
Deletes all set_logs for a given exercise within a session. Used when the user substitutes an exercise mid-session after having already logged some sets — those partial logs are discarded before logging begins under the substitute.
- Returns `204 No Content`
- Returns `404` if session or exercise not found
- Returns `422` if session is not `in_progress`

**`GET /api/v1/sessions/active`**
Returns the single in-progress session (if any), including targets and actuals.
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
            "exercise_uuid": "...",
            "name": "Bench Press",
            "target_sets": 3,
            "target_reps": 5,
            "target_weight": 80.0,
            "rest_seconds": 180,
            "logged_sets": [
              { "uuid": "...", "set_number": 1, "reps": 5, "weight": 80.0, "logged_at": "..." }
            ]
          }
        ]
      }
    ]
  }
}
```
Returns `404` with `no_active_session` code when none exists.

**`GET /api/v1/exercises/filters`**
Returns allowed enum values for filter UIs.
```json
{
  "data": {
    "muscle_groups": ["chest", "back", "legs", "shoulders", "arms", "core", "full_body"],
    "equipment": ["barbell", "dumbbell", "machine", "cable", "bodyweight", "kettlebell"],
    "tracking_types": ["weight_reps", "bodyweight_reps", "duration", "distance"]
  }
}
```

### Modified endpoints

**`GET /api/v1/programs`** — list response returns summary shape only:
```json
{
  "data": [
    {
      "uuid": "...",
      "name": "5/3/1",
      "is_template": false,
      "workout_count": 4,
      "updated_at": "2026-03-08T10:00:00Z"
    }
  ]
}
```
Full tree (workouts → sections → exercises) stays on `GET /api/v1/programs/{uuid}`.

**`GET /api/v1/progress/exercise/{uuid}`** — confirm response is chart-ready:
```json
{
  "data": [
    { "date": "2026-03-01", "weight": 77.5, "reps": 5, "volume": 387.5 }
  ]
}
```

### Acceptance tests

Add to `tests/acceptance/features/`:
- `sessions_active.feature` — active session returned, 404 when none
- `exercises_filters.feature` — returns all enum values

### Implement

1. `internal/store/session_store.go` — `GetActiveSession()` query
2. `internal/db/query/sessions.sql` — `GetActiveSession` SQL (joins session → section_exercises → set_logs); `make gen`
3. `internal/handler/dto/session.go` — `ActiveSessionResponse` with nested sections + exercises + logged_sets
4. `internal/handler/session_handler.go` — `HandleGetActiveSession`
5. `internal/handler/exercise_handler.go` — `HandleGetFilters` (returns hardcoded enum arrays)
6. `internal/handler/dto/program.go` — `ProgramListItem` (summary) vs `ProgramDetail` (full tree)
7. Update `routes.go` — register new routes
8. Update `api.md` — document all new/modified shapes

---

## Step 2 — Expo app scaffold

**Setup:**
```
npx create-expo-app app --template blank-typescript
cd app
npx expo install expo-router expo-sqlite @tanstack/react-query zustand nativewind
npx expo install tailwindcss
```

**Folder structure (`/app`):**
```
app/
  (tabs)/
    index.tsx          # Today tab
    programs.tsx       # Programs tab
    library.tsx        # Library tab
    progress.tsx       # Progress tab
  _layout.tsx          # Root layout, QueryClientProvider, Zustand hydration
components/
  ui/                  # NativeWind base components (Button, Card, Input, etc.)
  session/             # Set logging row, rest timer, section list
  program/             # Program card, workout tree
  progress/            # Chart, PR card
lib/
  api.ts               # Base fetch wrapper (adds auth header, base URL)
  queryClient.ts       # TanStack QueryClient config
  offlineQueue.ts      # Expo SQLite queue: enqueue, flush, status
hooks/
  useActiveSession.ts  # GET /api/v1/sessions/active query
  useOfflineQueue.ts   # Queue state, flush trigger
store/
  session.ts           # Zustand: active session UI state (current exercise index, etc.)
  timer.ts             # Zustand: rest timer countdown
constants/
  config.ts            # BASE_URL (reads from env / config file)
```

**API client (`lib/api.ts`):**
- Base URL from `constants/config.ts` (local: `http://192.168.x.x:8080`, cloud: Fly.io URL)
- Attaches `Authorization: Bearer <clerk_token>` header (once auth is added in Step 8)
- All mutations add `Idempotency-Key` header (UUID generated per request)

**Offline queue (`lib/offlineQueue.ts`):**
- Expo SQLite table: `offline_queue(id, method, path, body, idempotency_key, created_at, status)`
- `enqueue(method, path, body)` — inserts row, returns idempotency key
- `flush()` — replays pending rows in order; marks `status=done` on 2xx, keeps on network error
- Triggered on reconnect via `@react-native-community/netinfo`

**Zustand stores:**
- `session.ts` — `currentExerciseIndex`, `currentSetIndex`, `sessionUUID`
- `timer.ts` — `secondsRemaining`, `isRunning`, `start(seconds)`, `stop()`

**Verify:** `npx expo start` — tab bar visible, no JS errors, API client hits `GET /health` successfully.

---

## Step 3 — Library tab

**Screens:**
- `app/(tabs)/library.tsx` — exercise list with search bar + filter sheet
- `app/exercise/[uuid].tsx` — exercise detail (name, tracking type, muscle group, history of use)
- `app/exercise/create.tsx` — create custom exercise form

**Queries:**
- `useExercises({ search, muscle_group, equipment })` — `GET /api/v1/exercises`
- `useExerciseFilters()` — `GET /api/v1/exercises/filters` (cached, stale after 1 day)
- `useExercise(uuid)` — `GET /api/v1/exercises/:uuid`
- `useCreateExercise()` — mutation with offline queue fallback

**Components:**
- `ExerciseRow` — name, tracking type badge, muscle group tag
- `FilterSheet` — bottom sheet with muscle group + equipment multi-select (values from `useExerciseFilters`)
- `TrackingTypeBadge` — color-coded pill

**Verify:** List loads, search filters, filter sheet works, custom exercise creates and appears in list.

---

## Step 4 — Programs tab

**Screens:**
- `app/(tabs)/programs.tsx` — tab with Programs / Templates switcher
- `app/programs/[uuid].tsx` — program detail (full tree, edit mode toggle)
- `app/programs/create.tsx` — create program (from scratch or copy template)
- `app/programs/[uuid]/cycle/start.tsx` — start cycle confirmation

**Queries:**
- `usePrograms(isTemplate)` — `GET /api/v1/programs?is_template=false`
- `useTemplates()` — `GET /api/v1/programs?is_template=true`
- `useProgramDetail(uuid)` — `GET /api/v1/programs/:uuid` (full tree)
- `useCopyTemplate()` — `POST /api/v1/programs/:uuid/copy`
- `useStartCycle()` — `POST /api/v1/cycles`

**Components:**
- `ProgramCard` — name, workout count, last updated
- `WorkoutTree` — collapsible sections → exercise rows (read-only + edit mode)
- `StartCycleSheet` — confirmation bottom sheet

**Verify:** List loads both tabs, program detail shows full tree, copy template creates independent program, start cycle navigates to Today tab.

---

## Step 5 — Today tab

The most complex screen. Handles: no cycle, cycle with upcoming session, in-progress session.

**Screens:**
- `app/(tabs)/index.tsx` — Today tab root (state machine: idle / upcoming / in_progress)
- `app/session/[uuid].tsx` — active workout view

**State machine (Today tab):**
```
no active cycle  →  prompt: "Start a program"
active cycle, no session in_progress  →  show next scheduled session + "Start Session" button
session in_progress  →  navigate directly to session/[uuid]
```

**Queries:**
- `useActiveSession()` — `GET /api/v1/sessions/active` (polls every 30s when app is foregrounded)
- `useActiveCycle()` — `GET /api/v1/cycles?status=active` (fallback for upcoming session)
- `useStartSession()` — `POST /api/v1/sessions/:uuid/start`
- `useLogSet()` — `POST /api/v1/sessions/:uuid/sets` (offline-queued)
- `useCompleteSession()` — `POST /api/v1/sessions/:uuid/complete` (offline-queued)
- `useSkipSession()` — `POST /api/v1/sessions/:uuid/skip`

**Session view layout:**
```
Header: workout name, session X of Y
Section list (collapsible):
  Section name
  Exercise row:
    Target: 3 × 5 @ 80 kg
    Logged sets: [✓ 5] [✓ 5] [  ] ← tap to log
Rest timer (shown after set logged):
  [2:45 remaining] [Skip]
```

**Rest timer (Zustand + `setInterval`):**
- `timer.start(rest_seconds)` called after each set is logged
- Counts down in `timer.ts` Zustand store
- `Vibration.vibrate()` on completion
- Shown as a persistent bottom bar during rest

**Offline behavior:**
- `useLogSet` and `useCompleteSession` enqueue via `offlineQueue.enqueue()` first, then attempt network call
- If network fails, set is marked locally as logged (optimistic update via Zustand `session.ts`)
- Queue flushes automatically on reconnect

**Verify:** Start session, log all sets with rest timer, complete session, verify progression updated on next session fetch.

---

## Step 6 — Progress tab

**Screens:**
- `app/(tabs)/progress.tsx` — summary + personal records + exercise selector
- `app/progress/exercise/[uuid].tsx` — per-exercise history chart

**Queries:**
- `useProgressSummary()` — `GET /api/v1/progress/summary`
- `usePersonalRecords()` — `GET /api/v1/progress/records`
- `useExerciseHistory(uuid)` — `GET /api/v1/progress/exercise/:uuid`

**Components:**
- `SummaryCard` — total sessions, streak, weekly volume
- `PRList` — exercise name + best weight + date
- `WeightHistoryChart` — Victory Native XL line chart (date → weight, date → volume toggle)

**Chart setup:**
```
npx expo install react-native-skia @shopify/react-native-skia victory-native
```

**Verify:** Summary shows correct stats, PR list loads, chart renders exercise weight over time.

---

## Step 7 — Offline support (hardening)

This step formalizes and tests the offline queue from Step 2/5.

**Offline queue schema (Expo SQLite):**
```sql
CREATE TABLE IF NOT EXISTS offline_queue (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  method TEXT NOT NULL,
  path TEXT NOT NULL,
  body TEXT,
  idempotency_key TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'  -- pending | done | failed
);
```

**`useOfflineQueue` hook:**
- Subscribes to `NetInfo` — on reconnect, calls `offlineQueue.flush()`
- Exposes `pendingCount` for UI indicator ("3 sets pending sync")

**Offline indicator:**
- Small banner shown when `pendingCount > 0`: "3 sets queued — will sync when online"

**Test scenarios (manual):**
- Log sets in airplane mode → re-enable WiFi → verify sets appear in session detail
- Kill app mid-session in airplane mode → reopen → queue persists → sync on reconnect
- Duplicate replay (same idempotency key sent twice) → backend returns 200 with cached response, no duplicate

---

## Step 8 — Auth + Fly.io deployment

**Clerk setup (frontend):**
```
npx expo install @clerk/clerk-expo
```
- Wrap root `_layout.tsx` with `<ClerkProvider>`
- Add sign-in screen `app/sign-in.tsx` — Clerk's `useSignIn()` flow
- Gate all tabs behind `<SignedIn>` / redirect to sign-in if `<SignedOut>`
- `lib/api.ts` — attach `Authorization: Bearer ${await getToken()}` on every request

**Clerk setup (backend):**
- Add `github.com/clerk/clerk-sdk-go` dependency
- Write `internal/middleware/auth.go` — JWT validation middleware using Clerk's JWKS endpoint
- Apply middleware to all `/api/v1/` routes (exempt `/health`)
- `compound.yaml` — add `clerk.jwks_url` config key; env var `CLERK_JWKS_URL`

**Fly.io deployment:**
```
fly launch --name compound-api
fly volumes create compound_data --size 1
fly secrets set CLERK_JWKS_URL=https://...
fly deploy
```
- `fly.toml` — mount volume at `/data`, set `DATABASE_PATH=/data/compound.db`
- CORS `allowed_origins` in `compound.yaml` — tighten from `["*"]` to `["https://your-app-domain"]` (or keep `*` if RN app uses native, not web)
- `constants/config.ts` in the app — set `BASE_URL` to the Fly.io URL

**Verify:** Sign in on phone, all API calls succeed against Fly.io backend, unauthenticated request returns 401.

---

## Verification (each step)

After each step:
- Backend: `make build` + `make test` + `make vet`
- Frontend: `npx expo start` → test on physical device (iOS or Android)
- Smoke test the happy path for the step's features
