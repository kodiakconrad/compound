import { validateExercise } from "../exercise";

describe("validateExercise", () => {
  it("accepts valid exercise", () => {
    expect(
      validateExercise({
        name: "Bench Press",
        tracking_type: "weight_reps",
        muscle_group: "chest",
        equipment: "barbell",
      })
    ).toBeNull();
  });

  it("rejects empty name", () => {
    const err = validateExercise({
      name: "",
      tracking_type: "weight_reps",
    });
    expect(err).not.toBeNull();
    expect(err!.field).toBe("name");
  });

  it("rejects whitespace-only name", () => {
    const err = validateExercise({
      name: "   ",
      tracking_type: "weight_reps",
    });
    expect(err).not.toBeNull();
    expect(err!.field).toBe("name");
  });

  it("rejects invalid tracking_type", () => {
    const err = validateExercise({
      name: "Bench Press",
      tracking_type: "invalid",
    });
    expect(err).not.toBeNull();
    expect(err!.field).toBe("tracking_type");
  });

  it("rejects invalid muscle_group", () => {
    const err = validateExercise({
      name: "Bench Press",
      tracking_type: "weight_reps",
      muscle_group: "feet",
    });
    expect(err).not.toBeNull();
    expect(err!.field).toBe("muscle_group");
  });

  it("rejects invalid equipment", () => {
    const err = validateExercise({
      name: "Bench Press",
      tracking_type: "weight_reps",
      equipment: "sword",
    });
    expect(err).not.toBeNull();
    expect(err!.field).toBe("equipment");
  });

  it("accepts null muscle_group and equipment", () => {
    expect(
      validateExercise({
        name: "Bench Press",
        tracking_type: "weight_reps",
        muscle_group: null,
        equipment: null,
      })
    ).toBeNull();
  });

  it("accepts all valid tracking types", () => {
    for (const tt of [
      "weight_reps",
      "bodyweight_reps",
      "duration",
      "distance",
    ]) {
      expect(
        validateExercise({ name: "Test", tracking_type: tt })
      ).toBeNull();
    }
  });
});
