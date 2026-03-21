// Session domain model — mirrors internal/domain/session.go.

import { UnprocessableError } from "./errors";
import { type TrackingType } from "./exercise";

// ---------------------------------------------------------------------------
// Value objects
// ---------------------------------------------------------------------------

export type SessionStatus = "pending" | "in_progress" | "completed" | "skipped";

// ---------------------------------------------------------------------------
// Entities
// ---------------------------------------------------------------------------

export interface Session {
  id: number;
  uuid: string;
  cycle_id: number;
  program_workout_id: number;
  sort_order: number;
  status: SessionStatus;
  started_at: string | null;
  completed_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface SetLog {
  id: number;
  uuid: string;
  session_id: number;
  exercise_id: number;
  exercise_uuid: string;
  section_exercise_id: number | null;
  section_exercise_uuid: string | null;
  set_number: number;
  target_reps: number | null;
  actual_reps: number | null;
  weight: number | null;
  duration: number | null;
  distance: number | null;
  rpe: number | null;
  completed_at: string;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Read models — session detail with computed target weights
// ---------------------------------------------------------------------------

export interface SessionDetail {
  uuid: string;
  cycle_id: number;
  cycle_uuid: string;
  program_workout_id: number;
  workout_name: string;
  sort_order: number;
  status: SessionStatus;
  started_at: string | null;
  completed_at: string | null;
  notes: string | null;
  sections: SessionDetailSection[];
  created_at: string;
  updated_at: string;
}

export interface SessionDetailSection {
  uuid: string;
  name: string;
  sort_order: number;
  rest_seconds: number | null;
  exercises: SessionDetailExercise[];
}

export interface SessionDetailExercise {
  section_exercise_uuid: string;
  exercise_uuid: string;
  exercise_name: string;
  tracking_type: TrackingType;
  target_sets: number | null;
  target_reps: number | null;
  static_target_weight: number | null;
  computed_target_weight: number | null;
  target_duration: number | null;
  target_distance: number | null;
  sort_order: number;
  notes: string | null;
  set_logs: SetLog[];
}

// ---------------------------------------------------------------------------
// State machine methods — mirrors Session.Start/Complete/Skip in Go
// ---------------------------------------------------------------------------

export function startSession(s: Session): UnprocessableError | null {
  if (s.status !== "pending") {
    return new UnprocessableError(
      `cannot start session: status is "${s.status}", expected "pending"`
    );
  }
  return null;
}

export function completeSession(s: Session): UnprocessableError | null {
  if (s.status !== "in_progress") {
    return new UnprocessableError(
      `cannot complete session: status is "${s.status}", expected "in_progress"`
    );
  }
  return null;
}

export function skipSession(s: Session): UnprocessableError | null {
  if (s.status !== "pending" && s.status !== "in_progress") {
    return new UnprocessableError(
      `cannot skip session: status is "${s.status}", expected "pending" or "in_progress"`
    );
  }
  return null;
}
