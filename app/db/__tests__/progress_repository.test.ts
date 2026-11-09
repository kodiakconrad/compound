import { setupTestDB, TestDatabase } from "./testDatabase";

jest.mock("../../lib/uuid", () => ({
  uuid: () => require("crypto").randomUUID(),
}));

import {
  getProgressSummary,
  getAllPersonalRecords,
  getRecentSessions,
} from "../../db/repositories/progress_repository";
import {
  startSessionByUUID,
  completeSessionByUUID,
  skipSessionByUUID,
  logSet,
} from "../../db/repositories/session_repository";
import {
  createCycle,
  getCycleWithSessions,
} from "../../db/repositories/cycle_repository";
import {
  createProgram,
  addWorkout,
  addSection,
  addSectionExercise,
} from "../../db/repositories/program_repository";
import { createExercise } from "../../db/repositories/exercise_repository";

let db: TestDatabase;

beforeEach(() => {
  db = setupTestDB();
});

afterEach(() => {
  db.close();
  jest.restoreAllMocks();
});

// Helper: full scenario — program with 2 workouts, each with 1 exercise
function buildFullScenario() {
  const ex1 = createExercise({ name: "Bench Press", muscle_group: "chest", equipment: "barbell" });
  const ex2 = createExercise({ name: "Squat", muscle_group: "legs", equipment: "barbell" });

  const program = createProgram({ name: "PPL" });

  // Workout 1
  const p2 = addWorkout(program.uuid, { name: "Push Day", day_number: 1 });
  const w1Uuid = p2.workouts[0].uuid;
  const p3 = addSection(program.uuid, w1Uuid, { name: "Main" });
  const s1Uuid = p3.workouts[0].sections[0].uuid;
  const p4 = addSectionExercise(program.uuid, s1Uuid, {
    exercise_uuid: ex1.uuid,
    target_sets: 3,
    target_reps: 5,
    target_weight: 135,
  });
  const se1Uuid = p4.workouts[0].sections[0].exercises[0].uuid;

  // Workout 2
  const p5 = addWorkout(program.uuid, { name: "Leg Day", day_number: 2 });
  const w2Uuid = p5.workouts[1].uuid;
  const p6 = addSection(program.uuid, w2Uuid, { name: "Main" });
  const s2Uuid = p6.workouts[1].sections[0].uuid;
  const p7 = addSectionExercise(program.uuid, s2Uuid, {
    exercise_uuid: ex2.uuid,
    target_sets: 3,
    target_reps: 5,
    target_weight: 225,
  });
  const se2Uuid = p7.workouts[1].sections[0].exercises[0].uuid;

  const cycle = createCycle(program.uuid);

  return {
    programUuid: program.uuid,
    cycleUuid: cycle.uuid,
    sessions: cycle.sessions,
    ex1Uuid: ex1.uuid,
    ex2Uuid: ex2.uuid,
    se1Uuid,
    se2Uuid,
  };
}

// Helper: complete a session with set logs
function completeSessionWithLogs(
  sessionUuid: string,
  sectionExerciseUuid: string,
  sets: { weight: number; actual_reps: number; target_reps?: number }[]
) {
  startSessionByUUID(sessionUuid);
  for (let i = 0; i < sets.length; i++) {
    logSet(sessionUuid, {
      section_exercise_uuid: sectionExerciseUuid,
      set_number: i + 1,
      weight: sets[i].weight,
      actual_reps: sets[i].actual_reps,
      target_reps: sets[i].target_reps,
    });
  }
  completeSessionByUUID(sessionUuid);
}

// ---------------------------------------------------------------------------
// getProgressSummary
// ---------------------------------------------------------------------------

describe("getProgressSummary", () => {
  it("returns zeros when no sessions completed", () => {
    const summary = getProgressSummary();
    expect(summary.total_sessions).toBe(0);
    expect(summary.weeks_trained).toBe(0);
    expect(summary.current_streak).toBe(0);
  });

  it("counts completed sessions", () => {
    const { sessions, se1Uuid, se2Uuid } = buildFullScenario();

    completeSessionWithLogs(sessions[0].uuid, se1Uuid, [
      { weight: 135, actual_reps: 5, target_reps: 5 },
    ]);

    const summary = getProgressSummary();
    expect(summary.total_sessions).toBe(1);
  });

  it("tracks current streak (consecutive completed, broken by skipped)", () => {
    const { sessions, se1Uuid, se2Uuid } = buildFullScenario();

    // Complete first session
    completeSessionWithLogs(sessions[0].uuid, se1Uuid, [
      { weight: 135, actual_reps: 5 },
    ]);

    // Skip second session
    skipSessionByUUID(sessions[1].uuid);

    const summary = getProgressSummary();
    // Streak should be 0 because the most recent is a skip
    expect(summary.current_streak).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// getAllPersonalRecords
// ---------------------------------------------------------------------------

describe("getAllPersonalRecords", () => {
  it("returns empty array when no completed sessions", () => {
    expect(getAllPersonalRecords().length).toBe(0);
  });

  it("returns best weight per exercise", () => {
    const { sessions, se1Uuid } = buildFullScenario();

    completeSessionWithLogs(sessions[0].uuid, se1Uuid, [
      { weight: 135, actual_reps: 5, target_reps: 5 },
      { weight: 155, actual_reps: 5, target_reps: 5 },
      { weight: 145, actual_reps: 5, target_reps: 5 },
    ]);

    const records = getAllPersonalRecords();
    expect(records.length).toBe(1);
    expect(records[0].exercise_name).toBe("Bench Press");
    expect(records[0].weight).toBe(155);
  });

  it("excludes sets where actual_reps < target_reps", () => {
    const { sessions, se1Uuid } = buildFullScenario();

    completeSessionWithLogs(sessions[0].uuid, se1Uuid, [
      { weight: 200, actual_reps: 3, target_reps: 5 }, // failed — should be excluded
      { weight: 135, actual_reps: 5, target_reps: 5 }, // succeeded
    ]);

    const records = getAllPersonalRecords();
    expect(records.length).toBe(1);
    expect(records[0].weight).toBe(135);
  });
});

// ---------------------------------------------------------------------------
// getRecentSessions
// ---------------------------------------------------------------------------

describe("getRecentSessions", () => {
  it("returns empty array when no completed or skipped sessions", () => {
    expect(getRecentSessions().length).toBe(0);
  });

  it("returns recent completed sessions", () => {
    const { sessions, se1Uuid } = buildFullScenario();

    completeSessionWithLogs(sessions[0].uuid, se1Uuid, [
      { weight: 135, actual_reps: 5 },
    ]);

    const recent = getRecentSessions();
    expect(recent.length).toBe(1);
    expect(recent[0].workout_name).toBe("Push Day");
    expect(recent[0].program_name).toBe("PPL");
    expect(recent[0].status).toBe("completed");
  });

  it("includes skipped sessions", () => {
    const { sessions, se1Uuid } = buildFullScenario();

    skipSessionByUUID(sessions[0].uuid);

    const recent = getRecentSessions();
    expect(recent.length).toBe(1);
    expect(recent[0].status).toBe("skipped");
  });

  it("respects the limit parameter", () => {
    const { sessions, se1Uuid, se2Uuid } = buildFullScenario();

    completeSessionWithLogs(sessions[0].uuid, se1Uuid, [
      { weight: 135, actual_reps: 5 },
    ]);
    completeSessionWithLogs(sessions[1].uuid, se2Uuid, [
      { weight: 225, actual_reps: 5 },
    ]);

    const recent = getRecentSessions(1);
    expect(recent.length).toBe(1);
  });
});
