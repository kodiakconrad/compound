# AI Integration

Phase 3 design for AI-powered features in Compound.

## Features

| Feature | What it does |
|---|---|
| Exercise Suggestions | Suggests exercises for a section; user reviews, refines, and applies |
| Template Generation | Freeform description → workout structure preview; user saves as template |
| Program Generation | Template + structured params → full program with exercises; template-first |
| Form Tips | Per-exercise coaching cues; read-only, no state |

## Endpoint Map

| Feature | Endpoints |
|---|---|
| Exercise Suggestions | `POST /api/v1/ai/exercise-suggestions`, `/refine`, `/apply` |
| Template Generation | `POST /api/v1/ai/template`, `/refine`, `/apply` |
| Program Generation | `POST /api/v1/ai/program`, `/refine`, `/apply` |
| Form Tips | `POST /api/v1/ai/form-tips` |

Suggestions and Template/Program both follow a three-step **suggest → refine → apply** pattern. Refinement is stateless — the client echoes previous results back. Form tips is a single call with no apply step.

---

## Architecture

### Two-Layer Interface

AI logic is split across two interfaces: a low-level transport layer and a high-level domain-aware service.

**`Provider`** — transport only, knows nothing about workouts:

```go
type Provider interface {
    Complete(ctx context.Context, req CompletionRequest) (CompletionResponse, error)
}
```

**`AIService`** — domain-aware, calls `Provider` and `Store`:

```go
func (s *AIService) SuggestExercises(ctx context.Context, in SuggestExercisesInput) ([]ExerciseSuggestion, error)
func (s *AIService) RefineSuggestions(ctx context.Context, in RefineSuggestionsInput) ([]ExerciseSuggestion, error)
func (s *AIService) ApplySuggestions(ctx context.Context, in ApplySuggestionsInput) error
func (s *AIService) GenerateTemplate(ctx context.Context, in GenerateTemplateInput) (GeneratedTemplate, error)
func (s *AIService) RefineTemplate(ctx context.Context, in RefineTemplateInput) (GeneratedTemplate, error)
func (s *AIService) ApplyTemplate(ctx context.Context, in ApplyTemplateInput) error
func (s *AIService) GenerateProgram(ctx context.Context, in GenerateProgramInput) (GeneratedProgram, error)
func (s *AIService) RefineProgram(ctx context.Context, in RefineProgramInput) (GeneratedProgram, error)
func (s *AIService) ApplyProgram(ctx context.Context, in ApplyProgramInput) error
func (s *AIService) GetFormTips(ctx context.Context, in FormTipsInput) (FormTips, error)
```

### Dependency Flow

```
handler → ai service → store (context fetching)
handler → ai service → provider (AI API call)
handler → dto        → domain
server  → handler
```

The `ai` package depends on `store` (to read exercise/template context) and `provider` (to make API calls). Handlers depend on `ai service` — not on `provider` directly.

### Package Structure

```
internal/ai/
  ai.go             — AIService struct, constructor
  provider.go       — Provider interface, CompletionRequest/Response types
  anthropic.go      — Anthropic implementation
  openai.go         — OpenAI stub
  suggestions.go    — SuggestExercises, RefineSuggestions, ApplySuggestions
  template.go       — GenerateTemplate, RefineTemplate, ApplyTemplate
  program.go        — GenerateProgram, RefineProgram, ApplyProgram
  formtips.go       — GetFormTips
  prompts.go        — prompt builder functions, system prompt constants
  errors.go         — ProviderError, ParseError
  testutil/
    mock.go         — MockProvider (used by ai package tests + acceptance tests)
```

---

## Configuration

```yaml
ai:
  provider: "anthropic"
  model: "claude-opus-4-6"
  anthropic:
    api_key: "${ANTHROPIC_API_KEY}"
  openai:
    api_key: "${OPENAI_API_KEY}"
  max_tokens: 4096
  timeout_seconds: 30
  enabled: true
```

`ai.enabled: false` → middleware on the `/api/v1/ai/` route group returns 503 before any handler runs. No config change required to disable AI during Phase 1/2.

---

## Error Handling

Two new error types live in `internal/ai/errors.go`. They are handled in `handler/handler.go` alongside existing domain errors.

| Error | Cause | HTTP | Code |
|---|---|---|---|
| `ProviderError` (rate limit) | 429 from upstream | 503 | `ai_unavailable` |
| `ProviderError` (other) | Other upstream error | 502 | `ai_unavailable` |
| `ParseError` | AI returned unparseable JSON | 500 | `internal_error` |

---

## Prompt Engineering Conventions

- All prompts live in `internal/ai/prompts.go` — unexported constants and builder functions, never inline in feature files
- System prompts define the expected JSON response schema; user messages provide domain context (goal, equipment, existing exercises, etc.)
- Always request pure JSON — no markdown fences, no preamble
- Log prompt content at `Debug` level only (may contain user data)

---

## Feature 1: Exercise Suggestions

Two-step flow with a cart. The AI suggests exercises; the user reviews and optionally refines before applying. No manual work required — applying commits the selected suggestions directly.

### Endpoints

- `POST /api/v1/ai/exercise-suggestions` — generate initial suggestions
- `POST /api/v1/ai/exercise-suggestions/refine` — stateless refinement
- `POST /api/v1/ai/exercise-suggestions/apply` — commit selected suggestions to a section

### Suggestion Shape

Same shape returned by both `/exercise-suggestions` and `/exercise-suggestions/refine`:

```json
{
  "name": "Incline Dumbbell Press",
  "muscle_group": "chest",
  "equipment": "dumbbell",
  "tracking_type": "weight_reps",
  "target_sets": 4,
  "target_reps": 10,
  "target_weight": 25.0,
  "rationale": "Targets upper chest, complements flat pressing.",
  "existing_uuid": "abc-123"
}
```

- `existing_uuid` is non-null when the exercise already exists in the library — lets the client reuse it rather than create a duplicate
- `target_sets`, `target_reps`, `target_weight` are AI-recommended defaults based on goal and experience; adjustable via refinement
- `rationale` is a one-sentence explanation of why the exercise fits the goal

### Initial Request

```json
{
  "goal": "hypertrophy",
  "muscle_group": "chest",
  "equipment": ["barbell", "dumbbell"],
  "count": 5,
  "program_uuid": "abc-123",
  "experience": "intermediate"
}
```

- `program_uuid` optional — used to exclude exercises already in the program
- `count` optional, default 5, max 10

### Refinement Request

```json
{
  "previous_suggestions": [...],
  "refinement": "swap anything cable-based for dumbbell alternatives",
  "section_uuid": "abc-123"
}
```

- Stateless — client echoes previous suggestions back; no server-side session state
- `refinement` is a freeform natural language note

### Apply Request

```json
{
  "section_uuid": "abc-123",
  "suggestions": [{ "...suggestion shape..." }]
}
```

Apply runs a single transaction handling both cases:

- `existing_uuid` set → link directly to section (create `section_exercise` row)
- `existing_uuid` null → create exercise first, then link (both in same transaction)

---

## Feature 2: Template Generation

Generates workout structure — workout names and section names — from a freeform description. No exercises yet. Structure only.

This feature exists because templates are first-class. Users without an existing template need AI help building the structure before program generation can work.

### Endpoints

- `POST /api/v1/ai/template` — freeform description → template structure preview
- `POST /api/v1/ai/template/refine` — stateless refinement
- `POST /api/v1/ai/template/apply` — saves the structure as a new program

### Initial Request

```json
{
  "description": "5-day PPL, keep sections simple, no burnout sections",
  "days_per_week": 5
}
```

- `description` is the primary signal — freeform natural language
- Structured hints (`days_per_week`, `split_style`) are optional helpers; the model uses `description` as the authority

### Template Preview Shape

```json
{
  "name": "5-Day PPL",
  "workouts": [
    {
      "name": "Push",
      "day_number": 1,
      "sections": [
        { "name": "Heavy Compounds", "rest_seconds": 180 },
        { "name": "Accessories", "rest_seconds": 90 }
      ]
    }
  ]
}
```

No exercises — structure only.

### Refinement

Same stateless pattern. Freeform note + previous structure echoed back.

Examples: "make it 4 days instead of 5", "add a dedicated arm section to Push", "rename Pull to Back & Biceps".

### Apply

Saves the AI-generated structure as a new program. User now has an empty program (no exercises yet) ready for program generation (Feature 3).

### Why Freeform

Template structure (names and organization) is simple enough that users think about it in natural language. Structured inputs make sense for precise data like sets and weight — not for expressing structural intent. Freeform is lower friction and produces better results here.

---

## Feature 3: Program Generation

Always template-first. A template must exist (built manually or via Feature 2) before generating a program. The AI fills in exercises within the template's fixed structure.

**User paths:**

- Has a template → go straight to program generation
- No template → use Template Generation first, then proceed

### Endpoints

- `POST /api/v1/ai/program` — `template_uuid` + structured params → full program preview
- `POST /api/v1/ai/program/refine` — stateless refinement
- `POST /api/v1/ai/program/apply` — deep copies template, creates real program with AI-filled exercises

### Initial Request

```json
{
  "template_uuid": "abc-123",
  "goal": "strength",
  "experience": "intermediate",
  "equipment": ["barbell", "dumbbell"],
  "notes": "focus on posterior chain, no overhead pressing"
}
```

- `template_uuid` required — always template-first
- `notes` optional freeform — used to express constraints or priorities

### Program Preview Shape

Full program structure matching the template's workouts and sections, with exercises filled in:

```json
{
  "name": "My Strength Block",
  "description": "...",
  "workouts": [
    {
      "name": "Push",
      "day_number": 1,
      "sections": [
        {
          "name": "Heavy Compounds",
          "rest_seconds": 180,
          "exercises": [
            {
              "exercise_name": "Bench Press",
              "existing_uuid": "abc-123",
              "target_sets": 4,
              "target_reps": 5,
              "target_weight": 80.0,
              "tracking_type": "weight_reps"
            }
          ]
        }
      ]
    }
  ]
}
```

### Refinement

Same stateless pattern. Full generated program echoed back + freeform note. The payload is larger than suggestions (full program vs 5 exercises) but still manageable JSON.

Examples: "the squat volume is too high", "swap RDLs for leg curls on pull day", "I don't have a leg press".

### Apply

Deep copies the source program structure, creates a new program with AI-filled exercises. Handles `existing_uuid` the same way as suggestions apply — creates missing exercises in a transaction.

### Why Template-First

Fully unconstrained program generation produces inconsistent results. The template constrains the structure (day count, section layout); the AI focuses on exercise selection and targets. Better reliability, better UX, and keeps templates first-class citizens rather than an internal implementation detail.

---

## Feature 4: Form Tips

Per-exercise coaching cues only. Rest time and exercise sequencing are handled during template and program generation — form tips focuses solely on technique for a single movement.

### Endpoints

- `POST /api/v1/ai/form-tips` — exercise UUID + optional context → coaching cues

No refinement step. No apply step. Purely read-only — nothing persists.

### Request

```json
{
  "exercise_uuid": "abc-123",
  "context": "I'm a beginner with limited hip mobility"
}
```

- `context` is optional freeform — personalizes cues without requiring a user profile
- Call again with different context if needed

### Response

```json
{
  "exercise_name": "Barbell Squat",
  "setup_cues": ["Position bar across upper traps, not the neck", "..."],
  "execution_cues": ["Drive knees out in line with toes", "..."],
  "common_mistakes": ["Knees caving inward", "..."],
  "safety_notes": ["With limited hip mobility, slight heel elevation can help"]
}
```

---

## Feature 5: Exercise Substitution

Suggests alternative exercises for a planned exercise during an active session — e.g., when equipment is unavailable or the user wants a change. Follows the same suggest → (optionally refine) → apply pattern. Operates at the set_log level; the program is never modified.

### Endpoints

- `POST /api/v1/ai/exercise-substitutions` — suggest alternatives for a given exercise
- `POST /api/v1/ai/exercise-substitutions/refine` — stateless refinement
- `POST /api/v1/ai/exercise-substitutions/apply` — record substitution for this session

### Initial Request

```json
{
  "exercise_uuid": "abc-123",
  "session_uuid": "def-456",
  "context": "leg press machine is taken, prefer free weights"
}
```

- `context` is optional freeform — the AI uses it along with the exercise's muscle group and attributes to generate targeted alternatives
- `session_uuid` is required — scopes the substitution to a specific session

### Suggestion Shape

Same shape as exercise suggestions (reused):

```json
{
  "name": "Hack Squat",
  "muscle_group": "quads",
  "equipment": "machine",
  "tracking_type": "weight_reps",
  "target_sets": 4,
  "target_reps": 10,
  "target_weight": 60.0,
  "rationale": "Same quad-dominant pattern as leg press with similar loading.",
  "existing_uuid": "abc-123"
}
```

- `existing_uuid` non-null → exercise already in library; apply links directly
- `existing_uuid` null → apply creates the exercise first, then links

### Refinement

Same stateless pattern. Freeform note + previous suggestions echoed back.

Examples: "something with less knee stress", "bodyweight only", "has to be a barbell movement"

### Apply Request

Works for both AI-picked and user-typed substitutes:

```json
{
  "session_uuid": "abc-123",
  "original_exercise_uuid": "def-456",
  "substitute": { "...suggestion shape..." }
}
```

Apply runs a single transaction:
- `existing_uuid` set → use that exercise
- `existing_uuid` null → create exercise first
- Records the substitution at the session level (see open question in [implementation-plan.md](implementation-plan.md) Step 4)

Substitution is session-only — the program and template are never touched.

---

## Testing

- `MockProvider` lives in `internal/ai/testutil/mock.go` — accessible to both `ai` package unit tests and acceptance tests
- Acceptance tests use `MockProvider` — no real API calls in CI
- Real provider integration tests are gated by the `ANTHROPIC_API_KEY` env var and skipped when not set
