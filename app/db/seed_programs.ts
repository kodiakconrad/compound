// Seed data for prebuilt programs — ported from internal/seed/programs.go.
// Resolves exercise names to UUIDs by looking them up in the exercises table.

import { getDatabase } from "./database";
import type { SetScheme } from "../domain/program";
import { uuid as generateUUID } from "../lib/uuid";

interface SeedExercise {
  name: string;
  target_sets?: number;
  target_reps?: number;
  target_weight?: number;
  set_scheme?: SetScheme;
}

interface SeedSection {
  name: string;
  exercises: SeedExercise[];
}

interface SeedWorkout {
  name: string;
  day_number: number;
  sections: SeedSection[];
}

interface SeedProgram {
  name: string;
  description: string;
  workouts: SeedWorkout[];
}

function roundToNearest(value: number, increment: number): number {
  return Math.round(value / increment) * increment;
}

function build531Scheme(): SetScheme {
  const tm = 90.0; // 90% of placeholder 1RM (100)
  return {
    type: "531",
    one_rep_max: 100,
    week: 1,
    sets: [
      { reps: 5, weight: roundToNearest(tm * 0.65, 2.5) },
      { reps: 5, weight: roundToNearest(tm * 0.75, 2.5) },
      { reps: 5, weight: roundToNearest(tm * 0.85, 2.5) },
    ],
  };
}

function getPrograms(): SeedProgram[] {
  return [
    // Starting Strength
    {
      name: "Starting Strength",
      description: "Classic novice barbell program. Two alternating workouts (A/B) with 3×5 compounds.",
      workouts: [
        {
          name: "Day A", day_number: 1,
          sections: [{
            name: "Compound",
            exercises: [
              { name: "Barbell Squat", target_sets: 3, target_reps: 5 },
              { name: "Barbell Bench Press", target_sets: 3, target_reps: 5 },
              { name: "Deadlift", target_sets: 1, target_reps: 5 },
            ],
          }],
        },
        {
          name: "Day B", day_number: 2,
          sections: [{
            name: "Compound",
            exercises: [
              { name: "Barbell Squat", target_sets: 3, target_reps: 5 },
              { name: "Overhead Press", target_sets: 3, target_reps: 5 },
              { name: "Barbell Row", target_sets: 3, target_reps: 5 },
            ],
          }],
        },
      ],
    },
    // 5/3/1 Beginner
    {
      name: "5/3/1 Beginner",
      description: "Wendler's 5/3/1 with beginner accessories. Four days: Squat, Bench, Deadlift, OHP.",
      workouts: [
        {
          name: "Squat Day", day_number: 1,
          sections: [
            { name: "Main Lift", exercises: [{ name: "Barbell Squat", set_scheme: build531Scheme() }] },
            { name: "Accessories", exercises: [
              { name: "Leg Press", target_sets: 3, target_reps: 10 },
              { name: "Leg Curl", target_sets: 3, target_reps: 12 },
              { name: "Hanging Leg Raise", target_sets: 3, target_reps: 15 },
            ]},
          ],
        },
        {
          name: "Bench Day", day_number: 2,
          sections: [
            { name: "Main Lift", exercises: [{ name: "Barbell Bench Press", set_scheme: build531Scheme() }] },
            { name: "Accessories", exercises: [
              { name: "Dumbbell Row", target_sets: 3, target_reps: 10 },
              { name: "Dumbbell Fly", target_sets: 3, target_reps: 12 },
              { name: "Tricep Pushdown", target_sets: 3, target_reps: 15 },
            ]},
          ],
        },
        {
          name: "Deadlift Day", day_number: 3,
          sections: [
            { name: "Main Lift", exercises: [{ name: "Deadlift", set_scheme: build531Scheme() }] },
            { name: "Accessories", exercises: [
              { name: "Romanian Deadlift", target_sets: 3, target_reps: 10 },
              { name: "Barbell Row", target_sets: 3, target_reps: 10 },
              { name: "Plank", target_sets: 3, target_reps: 1 },
            ]},
          ],
        },
        {
          name: "OHP Day", day_number: 4,
          sections: [
            { name: "Main Lift", exercises: [{ name: "Overhead Press", set_scheme: build531Scheme() }] },
            { name: "Accessories", exercises: [
              { name: "Lat Pulldown", target_sets: 3, target_reps: 10 },
              { name: "Lateral Raise", target_sets: 3, target_reps: 15 },
              { name: "Face Pull", target_sets: 3, target_reps: 15 },
            ]},
          ],
        },
      ],
    },
    // Push/Pull/Legs
    {
      name: "Push/Pull/Legs",
      description: "Classic 3-day split with pyramid sets on compounds and drop sets for burnouts.",
      workouts: [
        {
          name: "Push", day_number: 1,
          sections: [
            { name: "Compound", exercises: [
              { name: "Barbell Bench Press", set_scheme: { type: "pyramid", sets: [{ reps: 12, weight: 50 }, { reps: 10, weight: 60 }, { reps: 8, weight: 70 }, { reps: 6, weight: 80 }] } },
              { name: "Dumbbell Shoulder Press", target_sets: 3, target_reps: 10 },
            ]},
            { name: "Isolation", exercises: [
              { name: "Cable Fly", target_sets: 3, target_reps: 12 },
              { name: "Lateral Raise", target_sets: 3, target_reps: 15 },
              { name: "Tricep Pushdown", target_sets: 3, target_reps: 12 },
            ]},
            { name: "Burnout", exercises: [
              { name: "Pec Deck", set_scheme: { type: "dropset", sets: [{ reps: 10, weight: 50 }, { reps: 10, weight: 40 }, { reps: 10, weight: 30 }] } },
            ]},
          ],
        },
        {
          name: "Pull", day_number: 2,
          sections: [
            { name: "Compound", exercises: [
              { name: "Barbell Row", set_scheme: { type: "pyramid", sets: [{ reps: 12, weight: 40 }, { reps: 10, weight: 50 }, { reps: 8, weight: 60 }, { reps: 6, weight: 70 }] } },
              { name: "Lat Pulldown", target_sets: 3, target_reps: 10 },
            ]},
            { name: "Isolation", exercises: [
              { name: "Face Pull", target_sets: 3, target_reps: 15 },
              { name: "Dumbbell Curl", target_sets: 3, target_reps: 12 },
              { name: "Hammer Curl", target_sets: 3, target_reps: 12 },
            ]},
            { name: "Burnout", exercises: [
              { name: "Seated Cable Row", set_scheme: { type: "dropset", sets: [{ reps: 10, weight: 45 }, { reps: 10, weight: 35 }, { reps: 10, weight: 25 }] } },
            ]},
          ],
        },
        {
          name: "Legs", day_number: 3,
          sections: [
            { name: "Compound", exercises: [
              { name: "Barbell Squat", set_scheme: { type: "pyramid", sets: [{ reps: 12, weight: 60 }, { reps: 10, weight: 80 }, { reps: 8, weight: 90 }, { reps: 6, weight: 100 }] } },
              { name: "Romanian Deadlift", target_sets: 3, target_reps: 10 },
            ]},
            { name: "Isolation", exercises: [
              { name: "Leg Extension", target_sets: 3, target_reps: 12 },
              { name: "Leg Curl", target_sets: 3, target_reps: 12 },
              { name: "Calf Raise (Standing)", target_sets: 3, target_reps: 15 },
            ]},
            { name: "Burnout", exercises: [
              { name: "Leg Press", set_scheme: { type: "dropset", sets: [{ reps: 10, weight: 120 }, { reps: 10, weight: 90 }, { reps: 10, weight: 60 }] } },
            ]},
          ],
        },
      ],
    },
  ];
}

export function seedPrograms(): void {
  const db = getDatabase();
  const now = new Date().toISOString();

  // Build name → id lookup from exercises table.
  const exerciseRows = db.getAllSync<{ id: number; name: string }>(
    "SELECT id, name FROM exercises WHERE deleted_at IS NULL"
  );
  const exerciseByName = new Map(exerciseRows.map((r) => [r.name, r.id]));

  for (const prog of getPrograms()) {
    // Skip if already seeded.
    const existing = db.getFirstSync<{ id: number }>(
      "SELECT id FROM programs WHERE name = ? AND is_prebuilt = 1",
      prog.name
    );
    if (existing) continue;

    const progUuid = generateUUID();
    db.runSync(
      `INSERT INTO programs (uuid, name, description, is_prebuilt, created_at, updated_at)
       VALUES (?, ?, ?, 1, ?, ?)`,
      progUuid,
      prog.name,
      prog.description,
      now,
      now
    );
    const progId = db.getFirstSync<{ id: number }>(
      "SELECT id FROM programs WHERE uuid = ?",
      progUuid
    )!.id;

    for (let wi = 0; wi < prog.workouts.length; wi++) {
      const w = prog.workouts[wi];
      const wUuid = generateUUID();
      db.runSync(
        `INSERT INTO program_workouts (uuid, program_id, name, day_number, sort_order, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        wUuid,
        progId,
        w.name,
        w.day_number,
        wi + 1,
        now,
        now
      );
      const wId = db.getFirstSync<{ id: number }>(
        "SELECT id FROM program_workouts WHERE uuid = ?",
        wUuid
      )!.id;

      for (let si = 0; si < w.sections.length; si++) {
        const s = w.sections[si];
        const sUuid = generateUUID();
        db.runSync(
          `INSERT INTO sections (uuid, program_workout_id, name, sort_order, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?)`,
          sUuid,
          wId,
          s.name,
          si + 1,
          now,
          now
        );
        const sId = db.getFirstSync<{ id: number }>(
          "SELECT id FROM sections WHERE uuid = ?",
          sUuid
        )!.id;

        for (let ei = 0; ei < s.exercises.length; ei++) {
          const ex = s.exercises[ei];
          const exerciseId = exerciseByName.get(ex.name);
          if (!exerciseId) {
            throw new Error(`Seed error: exercise "${ex.name}" not found in exercises table`);
          }

          const seUuid = generateUUID();
          db.runSync(
            `INSERT INTO section_exercises
             (uuid, section_id, exercise_id, target_sets, target_reps, target_weight,
              target_duration, target_distance, sort_order, notes, set_scheme, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            seUuid,
            sId,
            exerciseId,
            ex.target_sets ?? null,
            ex.target_reps ?? null,
            ex.target_weight ?? null,
            null,
            null,
            ei + 1,
            null,
            ex.set_scheme ? JSON.stringify(ex.set_scheme) : null,
            now,
            now
          );
        }
      }
    }
  }
}
