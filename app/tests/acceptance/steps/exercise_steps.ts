// Step definitions for exercise management scenarios.

import { When, Then } from "@cucumber/cucumber";
import assert from "node:assert/strict";
import type { CompoundWorld } from "./world";
import {
  createExercise,
  getExercise,
  listExercises,
  updateExercise,
  softDeleteExercise,
} from "../../../db/repositories/exercise_repository";

// ---------------------------------------------------------------------------
// Shared state for the current scenario
// ---------------------------------------------------------------------------

let lastExerciseList: any[] = [];

// ---------------------------------------------------------------------------
// When
// ---------------------------------------------------------------------------

When(
  "I create an exercise with:",
  function (this: CompoundWorld, table: any) {
    const [row] = table.hashes();
    const created = createExercise({
      name: row.name,
      muscle_group: row.muscle_group || null,
      equipment: row.equipment || null,
      tracking_type: row.tracking_type || "weight_reps",
    });
    this.exerciseUuids[created.name] = created.uuid;
    this.lastExerciseUuid = created.uuid;
  }
);

When(
  "I try to create an exercise with:",
  function (this: CompoundWorld, table: any) {
    const [row] = table.hashes();
    try {
      createExercise({
        name: row.name,
        muscle_group: row.muscle_group || null,
        equipment: row.equipment || null,
        tracking_type: row.tracking_type || "weight_reps",
      });
    } catch (err) {
      this.lastError = err as Error;
    }
  }
);

When("I list all exercises", function (this: CompoundWorld) {
  lastExerciseList = listExercises();
});

When(
  "I list exercises filtered by muscle_group {string}",
  function (this: CompoundWorld, muscleGroup: string) {
    lastExerciseList = listExercises({ muscle_group: muscleGroup });
  }
);

When(
  "I search exercises for {string}",
  function (this: CompoundWorld, search: string) {
    lastExerciseList = listExercises({ search });
  }
);

When(
  "I update the exercise {string} with name {string}",
  function (this: CompoundWorld, oldName: string, newName: string) {
    const uuid = this.exerciseUuids[oldName];
    assert.ok(uuid, `No UUID stored for exercise "${oldName}"`);
    const updated = updateExercise(uuid, { name: newName });
    this.exerciseUuids[newName] = updated.uuid;
  }
);

When(
  "I delete the exercise {string}",
  function (this: CompoundWorld, name: string) {
    const uuid = this.exerciseUuids[name];
    assert.ok(uuid, `No UUID stored for exercise "${name}"`);
    softDeleteExercise(uuid);
  }
);

When(
  "I try to get the exercise {string}",
  function (this: CompoundWorld, name: string) {
    const uuid = this.exerciseUuids[name];
    assert.ok(uuid, `No UUID stored for exercise "${name}"`);
    try {
      getExercise(uuid);
    } catch (err) {
      this.lastError = err as Error;
    }
  }
);

// ---------------------------------------------------------------------------
// Then
// ---------------------------------------------------------------------------

Then(
  "the exercise {string} should exist",
  function (this: CompoundWorld, name: string) {
    const uuid = this.exerciseUuids[name];
    assert.ok(uuid, `No UUID stored for exercise "${name}"`);
    const exercise = getExercise(uuid);
    assert.equal(exercise.name, name);
  }
);

Then(
  "the exercise {string} should have muscle_group {string}",
  function (this: CompoundWorld, name: string, expected: string) {
    const uuid = this.exerciseUuids[name];
    assert.ok(uuid, `No UUID stored for exercise "${name}"`);
    const exercise = getExercise(uuid);
    assert.equal(exercise.muscle_group, expected);
  }
);

Then(
  "the exercise {string} should have equipment {string}",
  function (this: CompoundWorld, name: string, expected: string) {
    const uuid = this.exerciseUuids[name];
    assert.ok(uuid, `No UUID stored for exercise "${name}"`);
    const exercise = getExercise(uuid);
    assert.equal(exercise.equipment, expected);
  }
);

Then(
  "the exercise {string} should have tracking_type {string}",
  function (this: CompoundWorld, name: string, expected: string) {
    const uuid = this.exerciseUuids[name];
    assert.ok(uuid, `No UUID stored for exercise "${name}"`);
    const exercise = getExercise(uuid);
    assert.equal(exercise.tracking_type, expected);
  }
);

Then(
  "the exercise {string} should be custom",
  function (this: CompoundWorld, name: string) {
    const uuid = this.exerciseUuids[name];
    assert.ok(uuid, `No UUID stored for exercise "${name}"`);
    const exercise = getExercise(uuid);
    assert.equal(exercise.is_custom, true);
  }
);

Then(
  "I should see {int} exercise(s)",
  function (this: CompoundWorld, count: number) {
    assert.equal(
      lastExerciseList.length,
      count,
      `Expected ${count} exercises but got ${lastExerciseList.length}`
    );
  }
);

Then(
  "the exercise list should include {string}",
  function (this: CompoundWorld, name: string) {
    const found = lastExerciseList.some((e: any) => e.name === name);
    assert.ok(found, `Expected exercise list to include "${name}"`);
  }
);

Then(
  "the exercise list should not include {string}",
  function (this: CompoundWorld, name: string) {
    const found = lastExerciseList.some((e: any) => e.name === name);
    assert.ok(!found, `Expected exercise list NOT to include "${name}"`);
  }
);

Then(
  "I should see a validation error for {string}",
  function (this: CompoundWorld, field: string) {
    assert.ok(this.lastError, "Expected an error but none was thrown");
    assert.equal(this.lastError.name, "ValidationError");
    assert.equal(
      (this.lastError as Error & { field: string }).field,
      field
    );
  }
);

Then(
  "I should see a not found error",
  function (this: CompoundWorld) {
    assert.ok(this.lastError, "Expected an error but none was thrown");
    assert.equal(this.lastError.name, "NotFoundError");
  }
);
