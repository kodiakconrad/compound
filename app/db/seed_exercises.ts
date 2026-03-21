// Seed data for prebuilt exercises — ported from internal/seed/exercises.go.
// Called by migration 002. Each exercise gets a deterministic UUID based on
// its name so the migration is idempotent.

import { getDatabase } from "./database";

interface SeedExercise {
  name: string;
  muscle_group: string;
  equipment: string;
  tracking_type: string;
}

const SEED_EXERCISES: SeedExercise[] = [
  // --- Chest ---
  { name: "Barbell Bench Press", muscle_group: "chest", equipment: "barbell", tracking_type: "weight_reps" },
  { name: "Incline Barbell Bench Press", muscle_group: "chest", equipment: "barbell", tracking_type: "weight_reps" },
  { name: "Decline Barbell Bench Press", muscle_group: "chest", equipment: "barbell", tracking_type: "weight_reps" },
  { name: "Dumbbell Bench Press", muscle_group: "chest", equipment: "dumbbell", tracking_type: "weight_reps" },
  { name: "Incline Dumbbell Press", muscle_group: "chest", equipment: "dumbbell", tracking_type: "weight_reps" },
  { name: "Dumbbell Fly", muscle_group: "chest", equipment: "dumbbell", tracking_type: "weight_reps" },
  { name: "Cable Fly", muscle_group: "chest", equipment: "cable", tracking_type: "weight_reps" },
  { name: "Pec Deck", muscle_group: "chest", equipment: "machine", tracking_type: "weight_reps" },
  { name: "Push-Up", muscle_group: "chest", equipment: "bodyweight", tracking_type: "bodyweight_reps" },
  { name: "Dips (Chest)", muscle_group: "chest", equipment: "bodyweight", tracking_type: "bodyweight_reps" },
  { name: "Machine Chest Press", muscle_group: "chest", equipment: "machine", tracking_type: "weight_reps" },
  // --- Back ---
  { name: "Barbell Row", muscle_group: "back", equipment: "barbell", tracking_type: "weight_reps" },
  { name: "Pendlay Row", muscle_group: "back", equipment: "barbell", tracking_type: "weight_reps" },
  { name: "Dumbbell Row", muscle_group: "back", equipment: "dumbbell", tracking_type: "weight_reps" },
  { name: "Seated Cable Row", muscle_group: "back", equipment: "cable", tracking_type: "weight_reps" },
  { name: "Lat Pulldown", muscle_group: "back", equipment: "cable", tracking_type: "weight_reps" },
  { name: "Pull-Up", muscle_group: "back", equipment: "bodyweight", tracking_type: "bodyweight_reps" },
  { name: "Chin-Up", muscle_group: "back", equipment: "bodyweight", tracking_type: "bodyweight_reps" },
  { name: "T-Bar Row", muscle_group: "back", equipment: "barbell", tracking_type: "weight_reps" },
  { name: "Face Pull", muscle_group: "back", equipment: "cable", tracking_type: "weight_reps" },
  { name: "Deadlift", muscle_group: "back", equipment: "barbell", tracking_type: "weight_reps" },
  { name: "Rack Pull", muscle_group: "back", equipment: "barbell", tracking_type: "weight_reps" },
  // --- Legs ---
  { name: "Barbell Squat", muscle_group: "legs", equipment: "barbell", tracking_type: "weight_reps" },
  { name: "Front Squat", muscle_group: "legs", equipment: "barbell", tracking_type: "weight_reps" },
  { name: "Leg Press", muscle_group: "legs", equipment: "machine", tracking_type: "weight_reps" },
  { name: "Hack Squat", muscle_group: "legs", equipment: "machine", tracking_type: "weight_reps" },
  { name: "Romanian Deadlift", muscle_group: "legs", equipment: "barbell", tracking_type: "weight_reps" },
  { name: "Bulgarian Split Squat", muscle_group: "legs", equipment: "dumbbell", tracking_type: "weight_reps" },
  { name: "Goblet Squat", muscle_group: "legs", equipment: "dumbbell", tracking_type: "weight_reps" },
  { name: "Walking Lunge", muscle_group: "legs", equipment: "dumbbell", tracking_type: "weight_reps" },
  { name: "Leg Extension", muscle_group: "legs", equipment: "machine", tracking_type: "weight_reps" },
  { name: "Leg Curl", muscle_group: "legs", equipment: "machine", tracking_type: "weight_reps" },
  { name: "Calf Raise (Standing)", muscle_group: "legs", equipment: "machine", tracking_type: "weight_reps" },
  { name: "Calf Raise (Seated)", muscle_group: "legs", equipment: "machine", tracking_type: "weight_reps" },
  { name: "Hip Thrust", muscle_group: "legs", equipment: "barbell", tracking_type: "weight_reps" },
  { name: "Sumo Deadlift", muscle_group: "legs", equipment: "barbell", tracking_type: "weight_reps" },
  // --- Shoulders ---
  { name: "Overhead Press", muscle_group: "shoulders", equipment: "barbell", tracking_type: "weight_reps" },
  { name: "Dumbbell Shoulder Press", muscle_group: "shoulders", equipment: "dumbbell", tracking_type: "weight_reps" },
  { name: "Arnold Press", muscle_group: "shoulders", equipment: "dumbbell", tracking_type: "weight_reps" },
  { name: "Lateral Raise", muscle_group: "shoulders", equipment: "dumbbell", tracking_type: "weight_reps" },
  { name: "Front Raise", muscle_group: "shoulders", equipment: "dumbbell", tracking_type: "weight_reps" },
  { name: "Rear Delt Fly", muscle_group: "shoulders", equipment: "dumbbell", tracking_type: "weight_reps" },
  { name: "Cable Lateral Raise", muscle_group: "shoulders", equipment: "cable", tracking_type: "weight_reps" },
  { name: "Upright Row", muscle_group: "shoulders", equipment: "barbell", tracking_type: "weight_reps" },
  { name: "Machine Shoulder Press", muscle_group: "shoulders", equipment: "machine", tracking_type: "weight_reps" },
  // --- Biceps ---
  { name: "Barbell Curl", muscle_group: "biceps", equipment: "barbell", tracking_type: "weight_reps" },
  { name: "EZ Bar Curl", muscle_group: "biceps", equipment: "barbell", tracking_type: "weight_reps" },
  { name: "Dumbbell Curl", muscle_group: "biceps", equipment: "dumbbell", tracking_type: "weight_reps" },
  { name: "Hammer Curl", muscle_group: "biceps", equipment: "dumbbell", tracking_type: "weight_reps" },
  { name: "Incline Dumbbell Curl", muscle_group: "biceps", equipment: "dumbbell", tracking_type: "weight_reps" },
  { name: "Preacher Curl", muscle_group: "biceps", equipment: "barbell", tracking_type: "weight_reps" },
  { name: "Cable Curl", muscle_group: "biceps", equipment: "cable", tracking_type: "weight_reps" },
  { name: "Concentration Curl", muscle_group: "biceps", equipment: "dumbbell", tracking_type: "weight_reps" },
  // --- Triceps ---
  { name: "Close-Grip Bench Press", muscle_group: "triceps", equipment: "barbell", tracking_type: "weight_reps" },
  { name: "Tricep Pushdown", muscle_group: "triceps", equipment: "cable", tracking_type: "weight_reps" },
  { name: "Overhead Tricep Extension", muscle_group: "triceps", equipment: "dumbbell", tracking_type: "weight_reps" },
  { name: "Skull Crusher", muscle_group: "triceps", equipment: "barbell", tracking_type: "weight_reps" },
  { name: "Dips (Triceps)", muscle_group: "triceps", equipment: "bodyweight", tracking_type: "bodyweight_reps" },
  { name: "Cable Overhead Extension", muscle_group: "triceps", equipment: "cable", tracking_type: "weight_reps" },
  { name: "Kickback", muscle_group: "triceps", equipment: "dumbbell", tracking_type: "weight_reps" },
  // --- Core ---
  { name: "Plank", muscle_group: "core", equipment: "bodyweight", tracking_type: "duration" },
  { name: "Side Plank", muscle_group: "core", equipment: "bodyweight", tracking_type: "duration" },
  { name: "Hanging Leg Raise", muscle_group: "core", equipment: "bodyweight", tracking_type: "bodyweight_reps" },
  { name: "Cable Crunch", muscle_group: "core", equipment: "cable", tracking_type: "weight_reps" },
  { name: "Ab Wheel Rollout", muscle_group: "core", equipment: "other", tracking_type: "bodyweight_reps" },
  { name: "Russian Twist", muscle_group: "core", equipment: "other", tracking_type: "bodyweight_reps" },
  { name: "Dead Bug", muscle_group: "core", equipment: "bodyweight", tracking_type: "bodyweight_reps" },
  { name: "Farmer's Walk", muscle_group: "core", equipment: "dumbbell", tracking_type: "duration" },
  { name: "Pallof Press", muscle_group: "core", equipment: "cable", tracking_type: "weight_reps" },
  // --- Cardio ---
  { name: "Treadmill Run", muscle_group: "cardio", equipment: "machine", tracking_type: "distance" },
  { name: "Rowing Machine", muscle_group: "cardio", equipment: "machine", tracking_type: "distance" },
  { name: "Stationary Bike", muscle_group: "cardio", equipment: "machine", tracking_type: "duration" },
  { name: "Stair Climber", muscle_group: "cardio", equipment: "machine", tracking_type: "duration" },
  { name: "Jump Rope", muscle_group: "cardio", equipment: "other", tracking_type: "duration" },
  { name: "Battle Ropes", muscle_group: "cardio", equipment: "other", tracking_type: "duration" },
  { name: "Kettlebell Swing", muscle_group: "cardio", equipment: "kettlebell", tracking_type: "weight_reps" },
  { name: "Box Jump", muscle_group: "cardio", equipment: "other", tracking_type: "bodyweight_reps" },
  { name: "Burpee", muscle_group: "cardio", equipment: "bodyweight", tracking_type: "bodyweight_reps" },
  // --- Other / Compound ---
  { name: "Power Clean", muscle_group: "other", equipment: "barbell", tracking_type: "weight_reps" },
  { name: "Snatch", muscle_group: "other", equipment: "barbell", tracking_type: "weight_reps" },
  { name: "Clean and Jerk", muscle_group: "other", equipment: "barbell", tracking_type: "weight_reps" },
  { name: "Turkish Get-Up", muscle_group: "other", equipment: "kettlebell", tracking_type: "weight_reps" },
  { name: "Sled Push", muscle_group: "other", equipment: "other", tracking_type: "distance" },
];

export function seedExercises(): void {
  const db = getDatabase();
  const now = new Date().toISOString();

  const stmt = db.prepareSync(
    `INSERT OR IGNORE INTO exercises (uuid, name, muscle_group, equipment, tracking_type, is_custom, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 0, ?, ?)`
  );

  try {
    for (const ex of SEED_EXERCISES) {
      // Generate a deterministic UUID from the exercise name so this is
      // idempotent — running it twice won't create duplicates.
      const uuid = deterministicUUID(ex.name);
      stmt.executeSync(uuid, ex.name, ex.muscle_group, ex.equipment, ex.tracking_type, now, now);
    }
  } finally {
    stmt.finalizeSync();
  }
}

// Simple deterministic UUID v5-like hash from a string.
// Not cryptographic — just needs to be stable and unique per name.
function deterministicUUID(input: string): string {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const ch = input.charCodeAt(i);
    hash = ((hash << 5) - hash + ch) | 0;
  }
  // Pad hash into a UUID-shaped string
  const hex = Math.abs(hash).toString(16).padStart(8, "0");
  return `seed-ex-${hex}-0000-0000-${hex.padEnd(12, "0")}`;
}
