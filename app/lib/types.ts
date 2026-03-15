// Shared types that mirror the backend DTO shapes.
// These are the "real" types used by hooks that fetch from the API.

// TrackingType mirrors the backend TrackingType enum.
// Re-exported from staticData.ts so existing component imports keep working.
export type TrackingType = "weight_reps" | "bodyweight_reps" | "duration" | "distance";

// Exercise matches the backend ExerciseResponse DTO.
// muscle_group, equipment, and notes are optional because the backend uses
// omitempty — they're absent from the JSON when the database field is NULL.
export interface Exercise {
  uuid: string;
  name: string;
  muscle_group?: string;
  equipment?: string;
  tracking_type: TrackingType;
  notes?: string;
  is_custom: boolean;
  created_at: string;
  updated_at: string;
}

// ExerciseFilters matches the response from GET /api/v1/exercises/filters.
export interface ExerciseFilters {
  muscle_groups: string[];
  equipment: string[];
  tracking_types: string[];
}

// ---------------------------------------------------------------------------
// Program types — mirror backend DTOs from dto/program.go & dto/workout.go
// ---------------------------------------------------------------------------

// ProgramListItem matches ProgramListItemResponse — the summary shape
// returned by GET /api/v1/programs (no nested tree).
export interface ProgramListItem {
  uuid: string;
  name: string;
  is_prebuilt: boolean;
  workout_count: number;
  has_active_cycle: boolean;
  updated_at: string;
}

// ProgramDetail matches ProgramTreeResponse — the full tree shape
// returned by GET /api/v1/programs/{uuid} and POST /api/v1/programs/{uuid}/copy.
export interface ProgramDetail {
  uuid: string;
  name: string;
  description?: string;
  is_prebuilt: boolean;
  has_active_cycle: boolean;
  workouts: Workout[];
  created_at: string;
  updated_at: string;
}

// Workout matches WorkoutTreeResponse — one workout within a program tree.
export interface Workout {
  uuid: string;
  name: string;
  day_number: number;
  sort_order: number;
  sections: Section[];
  created_at: string;
  updated_at: string;
}

// Section matches SectionTreeResponse — one section within a workout.
export interface Section {
  uuid: string;
  name: string;
  sort_order: number;
  rest_seconds?: number;
  exercises: SectionExercise[];
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Set Scheme types — per-set targets for progression schemes.
// Mirrors backend domain.SetScheme / domain.SchemeSet.
// ---------------------------------------------------------------------------

// SchemeSet is one set within a set scheme — its target reps and weight.
export interface SchemeSet {
  reps: number;
  weight: number;
}

// SetSchemeType enumerates the supported progression scheme types.
export type SetSchemeType = "pyramid" | "531" | "dropset";

// SetScheme defines per-set targets for progression schemes (Pyramid, 5/3/1,
// Drop Set). Stored as JSON on the backend.
export interface SetScheme {
  type: SetSchemeType;
  sets: SchemeSet[];
  one_rep_max?: number;      // 5/3/1: stored 1RM
  working_weight?: number;   // 5/3/1: stored working weight
  week?: 1 | 2 | 3;         // 5/3/1: week number
}

// SectionExercise matches SectionExerciseResponse — one exercise slot
// within a section, with its target sets/reps/weight.
export interface SectionExercise {
  uuid: string;
  exercise_uuid: string;
  exercise_name: string;
  target_sets?: number;
  target_reps?: number;
  target_weight?: number;
  target_duration?: number;
  target_distance?: number;
  sort_order: number;
  notes?: string;
  set_scheme?: SetScheme;
  progression_rule?: ProgressionRule;
  created_at: string;
  updated_at: string;
}

// ProgressionRule matches ProgressionRuleResponse.
export interface ProgressionRule {
  uuid: string;
  strategy: string;
  increment?: number;
  increment_pct?: number;
  deload_threshold: number;
  deload_pct: number;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Cycle & Session types — mirror backend DTOs from dto/cycle.go
// ---------------------------------------------------------------------------

// CycleWithSessions matches CycleWithSessionsResponse — returned by
// POST /api/v1/programs/{uuid}/start and GET /api/v1/cycles/{uuid}.
export interface CycleWithSessions {
  uuid: string;
  program_id: number;
  status: string;
  started_at?: string;
  completed_at?: string;
  sessions: Session[];
  created_at: string;
  updated_at: string;
}

// Session matches SessionResponse — a flat session within a cycle.
export interface Session {
  uuid: string;
  cycle_id: number;
  program_workout_id: number;
  sort_order: number;
  status: string;
  started_at?: string;
  completed_at?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

// ProgramResponse matches the flat program metadata DTO returned by
// POST /api/v1/programs (create) and PUT /api/v1/programs/{uuid} (update).
export interface ProgramResponse {
  uuid: string;
  name: string;
  description?: string;
  is_prebuilt: boolean;
  created_at: string;
  updated_at: string;
}
