import { setupTestDB, TestDatabase } from "./testDatabase";

jest.mock("../../lib/uuid", () => ({
  uuid: () => require("crypto").randomUUID(),
}));

import {
  createProgram,
  getProgramDetail,
  listPrograms,
  updateProgram,
  softDeleteProgram,
  copyProgram,
  addWorkout,
  addSection,
  addSectionExercise,
  deleteWorkout,
  deleteSection,
  deleteSectionExercise,
} from "../../db/repositories/program_repository";
import { createExercise } from "../../db/repositories/exercise_repository";
import { NotFoundError } from "../../domain/errors";

let db: TestDatabase;

beforeEach(() => {
  db = setupTestDB();
});

afterEach(() => {
  db.close();
  jest.restoreAllMocks();
});

// Helper: create an exercise and return its UUID
function seedExercise(name: string = "Bench Press"): string {
  return createExercise({ name, muscle_group: "chest", equipment: "barbell" }).uuid;
}

// Helper: build a full program tree and return its UUID
function buildProgramTree() {
  const exUuid = seedExercise();
  const prog = createProgram({ name: "Test Program", description: "desc" });
  const p2 = addWorkout(prog.uuid, { name: "Day 1", day_number: 1 });
  const workoutUuid = p2.workouts[0].uuid;
  const p3 = addSection(prog.uuid, workoutUuid, { name: "Main", rest_seconds: 90 });
  const sectionUuid = p3.workouts[0].sections[0].uuid;
  addSectionExercise(prog.uuid, sectionUuid, {
    exercise_uuid: exUuid,
    target_sets: 3,
    target_reps: 5,
    target_weight: 100,
  });
  return { programUuid: prog.uuid, workoutUuid, sectionUuid, exerciseUuid: exUuid };
}

// ---------------------------------------------------------------------------
// createProgram
// ---------------------------------------------------------------------------

describe("createProgram", () => {
  it("creates a program with name and description", () => {
    const p = createProgram({ name: "PPL", description: "Push Pull Legs" });
    expect(p.uuid).toBeDefined();
    expect(p.name).toBe("PPL");
    expect(p.description).toBe("Push Pull Legs");
    expect(p.is_prebuilt).toBe(false);
    expect(p.workouts).toEqual([]);
  });

  it("creates a program with null description", () => {
    const p = createProgram({ name: "Minimal" });
    expect(p.description).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// getProgramDetail
// ---------------------------------------------------------------------------

describe("getProgramDetail", () => {
  it("returns full tree (workouts -> sections -> exercises)", () => {
    const { programUuid } = buildProgramTree();
    const p = getProgramDetail(programUuid);

    expect(p.name).toBe("Test Program");
    expect(p.workouts.length).toBe(1);
    expect(p.workouts[0].name).toBe("Day 1");
    expect(p.workouts[0].sections.length).toBe(1);
    expect(p.workouts[0].sections[0].name).toBe("Main");
    expect(p.workouts[0].sections[0].rest_seconds).toBe(90);
    expect(p.workouts[0].sections[0].exercises.length).toBe(1);

    const se = p.workouts[0].sections[0].exercises[0];
    expect(se.exercise_name).toBe("Bench Press");
    expect(se.target_sets).toBe(3);
    expect(se.target_reps).toBe(5);
    expect(se.target_weight).toBe(100);
  });

  it("throws NotFoundError for missing UUID", () => {
    expect(() => getProgramDetail("nonexistent")).toThrow(NotFoundError);
  });
});

// ---------------------------------------------------------------------------
// listPrograms
// ---------------------------------------------------------------------------

describe("listPrograms", () => {
  it("returns list with workout_count", () => {
    const p = createProgram({ name: "PPL" });
    addWorkout(p.uuid, { name: "Day 1", day_number: 1 });
    addWorkout(p.uuid, { name: "Day 2", day_number: 2 });

    const list = listPrograms();
    expect(list.length).toBe(1);
    expect(list[0].name).toBe("PPL");
    expect(list[0].workout_count).toBe(2);
    expect(list[0].is_prebuilt).toBe(false);
    expect(list[0].has_active_cycle).toBe(false);
  });

  it("excludes soft-deleted programs", () => {
    const p = createProgram({ name: "Delete Me" });
    softDeleteProgram(p.uuid);
    expect(listPrograms().length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// updateProgram
// ---------------------------------------------------------------------------

describe("updateProgram", () => {
  it("updates name", () => {
    const p = createProgram({ name: "Old Name" });
    const updated = updateProgram(p.uuid, { name: "New Name" });
    expect(updated.name).toBe("New Name");
  });

  it("updates description", () => {
    const p = createProgram({ name: "P", description: "old" });
    const updated = updateProgram(p.uuid, { description: "new desc" });
    expect(updated.description).toBe("new desc");
  });

  it("throws NotFoundError for missing UUID", () => {
    expect(() => updateProgram("nonexistent", { name: "X" })).toThrow(NotFoundError);
  });
});

// ---------------------------------------------------------------------------
// softDeleteProgram
// ---------------------------------------------------------------------------

describe("softDeleteProgram", () => {
  it("soft-deletes a program", () => {
    const p = createProgram({ name: "Delete Me" });
    softDeleteProgram(p.uuid);
    expect(() => getProgramDetail(p.uuid)).toThrow(NotFoundError);
  });

  it("throws NotFoundError for missing UUID", () => {
    expect(() => softDeleteProgram("nonexistent")).toThrow(NotFoundError);
  });
});

// ---------------------------------------------------------------------------
// copyProgram
// ---------------------------------------------------------------------------

describe("copyProgram", () => {
  it("deep copies with new UUIDs", () => {
    const { programUuid } = buildProgramTree();
    const original = getProgramDetail(programUuid);
    const copy = copyProgram(programUuid);

    // Name has (Copy) suffix
    expect(copy.name).toBe("Test Program (Copy)");

    // New UUID
    expect(copy.uuid).not.toBe(original.uuid);

    // Same tree structure
    expect(copy.workouts.length).toBe(1);
    expect(copy.workouts[0].sections.length).toBe(1);
    expect(copy.workouts[0].sections[0].exercises.length).toBe(1);

    // Different UUIDs at each level
    expect(copy.workouts[0].uuid).not.toBe(original.workouts[0].uuid);
    expect(copy.workouts[0].sections[0].uuid).not.toBe(original.workouts[0].sections[0].uuid);
    expect(copy.workouts[0].sections[0].exercises[0].uuid).not.toBe(
      original.workouts[0].sections[0].exercises[0].uuid
    );

    // Same exercise reference
    expect(copy.workouts[0].sections[0].exercises[0].exercise_name).toBe("Bench Press");
  });
});

// ---------------------------------------------------------------------------
// addWorkout / deleteWorkout
// ---------------------------------------------------------------------------

describe("addWorkout", () => {
  it("adds a workout to a program", () => {
    const p = createProgram({ name: "P" });
    const updated = addWorkout(p.uuid, { name: "Leg Day", day_number: 1 });
    expect(updated.workouts.length).toBe(1);
    expect(updated.workouts[0].name).toBe("Leg Day");
    expect(updated.workouts[0].day_number).toBe(1);
  });

  it("throws NotFoundError for missing program", () => {
    expect(() => addWorkout("nonexistent", { name: "X", day_number: 1 })).toThrow(NotFoundError);
  });
});

describe("deleteWorkout", () => {
  it("deletes a workout from a program", () => {
    const p = createProgram({ name: "P" });
    const p2 = addWorkout(p.uuid, { name: "Day 1", day_number: 1 });
    const workoutUuid = p2.workouts[0].uuid;

    const updated = deleteWorkout(p.uuid, workoutUuid);
    expect(updated.workouts.length).toBe(0);
  });

  it("throws NotFoundError for missing workout", () => {
    const p = createProgram({ name: "P" });
    expect(() => deleteWorkout(p.uuid, "nonexistent")).toThrow(NotFoundError);
  });
});

// ---------------------------------------------------------------------------
// addSection / deleteSection
// ---------------------------------------------------------------------------

describe("addSection", () => {
  it("adds a section to a workout", () => {
    const p = createProgram({ name: "P" });
    const p2 = addWorkout(p.uuid, { name: "Day 1", day_number: 1 });
    const wUuid = p2.workouts[0].uuid;

    const updated = addSection(p.uuid, wUuid, { name: "Warm-up", rest_seconds: 60 });
    expect(updated.workouts[0].sections.length).toBe(1);
    expect(updated.workouts[0].sections[0].name).toBe("Warm-up");
    expect(updated.workouts[0].sections[0].rest_seconds).toBe(60);
  });

  it("throws NotFoundError for missing workout", () => {
    const p = createProgram({ name: "P" });
    expect(() => addSection(p.uuid, "nonexistent", { name: "S" })).toThrow(NotFoundError);
  });
});

describe("deleteSection", () => {
  it("deletes a section from a workout", () => {
    const p = createProgram({ name: "P" });
    const p2 = addWorkout(p.uuid, { name: "Day 1", day_number: 1 });
    const wUuid = p2.workouts[0].uuid;
    const p3 = addSection(p.uuid, wUuid, { name: "Main" });
    const sUuid = p3.workouts[0].sections[0].uuid;

    const updated = deleteSection(p.uuid, sUuid);
    expect(updated.workouts[0].sections.length).toBe(0);
  });

  it("throws NotFoundError for missing section", () => {
    const p = createProgram({ name: "P" });
    expect(() => deleteSection(p.uuid, "nonexistent")).toThrow(NotFoundError);
  });
});

// ---------------------------------------------------------------------------
// addSectionExercise / deleteSectionExercise
// ---------------------------------------------------------------------------

describe("addSectionExercise", () => {
  it("adds an exercise to a section", () => {
    const exUuid = seedExercise();
    const p = createProgram({ name: "P" });
    const p2 = addWorkout(p.uuid, { name: "Day 1", day_number: 1 });
    const wUuid = p2.workouts[0].uuid;
    const p3 = addSection(p.uuid, wUuid, { name: "Main" });
    const sUuid = p3.workouts[0].sections[0].uuid;

    const updated = addSectionExercise(p.uuid, sUuid, {
      exercise_uuid: exUuid,
      target_sets: 4,
      target_reps: 8,
      target_weight: 135,
    });

    const se = updated.workouts[0].sections[0].exercises[0];
    expect(se.exercise_name).toBe("Bench Press");
    expect(se.target_sets).toBe(4);
    expect(se.target_reps).toBe(8);
    expect(se.target_weight).toBe(135);
  });

  it("throws NotFoundError for missing section", () => {
    const exUuid = seedExercise();
    const p = createProgram({ name: "P" });
    expect(() =>
      addSectionExercise(p.uuid, "nonexistent", {
        exercise_uuid: exUuid,
        target_sets: 3,
      })
    ).toThrow(NotFoundError);
  });

  it("throws NotFoundError for missing exercise", () => {
    const p = createProgram({ name: "P" });
    const p2 = addWorkout(p.uuid, { name: "Day 1", day_number: 1 });
    const wUuid = p2.workouts[0].uuid;
    const p3 = addSection(p.uuid, wUuid, { name: "Main" });
    const sUuid = p3.workouts[0].sections[0].uuid;

    expect(() =>
      addSectionExercise(p.uuid, sUuid, {
        exercise_uuid: "nonexistent",
        target_sets: 3,
      })
    ).toThrow(NotFoundError);
  });
});

describe("deleteSectionExercise", () => {
  it("deletes an exercise from a section", () => {
    const { programUuid } = buildProgramTree();
    const p = getProgramDetail(programUuid);
    const seUuid = p.workouts[0].sections[0].exercises[0].uuid;

    const updated = deleteSectionExercise(programUuid, seUuid);
    expect(updated.workouts[0].sections[0].exercises.length).toBe(0);
  });

  it("throws NotFoundError for missing section_exercise", () => {
    const p = createProgram({ name: "P" });
    expect(() => deleteSectionExercise(p.uuid, "nonexistent")).toThrow(NotFoundError);
  });
});
