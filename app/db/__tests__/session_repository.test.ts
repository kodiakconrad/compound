import { setupTestDB, TestDatabase } from "./testDatabase";

jest.mock("../../lib/uuid", () => ({
  uuid: () => require("crypto").randomUUID(),
}));

import {
  getActiveSession,
  getSessionDetail,
  startSessionByUUID,
  completeSessionByUUID,
  skipSessionByUUID,
  logSet,
  deleteSetLog,
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
import { NotFoundError, UnprocessableError } from "../../domain/errors";

let db: TestDatabase;

beforeEach(() => {
  db = setupTestDB();
});

afterEach(() => {
  db.close();
  jest.restoreAllMocks();
});

// Helper: build a program with 1 workout, 1 section, 1 exercise; create a cycle; return UUIDs
function buildSessionScenario() {
  const exercise = createExercise({ name: "Squat", muscle_group: "legs", equipment: "barbell" });
  const program = createProgram({ name: "Test Program" });
  const p2 = addWorkout(program.uuid, { name: "Day 1", day_number: 1 });
  const workoutUuid = p2.workouts[0].uuid;
  const p3 = addSection(program.uuid, workoutUuid, { name: "Main" });
  const sectionUuid = p3.workouts[0].sections[0].uuid;
  const p4 = addSectionExercise(program.uuid, sectionUuid, {
    exercise_uuid: exercise.uuid,
    target_sets: 3,
    target_reps: 5,
    target_weight: 225,
  });
  const sectionExerciseUuid = p4.workouts[0].sections[0].exercises[0].uuid;

  const cycle = createCycle(program.uuid);
  const sessionUuid = cycle.sessions[0].uuid;

  return {
    exerciseUuid: exercise.uuid,
    programUuid: program.uuid,
    sessionUuid,
    cycleUuid: cycle.uuid,
    sectionExerciseUuid,
  };
}

// ---------------------------------------------------------------------------
// getActiveSession
// ---------------------------------------------------------------------------

describe("getActiveSession", () => {
  it("returns null when no session is in_progress", () => {
    const result = getActiveSession();
    expect(result).toBeNull();
  });

  it("returns the in-progress session", () => {
    const { sessionUuid } = buildSessionScenario();
    startSessionByUUID(sessionUuid);

    const active = getActiveSession();
    expect(active).not.toBeNull();
    expect(active!.uuid).toBe(sessionUuid);
    expect(active!.status).toBe("in_progress");
  });
});

// ---------------------------------------------------------------------------
// startSessionByUUID
// ---------------------------------------------------------------------------

describe("startSessionByUUID", () => {
  it("transitions pending -> in_progress", () => {
    const { sessionUuid } = buildSessionScenario();
    startSessionByUUID(sessionUuid);

    const detail = getSessionDetail(sessionUuid);
    expect(detail.status).toBe("in_progress");
    expect(detail.started_at).toBeDefined();
  });

  it("throws UnprocessableError when session is already in_progress", () => {
    const { sessionUuid } = buildSessionScenario();
    startSessionByUUID(sessionUuid);
    expect(() => startSessionByUUID(sessionUuid)).toThrow(UnprocessableError);
  });

  it("throws NotFoundError for missing session", () => {
    expect(() => startSessionByUUID("nonexistent")).toThrow(NotFoundError);
  });
});

// ---------------------------------------------------------------------------
// completeSessionByUUID
// ---------------------------------------------------------------------------

describe("completeSessionByUUID", () => {
  it("transitions in_progress -> completed", () => {
    const { sessionUuid } = buildSessionScenario();
    startSessionByUUID(sessionUuid);
    completeSessionByUUID(sessionUuid);

    const detail = getSessionDetail(sessionUuid);
    expect(detail.status).toBe("completed");
    expect(detail.completed_at).toBeDefined();
  });

  it("saves notes when provided", () => {
    const { sessionUuid } = buildSessionScenario();
    startSessionByUUID(sessionUuid);
    completeSessionByUUID(sessionUuid, "Felt strong today");

    const detail = getSessionDetail(sessionUuid);
    expect(detail.notes).toBe("Felt strong today");
  });

  it("throws UnprocessableError when session is pending", () => {
    const { sessionUuid } = buildSessionScenario();
    expect(() => completeSessionByUUID(sessionUuid)).toThrow(UnprocessableError);
  });
});

// ---------------------------------------------------------------------------
// skipSessionByUUID
// ---------------------------------------------------------------------------

describe("skipSessionByUUID", () => {
  it("transitions pending -> skipped", () => {
    const { sessionUuid } = buildSessionScenario();
    skipSessionByUUID(sessionUuid);

    const detail = getSessionDetail(sessionUuid);
    expect(detail.status).toBe("skipped");
  });

  it("transitions in_progress -> skipped", () => {
    const { sessionUuid } = buildSessionScenario();
    startSessionByUUID(sessionUuid);
    skipSessionByUUID(sessionUuid);

    const detail = getSessionDetail(sessionUuid);
    expect(detail.status).toBe("skipped");
  });

  it("throws UnprocessableError when session is completed", () => {
    const { sessionUuid } = buildSessionScenario();
    startSessionByUUID(sessionUuid);
    completeSessionByUUID(sessionUuid);
    expect(() => skipSessionByUUID(sessionUuid)).toThrow(UnprocessableError);
  });
});

// ---------------------------------------------------------------------------
// logSet
// ---------------------------------------------------------------------------

describe("logSet", () => {
  it("creates a set log entry via section_exercise_uuid", () => {
    const { sessionUuid, sectionExerciseUuid } = buildSessionScenario();
    startSessionByUUID(sessionUuid);

    const setLog = logSet(sessionUuid, {
      section_exercise_uuid: sectionExerciseUuid,
      set_number: 1,
      target_reps: 5,
      actual_reps: 5,
      weight: 225,
    });

    expect(setLog.uuid).toBeDefined();
    expect(setLog.set_number).toBe(1);
    expect(setLog.actual_reps).toBe(5);
    expect(setLog.weight).toBe(225);
    expect(setLog.section_exercise_uuid).toBe(sectionExerciseUuid);
  });

  it("creates a set log entry via exercise_uuid", () => {
    const { sessionUuid, exerciseUuid } = buildSessionScenario();
    startSessionByUUID(sessionUuid);

    const setLog = logSet(sessionUuid, {
      exercise_uuid: exerciseUuid,
      set_number: 1,
      actual_reps: 10,
      weight: 100,
    });

    expect(setLog.exercise_uuid).toBe(exerciseUuid);
    expect(setLog.section_exercise_id).toBeNull();
  });

  it("throws UnprocessableError when session is not in_progress", () => {
    const { sessionUuid, sectionExerciseUuid } = buildSessionScenario();
    // Session is still pending
    expect(() =>
      logSet(sessionUuid, {
        section_exercise_uuid: sectionExerciseUuid,
        set_number: 1,
        actual_reps: 5,
        weight: 100,
      })
    ).toThrow(UnprocessableError);
  });

  it("throws UnprocessableError when neither exercise_uuid nor section_exercise_uuid provided", () => {
    const { sessionUuid } = buildSessionScenario();
    startSessionByUUID(sessionUuid);

    expect(() =>
      logSet(sessionUuid, { set_number: 1, actual_reps: 5 })
    ).toThrow(UnprocessableError);
  });
});

// ---------------------------------------------------------------------------
// deleteSetLog
// ---------------------------------------------------------------------------

describe("deleteSetLog", () => {
  it("removes a set log entry", () => {
    const { sessionUuid, sectionExerciseUuid } = buildSessionScenario();
    startSessionByUUID(sessionUuid);

    const setLog = logSet(sessionUuid, {
      section_exercise_uuid: sectionExerciseUuid,
      set_number: 1,
      actual_reps: 5,
      weight: 225,
    });

    deleteSetLog(setLog.uuid);

    // Verify it's gone — the session detail should have no set logs
    const detail = getSessionDetail(sessionUuid);
    const allLogs = detail.sections.flatMap((s) =>
      s.exercises.flatMap((e) => e.set_logs)
    );
    expect(allLogs.length).toBe(0);
  });

  it("throws NotFoundError for missing set log", () => {
    expect(() => deleteSetLog("nonexistent")).toThrow(NotFoundError);
  });
});
