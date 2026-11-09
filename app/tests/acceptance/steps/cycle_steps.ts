// Step definitions for cycle scenarios.

import { Given, When, Then, DataTable } from "@cucumber/cucumber";
import assert from "node:assert/strict";
import type { CompoundWorld } from "./world";
import {
  createCycle,
  getCycleByUUID,
  getCycleWithSessions,
  listActiveCycles,
  updateCycleStatus,
} from "../../../db/repositories/cycle_repository";
import {
  createProgram,
  addWorkout,
  addSection,
  addSectionExercise,
} from "../../../db/repositories/program_repository";
import { createExercise } from "../../../db/repositories/exercise_repository";

// ---------------------------------------------------------------------------
// Shared setup — create a program with workouts (each gets a section + exercise)
// ---------------------------------------------------------------------------

Given(
  "a program {string} with workouts:",
  function (this: CompoundWorld, _name: string, table: DataTable) {
    // Create a generic exercise to use in every section
    const exercise = createExercise({ name: "Bench Press", muscle_group: "chest" });
    this.lastExerciseUuid = exercise.uuid;
    this.exerciseUuids["Bench Press"] = exercise.uuid;

    // Create the program
    const program = createProgram({ name: _name });
    this.lastProgramUuid = program.uuid;

    // Add each workout from the table, with a section and exercise
    const rows = table.hashes();
    for (let i = 0; i < rows.length; i++) {
      const updated = addWorkout(program.uuid, {
        name: rows[i].name,
        day_number: i + 1,
      });

      // Find the workout we just added (last one in the list)
      const workout = updated.workouts[updated.workouts.length - 1];
      const withSection = addSection(program.uuid, workout.uuid, {
        name: "Main",
      });

      // Find the section we just added
      const section = withSection.workouts[i].sections[0];
      addSectionExercise(program.uuid, section.uuid, {
        exercise_uuid: exercise.uuid,
        target_sets: 3,
        target_reps: 8,
        target_weight: 100,
      });
    }
  }
);

// ---------------------------------------------------------------------------
// Cycle steps
// ---------------------------------------------------------------------------

// Registered as Given so it can be used in both Given and When contexts.
// Cucumber-js matches step text regardless of keyword.
Given(
  "I start a cycle for program {string}",
  function (this: CompoundWorld, _name: string) {
    const cycle = createCycle(this.lastProgramUuid);
    this.lastCycleUuid = cycle.uuid;
    // Store session UUIDs for later use
    this.sessionUuids = cycle.sessions.map((s) => s.uuid);
  }
);

Then(
  "the cycle status should be {string}",
  function (this: CompoundWorld, status: string) {
    const cycle = getCycleByUUID(this.lastCycleUuid);
    assert.equal(cycle.status, status);
  }
);

Then(
  "the cycle should have {int} pending sessions",
  function (this: CompoundWorld, count: number) {
    const cycle = getCycleWithSessions(this.lastCycleUuid);
    assert.equal(cycle.sessions.length, count);
    for (const s of cycle.sessions) {
      assert.equal(s.status, "pending");
    }
  }
);

Then(
  "listing active cycles should return {int} cycle(s)",
  function (this: CompoundWorld, count: number) {
    const cycles = listActiveCycles();
    assert.equal(cycles.length, count);
  }
);

When("I pause the cycle", function (this: CompoundWorld) {
  updateCycleStatus(this.lastCycleUuid, "paused");
});

When("I resume the cycle", function (this: CompoundWorld) {
  updateCycleStatus(this.lastCycleUuid, "active");
});

When("I complete the cycle", function (this: CompoundWorld) {
  updateCycleStatus(this.lastCycleUuid, "completed");
});

When(
  "I try to start a cycle for a non-existent program",
  function (this: CompoundWorld) {
    try {
      createCycle("00000000-0000-0000-0000-000000000000");
    } catch (err) {
      this.lastError = err as Error;
    }
  }
);

Then("it should fail with a NotFoundError", function (this: CompoundWorld) {
  assert.ok(this.lastError, "Expected an error to be thrown");
  assert.equal(this.lastError.name, "NotFoundError");
});
