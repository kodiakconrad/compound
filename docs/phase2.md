# Phase 2 — React Native Frontend

High-level plan for the React Native (Expo) frontend. The goal here is not to fully spec Phase 2, but to identify decisions that need to be made before Phase 1 is locked in.

## Stack

- **Framework:** React Native with Expo (managed workflow)
- **Navigation:** Expo Router (file-based, analogous to Next.js)
- **State / data fetching:** TBD — decide at Phase 2 start
- **UI components:** TBD — decide at Phase 2 start
- **Local storage:** Expo SQLite (for offline support — see below)

---

## Key Open Question: Connectivity Model

In Phase 1 the Go backend runs locally (laptop/desktop). In Phase 2 the app runs on a phone. Those are different devices — the phone needs to reach the backend somehow.

Three options:

**Option A — Local network only**
App connects to the backend via local IP (e.g., `192.168.1.x:8080`). Works at home, fails at the gym. Simple to build but offline support requires a separate local data layer on the phone.

**Option B — App-side SQLite, no Go backend for Phase 2**
Move data storage into the phone using Expo SQLite. The Go backend becomes irrelevant for Phase 2 — the app talks directly to a local DB. Clean offline story, but duplicates data logic in two places (Go + TypeScript) until Phase 4 unifies them.

**Option C — Deploy backend early (bridge to Phase 4)**
Host the Go backend somewhere accessible (even a simple VPS or Fly.io free tier) ahead of the Phase 4 cloud plan. App always has connectivity. No offline complexity, but pulls forward cloud infra work.

**Decision: Hybrid A + C.**
Start Phase 2 development using Option A (local network). When ready to use at the gym, deploy to Fly.io (Option C) — a one-time 30-minute step. The backend is built cloud-ready from Phase 1 (CORS, `PORT` env var, `DATABASE_PATH` env var, `/health` endpoint), so no rework is needed to flip to cloud.

Even on Option C (cloud-hosted), an offline resilience layer on the phone is still worthwhile — gym WiFi is unreliable. The offline queue queues writes when the connection drops and flushes on reconnect, using idempotency keys already supported by the backend.

---

## Offline Strategy (Option A)

If we go with Option A + offline queue:

**Always-available (cached locally):**
- Exercise library — read-only, refreshed when online
- Programs and templates — read-only, refreshed when online

**Queued when offline:**
- Start session
- Log a set
- Complete / skip session

**Sync behaviour:**
- On reconnect, flush the queue in order
- Conflicts are unlikely (single user, single device) but the queue must be ordered
- Session state (started_at, set_logs) can be reconciled by replaying the queue against the backend

**What this means for the backend:**
- All write endpoints already support idempotency keys — the offline queue uses these to safely replay without duplicates
- No new backend endpoints needed for offline sync; idempotency handles retries

---

## Navigation Structure

```
Tab Bar
  ├── Today         — active session or prompt to start one
  ├── Programs      — programs + templates list
  ├── Library       — exercise library
  └── Progress      — history, PRs, summary stats
```

### Today Tab
- No active session: show upcoming session from active cycle, or prompt to start a cycle
- Active session in progress: workout view (section list → exercise list → log sets)
- Rest timer between sets

### Programs Tab
- Programs list (user's programs) + Templates list (prebuilt + user-created)
- Program detail: full workout/section/exercise tree, edit mode
- Create program flow: pick or generate template → fill in details
- Start cycle from program

### Library Tab
- Exercise list with search and muscle group filter
- Exercise detail: form tips (Phase 3), history of use
- Create custom exercise

### Progress Tab
- Per-exercise weight history (line chart)
- Personal records
- Summary stats: total sessions, streak, volume trends

---

## API Contract Considerations

These are places where the Phase 1 API may need adjustment to serve the frontend well. Better to catch them now.

### 1. Program list needs a lightweight response

`GET /api/v1/programs` currently returns... unspecified. The full tree (workouts → sections → exercises) is expensive to return for a list view that only needs name, workout count, and last updated. The detail endpoint (`GET /api/v1/programs/{id}`) should return the full tree; the list endpoint should return a summary shape.

**Action:** Define distinct list vs detail response shapes in the DTOs. Add to `api.md`.

### 2. Session detail needs targets alongside actuals

When a user opens a session mid-workout, they need to see both what they planned and what they've logged so far. The session GET response should include targets (from `section_exercises`) and actuals (from `set_logs`) together — not require two calls.

**Status:** Already noted in `domain-model.md` — confirm this is reflected in the DTO when building the session handler.

### 3. Progress data should be chart-ready

`GET /api/v1/progress/exercise/{id}` should return a time-series array ready to pass to a charting library — `[{ date, weight, reps, volume }]`. If it returns raw set_logs the client has to aggregate, which is messy.

**Action:** Define the progress response shapes explicitly in `api.md`.

### 4. Active session state must be resumable

If the user closes the app mid-session, reopening it should land back on the in-progress session. The `GET /api/v1/cycles?status=active` → `GET /api/v1/cycles/{id}` → find in_progress session flow should work, but the Today tab needs a fast "resume active session" query.

**Action:** Consider a `GET /api/v1/sessions/active` convenience endpoint, or handle this client-side by querying the active cycle's sessions.

---

## Open Decisions for Phase 2 Start

- [x] Connectivity model — **Hybrid A + C** (local for dev, Fly.io for gym use; backend cloud-ready from Phase 1)
- [ ] State management library
- [ ] UI component library
- [ ] Rest timer — in-app timer, or just display rest_seconds and let the user time manually?
- [ ] `GET /api/v1/sessions/active` convenience endpoint vs. client-side resolution
- [ ] Offline queue persistence format (in-memory, AsyncStorage, or Expo SQLite)
