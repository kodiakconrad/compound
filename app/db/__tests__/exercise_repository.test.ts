import { setupTestDB, TestDatabase } from "./testDatabase";

// Mock uuid to use Node's built-in crypto (expo-crypto unavailable in Jest)
jest.mock("../../lib/uuid", () => ({
  uuid: () => require("crypto").randomUUID(),
}));

import {
  createExercise,
  getExercise,
  listExercises,
  updateExercise,
  softDeleteExercise,
  getExerciseIdByUUID,
} from "../../db/repositories/exercise_repository";
import { NotFoundError } from "../../domain/errors";

let db: TestDatabase;

beforeEach(() => {
  db = setupTestDB();
});

afterEach(() => {
  db.close();
  jest.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// createExercise
// ---------------------------------------------------------------------------

describe("createExercise", () => {
  it("creates and returns an exercise with a UUID", () => {
    const ex = createExercise({
      name: "Bench Press",
      muscle_group: "chest",
      equipment: "barbell",
    });

    expect(ex.uuid).toBeDefined();
    expect(ex.name).toBe("Bench Press");
    expect(ex.muscle_group).toBe("chest");
    expect(ex.equipment).toBe("barbell");
    expect(ex.tracking_type).toBe("weight_reps");
    expect(ex.is_custom).toBe(true);
    expect(ex.deleted_at).toBeNull();
  });

  it("defaults tracking_type to weight_reps", () => {
    const ex = createExercise({ name: "Squat" });
    expect(ex.tracking_type).toBe("weight_reps");
  });

  it("trims the name", () => {
    const ex = createExercise({ name: "  Deadlift  " });
    expect(ex.name).toBe("Deadlift");
  });

  it("throws ValidationError for empty name", () => {
    expect(() => createExercise({ name: "" })).toThrow("name is required");
  });

  it("throws ValidationError for invalid tracking_type", () => {
    expect(() =>
      createExercise({ name: "Run", tracking_type: "invalid" })
    ).toThrow("invalid tracking type");
  });
});

// ---------------------------------------------------------------------------
// getExercise
// ---------------------------------------------------------------------------

describe("getExercise", () => {
  it("retrieves an exercise by UUID", () => {
    const created = createExercise({ name: "Squat", muscle_group: "legs" });
    const fetched = getExercise(created.uuid);
    expect(fetched.uuid).toBe(created.uuid);
    expect(fetched.name).toBe("Squat");
  });

  it("throws NotFoundError for missing UUID", () => {
    expect(() => getExercise("nonexistent-uuid")).toThrow(NotFoundError);
  });
});

// ---------------------------------------------------------------------------
// listExercises
// ---------------------------------------------------------------------------

describe("listExercises", () => {
  beforeEach(() => {
    createExercise({ name: "Bench Press", muscle_group: "chest", equipment: "barbell" });
    createExercise({ name: "Incline DB Press", muscle_group: "chest", equipment: "dumbbell" });
    createExercise({ name: "Squat", muscle_group: "legs", equipment: "barbell" });
    createExercise({ name: "Plank", muscle_group: "core", equipment: "bodyweight", tracking_type: "duration" });
  });

  it("returns all exercises when no filters", () => {
    const list = listExercises();
    expect(list.length).toBe(4);
  });

  it("filters by muscle_group", () => {
    const list = listExercises({ muscle_group: "chest" });
    expect(list.length).toBe(2);
    expect(list.every((e) => e.muscle_group === "chest")).toBe(true);
  });

  it("filters by equipment", () => {
    const list = listExercises({ equipment: "barbell" });
    expect(list.length).toBe(2);
  });

  it("filters by search term", () => {
    const list = listExercises({ search: "Press" });
    expect(list.length).toBe(2);
  });

  it("combines multiple filters", () => {
    const list = listExercises({ muscle_group: "chest", equipment: "dumbbell" });
    expect(list.length).toBe(1);
    expect(list[0].name).toBe("Incline DB Press");
  });

  it("returns empty array when nothing matches", () => {
    const list = listExercises({ muscle_group: "shoulders" });
    expect(list.length).toBe(0);
  });

  it("orders by name ASC", () => {
    const list = listExercises();
    const names = list.map((e) => e.name);
    expect(names).toEqual([...names].sort());
  });
});

// ---------------------------------------------------------------------------
// updateExercise
// ---------------------------------------------------------------------------

describe("updateExercise", () => {
  it("updates name and fields", () => {
    const ex = createExercise({ name: "Bench Press", muscle_group: "chest" });
    const updated = updateExercise(ex.uuid, {
      name: "Flat Bench Press",
      equipment: "barbell",
    });
    expect(updated.name).toBe("Flat Bench Press");
    expect(updated.equipment).toBe("barbell");
    expect(updated.muscle_group).toBe("chest"); // unchanged
  });

  it("throws NotFoundError for missing UUID", () => {
    expect(() => updateExercise("nonexistent", { name: "X" })).toThrow(NotFoundError);
  });
});

// ---------------------------------------------------------------------------
// softDeleteExercise
// ---------------------------------------------------------------------------

describe("softDeleteExercise", () => {
  it("soft-deletes an exercise (excluded from list and get)", () => {
    const ex = createExercise({ name: "Remove Me" });
    softDeleteExercise(ex.uuid);

    // Should not appear in list
    const list = listExercises();
    expect(list.find((e) => e.uuid === ex.uuid)).toBeUndefined();

    // Should throw NotFoundError on get
    expect(() => getExercise(ex.uuid)).toThrow(NotFoundError);
  });

  it("throws NotFoundError for missing UUID", () => {
    expect(() => softDeleteExercise("nonexistent")).toThrow(NotFoundError);
  });

  it("throws NotFoundError when soft-deleting already-deleted exercise", () => {
    const ex = createExercise({ name: "Delete Twice" });
    softDeleteExercise(ex.uuid);
    expect(() => softDeleteExercise(ex.uuid)).toThrow(NotFoundError);
  });
});

// ---------------------------------------------------------------------------
// getExerciseIdByUUID
// ---------------------------------------------------------------------------

describe("getExerciseIdByUUID", () => {
  it("returns the internal integer ID", () => {
    const ex = createExercise({ name: "Squat" });
    const id = getExerciseIdByUUID(ex.uuid);
    expect(typeof id).toBe("number");
    expect(id).toBeGreaterThan(0);
  });

  it("throws NotFoundError for missing UUID", () => {
    expect(() => getExerciseIdByUUID("nonexistent")).toThrow(NotFoundError);
  });
});
