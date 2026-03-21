// Step definitions for program management scenarios.
//
// Uses lazy require() inside step functions so modules are loaded after
// the Before hook has set up the test database mock. The createRequire
// call is needed because cucumber-js v11 runs step files as ESM.

import { Given, When, Then } from "@cucumber/cucumber";
import { createRequire } from "node:module";
import crypto from "node:crypto";
import assert from "node:assert/strict";
import type { CompoundWorld } from "./world";

const require = createRequire(import.meta.url);

// ---------------------------------------------------------------------------
// Stash for cross-step references within a scenario
// ---------------------------------------------------------------------------

let workoutUuids: Record<string, string> = {};
let sectionUuids: Record<string, string> = {};
let copiedProgramUuid = "";
let originalProgramUuid = "";
let programList: { uuid: string; name: string; workout_count: number }[] = [];

// ---------------------------------------------------------------------------
// Helper — lazy-load repositories
// ---------------------------------------------------------------------------

function programRepo() {
  return require("../../../db/repositories/program_repository");
}

function exerciseRepo() {
  return require("../../../db/repositories/exercise_repository");
}

// ---------------------------------------------------------------------------
// Shared Given — create prerequisite exercises
// ---------------------------------------------------------------------------

Given(
  "the following exercises exist:",
  function (this: CompoundWorld, table: any) {
    const { createExercise } = exerciseRepo();
    for (const row of table.hashes()) {
      const created = createExercise({
        name: row.name,
        muscle_group: row.muscle_group || null,
        equipment: row.equipment || null,
        tracking_type: row.tracking_type || "weight_reps",
      });
      this.exerciseUuids[created.name] = created.uuid;
    }
  }
);

// ---------------------------------------------------------------------------
// Program creation
// ---------------------------------------------------------------------------

Given(
  "I create a program with name {string} and description {string}",
  function (this: CompoundWorld, name: string, description: string) {
    const prog = programRepo().createProgram({ name, description });
    this.lastProgramUuid = prog.uuid;
    workoutUuids = {};
    sectionUuids = {};
  }
);

Then("the program {string} should exist", function (this: CompoundWorld, name: string) {
  const prog = programRepo().getProgramDetail(this.lastProgramUuid);
  assert.equal(prog.name, name);
});

Then(
  "the program description should be {string}",
  function (this: CompoundWorld, description: string) {
    const prog = programRepo().getProgramDetail(this.lastProgramUuid);
    assert.equal(prog.description, description);
  }
);

// ---------------------------------------------------------------------------
// Workouts
// ---------------------------------------------------------------------------

Given(
  "I add a workout {string} with day number {int} to the program",
  function (this: CompoundWorld, name: string, dayNumber: number) {
    const prog = programRepo().addWorkout(this.lastProgramUuid, {
      name,
      day_number: dayNumber,
    });
    const workout = prog.workouts.find((w: any) => w.name === name);
    if (workout) workoutUuids[name] = workout.uuid;
  }
);

When(
  "I delete workout {string} from the program",
  function (this: CompoundWorld, name: string) {
    const workoutUuid = workoutUuids[name];
    assert.ok(workoutUuid, `No stashed UUID for workout "${name}"`);
    programRepo().deleteWorkout(this.lastProgramUuid, workoutUuid);
  }
);

// ---------------------------------------------------------------------------
// Sections
// ---------------------------------------------------------------------------

Given(
  "I add a section {string} to workout {string}",
  function (this: CompoundWorld, sectionName: string, workoutName: string) {
    const workoutUuid = workoutUuids[workoutName];
    assert.ok(workoutUuid, `No stashed UUID for workout "${workoutName}"`);
    const prog = programRepo().addSection(this.lastProgramUuid, workoutUuid, {
      name: sectionName,
    });
    const workout = prog.workouts.find((w: any) => w.name === workoutName);
    const section = workout?.sections.find((s: any) => s.name === sectionName);
    if (section) sectionUuids[sectionName] = section.uuid;
  }
);

When(
  "I delete section {string} from the program",
  function (this: CompoundWorld, sectionName: string) {
    const sectionUuid = sectionUuids[sectionName];
    assert.ok(sectionUuid, `No stashed UUID for section "${sectionName}"`);
    programRepo().deleteSection(this.lastProgramUuid, sectionUuid);
  }
);

// ---------------------------------------------------------------------------
// Section exercises
// ---------------------------------------------------------------------------

Given(
  "I add exercise {string} to section {string} with {int} sets, {int} reps, {int} weight",
  function (
    this: CompoundWorld,
    exerciseName: string,
    sectionName: string,
    sets: number,
    reps: number,
    weight: number
  ) {
    const sectionUuid = sectionUuids[sectionName];
    assert.ok(sectionUuid, `No stashed UUID for section "${sectionName}"`);
    const exerciseUuid = this.exerciseUuids[exerciseName];
    assert.ok(exerciseUuid, `No stashed UUID for exercise "${exerciseName}"`);
    programRepo().addSectionExercise(this.lastProgramUuid, sectionUuid, {
      exercise_uuid: exerciseUuid,
      target_sets: sets,
      target_reps: reps,
      target_weight: weight,
    });
  }
);

// ---------------------------------------------------------------------------
// Program detail assertions
// ---------------------------------------------------------------------------

When("I get the program detail", function (this: CompoundWorld) {
  // no-op — assertions fetch the detail themselves
});

Then(
  "the program should have {int} workout(s)",
  function (this: CompoundWorld, count: number) {
    const prog = programRepo().getProgramDetail(this.lastProgramUuid);
    assert.equal(prog.workouts.length, count);
  }
);

Then(
  "workout {string} should have {int} section(s)",
  function (this: CompoundWorld, workoutName: string, count: number) {
    const prog = programRepo().getProgramDetail(this.lastProgramUuid);
    const workout = prog.workouts.find((w: any) => w.name === workoutName);
    assert.ok(workout, `Workout "${workoutName}" not found`);
    assert.equal(workout.sections.length, count);
  }
);

Then(
  "section {string} should have {int} exercise(s)",
  function (this: CompoundWorld, sectionName: string, count: number) {
    const prog = programRepo().getProgramDetail(this.lastProgramUuid);
    let found = false;
    for (const w of prog.workouts) {
      const section = w.sections.find((s: any) => s.name === sectionName);
      if (section) {
        assert.equal(section.exercises.length, count);
        found = true;
        break;
      }
    }
    assert.ok(found, `Section "${sectionName}" not found`);
  }
);

Then(
  "the exercise should be {string} with {int} sets, {int} reps, {int} weight",
  function (
    this: CompoundWorld,
    exerciseName: string,
    sets: number,
    reps: number,
    weight: number
  ) {
    const prog = programRepo().getProgramDetail(this.lastProgramUuid);
    let found = false;
    for (const w of prog.workouts) {
      for (const s of w.sections) {
        for (const se of s.exercises) {
          if (se.exercise_name === exerciseName) {
            assert.equal(se.target_sets, sets);
            assert.equal(se.target_reps, reps);
            assert.equal(se.target_weight, weight);
            found = true;
          }
        }
      }
    }
    assert.ok(found, `Exercise "${exerciseName}" not found in program tree`);
  }
);

// ---------------------------------------------------------------------------
// List programs
// ---------------------------------------------------------------------------

When("I list programs", function (this: CompoundWorld) {
  programList = programRepo().listPrograms();
});

Then(
  "the program list should contain {string} with workout count {int}",
  function (this: CompoundWorld, name: string, count: number) {
    const entry = programList.find((p: any) => p.name === name);
    assert.ok(entry, `Program "${name}" not found in list`);
    assert.equal(entry.workout_count, count);
  }
);

Then(
  "the program list should not contain {string}",
  function (this: CompoundWorld, name: string) {
    const entry = programList.find((p: any) => p.name === name);
    assert.equal(entry, undefined, `Program "${name}" should not be in list`);
  }
);

// ---------------------------------------------------------------------------
// Copy program
// ---------------------------------------------------------------------------

When("I copy the program", function (this: CompoundWorld) {
  originalProgramUuid = this.lastProgramUuid;
  const copy = programRepo().copyProgram(this.lastProgramUuid);
  copiedProgramUuid = copy.uuid;
  this.lastProgramUuid = copy.uuid;
});

Then(
  "the copied program name should be {string}",
  function (this: CompoundWorld, name: string) {
    const prog = programRepo().getProgramDetail(copiedProgramUuid);
    assert.equal(prog.name, name);
  }
);

Then(
  "the copied program UUID should differ from the original",
  function (this: CompoundWorld) {
    assert.notEqual(copiedProgramUuid, originalProgramUuid);
  }
);

Then(
  "the copied program should have {int} workout(s)",
  function (this: CompoundWorld, count: number) {
    const prog = programRepo().getProgramDetail(copiedProgramUuid);
    assert.equal(prog.workouts.length, count);
  }
);

Then(
  "the copied workout UUIDs should differ from the original",
  function (this: CompoundWorld) {
    const original = programRepo().getProgramDetail(originalProgramUuid);
    const copy = programRepo().getProgramDetail(copiedProgramUuid);
    for (let i = 0; i < original.workouts.length; i++) {
      assert.notEqual(copy.workouts[i].uuid, original.workouts[i].uuid);
    }
  }
);

// ---------------------------------------------------------------------------
// Prebuilt program + copy
// ---------------------------------------------------------------------------

Given(
  "a prebuilt program {string} exists",
  function (this: CompoundWorld, name: string) {
    const db = this.db;
    const now = new Date().toISOString();
    const programUuid = crypto.randomUUID();
    db.runSync(
      `INSERT INTO programs (uuid, name, description, is_prebuilt, created_at, updated_at)
       VALUES (?, ?, ?, 1, ?, ?)`,
      programUuid,
      name,
      null,
      now,
      now
    );
    this.lastProgramUuid = programUuid;
  }
);

When("I copy the prebuilt program", function (this: CompoundWorld) {
  originalProgramUuid = this.lastProgramUuid;
  const copy = programRepo().copyProgram(this.lastProgramUuid);
  copiedProgramUuid = copy.uuid;
  this.lastProgramUuid = copy.uuid;
});

Then("the copied program should not be prebuilt", function (this: CompoundWorld) {
  const prog = programRepo().getProgramDetail(copiedProgramUuid);
  assert.equal(prog.is_prebuilt, false);
});

// ---------------------------------------------------------------------------
// Delete program
// ---------------------------------------------------------------------------

When("I delete the program", function (this: CompoundWorld) {
  programRepo().softDeleteProgram(this.lastProgramUuid);
});

Then(
  "getting the program detail should raise a not found error",
  function (this: CompoundWorld) {
    assert.throws(
      () => programRepo().getProgramDetail(this.lastProgramUuid),
      (err: any) => err.constructor.name === "NotFoundError"
    );
  }
);
