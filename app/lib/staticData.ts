// Static exercise data used during the design/static phase of Step 3.
// The wiring step (Step 3b) replaced live screens with real API hooks.
// This file is kept for fallback/test data referenced during development.

// TrackingType is now defined in lib/types.ts and re-exported here so that
// existing component imports (e.g. `from "../../lib/staticData"`) keep working.
export type { TrackingType } from "./types";

export interface Exercise {
  uuid: string;
  name: string;
  muscle_group: string;
  equipment: string;
  tracking_type: TrackingType;
  is_custom: boolean;
}

export const STATIC_EXERCISES: Exercise[] = [
  { uuid: "1", name: "Bench Press",     muscle_group: "chest",     equipment: "barbell",    tracking_type: "weight_reps",     is_custom: false },
  { uuid: "2", name: "Squat",           muscle_group: "legs",      equipment: "barbell",    tracking_type: "weight_reps",     is_custom: false },
  { uuid: "3", name: "Deadlift",        muscle_group: "back",      equipment: "barbell",    tracking_type: "weight_reps",     is_custom: false },
  { uuid: "4", name: "Pull-up",         muscle_group: "back",      equipment: "bodyweight", tracking_type: "bodyweight_reps", is_custom: false },
  { uuid: "5", name: "Overhead Press",  muscle_group: "shoulders", equipment: "barbell",    tracking_type: "weight_reps",     is_custom: false },
  { uuid: "6", name: "Plank",           muscle_group: "core",      equipment: "bodyweight", tracking_type: "duration",        is_custom: false },
  { uuid: "7", name: "Bicep Curl",      muscle_group: "arms",      equipment: "dumbbell",   tracking_type: "weight_reps",     is_custom: true  },
];

// "LAST LOGGED" text shown on the detail screen.
export const STATIC_LAST_LOGGED: Record<string, string> = {
  "1": "Mar 5 · 3×5 @ 80 kg",
  "2": "Mar 5 · 3×5 @ 100 kg",
  "3": "Mar 3 · 1×5 @ 120 kg",
  "4": "Mar 1 · 3×8",
};

// "USED IN" programs shown on the detail screen.
export const STATIC_USED_IN: Record<string, { program: string; workout: string }[]> = {
  "1": [
    { program: "5/3/1", workout: "Day B" },
    { program: "PPL",   workout: "Day 2" },
  ],
  "2": [{ program: "5/3/1", workout: "Day A" }],
  "3": [{ program: "5/3/1", workout: "Day A" }],
};
