# UI Spec — Phase 2 React Native App

All designs in this document are approved. Do not deviate from these layouts without user sign-off.

---

## Visual Style

| Property | Value |
|---|---|
| Theme | Dark only |
| Background | `#0F0F0F` |
| Surface (cards, sheets) | `#1A1A1A` |
| Border | `#2A2A2A` |
| Accent | `#E8FF47` (lime/electric) |
| Text primary | `#FFFFFF` |
| Text muted | `#6B7280` |
| Font | System font (SF Pro on iOS, Roboto on Android) |
| Header weight | Bold |
| Body weight | Medium |

---

## Navigation

- **Tab bar:** Icon + label, standard height, always visible except during active sessions
- **4 tabs:** Today · Programs · Library · Progress
- **Active session:** Tab bar hides. Session takes full screen. Exit via back arrow or [Done] button.

---

## Today Tab

### State 1 — No active program

```
┌─────────────────────────────┐
│ Today                Mar 8  │
├─────────────────────────────┤
│                             │
│  No active program.         │
│  Start one to begin         │
│  tracking workouts.         │
│                             │
│  [ Browse Programs → ]      │
│                             │
└─────────────────────────────┘
```

"Browse Programs →" navigates to the Programs tab.

---

### State 2 — Active cycle, upcoming session

```
┌─────────────────────────────┐
│ Today                Mar 8  │
├─────────────────────────────┤
│ 5/3/1 · Week 2 · Session 3  │
│                             │
│ UP NEXT                     │
│ Day A — Squat               │
│ 4 exercises · ~45 min       │
│                             │
│ ┌ Squat ─────────── 3×5 ─┐  │
│ │ 100 kg                 │  │
│ └────────────────────────┘  │
│ ┌ Bench Press ───── 3×5 ─┐  │
│ │ 80 kg                  │  │
│ └────────────────────────┘  │
│ (+ 2 more exercises)        │
│                             │
│  [ Start Session ]          │
└─────────────────────────────┘
```

Shows the first 2 exercises as a preview, collapses the rest. "Start Session" calls the backend to mark the session as in_progress, then pushes to the session screen.

---

### State 3 — Session in progress (full screen)

Tab bar is hidden. Back arrow (←) in the header prompts "Are you sure? Your progress will be saved." before returning to Today.

```
┌─────────────────────────────┐
│ ←  Day A — Squat    [Done]  │
├─────────────────────────────┤
│ ▼ COMPOUND                  │
│                             │
│   Squat                     │
│   Target: 3×5 @ 100 kg      │
│   [✓ 5] [✓ 5] [     ]      │
│                             │
│   Bench Press               │
│   Target: 3×5 @ 80 kg       │
│   [   ] [   ] [   ]         │
│                             │
│ ▼ ISOLATION                 │
│   ...                       │
├─────────────────────────────┤
│ ▶  REST   2:45              │
└─────────────────────────────┘
```

- Sections are collapsible (▼ open, ▶ collapsed), all open by default
- [Done] prompts a confirmation sheet before completing the session

---

### Set Logging

**Tap** a set button `[   ]` → logs immediately using the target weight and reps. Button shows `[✓ 5]`.

**Tap and hold** a set button → opens a bottom sheet pre-filled with target values. User can adjust before logging.

```
┌─────────────────────────────┐
│     Log Set 3               │
│     Bench Press             │
├─────────────────────────────┤
│  Weight           Reps      │
│  [ 80 kg ]        [  5  ]   │
│                             │
│  [ Log Set ]                │
└─────────────────────────────┘
```

Rest timer starts automatically after any set is logged.

---

### Rest Timer

Persistent bar at the bottom of the session screen while counting down.

```
├─────────────────────────────┤
│ ▶  REST   2:45   [Skip]     │
└─────────────────────────────┘
```

- Counts down from the exercise's `rest_seconds`
- Vibrates when it reaches 0
- "Skip" dismisses the timer immediately
- Timer bar disappears once it reaches 0 or is skipped

---

### Exercise Substitution

**Trigger:** Long press the exercise name.

**Context menu appears:**
```
┌─────────────────────────────┐
│  🔄 Substitute Exercise     │
└─────────────────────────────┘
```

**If sets have already been logged for this exercise**, show a confirmation first:
```
┌─────────────────────────────┐
│  Substitute Exercise?       │
│                             │
│  You've logged 2 sets for   │
│  Bench Press. Substituting  │
│  will discard them.         │
│                             │
│  [ Cancel ]  [ Substitute ] │
└─────────────────────────────┘
```

Confirming calls `DELETE /api/v1/sessions/{uuid}/sets?exercise_uuid={uuid}` to wipe the partial logs, then opens the exercise picker.

**If no sets logged**, skip confirmation and open the picker directly.

**Exercise picker:**
```
┌─────────────────────────────┐
│  Substitute for             │
│  Bench Press                │
├─────────────────────────────┤
│  🔍 Search exercises...     │
├─────────────────────────────┤
│  SAME MUSCLE GROUP          │
│  Incline Bench Press        │
│  Chest Press (Machine)      │
│  Dumbbell Fly               │
├─────────────────────────────┤
│  ALL EXERCISES              │
│  ...                        │
└─────────────────────────────┘
```

After picking an exercise, a confirmation sheet appears with editable targets. Targets are pre-filled from the **last time the user performed that exercise** (fetched from `GET /api/v1/progress/exercise/{uuid}`, most recent entry). If they have never done the substitute, falls back to the original exercise's targets.

```
┌─────────────────────────────┐
│  Set Targets                │
│  Incline Bench Press        │
│  Last used Feb 28           │  ← or "No previous data"
├─────────────────────────────┤
│  Sets    Weight      Reps   │
│  [ 3  ]  [ 75 kg ]  [  5 ] │  ← all editable
│                             │
│  [ Confirm Substitution ]   │
└─────────────────────────────┘
```

Confirming locks in the targets. The substitute replaces the original for all remaining sets in this session.

---

## Programs Tab

### Programs list

```
┌─────────────────────────────┐
│ Programs                [+] │
├─────────────────────────────┤
│ ┌─────────────────────────┐ │
│ │ 5/3/1                 🔒 │ │
│ │ 4 workouts · Active     │ │
│ └─────────────────────────┘ │
│ ┌─────────────────────────┐ │
│ │ PPL                   🔒 │ │
│ │ 6 workouts              │ │
│ └─────────────────────────┘ │
│ ┌─────────────────────────┐ │
│ │ My Custom Plan          │ │
│ │ 3 workouts · Active     │ │
│ └─────────────────────────┘ │
└─────────────────────────────┘
```

Flat list of all programs. "Active" badge on any program with a running cycle. 🔒 (lock) badge on prebuilt programs (seeded content — read-only, cannot be edited or deleted, but can be copied).

---

### Program detail

```
┌─────────────────────────────┐
│ ←  5/3/1             [Edit] │
├─────────────────────────────┤
│ 4 workouts · Created Mar 1  │
│                             │
│ [ Start Cycle ]             │
│                             │
│ ▼ Day A — Squat             │
│   ▼ Compound                │
│     Squat        3×5 @100kg │
│     OHP          3×5 @ 52kg │
│   ▼ Accessory               │
│     Deadlift     1×5 @120kg │
│                             │
│ ▶ Day B — Bench             │
│ ▶ Day C — Deadlift          │
│ ▶ Day D — Press             │
└─────────────────────────────┘
```

- Workouts and sections are collapsible
- [Edit] toggles inline edit mode (see below)
- [Start Cycle] is hidden if the program already has an active cycle
- If program has an active cycle, [Edit] is hidden and a note appears: "Locked — active cycle in progress"

---

### Inline edit mode

Tapping [Edit] transforms the detail view:

```
┌─────────────────────────────┐
│ ←  5/3/1            [Done]  │
├─────────────────────────────┤
│ ▼ Day A — Squat    [⋯] [≡] │  ← ⋯ = rename/delete, ≡ = drag handle
│   ▼ Compound       [⋯] [≡] │
│     Squat  3×5 @100 [⋯][≡] │
│     OHP    3×5 @ 52 [⋯][≡] │
│     [ + Add Exercise ]      │
│   [ + Add Section ]         │
│ [ + Add Workout ]           │
└─────────────────────────────┘
```

- Drag handles (≡) allow reordering within their level (workouts reorder among workouts, sections among sections, etc.)
- ⋯ opens a small action sheet: Rename / Delete
- [Done] exits edit mode and saves

---

### Create new program — entry sheet

Tapping `[+]` on the Programs list:

```
┌─────────────────────────────┐
│  New Program                │
├─────────────────────────────┤
│  ┌─────────────────────────┐│
│  │  📄 Start from scratch  ││
│  │  Build your own program ││
│  └─────────────────────────┘│
│  ┌─────────────────────────┐│
│  │  📋 Copy a program      ││
│  │  Customize an existing  ││
│  └─────────────────────────┘│
└─────────────────────────────┘
```

**From scratch flow:**
1. Name screen → [ Create Program ]
2. Lands on empty program detail in edit mode

**Copy flow:**
1. Program picker (searchable list of all programs, including prebuilt)
2. Name screen (pre-filled with "[Source Name] (Copy)", editable) → [ Create Program ]
3. Lands on pre-filled program detail in edit mode — fully independent copy

---

## Library Tab

### Exercise list

```
┌─────────────────────────────┐
│ Library                 [+] │
├─────────────────────────────┤
│ 🔍 Search exercises...      │
├─────────────────────────────┤
│ [All] [Chest] [Back] [Legs] │  ← horizontal scroll chips
│ [Shoulders] [Arms] [Core]   │
├─────────────────────────────┤
│ Bench Press                 │
│ Chest · Barbell · Wt & Reps │
├─────────────────────────────┤
│ Deadlift                    │
│ Back · Barbell · Wt & Reps  │
├─────────────────────────────┤
│ Pull-up                     │
│ Back · Bodyweight           │
└─────────────────────────────┘
```

- Filter chips populated from `GET /api/v1/exercises/filters` (not hardcoded)
- Search and filter work together
- Prebuilt exercises are not deletable; custom exercises show a swipe-left delete action

---

### Exercise detail

```
┌─────────────────────────────┐
│ ←  Bench Press              │
├─────────────────────────────┤
│ Chest · Barbell             │
│ Weight & Reps               │
├─────────────────────────────┤
│ LAST LOGGED                 │
│ Mar 5 · 3×5 @ 80 kg         │
│                             │
│ USED IN                     │
│ • 5/3/1 — Day B             │
│ • PPL — Day 2               │
└─────────────────────────────┘
```

---

### Create custom exercise

```
┌─────────────────────────────┐
│ ←  New Exercise             │
├─────────────────────────────┤
│ Name                        │
│ ┌─────────────────────────┐ │
│ │                         │ │
│ └─────────────────────────┘ │
│                             │
│ Tracking type               │
│ ● Weight & Reps             │
│ ○ Bodyweight Reps           │
│ ○ Duration                  │
│ ○ Distance                  │
│                             │
│ Muscle group  [ Chest ▾ ]   │
│ Equipment     [ Barbell ▾ ] │
│                             │
│ [ Create Exercise ]         │
└─────────────────────────────┘
```

Dropdowns populated from `GET /api/v1/exercises/filters`.

---

## Progress Tab

```
┌─────────────────────────────┐
│ Progress                    │
├─────────────────────────────┤
│ ┌─────────┐┌──────┐┌──────┐ │
│ │   47    ││  8   ││  3🔥 │ │
│ │ sessions││weeks ││streak│ │
│ └─────────┘└──────┘└──────┘ │
├─────────────────────────────┤
│ PERSONAL RECORDS            │
│ Bench Press      100 kg ×1  │
│ Squat            140 kg ×1  │
│ Deadlift         180 kg ×1  │
│ OHP               72 kg ×1  │
├─────────────────────────────┤
│ EXERCISE HISTORY            │
│ [ Bench Press ▾ ]           │
│                             │
│    ╭──╮                     │
│  ╭─╯  ╰──╮                  │
│ ─╯        ╰────             │
│                             │
│ Jan      Feb      Mar       │
│                             │
│  ○ Weight   ● Volume        │
└─────────────────────────────┘
```

- Summary stats: total sessions, weeks trained, current streak
- PRs list: best weight × reps per exercise, all time
- Exercise history: line chart (Victory Native XL, Skia renderer)
- Chart toggle: Weight over time vs. Volume over time (volume = weight × reps per session)
- Exercise selector (▾) opens a searchable picker from the exercise library

---

## Interaction Summary

| Action | Gesture |
|---|---|
| Log set at target values | Tap set button |
| Log set with custom values | Tap and hold set button |
| Substitute exercise | Long press exercise name |
| Collapse/expand section | Tap section header |
| Reorder in edit mode | Drag handle (≡) |
| Delete custom exercise | Swipe left |
| Dismiss rest timer | Tap [Skip] |
