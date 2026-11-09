// Pure calculation functions for set progression schemes.
// No React dependencies — can be unit tested independently.

import type { SetScheme, SchemeSet } from "../domain/program";

// ---------------------------------------------------------------------------
// 1RM estimation helpers
// ---------------------------------------------------------------------------

// Estimate a 1RM from a weight and rep count using the Epley formula.
// Returns 0 if weight or reps are invalid.
export function estimate1RM(weight: number, reps: number): number {
  if (weight <= 0 || reps < 1) return 0;
  if (reps === 1) return weight;
  return Math.round(weight * (1 + reps / 30) * 10) / 10;
}

// Standard Wendler training max = 90% of 1RM, rounded to nearest 2.5.
export function trainingMax(oneRepMax: number): number {
  return roundToNearest(oneRepMax * 0.9, 2.5);
}

// Round a weight to the nearest increment (e.g., 2.5 kg plates).
function roundToNearest(value: number, increment: number): number {
  return Math.round(value / increment) * increment;
}

// ---------------------------------------------------------------------------
// Pyramid
// ---------------------------------------------------------------------------

// Build a pyramid scheme: reps decrease and weight increases each set.
// Weight is evenly spaced from startWeight to peakWeight.
// Reps are evenly spaced from startReps to endReps.
export function buildPyramid(
  sets: number,
  startWeight: number,
  peakWeight: number,
  startReps: number,
  endReps: number,
): SetScheme {
  const schemeSets: SchemeSet[] = [];

  for (let i = 0; i < sets; i++) {
    // Interpolation factor: 0 for first set, 1 for last set.
    const t = sets === 1 ? 0 : i / (sets - 1);

    const weight = roundToNearest(
      startWeight + t * (peakWeight - startWeight),
      2.5,
    );
    const reps = Math.round(startReps + t * (endReps - startReps));

    schemeSets.push({ reps: Math.max(reps, 1), weight });
  }

  return { type: "pyramid", sets: schemeSets };
}

// ---------------------------------------------------------------------------
// 5/3/1 (Wendler)
// ---------------------------------------------------------------------------

// The three week templates in Wendler's 5/3/1.
// Each week has 3 working sets with prescribed percentages and reps.
// The "+" on the last set means "as many reps as possible" (AMRAP),
// but we store the minimum target reps.
const WEEK_TEMPLATES: Record<1 | 2 | 3, { reps: number; pct: number }[]> = {
  1: [
    { reps: 5, pct: 0.65 },
    { reps: 5, pct: 0.75 },
    { reps: 5, pct: 0.85 },
  ],
  2: [
    { reps: 3, pct: 0.70 },
    { reps: 3, pct: 0.80 },
    { reps: 3, pct: 0.90 },
  ],
  3: [
    { reps: 5, pct: 0.75 },
    { reps: 3, pct: 0.85 },
    { reps: 1, pct: 0.95 },
  ],
};

// Build a 5/3/1 scheme from either a known 1RM or a working weight + reps.
// If workingWeight + workingReps are provided, 1RM is estimated first.
// The training max (90% of 1RM) is used as the base for percentage calculations.
export function build531(
  input: { oneRepMax?: number; workingWeight?: number; workingReps?: number },
  week: 1 | 2 | 3,
): SetScheme {
  let orm: number;

  if (input.oneRepMax != null && input.oneRepMax > 0) {
    orm = input.oneRepMax;
  } else if (
    input.workingWeight != null &&
    input.workingWeight > 0 &&
    input.workingReps != null &&
    input.workingReps >= 1
  ) {
    orm = estimate1RM(input.workingWeight, input.workingReps);
  } else {
    orm = 0;
  }

  const tm = trainingMax(orm);
  const template = WEEK_TEMPLATES[week];

  const schemeSets: SchemeSet[] = template.map((s) => ({
    reps: s.reps,
    weight: roundToNearest(tm * s.pct, 2.5),
  }));

  return {
    type: "531",
    sets: schemeSets,
    one_rep_max: orm,
    week,
  };
}

// ---------------------------------------------------------------------------
// Drop Set
// ---------------------------------------------------------------------------

// Build a drop set scheme: same reps each set, weight decreases by a
// fixed percentage each set.
export function buildDropSet(
  sets: number,
  topWeight: number,
  dropPercent: number,
  repsPerSet: number,
): SetScheme {
  const schemeSets: SchemeSet[] = [];
  let currentWeight = topWeight;

  for (let i = 0; i < sets; i++) {
    schemeSets.push({
      reps: repsPerSet,
      weight: roundToNearest(currentWeight, 2.5),
    });
    // Reduce weight by the drop percentage for the next set.
    currentWeight = currentWeight * (1 - dropPercent / 100);
  }

  return { type: "dropset", sets: schemeSets };
}

// ---------------------------------------------------------------------------
// Display helpers
// ---------------------------------------------------------------------------

// Format a scheme's sets as a compact summary string.
// e.g., "12×60 → 10×70 → 8×80 → 6×90"
export function formatSchemeSummary(scheme: SetScheme): string {
  return scheme.sets
    .map((s) => `${s.reps}×${s.weight}`)
    .join(" → ");
}

// Human-readable label for a scheme type.
export function schemeLabel(scheme: SetScheme): string {
  switch (scheme.type) {
    case "pyramid":
      return "Pyramid";
    case "531":
      return `5/3/1 W${scheme.week ?? "?"}`;
    case "dropset":
      return "Drop Set";
    default:
      return "Scheme";
  }
}
