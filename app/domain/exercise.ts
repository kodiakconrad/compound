// Exercise domain model — mirrors internal/domain/exercise.go.
// Uses interfaces (not classes) for React state compatibility.

import { ValidationError } from "./errors";

// ---------------------------------------------------------------------------
// Value objects
// ---------------------------------------------------------------------------

export type TrackingType =
  | "weight_reps"
  | "bodyweight_reps"
  | "duration"
  | "distance";

export const VALID_TRACKING_TYPES: TrackingType[] = [
  "weight_reps",
  "bodyweight_reps",
  "duration",
  "distance",
];

export const VALID_MUSCLE_GROUPS = [
  "chest",
  "back",
  "legs",
  "shoulders",
  "biceps",
  "triceps",
  "core",
  "cardio",
  "other",
] as const;

export type MuscleGroup = (typeof VALID_MUSCLE_GROUPS)[number];

export const VALID_EQUIPMENT = [
  "barbell",
  "dumbbell",
  "cable",
  "machine",
  "bodyweight",
  "band",
  "kettlebell",
  "other",
] as const;

export type Equipment = (typeof VALID_EQUIPMENT)[number];

// ---------------------------------------------------------------------------
// Entity
// ---------------------------------------------------------------------------

export interface Exercise {
  id: number;
  uuid: string;
  name: string;
  muscle_group: string | null;
  equipment: string | null;
  tracking_type: TrackingType;
  notes: string | null;
  is_custom: boolean;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export function validateExercise(e: {
  name: string;
  tracking_type: string;
  muscle_group?: string | null;
  equipment?: string | null;
}): ValidationError | null {
  if (!e.name || e.name.trim().length === 0) {
    return new ValidationError("name", "name is required");
  }

  if (
    !VALID_TRACKING_TYPES.includes(e.tracking_type as TrackingType)
  ) {
    return new ValidationError(
      "tracking_type",
      `invalid tracking type: ${e.tracking_type}`
    );
  }

  if (
    e.muscle_group &&
    !VALID_MUSCLE_GROUPS.includes(e.muscle_group as MuscleGroup)
  ) {
    return new ValidationError(
      "muscle_group",
      `invalid muscle group: ${e.muscle_group}`
    );
  }

  if (
    e.equipment &&
    !VALID_EQUIPMENT.includes(e.equipment as Equipment)
  ) {
    return new ValidationError(
      "equipment",
      `invalid equipment: ${e.equipment}`
    );
  }

  return null;
}
