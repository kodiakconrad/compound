import {
  validateProgram,
  validateWorkout,
  validateSection,
  validateSectionExercise,
  validateSetScheme,
  deepCopyProgram,
} from "../program";
import type { Program, SetScheme } from "../program";

describe("validateProgram", () => {
  it("accepts valid program", () => {
    expect(validateProgram({ name: "PPL" })).toBeNull();
  });

  it("rejects empty name", () => {
    expect(validateProgram({ name: "" })).not.toBeNull();
  });
});

describe("validateWorkout", () => {
  it("accepts valid workout", () => {
    expect(validateWorkout({ name: "Push", day_number: 1 })).toBeNull();
  });

  it("rejects day_number < 1", () => {
    expect(validateWorkout({ name: "Push", day_number: 0 })).not.toBeNull();
  });

  it("rejects empty name", () => {
    expect(validateWorkout({ name: "", day_number: 1 })).not.toBeNull();
  });
});

describe("validateSection", () => {
  it("accepts valid section", () => {
    expect(validateSection({ name: "Compound" })).toBeNull();
  });

  it("rejects empty name", () => {
    expect(validateSection({ name: "" })).not.toBeNull();
  });
});

describe("validateSectionExercise", () => {
  it("accepts exercise with target_sets", () => {
    expect(
      validateSectionExercise({ exercise_id: 1, target_sets: 3 })
    ).toBeNull();
  });

  it("rejects exercise_id 0", () => {
    expect(
      validateSectionExercise({ exercise_id: 0, target_sets: 3 })
    ).not.toBeNull();
  });

  it("rejects no targets at all", () => {
    expect(
      validateSectionExercise({ exercise_id: 1 })
    ).not.toBeNull();
  });

  it("accepts exercise with set_scheme", () => {
    const scheme: SetScheme = {
      type: "pyramid",
      sets: [{ reps: 5, weight: 100 }],
    };
    expect(
      validateSectionExercise({ exercise_id: 1, set_scheme: scheme })
    ).toBeNull();
  });
});

describe("validateSetScheme", () => {
  it("accepts valid pyramid", () => {
    expect(
      validateSetScheme({
        type: "pyramid",
        sets: [
          { reps: 5, weight: 100 },
          { reps: 8, weight: 80 },
        ],
      })
    ).toBeNull();
  });

  it("rejects empty sets", () => {
    expect(
      validateSetScheme({ type: "pyramid", sets: [] })
    ).not.toBeNull();
  });

  it("rejects set with reps < 1", () => {
    expect(
      validateSetScheme({ type: "pyramid", sets: [{ reps: 0, weight: 100 }] })
    ).not.toBeNull();
  });

  it("rejects set with negative weight", () => {
    expect(
      validateSetScheme({ type: "pyramid", sets: [{ reps: 5, weight: -1 }] })
    ).not.toBeNull();
  });

  it("requires week for 531", () => {
    expect(
      validateSetScheme({ type: "531", sets: [{ reps: 5, weight: 100 }] })
    ).not.toBeNull();
  });

  it("accepts valid 531 with week", () => {
    expect(
      validateSetScheme({
        type: "531",
        sets: [{ reps: 5, weight: 100 }],
        week: 1,
      })
    ).toBeNull();
  });
});

describe("deepCopyProgram", () => {
  const original: Program = {
    id: 1,
    uuid: "orig-uuid",
    name: "PPL",
    description: "Push Pull Legs",
    is_prebuilt: true,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    deleted_at: null,
    workouts: [
      {
        id: 10,
        uuid: "w-uuid",
        program_id: 1,
        name: "Push",
        day_number: 1,
        sort_order: 1,
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
        sections: [
          {
            id: 20,
            uuid: "s-uuid",
            program_workout_id: 10,
            name: "Compound",
            sort_order: 1,
            rest_seconds: 180,
            created_at: "2026-01-01T00:00:00Z",
            updated_at: "2026-01-01T00:00:00Z",
            exercises: [
              {
                id: 30,
                uuid: "se-uuid",
                section_id: 20,
                exercise_id: 5,
                exercise_uuid: "ex-uuid",
                exercise_name: "Bench Press",
                exercise_tracking_type: "weight_reps",
                target_sets: 3,
                target_reps: 5,
                target_weight: 80,
                target_duration: null,
                target_distance: null,
                sort_order: 1,
                notes: null,
                set_scheme: null,
                progression_rule: {
                  id: 40,
                  uuid: "pr-uuid",
                  section_exercise_id: 30,
                  strategy: "linear",
                  increment: 2.5,
                  increment_pct: null,
                  deload_threshold: 3,
                  deload_pct: 10,
                  created_at: "2026-01-01T00:00:00Z",
                  updated_at: "2026-01-01T00:00:00Z",
                },
                created_at: "2026-01-01T00:00:00Z",
                updated_at: "2026-01-01T00:00:00Z",
              },
            ],
          },
        ],
      },
    ],
  };

  it("creates new UUIDs for all nodes", () => {
    const copy = deepCopyProgram(original);
    expect(copy.uuid).not.toBe(original.uuid);
    expect(copy.workouts[0].uuid).not.toBe(original.workouts[0].uuid);
    expect(copy.workouts[0].sections[0].uuid).not.toBe(
      original.workouts[0].sections[0].uuid
    );
    expect(copy.workouts[0].sections[0].exercises[0].uuid).not.toBe(
      original.workouts[0].sections[0].exercises[0].uuid
    );
    expect(
      copy.workouts[0].sections[0].exercises[0].progression_rule!.uuid
    ).not.toBe(
      original.workouts[0].sections[0].exercises[0].progression_rule!.uuid
    );
  });

  it("zeroes all integer IDs", () => {
    const copy = deepCopyProgram(original);
    expect(copy.id).toBe(0);
    expect(copy.workouts[0].id).toBe(0);
    expect(copy.workouts[0].sections[0].id).toBe(0);
    expect(copy.workouts[0].sections[0].exercises[0].id).toBe(0);
    expect(
      copy.workouts[0].sections[0].exercises[0].progression_rule!.id
    ).toBe(0);
  });

  it("appends (Copy) to name", () => {
    const copy = deepCopyProgram(original);
    expect(copy.name).toBe("PPL (Copy)");
  });

  it("sets is_prebuilt to false", () => {
    const copy = deepCopyProgram(original);
    expect(copy.is_prebuilt).toBe(false);
  });

  it("preserves exercise_id reference", () => {
    const copy = deepCopyProgram(original);
    expect(copy.workouts[0].sections[0].exercises[0].exercise_id).toBe(5);
  });

  it("preserves data values", () => {
    const copy = deepCopyProgram(original);
    const se = copy.workouts[0].sections[0].exercises[0];
    expect(se.target_sets).toBe(3);
    expect(se.target_reps).toBe(5);
    expect(se.target_weight).toBe(80);
    expect(se.progression_rule!.strategy).toBe("linear");
    expect(se.progression_rule!.increment).toBe(2.5);
  });
});
