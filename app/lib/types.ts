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
