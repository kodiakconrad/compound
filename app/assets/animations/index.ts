// Animation asset registry — maps exercise names (lowercase, normalized) to
// bundled Lottie JSON files. In Phase 3, this will be replaced by AI-generated
// assets fetched from the server; for now we bundle a small set of hand-picked
// animations for common exercises.
//
// Keys are exercise names lowercased to avoid case mismatches. The lookup
// function `getAnimationForExercise` handles normalization.

const ANIMATION_MAP: Record<string, any> = {
  "barbell bench press": require("./barbell-bench-press.json"),
};

/**
 * Returns the bundled Lottie animation source for an exercise, or `null` if
 * no animation is available yet. Exercise name matching is case-insensitive.
 */
export function getAnimationForExercise(exerciseName: string): any | null {
  return ANIMATION_MAP[exerciseName.toLowerCase()] ?? null;
}

/**
 * Returns true if a bundled animation exists for the given exercise name.
 */
export function hasAnimation(exerciseName: string): boolean {
  return exerciseName.toLowerCase() in ANIMATION_MAP;
}
