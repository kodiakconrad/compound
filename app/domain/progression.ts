// Progression domain model — mirrors internal/domain/progression.go.

import { ValidationError } from "./errors";

// ---------------------------------------------------------------------------
// Value objects
// ---------------------------------------------------------------------------

export type ProgressionStrategy = "linear" | "percentage" | "wave";

export const VALID_STRATEGIES: ProgressionStrategy[] = [
  "linear",
  "percentage",
  "wave",
];

// ---------------------------------------------------------------------------
// Entity
// ---------------------------------------------------------------------------

export interface ProgressionRule {
  id: number;
  uuid: string;
  section_exercise_id: number;
  strategy: ProgressionStrategy;
  increment: number | null;
  increment_pct: number | null;
  deload_threshold: number;
  deload_pct: number;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export function validateProgressionRule(r: {
  strategy: string;
  increment?: number | null;
  increment_pct?: number | null;
  deload_threshold: number;
  deload_pct: number;
}): ValidationError | null {
  if (!VALID_STRATEGIES.includes(r.strategy as ProgressionStrategy)) {
    return new ValidationError(
      "strategy",
      `invalid strategy: ${r.strategy}`
    );
  }

  if (r.strategy === "linear") {
    if (r.increment == null || r.increment <= 0) {
      return new ValidationError(
        "increment",
        "increment must be > 0 for linear strategy"
      );
    }
  }

  if (r.strategy === "percentage") {
    if (r.increment_pct == null || r.increment_pct <= 0) {
      return new ValidationError(
        "increment_pct",
        "increment_pct must be > 0 for percentage strategy"
      );
    }
  }

  if (r.deload_threshold < 1) {
    return new ValidationError(
      "deload_threshold",
      "deload_threshold must be >= 1"
    );
  }

  if (r.deload_pct < 0 || r.deload_pct > 100) {
    return new ValidationError(
      "deload_pct",
      "deload_pct must be between 0 and 100"
    );
  }

  return null;
}

// ---------------------------------------------------------------------------
// Core progression logic — direct port of ProgressionRule.NextWeight()
// ---------------------------------------------------------------------------

export function nextWeight(
  rule: {
    strategy: ProgressionStrategy;
    increment: number | null;
    increment_pct: number | null;
    deload_threshold: number;
    deload_pct: number;
  },
  currentWeight: number,
  consecutiveFailures: number
): number {
  // Deload: consecutive failures >= threshold
  if (consecutiveFailures >= rule.deload_threshold) {
    return currentWeight * (1 - rule.deload_pct / 100);
  }

  // Hold: some failures, but below threshold
  if (consecutiveFailures > 0) {
    return currentWeight;
  }

  // Increment: zero failures
  switch (rule.strategy) {
    case "linear":
      return currentWeight + (rule.increment ?? 0);
    case "percentage":
      return currentWeight * (1 + (rule.increment_pct ?? 0) / 100);
    case "wave":
      // Wave loading deferred — static weights only.
      return currentWeight;
  }
}
