// Program domain model — mirrors internal/domain/program.go and workout.go.
// Includes the full program tree: Program → Workout → Section → SectionExercise.

import { ValidationError } from "./errors";
import { type TrackingType } from "./exercise";
import { type ProgressionRule } from "./progression";

// ---------------------------------------------------------------------------
// Set Scheme value objects — mirrors domain.SetScheme / domain.SchemeSet
// ---------------------------------------------------------------------------

export type SetSchemeType = "pyramid" | "531" | "dropset";

export const VALID_SCHEME_TYPES: SetSchemeType[] = [
  "pyramid",
  "531",
  "dropset",
];

export interface SchemeSet {
  reps: number;
  weight: number;
}

export interface SetScheme {
  type: SetSchemeType;
  sets: SchemeSet[];
  one_rep_max?: number;
  working_weight?: number;
  week?: 1 | 2 | 3;
}

export function validateSetScheme(s: SetScheme): ValidationError | null {
  if (!VALID_SCHEME_TYPES.includes(s.type)) {
    return new ValidationError("set_scheme.type", `invalid scheme type: ${s.type}`);
  }
  if (!s.sets || s.sets.length === 0) {
    return new ValidationError("set_scheme.sets", "at least one set is required");
  }
  for (let i = 0; i < s.sets.length; i++) {
    if (s.sets[i].reps < 1) {
      return new ValidationError(
        `set_scheme.sets[${i}].reps`,
        "reps must be >= 1"
      );
    }
    if (s.sets[i].weight < 0) {
      return new ValidationError(
        `set_scheme.sets[${i}].weight`,
        "weight must be >= 0"
      );
    }
  }
  if (s.type === "531") {
    if (s.week == null || s.week < 1 || s.week > 3) {
      return new ValidationError(
        "set_scheme.week",
        "week is required for 531 and must be 1, 2, or 3"
      );
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Entities
// ---------------------------------------------------------------------------

export interface Program {
  id: number;
  uuid: string;
  name: string;
  description: string | null;
  is_prebuilt: boolean;
  workouts: ProgramWorkout[];
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  /** Computed — true when at least one active cycle exists for this program. */
  has_active_cycle?: boolean;
}

export interface ProgramListItem {
  uuid: string;
  name: string;
  is_prebuilt: boolean;
  workout_count: number;
  has_active_cycle: boolean;
  updated_at: string;
}

export interface ProgramWorkout {
  id: number;
  uuid: string;
  program_id: number;
  name: string;
  day_number: number;
  sort_order: number;
  sections: Section[];
  created_at: string;
  updated_at: string;
}

export interface Section {
  id: number;
  uuid: string;
  program_workout_id: number;
  name: string;
  sort_order: number;
  rest_seconds: number | null;
  exercises: SectionExercise[];
  created_at: string;
  updated_at: string;
}

export interface SectionExercise {
  id: number;
  uuid: string;
  section_id: number;
  exercise_id: number;
  exercise_uuid: string;
  exercise_name: string;
  exercise_tracking_type: TrackingType;
  target_sets: number | null;
  target_reps: number | null;
  target_weight: number | null;
  target_duration: number | null;
  target_distance: number | null;
  sort_order: number;
  notes: string | null;
  set_scheme: SetScheme | null;
  progression_rule: ProgressionRule | null;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export function validateProgram(p: {
  name: string;
}): ValidationError | null {
  if (!p.name || p.name.trim().length === 0) {
    return new ValidationError("name", "name is required");
  }
  return null;
}

export function validateWorkout(w: {
  name: string;
  day_number: number;
}): ValidationError | null {
  if (!w.name || w.name.trim().length === 0) {
    return new ValidationError("name", "name is required");
  }
  if (w.day_number < 1) {
    return new ValidationError("day_number", "day_number must be >= 1");
  }
  return null;
}

export function validateSection(s: {
  name: string;
}): ValidationError | null {
  if (!s.name || s.name.trim().length === 0) {
    return new ValidationError("name", "name is required");
  }
  return null;
}

export function validateSectionExercise(se: {
  exercise_id: number;
  target_sets?: number | null;
  target_reps?: number | null;
  target_weight?: number | null;
  target_duration?: number | null;
  target_distance?: number | null;
  set_scheme?: SetScheme | null;
}): ValidationError | null {
  if (se.exercise_id <= 0) {
    return new ValidationError("exercise_id", "exercise_id is required");
  }

  const hasTarget =
    (se.target_sets != null && se.target_sets > 0) ||
    (se.target_reps != null && se.target_reps > 0) ||
    (se.target_weight != null && se.target_weight > 0) ||
    (se.target_duration != null && se.target_duration > 0) ||
    (se.target_distance != null && se.target_distance > 0) ||
    se.set_scheme != null;

  if (!hasTarget) {
    return new ValidationError(
      "targets",
      "at least one target (sets, reps, weight, duration, distance, or set_scheme) is required"
    );
  }

  if (se.set_scheme) {
    return validateSetScheme(se.set_scheme);
  }

  return null;
}

// ---------------------------------------------------------------------------
// Deep copy — mirrors Program.DeepCopy() in Go
// ---------------------------------------------------------------------------

import { uuid as generateUUID } from "../lib/uuid";

export function deepCopyProgram(p: Program): Program {
  const now = new Date().toISOString();

  return {
    id: 0,
    uuid: generateUUID(),
    name: `${p.name} (Copy)`,
    description: p.description,
    is_prebuilt: false,
    created_at: now,
    updated_at: now,
    deleted_at: null,
    workouts: p.workouts.map((w) => ({
      id: 0,
      uuid: generateUUID(),
      program_id: 0,
      name: w.name,
      day_number: w.day_number,
      sort_order: w.sort_order,
      created_at: now,
      updated_at: now,
      sections: w.sections.map((s) => ({
        id: 0,
        uuid: generateUUID(),
        program_workout_id: 0,
        name: s.name,
        sort_order: s.sort_order,
        rest_seconds: s.rest_seconds,
        created_at: now,
        updated_at: now,
        exercises: s.exercises.map((se) => ({
          id: 0,
          uuid: generateUUID(),
          section_id: 0,
          exercise_id: se.exercise_id,
          exercise_uuid: se.exercise_uuid,
          exercise_name: se.exercise_name,
          exercise_tracking_type: se.exercise_tracking_type,
          target_sets: se.target_sets,
          target_reps: se.target_reps,
          target_weight: se.target_weight,
          target_duration: se.target_duration,
          target_distance: se.target_distance,
          sort_order: se.sort_order,
          notes: se.notes,
          set_scheme: se.set_scheme
            ? {
                ...se.set_scheme,
                sets: se.set_scheme.sets.map((ss) => ({ ...ss })),
              }
            : null,
          progression_rule: se.progression_rule
            ? {
                ...se.progression_rule,
                id: 0,
                uuid: generateUUID(),
                section_exercise_id: 0,
                created_at: now,
                updated_at: now,
              }
            : null,
          created_at: now,
          updated_at: now,
        })),
      })),
    })),
  };
}
