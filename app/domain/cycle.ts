// Cycle domain model — mirrors internal/domain/cycle.go.

import { UnprocessableError } from "./errors";
import { type Session } from "./session";

// ---------------------------------------------------------------------------
// Value objects
// ---------------------------------------------------------------------------

export type CycleStatus = "active" | "paused" | "completed";

// ---------------------------------------------------------------------------
// Entity
// ---------------------------------------------------------------------------

export interface Cycle {
  id: number;
  uuid: string;
  program_id: number;
  program_name: string;
  status: CycleStatus;
  started_at: string | null;
  completed_at: string | null;
  sessions: Session[];
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// State machine — mirrors Cycle.TransitionTo() in Go
// ---------------------------------------------------------------------------

const VALID_TRANSITIONS: Record<CycleStatus, CycleStatus[]> = {
  active: ["paused", "completed"],
  paused: ["active", "completed"],
  completed: [],
};

export function transitionCycle(
  current: CycleStatus,
  next: CycleStatus
): UnprocessableError | null {
  if (!VALID_TRANSITIONS[current]?.includes(next)) {
    return new UnprocessableError(
      `cannot transition cycle from "${current}" to "${next}"`
    );
  }
  return null;
}
