// Step definitions for session and progress scenarios.

import { When, Then, Given } from "@cucumber/cucumber";
import assert from "node:assert/strict";
import type { CompoundWorld } from "./world";
import {
  startSessionByUUID,
  completeSessionByUUID,
  skipSessionByUUID,
  logSet,
  getSessionDetail,
  getActiveSession,
} from "../../../db/repositories/session_repository";
import {
  getProgressSummary,
  getAllPersonalRecords,
  getRecentSessions,
} from "../../../db/repositories/progress_repository";

// ---------------------------------------------------------------------------
// Helper — resolve the section_exercise_uuid for the exercise in a session.
// Needed for logSet calls.
// ---------------------------------------------------------------------------

function getSectionExerciseUuidForSession(sessionUuid: string): string {
  const detail = getSessionDetail(sessionUuid);
  return detail.sections[0].exercises[0].section_exercise_uuid;
}

// ---------------------------------------------------------------------------
// Session state transitions
// ---------------------------------------------------------------------------

// Registered as Given so it works in both Given and When contexts.
Given("I start the first session", function (this: CompoundWorld) {
  this.lastSessionUuid = this.sessionUuids[0];
  startSessionByUUID(this.lastSessionUuid);
});

Then(
  "the session status should be {string}",
  function (this: CompoundWorld, status: string) {
    const detail = getSessionDetail(this.lastSessionUuid);
    assert.equal(detail.status, status);
  }
);

// ---------------------------------------------------------------------------
// Set logging
// ---------------------------------------------------------------------------

// Track set numbers per scenario
let setCounter = 0;

When(
  "I log a set with weight {int} and reps {int}",
  function (this: CompoundWorld, weight: number, reps: number) {
    setCounter++;
    const seUuid = getSectionExerciseUuidForSession(this.lastSessionUuid);
    const setLogResult = logSet(this.lastSessionUuid, {
      section_exercise_uuid: seUuid,
      set_number: setCounter,
      target_reps: reps,
      actual_reps: reps,
      weight,
    });
    this.lastSetLogUuid = setLogResult.uuid;
  }
);

Then("the set log should be recorded", function (this: CompoundWorld) {
  assert.ok(this.lastSetLogUuid, "Expected a set log UUID to be stored");
});

// ---------------------------------------------------------------------------
// Complete / skip
// ---------------------------------------------------------------------------

When("I complete the session", function (this: CompoundWorld) {
  completeSessionByUUID(this.lastSessionUuid);
});

When("I skip the first session", function (this: CompoundWorld) {
  this.lastSessionUuid = this.sessionUuids[0];
  skipSessionByUUID(this.lastSessionUuid);
});

// ---------------------------------------------------------------------------
// Error cases
// ---------------------------------------------------------------------------

When(
  "I try to log a set on the first pending session",
  function (this: CompoundWorld) {
    try {
      // Session is still pending — this should fail
      logSet(this.sessionUuids[0], {
        exercise_uuid: this.lastExerciseUuid,
        set_number: 1,
        actual_reps: 8,
        weight: 100,
      });
    } catch (err) {
      this.lastError = err as Error;
    }
  }
);

Then(
  "it should fail with an UnprocessableError",
  function (this: CompoundWorld) {
    assert.ok(this.lastError, "Expected an error to be thrown");
    assert.equal(this.lastError.name, "UnprocessableError");
  }
);

// ---------------------------------------------------------------------------
// Auto-complete cycle
// ---------------------------------------------------------------------------

When(
  "I start and complete all sessions",
  function (this: CompoundWorld) {
    for (let i = 0; i < this.sessionUuids.length; i++) {
      const uuid = this.sessionUuids[i];
      startSessionByUUID(uuid);

      // Log at least one set so the session has data
      const seUuid = getSectionExerciseUuidForSession(uuid);
      logSet(uuid, {
        section_exercise_uuid: seUuid,
        set_number: 1,
        actual_reps: 8,
        weight: 100,
      });

      completeSessionByUUID(uuid);
    }
    // Keep lastSessionUuid pointing to the last session for status checks
    this.lastSessionUuid = this.sessionUuids[this.sessionUuids.length - 1];
  }
);

// ---------------------------------------------------------------------------
// Active session
// ---------------------------------------------------------------------------

Then(
  "the active session should match the first session",
  function (this: CompoundWorld) {
    const active = getActiveSession();
    assert.ok(active, "Expected an active session");
    assert.equal(active.uuid, this.sessionUuids[0]);
  }
);

// ---------------------------------------------------------------------------
// Progress steps
// ---------------------------------------------------------------------------

Given(
  "I start and complete the first session with a set",
  function (this: CompoundWorld) {
    const uuid = this.sessionUuids[0];
    this.lastSessionUuid = uuid;
    startSessionByUUID(uuid);

    const seUuid = getSectionExerciseUuidForSession(uuid);
    logSet(uuid, {
      section_exercise_uuid: seUuid,
      set_number: 1,
      target_reps: 8,
      actual_reps: 8,
      weight: 80,
    });

    completeSessionByUUID(uuid);
  }
);

Given(
  "I start and complete the first session with a set at weight {int}",
  function (this: CompoundWorld, weight: number) {
    const uuid = this.sessionUuids[0];
    this.lastSessionUuid = uuid;
    startSessionByUUID(uuid);

    const seUuid = getSectionExerciseUuidForSession(uuid);
    logSet(uuid, {
      section_exercise_uuid: seUuid,
      set_number: 1,
      target_reps: 8,
      actual_reps: 8,
      weight,
    });

    completeSessionByUUID(uuid);
  }
);

Given(
  "I start and complete the second session with a set",
  function (this: CompoundWorld) {
    const uuid = this.sessionUuids[1];
    this.lastSessionUuid = uuid;
    startSessionByUUID(uuid);

    const seUuid = getSectionExerciseUuidForSession(uuid);
    logSet(uuid, {
      section_exercise_uuid: seUuid,
      set_number: 1,
      target_reps: 8,
      actual_reps: 8,
      weight: 80,
    });

    completeSessionByUUID(uuid);
  }
);

Then(
  "the progress summary should show {int} completed session(s)",
  function (this: CompoundWorld, count: number) {
    const summary = getProgressSummary();
    assert.equal(summary.total_sessions, count);
  }
);

Then(
  "personal records should include weight {int} for the exercise",
  function (this: CompoundWorld, weight: number) {
    const records = getAllPersonalRecords();
    assert.ok(records.length > 0, "Expected at least one personal record");
    const match = records.find(
      (r) => r.exercise_uuid === this.lastExerciseUuid && r.weight === weight
    );
    assert.ok(match, `Expected a personal record with weight ${weight}`);
  }
);

Then(
  "recent sessions should return {int} sessions with the second first",
  function (this: CompoundWorld, count: number) {
    const recent = getRecentSessions(10);
    assert.equal(recent.length, count);
    // Most recently completed should be first
    assert.equal(recent[0].uuid, this.sessionUuids[1]);
    assert.equal(recent[1].uuid, this.sessionUuids[0]);
  }
);
